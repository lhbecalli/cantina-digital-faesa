# Cantina Digital FAESA

Projeto Integrador (Sistemas de Informação, 4SC1): pedido antecipado com agente de IA e pagamento por ticket no balcão. Leia `docs/CONTINUAR_EM_CASA.md` para estado, pendências e decisões de design, e `README.md` para rodar.

## Estrutura

- `apps/aluno` e `apps/painel`: SPAs React + TypeScript + Tailwind (Vite).
- `packages/shared`: tipos, store em tempo real, transporte REST + WebSocket, UI, QR, tokens, fotos, logo.
- `backend/`: FastAPI, SQLAlchemy, SQLite, WebSocket, push; agente de IA em `POST /api/agent/chat`.
- `legacy/`: protótipo HTML/CSS/JS puro (referência e plano B offline).

## Regras

- Funcionalidades fixadas pelos slides: aluno (cardápio, pedido manual ou por chat, ticket, status, notificação), cantina (painel em tempo real, confirmar pagamento, status, cardápio, relatórios), agente de IA (dúvidas, montar pedido, status, combos). Sem gateway de pagamento, sem login real.
- Design: ver seção 5 de `docs/CONTINUAR_EM_CASA.md`. Só ícones Lucide, sem bullets decorativos, sem fundo translúcido atrás de ícones, contraste AA, sem a palavra "simulado" na UI.
- Dependências com versões fixadas; rodar `npm audit` e `pip-audit` ao alterar.
- Nunca versionar `.env`, chaves VAPID privadas ou `ANTHROPIC_API_KEY`.
- Usar PowerShell/cmd no Windows para `npm test`.

## Comandos

`npm install`, `npm run setup:backend`, `npm run dev`, `npm run test`, `npm run e2e`, `npm run build`; `pytest` em `backend/`.
