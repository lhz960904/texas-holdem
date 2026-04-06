FROM node:20-slim

# Install pnpm
RUN npm i -g pnpm@10

WORKDIR /app

# Copy package files
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/client/package.json packages/client/
COPY packages/server/package.json packages/server/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source
COPY . .

# Build all packages
RUN pnpm build

# Expose port
EXPOSE 3001

ENV NODE_ENV=production
ENV PORT=3001

CMD ["node", "packages/server/dist/index.js"]
