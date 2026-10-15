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
  CANVAS_TOP_OFFSET: '-20px',
} as const;

/**
 * 结果卡字号分档
 *
 * 命名方向：人数越少，结果卡上的字需要越大。
 * 旧版把这四档命名为 SMALL/MEDIUM/LARGE/DEFAULT，与实际取值方向相反
 * （`SMALL: '100px'` 其实是最大值），是明确的维护陷阱，已重命名。
 *
 * 尺寸一律用数字，使用处自行拼 `px`——常量用了 `as const`，
 * 若存字符串会把字面量类型锁死，后续做 min() 计算会报类型错误。
 */
export const FONT_SIZE_CONFIG = {
  /** 人数 ≤ XTRA_LARGE_POOL 时的字号上限 */
  XTRA_LARGE: 100,
  /** 人数 ≤ MEDIUM_POOL 时 */
  LARGE: 80,
  /** 人数超过 MEDIUM_POOL 时 */
  MEDIUM: 60,
  /** 人数档位阈值 */
  XTRA_LARGE_POOL: 100,
  MEDIUM_POOL: 1000,
  LARGE_POOL: 10000,
  /**
   * 视口系数：1280px 宽时上限 48px，按宽度等比放大。
   * 与人数档位取 min —— 只看任一因子都会在另一种极端下失效。
   */
  VIEWPORT_BASE: 48,
  /** 字号下限，防止窄窗口下不可读 */
  MIN_PX: 28,
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
  RELOAD_RETRY: 100,
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
  CUSTOM: 99,
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
  /** 默认全局排除已中奖人员 */
  DEFAULT_EXCLUDE_WINNERS: true,
} as const;

/**
 * 抽奖时机配置（防抖/防连击）
 */
export const LOTTERY_TIMING = {
  /** 最小抽奖运行时长（毫秒），防止误触立即停止 */
  MIN_DRAW_DURATION: 1000,
  /** 按钮点击节流间隔（毫秒），防止双击 */
  BUTTON_THROTTLE: 300,
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
  STORAGE_KEY_VOLUME: 'audioVolume',
} as const;
