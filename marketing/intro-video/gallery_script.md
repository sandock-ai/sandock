# Sandock Gallery 建议 / Sandock Gallery Suggestions

**版本**: v4.1 - 最终版  
**基于**: storyboard-v3-final.md  
**目标平台**: Product Hunt, App Store, GitHub, Chrome Web Store  
**核心卖点**: 100% POSIX Compatible Volume + 支持 Claude Code + 多场景支持

---

## 平台规格 (Platform Specifications)

| 平台 | 推荐尺寸 | 图片数量 | 说明 |
|------|---------|---------|------|
| Product Hunt | 1270x760 | 5-8张 | 16:9 比例最佳 |
| App Store | 1920x1080 | 最多10张 | 16:9 |
| Chrome Web Store | 1280x800 | 最多5张 | 16:10 |
| GitHub README | 1200x630 | 3-5张 | 社交媒体分享优化 |

---

## Slogan（中英文版本）

### 英文版（官网使用）
**"Sandbox in Docker, for AI Agents, with 100% POSIX Compatible Volume"**

### 中文版
**"基于 Docker 的沙箱，专为 AI Agent 设计，配备 100% POSIX 兼容的 Volume"**

### 核心卖点（三行版本）

**核心差异化**：
- **Sandbox in Docker** - 基于 Docker 的安全沙箱
- **For AI Agents** - 专为 AI Agent 设计
- **100% POSIX Compatible Volume** - 完整的网盘级文件系统

**为什么 Volume 是核心卖点**：
- ✅ 完整的 POSIX 文件系统协议，100% 兼容
- ✅ 网盘级的共享文件系统
- ✅ 支持 Claude Code、Codex-CLI、OpenCode（因为有完整文件系统）
- ✅ 持久化存储，跨容器共享

---

## Gallery 图片规划表

基于视频内容设计的 Gallery 图片方案（建议制作 7 张）：

| Slide | 类别 | 视觉画面 | 文案（标题+描述） | 旁白（中文） | 旁白（英文） | 设计意图 |
|-------|------|---------|----------------|------------|------------|---------|
| 1 | 封面 | Sandock Logo + Slogan + Dashboard 截图 | **Sandock**<br>Sandbox in Docker, for AI Agents<br>with 100% POSIX Compatible Volume | Sandock。基于 Docker 的沙箱，专为 AI Agent 设计，配备 100% POSIX 兼容的 Volume。 | Sandock. Sandbox in Docker, for AI Agents, with 100% POSIX Compatible Volume. | 第一眼传递核心价值，强调 Volume 文件系统 |
| 2 | Run Claude Code | Claude Code 运行界面 + 文件系统操作 | **Run Claude Code**<br>Full file system support<br>Also supports Codex-CLI & OpenCode | 运行 Claude Code、Codex-CLI 和 OpenCode。全部由我们完整的文件系统驱动。 | Run Claude Code, Codex-CLI, and OpenCode. All powered by our complete file system. | 展示支持主流 AI 编码工具 |
| 3 | Execute Code | 代码执行界面 + 网络访问示意图 | **Execute Any Code Safely**<br>Isolated runtime environment<br>Connected network for databases & APIs | 安全执行任何代码。运行环境隔离，网络可访问数据库和远程服务。 | Execute any code safely. Isolated runtime environment with network access for databases and remote services. | 展示安全执行能力 |
| 4 | Run MCP Server | MCP Server 运行界面 + 连接示意图 | **Run MCP Servers**<br>Seamlessly connect to AI ecosystem<br>Enable AI-powered integrations | 运行 MCP Server。无缝连接 AI 生态系统。 | Run MCP Servers. Seamlessly connect to the AI ecosystem. | 展示 AI 生态集成能力 |
| 5 | Volume 文件系统 | Volume 图标 + POSIX 兼容标识 + 特性列表 | **100% POSIX Compatible Volume**<br>Complete network-drive-level file system<br>Persistent & reliable storage | 为什么我们能支持这些？因为我们有完整的网盘级文件系统。100% POSIX 兼容。 | Why can we support all these? Because we have a complete, network-drive-level file system. 100% POSIX compatible. | 强调核心技术优势和差异化 |
| 6 | 代码演示 | 3 行代码截图 + 终端输出 | **Easy Integration**<br>Create volume → Mount to sandbox → Execute<br>Just 3 lines of code | 只需 3 行代码。创建 Volume、挂载到沙箱、执行。 | Just 3 lines of code. Create volume, mount to sandbox, and execute. | 展示易用性 |
| 7 | 多场景支持 | 4 个场景卡片 | **Built for Multiple Scenarios**<br>Code Agent · Code Interpreter<br>MCP Host · Backup Jobs | 为多种场景而生。Code Agent、代码解释器、MCP 主机、备份任务。全部支持。 | Built for multiple scenarios. Code Agent, Code Interpreter, MCP Host, and Backup Jobs. All supported. | 展示应用场景广泛 |
| 8 | Ending 结尾 | Sandock Logo + URL + Get Started 按钮 | **Get Started Today**<br>sandock.ai<br>Secure sandbox for AI agents | 立即访问 sandock.ai 开始使用。 | Visit sandock.ai to get started today. | 行动号召，引导用户访问 |

---

## 详细设计指南

### Slide 1: 封面

**视觉画面**:
- 背景：深色渐变（深蓝到黑色）
- 顶部：Sandock Logo（大且居中）
- 中部：Slogan "Sandbox in Docker, for AI Agents, with 100% POSIX Compatible Volume"
- 下部：Dashboard 截图

**设计图构成**:
```
┌─────────────────────────────────────┐
│                                     │
│        [Sandock Logo - 大]          │
│                                     │
│   Sandbox in Docker, for AI Agents  │
│   with 100% POSIX Compatible Volume │
│                                     │
│  ┌───────────────────────────────┐  │
│  │                               │  │
│  │   Dashboard 截图              │  │
│  │   - Sandbox 列表              │  │
│  │   - Volume 管理               │  │
│  │   - 运行状态                  │  │
│  │                               │  │
│  └───────────────────────────────┘  │
│                                     │
└─────────────────────────────────────┘
```

**文案**: Sandock / Sandbox in Docker, for AI Agents, with 100% POSIX Compatible Volume

**设计要点**: Logo 清晰突出，Slogan 强调 Volume，Dashboard 展示核心功能

---

### Slide 2: Run Claude Code

**视觉画面**: Claude Code 运行界面 + 文件系统操作

**设计图构成**:
```
┌─────────────────────────────────────┐
│      Run Claude Code                │
│                                     │
│  ┌───────────────────────────────┐  │
│  │                               │  │
│  │   Claude Code 界面截图        │  │
│  │   - 文件系统操作              │  │
│  │   - 代码执行                  │  │
│  │   - 结果输出                  │  │
│  │                               │  │
│  └───────────────────────────────┘  │
│                                     │
│  Full file system support           │
│  Also supports:                     │
│  • Codex-CLI                        │
│  • OpenCode                         │
│                                     │
│  Powered by complete POSIX volume   │
└─────────────────────────────────────┘
```

**文案**: Run Claude Code / Full file system support / Also supports Codex-CLI & OpenCode

**设计要点**: 展示实际使用场景，高亮文件系统操作，列出支持的工具

---

### Slide 3: Execute Code

**视觉画面**: 代码执行 + 网络访问示意图

**设计图构成**:
```
┌─────────────────────────────────────┐
│    Execute Any Code Safely          │
│                                     │
│  ┌─────────────┐  ┌──────────────┐ │
│  │             │  │              │ │
│  │  代码编辑器  │  │  网络访问    │ │
│  │  截图       │  │  示意图      │ │
│  │             │  │  (数据库/API)│ │
│  │             │  │              │ │
│  └─────────────┘  └──────────────┘ │
│                                     │
│  ✓ Isolated runtime environment     │
│  ✓ Network access for databases     │
│  ✓ Secure by design                 │
│                                     │
│  Run Python, Node.js, Go, and more  │
└─────────────────────────────────────┘
```

**文案**: Execute Any Code Safely / Isolated runtime, Connected network

**设计要点**: 强调"隔离 + 网络可访问"，用图标展示网络连接

---

### Slide 4: Run MCP Server

**视觉画面**: MCP Server 运行界面 + 连接示意图

**设计图构成**:
```
┌─────────────────────────────────────┐
│      Run MCP Servers                │
│                                     │
│         ┌─────────┐                 │
│         │   MCP   │                 │
│         │  Server │                 │
│         └────┬────┘                 │
│              │                      │
│      ┌───────┼───────┐              │
│      │       │       │              │
│   ┌──▼──┐ ┌─▼──┐ ┌─▼──┐            │
│   │Claude│ │AI  │ │... │            │
│   │     │ │Tool│ │    │            │
│   └─────┘ └────┘ └────┘            │
│                                     │
│  Connect to AI ecosystem            │
│  Seamless integration               │
└─────────────────────────────────────┘
```

**文案**: Run MCP Servers / Connect to AI ecosystem

**设计要点**: 展示 MCP Server 的实际运行，用连接线展示集成关系

---

### Slide 5: Volume 文件系统（核心差异化）

**视觉画面**: Volume 图标 + 特性列表

**设计图构成**:
```
┌─────────────────────────────────────┐
│   Why Sandock is Different          │
│                                     │
│      ┌─────────────────┐            │
│      │   [Volume 图标]  │            │
│      │                 │            │
│      │  100% POSIX     │            │
│      │  Compatible     │            │
│      └─────────────────┘            │
│                                     │
│  ✓ Complete network-drive-level    │
│  ✓ Full POSIX file system protocol │
│  ✓ Persistent & reliable storage   │
│  ✓ Shared across containers        │
│                                     │
│  Complete file system support       │
│  enables Claude Code, Codex-CLI,    │
│  OpenCode, and more                 │
└─────────────────────────────────────┘
```

**文案**: 100% POSIX Compatible Volume / Complete file system / Network-drive level

**设计要点**: 核心差异化 Slide，强调"100% POSIX Compatible"和完整的文件系统能力

---

### Slide 6: 代码演示

**视觉画面**: 3 段代码 + 终端输出

**设计图构成**:
```
┌─────────────────────────────────────┐
│    Just 3 Lines of Code             │
│                                     │
│  ┌───────────────────────────────┐  │
│  │ // 1. Create or get volume    │  │
│  │ const volume = await client   │  │
│  │   .volume.getByName('data')   │  │
│  │                               │  │
│  │ // 2. Create sandbox & mount  │  │
│  │ const sandbox = await client  │  │
│  │   .sandbox.create({           │  │
│  │     volumes: [...]            │  │
│  │   })                          │  │
│  │                               │  │
│  │ // 3. Execute code            │  │
│  │ await client.sandbox.shell(   │  │
│  │   sandbox.id, { cmd: '...' }  │  │
│  │ )                             │  │
│  └───────────────────────────────┘  │
│                                     │
│  Create + Mount + Execute           │
│  Simple & Powerful                  │
└─────────────────────────────────────┘
```

**文案**: Just 3 Lines of Code / Create + Mount + Execute

**设计要点**: 代码清晰，高亮关键部分，显示成功输出

---

### Slide 7: 多场景支持

**视觉画面**: 4 个卡片（2x2 网格）

**设计图构成**:
```
┌─────────────────────────────────────┐
│  Built for Multiple Scenarios       │
│                                     │
│  ┌─────────────┐  ┌──────────────┐ │
│  │ 🤖          │  │ 💻           │ │
│  │ Code Agent  │  │ Code         │ │
│  │             │  │ Interpreter  │ │
│  │ AI-powered  │  │ Execute user │ │
│  │ coding      │  │ code safely  │ │
│  └─────────────┘  └──────────────┘ │
│                                     │
│  ┌─────────────┐  ┌──────────────┐ │
│  │ 🔌          │  │ 💾           │ │
│  │ MCP Host    │  │ Backup Jobs  │ │
│  │             │  │              │ │
│  │ Run MCP     │  │ Scheduled    │ │
│  │ servers     │  │ tasks        │ │
│  └─────────────┘  └──────────────┘ │
└─────────────────────────────────────┘
```

**文案**: Built for Multiple Scenarios / Code Agent · Code Interpreter / MCP Host · Backup Jobs

**设计要点**: Code Agent 放第一位，使用一致的卡片样式

---

### Slide 8: Ending 结尾

**视觉画面**: Sandock Logo + URL + Get Started 按钮

**设计图构成**:
```
┌─────────────────────────────────────┐
│                                     │
│                                     │
│        [Sandock Logo - 大]          │
│                                     │
│      Get started today              │
│                                     │
│         sandock.ai                  │
│      (大字体，醒目)                  │
│                                     │
│   ┌─────────────────────────┐      │
│   │    Get Started  →       │      │
│   └─────────────────────────┘      │
│                                     │
│                                     │
└─────────────────────────────────────┘
```

**文案**: Get started today / sandock.ai

**设计要点**: 简洁专业，Logo 突出，URL 醒目，行动号召明确

---

## 设计建议 (Design Tips)

### 配色方案
- **主色调**: 深色主题（专业感）
  - 背景: #0a0a0a, #1a1a1a
  - 文字: #ffffff, #e0e0e0
  - 强调色: 品牌色（蓝色、绿色、紫色）
- **辅助色**:
  - 成功/解决方案: 绿色 (#10b981, #22c55e)
  - 问题/警告: 红色/橙色 (#ef4444, #f97316)
  - 代码高亮: VS Code GitHub Dark 主题色

### 字体选择
- **标题**: Inter, SF Pro Display, Roboto（粗体，48-60px）
- **正文**: Inter, SF Pro Text, Roboto（常规，18-24px）
- **代码**: Fira Code, JetBrains Mono, Consolas（14-16px）

### 代码截图
- 使用 VS Code 的 GitHub Dark 主题
- 字体大小：14-16px（确保清晰可读）
- 代码要格式化良好，有适当的缩进
- 关键部分用注释或高亮标注

### 图标资源
- **推荐图标库**:
  - Heroicons (https://heroicons.com/)
  - Lucide (https://lucide.dev/)
  - Feather Icons (https://feathericons.com/)
- **常用图标**:
  - 安全：锁、盾牌
  - 速度：闪电、火箭
  - 代码：代码块、终端
  - 容器：Docker 图标、盒子

### 布局原则
- **留白**: 保持足够的留白，不要拥挤
- **对齐**: 所有元素要对齐（左对齐或居中）
- **层次**: 使用大小、颜色、粗细建立视觉层次
- **一致性**: 所有 Slide 保持一致的风格

---

## 制作工具推荐 (Recommended Tools)

### 设计工具
- **Figma**（推荐）：专业设计工具，支持协作
- **Canva**：快速制作，有大量模板
- **Sketch**（macOS）：专业设计工具
- **Adobe Illustrator**：矢量图形设计

### 代码截图工具
- **Carbon** (https://carbon.now.sh/)：美化代码截图
- **Ray.so** (https://ray.so/)：现代代码截图
- **Snappify** (https://snappify.com/)：代码截图 + 注释

### 图标资源
- **Heroicons** (https://heroicons.com/)：免费 SVG 图标
- **Lucide** (https://lucide.dev/)：开源图标库
- **Iconify** (https://iconify.design/)：统一图标框架

---

## 使用场景 (Use Cases)

Gallery 图片完成后可用于：
- ✅ Product Hunt 发布（主要用途）
- ✅ App Store / Chrome Web Store 产品页面
- ✅ GitHub README（展示产品功能）
- ✅ 官网 Features 页面
- ✅ 社交媒体推广（Twitter、LinkedIn）
- ✅ 销售演示 PPT
- ✅ 邮件营销素材

---

## 质量检查清单 (Quality Checklist)

设计完成后，确保：
- [ ] 所有文字清晰可读（在小屏幕上也能看清）
- [ ] 代码截图清晰，字体大小合适
- [ ] 配色一致，符合品牌形象
- [ ] 每张图片传递一个核心信息
- [ ] 图标和装饰元素不过度
- [ ] 文案简洁有力，无错别字
- [ ] 所有图片尺寸符合平台要求
- [ ] 导出格式正确（PNG 或 JPG，高质量）
- [ ] Slide 6（Volume 文件系统）突出差异化
- [ ] Slide 8（多场景）Code Agent 排第一位

---

## 导出设置 (Export Settings)

### Product Hunt
- **尺寸**: 1270x760 (16:9)
- **格式**: PNG 或 JPG
- **质量**: 高质量（90-100%）
- **文件大小**: < 5MB

### App Store / Chrome Web Store
- **尺寸**: 1920x1080 (16:9)
- **格式**: PNG（推荐）或 JPG
- **质量**: 高质量（90-100%）
- **文件大小**: < 10MB

### GitHub README
- **尺寸**: 1200x630（社交媒体优化）
- **格式**: PNG
- **质量**: 高质量
- **文件大小**: < 3MB

---

## 常见问题 (FAQ)

**Q: 需要设计所有 8 张图片吗？**
A: 建议至少制作 5-6 张（封面、核心卖点、Run Claude Code、Volume 文件系统、代码演示、多场景）。

**Q: 没有设计经验怎么办？**
A: 使用 Canva 的模板，或者使用 Carbon/Ray.so 生成代码截图，然后在 Figma 中简单排版。

**Q: 代码截图太小看不清怎么办？**
A: 增大字体（16-18px），只展示关键代码片段，不要截取整个屏幕。

**Q: 可以用真实的产品截图吗？**
A: 可以！如果 Sandock 有实际的 Dashboard 或 UI，使用真实截图更好。

**Q: 哪张 Slide 最重要？**
A: Slide 6（Volume 文件系统）最重要，这是 Sandock 的核心差异化优势。

---

## 核心信息传达检查清单

确保 Gallery 传达了以下核心信息：

- ✅ **产品定位**: Sandbox in Docker, for AI Agents, with 100% POSIX Compatible Volume
- ✅ **核心卖点**: 100% POSIX Compatible Volume 文件系统（最重要的差异化）
- ✅ **支持 Claude Code**: 因为有完整的 POSIX 文件系统
- ✅ **安全执行**: 运行环境隔离，网络可访问
- ✅ **MCP 支持**: 运行 MCP Server，连接 AI 生态
- ✅ **差异化**: 完整的网盘级文件系统，100% POSIX 兼容
- ✅ **简单易用**: 3 行代码即可开始
- ✅ **多场景**: Code Agent（第一位）, Code Interpreter, MCP Host, Backup Jobs
- ✅ **行动号召**: 访问 sandock.ai 开始使用

---

**文档版本**: v4.1 (Final)
**创建日期**: 2026-01-29
**目标平台**: Product Hunt, App Store, GitHub
**建议图片数量**: 8 张（含 Ending 页）
**核心特点**: 突出 Volume 文件系统差异化 + 支持 Claude Code + 多场景支持

---

## 🎙️ HeyGen 演讲稿 (HeyGen Speech Text) - PPT Demo 风格

**风格说明**: PPT Demo 风格
- ✅ 第一句直接 Introducing（无 Hook）
- ✅ 按 Gallery 图片顺序，每张图一段
- ✅ 适合 Product Hunt 演示、投资人展示
- ✅ 共 8 张 Slide（删除了核心卖点页，添加了 Ending 页）

### 版本 1: 按 Slide 分段（推荐用于 PPT 演示）

每段对应一张 Gallery 图片，便于同步展示：

**Slide 1 - 封面**:
```
Introducing Sandock. Sandbox in Docker, for AI Agents, with 100% POSIX Compatible Volume.
```

**Slide 2 - Run Claude Code**:
```
Run Claude Code, Codex-CLI, and OpenCode. All powered by our complete file system.
```

**Slide 3 - Execute Code**:
```
Execute any code safely. Isolated runtime environment with network access for databases and remote services.
```

**Slide 4 - Run MCP Server**:
```
Run MCP Servers. Seamlessly connect to the AI ecosystem.
```

**Slide 5 - Volume 文件系统**:
```
Why can we support all these? Because we have a complete, network-drive-level file system. 100% POSIX compatible.
```

**Slide 6 - 代码演示**:
```
Easy integration. Just 3 lines of code. Create volume, mount to sandbox, and execute.
```

**Slide 7 - 多场景支持**:
```
Built for multiple scenarios. Code Agent, Code Interpreter, MCP Host, and Backup Jobs. All supported.
```

**Slide 8 - Ending 结尾**:
```
Visit sandock.ai to get started today.
```

---

### 版本 2: 完整连贯（推荐用于 HeyGen 生成）

请直接复制以下内容到 HeyGen 的文本输入框中生成语音：

```
Introducing Sandock. Sandbox in Docker, for AI Agents, with 100% POSIX Compatible Volume.

Run Claude Code, Codex-CLI, and OpenCode. All powered by our complete file system.

Execute any code safely. Isolated runtime environment with network access for databases and remote services.

Run MCP Servers. Seamlessly connect to the AI ecosystem.

Why can we support all these? Because we have a complete, network-drive-level file system. 100% POSIX compatible.

Easy integration. Just 3 lines of code. Create volume, mount to sandbox, and execute.

Built for multiple scenarios. Code Agent, Code Interpreter, MCP Host, and Backup Jobs. All supported.

Visit sandock.ai to get started today.
```

---

### 使用建议

**版本 1（按 Slide 分段）**适合：
- Product Hunt 演示视频
- 投资人 Pitch Deck
- 需要精确控制每张图片展示时长的场景

**版本 2（完整连贯）**适合：
- HeyGen 生成 AI 口播
- 自动播放的 Gallery 视频
- 需要流畅叙事的场景

---
