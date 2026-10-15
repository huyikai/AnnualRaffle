/**
 * 音频管理 Composable
 *
 * 变化点（相对旧版）：
 *   - BGM 与音效音量分开。年会上音效要盖过音乐，音乐要压过人声，
 *     合成一个音量条的结果只能是两头都不对
 *   - BGM 与音效都支持上传替换
 *   - 设置从 4 个散落的 localStorage 键收敛为一个 audio 对象
 */

import { ref, computed } from 'vue';
import { getData, setData } from '@/helper/index';
import { customAudioUrl } from '@/data/audio';

import beginSoundUrl from '@/assets/begin.mp3';
import bgMusicUrl from '@/assets/bg.mp3';

// ---------- 持久化 ----------

export const audioField = 'audio';

interface StoredAudio {
  muted: boolean;
  /** 兼容旧版的单一音量字段 */
  volume?: number;
  bgmVolume: number;
  sfxVolume: number;
  /** 自定义音频文件名；空表示用内置 */
  customBgm?: string;
  customSfx?: string;
}

// 模块级别的共享状态和实例（单例）
const isMuted = ref(true);
const bgmVolume = ref(50);
const sfxVolume = ref(50);
const audioEnabled = ref(false);
const customBgm = ref('');
const customSfx = ref('');

let bgMusicAudio: HTMLAudioElement | null = null;
let beginSoundAudio: HTMLAudioElement | null = null;

function clampVolume(value: unknown, fallback: number): number {
  const num = typeof value === 'number' ? value : Number(value);
  if (Number.isNaN(num)) return fallback;
  return Math.max(0, Math.min(100, num));
}

/**
 * 从 localStorage 恢复音频设置。
 *
 * 需要兼容旧版遗留的两个键（audioMuted / audioVolume）——
 * 旧版只有一个音量，迁移时同时赋给 BGM 与音效，避免升级后音量突然跳变。
 */
const loadAudioSettings = () => {
  try {
    const legacyMuted = getData('audioMuted');
    const legacyVolume = getData('audioVolume');

    const stored = getData(audioField) as StoredAudio | null;
    if (stored && typeof stored === 'object') {
      isMuted.value = stored.muted ?? true;
      const legacy = clampVolume(legacyVolume, 50);
      bgmVolume.value = clampVolume(stored.bgmVolume, legacy);
      sfxVolume.value = clampVolume(stored.sfxVolume, legacy);
      customBgm.value = stored.customBgm ?? '';
      customSfx.value = stored.customSfx ?? '';
      return;
    }

    // 首次迁移：旧键 → 新结构
    if (legacyMuted !== null)
      isMuted.value = legacyMuted === true || legacyMuted === 'true';
    if (legacyVolume !== null) {
      const vol = clampVolume(legacyVolume, 50);
      bgmVolume.value = vol;
      sfxVolume.value = vol;
    }
  } catch (error) {
    console.error('加载音频设置失败:', error);
  }
};

const saveAudioSettings = () => {
  try {
    const payload: StoredAudio = {
      muted: isMuted.value,
      bgmVolume: bgmVolume.value,
      sfxVolume: sfxVolume.value,
      customBgm: customBgm.value || undefined,
      customSfx: customSfx.value || undefined,
    };
    setData(audioField, payload);
  } catch (error) {
    console.error('保存音频设置失败:', error);
  }
};

// ---------- 实例 ----------

const bgmSourceUrl = () =>
  customBgm.value ? customAudioUrl(customBgm.value) : bgMusicUrl;

const sfxSourceUrl = () =>
  customSfx.value ? customAudioUrl(customSfx.value) : beginSoundUrl;

const applyVolumes = () => {
  if (bgMusicAudio) bgMusicAudio.volume = bgmVolume.value / 100;
  if (beginSoundAudio) beginSoundAudio.volume = sfxVolume.value / 100;
  if (bgMusicAudio) bgMusicAudio.muted = isMuted.value;
  if (beginSoundAudio) beginSoundAudio.muted = isMuted.value;
};

/**
 * 自定义音频加载失败时静默回退到内置资源，避免年会现场突然没声音。
 *
 * 挂在 initAudio 而不是 init：init 全项目没有调用点，挂在 init 等于没挂。
 *
 * 用元素上的标记而不是 { once: true }，是为了同时兼顾两件事：
 *   - 内置资源自己加载失败时不再递归回退，否则会陷入「加载→失败→回退」死循环
 *   - 之后用户再换一份自定义音频，失败时依然有保护（once 会在第一次用掉后消失）
 *
 * 这里刻意不比较 audio.src：HTMLMediaElement.src 返回的是解析后的绝对 URL，
 * 跟这里传入的相对/构建期路径永远不相等，拿它做判断会误判成「不是内置资源」。
 */
const attachFallback = (
  audio: HTMLAudioElement,
  builtinUrl: string,
  label: string,
) => {
  audio.addEventListener('error', () => {
    if (audio.dataset.fallbackApplied === '1') return;
    audio.dataset.fallbackApplied = '1';
    console.warn(`[audio] ${label}加载失败，已回退到内置资源`);
    audio.src = builtinUrl;
  });
};

/** 换上一份新的自定义音频时，把回退保护重新装上 */
const resetFallback = (audio: HTMLAudioElement | null) => {
  if (audio) delete audio.dataset.fallbackApplied;
};

const initAudio = () => {
  if (bgMusicAudio && beginSoundAudio) return;

  if (!bgMusicAudio) {
    bgMusicAudio = new Audio(bgmSourceUrl());
    bgMusicAudio.loop = true;
    attachFallback(bgMusicAudio, bgMusicUrl, '自定义背景音乐');
  }

  if (!beginSoundAudio) {
    beginSoundAudio = new Audio(sfxSourceUrl());
    attachFallback(beginSoundAudio, beginSoundUrl, '自定义音效');
  }

  applyVolumes();
};

const init = () => {
  initAudio();
  applyVolumes();
};

// ---------- 试听 ----------

/** BGM 试听时长；音效传 null 表示播完为止 */
const PREVIEW_BGM_MS = 5000;

let previewAudio: HTMLAudioElement | null = null;
let previewTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * 停止正在播放的试听。
 *
 * 单独暴露出来是为了让设置页在卸载时调用——试听是「一次性」音频，
 * 不随组件销毁而停止的话，离开设置页后音乐会继续在后台放。
 */
const stopPreview = () => {
  if (previewTimer) {
    clearTimeout(previewTimer);
    previewTimer = null;
  }
  if (previewAudio) {
    previewAudio.pause();
    previewAudio.currentTime = 0;
    previewAudio = null;
  }
};

/**
 * 播放一段试听。
 *
 * 复用同一个实例并先停掉上一个：连点「试听」不会叠出多份音乐。
 */
const playPreview = async (
  url: string,
  volume: number,
  autoStopMs: number | null,
) => {
  stopPreview();
  const audio = new Audio(url);
  audio.volume = volume;
  previewAudio = audio;

  const release = () => {
    if (previewAudio === audio) previewAudio = null;
  };

  if (autoStopMs === null) {
    audio.addEventListener('ended', release, { once: true });
  } else {
    previewTimer = setTimeout(() => {
      previewTimer = null;
      stopPreview();
    }, autoStopMs);
  }

  try {
    await audio.play();
  } catch (error) {
    console.error('试听失败:', error);
    release();
  }
};

const playBackgroundMusic = async () => {
  if (!audioEnabled.value || isMuted.value) return;
  initAudio();
  if (!bgMusicAudio) return;
  try {
    await bgMusicAudio.play();
  } catch (error) {
    console.error('播放背景音乐失败:', error);
  }
};

const stopBackgroundMusic = () => {
  if (bgMusicAudio) {
    bgMusicAudio.pause();
    bgMusicAudio.currentTime = 0;
  }
};

const enableAudio = async () => {
  if (audioEnabled.value) return;
  initAudio();
  audioEnabled.value = true;
  if (!isMuted.value && bgMusicAudio) {
    try {
      await bgMusicAudio.play();
    } catch {
      // 自动播放被拦截时退回静音，避免用户以为应用坏了
      isMuted.value = true;
      saveAudioSettings();
    }
  }
};

/**
 * 使用音频功能的组合式函数（单例）
 */
export function useAudio() {
  const setBgmVolume = (vol: number) => {
    bgmVolume.value = clampVolume(vol, 50);
    if (bgMusicAudio) bgMusicAudio.volume = bgmVolume.value / 100;
    saveAudioSettings();
  };

  const setSfxVolume = (vol: number) => {
    sfxVolume.value = clampVolume(vol, 50);
    if (beginSoundAudio) beginSoundAudio.volume = sfxVolume.value / 100;
    saveAudioSettings();
  };

  /** 兼容旧调用点：同时调整两路音量 */
  const setVolume = (vol: number) => {
    setBgmVolume(vol);
    setSfxVolume(vol);
  };

  const toggleMute = () => {
    isMuted.value = !isMuted.value;
    saveAudioSettings();
    if (bgMusicAudio) bgMusicAudio.muted = isMuted.value;
    if (beginSoundAudio) beginSoundAudio.muted = isMuted.value;

    if (!isMuted.value && audioEnabled.value && bgMusicAudio?.paused) {
      void playBackgroundMusic();
    }
  };

  const playBeginSound = async () => {
    if (!audioEnabled.value || isMuted.value) return;
    initAudio();
    if (!beginSoundAudio) return;
    try {
      beginSoundAudio.currentTime = 0;
      await beginSoundAudio.play();
    } catch (error) {
      console.error('播放开始音效失败:', error);
    }
  };

  /** 替换自定义 BGM；传空串表示恢复内置 */
  const setCustomBgm = async (fileName: string) => {
    customBgm.value = fileName;
    saveAudioSettings();
    if (bgMusicAudio) {
      const wasPlaying = !bgMusicAudio.paused;
      resetFallback(bgMusicAudio);
      bgMusicAudio.src = bgmSourceUrl();
      bgMusicAudio.load();
      if (wasPlaying) void playBackgroundMusic();
    } else {
      initAudio();
    }
  };

  /** 替换自定义音效；传空串表示恢复内置 */
  const setCustomSfx = async (fileName: string) => {
    customSfx.value = fileName;
    saveAudioSettings();
    if (beginSoundAudio) {
      resetFallback(beginSoundAudio);
      beginSoundAudio.src = sfxSourceUrl();
      beginSoundAudio.load();
    }
  };

  /** 试听当前 BGM（设置页用，不受静音状态影响） */
  const previewBgm = () =>
    playPreview(bgmSourceUrl(), bgmVolume.value / 100, PREVIEW_BGM_MS);

  /** 试听当前音效 */
  const previewSfx = () =>
    playPreview(sfxSourceUrl(), sfxVolume.value / 100, null);

  const cleanup = () => {
    stopPreview();
    stopBackgroundMusic();
    if (beginSoundAudio) {
      beginSoundAudio.pause();
      beginSoundAudio.currentTime = 0;
    }
  };

  return {
    isMuted,
    volume: computed(() => bgmVolume.value),
    bgmVolume,
    sfxVolume,
    audioEnabled,
    customBgm,
    customSfx,
    init,
    enableAudio,
    toggleMute,
    setVolume,
    setBgmVolume,
    setSfxVolume,
    setCustomBgm,
    setCustomSfx,
    previewBgm,
    previewSfx,
    stopPreview,
    playBeginSound,
    playBackgroundMusic,
    stopBackgroundMusic,
    cleanup,
  };
}

// 自动加载设置，确保刷新后设置能正确恢复
loadAudioSettings();
