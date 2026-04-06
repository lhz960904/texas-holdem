
# 我用了 1 天 的时间 vibe coding 了一个多人德州扑克游戏

> 这是我第一次全程没有修改 AI 代码的 vibe coding 体验，整体下来除了交互和边界 case 需要反复与 AI 确认，功能层面 AI 完全可以顺利搞定，甚至出乎我的意料。

## 背景

业余时间会跟异地朋友视频聊天，吐槽吐槽生活，偶尔会通过视频的方式娱乐下比如德州扑克，之前用过其他软件但功能繁琐，又需要做任务获取金币。所以一直想自己做一个在线的德州扑克游戏，由于开发工作量比较大，一直搁置。(之前也尝试通过 AI 去实现，但整体效果一般就放弃了)。这周末心血来潮，想到 Harness Engineering 理念这么火，决定用 Claude Code 尝试一下。

**先看成果：**

![游戏桌效果](docs/screenshots/game-table.png)

在线体验：[texas-holdem-production-c30c.up.railway.app](https://texas-holdem-production-c30c.up.railway.app) ｜ 开源仓库：[GitHub](https://github.com/lhz960904/texas-holdem)


## 过程中用到的工具

### Claude Code CLI

本项目全程使用 Claude Code CLI 完成，模型为 **Opus 4.6（1M context）**。使用最强模型可以提高整体的代码质量，节省很多给反馈给 AI 的沟通时间。

### Superpowers Skills

[Superpowers](https://github.com/nicobailon/superpowers-skills) 是一套 Claude Code 的 Skills 插件。它的价值在于**让 AI 在动手之前先思考**。尤其是 brainstorming，当我说实现一个德州扑克的游戏时，它会进入脑暴模式多次跟我对齐最终方案，过程中会提到很多我未曾考虑到的方面。并且每次 Feature 开发都会提前调研相关技术方案，并且给出相应的 trade-off。 这种"**先探索再执行**"的范式，避免了 AI 闷头写出一堆需要推翻的代码。

### Playwright MCP / Browser Use

传统开发流程是：写代码 → 手动打开浏览器 → 看效果 → 截图反馈给 AI。有了 [Playwright MCP](https://github.com/anthropics/claude-code-playwright)，Claude 可以**自己操控浏览器**：打开页面、 创建房间、进入房间、开始游戏、截图验证。

最典型的例子——项目整个 README 的效果截图全是 Claude 自己截图并保存的。

这种"**AI 自主验收**"的能力大幅减少了沟通往返。

### Context7 MCP

LLM 的训练数据有截止日期。当你用 Tailwind CSS v4（和 v3 配置方式完全不同）、LiveKit 最新 SDK、Hono.js 等较新的库时，AI 很容易写出过时的 API。

[Context7 MCP](https://github.com/upstash/context7) 解决这个问题：它能**实时拉取 npm 包的最新文档**，让 Claude 基于当前版本生成代码。比如 Tailwind v4 不再需要 `tailwind.config.js`，直接在 CSS 里用 `@theme` 指令。又或者是 railway 的最新版本部署方式，通过 railway CLI 就帮我完成了部署。我记着前段时间还需要我手动创建 services，配合它才可以完成。

---

## Vibe coding 过程记录

### 第一阶段：核心骨架

**一句话起手：**

```
帮我创建一个移动端德州扑克项目
```

Claude 使用 Superpowers 完成了 spec、plan 的编写，我确认后一口气生成了：
- 完整的 monorepo 结构 + tsconfig
- 共享类型（Card、PlayerInfo、RoomState、GameState）
- WebSocket 协议定义（15+ 事件类型，全类型安全）
- 基础的房间管理 + 游戏引擎

这里有个返工的情况，一开始 Claude 提供我前端渲染方案有 dom + css，pixiJS 等方案，我考虑性能问题没有听从它的建议让它采用 pixiJS。但随后问题出现，由于渲染是 Canvas, 导致 Claude 并不能很有效的进行自我测试，我对该技术栈也不熟悉，导致实现效果一般，后又让它基于 dom + css 帮我重新实现。

**反思：** 在确定技术方案的时候，最好采用自己熟悉的方式，这样在后续的开发中能更有效的进行沟通，适当时也可以看懂代码细节。尤其是 MVP 版本，需要快速迭代，而不是从一开始就想着炫技。

### 第二阶段：游戏引擎 + UI

这是工作量最大的阶段。德州扑克的规则看似简单，实际逻辑极其复杂：

- 发牌顺序、盲注轮转、多轮下注
- Side pot 计算（多人 All-In 时的边池）
- 手牌评估（顺子、同花、葫芦……）

**我的想法是不要从零实现，降低技术难度，提高 AI 开发效率。** 手牌评估直接用 `poker-evaluator` 库（让 Claude 调研后推荐的）。

UI 交互方面，我根据我的想法，频繁让 AI 改动，但整体下来 AI 实现的还是无法复刻我的想法。索性我放弃了。因为这离 MVP 版本越来越远。后来我使用 [stitch](https://stitch.withgoogle.com/projects/604732133392733805) 进行了尝试，其中桌面效果和主题色都相当不错，我就将 html 代码复制交给了 AI 来复刻。再融合我的想法，最终看着还不错


### 第三阶段：用户系统 + AI 对手

在上一阶段，所有数据都在内存，用户数据也通过 localStorage 进行存储。这种方式显然做不到真正的多人联机，和金钱持久化。所以我让 AI 帮我实现了用户系统，并增加了 AI 对手系统，这样方便开发中进行多人游戏测试。

最后采取了 AI 推荐的建议：SQLite + JWT + bcrypt。对 AI 来说是常规操作，几乎一遍过。

### 第四阶段：语音聊天 + 移动端适配

随后我开始增加必不可少的语音功能，毕竟有语音才能跟朋友侃侃而谈，耍耍小心机。


移动端适配是踩坑最多的地方。**微信 WebView** 里的 CSS rotation 会导致触摸坐标系错乱——手指往右滑，滑块往左跑。Claude 分析出根本原因后，写了一个 `RotationAwareSlider` 组件，在检测到 CSS 旋转时把 `clientY` 映射到视觉横轴。

```typescript
if (isRotated()) {
  // CSS 旋转 90° 后，视觉水平方向对应原始垂直坐标
  ratio = (clientY - rect.top) / rect.height
} else {
  ratio = (clientX - rect.left) / rect.width
}
```

这种平台特定的 hack，AI 的调试能力其实很强——它能系统性地分析坐标变换，而不是像人一样瞎猜。

### 第五阶段：性能优化 + 部署

随后我让 AI 帮忙进行了部署，拿到线上链接交给朋友一起体验，朋友第一次加载以为是访问不了，后来发现只是白屏时间过长，性能存在问题。所以我让 AI 帮忙分析了性能问题，并给出了优化方案。

```
我：现在访问会白屏很久，有什么优化空间？先不用改代码
Claude：[分析] 1. JS 包 728KB，livekit-client 占大头 2. Railway 冷启动 3. 单入口无分割
建议：代码分割 + loading 骨架屏，改动小效果明显
我：做吧
```

优化后首屏 JS 从 728KB 降到 200KB（-68%），白屏变成了即时 loading 动画。

部署到 Railway 也是 Claude 一手操办——写 Dockerfile、配 volume、`railway up`。

---

## 吸取的一些经验

1. 在这个过程中不是完全放手不管，而是要适当参与，适当给 AI 提供反馈。要在这个过程中不断思考和学习，有时候 AI 可能会一直错下去，这时可以直接终止，让它先去调研最佳实践，然后再反过来优化本项目。

2. 过程中一些 AI 可能会提到一些新技术 和 新名词，这时候可以通过 Claude 的 /btw 命令来进行询问和学习，对话不会记录到整个上下文中，避免干扰。


3. 不要带领 AI 钻进牛角尖，一些边界 case，交互可以等 MVP 版本完成后，再进行单独优化。一上来就追求完美，优化细节很容易使整体流程跑偏。


4. 控制好上下文大小，上下文过大时模型会变得不稳定，当你完成一个较大的Feature时，可以通过 /compact 命令来压缩上下文后，再去实现下一个Feature


## One More Thing

整个项目已开源，你也可以用一条 Claude Code 命令从零复刻：

```bash
claude --dangerously-skip-permissions -p "Build a full-stack multiplayer Texas Hold'em poker web game called 'ALL IN'..."
```

完整 prompt 见 [README](https://github.com/lhz960904/texas-holdem)。

**如果这篇文章对你有帮助，欢迎 Star 仓库 ⭐️**

---

*本文项目地址：[github.com/lhz960904/texas-holdem](https://github.com/lhz960904/texas-holdem)*

*在线体验：[texas-holdem-production-c30c.up.railway.app](https://texas-holdem-production-c30c.up.railway.app)*
