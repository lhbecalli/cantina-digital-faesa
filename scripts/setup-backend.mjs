/* Cria backend/.venv e instala as dependências Python fixadas (backend/requirements-dev.txt). */
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const backend = join(dirname(fileURLToPath(import.meta.url)), '..', 'backend')
const win = process.platform === 'win32'
const venvPy = join(backend, '.venv', win ? 'Scripts/python.exe' : 'bin/python')
const run = (cmd, args) => { const r = spawnSync(cmd, args, { cwd: backend, stdio: 'inherit' }); if (r.status !== 0) { console.error('Falhou:', cmd, args.join(' ')); process.exit(r.status ?? 1) } }

if (!existsSync(venvPy)) run(win ? 'python' : 'python3', ['-m', 'venv', '.venv'])
run(venvPy, ['-m', 'pip', 'install', '--quiet', '-r', 'requirements-dev.txt'])
console.log('Backend pronto.')
