/**
 * TagCanvas 管理 Composable
 * 封装 TagCanvas 的初始化、重载、速度控制等逻辑
 */

import { TAG_CANVAS_CONFIG, INIT_DELAY } from '@/constants';

/**
 * TagCanvas 配置选项
 */
export interface TagCanvasOptions {
  textColour?: string;
  initial?: [number, number];
  dragControl?: number;
  dragThreshold?: boolean;
  textHeight?: number;
  noSelect?: boolean;
  wheelZoom?: boolean;
  pinchZoom?: boolean;
  shuffleTags?: boolean;
  textVAlign?: string;
  imageVAlign?: string;
  imageAlign?: string;
  textAlign?: string;
  imageMode?: string;
  imagePosition?: string;
  imagePadding?: number;
  depth?: number;
  radiusX?: number;
  radiusY?: number;
  radiusZ?: number;
  offsetY?: number;
  minBrightness?: number;
  lock?: boolean;
}

/**
 * 使用 TagCanvas 的组合式函数
 */
export function useTagCanvas() {
  /**
   * 创建 Canvas 元素
   */
  const createCanvas = (): void => {
    const mainEl = document.querySelector('#main');
    if (!mainEl) {
      throw new Error('Main element not found');
    }
    
    const canvas = document.createElement('canvas');
    canvas.width = document.body.offsetWidth;
    canvas.height = document.body.offsetHeight;
    canvas.id = TAG_CANVAS_CONFIG.CANVAS_ID;
    canvas.style.position = 'absolute';
    canvas.style.top = TAG_CANVAS_CONFIG.CANVAS_TOP_OFFSET;
    canvas.style.left = '0';
    canvas.style.zIndex = '1';
    canvas.style.pointerEvents = 'none';
    mainEl.appendChild(canvas);
  };

  /**
   * 获取正常速度
   */
  const getNormalSpeed = (): [number, number] => {
    return TAG_CANVAS_CONFIG.NORMAL_SPEED;
  };

  /**
   * 启动 TagCanvas
   */
  const startTagCanvas = (): void => {
    try {
      const tagsEl = document.querySelector(`#${TAG_CANVAS_CONFIG.TAGS_ID}`);
      if (!tagsEl) {
        console.warn('Tags element not found, cannot initialize TagCanvas');
        return;
      }
      
      // 检查是否有数据
      const tagsList = tagsEl.querySelectorAll('ul');
      if (tagsList.length === 0) {
        console.warn('No tags data available, cannot initialize TagCanvas');
        return;
      }
      
      // 移除已存在的 canvas
      const existingCanvas = document.querySelector(`#${TAG_CANVAS_CONFIG.CANVAS_ID}`);
      if (existingCanvas && existingCanvas.parentElement) {
        existingCanvas.parentElement.removeChild(existingCanvas);
      }
      
      createCanvas();
      
      if (!window.TagCanvas) {
        console.error('TagCanvas library not loaded');
        return;
      }
      
      try {
        window.TagCanvas.Start(TAG_CANVAS_CONFIG.CANVAS_ID, TAG_CANVAS_CONFIG.TAGS_ID, {
          textColour: TAG_CANVAS_CONFIG.TEXT_COLOR,
          initial: getNormalSpeed(),
          dragControl: 1,
          dragThreshold: false,
          textHeight: TAG_CANVAS_CONFIG.TEXT_HEIGHT,
          noSelect: true,
          wheelZoom: false,
          pinchZoom: false,
          shuffleTags: true,
          textVAlign: 'middle',
          imageVAlign: 'middle',
          imageAlign: 'centre',
          textAlign: 'centre',
          imageMode: 'both',
          imagePosition: 'top',
          imagePadding: TAG_CANVAS_CONFIG.IMAGE_PADDING,
          depth: TAG_CANVAS_CONFIG.DEPTH,
          radiusX: TAG_CANVAS_CONFIG.RADIUS_X,
          radiusY: TAG_CANVAS_CONFIG.RADIUS_Y,
          radiusZ: TAG_CANVAS_CONFIG.RADIUS_Z,
          offsetY: TAG_CANVAS_CONFIG.OFFSET_Y,
          minBrightness: TAG_CANVAS_CONFIG.MIN_BRIGHTNESS,
          lock: true
        });
      } catch (error) {
        console.error('TagCanvas initialization error:', error);
        throw error;
      }
    } catch (error) {
      console.error('Failed to start TagCanvas:', error);
    }
  };

  /**
   * 重载 TagCanvas
   */
  const reloadTagCanvas = (): void => {
    if (!window.TagCanvas) {
      console.warn('TagCanvas library not loaded, cannot reload');
      return;
    }
    
    try {
      window.TagCanvas.Reload(TAG_CANVAS_CONFIG.CANVAS_ID);
    } catch (error) {
      console.error('TagCanvas reload error:', error);
      // 如果 reload 失败，重新初始化
      setTimeout(() => {
        try {
          startTagCanvas();
        } catch (initError) {
          console.error('Failed to reinitialize TagCanvas after reload error:', initError);
        }
      }, INIT_DELAY.RELOAD_RETRY);
    }
  };

  /**
   * 设置 TagCanvas 速度
   */
  const setSpeed = (speed: [number, number]): void => {
    if (!window.TagCanvas) {
      console.warn('TagCanvas library not loaded, cannot set speed');
      return;
    }
    
    try {
      window.TagCanvas.SetSpeed(TAG_CANVAS_CONFIG.CANVAS_ID, speed);
    } catch (error) {
      console.error('Failed to set TagCanvas speed:', error);
    }
  };

  /**
   * 处理窗口大小变化
   */
  const handleResize = (): void => {
    const AppCanvas = document.querySelector(`#${TAG_CANVAS_CONFIG.CANVAS_ID}`);
    if (AppCanvas && AppCanvas.parentElement) {
      AppCanvas.parentElement.removeChild(AppCanvas);
    }
    startTagCanvas();
  };

  /**
   * 初始化 TagCanvas（带延迟和重试逻辑）
   */
  const initTagCanvas = (checkData: () => boolean, delay: number = INIT_DELAY.TAG_CANVAS): void => {
    const init = () => {
      if (checkData()) {
        startTagCanvas();
      } else {
        // 如果数据还没加载，再等待一下
        setTimeout(() => {
          if (checkData()) {
            startTagCanvas();
          }
        }, INIT_DELAY.RETRY);
      }
    };
    
    setTimeout(init, delay);
  };

  return {
    startTagCanvas,
    reloadTagCanvas,
    setSpeed,
    handleResize,
    initTagCanvas,
    getNormalSpeed
  };
}
