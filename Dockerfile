# ---- 1) build das duas SPAs (React + Vite) ----
FROM node:24-slim AS web
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json .oxlintrc.json ./
COPY apps ./apps
COPY packages ./packages
RUN npm ci --no-audit --no-fund && npm run build

# ---- 2) backend FastAPI servindo /aluno, /painel, /api e /ws na mesma origem ----
FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 TZ=America/Sao_Paulo APP_ENV=production
WORKDIR /srv
COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt
COPY backend ./backend
COPY --from=web /app/apps/aluno/dist ./apps/aluno/dist
COPY --from=web /app/apps/painel/dist ./apps/painel/dist
ENV STATIC_DIR=/srv/apps
WORKDIR /srv/backend
RUN useradd -m app && mkdir -p /srv/backend/data && chown -R app /srv/backend/data
USER app
EXPOSE 8000
# ADMIN_PIN é obrigatório em produção. Em hospedagem com disco efêmero, o SQLite reinicia a cada deploy (use DATABASE_URL de um PostgreSQL para persistir).
CMD ["sh", "-c", "uvicorn app.asgi:app --host 0.0.0.0 --port ${PORT:-8000} --no-proxy-headers --ws-max-size 4096"]
