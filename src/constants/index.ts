/**
 * 常量定义文件
 * 统一管理所有魔法数字和字符串
 */

/**
 * TagCanvas 配置常量
 */
export const TAG_CANVAS_CONFIG = {
  /** 正常速度 */
  NORMAL_SPEED: [0.07, 0] as [number, number],
  /** 抽奖速度 */
  DRAW_SPEED: [5, 0] as [number, number],
  /** 文本颜色 */
  TEXT_COLOR: '#fedaa1',
  /** 文本高度 */
  TEXT_HEIGHT: 12,
  /** 图片内边距 */
  IMAGE_PADDING: 5,
  /** 深度 */
  DEPTH: 0.8,
  /** X轴半径 */
  RADIUS_X: 1.2,
  /** Y轴半径 */
  RADIUS_Y: 0.75,
  /** Z轴半径 */
  RADIUS_Z: 1.2,
  /** Y轴偏移 */
  OFFSET_Y: -80,
  /** 最小亮度 */
  MIN_BRIGHTNESS: 0.01,
  /** Canvas ID */
  CANVAS_ID: 'rootcanvas',
  /** Tags 容器 ID */
  TAGS_ID: 'tags',
  /** Canvas 顶部偏移 */
  CANVAS_TOP_OFFSET: '-20px'
} as const;

/**
 * 字体大小配置
 */
export const FONT_SIZE_CONFIG = {
  /** 默认字体大小 */
  DEFAULT: '30px',
  /** 小于100时的字体大小 */
  SMALL: '100px',
  /** 小于1000时的字体大小 */
  MEDIUM: '80px',
  /** 小于10000时的字体大小 */
  LARGE: '60px',
  /** 阈值 */
  THRESHOLD_100: 100,
  THRESHOLD_1000: 1000,
  THRESHOLD_10000: 10000
} as const;

/**
 * 初始化延迟时间（毫秒）
 */
export const INIT_DELAY = {
  /** TagCanvas 初始化延迟 */
  TAG_CANVAS: 300,
  /** 重试延迟 */
  RETRY: 500,
  /** Reload 失败后重试延迟 */
  RELOAD_RETRY: 100
} as const;

/**
 * 抽奖模式值
 */
export const LOTTERY_MODE = {
  /** 抽取剩余人数 */
  REMAIN: 0,
  /** 抽取1人 */
  ONE: 1,
  /** 抽取5人 */
  FIVE: 5,
  /** 自定义数量 */
  CUSTOM: 99
} as const;

/**
 * 默认配置值
 */
export const DEFAULT_CONFIG = {
  /** 默认奖项 */
  DEFAULT_CATEGORY: 'luckyFirst',
  /** 默认数量 */
  DEFAULT_QTY: 1,
  /** 默认模式 */
  DEFAULT_MODE: 0,
  /** 默认排除已中奖 */
  DEFAULT_ALLIN: false
} as const;

/**
 * 音频配置常量
 */
export const AUDIO_CONFIG = {
  /** 默认音量 */
  DEFAULT_VOLUME: 50,
  /** 默认静音状态 */
  DEFAULT_MUTED: true,
  /** localStorage 存储键名 - 静音状态 */
  STORAGE_KEY_MUTED: 'audioMuted',
  /** localStorage 存储键名 - 音量值 */
  STORAGE_KEY_VOLUME: 'audioVolume'
} as const;
