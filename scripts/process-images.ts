#!/usr/bin/env node

/**
 * 批量图片处理脚本
 *
 * 功能：
 * - 批量处理图片，统一背景色、尺寸和格式
 * - 支持快速模式（默认）和AI增强模式
 * - 输入：scripts/input 目录
 * - 输出：scripts/output 目录
 */

import { readdir, mkdir, stat } from 'fs/promises';
import { join, extname, basename } from 'path';
import { processImage } from './utils/image-utils.js';
import {
  defaultConfig,
  type ImageProcessorConfig,
} from './image-processor.config.js';

// 支持的图片格式
const SUPPORTED_FORMATS = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp'];

/**
 * 获取配置（可以从配置文件或环境变量读取）
 */
function getConfig(): ImageProcessorConfig {
  // 可以通过环境变量覆盖默认配置
  const processingMode =
    (process.env.PROCESSING_MODE as 'fast' | 'ai' | undefined) ||
    defaultConfig.processingMode;
  const backgroundColor =
    process.env.BACKGROUND_COLOR || defaultConfig.backgroundColor;
  const targetSize = {
    width: parseInt(
      process.env.TARGET_WIDTH || String(defaultConfig.targetSize.width),
      10,
    ),
    height: parseInt(
      process.env.TARGET_HEIGHT || String(defaultConfig.targetSize.height),
      10,
    ),
  };
  const outputFormat =
    (process.env.OUTPUT_FORMAT as 'jpg' | 'png' | undefined) ||
    defaultConfig.outputFormat;
  const quality = parseInt(
    process.env.JPG_QUALITY || String(defaultConfig.quality),
    10,
  );
  const cropMode =
    (process.env.CROP_MODE as 'center' | 'smart' | undefined) ||
    defaultConfig.cropMode;

  // 输入输出目录使用绝对路径（基于当前工作目录）
  const inputDir = join(
    process.cwd(),
    process.env.INPUT_DIR || defaultConfig.inputDir,
  );
  const outputDir = join(
    process.cwd(),
    process.env.OUTPUT_DIR || defaultConfig.outputDir,
  );

  return {
    processingMode,
    targetSize,
    outputFormat,
    backgroundColor,
    inputDir,
    outputDir,
    quality,
    cropMode,
  };
}

/**
 * 检查文件是否为支持的图片格式
 */
function isImageFile(filename: string): boolean {
  const ext = extname(filename).toLowerCase();
  return SUPPORTED_FORMATS.includes(ext);
}

/**
 * 获取输入目录中的所有图片文件
 */
async function getImageFiles(inputDir: string): Promise<string[]> {
  try {
    const files = await readdir(inputDir);
    const imageFiles: string[] = [];

    for (const file of files) {
      const filePath = join(inputDir, file);
      const stats = await stat(filePath);

      if (stats.isFile() && isImageFile(file)) {
        imageFiles.push(filePath);
      }
    }

    return imageFiles;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(
        `输入目录不存在: ${inputDir}\n请创建目录并放入图片文件。`,
      );
    }
    throw error;
  }
}

/**
 * 确保输出目录存在
 */
async function ensureOutputDir(outputDir: string): Promise<void> {
  try {
    await mkdir(outputDir, { recursive: true });
  } catch (error) {
    throw new Error(
      `无法创建输出目录: ${outputDir}\n错误: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * 处理单张图片
 */
async function processSingleImage(
  imagePath: string,
  config: ImageProcessorConfig,
  index: number,
  total: number,
): Promise<void> {
  const filename = basename(imagePath);
  const ext = extname(filename);
  const nameWithoutExt = basename(filename, ext);
  const outputExt = config.outputFormat === 'jpg' ? '.jpg' : '.png';
  const outputFilename = nameWithoutExt + outputExt;
  const outputPath = join(config.outputDir, outputFilename);

  try {
    console.log(`[${index + 1}/${total}] 处理中: ${filename}`);

    const startTime = Date.now();
    const processedBuffer = await processImage(imagePath, config);

    // 写入文件
    const fs = await import('fs/promises');
    // 处理 sharp 返回的 Buffer 类型与 fs.writeFile 类型定义不完全兼容的问题
    await fs.writeFile(outputPath, processedBuffer as unknown as Uint8Array);

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`      完成: ${outputFilename} (耗时: ${duration}秒)`);
  } catch (error) {
    console.error(`      失败: ${filename}`);
    console.error(
      `      错误: ${error instanceof Error ? error.message : String(error)}`,
    );
    throw error;
  }
}

/**
 * 主函数
 */
async function main(): Promise<void> {
  console.log('=== 批量图片处理脚本 ===\n');

  // 获取配置
  const config = getConfig();

  // 显示配置信息
  console.log('配置信息:');
  console.log(
    `  处理模式: ${config.processingMode === 'ai' ? 'AI增强模式' : '快速模式'}`,
  );
  console.log(
    `  目标尺寸: ${config.targetSize.width}x${config.targetSize.height}px`,
  );
  console.log(`  输出格式: ${config.outputFormat.toUpperCase()}`);
  console.log(`  背景色: ${config.backgroundColor}`);
  console.log(
    `  裁剪模式: ${config.cropMode === 'smart' ? '智能裁剪' : '中心裁剪'}`,
  );
  if (config.outputFormat === 'jpg') {
    console.log(`  JPG质量: ${config.quality}`);
  }
  console.log(`  输入目录: ${config.inputDir}`);
  console.log(`  输出目录: ${config.outputDir}\n`);

  // 检查AI模式
  if (config.processingMode === 'ai') {
    try {
      // 尝试导入AI库，如果失败则提示
      await import('@imgly/background-removal-node');
      console.log('✓ AI增强模式已启用\n');
    } catch (error) {
      console.warn('⚠ 警告: AI增强模式需要安装 @imgly/background-removal-node');
      console.warn('  运行: pnpm install @imgly/background-removal-node');
      console.warn(
        '  或者切换到快速模式: PROCESSING_MODE=fast pnpm run process-images\n',
      );

      // 询问是否继续使用快速模式
      const readline = await import('readline');
      const { createInterface } = readline.default || readline;
      const rl = createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      const answer = await new Promise<string>((resolve) => {
        rl.question('是否切换到快速模式继续处理？(y/n): ', resolve);
      });

      rl.close();

      if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
        console.log('已取消处理。');
        process.exit(0);
      }

      config.processingMode = 'fast';
      console.log('已切换到快速模式\n');
    }
  }

  // 确保输出目录存在
  await ensureOutputDir(config.outputDir);

  // 获取所有图片文件
  console.log('扫描图片文件...');
  const imageFiles = await getImageFiles(config.inputDir);

  if (imageFiles.length === 0) {
    console.log(`未找到图片文件。请在 ${config.inputDir} 目录中放入图片文件。`);
    process.exit(0);
  }

  console.log(`找到 ${imageFiles.length} 张图片\n`);
  console.log('开始处理...\n');

  // 处理统计
  let successCount = 0;
  let failCount = 0;
  const startTime = Date.now();

  // 批量处理
  for (let i = 0; i < imageFiles.length; i++) {
    try {
      await processSingleImage(imageFiles[i], config, i, imageFiles.length);
      successCount++;
    } catch (error) {
      failCount++;
      // 继续处理下一张图片
    }
  }

  // 输出统计信息
  const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
  const avgTime = (parseFloat(totalTime) / imageFiles.length).toFixed(2);

  console.log('\n=== 处理完成 ===');
  console.log(`总数量: ${imageFiles.length}`);
  console.log(`成功: ${successCount}`);
  console.log(`失败: ${failCount}`);
  console.log(`总耗时: ${totalTime}秒`);
  console.log(`平均耗时: ${avgTime}秒/张`);
  console.log(`输出目录: ${config.outputDir}`);
}

// 运行主函数
main().catch((error) => {
  console.error('\n处理失败:');
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
