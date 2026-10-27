// Leitura protegida e geração das análises.
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import type { AnalysisRow } from '@/lib/types'
import { optionalAuth, requireAdmin } from './auth-middleware'
import { userHasActiveSubscription, userIsAdmin } from './access.server'
import { supabaseAsUser } from '@/integrations/supabase/supabase.server'
import { generateAnalysisCore, type GenerateResult } from './pipeline.server'

export type { GenerateResult }

const idInput = z.object({ fixtureId: z.coerce.number().int().positive() })

export type AnalysisAccess =
  | { access: 'login' }
  | { access: 'locked' }
  | { access: 'granted'; analysis: Pick<AnalysisRow, 'status' | 'content' | 'generated_at'> | null; isAdmin: boolean }

/**
 * Devolve a análise somente para assinantes ativos ou administradores.
 * A leitura usa o token do próprio usuário, então o RLS do banco também
 * filtra: mesmo que a checagem acima falhasse, o conteúdo não sairia.
 */
export const getAnalysisAccess = createServerFn({ method: 'GET' })
  .middleware([optionalAuth])
  .validator((d: { fixtureId: number }) => idInput.parse(d))
  .handler(async ({ data, context }): Promise<AnalysisAccess> => {
    if (!context.auth) return { access: 'login' }
    const userId = context.auth.user.id
    const [sub, admin] = await Promise.all([userHasActiveSubscription(userId), userIsAdmin(userId)])
    if (!sub && !admin) return { access: 'locked' }
    const { data: row, error } = await supabaseAsUser(context.auth.token)
      .from('analyses')
      .select('status, content, generated_at')
      .eq('fixture_id', data.fixtureId)
      .maybeSingle()
    if (error) throw new Error('Não foi possível carregar a análise.')
    const visible = row && row.status === 'done' ? (row as AccessRow) : null
    return { access: 'granted', analysis: visible, isAdmin: admin }
  })

type AccessRow = Pick<AnalysisRow, 'status' | 'content' | 'generated_at'>

/**
 * Gera (ou regenera) a análise de UMA partida pelo painel admin, inclusive no
 * lote do dia, que chama esta função em sequência e para no teto diário.
 */
export const generateAnalysis = createServerFn({ method: 'POST' })
  .middleware([requireAdmin])
  .validator((d: { fixtureId: number; force?: boolean }) =>
    z.object({ fixtureId: z.coerce.number().int().positive(), force: z.boolean().optional() }).parse(d),
  )
  .handler(async ({ data, context }): Promise<GenerateResult> => generateAnalysisCore(data.fixtureId, !!data.force, context.user.id))
