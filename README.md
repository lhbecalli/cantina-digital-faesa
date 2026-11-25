# Cantina Digital FAESA

Protótipo do Projeto Integrador: **app do aluno** (cardápio, assistente de IA, ticket com QR, acompanhamento em tempo real) e **painel da cantina** (kanban, cardápio, relatório), com **backend FastAPI**. O aluno pede pelo celular e o pedido aparece na hora no painel de outro computador.

## Como rodar no notebook

Siga na ordem. Todos os comandos são para o **PowerShell** do Windows. Os passos 1 a 3 são feitos uma vez em cada notebook, precisam de internet e devem ser feitos antes do dia da apresentação.

### 1. Instalar os programas

1. [Git](https://git-scm.com/download/win).
2. [Node.js](https://nodejs.org) 24 ou mais novo.
3. [Python](https://www.python.org/downloads/) 3.11 ou mais novo (na instalação, marque **Add python.exe to PATH**).

Depois feche o PowerShell, abra um novo e confira as versões:

```powershell
git --version
node --version
python --version
```

### 2. Clonar o projeto

```powershell
git clone https://github.com/lhbecalli/cantina-digital-faesa.git
cd cantina-digital-faesa
```

A pasta `cantina-digital-faesa` é a **raiz do projeto**. Ao abrir um novo PowerShell, entre nela com `cd` antes de rodar os comandos `npm.cmd`.

### 3. Instalar as dependências

Na raiz do projeto:

```powershell
npm.cmd install
npm.cmd run setup:backend
```

O segundo comando cria o ambiente Python em `backend\.venv`, instala as dependências e termina com `Backend pronto.`

### 4. Rodar só no notebook

Serve para testar se tudo funciona. Na raiz do projeto:

```powershell
npm.cmd run dev
```

| O quê | Endereço |
|---|---|
| App do aluno | http://localhost:5173 |
| Painel da cantina | http://localhost:5174 |
| API (documentação) | http://localhost:8000/docs |

O PIN do painel neste modo é aleatório e aparece no terminal a cada execução (para fixar um, defina `$env:ADMIN_PIN` antes). Para encerrar, aperte `Ctrl+C` (encerre antes de seguir para o passo 5, porque os dois modos usam a porta 8000).

### 5. Colocar no ar para o celular (Cloudflare Quick Tunnel)

É o modo da **apresentação**. O app roda no notebook e um túnel gratuito gera um endereço HTTPS público, sem conta na Cloudflare. O notebook e o celular **não precisam estar na mesma rede**, mas ambos precisam de internet.

#### 5.1. Baixar o cloudflared (uma vez em cada notebook)

```powershell
New-Item -ItemType Directory -Force "$env:USERPROFILE\cantina-tools"
Invoke-WebRequest https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe -OutFile "$env:USERPROFILE\cantina-tools\cloudflared.exe"
```

#### 5.2. Terminal 1: o app

Abra um PowerShell na raiz do projeto e faça os três itens abaixo **no mesmo terminal, nesta ordem**.

**a) Configurar.** Troque `SEU-PIN-LONGO` por um PIN seu (de preferência só números, 8 ou mais):

```powershell
$env:APP_ENV='production'; $env:ADMIN_PIN='SEU-PIN-LONGO'; $env:RATE_LIMIT_PER_MIN='3000'
```

**b) Notificações no celular (opcional).** Só se quiser o aviso de "pedido pronto" com a tela bloqueada. Precisa ser feito antes de subir o app. Gera chaves VAPID novas a cada execução e as guarda apenas neste terminal:

```powershell
cd backend
.\.venv\Scripts\python -m app.push generate | Where-Object { $_ -match '^VAPID_(PUBLIC|PRIVATE)_KEY=' } | ForEach-Object { $k,$v = $_ -split '=',2; Set-Item "env:$k" $v }
$env:VAPID_SUBJECT='mailto:cantina@example.com'
cd ..
```

**c) Subir o app:**

```powershell
npm.cmd run preview
```

Esse comando gera a versão final das telas e inicia o servidor na porta 8000. Espere aparecer `Application startup complete` e deixe o terminal aberto.

#### 5.3. Terminal 2: o túnel

Abra um segundo PowerShell:

```powershell
& "$env:USERPROFILE\cantina-tools\cloudflared.exe" tunnel --url http://127.0.0.1:8000
```

O terminal mostra um endereço terminado em `.trycloudflare.com`. Copie esse endereço e deixe o terminal aberto.

#### 5.4. Abrir as telas

| Onde | Endereço |
|---|---|
| Celular (aluno) | `https://XXXX.trycloudflare.com/aluno/` |
| Notebook (painel, entre com o PIN do item 5.2) | http://localhost:8000/painel/ |

Troque `XXXX` pelo que apareceu no Terminal 2. O endereço **muda a cada reinício do túnel**; no endereço novo, o celular começa como um aluno novo (sem os pedidos anteriores).

#### 5.5. Ativar o aviso no celular (se fez o item 5.2 b)

- **Android (Chrome):** abra o endereço do aluno, faça um pedido, toque em **Ativar** no aviso do ticket (ou em Perfil, **Ativar avisos**) e aceite a permissão.
- **iPhone (iOS 16.4 ou mais novo):** no Safari, toque em Compartilhar e em **Adicionar à Tela de Início**, abra o app pelo ícone e ative em Perfil.

Para testar, marque o pedido como pronto no painel e bloqueie a tela do celular. Sem as notificações, o aviso continua aparecendo dentro do app.

**Atalho:** o arquivo `Iniciar Cantina.bat` existe só no notebook onde foi criado e **não vem no clone**. Em outro notebook, use os dois terminais acima.

### 6. Alternativa: celular na mesma rede Wi-Fi (sem túnel)

Use quando o túnel não funcionar e o notebook e o celular estiverem na mesma rede.

1. Faça o Terminal 1 (item 5.2, sem as notificações). O Terminal 2 não é necessário.
2. Em outro PowerShell, rode `ipconfig` e anote o "Endereço IPv4" do notebook (representado aqui por `XXXXXX`).
3. No celular, abra `http://XXXXXX:8000/aluno/`. O painel abre em `http://localhost:8000/painel/` no notebook ou em `http://XXXXXX:8000/painel/` em outro computador.
4. Na primeira vez, o Firewall do Windows pode pedir permissão para o Node ou o Python: permita em **redes privadas**. Se o aviso não apareceu e o celular não abre a página, libere a porta 8000 em Windows Defender Firewall, Regras de entrada.

Por esse caminho (HTTP) **não há notificação com a tela bloqueada** nem instalação do app; o aviso de pedido pronto aparece só dentro do app (mensagem na tela e sino).

O modo `npm.cmd run dev` também aceita acesso pela rede (`http://XXXXXX:5173` para o aluno e `http://XXXXXX:5174` para o painel, portas 5173, 5174 e 8000 no firewall), com o PIN mostrado no terminal.

### Como desligar

1. Aperte `Ctrl+C` no Terminal 2 (túnel) e no Terminal 1 (app). Se aparecer a pergunta `Deseja finalizar o arquivo em lotes (S/N)?`, responda `S`.
2. Feche os dois terminais. Isso descarta o PIN e as chaves configurados neles.

Os pedidos ficam salvos no notebook (`backend\data\cantina.db`) e voltam na próxima execução.

### Problemas comuns

| Problema | O que fazer |
|---|---|
| `git`, `node` ou `python` "não é reconhecido", ou `python` abre a Microsoft Store | Confira a instalação do passo 1 (com **Add python.exe to PATH**) e abra um PowerShell novo. |
| PowerShell diz que a execução de scripts está desabilitada ao rodar `npm` | Use `npm.cmd` no lugar de `npm`. |
| `git clone` pede login ou diz que o repositório não foi encontrado | Peça ao dono do repositório para liberar o acesso à sua conta do GitHub. |
| `npm.cmd` não encontra o `package.json` | Você está fora da raiz do projeto: entre na pasta com `cd`. |
| A instalação do backend falhou no meio | Apague o ambiente com `Remove-Item -Recurse -Force backend\.venv` (na raiz) e rode `npm.cmd run setup:backend` de novo. |
| Erro `ADMIN_PIN é obrigatório em produção` | Rode o item 5.2 a) no mesmo terminal antes de `npm.cmd run preview`. |
| Porta 8000, 5173 ou 5174 em uso | Há outra execução aberta: encerre com `Ctrl+C`. Se não achar o terminal, use os comandos abaixo. |
| O túnel não conecta | Acrescente `--protocol http2` ao final do comando do Terminal 2, use o hotspot do celular ou siga o passo 6. |
| O endereço do túnel parou de abrir | Confira se os dois terminais continuam abertos. Se reiniciou o túnel, use o endereço novo. |
| O painel não aceita o PIN ou não conecta após trocar o PIN | Clique em **Sair** e entre com o PIN definido no Terminal 1. |
| "O servidor ainda não está configurado para enviar avisos push" | Encerre o app, rode o item 5.2 b) e suba de novo. |
| O aviso estava ativado e parou de chegar depois de gerar chaves novas | No celular, em Perfil, toque em **Desativar avisos** e depois em **Ativar avisos**. |
| Sem internet | Abra `legacy\index.html` (protótipo offline; funciona só no notebook, sem o celular). |

Para liberar uma porta ocupada (troque `8000` pela porta e `NUMERO` pelo valor de `OwningProcess`):

```powershell
Get-NetTCPConnection -LocalPort 8000 -State Listen | Select-Object OwningProcess
Stop-Process -Id NUMERO
```

### Checklist da apresentação

Antes do dia:

- Passos 1 a 3 e item 5.1 concluídos no notebook que será usado.
- Ensaio completo com um celular real: pedido, pagamento, status "pronto" e assistente.

No dia:

- Notebook na tomada, configurado para não suspender.
- Terminal 1 e Terminal 2 abertos; não fechar nenhum deles.
- Endereço novo do túnel testado no celular e enviado a quem for usar.
- Painel aberto em http://localhost:8000/painel/ com o PIN.
- Evitar o botão **Reiniciar dados da demo** (aba Relatório): ele apaga pedidos e o nome do aluno no servidor (contorno: salvar um nome diferente no Perfil).
- O painel não lê o QR do ticket; o atendente localiza o pedido pelo número.

### Aviso de segurança

Qualquer pessoa com o endereço abre o app, e quem souber o PIN controla o painel. Use um PIN longo: após 8 tentativas erradas em um minuto, o endereço de origem fica bloqueado por até um minuto, inclusive para o PIN correto. Não publique o PIN nem as chaves VAPID e encerre os terminais ao terminar. O modo `npm.cmd run dev` fica acessível na rede local; use-o só em rede confiável.

---

# Referência técnica

## Stack e estrutura

Stack (espelha o frontend do Bola): React 19 + TypeScript + Vite + Tailwind 4 + React Router 7 + lucide-react, Vitest/Testing Library, oxlint. Backend: FastAPI + SQLAlchemy + SQLite (`DATABASE_URL`; ver a pendência sobre PostgreSQL em "Publicar online") + WebSocket.

```
apps/aluno/        SPA do aluno (porta 5173; em produção /aluno/)
apps/painel/       SPA do painel (porta 5174; em produção /painel/)
packages/shared/   código comum: tipos, store em tempo real, transporte REST+WebSocket, UI, QR, tokens de estilo, logo e fotos (public/)
backend/           API FastAPI (app/), testes pytest (tests/), requirements fixados
scripts/           dev, preview, setup do backend, e2e headless
legacy/            protótipo anterior em HTML/CSS/JS puro (referência e plano B offline)
```

## Como as SPAs conversam

Tudo passa pelo backend (única fonte da verdade). As telas fazem `fetch` para REST e abrem um **WebSocket** (`/ws`) que recebe o estado a cada mudança; se o socket cai, reconecta com backoff e usa **polling** enquanto isso. Não há mais `localStorage` compartilhado.

Em desenvolvimento (`npm.cmd run dev`), os dois Vite fazem proxy de `/api` e `/ws` para a API, então cada SPA enxerga uma única origem. Em `npm.cmd run preview`, o build é servido **todo pelo FastAPI numa origem só** (`/aluno/` e `/painel/`).

- **Aluno**: identificado por um id anônimo gerado no aparelho (`localStorage`, header `X-Student-Id`). "Meus pedidos", status e notificações seguem o aparelho; ele só cria pedidos e lê os próprios. Nome editável no Perfil. "Usar a conta de demonstração (Luiz)" troca para o aluno dos dados iniciais.
- **Painel**: rotas de administração (`/api/admin/*`, que incluem avanço de status, cardápio e reset) exigem o **PIN** (`X-Admin-Pin`).
- **Pedidos**: numeração atômica no servidor, transições validadas (aguardando, preparo, pronto, retirado), ações idempotentes (confirmar pagamento 2x não duplica; `clientRequestId` evita pedido duplicado).
- **Agente de IA**: roda no backend (`POST /api/agent/chat`), por regras com function calling simulado. Adaptador opcional de LLM real desligado por padrão (`LLM_ENABLED`, `ANTHROPIC_API_KEY`, `LLM_MODEL`).
- **Automações n8n simuladas** rodam no servidor (relatório agendado + log persistido, mostrados no painel).

## Publicar online (hospedagem permanente)

Uma única origem: o FastAPI serve `/aluno/`, `/painel/`, `/api` e `/ws`. Há `Dockerfile` e `render.yaml`.

> **Pendências conhecidas:** o `package-lock.json` está fora de sincronia e o `npm ci` falha (quebra o build do Docker e do Render); rode `npm install` e versione o arquivo antes do deploy. PostgreSQL ainda não funciona (timestamps em `Integer` estouram); use SQLite.

**Render (gratuito):**

1. Suba o repositório para o GitHub.
2. No Render: **New, Blueprint** e escolha o repositório (usa `render.yaml`), ou **New, Web Service, Docker**.
3. Defina a variável **`ADMIN_PIN`** (obrigatória) e, opcionalmente, as chaves VAPID.
4. Faça o deploy. URLs: `https://SEU-APP.onrender.com/aluno/` (celular) e `/painel/` (computador). Health check: `/healthz`.

Ressalvas do plano free: o serviço **"dorme"** após ~15 min sem acesso (o primeiro acesso demora ~30–60 s: abra antes da apresentação) e o disco é **efêmero** (o SQLite volta aos dados iniciais a cada deploy/reinício). Persistir com PostgreSQL depende de corrigir a pendência acima e adicionar `psycopg[binary]` ao `backend/requirements.txt`. Railway e Fly.io funcionam com o mesmo Dockerfile (`PORT` é respeitada).

Comandos equivalentes sem Docker (o build depende da mesma pendência do `npm ci`; defina `APP_ENV=production` e `ADMIN_PIN`):

- Build: `npm ci && npm run build`
- Start: `cd backend && pip install -r requirements.txt && uvicorn app.asgi:app --host 0.0.0.0 --port $PORT --ws-max-size 4096`

## Variáveis de ambiente

| Variável | Para quê |
|---|---|
| `APP_ENV` | `production` exige `ADMIN_PIN` e desliga `/docs` |
| `ADMIN_PIN` | PIN do painel e das rotas admin (em desenvolvimento, se vazio, é gerado e mostrado no terminal) |
| `DATABASE_URL` | padrão SQLite (`backend/data/cantina.db`); formato PostgreSQL `postgresql+psycopg://…` (ver pendência acima) |
| `PORT`, `HOST` | porta e interface do `preview` (padrão `8000` e `0.0.0.0`); `HOST` também vale no `dev` |
| `CORS_ORIGINS` | só se o front ficar em outro domínio |
| `TRUST_PROXY` | `true` somente atrás de um proxy confiável (usa o último valor de `X-Forwarded-For`) |
| `REPORT_INTERVAL_SECONDS`, `RATE_LIMIT_PER_MIN`, `ORDER_RATE_PER_MIN`, `MAX_WS_CONNECTIONS` | automação e limites |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `PUSH_ON_PREPARO` | Web Push |
| `LLM_ENABLED`, `ANTHROPIC_API_KEY`, `LLM_MODEL` | LLM opcional (desligado) |
| `VITE_API_URL` | (build) só se a API estiver em outro domínio |

A lista de referência está em `.env.example`. O app **não carrega arquivos `.env` sozinho**: defina as variáveis no terminal ou no serviço de hospedagem. **Nenhum segredo fica no código.**

## Aviso de "pedido pronto" no celular (Web Push)

O passo a passo para a apresentação está nos itens 5.2 b) e 5.5.

- A notificação chega com a tela bloqueada, pelo service worker do app (`/aluno/sw.js`, escopo `/aluno/`). A mensagem na tela e o sino dentro do app continuam como reserva.
- **Exige HTTPS** (ou `localhost`). No Render e no túnel já é HTTPS. Na rede local por IP **não há push**.
- **Chaves VAPID:** em um servidor fixo, gere uma vez com `.venv\Scripts\python -m app.push generate` dentro de `backend\` (Linux/macOS: `.venv/bin/python -m app.push generate`) e copie as linhas para o ambiente do servidor, trocando o `VAPID_SUBJECT`. A chave **privada nunca vai ao repositório**.
- Sem as chaves o app funciona e só mostra o aviso dentro dele (o registro de automações do painel indica "desativado (sem chaves VAPID)").
- O servidor remove assinaturas expiradas (404/410), envia em segundo plano, não duplica (idempotente por pedido+status) e registra o resultado em "Automações".

## Testes e validação

Na raiz, em PowerShell ou cmd (no Git Bash os testes das SPAs falham no Windows), depois do passo 3:

```powershell
npm.cmd test               # vitest (shared, aluno, painel) + pytest (backend: API, transições, concorrência, idempotência, WebSocket, agente 48 casos, push)
npm.cmd run lint           # oxlint
npm.cmd run typecheck
npm.cmd run build
npm.cmd run e2e            # headless real (Edge ou Chrome), depois do build: celular 375px + painel desktop falando com o FastAPI
npm.cmd run audit          # npm audit + pip-audit
```

Os contrastes (WCAG AA) são verificados em `packages/shared/tests/contrast.test.ts`, lendo os tokens de `styles/tokens.css`.

## Segurança

PIN nas rotas admin (comparação em tempo constante e bloqueio após tentativas erradas, na API e no WebSocket; o WebSocket recebe o PIN na primeira mensagem, nunca na URL), CORS restrito por env, limite de tamanho de corpo (64 KB) e de mensagem WebSocket, limite de requisições por IP e de pedidos por aluno, limite de conexões WebSocket, validação Pydantic, nomes saneados, cabeçalhos de segurança (CSP, `X-Frame-Options`…), `/docs` desligado em produção, nada de `eval`/`exec` com entrada do usuário.

## Créditos e limitações

Créditos das imagens em `packages/shared/CREDITS.md`. O logo da FAESA é o arquivo do projeto do aluno. O QR é gerado por código próprio (versões 1–6) e **não foi validado com leitor real**. O agente por regras é limitado a frases próximas dos exemplos. Dados e matrícula são fictícios.
