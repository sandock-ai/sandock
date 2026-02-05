# Sandock 产品介绍视频脚本 / Sandock Introduction Video Script

## 基本信息 (Meta Information)
- **版本 (Version)**: v4.1 - 最终版
- **时长 (Duration)**: 98秒
- **目标受众 (Target Audience)**: AI Agent 开发者、SaaS 平台开发者、开发工具创建者
- **核心信息 (Core Message)**: 为 AI Agent 提供安全的 Docker 沙箱，配备 100% POSIX 兼容的 Volume 文件系统
- **视频目标 (Video Goal)**: 促进免费试用和文档查阅
- **核心卖点**: 
  - Sandbox in Docker
  - For AI Agents
  - 100% POSIX Compatible Volume

## Slogan（中英文版本）

### 英文版（官网使用）
**"Secure Docker Sandboxes for AI Agents & Developers"**

### 中文版
**"为 AI Agent 和开发者提供安全的 Docker 沙箱"**

## 技术规格 (Technical Specifications)
- **分辨率 (Resolution)**: 1920x1080
- **帧率 (Frame Rate)**: 30fps
- **录制工具 (Recording Tool)**: Screen Studio（推荐）或 QuickTime + 后期处理
- **演示账号 (Demo Account)**: 使用干净的测试账号，预先准备好 API Key
- **代码编辑器**: VS Code（推荐使用 GitHub Dark 主题，字体大小 18-20px）
- **制作方式**: 产品截图 + 录屏 + 设计图 + 文字叠加

---

## 分镜表格 (Storyboard)

整个视频的快速视觉参考：

| 场景 | 时间 | 时长 | 画面/镜头 | 文字叠加（中文）| 文字叠加（英文） | 动作 | 旁白 |
|------|------|------|-----------|----------------|----------------|------|------|
| 1. 产品介绍 | 0:00-0:12 | 12秒 | 产品截图: Sandock Logo + Slogan + Dashboard | "Sandock<br>基于 Docker 的沙箱<br>专为 AI Agent 设计<br>100% POSIX 兼容 Volume" | "Sandock<br>Secure Docker Sandboxes<br>for AI Agents & Developers" | Logo 展示 → Dashboard 界面 | 可选 |
| 2. Run Claude Code | 0:12-0:24 | 12秒 | 录屏: Claude Code 运行界面 + 文件系统操作 | "运行 Claude Code<br>完整的文件系统支持" | "Run Claude Code, Codex-CLI, OpenCode<br>Full file system support" | 文件操作 → 代码执行 | 可选 |
| 3. Run Code | 0:24-0:36 | 12秒 | 录屏: 代码执行 + 终端输出 + 文件读写 | "安全执行任何代码<br>运行环境隔离，网络互通" | "Execute any code safely<br>Isolated runtime, connected network" | 代码执行 → 网络访问 | 可选 |
| 4. Run MCP Server | 0:36-0:48 | 12秒 | 录屏: MCP Server 运行 + 连接 Claude | "运行 MCP Server<br>连接 AI 生态系统" | "Run MCP Servers<br>Connect to AI ecosystem" | MCP 启动 → 连接展示 | 可选 |
| 5. 为什么 - Volume | 0:48-1:00 | 12秒 | 设计图: Volume 图标 + 特性列表 | "为什么我们能做到？<br>完整的网盘级文件系统<br>100% POSIX 兼容" | "Why can we do this?<br>Complete Volume File System<br>100% POSIX Compatible" | 特性列表展示 | 可选 |
| 6. 怎么用 - 代码 | 1:00-1:16 | 16秒 | 录屏: 代码编辑器 + 3 段代码 + 终端 | "只需 3 行代码<br>创建 + 挂载 + 执行" | "Just 3 lines of code<br>Create + Mount + Execute" | 代码输入 → 执行 | 可选 |
| 7. 全场景支持 | 1:16-1:28 | 12秒 | 设计图: 4 个场景卡片依次出现 | "为多种场景而生<br>Code Agent · 代码解释器<br>MCP 主机 · 备份任务" | "Built for multiple scenarios<br>Code Agent · Code Interpreter<br>MCP Host · Backup Jobs" | 卡片动画展示 | 可选 |
| 8. 收尾 CTA | 1:28-1:38 | 10秒 | 设计图: Logo + URL + Get Started 按钮 | "立即开始<br>sandock.ai" | "Get started today<br>sandock.ai" | 静态展示 + 微动画 | 可选 |

**总计：98秒 / 8个场景**

**注意**：最终视频使用英文版文字叠加和旁白

---

## 详细视觉脚本 (Detailed Visual Script)

每个场景包含【画面描述】和【音频脚本】两部分，便于 NotebookLM 生成 slides/videos。

### 场景1：产品介绍 (0:00-0:12)

#### 🎬 画面描述 (Visual Description)
> **镜头**: 产品截图展示
> **画面元素**: 
> - 顶部：Sandock Logo（大且清晰）
> - 中部：Slogan "Secure Docker Sandboxes for AI Agents & Developers"
> - 下部：产品 Dashboard 截图（显示 Sandbox 列表、Volume 管理、运行状态）
> - 底部：核心卖点（小字）
>   - Sandbox in Docker
>   - For AI Agents
>   - 100% POSIX Compatible Volume
> **氛围**: 专业、现代、技术感
> **色调**: 深色主题，科技蓝/绿色调
> **转场**: 淡入

#### 🎙️ 音频脚本 (Audio Script)
- **🇨🇳 中文版**: Sandock。为 AI Agent 和开发者提供安全的 Docker 沙箱。配备完整的 POSIX 兼容 Volume 文件系统。
- **🇬🇧 英文版 (用于HeyGen)**: Sandock. Secure Docker Sandboxes for AI Agents and Developers. With full POSIX compatible volume file system.
- **音效**: 轻快的科技音效或背景音乐起

---

### 场景2：Run Claude Code (0:12-0:24)

#### 🎬 画面描述 (Visual Description)
> **镜头**: 录屏 - Claude Code 运行界面
> **画面元素**: 
> - Claude Code 或类似工具的界面
> - 文件系统操作（创建文件、读写文件）
> - 代码执行过程
> - 结果输出
> **氛围**: 流畅、实用、强大
> **转场**: 直切

#### 🎙️ 音频脚本 (Audio Script)
- **🇨🇳 中文版**: 运行 Claude Code、Codex-CLI 和 OpenCode。全部由我们完整的文件系统驱动。
- **🇬🇧 英文版 (用于HeyGen)**: Run Claude Code, Codex-CLI, and OpenCode. All powered by our complete file system.

---

### 场景3：Run Code (0:24-0:36)

#### 🎬 画面描述 (Visual Description)
> **镜头**: 录屏 - 代码执行界面
> **画面元素**: 
> - 代码编辑器界面
> - 代码执行（Python/Node.js）
> - 访问远程数据库（展示网络连接）
> - 访问系统文件（展示文件系统）
> - 终端输出
> **氛围**: 安全、隔离、互联
> **转场**: 直切

#### 🎙️ 音频脚本 (Audio Script)
- **🇨🇳 中文版**: 安全执行任何代码。运行环境隔离，网络可访问数据库和远程服务。
- **🇬🇧 英文版 (用于HeyGen)**: Execute any code safely. Isolated runtime environment with network access for databases and remote services.

---

### 场景4：Run MCP Server (0:36-0:48)

#### 🎬 画面描述 (Visual Description)
> **镜头**: 录屏 - MCP Server 运行界面
> **画面元素**: 
> - MCP Server 启动界面
> - 连接到 Claude 或其他 AI 工具
> - 数据交互演示
> - 成功运行的状态
> **氛围**: 连接、生态、集成
> **转场**: 直切

#### 🎙️ 音频脚本 (Audio Script)
- **🇨🇳 中文版**: 运行 MCP Server。无缝连接 AI 生态系统。
- **🇬🇧 英文版 (用于HeyGen)**: Run MCP Servers. Seamlessly connect to the AI ecosystem.

---

### 场景5：为什么 - Volume 文件系统 (0:48-1:00)

#### 🎬 画面描述 (Visual Description)
> **镜头**: 设计图 - Volume 特性展示
> **画面元素**: 
> - 中心：Volume 图标（大）
> - 标题："Why Sandock is Different"
> - 副标题："100% POSIX Compatible Volume File System"
> - 特性列表：
>   - ✓ Complete network-drive-level
>   - ✓ Full file system protocol
>   - ✓ Persistent & reliable
>   - ✓ Shared across containers
> - 对比：Other products: ❌ No volume / Sandock: ✅ Full POSIX volume
> **氛围**: 差异化、技术优势
> **转场**: 淡入

#### 🎙️ 音频脚本 (Audio Script)
- **🇨🇳 中文版**: 为什么我们能支持这些？因为我们有完整的网盘级文件系统。100% POSIX 兼容。
- **🇬🇧 英文版 (用于HeyGen)**: Why can we support all these? Because we have a complete, network-drive-level file system. 100% POSIX compatible.

---

### 场景6：怎么用 - 代码演示 (1:00-1:16)

#### 🎬 画面描述 (Visual Description)
> **镜头**: 录屏 - 代码编辑器
> **画面元素**: 
> - VS Code 编辑器
> - 3 段代码依次展示：
>   1. 创建/获取 Volume
>   2. 创建沙箱并挂载 Volume
>   3. 执行代码并保存数据
> - 终端输出显示成功
> - 代码高亮关键部分
> **氛围**: 简单、易用、高效
> **转场**: 直切

#### 🎙️ 音频脚本 (Audio Script)
- **🇨🇳 中文版**: 只需 3 行代码。创建 Volume、挂载到沙箱、执行。
- **🇬🇧 英文版 (用于HeyGen)**: Just 3 lines of code. Create volume, mount to sandbox, and execute.

#### 📝 代码示例 (Code Example)

**分段展示（16秒）**:

**0:00-0:05 (5秒)**: 创建 Volume
```typescript
// 1. Create or get volume
const volume = await client.volume.getByName('my-data', true)
```

**0:05-0:10 (5秒)**: 创建沙箱并挂载 Volume
```typescript
// 2. Create sandbox and mount volume
const sandbox = await client.sandbox.create({
  image: 'node:20-alpine',
  volumes: [{ volumeId: volume.data.id, mountPath: '/data' }]
})
```

**0:10-0:16 (6秒)**: 执行代码
```typescript
// 3. Execute code with volume access
await client.sandbox.shell(sandbox.data.id, {
  cmd: 'echo "Hello Sandock" > /data/hello.txt && cat /data/hello.txt'
})
```

**录制要点**:
- 代码逐行出现或快速输入
- 高亮关键部分：`getByName()`, `volumes: [...]`, `> /data/hello.txt`
- 字体大（18-20px），清晰可读
- 显示成功消息：`✓ Data persisted to volume`

---

### 场景7：全场景支持 (1:16-1:28)

#### 🎬 画面描述 (Visual Description)
> **镜头**: 设计图 - 场景卡片展示
> **画面元素**: 
> - 标题："Built for Multiple Scenarios"
> - 4 个卡片依次出现（从左到右，从上到下）：
>   1. 🤖 Code Agent
>   2. 💻 Code Interpreter
>   3. 🔌 MCP Host
>   4. 💾 Backup Jobs
> - 每个卡片带图标和简短描述
> **氛围**: 全面、灵活、多场景
> **转场**: 卡片动画（依次出现）

#### 🎙️ 音频脚本 (Audio Script)
- **🇨🇳 中文版**: 为多种场景而生。Code Agent、代码解释器、MCP 主机、备份任务。全部支持。
- **🇬🇧 英文版 (用于HeyGen)**: Built for multiple scenarios. Code Agent, Code Interpreter, MCP Host, and Backup Jobs. All supported.

---

### 场景8：收尾行动 (Closing & CTA) (1:28-1:38)

#### 🎬 画面描述 (Visual Description)
> **镜头**: 设计图 - 结束卡片
> **画面元素**: 
> - Sandock Logo 居中（大）
> - 文字："Get started today"
> - URL："sandock.ai"（大字体，醒目）
> - 可选："Get Started" 按钮
> **氛围**: 简洁、专业、行动导向
> **色调**: 深色背景或品牌色渐变，白色文字
> **转场**: 淡入

#### 🎙️ 音频脚本 (Audio Script)
- **🇨🇳 中文版**: 立即访问 sandock.ai 开始使用。
- **🇬🇧 英文版 (用于HeyGen)**: Visit sandock.ai to get started today.
- **音效**: 背景音乐淡出

---

## 录制检查清单 (Recording Checklist)

### 准备工作
- [ ] 演示账号准备完毕（有效的 API Key）
- [ ] VS Code 设置（GitHub Dark 主题，字体 18-20px）
- [ ] 浏览器设置（无书签栏，无插件图标，分辨率 1920x1080）
- [ ] 关闭所有通知（macOS 勿扰模式，Windows 专注助手）
- [ ] 准备示例代码文件
- [ ] 测试 API 连接（确保能成功创建沙箱和 Volume）
- [ ] 准备产品 Dashboard 截图

### 录制环境
- [ ] 屏幕分辨率设置为 1920x1080
- [ ] 关闭不必要的应用程序
- [ ] 清空浏览器缓存和历史记录
- [ ] 准备干净的终端窗口

### 练习运行
- [ ] 完整流程练习 3-5 次
- [ ] 确保每个操作流畅
- [ ] 检查时间控制（每个场景不超时）
- [ ] 确认所有文字清晰可读

### 录制工具
- [ ] Screen Studio 已安装并配置（推荐）
- [ ] 或 QuickTime/OBS Studio 准备就绪
- [ ] 录制设置：1080p, 30fps
- [ ] 音频设置：如果录制旁白，确保麦克风正常

### 设计图准备
- [ ] 场景 1: 产品截图 + Logo + Slogan
- [ ] 场景 5: Volume 特性展示图
- [ ] 场景 7: 4 个场景卡片设计图
- [ ] 场景 8: 结束卡片 + Logo + URL

---

## 后期制作指南 (Post-Production Guide)

### 第1步：准备素材 📸

**产品截图**（场景 1）:
- Dashboard 界面截图
- 显示 Sandbox 列表、Volume 管理、运行状态
- 高质量，1920x1080

**录屏**（场景 2, 3, 4, 6）:
- 使用 Screen Studio（推荐）或 OBS
- 按照场景脚本录制
- 导出 1080p, 30fps

**设计图**（场景 5, 7, 8）:
- 使用 Figma/Canva 制作
- 遵循品牌色和风格
- 导出 PNG，1920x1080

### 第2步：生成 AI 口播视频 🤖

使用 **HeyGen**（https://www.heygen.com/）：
1. 选择数字人形象（建议专业、友好的形象）
2. 上传英文版旁白文案（见下方"HeyGen 演讲稿"部分）
3. 选择英文配音（推荐美式英语，专业音色）
4. 生成视频
5. **下载两个文件**：
   - AI 口播视频
   - **HeyGen 生成的字幕文件 (.srt)** ← 最终使用这个

### 第3步：合成最终视频 🎞️

使用 **剪映（CapCut）** 或剪映专业版：

#### 视频轨道布局（从下到上）
```
轨道3: 文字/字幕层
轨道2: AI 口播视频（数字人，右下角）
轨道1: 产品演示素材（底层，全屏）
```

#### 编辑步骤
1. **导入素材**：产品截图 + 录屏 + 设计图 + AI 口播视频 + HeyGen 字幕
2. **按时间轴排列素材**：
   - 0:00-0:12: 产品截图
   - 0:12-0:24: 录屏（Claude Code）
   - 0:24-0:36: 录屏（Run Code）
   - 0:36-0:48: 录屏（MCP Server）
   - 0:48-1:00: 设计图（Volume）
   - 1:00-1:16: 录屏（代码演示）
   - 1:16-1:28: 设计图（场景卡片）
   - 1:28-1:38: 设计图（CTA）
3. **编辑 AI 口播**：
   - 放在右下角，占屏幕 15-20%
   - 添加圆角和阴影
4. **添加字幕**：
   - 导入 HeyGen 生成的 .srt 文件
   - 调整样式（白色文字，深色描边）
   - 位置：底部居中
5. **添加过渡**：场景切换处添加 0.5 秒淡入淡出
6. **添加背景音乐**（可选）：音量 15-20%，不要盖过口播

#### 导出设置
- 分辨率：1080p (1920x1080)
- 帧率：30fps
- 码率：8-12 Mbps
- 格式：MP4 (H.264)

---

## 🎙️ HeyGen 演讲稿 (HeyGen Speech Text)

**风格说明**: Marketing 视频风格
- ✅ 第一句是 Hook（提出痛点）
- ✅ 第二句是 Introducing（引入解决方案）
- ✅ 适合官网首页、社交媒体推广

### 完整演讲稿（英文版 - 用于 HeyGen）

请直接复制以下内容到 HeyGen 的文本输入框中生成语音：

```
Running AI agents that execute user code? Security risks and infrastructure complexity make it a nightmare.

Introducing Sandock. Secure Docker Sandboxes for AI Agents and Developers. With full POSIX compatible volume file system.

Run Claude Code, Codex-CLI, and OpenCode. All powered by our complete file system.

Execute any code safely. Isolated runtime environment with network access for databases and remote services.

Run MCP Servers. Seamlessly connect to the AI ecosystem.

Why can we support all these? Because we have a complete, network-drive-level file system. 100% POSIX compatible.

Just 3 lines of code. Create volume, mount to sandbox, and execute.

Built for multiple scenarios. Code Agent, Code Interpreter, MCP Host, and Backup Jobs. All supported.

Visit sandock.ai to get started today.
```

### 完整演讲稿（中文版 - 仅供参考）

```
Sandock。为 AI Agent 和开发者提供安全的 Docker 沙箱。
配备完整的 POSIX 兼容 Volume 文件系统。

运行 Claude Code、Codex-CLI 和 OpenCode。
全部由我们完整的文件系统驱动。

安全执行任何代码。
运行环境隔离，网络可访问数据库和远程服务。

运行 MCP Server。无缝连接 AI 生态系统。

为什么我们能支持这些？
因为我们有完整的网盘级文件系统。100% POSIX 兼容。

只需 3 行代码。创建 Volume、挂载到沙箱、执行。

为多种场景而生。
Code Agent、代码解释器、MCP 主机、备份任务。全部支持。

立即访问 sandock.ai 开始使用。
```

### 分段演讲稿（带时间轴 - 中英文对照）

| 时间 | 演讲稿（英文） | 演讲稿（中文） |
|------|---------------|---------------|
| 0:00-0:12 | Sandock. Secure Docker Sandboxes for AI Agents and Developers. With full POSIX compatible volume file system. | Sandock。为 AI Agent 和开发者提供安全的 Docker 沙箱。配备完整的 POSIX 兼容 Volume 文件系统。 |
| 0:12-0:24 | Run Claude Code, Codex-CLI, and OpenCode. All powered by our complete file system. | 运行 Claude Code、Codex-CLI 和 OpenCode。全部由我们完整的文件系统驱动。 |
| 0:24-0:36 | Execute any code safely. Isolated runtime environment with network access for databases and remote services. | 安全执行任何代码。运行环境隔离，网络可访问数据库和远程服务。 |
| 0:36-0:48 | Run MCP Servers. Seamlessly connect to the AI ecosystem. | 运行 MCP Server。无缝连接 AI 生态系统。 |
| 0:48-1:00 | Why can we support all these? Because we have a complete, network-drive-level file system. 100% POSIX compatible. | 为什么我们能支持这些？因为我们有完整的网盘级文件系统。100% POSIX 兼容。 |
| 1:00-1:16 | Just 3 lines of code. Create volume, mount to sandbox, and execute. | 只需 3 行代码。创建 Volume、挂载到沙箱、执行。 |
| 1:16-1:28 | Built for multiple scenarios. Code Agent, Code Interpreter, MCP Host, and Backup Jobs. All supported. | 为多种场景而生。Code Agent、代码解释器、MCP 主机、备份任务。全部支持。 |
| 1:28-1:38 | Visit sandock.ai to get started today. | 立即访问 sandock.ai 开始使用。 |

---

## 字幕整合 (Subtitle Integration)

**重要提示**：
- ❌ **不要使用** 我们生成的 `subtitle.srt`（仅供参考）
- ✅ **使用** HeyGen 生成的字幕文件（与 AI 口播完美同步）
- 在剪映中导入 HeyGen 字幕
- 根据需要微调样式和位置

---

## 导出设置 (Export Settings)

### 最终视频规格
- **分辨率**: 1920x1080 (Full HD)
- **帧率**: 30fps
- **编码**: H.264
- **码率**: 8-12 Mbps
- **音频**: AAC, 192 kbps
- **格式**: MP4

### 多平台适配（可选）
- **横版 16:9** - 官网、YouTube（主版本）
- **竖版 9:16** - Instagram Stories、TikTok（裁剪版）
- **方形 1:1** - LinkedIn、Twitter（裁剪版）

---

## 成功建议 (Tips for Success)

### 录制技巧
- ✅ 使用干净的演示账号和示例数据
- ✅ 预加载所有页面，避免加载屏幕
- ✅ 练习流程 3-5 次后再正式录制
- ✅ 鼠标移动要流畅且有目的性
- ✅ 每个操作后停顿 1-2 秒

### 编辑技巧
- ✅ 大胆剪掉无用的停顿
- ✅ 重复操作可以加速（1.5x-2x）
- ✅ 为关键信息添加文字叠加
- ✅ 放大小的 UI 元素（110-120%）
- ✅ 控制总时长（±5 秒内）

### 测试检查
- ✅ 静音模式测试（关闭音频，仍能理解？）
- ✅ 移动端测试（小屏幕上可读？）
- ✅ 注意力测试（能保持 98 秒的吸引力？）
- ✅ 转化测试（清楚下一步该做什么？）

---

## 常见问题 (FAQ)

**Q: 为什么不直接用我们生成的 subtitle.srt?**
A: HeyGen 生成的字幕与 AI 口播完美同步，断句和时间轴更准确。

**Q: Screen Studio 太贵怎么办?**
A: 可以使用免费替代品：
- macOS: QuickTime + 后期用剪映添加动效
- Windows: OBS Studio + 后期处理
- 跨平台: Loom（有免费版）

**Q: 没有 HeyGen 付费账号怎么办?**
A: HeyGen 有免费额度。或使用替代品：D-ID、Synthesia，或真人出镜。

**Q: 视频时长超过 98 秒怎么办?**
A: 可以制作多个版本：
- 60 秒精简版（社交媒体）
- 98 秒标准版（官网）
- 120 秒完整版（销售演示）

**Q: 如何制作设计图？**
A: 使用 Figma 或 Canva，参考 gallery_script.md 中的设计建议。

---

## 使用场景 (Use Cases)

视频完成后可用于：
- ✅ 官网首页 Hero 区域
- ✅ Landing Page 产品介绍
- ✅ Product Hunt 发布
- ✅ GitHub README
- ✅ 社交媒体推广（YouTube、LinkedIn、Twitter）
- ✅ 销售演示（发给潜在客户）
- ✅ 邮件营销

---

## 核心信息传达检查清单

确保视频传达了以下核心信息：

- ✅ **产品定位**: Secure Docker Sandboxes for AI Agents & Developers
- ✅ **核心卖点**: 100% POSIX Compatible Volume 文件系统
- ✅ **支持 Claude Code**: 因为有完整文件系统
- ✅ **安全执行**: 运行环境隔离，网络可访问
- ✅ **MCP 支持**: 运行 MCP Server，连接 AI 生态
- ✅ **差异化**: 完整的网盘级文件系统，其他产品不支持
- ✅ **简单易用**: 3 行代码即可开始
- ✅ **多场景**: Code Agent（第一位）, Code Interpreter, MCP Host, Backup Jobs

---

**脚本版本**: v4.1 (Final)
**创建日期**: 2026-01-29
**目标时长**: 98 秒
**语言**: 中英双语（最终视频使用英文）
**核心特点**: 突出 Volume 文件系统 + 支持 Claude Code + 多场景支持
