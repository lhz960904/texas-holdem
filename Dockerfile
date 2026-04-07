FROM node:20-slim

RUN npm i -g pnpm@10

WORKDIR /app

# Copy package files
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/client/package.json packages/client/
COPY packages/server/package.json packages/server/

# Install all dependencies (including dev for tsx)
RUN pnpm install --frozen-lockfile

# Copy source
COPY . .

# Build client static files only
RUN pnpm --filter @texas-holdem/shared build && pnpm --filter @texas-holdem/client build

EXPOSE 3001

ENV NODE_ENV=production
ENV PORT=3001

# Run server with tsx (handles TS + ESM correctly)
CMD ["sh", "-c", "echo 'Starting server...' && ls -la /app/packages/server/data/ 2>/dev/null; echo 'Node:' $(node -v); exec pnpm --filter @texas-holdem/server start"]
