import { createRouter, createWebHashHistory } from 'vue-router';
import Home from '../views/Home.vue';
import People from '../views/people/People.vue';
import Settings from '../views/Settings.vue';

/**
 * 统一使用 hash 路由：
 *   - Tauri 从 tauri://localhost 加载，history 模式的深链会 404
 *   - GitHub Pages 没有 404.html fallback，history 模式同样会 404
 * hash 模式两端都免配置，代价只是 URL 里多个 #。
 */
const routes = [
  { path: '/', name: 'home', component: Home },
  { path: '/people', name: 'people', component: People },
  { path: '/settings', name: 'settings', component: Settings },
];

const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

export default router;
