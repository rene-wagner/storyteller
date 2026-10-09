FROM node:24-bookworm-slim

WORKDIR /app
RUN npm install --global pnpm@12.10.1
COPY . .
RUN pnpm install --frozen-lockfile && pnpm --filter @storyteller/api... build
