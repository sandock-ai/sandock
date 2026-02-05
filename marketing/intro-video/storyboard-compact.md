# Sandock 产品介绍视频 - 分镜表格 (Storyboard)

**总时长**: 90秒 | **目标**: 促进免费试用 | **受众**: AI Agent 开发者、SaaS 平台开发者

---

## 分镜表格 (Storyboard)

| 场景 | 时间 | 时长(秒) | 画面/镜头 | 文字叠加 (中文) | 文字叠加 (英文) | 动作 | 旁白 (仅供参考) |
|------|------|---------|-----------|----------------|----------------|------|----------------|
| **1. 开场介绍** | 0:00-0:08 | 8 | Sandock Logo + 官网首页滚动 | "Sandock - AI Agent 的安全代码执行环境" | "Sandock - Secure Code Execution for AI Agents" | Logo 动画 → 官网首页 → 缓慢向下滚动展示界面 | **CN**: Sandock，为 AI Agent 提供安全的代码执行环境。<br>**EN**: Sandock. Secure code execution for AI Agents. |
| **2. 痛点呈现** | 0:08-0:20 | 12 | VS Code 显示不安全代码 + Docker 配置文件 | "AI Agent 执行用户代码？<br>❌ 安全风险<br>❌ 基础设施复杂" | "Running user code in AI Agents?<br>❌ Security risks<br>❌ Infrastructure complexity" | 显示 `eval(userCode)` → 错误提示 → 切换到复杂的 docker-compose.yml → 快速滚动 | **CN**: 让 AI Agent 执行用户代码？直接运行不安全，自建 Docker 又太复杂。<br>**EN**: Running user code in AI Agents? Direct execution is unsafe, and building your own Docker infrastructure is too complex. |
| **3. 产品介绍** | 0:20-0:35 | 15 | 文档页面 + SDK 安装 + API 示例 | "认识 Sandock<br>生产级代码沙箱 API<br>3 行代码即可开始" | "Meet Sandock<br>Production-ready Sandbox API<br>Get started in 3 lines of code" | 打开 sandock.ai/docs → 滚动到 Quick Start → 高亮 `npm install sandock` → 显示 API 示例代码 | **CN**: Sandock 提供生产级的代码沙箱 API，只需 3 行代码即可开始。<br>**EN**: Sandock provides a production-ready sandbox API. Get started in just 3 lines of code. |
| **4. 演示 - 创建沙箱** | 0:35-0:50 | 15 | VS Code 编辑器 - 创建沙箱代码 + 终端输出 | "步骤 1: 创建隔离沙箱<br>⚡ 3 秒启动" | "Step 1: Create Isolated Sandbox<br>⚡ Starts in 3 seconds" | 显示 `demo.ts` 文件 → 展示创建沙箱代码 → 运行代码 → 终端显示 `Sandbox created: sb_abc123xyz` | **CN**: 首先，创建一个隔离的沙箱环境，只需 3 秒即可启动。<br>**EN**: First, create an isolated sandbox environment. It starts in just 3 seconds. |
| **5. 演示 - 执行代码** | 0:50-1:05 | 15 | VS Code 编辑器 - 写入文件 + 执行代码 + 输出 | "步骤 2: 安全执行代码<br>JavaScript · Python · TypeScript" | "Step 2: Execute Code Safely<br>JavaScript · Python · TypeScript" | 编写写入文件代码 → 编写执行代码 → 运行脚本 → 终端显示 `Output: Hello from Sandock!` | **CN**: 然后，在沙箱中安全执行代码，支持 JavaScript、Python 和 TypeScript。<br>**EN**: Then, execute code safely in the sandbox. Supports JavaScript, Python, and TypeScript. |
| **6. 价值总结** | 1:05-1:15 | 10 | 功能特性列表 + 图标动画 | "✓ 完全隔离 - Docker 容器<br>✓ 类型安全 - TypeScript SDK<br>✓ 多语言支持 - JS/TS/Python<br>✓ 生产就绪 - Kubernetes 支持" | "✓ Fully Isolated - Docker containers<br>✓ Type-safe - TypeScript SDK<br>✓ Multi-language - JS/TS/Python<br>✓ Production Ready - Kubernetes support" | 特性列表逐一出现（每个 2-3 秒）→ 可选：显示 TypeScript 类型提示截图 | **CN**: Sandock 提供完全隔离的环境、类型安全的 SDK、多语言支持，并且生产就绪。<br>**EN**: Sandock provides fully isolated environments, type-safe SDK, multi-language support, and is production ready. |
| **7. 收尾 CTA** | 1:15-1:20 | 5 | 结束卡片 + Logo + URL | "开始使用 Sandock<br><br>免费试用: sandock.ai<br>文档: sandock.ai/docs" | "Get Started with Sandock<br><br>Try free: sandock.ai<br>Docs: sandock.ai/docs" | 淡入结束卡片 → 显示 Logo 和 URL → 可选：Logo 微动画（轻微缩放） | **CN**: 立即访问 sandock.ai 开始免费试用。<br>**EN**: Visit sandock.ai to try it free today. |

**总计**: 7 个场景 / 90 秒

---

## 核心代码示例（用于场景 4-5）

### 场景 4: 创建沙箱代码

```typescript
import { createSandockClient } from 'sandock'

const client = createSandockClient({
  baseUrl: 'https://sandock.ai',
  headers: { 'Authorization': 'Bearer YOUR_API_KEY' }
})

// Create sandbox
const { data } = await client.POST('/api/sandbox', {
  body: {
    image: 'sandockai/sandock-code:latest',
    memoryLimitMb: 512
  }
})

const sandboxId = data?.data?.id
console.log('Sandbox created:', sandboxId)
```

**终端输出**:
```
Sandbox created: sb_abc123xyz
```

---

### 场景 5: 执行代码

```typescript
// Write a file
await client.POST('/api/sandbox/{id}/fs/write', {
  params: { path: { id: sandboxId } },
  body: {
    path: 'hello.js',
    content: 'console.log("Hello from Sandock!")'
  }
})

// Execute code
const { data: result } = await client.POST('/api/sandbox/{id}/code', {
  params: { path: { id: sandboxId } },
  body: {
    language: 'javascript',
    code: 'console.log("Hello from Sandock!")'
  }
})

console.log('Output:', result?.data?.stdout)
```

**终端输出**:
```
Output: Hello from Sandock!
```

---

## 录制提示 (Recording Tips)

### 准备工作
- ✅ VS Code 主题: GitHub Dark，字体 16-18px
- ✅ 浏览器: 无书签栏，无插件图标，1920x1080
- ✅ 关闭通知: macOS 勿扰模式 / Windows 专注助手
- ✅ 准备 API Key: 确保能成功创建沙箱
- ✅ 练习 3-5 次: 确保流程流畅

### 录制技巧
- 🎬 使用 **Screen Studio** 自动美化录屏
- 🖱️ 鼠标移动要流畅且有目的性
- ⏸️ 每个操作后停顿 1-2 秒
- 📏 代码要清晰可读（放大到 110-120%）
- ⚡ 重复操作可以加速（1.5x-2x）

---

## 后期制作流程 (Post-Production)

### 第 1 步: 录制演示 🎬
- 工具: **Screen Studio** (推荐) 或 QuickTime
- 按照分镜表格逐场景录制
- 导出: 1080p, 30fps

### 第 2 步: 生成 AI 口播 🤖
- 工具: **HeyGen** (https://www.heygen.com/)
- 上传英文版旁白文案（从表格"旁白"列复制 EN 部分）
- 选择专业数字人形象 + 英文配音
- 下载: AI 口播视频 + **HeyGen 字幕文件 (.srt)**

### 第 3 步: 合成视频 🎞️
- 工具: **剪映 (CapCut)** 或剪映专业版
- 轨道布局:
  ```
  轨道3: 字幕层 (HeyGen 字幕)
  轨道2: AI 口播视频 (右下角, 15-20%)
  轨道1: 产品演示录屏 (全屏)
  ```
- 添加: 过渡效果 (0.5秒淡入淡出) + 背景音乐 (15-20% 音量)
- 导出: 1080p, 30fps, MP4 (H.264)

---

## 使用场景 (Use Cases)

视频完成后可用于:
- ✅ 官网首页 Hero 区域
- ✅ Product Hunt 发布
- ✅ GitHub README
- ✅ YouTube / LinkedIn / Twitter
- ✅ 销售演示 / 邮件营销

---

## 注意事项 (Important Notes)

⚠️ **字幕文件**: 最终视频使用 **HeyGen 生成的字幕**，不要使用我们生成的 `subtitle.srt`（仅供参考）

⚠️ **旁白**: 表格中的旁白仅供参考，实际使用 HeyGen 生成的 AI 配音

⚠️ **时长控制**: 每个场景严格控制时长，总时长保持在 85-95 秒之间

---

**脚本版本**: v1.0 (Compact)  
**创建日期**: 2026-01-27  
**格式**: 紧凑分镜表格 + 旁白  
**语言**: 中英双语（最终视频使用英文）



## 📝 完整演讲稿 (Full Speech Text)

请直接复制以下内容到 HeyGen 的文本输入框：

```
Sandock. Secure code execution for AI Agents.

Running user code in AI Agents? Direct execution is unsafe, and building your own Docker infrastructure is too complex.

Sandock provides a production-ready sandbox API. Get started in just 3 lines of code.

First, create an isolated sandbox environment. It starts in just 3 seconds.

Then, execute code safely in the sandbox. Supports JavaScript, Python, and TypeScript.

Sandock provides fully isolated environments, type-safe SDK, multi-language support, and is production ready.

Visit sandock.ai to try it free today.
```

```
Sandock——AI智能体的安全代码执行工具
想在AI智能体中运行用户代码？直接执行存在安全风险，自研Docker基础设施又过于复杂。

Sandock提供可直接投入生产的沙箱API，仅需3行代码即可快速上手。

1. 创建隔离式沙箱环境，3秒即可完成启动；
2. 在沙箱中安全执行代码，支持JavaScript、Python、TypeScript编程语言。

Sandock具备全隔离运行环境、类型安全的SDK、多语言适配能力，且可直接部署至生产环境。

即刻访问sandock.ai，免费体验！
```