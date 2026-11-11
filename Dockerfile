# 보조바퀴: 화면(frontend) + API(backend)를 이미지 하나로 묶는다.
# 실행 중인 서버는 backend/server.js 하나이고, /api/* 는 API, 나머지는 빌드된 화면 파일을 내보낸다.
# 비밀 값(.env)은 이미지에 넣지 않는다. 실행할 때 환경 변수로 넘긴다 (LLM_PROVIDER, OPENAI_API_KEY, DATABASE_URL ...).

# ── 1단계: 화면 빌드 ───────────────────────────────
FROM node:22-slim AS frontend-build
WORKDIR /app
# 화면이 @backend 별칭으로 backend/lib/ingredients.js 를 가져오므로 lib 도 같이 복사한다
COPY backend/lib ./backend/lib
COPY frontend/package.json frontend/package-lock.json ./frontend/
RUN npm ci --prefix frontend
COPY frontend ./frontend
RUN npm run build --prefix frontend

# ── 2단계: 실행 이미지 ─────────────────────────────
FROM node:22-slim
ENV NODE_ENV=production \
    PORT=3001
WORKDIR /app
COPY backend/package.json backend/package-lock.json ./backend/
RUN npm ci --omit=dev --prefix backend
COPY backend ./backend
COPY --from=frontend-build /app/frontend/dist ./frontend/dist

USER node
EXPOSE 3001
WORKDIR /app/backend
CMD ["node", "server.js"]
