import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath, URL } from 'node:url';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Tauri CLI 在执行 beforeBuildCommand 时会注入 TAURI_ENV_PLATFORM；
  // 手动用 `vite build --mode tauri` 时也能命中。
  // 两者的产物挂载点不同：Tauri 从 tauri://localhost 加载资源，必须用相对路径，
  // 否则会解析成 http://localhost/xxx 而 404（表现为白屏）。
  const isTauri = mode === 'tauri' || !!process.env.TAURI_ENV_PLATFORM;

  return {
    plugins: [vue()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    base: isTauri ? './' : mode === 'production' ? '/AnnualRaffle' : '/',
    server: {
      // 5173 容易被本机其他项目的 dev server 占用，导致 e2e 打到错误的应用
      port: 5188,
      strictPort: true,
    },
    build: {
      target: 'es2022', // 支持 top-level await
    },
  };
});
