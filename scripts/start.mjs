/* Modo "produção local": builda as duas SPAs e serve TUDO pelo FastAPI numa única origem
   (http://localhost:8000/aluno/, /painel/, /api, /ws). Uso: npm run preview */
import { spawn, spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const win = process.platform === 'win32'
const py = join(root, 'backend', '.venv', win ? 'Scripts/python.exe' : 'bin/python')
if (!existsSync(py)) spawnSync(process.execPath, [join(root, 'scripts', 'setup-backend.mjs')], { stdio: 'inherit' })
const b = spawnSync(win ? 'npm.cmd' : 'npm', ['run', 'build'], { cwd: root, stdio: 'inherit', shell: win })
if (b.status !== 0) process.exit(b.status ?? 1)
const port = process.env.PORT ?? '8000'
const api = spawn(py, ['-m', 'uvicorn', 'app.asgi:app', '--host', process.env.HOST ?? '0.0.0.0', '--port', port], { cwd: join(root, 'backend'), stdio: 'inherit', env: process.env })
console.log(`\nAluno: http://localhost:${port}/aluno/   Painel: http://localhost:${port}/painel/\n`)
process.on('SIGINT', () => { api.kill(); process.exit(0) })
