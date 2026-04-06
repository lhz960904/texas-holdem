# ALL IN — Texas Hold'em Poker

**[English](#english) | [中文](#中文)**

A full-stack, real-time multiplayer Texas Hold'em poker game with AI opponents and voice chat.

> **Live Demo**: [texas-holdem-production-c30c.up.railway.app](https://texas-holdem-production-c30c.up.railway.app)

## Screenshots

<p align="center">
  <img src="docs/screenshots/login.png" width="32%" alt="Login" />
  <img src="docs/screenshots/lobby.png" width="32%" alt="Lobby" />
  <img src="docs/screenshots/game-table.png" width="32%" alt="Game Table" />
</p>

<p align="center">
  <em>Login &nbsp;·&nbsp; Lobby &nbsp;·&nbsp; Game Table</em>
</p>

---

<a id="english"></a>

## Features

- **Real-time Multiplayer** — WebSocket-based, supports 2–8 players per room
- **AI Opponents** — 4 personalities (Shark, Maniac, Rock, Fox) powered by Claude API + rule-based fallback
- **Voice Chat** — LiveKit integration with mic/speaker toggle and speaking indicators
- **Mobile Optimized** — PWA, forced landscape, touch-friendly controls, WeChat WebView compatible
- **Persistent Accounts** — SQLite-backed user system with chip balance tracking
- **Sound Effects** — Card dealing, chip sounds, turn alerts
- **Chip Animations** — Bet push-in, pot collection, winner glow effects

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19 · TypeScript · Tailwind CSS 4 · Zustand · Vite |
| **Backend** | Hono.js · WebSocket (ws) · tsx |
| **Database** | SQLite (better-sqlite3) · WAL mode |
| **Auth** | JWT · bcryptjs |
| **AI** | Claude API (Haiku) · poker-evaluator · Monte Carlo equity |
| **Voice** | LiveKit (client + server SDK) |
| **Deploy** | Docker · Railway |

## Architecture

```
texas-holdem/
├── packages/
│   ├── shared/          # Types, WebSocket protocol, poker utils
│   ├── client/          # React SPA (Vite)
│   │   ├── components/  # Login, Lobby, WaitingRoom, SettleOverlay
│   │   ├── game/        # PokerTable, PlayerSeat, PlayingCard, ChipPile
│   │   ├── hooks/       # useVoice (LiveKit)
│   │   ├── stores/      # Zustand game store
│   │   └── lib/         # WsClient, SoundManager
│   └── server/          # Hono HTTP + WebSocket server
│       ├── ai/          # AI decision engine + personalities
│       ├── engine/      # Game state machine, hand evaluator, pot calculator
│       ├── rooms/       # Room lifecycle management
│       ├── ws/          # WebSocket message routing
│       ├── auth/        # JWT signing/verification
│       └── db/          # SQLite setup + user repository
├── Dockerfile
└── docker-compose.yml
```

### Data Flow

```
Client (React + Zustand)
  ↕ WebSocket (JSON events)
Server (Hono + ws)
  ├── RoomManager → GameEngine → HandEvaluator
  ├── AIPlayerManager → Claude API / Fallback Rules
  ├── UserRepository → SQLite
  └── LiveKit Token → Voice Chat
```

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 10+

### Installation

```bash
git clone https://github.com/lhz960904/texas-holdem.git
cd texas-holdem
pnpm install
```

### Environment Variables

Create `packages/server/.env`:

```env
# Optional — voice chat (LiveKit Cloud)
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=your-api-key
LIVEKIT_API_SECRET=your-api-secret

# Optional — AI decisions (Claude API)
ANTHROPIC_API_KEY=your-anthropic-key
```

> Without LiveKit vars, voice chat is silently disabled. Without Anthropic key, AI uses rule-based fallback.

### Development

```bash
pnpm dev
```

This starts both the client (Vite, port 5173) and server (tsx, port 3001) with hot reload.

### Production Build

```bash
pnpm build
pnpm --filter @texas-holdem/server start
```

### Docker

```bash
docker compose up --build
```

The app will be available at `http://localhost:3001`.

## Deployment (Railway)

```bash
# Login to Railway
railway login

# Link to project
railway link

# Deploy
railway up

# Add persistent volume for SQLite
railway volume add -m /app/packages/server/data

# Set environment variables in Railway dashboard:
# LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET, ANTHROPIC_API_KEY
```

## Game Rules

Standard No-Limit Texas Hold'em:
- Each player gets 2 hole cards
- 5 community cards dealt in stages (Flop / Turn / River)
- Best 5-card hand wins
- Actions: Fold, Check, Call, Raise, All-In
- Side pots supported for all-in scenarios

## AI Personalities

| AI | Style | Description |
|----|-------|-------------|
| 🦈 Shark | Tight-Aggressive | Calculates odds, only plays strong hands |
| 🐕 Maniac | Loose-Aggressive | Unpredictable, frequent raises and bluffs |
| 🪨 Rock | Tight-Passive | Ultra-conservative, only premium hands |
| 🦊 Fox | Balanced | Adapts strategy, reads opponents |

---

<a id="中文"></a>

## 中文

# ALL IN — 德州扑克

全栈实时多人德州扑克游戏，支持 AI 对手和语音聊天。

> **在线体验**: [texas-holdem-production-c30c.up.railway.app](https://texas-holdem-production-c30c.up.railway.app)

## 功能特性

- **实时多人对战** — 基于 WebSocket，每房间支持 2–8 名玩家
- **AI 对手** — 4 种性格（鲨鱼哥、疯狗、石头、老狐狸），Claude API + 规则引擎双模式
- **语音聊天** — LiveKit 集成，支持麦克风/扬声器独立控制，说话时头像绿色光环提示
- **移动端优化** — PWA 支持、强制横屏、触控适配、微信 WebView 兼容
- **账号持久化** — SQLite 用户系统，筹码余额实时同步
- **音效系统** — 发牌、下注、翻牌、回合提示等音效
- **筹码动画** — 下注推入、底池收集、赢家高光动效

## 技术栈

| 层级 | 技术 |
|------|------|
| **前端** | React 19 · TypeScript · Tailwind CSS 4 · Zustand · Vite |
| **后端** | Hono.js · WebSocket (ws) · tsx |
| **数据库** | SQLite (better-sqlite3) · WAL 模式 |
| **认证** | JWT · bcryptjs |
| **AI** | Claude API (Haiku) · poker-evaluator · 蒙特卡洛权益计算 |
| **语音** | LiveKit（客户端 + 服务端 SDK）|
| **部署** | Docker · Railway |

## 快速开始

### 前置要求

- Node.js 20+
- pnpm 10+

### 安装

```bash
git clone https://github.com/lhz960904/texas-holdem.git
cd texas-holdem
pnpm install
```

### 环境变量

创建 `packages/server/.env`：

```env
# 可选 — 语音聊天（LiveKit Cloud）
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=your-api-key
LIVEKIT_API_SECRET=your-api-secret

# 可选 — AI 决策（Claude API）
ANTHROPIC_API_KEY=your-anthropic-key
```

> 不配置 LiveKit 变量时语音功能静默禁用。不配置 Anthropic Key 时 AI 使用规则引擎。

### 开发

```bash
pnpm dev
```

同时启动客户端（Vite，端口 5173）和服务端（tsx，端口 3001），支持热更新。

### 生产构建

```bash
pnpm build
pnpm --filter @texas-holdem/server start
```

### Docker

```bash
docker compose up --build
```

访问 `http://localhost:3001`。

## 部署（Railway）

```bash
railway login
railway link
railway up
railway volume add -m /app/packages/server/data

# 在 Railway 控制台设置环境变量：
# LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET, ANTHROPIC_API_KEY
```

## 游戏规则

标准无限注德州扑克：
- 每位玩家获得 2 张底牌
- 5 张公共牌分三轮发出（翻牌 / 转牌 / 河牌）
- 最佳 5 张牌组合获胜
- 操作：弃牌、过牌、跟注、加注、全押
- 支持全押边池计算

## AI 性格

| AI | 风格 | 描述 |
|----|------|------|
| 🦈 鲨鱼哥 | 紧凶型 | 冷静计算，只在有优势时出手 |
| 🐕 疯狗 | 松凶型 | 疯狂激进，让对手无法读牌 |
| 🪨 石头 | 紧弱型 | 极度保守，只玩顶级好牌 |
| 🦊 老狐狸 | 平衡型 | 善于读人和变速 |

---

## One-Click Build with Claude Code

Use this single command to scaffold the entire project from scratch:

```bash
claude --dangerously-skip-permissions -p "Build a full-stack multiplayer Texas Hold'em poker web game called 'ALL IN' as a pnpm monorepo with 3 packages: shared (types + WebSocket protocol), client (React 19 + Vite + Tailwind CSS 4 + Zustand), server (Hono.js + ws + better-sqlite3 + tsx). Key requirements: 1) SHARED: Define Card/Suit/Rank types, PlayerInfo with isAI flag, RoomState, GameState, RoomConfig (blinds/maxPlayers/turnTime no buyIn), typed ClientEvents (join-room/player-ready/start-game/action/leave-room/show-cards/add-ai/remove-ai/list-ai-personalities) and ServerEvents (room-state/player-joined/player-left/game-start/deal-cards/phase-change/turn/player-action/showdown/settle/cards-revealed/error/ai-personalities). 2) SERVER: JWT auth (7-day expiry) with auto-register login endpoint, SQLite users table (id/username/password_hash/nickname/avatar/chips_balance DEFAULT 50000/games_played/games_won) in WAL mode, room manager with 6-char room codes, full game engine (preflop→flop→turn→river→showdown→settle, dealer rotation, small/big blinds, side pots), hand evaluation using poker-evaluator library, AI system with 4 personalities (shark tight-aggressive/maniac loose-aggressive/rock tight-passive/fox balanced) each with Claude Haiku API decision + rule-based fallback using Monte Carlo equity (1000 sims), AI auto-acts on its turn with 0.5-2s delay, WebSocket handler with JWT auth from URL query param, chips synced to DB after each hand settle, kick broke players (chips<=0), LiveKit voice token endpoint reading LIVEKIT_URL/LIVEKIT_API_KEY/LIVEKIT_API_SECRET env vars (graceful skip if not set), serve client dist as static in production. 3) CLIENT: Login screen (avatar picker + username + password, dark gold theme), Lobby (user card with balance/stats, create room, join by code), WaitingRoom (seat grid, host can add/remove AI with personality picker, copy room code/link, ready button, pre-request mic permission here), PokerTable (oval green felt table with gold inner border, opponent seats positioned by count 1-7, community cards with flip animation, pot display with winner banner, chip pile animations with push-in/collect, bottom HUD with avatar+timer ring+hole cards+chips+action buttons, raise popover with custom touch slider that handles CSS rotation for WeChat WebView, voice controls top-right with separate speaker/mic toggle buttons, menu sidebar with room info/player list/leave, fullscreen only on mobile, forced landscape via CSS rotation for portrait mobile, sound effects for deal/flip/chips/check/fold/win/turn-alert). 4) PERFORMANCE: Code split — lazy load WaitingRoom and PokerTable, manualChunks for react and livekit-client, inline loading skeleton in index.html with spinner, async Google Fonts loading, service worker caching hashed assets and sounds. 5) PWA: manifest.json with display fullscreen, service worker. 6) DEPLOY: Dockerfile (node:20-slim, pnpm, build shared+client, run server via tsx), docker-compose.yml with volume for SQLite. Use TypeScript ESM throughout, Tailwind utility classes, Zustand for all client state with localStorage persistence for token/room/session."
```

## License

MIT
