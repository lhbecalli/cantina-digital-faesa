/* Sobe tudo em modo desenvolvimento: API FastAPI (8000) + app do aluno (5173) + painel (5174).
   Uso: npm run dev   (a API precisa do venv: npm run setup:backend). Ctrl+C encerra os três. */
import { spawn, spawnSync } from 'node:child_process'
import { randomInt } from 'node:crypto'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const win = process.platform === 'win32'
const py = join(root, 'backend', '.venv', win ? 'Scripts/python.exe' : 'bin/python')
const npmCmd = win ? 'npm.cmd' : 'npm'

if (!existsSync(py)) {
  console.log('[dev] criando o ambiente Python do backend (primeira vez)…')
  const r = spawnSync(process.execPath, [join(root, 'scripts', 'setup-backend.mjs')], { stdio: 'inherit' })
  if (r.status !== 0) process.exit(r.status ?? 1)
}

const host = process.env.HOST ?? '0.0.0.0' // 0.0.0.0 permite abrir no celular pelo IP do computador (mesma Wi-Fi)
const pin = process.env.ADMIN_PIN || String(randomInt(1e8)).padStart(8, '0') // sem PIN fixo: o dev fica acessível na rede
const procs = [
  ['api', py, ['-m', 'uvicorn', 'app.asgi:app', '--reload', '--host', host, '--port', '8000'], join(root, 'backend'), { APP_ENV: 'development', ADMIN_PIN: pin }],
  ['aluno', npmCmd, ['run', 'dev', '-w', '@cantina/aluno', '--', '--host', host], root, {}],
  ['painel', npmCmd, ['run', 'dev', '-w', '@cantina/painel', '--', '--host', host], root, {}],
]
const children = procs.map(([name, cmd, args, cwd, env]) => {
  const p = spawn(cmd, args, { cwd, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'], shell: win && cmd.endsWith('.cmd') })
  const tag = `[${name}] `
  const pipe = (s) => (d) => String(d).split(/\r?\n/).filter(Boolean).forEach((l) => s.write(tag + l + '\n'))
  p.stdout.on('data', pipe(process.stdout)); p.stderr.on('data', pipe(process.stderr))
  p.on('exit', (code) => { console.log(`${tag}encerrado (${code})`); stop() })
  return p
})
let stopping = false
function stop() { if (stopping) return; stopping = true; children.forEach((c) => { try { c.kill() } catch { /* ok */ } }); setTimeout(() => process.exit(0), 300) }
process.on('SIGINT', stop); process.on('SIGTERM', stop)
console.log('\nAluno:  http://localhost:5173   Painel: http://localhost:5174   API: http://localhost:8000/docs   \nPIN do painel nesta execução: ' + pin + '\n')
