# Sandock 视频制作 - 快速开始指南

## 🎯 目标

制作一个 90 秒的 Sandock 产品介绍视频，包含 Motion Graphics 动画 + AI 口播。

## 📦 你已经拥有的资源

✅ **完整的 Remotion 项目** - 8 个场景的抽象动画代码  
✅ **分镜脚本** - 详细的场景设计和时间轴  
✅ **HeyGen 演讲稿** - AI 口播文案  
✅ **工具对比文档** - 选择最适合的制作工具

## 🚀 3 步完成视频

### 第 1 步：运行 Remotion 项目（30 分钟）

```bash
# 1. 进入项目目录
cd projects/sandock/marketing/intro-video/remotion-project

# 2. 安装依赖
pnpm install

# 3. 启动开发服务器
pnpm start
```

**会发生什么**：
- 浏览器会自动打开 Remotion Studio
- 你会看到完整的 80 秒视频预览
- 可以拖动时间轴查看每个场景
- 可以实时修改代码并看到效果

**调整建议**（可选）：
- 修改颜色：在各个场景文件中搜索颜色代码（如 `#00ff64`）
- 修改文字：搜索英文文案并替换
- 调整时长：在 `src/Video.tsx` 中修改 `durationInFrames`

**完成后**：
```bash
# 渲染最终视频
pnpm build
```

视频会输出到 `out/video.mp4`（约 2-5 分钟渲染时间）

---

### 第 2 步：生成 AI 口播（10 分钟）

**使用 HeyGen**：https://www.heygen.com/

1. **登录 HeyGen**

2. **创建新视频**
   - 点击 "Create Video"
   - 选择 "Avatar Video"

3. **选择数字人**
   - 推荐：Joshua (Professional Male) 或 Emma (Professional Female)
   - 风格：专业、友好

4. **输入演讲稿**
   - 打开 `heygen-speech.md`
   - 复制"完整演讲稿"部分
   - 粘贴到 HeyGen

5. **选择配音**
   - 语言：English
   - 音色：Professional Male/Female (US English)
   - 语速：Normal

6. **生成视频**
   - 点击 "Generate"
   - 等待 3-5 分钟

7. **下载文件**（重要！）
   - ✅ AI 口播视频 (MP4)
   - ✅ **字幕文件 (.srt)** ← 一定要下载！

---

### 第 3 步：合成最终视频（20 分钟）

**使用剪映**：https://www.capcut.cn/

#### 3.1 导入素材

1. 打开剪映
2. 导入以下文件：
   - `out/video.mp4` (Remotion 渲染的动画)
   - HeyGen AI 口播视频
   - HeyGen 字幕文件 (.srt)

#### 3.2 编辑视频轨道

**轨道布局**（从下到上）：
```
轨道 3: 字幕层
轨道 2: AI 口播视频（右下角）
轨道 1: Remotion 动画（全屏）
```

**操作步骤**：

1. **底层 - Remotion 动画**
   - 拖动 `out/video.mp4` 到轨道 1
   - 保持全屏

2. **中层 - AI 口播**
   - 拖动 HeyGen 视频到轨道 2
   - 调整位置：右下角
   - 调整大小：占屏幕 15-20%
   - 添加效果：
     - 圆角：使用"蒙版" → "圆角矩形"
     - 阴影：使用"特效" → "阴影"

3. **顶层 - 字幕**
   - 点击"文本" → "导入字幕"
   - 选择 HeyGen 的 .srt 文件
   - 调整样式：
     - 字体：思源黑体 / PingFang SC
     - 大小：32px
     - 颜色：白色 + 深色描边
     - 位置：底部居中

#### 3.3 添加背景音乐（可选）

1. 点击"音频" → "音乐"
2. 选择轻音乐或企业宣传音乐
3. 调整音量：15-20%（不要盖过口播）

#### 3.4 导出视频

1. 点击"导出"
2. 设置：
   - 分辨率：1080p
   - 帧率：30fps
   - 码率：8-12 Mbps
   - 格式：MP4 (H.264)
3. 导出

---

## ✅ 完成！

你现在有了一个完整的 Sandock 产品介绍视频！

## 📤 发布建议

### 官网
- 放在首页 Hero 区域
- 自动播放（静音）
- 点击后全屏播放

### Product Hunt
- 作为主视频
- 配合 Gallery 图片

### 社交媒体
- YouTube: 完整版 (90秒)
- Twitter/LinkedIn: 精简版 (60秒)
- Instagram: 竖版 (9:16)

---

## 🎨 可选：制作多个版本

### 60 秒精简版
删除场景 4 (Volume) 或场景 7 (Use Cases)

### 竖版 (9:16)
在 Remotion 中修改分辨率：
```tsx
width={1080}
height={1920}
```

### 不同语言版本
1. 修改 Remotion 中的文字
2. 在 HeyGen 中选择不同语言的配音
3. 重新合成

---

## 🐛 遇到问题？

### Remotion 相关
- **渲染慢**: 降低并发数 `--concurrency=1`
- **内存不足**: 分段渲染或降低质量
- **预览卡顿**: 正常现象，最终渲染会流畅

### HeyGen 相关
- **没有字幕下载**: 在视频详情页找"Subtitles"或"Captions"
- **口播不同步**: 使用 HeyGen 的字幕文件，不要用我们生成的

### 剪映相关
- **AI 口播位置**: 使用"画中画"功能调整
- **字幕不同步**: 微调时间轴（±0.5秒）
- **导出失败**: 降低分辨率或码率

---

## 📚 相关文档

- `README.md` - Remotion 项目详细说明
- `storyboard-v3-final.md` - 完整分镜脚本
- `heygen-speech.md` - HeyGen 演讲稿
- `animation-tools-comparison.md` - 工具对比

---

## 💡 专业建议

### 如果你有 1 天时间
按照上面 3 步走，使用现成的 Remotion 项目

### 如果你有 3-4 天时间
1. 第 1 天：熟悉 Remotion，调整动画
2. 第 2 天：优化细节，渲染视频
3. 第 3 天：HeyGen 生成口播
4. 第 4 天：剪映合成，发布

### 如果你想要最佳效果
1. 使用 Remotion 制作核心动画
2. 外包复杂场景给动画师（$200-500）
3. HeyGen 生成专业 AI 口播
4. Premiere Pro 精细合成

---

## 🎯 预期成果

- ✅ 90 秒高质量产品介绍视频
- ✅ Motion Graphics 风格，专业美观
- ✅ AI 口播，清晰流畅
- ✅ 可复用的 Remotion 组件库
- ✅ 适合官网、Product Hunt、社交媒体

---

**预计总时间**: 1-2 小时（使用现成项目）  
**预计成本**: $0（如果有 HeyGen 免费额度）  
**难度**: ⭐⭐⭐ (中等，需要基本的视频编辑知识)

开始吧！🚀
