declare global {
  interface Window {
    TagCanvas: {
      Start: (
        canvasId: string,
        tagsId: string,
        options: {
          textColour?: string;
          initial?: number[];
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
      ) => void;
      Reload: (canvasId: string) => void;
      SetSpeed: (canvasId: string, speed: number[]) => void;
    };
  }
}

export {};

