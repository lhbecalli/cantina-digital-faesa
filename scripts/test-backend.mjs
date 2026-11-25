import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
const backend = join(dirname(fileURLToPath(import.meta.url)), '..', 'backend')
const win = process.platform === 'win32'
const py = join(backend, '.venv', win ? 'Scripts/python.exe' : 'bin/python')
const args = process.argv[2] === 'audit' ? ['-m', 'pip_audit', '-r', 'requirements.txt'] : ['-m', 'pytest', '-q']
process.exit(spawnSync(py, args, { cwd: backend, stdio: 'inherit' }).status ?? 1)
