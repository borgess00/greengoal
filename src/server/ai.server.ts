// Geração das análises com IA, usando a chave do responsável pelo projeto
// (segredo do servidor). Dois provedores:
// - Claude (Anthropic): usado quando ANTHROPIC_API_KEY estiver configurada.
//   Modelo em ANTHROPIC_MODEL (padrão claude-opus-5-5).
// - OpenAI: usado quando só OPENAI_API_KEY existir. Modelo em OPENAI_MODEL
//   (padrão gpt-4.1-mini).
// Em ambos, a resposta é JSON estruturado (json_schema), em português do Brasil.

import Anthropic from '@anthropic-ai/sdk'
import { AI_RESPONSE_SCHEMA, isAiAnalysis, toAnthropicSchema, type AiAnalysis } from '@/lib/analysis'
import type { Facts, SectionSupport } from '@/lib/facts'

export const DEFAULT_MODEL = 'gpt-4.1-mini'
export const DEFAULT_CLAUDE_MODEL = 'claude-opus-5-5'

type Provider = 'anthropic' | 'openai'

function provider(): Provider | null {
  if (process.env.ANTHROPIC_API_KEY?.trim()) return 'anthropic'
  if (process.env.OPENAI_API_KEY?.trim()) return 'openai'
  return null
}

export function aiModel() {
  return provider() === 'anthropic'
    ? process.env.ANTHROPIC_MODEL?.trim() || DEFAULT_CLAUDE_MODEL
    : process.env.OPENAI_MODEL?.trim() || DEFAULT_MODEL
}

export function aiConfigured() {
  return provider() !== null
}

/** Nome da variável de chave em uso (para o painel admin). */
export function aiKeyName() {
  return provider() === 'openai' ? 'OPENAI_API_KEY' : 'ANTHROPIC_API_KEY'
}

export const SYSTEM_PROMPT = `Você é o analista estatístico do GreenGoal, um site brasileiro de informação sobre futebol para maiores de 18 anos.
Escreva SEMPRE em português do Brasil, com tom analítico, transparente e realista.

REGRAS DE DADOS (obrigatórias)
- Use SOMENTE números e informações presentes no JSON "dados" enviado. Não invente estatísticas, escalações, lesões, médias, odds, histórico de árbitro ou contexto que não esteja nos dados.
- Não preencha lacunas com suposições. Se um dado não existe, não o mencione como se existisse.
- Diferencie frequência observada de probabilidade estimada: "atingiu a linha em 7 dos últimos 10 jogos" é frequência (70% na amostra), não a chance exata de repetir.
- Sempre que citar frequência, informe o tamanho da amostra (ex.: "em 6 dos 8 jogos").
- Evite falsa precisão. Com amostras pequenas (menos de 5 jogos), diga que a amostra é limitada.
- Escanteios disponíveis são totais por partida; a fonte NÃO informa o minuto dos escanteios. Nunca afirme nada sobre escanteios em intervalos de tempo (ex.: primeiros 10 minutos).
- Sobre o árbitro, os dados trazem apenas o nome. Não atribua médias, perfil ou histórico ao árbitro.
- "previsao_api_football" é o modelo da própria API-Football; trate como uma referência entre outras, não como verdade.
- Quando houver odds, a "probabilidade implícita" já está sem a margem da casa. Só fale em valor comparando sua estimativa com a probabilidade implícita, e com cautela. Sem odds, não fale em valor.
- Desfalques listados são os informados pela fonte; se a lista estiver ausente, diga apenas que não há informação confirmada quando for relevante. Escalações não estão confirmadas.

PRINCÍPIOS DE ANÁLISE
- Compare as equipes de verdade: ataque, defesa, forma, mando (mandante em casa, visitante fora), qualidade dos adversários quando os dados permitirem.
- Não supervalorize o mando de campo nem presuma reação positiva só por jogar em casa.
- Favorito não é sinônimo de boa oportunidade. Linhas altas de gols (mais de 2.5, 3.5) exigem evidências robustas; também não escolha "menos gols" automaticamente.
- Em Champions League e competições inglesas, investigue com atenção os mercados de mais gols, mas só os destaque se os números sustentarem.
- Para finalizações de jogadores, use volume (finalizações e no alvo por jogo, jogos e minutos) e não reputação. Lembre que a titularidade não está confirmada.
- Não use confrontos diretos antigos como argumento principal.
- Não acumule conclusões correlacionadas como se fossem independentes.

FORMATO
- "secoes": nove seções. Cada uma com 2 a 4 frases objetivas, ou null quando não houver dados suficientes nos "dados" para aquela seção. As seções marcadas como sem suporte em "suporte_por_secao" DEVEM ser null.
  importancia: contexto da competição, rodada e classificação.
  confrontos: retrospecto dos confrontos diretos.
  forma: forma recente das duas equipes (geral e no mando).
  probabilidade: percentuais disponíveis (API e/ou mercado) e sua leitura.
  gols: tendências de gols, linhas 1.5/2.5/3.5 e ambos marcam.
  escanteios: médias de escanteios a favor/contra e frequências de linhas.
  cartoes: médias de cartões disponíveis.
  arbitro: apenas o nome do árbitro designado e a ressalva de que não há histórico nos dados.
  finalizacoes: principais finalizadores e médias por jogo.
- "destaques": de 0 a 6 mercados com melhor sustentação estatística. Não force destaques: se os dados forem fracos, retorne lista vazia. Para cada um:
  mercado (ex.: "Mais de 1.5 gols"), leitura (1 a 2 frases), probabilidade_estimada (inteiro de 1 a 99, conservador, ou null se não houver base), frequencia_observada (ex.: "8 de 10 jogos" ou null), risco ("baixo" | "medio" | "medio-alto", refletindo probabilidade, variabilidade e qualidade dos dados — nunca só a linha), a_favor e contra (motivos objetivos).
- "alertas": riscos que podem invalidar a leitura (amostra pequena, escalação não confirmada, dados ausentes etc.).
- "resumo": 2 a 3 frases de conclusão, dizendo também o que merece cautela.
- "confianca_dados": "alta", "media" ou "baixa" conforme a quantidade e a qualidade dos dados.

PROIBIDO: prometer lucro, ganho, acerto ou resultado; usar "garantido", "certeza", "aposta certa", "sem risco", "100%". Probabilidade alta não é certeza. Apostas envolvem risco.`

function userMessage(facts: Facts, support: SectionSupport) {
  return JSON.stringify({
    instrucao: 'Analise a partida abaixo seguindo rigorosamente as regras. Responda apenas com o JSON do esquema.',
    suporte_por_secao: support,
    dados: facts,
  })
}

function parseAnalysis(content: string | null | undefined): AiAnalysis {
  if (!content) throw new Error('Resposta vazia da IA.')
  let parsed: unknown
  try {
    parsed = JSON.parse(content)
  } catch {
    throw new Error('A IA retornou JSON inválido.')
  }
  if (!isAiAnalysis(parsed)) throw new Error('A resposta da IA não segue o formato esperado.')
  return parsed
}

// Modelos com fallback no servidor quando a IA recusa um pedido.
const SERVER_FALLBACK = /^claude-(opus-5|fable-5|sonnet-5-5)/

async function generateWithClaude(facts: Facts, support: SectionSupport) {
  const model = aiModel()
  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY!.trim(),
    // ANTHROPIC_BASE_URL só para testes locais (servidor simulado).
    baseURL: process.env.ANTHROPIC_BASE_URL?.trim() || undefined,
    timeout: 120_000,
    maxRetries: 2,
  })
  const fallback = SERVER_FALLBACK.test(model)
  try {
    const response = await client.beta.messages.create({
      model,
      max_tokens: 16000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage(facts, support) }],
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: toAnthropicSchema(AI_RESPONSE_SCHEMA) } },
      ...(fallback ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const } : {}),
    })
    if (response.stop_reason === 'refusal') throw new Error('A IA recusou gerar a análise.')
    if (response.stop_reason === 'max_tokens') throw new Error('Resposta da IA truncada (limite de tokens).')
    const text = response.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('')
    return { analysis: parseAnalysis(text), model: response.model, usage: response.usage }
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) throw new Error('ANTHROPIC_API_KEY inválida.')
    if (e instanceof Anthropic.PermissionDeniedError) throw new Error('A chave do Claude não tem permissão para este modelo.')
    if (e instanceof Anthropic.RateLimitError) throw new Error('Limite de uso da API do Claude atingido. Tente mais tarde.')
    if (e instanceof Anthropic.BadRequestError) throw new Error(`Claude recusou o pedido: ${e.message}`)
    if (e instanceof Anthropic.APIError) throw new Error(`Claude respondeu ${e.status ?? 'erro'}: ${e.message}`)
    throw e
  }
}

export async function generateAiAnalysis(facts: Facts, support: SectionSupport): Promise<{ analysis: AiAnalysis; model: string; usage: unknown }> {
  const p = provider()
  if (!p) throw new Error('Nenhuma chave de IA configurada (ANTHROPIC_API_KEY ou OPENAI_API_KEY).')
  if (p === 'anthropic') return generateWithClaude(facts, support)

  const key = process.env.OPENAI_API_KEY!.trim()
  const model = aiModel()
  const user = userMessage(facts, support)

  const base = process.env.OPENAI_BASE_URL?.trim() || 'https://api.openai.com/v1'
  const res = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(90_000),
    body: JSON.stringify({
      model,
      temperature: 0.3,
      max_tokens: 3500,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: user },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'greengoal_analysis', strict: true, schema: AI_RESPONSE_SCHEMA },
      },
    }),
  })

  if (!res.ok) {
    let detail = ''
    try {
      const body = (await res.json()) as { error?: { message?: string } }
      detail = body.error?.message ?? ''
    } catch {
      /* corpo não-JSON */
    }
    throw new Error(`OpenAI respondeu ${res.status}${detail ? `: ${detail}` : ''}`)
  }

  const body = (await res.json()) as {
    choices?: Array<{ message?: { content?: string | null; refusal?: string | null }; finish_reason?: string }>
    usage?: unknown
  }
  const choice = body.choices?.[0]
  if (choice?.message?.refusal) throw new Error('A IA recusou gerar a análise.')
  if (choice?.finish_reason === 'length') throw new Error('Resposta da IA truncada (limite de tokens).')
  return { analysis: parseAnalysis(choice?.message?.content), model, usage: body.usage }
}
