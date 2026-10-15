/**
 * 图片处理配置文件
 *
 * 配置项说明：
 * - processingMode: 处理模式 ('fast' | 'ai')
 *   - fast: 快速模式，基于颜色阈值抠图，速度快（<1秒/张），无需额外依赖
 *   - ai: AI增强模式，使用AI精确抠图，效果好但慢（3-20秒/张），需要安装 @imgly/background-removal-node
 * - targetSize: 目标尺寸（宽x高，像素）
 * - outputFormat: 输出格式 ('jpg' | 'png')
 * - backgroundColor: 背景色（支持 hex、rgb、rgba 格式）
 * - inputDir: 输入目录（相对于项目根目录）
 * - outputDir: 输出目录（相对于项目根目录）
 * - quality: JPG 质量（1-100，仅当 outputFormat 为 'jpg' 时生效）
 * - cropMode: 裁剪模式 ('center' | 'smart')
 *   - center: 中心裁剪
 *   - smart: 智能裁剪（尝试检测主体位置）
 */

export interface ImageProcessorConfig {
  /** 处理模式 */
  processingMode: 'fast' | 'ai';
  /** 目标尺寸（宽x高，像素） */
  targetSize: {
    width: number;
    height: number;
  };
  /** 输出格式 */
  outputFormat: 'jpg' | 'png';
  /** 背景色（hex 格式，如 '#FFFFFF'） */
  backgroundColor: string;
  /** 输入目录 */
  inputDir: string;
  /** 输出目录 */
  outputDir: string;
  /** JPG 质量（1-100） */
  quality: number;
  /** 裁剪模式 */
  cropMode: 'center' | 'smart';
}

export const defaultConfig: ImageProcessorConfig = {
  processingMode: 'ai',
  targetSize: {
    width: 160,
    height: 160,
  },
  outputFormat: 'jpg',
  backgroundColor: '#962520',
  inputDir: 'scripts/input',
  outputDir: 'scripts/output',
  quality: 100,
  cropMode: 'smart',
};
