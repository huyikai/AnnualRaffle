# 批量图片处理脚本

用于批量处理头像图片，统一背景色、尺寸和格式的脚本工具。

## 功能特性

- ✅ **混合处理模式**：
  - AI增强模式（默认）：使用 AI 精确抠图，并自动按头像排版到目标画布，效果好（约3-20秒/张）
  - 快速模式：基于改进的颜色阈值与 LAB 色彩空间抠图，速度快（<1秒/张），无需额外依赖
- ✅ **批量处理**：自动处理目录下所有图片文件
- ✅ **统一尺寸**：将所有图片调整为指定尺寸（默认160x160px）
- ✅ **统一格式**：转换为指定格式（默认JPG）
- ✅ **统一背景色**：为图片添加统一的背景色
- ✅ **独立目录**：输入输出都在 `scripts` 目录下，不影响原有 `user` 目录

## 安装依赖

```bash
# 必需依赖（已包含在 package.json 中）
pnpm install

# 推荐：安装 AI 增强模式依赖（默认处理模式为 AI）
pnpm install @imgly/background-removal-node
```

## 使用方法

### 1. 准备图片

将需要处理的图片文件放入 `scripts/input/` 目录。

支持的图片格式：

- `.jpg` / `.jpeg`
- `.png`
- `.webp`
- `.gif`
- `.bmp`

### 2. 运行脚本

```bash
# 使用默认配置（AI 增强模式）
pnpm run process-images

# 或直接使用 tsx
pnpx tsx scripts/process-images.ts
```

### 3. 查看结果

处理后的图片会保存在 `scripts/output/` 目录中。

## 配置选项

可以通过环境变量或修改配置文件来调整处理参数：

### 方式一：环境变量（推荐）

```bash
# 使用快速模式（关闭 AI 增强）
PROCESSING_MODE=fast pnpm run process-images

# 使用 AI 增强模式（默认，可不显式设置）
PROCESSING_MODE=ai pnpm run process-images

# 自定义背景色
BACKGROUND_COLOR=#FF0000 pnpm run process-images

# 自定义尺寸
TARGET_WIDTH=200 TARGET_HEIGHT=200 pnpm run process-images

# 自定义输出格式
OUTPUT_FORMAT=png pnpm run process-images

# 自定义JPG质量（仅对JPG格式有效）
JPG_QUALITY=95 pnpm run process-images

# 自定义裁剪模式
CROP_MODE=smart pnpm run process-images
```

### 方式二：修改配置文件

编辑 `scripts/image-processor.config.ts` 文件：

```typescript
export const defaultConfig: ImageProcessorConfig = {
  processingMode: 'ai', // 'fast' | 'ai'
  targetSize: {
    width: 160,
    height: 160,
  },
  outputFormat: 'jpg', // 'jpg' | 'png'
  backgroundColor: '#962520', // hex 颜色，如 '#FFFFFF' 或 'rgb(255,255,255)'
  inputDir: 'scripts/input', // 输入目录
  outputDir: 'scripts/output', // 输出目录
  quality: 100, // JPG 质量（1-100）
  cropMode: 'smart', // 'center' | 'smart'
};
```

## 处理模式说明

### 快速模式

- ✅ **优点**：
  - 无需额外依赖
  - 处理速度快（<1秒/张）
  - 无需网络连接
- ⚠️ **限制**：
  - 抠图效果一般
  - 适合背景色相对单一的图片
  - 自动分析图片边缘像素来识别背景色

**适用场景**：

- 批量处理大量图片
- 图片背景色相对单一
- 对处理速度有要求

### AI增强模式（默认）

- ✅ **优点**：
  - 抠图效果精确，适合复杂背景
  - 默认处理模式，配合智能排版获得更稳定的头像效果
  - 处理失败时会自动回退到快速模式完整处理管线（不会中断整个批量任务）
- ⚠️ **限制**：
  - 需要安装额外依赖（约40-80MB模型）
  - 处理速度慢（3-20秒/张）
  - 首次运行需要下载模型（需要网络连接）

**适用场景**：

- 图片背景复杂
- 对抠图质量要求高
- 图片数量较少

## 性能说明

### 快速模式性能

- 处理速度：<1秒/张
- 50-200张图片：约1-3分钟

### AI模式

- 处理速度：3-20秒/张
- 50-200张图片：约4-66分钟

## 实现细节与新特性概览

为便于理解新版脚本相对早期版本的改进，这里简要列出几个核心实现要点（无需深入代码也能大致把握行为）：

1. **快速模式抠图更智能**
   - 使用 LAB 色彩空间和 ΔE（颜色距离）做背景色判断，比简单 RGB 阈值更稳定。
   - 自动从四周边缘和四个角落采样背景颜色，自适应不同明暗程度的背景。
   - 对边缘区域做二次平滑处理，减少“毛边”和锯齿感。

2. **AI 模式自动回退机制**
   - 首选使用 `@imgly/background-removal-node` 做高质量抠图。
   - 如果 AI 模型不可用或抠图失败，会自动回退到“快速模式 + 智能裁剪 + 背景合成”的完整流程，单张失败不会中断后续图片处理。

3. **AI 模式下的头像排版优化**
   - 把抠好前景的头像按“带内边距”的方式排版到目标画布：上下留出适当空间，左右居中。
   - 重点保证头部不会被裁切，最终生成的头像在统一尺寸下也有比较统一的视觉布局。

## 注意事项

1. **输入目录**：脚本会自动创建 `scripts/input/` 目录，请将待处理的图片放入该目录
2. **输出目录**：脚本会自动创建 `scripts/output/` 目录，处理后的图片保存在该目录
3. **文件命名**：输出文件名保持原文件名，但扩展名会根据输出格式改变
4. **原图保护**：原图不会被修改，只会生成新的处理后的图片
5. **快速模式**：会自动分析图片边缘像素来识别背景色，效果取决于原图背景的单一程度
6. **AI模式**：首次运行会下载模型文件，需要网络连接，未安装依赖时脚本会给出提示并允许一键切换到快速模式

## 故障排除

### AI模式提示库未安装

如果使用AI模式但未安装依赖，脚本会提示：

```bash
⚠ 警告: AI增强模式需要安装 @imgly/background-removal-node
  运行: pnpm install @imgly/background-removal-node
```

**解决方案**：

- 安装依赖：`pnpm install @imgly/background-removal-node`
- 或切换到快速模式：`PROCESSING_MODE=fast pnpm run process-images`

### 处理失败

如果某张图片处理失败：

- 检查图片文件是否损坏
- 检查图片格式是否支持
- 查看错误信息中的详细提示

### 快速模式效果不佳

如果快速模式的抠图效果不理想：

- 尝试使用AI模式获得更好的效果
- 或者手动预处理图片，使背景色更单一

## 示例

### 示例1：批量处理用户头像（快速模式）

```bash
# 1. 将头像图片放入 scripts/input/ 目录
# 2. 运行脚本
pnpm run process-images
# 3. 在 scripts/output/ 目录查看处理后的图片
```

### 示例2：使用AI模式处理复杂背景

```bash
# 1. 安装AI依赖
pnpm install @imgly/background-removal-node

# 2. 将图片放入 scripts/input/ 目录
# 3. 使用AI模式运行
PROCESSING_MODE=ai pnpm run process-images
```

### 示例3：自定义配置

```bash
# 处理为200x200的PNG格式，黑色背景
TARGET_WIDTH=200 TARGET_HEIGHT=200 OUTPUT_FORMAT=png BACKGROUND_COLOR=#000000 pnpm run process-images
```
