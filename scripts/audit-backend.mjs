import { spawnSync } from 'node:child_process'
process.exit(spawnSync(process.execPath, ['scripts/test-backend.mjs', 'audit'], { stdio: 'inherit' }).status ?? 1)
