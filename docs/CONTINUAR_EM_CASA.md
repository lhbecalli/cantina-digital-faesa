# Continuar o projeto em outra máquina

Guia de retomada da Cantina Digital FAESA (Projeto Integrador, 4SC1). Complementa o [README](../README.md).

## 1. Subir o ambiente

Requisitos: Git, Node.js 20+ e Python 3.11+. Use PowerShell ou cmd no Windows (no Git Bash, `npm test` dos apps falha por diferença de maiúscula na letra do drive).

```powershell
git clone https://github.com/lhbecalli/cantina-digital-faesa.git
cd cantina-digital-faesa
npm install
npm run setup:backend
npm run dev
```

- App do aluno: http://localhost:5173
- Painel da cantina: http://localhost:5174 (o PIN aparece no terminal)
- API: http://localhost:8000 (`/healthz`, WebSocket em `/ws`)

No celular, na mesma Wi-Fi: `http://IP-DO-PC:5173`. Libere as portas 5173, 5174 e 8000 no firewall do Windows (redes privadas). Por IP não há push, só o toast e o sino dentro do app.

Testes: `npm run test` (Vitest), `npm run e2e` (dois navegadores headless), `pytest` dentro de `backend/`.

## 2. Estado atual

Concluído e validado:

- Duas SPAs em React + TypeScript + Tailwind (`apps/aluno`, `apps/painel`) e pacote compartilhado (`packages/shared`).
- Backend FastAPI + SQLite (PostgreSQL via `DATABASE_URL`) com REST e WebSocket em tempo real.
- Agente de IA por regras, no backend (`POST /api/agent/chat`), com 48 casos de teste. Adaptador de LLM real opcional, desligado por padrão.
- Automações n8n simuladas no servidor (relatório agendado e log), exibidas no painel.
- Web Push de "pedido pronto" (service worker, PWA, VAPID, `pywebpush`).
- Painel protegido por PIN (`ADMIN_PIN`); aluno identificado por id anônimo do aparelho.
- Testes: pytest 88, Vitest 45, e2e 11/11 etapas, `npm audit` e `pip-audit` sem vulnerabilidades.
- `legacy/` guarda o protótipo em HTML/CSS/JS puro, que abre com duplo clique (plano B offline).

## 3. Pendências e riscos conhecidos

- **Licença das fotos:** 7 fotos vieram de uma pasta local do autor e a origem não está registrada (ver `packages/shared/` e `legacy/assets/CREDITS.md`). Confirmar antes de tornar o repositório público. Água e refrigerante mostram marcas visíveis (Evian, Coca-Cola).
- **Logo da FAESA:** uso em protótipo acadêmico; confirmar permissão antes de divulgar publicamente.
- **Push de ponta a ponta:** só foi testado com envio simulado e entrega ao service worker. Falta validar no celular real (Android com Chrome em HTTPS; iPhone com iOS 16.4+ e app instalado na tela inicial).
- **QR do ticket:** gerador próprio, sem validação com leitor real.
- **Deploy no Render:** configurado (`render.yaml`, `Dockerfile`) mas nunca executado de verdade. O plano gratuito dorme após cerca de 15 minutos e o SQLite volta ao seed a cada deploy.
- **Telas não vistas em dispositivo real:** toda a inspeção visual foi em Edge headless.

## 4. Próximos passos sugeridos (em ordem)

1. Testar na rede local com o celular e corrigir o que aparecer.
2. Modo apresentação: botão que reinicia os dados e pré-carrega pedidos em vários status.
3. LLM real no agente (chave só no servidor; regras como plano B).
4. Publicar no Render e testar o push em HTTPS.
5. Secundárias: tempo estimado de preparo, aviso de item esgotado em tempo real, cancelamento de pedido, relatório em PDF/CSV, tema para telão.

Fora de escopo, conforme os slides: login real, gateway de pagamento, app nativo.

## 5. Decisões de design a preservar

- Identidade FAESA: azul `#0B3A7A` no header, fundo de página azul `#1F5CB0`, laranja `#F5921E` só como acento, verde para confirmar. Cards brancos com borda de 1px.
- Minimalista: sem bullets decorativos, sem fundo translúcido atrás de ícones, só Lucide, transições curtas (opacity + translateY) com `prefers-reduced-motion`.
- Medidas inspiradas no frontend do Bola: card de produto com `min-height` 132px, foto quadrada 112px, botão "+" de 44px, miniaturas de 64px na gestão.
- Contraste mínimo WCAG AA, verificado por teste que lê os tokens.
- Nenhum texto "simulado/simulação" na interface (pode existir em comentários e na documentação).
- Papéis visuais únicos: categorias são abas sublinhadas, filtros são toggles com check, CTA do carrinho é laranja-avermelhado, ação primária é azul.

## 6. Variáveis de ambiente

Ver `.env.example`. Em produção `ADMIN_PIN` é obrigatório. As chaves VAPID geram-se com `cd backend && .venv/Scripts/python -m app.push generate`. Nunca versione `.env` nem a chave privada.
