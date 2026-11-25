/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { realpathSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const shared = (p: string) => fileURLToPath(new URL('../../packages/shared/src/' + p, import.meta.url))

const target = `http://localhost:${process.env.API_PORT ?? 8000}`
const api = { '/api': { target, changeOrigin: false }, '/ws': { target, ws: true, changeOrigin: false } }

// A SPA fala só com /api e /ws (mesma origem). O Vite repassa para o FastAPI local (backend/), inclusive o WebSocket.
// root canônico: no Windows o npm pode iniciar o processo com a letra do drive em minúscula, o que duplica módulos (React, vitest)
export default defineConfig({
  root: realpathSync.native(dirname(fileURLToPath(import.meta.url))),
  base: process.env.VITE_BASE ?? '/', // em produção o FastAPI serve /aluno/ e /painel/ (build usa --base)
  plugins: [react(), tailwindcss()],
  // Alias direto para o código do pacote compartilhado (evita o symlink do workspace, que no Windows duplica o React por diferença de maiúsculas/minúsculas na letra do drive)
  resolve: { dedupe: ['react', 'react-dom'], alias: [{ find: '@cantina/shared/styles.css', replacement: shared('styles/index.css') }, { find: /^@cantina\/shared$/, replacement: shared('index.ts') }] },
  publicDir: '../../packages/shared/public', // logo e fotos compartilhadas
  server: { port: 5174, strictPort: true, proxy: api },
  preview: { port: 4174, strictPort: true, proxy: api },
  build: { sourcemap: false },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
