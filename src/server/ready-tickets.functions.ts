// Bilhetes prontos do dia: leitura (assinantes) e geração manual (admin).
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { currentGradeDate, isValidDate } from '@/lib/grade'
import type { ReadyTicketsContent } from '@/lib/ready-tickets'
import { optionalAuth, requireAdmin } from './auth-middleware'
import { userHasActiveSubscription, userIsAdmin } from './access.server'
import { supabaseAsUser } from '@/integrations/supabase/supabase.server'
import { generateReadyTicketsCore } from './pipeline.server'

export type ReadyTicketsAccess =
  | { access: 'login' }
  | { access: 'locked' }
  | { access: 'granted'; date: string; status: string | null; content: ReadyTicketsContent | null; isAdmin: boolean }

const dateInput = z.object({ date: z.string().refine(isValidDate).optional() })

export const getReadyTickets = createServerFn({ method: 'GET' })
  .middleware([optionalAuth])
  .validator((d: { date?: string }) => dateInput.parse(d))
  .handler(async ({ data, context }): Promise<ReadyTicketsAccess> => {
    if (!context.auth) return { access: 'login' }
    const userId = context.auth.user.id
    const [sub, admin] = await Promise.all([userHasActiveSubscription(userId), userIsAdmin(userId)])
    if (!sub && !admin) return { access: 'locked' }
    const date = data.date ?? currentGradeDate()
    // Leitura com o token do usuário: o RLS também protege o conteúdo.
    const { data: row, error } = await supabaseAsUser(context.auth.token)
      .from('daily_tickets')
      .select('status, content')
      .eq('grade_date', date)
      .maybeSingle()
    if (error) throw new Error('Não foi possível carregar os bilhetes.')
    return {
      access: 'granted',
      date,
      status: (row?.status as string | undefined) ?? null,
      content: row?.status === 'done' ? (row.content as ReadyTicketsContent) : null,
      isAdmin: admin,
    }
  })

export const generateReadyTickets = createServerFn({ method: 'POST' })
  .middleware([requireAdmin])
  .validator((d: { date: string }) => z.object({ date: z.string().refine(isValidDate) }).parse(d))
  .handler(async ({ data, context }) => generateReadyTicketsCore(data.date, context.user.id))
