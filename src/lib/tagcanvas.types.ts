/**
 * TagCanvas TypeScript 类型定义
 * 为 tagcanvas.js 转换提供完整的类型支持
 */

/**
 * 3D 向量接口
 */
export interface Vector3 {
  x: number;
  y: number;
  z: number;
  length(): number;
  dot(v: Vector3): number;
  cross(v: Vector3): Vector3;
  angle(v: Vector3): number;
  unit(): Vector3;
}

/**
 * 3x3 矩阵接口
 */
export interface Matrix {
  [1]: { [1]: number; [2]: number; [3]: number };
  [2]: { [1]: number; [2]: number; [3]: number };
  [3]: { [1]: number; [2]: number; [3]: number };
  mul(m: Matrix | number): Matrix;
  xform(v: Vector3): Vector3;
}

/**
 * TagCanvas 配置选项接口
 */
export interface TagCanvasOptions {
  z1?: number;
  z2?: number;
  z0?: number;
  freezeActive?: boolean;
  freezeDecel?: boolean;
  activeCursor?: string;
  pulsateTo?: number;
  pulsateTime?: number;
  reverse?: boolean;
  depth?: number;
  maxSpeed?: number;
  minSpeed?: number;
  decel?: number;
  interval?: number;
  minBrightness?: number;
  maxBrightness?: number;
  outlineColour?: string;
  outlineThickness?: number;
  outlineOffset?: number;
  outlineMethod?: string;
  outlineRadius?: number;
  textColour?: string;
  textHeight?: number;
  textFont?: string;
  shadow?: string;
  shadowBlur?: number;
  shadowOffset?: [number, number];
  initial?: [number, number] | null;
  hideTags?: boolean;
  zoom?: number;
  weight?: boolean;
  weightMode?: string;
  weightFrom?: string | null;
  weightSize?: number;
  weightSizeMin?: number | null;
  weightSizeMax?: number | null;
  weightGradient?: Record<number | string, string>;
  txtOpt?: boolean;
  txtScale?: number;
  frontSelect?: boolean;
  wheelZoom?: boolean;
  zoomMin?: number;
  zoomMax?: number;
  zoomStep?: number;
  shape?: string;
  lock?: string | null;
  tooltip?: string | null;
  tooltipDelay?: number;
  tooltipClass?: string;
  radiusX?: number;
  radiusY?: number;
  radiusZ?: number;
  stretchX?: number;
  stretchY?: number;
  offsetX?: number;
  offsetY?: number;
  shuffleTags?: boolean;
  noSelect?: boolean;
  noMouse?: boolean;
  imageScale?: number;
  paused?: boolean;
  dragControl?: boolean;
  dragThreshold?: number;
  centreFunc?: (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    x: number,
    y: number,
  ) => void;
  splitWidth?: number;
  animTiming?: string;
  clickToFront?: boolean | null;
  fadeIn?: number;
  padding?: number;
  bgColour?: string | null;
  bgRadius?: number;
  bgOutline?: string | null;
  bgOutlineThickness?: number;
  outlineIncrease?: number;
  textAlign?: string;
  textVAlign?: string;
  imageMode?: string | null;
  imagePosition?: string | null;
  imagePadding?: number;
  imageAlign?: string;
  imageVAlign?: string;
  noTagsMessage?: boolean;
  centreImage?: string | null;
  pinchZoom?: boolean;
  repeatTags?: number;
  minTags?: number;
  imageRadius?: number;
  scrollPause?: number;
  outlineDash?: number;
  outlineDashSpace?: number;
  outlineDashSpeed?: number;
}

/**
 * TagCanvas 实例接口
 */
export interface TagCanvasInstance {
  canvas: HTMLCanvasElement;
  ctxt: CanvasRenderingContext2D;
  Start: (
    canvasId: string,
    tagsId: string,
    options?: Partial<TagCanvasOptions>,
  ) => void;
  Reload: (canvasId: string) => void;
  SetSpeed: (canvasId: string, speed: [number, number]) => boolean;
  Delete: (canvasId: string) => void;
  Pause: (canvasId: string) => void;
  Resume: (canvasId: string) => void;
  Update: (canvasId: string) => void;
  TagToFront: (canvasId: string, tag: any) => boolean;
  RotateTag: (canvasId: string, tag: any) => boolean;
  tc: Record<string, any>;
  options: TagCanvasOptions;
  loaded?: number;
  started?: number;
  scrollTimer?: number;
  scrollPause?: number;
  NextFrame?: (interval: number) => void;
  NextFrameRAF?: () => void;
  NextFrameTimeout?: (interval: number) => void;
  Linear?: (t: number, d: number) => number;
  Smooth?: (t: number, d: number) => number;
}

/**
 * Tag 元素接口
 */
export interface TagElement {
  a: HTMLAnchorElement;
  href?: string;
  target?: string;
  title?: string;
  innerText?: string;
  textContent?: string;
  getElementsByTagName?: (tag: string) => HTMLCollectionOf<HTMLElement>;
}

/**
 * 位置坐标接口
 */
export interface Position {
  x: number;
  y: number;
}

/**
 * 图像尺寸接口
 */
export interface ImageSize {
  image: HTMLCanvasElement;
  width: number;
  height: number;
}
