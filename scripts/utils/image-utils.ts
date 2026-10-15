import sharp from 'sharp';
import type { ImageProcessorConfig } from '../image-processor.config';

// 动态导入 AI 库（可选依赖）
// 该库在 Node 环境下实际接受的输入类型很宽（文件路径 / Buffer / Uint8Array 均可），
// 这里用 unknown 收窄而不是 any——我们不关心入参细节，只把它透传给库。
type AIRemoveBackgroundFn = (
  input: unknown,
  options?: Record<string, unknown>,
) => Promise<Blob>;
let aiRemoveBackground: AIRemoveBackgroundFn | null = null;

async function loadAIRemoveBackground() {
  if (!aiRemoveBackground) {
    try {
      const module = await import('@imgly/background-removal-node');
      aiRemoveBackground = module.removeBackground as AIRemoveBackgroundFn;
    } catch (error) {
      throw new Error(
        'AI背景移除库未安装。请运行: pnpm install @imgly/background-removal-node',
      );
    }
  }
  return aiRemoveBackground;
}

/**
 * 将颜色字符串转换为 RGB 数组
 */
function parseColor(color: string): {
  r: number;
  g: number;
  b: number;
  alpha?: number;
} {
  // 处理 hex 格式 (#FFFFFF, #FFF, #FFFFFF00)
  if (color.startsWith('#')) {
    const hex = color.slice(1);
    if (hex.length === 3) {
      return {
        r: parseInt(hex[0] + hex[0], 16),
        g: parseInt(hex[1] + hex[1], 16),
        b: parseInt(hex[2] + hex[2], 16),
      };
    } else if (hex.length === 6) {
      return {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16),
      };
    } else if (hex.length === 8) {
      return {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16),
        alpha: parseInt(hex.slice(6, 8), 16) / 255,
      };
    }
  }

  // 处理 rgb/rgba 格式
  const rgbMatch = color.match(
    /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/,
  );
  if (rgbMatch) {
    return {
      r: parseInt(rgbMatch[1]),
      g: parseInt(rgbMatch[2]),
      b: parseInt(rgbMatch[3]),
      alpha: rgbMatch[4] ? parseFloat(rgbMatch[4]) : undefined,
    };
  }

  // 默认返回白色
  return { r: 255, g: 255, b: 255 };
}

/**
 * RGB 转 LAB 色彩空间（用于更准确的颜色比较）
 */
function rgbToLab(
  r: number,
  g: number,
  b: number,
): { l: number; a: number; b: number } {
  // 先转换为 XYZ
  let rn = r / 255;
  let gn = g / 255;
  let bn = b / 255;

  rn = rn > 0.04045 ? Math.pow((rn + 0.055) / 1.055, 2.4) : rn / 12.92;
  gn = gn > 0.04045 ? Math.pow((gn + 0.055) / 1.055, 2.4) : gn / 12.92;
  bn = bn > 0.04045 ? Math.pow((bn + 0.055) / 1.055, 2.4) : bn / 12.92;

  rn *= 100;
  gn *= 100;
  bn *= 100;

  const x = rn * 0.4124564 + gn * 0.3575761 + bn * 0.1804375;
  const y = rn * 0.2126729 + gn * 0.7151522 + bn * 0.072175;
  const z = rn * 0.0193339 + gn * 0.119192 + bn * 0.9503041;

  // XYZ 转 LAB
  const xn = x / 95.047;
  const yn = y / 100.0;
  const zn = z / 108.883;

  const fx = xn > 0.008856 ? Math.pow(xn, 1 / 3) : 7.787 * xn + 16 / 116;
  const fy = yn > 0.008856 ? Math.pow(yn, 1 / 3) : 7.787 * yn + 16 / 116;
  const fz = zn > 0.008856 ? Math.pow(zn, 1 / 3) : 7.787 * zn + 16 / 116;

  const l = 116 * fy - 16;
  const a = 500 * (fx - fy);
  const bb = 200 * (fy - fz);

  return { l, a, b: bb };
}

/**
 * 计算 LAB 色彩空间中的颜色距离（Delta E）
 */
function deltaE(
  lab1: { l: number; a: number; b: number },
  lab2: { l: number; a: number; b: number },
): number {
  return Math.sqrt(
    Math.pow(lab1.l - lab2.l, 2) +
      Math.pow(lab1.a - lab2.a, 2) +
      Math.pow(lab1.b - lab2.b, 2),
  );
}

/**
 * 快速抠图（改进版）
 * 使用更智能的背景色检测和边缘处理
 * - 使用 LAB 色彩空间进行更准确的颜色比较
 * - 改进的背景色检测（采样边缘和角落）
 * - 边缘平滑处理
 */
export async function removeBackgroundFast(
  inputBuffer: Buffer,
  backgroundColor: string = '#FFFFFF',
): Promise<Buffer> {
  const image = sharp(inputBuffer);
  const metadata = await image.metadata();
  const { width, height } = metadata;

  if (!width || !height) {
    throw new Error('无法获取图片尺寸');
  }

  // 获取图片的原始像素数据
  const { data, info } = await image
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  // 改进的背景色检测：采样更多边缘像素，使用角落像素提高准确性
  const edgePixels: Array<{ r: number; g: number; b: number }> = [];
  const cornerPixels: Array<{ r: number; g: number; b: number }> = [];
  const sampleSize = 100; // 增加采样数量

  // 采样四边边缘的像素
  for (let i = 0; i < sampleSize; i++) {
    // 顶部边缘
    const topX = Math.floor((i / sampleSize) * info.width);
    if (topX < info.width) {
      const idx = topX * 4;
      edgePixels.push({
        r: data[idx],
        g: data[idx + 1],
        b: data[idx + 2],
      });
    }

    // 底部边缘
    const bottomRowStart = (info.height - 1) * info.width * 4;
    const bottomX = Math.floor((i / sampleSize) * info.width);
    if (bottomX < info.width) {
      const idx = bottomRowStart + bottomX * 4;
      edgePixels.push({
        r: data[idx],
        g: data[idx + 1],
        b: data[idx + 2],
      });
    }

    // 左侧边缘
    const leftY = Math.floor((i / sampleSize) * info.height);
    if (leftY < info.height) {
      const idx = leftY * info.width * 4;
      edgePixels.push({
        r: data[idx],
        g: data[idx + 1],
        b: data[idx + 2],
      });
    }

    // 右侧边缘
    const rightY = Math.floor((i / sampleSize) * info.height);
    if (rightY < info.height) {
      const idx = rightY * info.width * 4 + (info.width - 1) * 4;
      edgePixels.push({
        r: data[idx],
        g: data[idx + 1],
        b: data[idx + 2],
      });
    }
  }

  // 采样角落像素（通常背景色更纯）
  const cornerSize = 15;
  for (let y = 0; y < cornerSize && y < info.height; y++) {
    for (let x = 0; x < cornerSize && x < info.width; x++) {
      // 左上角
      let idx = (y * info.width + x) * 4;
      cornerPixels.push({ r: data[idx], g: data[idx + 1], b: data[idx + 2] });

      // 右上角
      idx = (y * info.width + (info.width - 1 - x)) * 4;
      cornerPixels.push({ r: data[idx], g: data[idx + 1], b: data[idx + 2] });

      // 左下角
      idx = ((info.height - 1 - y) * info.width + x) * 4;
      cornerPixels.push({ r: data[idx], g: data[idx + 1], b: data[idx + 2] });

      // 右下角
      idx = ((info.height - 1 - y) * info.width + (info.width - 1 - x)) * 4;
      cornerPixels.push({ r: data[idx], g: data[idx + 1], b: data[idx + 2] });
    }
  }

  // 计算平均背景色（边缘和角落混合，角落权重更高）
  let mainBgColor = { r: 255, g: 255, b: 255 };

  if (edgePixels.length > 0) {
    const edgeAvg = edgePixels.reduce(
      (acc, pixel) => ({
        r: acc.r + pixel.r,
        g: acc.g + pixel.g,
        b: acc.b + pixel.b,
      }),
      { r: 0, g: 0, b: 0 },
    );

    const edgeColor = {
      r: Math.round(edgeAvg.r / edgePixels.length),
      g: Math.round(edgeAvg.g / edgePixels.length),
      b: Math.round(edgeAvg.b / edgePixels.length),
    };

    if (cornerPixels.length > 0) {
      const cornerAvg = cornerPixels.reduce(
        (acc, pixel) => ({
          r: acc.r + pixel.r,
          g: acc.g + pixel.g,
          b: acc.b + pixel.b,
        }),
        { r: 0, g: 0, b: 0 },
      );

      const cornerColor = {
        r: Math.round(cornerAvg.r / cornerPixels.length),
        g: Math.round(cornerAvg.g / cornerPixels.length),
        b: Math.round(cornerAvg.b / cornerPixels.length),
      };

      // 混合边缘和角落颜色（角落权重70%）
      mainBgColor = {
        r: Math.round(edgeColor.r * 0.3 + cornerColor.r * 0.7),
        g: Math.round(edgeColor.g * 0.3 + cornerColor.g * 0.7),
        b: Math.round(edgeColor.b * 0.3 + cornerColor.b * 0.7),
      };
    } else {
      mainBgColor = edgeColor;
    }
  } else {
    const bgColor = parseColor(backgroundColor);
    mainBgColor = { r: bgColor.r, g: bgColor.g, b: bgColor.b };
  }

  // 将背景色转换为 LAB
  const bgLab = rgbToLab(mainBgColor.r, mainBgColor.g, mainBgColor.b);

  // 自适应阈值：根据颜色明暗度调整
  const brightness = (mainBgColor.r + mainBgColor.g + mainBgColor.b) / 3;
  let threshold = 22; // LAB色彩空间的Delta E阈值（更严格）

  // 如果背景较暗或较亮，调整阈值
  if (brightness < 50) {
    threshold = 28; // 暗色背景需要更大的阈值
  } else if (brightness > 200) {
    threshold = 18; // 亮色背景可以使用更小的阈值
  }

  // 第一遍：使用LAB色彩空间计算，更准确
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    const pixelLab = rgbToLab(r, g, b);
    const colorDistance = deltaE(bgLab, pixelLab);

    // 如果颜色距离小于阈值，标记为背景
    if (colorDistance < threshold) {
      // 设置透明度，使用渐变而不是直接设为0，使边缘更平滑
      const alphaRatio = colorDistance / threshold;
      const alpha = Math.max(0, Math.round(255 * (1 - alphaRatio * 0.8)));
      data[i + 3] = alpha < 30 ? 0 : alpha; // 小于30的透明度直接设为0
    }
  }

  // 第二遍：边缘平滑处理（使用形态学操作简化版）
  const newData = Buffer.from(data);
  for (let y = 1; y < info.height - 1; y++) {
    for (let x = 1; x < info.width - 1; x++) {
      const idx = (y * info.width + x) * 4 + 3;
      const currentAlpha = newData[idx];

      // 如果当前像素不透明，检查周围像素
      if (currentAlpha > 30) {
        const neighbors = [
          newData[idx - info.width * 4], // 上
          newData[idx + info.width * 4], // 下
          newData[idx - 4], // 左
          newData[idx + 4], // 右
          newData[idx - info.width * 4 - 4], // 左上
          newData[idx - info.width * 4 + 4], // 右上
          newData[idx + info.width * 4 - 4], // 左下
          newData[idx + info.width * 4 + 4], // 右下
        ];

        // 计算周围透明像素数量
        const transparentCount = neighbors.filter((alpha) => alpha < 30).length;
        const opaqueCount = neighbors.filter((alpha) => alpha > 200).length;

        // 如果周围有很多透明像素，可能是边缘，进行平滑处理
        if (transparentCount >= 3 && transparentCount <= 6) {
          const avgAlpha =
            neighbors.reduce((sum, a) => sum + a, 0) / neighbors.length;
          // 平滑处理，但保持主体不透明
          data[idx] = Math.max(
            currentAlpha - 10,
            Math.round(currentAlpha * 0.8 + avgAlpha * 0.2),
          );
        } else if (opaqueCount >= 6 && currentAlpha < 150) {
          // 如果周围都是不透明像素，当前像素也应该不透明
          data[idx] = Math.min(255, currentAlpha + 20);
        }
      }
    }
  }

  // 将处理后的数据转换回图片
  return sharp(Buffer.from(data), {
    raw: {
      width: info.width,
      height: info.height,
      channels: 4,
    },
  })
    .png()
    .toBuffer();
}

/**
 * AI 抠图（使用 @imgly/background-removal-node）
 * 效果更好，但速度较慢
 */
export async function removeBackgroundAI(imagePath: string): Promise<Buffer> {
  try {
    const removeBackground = await loadAIRemoveBackground();
    // 直接传入文件路径，由库内部负责读取与解析
    const blob = await removeBackground(imagePath, {
      model: 'small', // 使用小模型以加快速度，可选 'medium' 获得更好效果
      output: {
        // 按官方类型要求使用 MIME 类型，而不是简单的 'png'
        format: 'image/png',
      },
    });

    // 将 Blob 转换为 Buffer
    const arrayBuffer = await blob.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error) {
    throw new Error(
      `AI抠图失败: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * 智能裁剪
 * 基于裁剪模式进行裁剪
 */
export async function smartCrop(
  inputBuffer: Buffer,
  targetSize: { width: number; height: number },
  cropMode: 'center' | 'smart' = 'center',
): Promise<Buffer> {
  const image = sharp(inputBuffer);
  const metadata = await image.metadata();
  const { width, height } = metadata;

  if (!width || !height) {
    throw new Error('无法获取图片尺寸');
  }

  if (cropMode === 'center') {
    // 中心裁剪
    const minDimension = Math.min(width, height);
    const left = Math.floor((width - minDimension) / 2);
    const top = Math.floor((height - minDimension) / 2);

    return image
      .extract({
        left,
        top,
        width: minDimension,
        height: minDimension,
      })
      .resize(targetSize.width, targetSize.height, {
        fit: 'fill',
      })
      .toBuffer();
  } else {
    // 智能裁剪：尝试检测主体位置（简化版，使用中心裁剪）
    // 注意：完整的智能裁剪需要人脸检测或其他AI技术，这里使用简化版本
    const minDimension = Math.min(width, height);
    const left = Math.floor((width - minDimension) / 2);
    const top = Math.floor((height - minDimension) / 2);

    return image
      .extract({
        left,
        top,
        width: minDimension,
        height: minDimension,
      })
      .resize(targetSize.width, targetSize.height, {
        fit: 'fill',
      })
      .toBuffer();
  }
}

/**
 * 添加背景色
 */
export async function addBackground(
  inputBuffer: Buffer,
  backgroundColor: string,
): Promise<Buffer> {
  const image = sharp(inputBuffer);
  const metadata = await image.metadata();
  const { width, height } = metadata;

  if (!width || !height) {
    throw new Error('无法获取图片尺寸');
  }

  const bgColor = parseColor(backgroundColor);

  // 确保图片有 alpha 通道
  const imageWithAlpha = await image.ensureAlpha().png().toBuffer();

  // 创建背景层并合成
  return sharp({
    create: {
      width,
      height,
      channels: 4,
      background: {
        r: bgColor.r,
        g: bgColor.g,
        b: bgColor.b,
        alpha: bgColor.alpha ?? 1,
      },
    },
  })
    .png()
    .composite([
      {
        input: imageWithAlpha,
      },
    ])
    .png()
    .toBuffer();
}

/**
 * 将已抠好前景图按带内边距的方式排版到目标画布上（主要用于 AI 模式）
 */
async function layoutOnBackgroundWithPadding(
  inputBuffer: Buffer,
  config: ImageProcessorConfig,
): Promise<Buffer> {
  const { width: targetW, height: targetH } = config.targetSize;

  // 预设留白（可按需要微调）
  const paddingTop = 1; // 头顶空间
  const paddingBottom = 0; //底部空间
  const paddingX = 0; //左右空间

  const availW = targetW - paddingX * 2;
  const availH = targetH - paddingTop - paddingBottom;

  // 把前景图（已抠好，带透明）等比缩放到可用区域内
  const fg = sharp(inputBuffer).ensureAlpha();
  const resizedFg = fg.resize(availW, availH, {
    fit: 'inside',
    withoutEnlargement: true,
  });
  const fgBuffer = await resizedFg.toBuffer();
  const fgMeta = await sharp(fgBuffer).metadata();
  const fgW = fgMeta.width ?? availW;
  const fgH = fgMeta.height ?? availH;

  // 水平方向居中，垂直方向在可用区域内略微偏下（给头顶留空间）
  const left = Math.round((targetW - fgW) / 2);
  const top = paddingTop + Math.round((availH - fgH) / 2);

  const bgColor = parseColor(config.backgroundColor);

  // 创建整张目标背景并把前景叠上去
  return sharp({
    create: {
      width: targetW,
      height: targetH,
      channels: 4,
      background: {
        r: bgColor.r,
        g: bgColor.g,
        b: bgColor.b,
        alpha: bgColor.alpha ?? 1,
      },
    },
  })
    .composite([{ input: fgBuffer, left, top }])
    .png()
    .toBuffer();
}

/**
 * 调整图片尺寸
 */
export async function resizeImage(
  inputBuffer: Buffer,
  targetSize: { width: number; height: number },
): Promise<Buffer> {
  return sharp(inputBuffer)
    .resize(targetSize.width, targetSize.height, {
      fit: 'fill',
    })
    .toBuffer();
}

/**
 * 转换图片格式
 */
export async function convertFormat(
  inputBuffer: Buffer,
  format: 'jpg' | 'png',
  quality: number = 90,
): Promise<Buffer> {
  const image = sharp(inputBuffer);

  if (format === 'jpg') {
    return image.jpeg({ quality }).toBuffer();
  } else {
    return image.png().toBuffer();
  }
}

/**
 * 完整的图片处理流程
 */
export async function processImage(
  imagePath: string,
  config: ImageProcessorConfig,
  _tempDir?: string,
): Promise<Buffer> {
  let processedImage: Buffer;

  try {
    // 1. 抠图 + 排版
    if (config.processingMode === 'ai') {
      // 检查 AI 库是否可用
      try {
        // AI 抠出前景（带透明通道）
        const aiForeground = await removeBackgroundAI(imagePath);
        // 直接按带内边距的方式排版到目标画布
        processedImage = await layoutOnBackgroundWithPadding(
          aiForeground,
          config,
        );
      } catch (error) {
        console.warn(
          `AI抠图失败，回退到快速模式: ${error instanceof Error ? error.message : String(error)}`,
        );
        // 回退到快速模式：继续使用原来的 fast 流程
        const inputBuffer = await sharp(imagePath).toBuffer();
        processedImage = await removeBackgroundFast(
          inputBuffer,
          config.backgroundColor,
        );
        processedImage = await smartCrop(
          processedImage,
          config.targetSize,
          config.cropMode,
        );
        processedImage = await addBackground(
          processedImage,
          config.backgroundColor,
        );
        processedImage = await resizeImage(processedImage, config.targetSize);
      }
    } else {
      // 快速模式
      const inputBuffer = await sharp(imagePath).toBuffer();
      processedImage = await removeBackgroundFast(
        inputBuffer,
        config.backgroundColor,
      );
      processedImage = await smartCrop(
        processedImage,
        config.targetSize,
        config.cropMode,
      );
      processedImage = await addBackground(
        processedImage,
        config.backgroundColor,
      );
      processedImage = await resizeImage(processedImage, config.targetSize);
    }

    // 2. 转换格式（JPG/PNG 及质量）
    processedImage = await convertFormat(
      processedImage,
      config.outputFormat,
      config.quality,
    );

    return processedImage;
  } catch (error) {
    throw new Error(
      `图片处理失败 [${imagePath}]: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
