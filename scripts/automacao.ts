// Rotina automática diária do GreenGoal (roda no GitHub Actions, fora do
// Netlify, sem o limite de 30 s das funções): busca os jogos do dia, gera as
// análises que faltam e os bilhetes prontos.
//
// Uso local: npx tsx scripts/automacao.ts [AAAA-MM-DD]
// Variáveis: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, API_FOOTBALL_KEY e
// ANTHROPIC_API_KEY (ou OPENAI_API_KEY); opcional ANTHROPIC_MODEL.
import { isValidDate } from '../src/lib/grade'
import { runAutomation } from '../src/server/pipeline.server'

const arg = process.argv[2]
const date = arg && isValidDate(arg) ? arg : undefined

const report = await runAutomation({ date, log: (m) => console.log(m) })
console.log(JSON.stringify({ date: report.date, generated: report.generated, failed: report.failed, limitReached: report.limitReached, tickets: report.tickets, skipped: report.skipped }))
if (report.skipped && /ausentes/.test(report.skipped)) process.exit(1)
