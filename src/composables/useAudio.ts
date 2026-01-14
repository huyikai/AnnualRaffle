/**
 * 音频管理 Composable
 * 封装音频播放、静音控制、音量控制等功能
 * 使用单例模式，确保所有调用共享同一个音频实例
 */

import { ref } from 'vue';
import { getData, setData, audioMutedField, audioVolumeField } from '@/helper/index';

import beginSoundUrl from '@/assets/begin.mp3';
import bgMusicUrl from '@/assets/bg.mp3';

// 模块级别的共享状态和实例（单例模式）
const isMuted = ref(true); // 默认静音
const volume = ref(50); // 默认音量 50
const audioEnabled = ref(false); // 音频是否已启用（处理浏览器自动播放策略）

// 音频实例（模块级别，所有调用共享）
let bgMusicAudio: HTMLAudioElement | null = null;
let beginSoundAudio: HTMLAudioElement | null = null;

/**
 * 初始化音频实例
 */
const initAudio = () => {
  if (bgMusicAudio && beginSoundAudio) {
    return; // 已经初始化
  }

  // 初始化背景音乐
  bgMusicAudio = new Audio(bgMusicUrl);
  bgMusicAudio.loop = true;
  bgMusicAudio.volume = volume.value / 100;
  bgMusicAudio.muted = isMuted.value;

  // 初始化开始音效
  beginSoundAudio = new Audio(beginSoundUrl);
  beginSoundAudio.volume = volume.value / 100;
  beginSoundAudio.muted = isMuted.value;

  // 处理音频加载错误
  bgMusicAudio.addEventListener('error', (e) => {
    console.error('背景音乐加载失败:', e);
  });

  beginSoundAudio.addEventListener('error', (e) => {
    console.error('开始音效加载失败:', e);
  });
};

/**
 * 从 localStorage 加载音频设置
 */
const loadAudioSettings = () => {
  try {
    const savedMuted = getData(audioMutedField);
    if (savedMuted !== null) {
      isMuted.value = savedMuted === true || savedMuted === 'true';
    }

    const savedVolume = getData(audioVolumeField);
    if (savedVolume !== null) {
      const vol = typeof savedVolume === 'number' ? savedVolume : Number(savedVolume);
      if (!isNaN(vol) && vol >= 0 && vol <= 100) {
        volume.value = vol;
      }
    }
  } catch (error) {
    console.error('加载音频设置失败:', error);
  }
};

/**
 * 保存音频设置到 localStorage
 */
const saveAudioSettings = () => {
  try {
    setData(audioMutedField, isMuted.value);
    setData(audioVolumeField, volume.value);
  } catch (error) {
    console.error('保存音频设置失败:', error);
  }
};

/**
 * 使用音频功能的组合式函数
 * 所有调用都共享同一个音频实例和状态（单例模式）
 */
export function useAudio() {
  /**
   * 设置音量
   * @param vol 音量值 (0-100)
   */
  const setVolume = (vol: number) => {
    volume.value = Math.max(0, Math.min(100, vol));
    if (bgMusicAudio) {
      bgMusicAudio.volume = volume.value / 100;
    }
    if (beginSoundAudio) {
      beginSoundAudio.volume = volume.value / 100;
    }
    saveAudioSettings();
  };

  /**
   * 切换静音状态
   */
  const toggleMute = () => {
    isMuted.value = !isMuted.value;
    saveAudioSettings();

    if (bgMusicAudio) {
      bgMusicAudio.muted = isMuted.value;
    }
    if (beginSoundAudio) {
      beginSoundAudio.muted = isMuted.value;
    }

    // 如果取消静音且音频已启用，开始播放背景音乐
    if (!isMuted.value && audioEnabled.value && bgMusicAudio && bgMusicAudio.paused) {
      playBackgroundMusic();
    }
  };

  /**
   * 启用音频（处理浏览器自动播放策略）
   */
  const enableAudio = async () => {
    if (audioEnabled.value) {
      return;
    }

    initAudio();
    audioEnabled.value = true;

    // 如果未静音，开始播放背景音乐
    if (!isMuted.value && bgMusicAudio) {
      try {
        await bgMusicAudio.play();
      } catch (error) {
        console.error('自动播放背景音乐失败:', error);
        // 如果自动播放失败，保持静音状态
        if (!isMuted.value) {
          isMuted.value = true;
          saveAudioSettings();
        }
      }
    }
  };

  /**
   * 播放背景音乐（循环）
   */
  const playBackgroundMusic = async () => {
    if (!audioEnabled.value || isMuted.value) {
      return;
    }

    initAudio();
    if (bgMusicAudio) {
      try {
        await bgMusicAudio.play();
      } catch (error) {
        console.error('播放背景音乐失败:', error);
      }
    }
  };

  /**
   * 停止背景音乐
   */
  const stopBackgroundMusic = () => {
    if (bgMusicAudio) {
      bgMusicAudio.pause();
      bgMusicAudio.currentTime = 0;
    }
  };

  /**
   * 播放开始音效
   */
  const playBeginSound = async () => {
    if (!audioEnabled.value || isMuted.value) {
      return;
    }

    initAudio();
    if (beginSoundAudio) {
      try {
        // 重置到开头，确保每次都能播放
        beginSoundAudio.currentTime = 0;
        await beginSoundAudio.play();
      } catch (error) {
        console.error('播放开始音效失败:', error);
      }
    }
  };

  /**
   * 初始化音频系统
   */
  const init = () => {
    loadAudioSettings();
    initAudio();

    // 设置初始音量
    if (bgMusicAudio) {
      bgMusicAudio.volume = volume.value / 100;
      bgMusicAudio.muted = isMuted.value;
    }
    if (beginSoundAudio) {
      beginSoundAudio.volume = volume.value / 100;
      beginSoundAudio.muted = isMuted.value;
    }
  };

  /**
   * 清理资源（注意：由于是单例模式，通常不应该在组件卸载时清理）
   */
  const cleanup = () => {
    if (bgMusicAudio) {
      bgMusicAudio.pause();
      bgMusicAudio.currentTime = 0;
      // 不设置为 null，因为其他组件可能还在使用
    }
    if (beginSoundAudio) {
      beginSoundAudio.pause();
      beginSoundAudio.currentTime = 0;
      // 不设置为 null，因为其他组件可能还在使用
    }
  };

  return {
    isMuted,
    volume,
    audioEnabled,
    init,
    enableAudio,
    toggleMute,
    setVolume,
    playBeginSound,
    playBackgroundMusic,
    stopBackgroundMusic,
    cleanup
  };
}

// 自动加载设置，确保刷新后设置能正确恢复
loadAudioSettings();