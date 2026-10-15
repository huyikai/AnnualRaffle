# 设计规范 · 年会抽奖桌面客户端

> 配套文档：[`desktop-tauri-plan.md`](./desktop-tauri-plan.md)
> 方法论来源：`design-taste-frontend` skill，按其 Section 11 Redesign Protocol 执行。

---

## 〇、适用范围声明

该 skill 第 11 行划定了边界：

> Landing pages, portfolios, and redesigns. **Not dashboards, not data tables, not multi-step product UI.**

本项目新建的人员管理表格、导入预检、设置页**正好落在它排除的范围内**。因此以下规则**明确不采用**：

- 英雄区 / 滚动动画 / Testimonials / Bento 栅格 / eyebrow 克制（Section 4.3、4.7、4.10、5.A–5.C）
- React / RSC / Next.js / Tailwind v4 / Motion 库（Section 3.A）——项目是 Vue 3 + Element Plus + Tailwind v3，动效由 CSS transition 与 TagCanvas 自身 rAF 驱动
- Section 3.C 图标库优先级——项目已绑定 Element Plus 图标，不为视觉统一引入第二套图标库

**实际采用的**：Section 4.2 色彩一致锁、4.4 形状一致锁、4.5 交互态完整循环、4.8 视觉资产策略、4.11 主题锁（附理由偏离）、6.B 减弱动效、6.F z-index 克制、9.A AI 痕迹清单、11.B 改造前审计。

---

## 一、Design Read 与三档旋钮

**Design Read**：*Reading this as: 年会现场投屏的抽奖舞台 + 后台人员管理控制台，面向非技术行政人员，强调仪式感与大屏可读性，延续既有深红金年会品牌，走 Element Plus 组件体系 + 自建 token 层。*

| 旋钮 | 值 | 理由 |
|---|---|---|
| `DESIGN_VARIANCE` | 4 | 工具不是作品。管理界面纯效率优先；**舞台**是唯一允许走高的地方（背景、3D 球云、结果卡） |
| `MOTION_INTENSITY` | 5 | 3D 球云旋转与结果入场是产品核心，不能砍；其余一律克制 |
| `VISUAL_DENSITY` | 6 | 数据密集型工具。人员表、预检表都是高密度信息面 |

**模式判定**：Section 11.A → **Redesign - Preserve**。现有深红金品牌成立，改造的是数据层与界面覆盖范围，不换视觉语言。

---

## 二、现状审计（Section 11.B）

### 2.1 品牌 token

| 现状 | 取值 | 问题 |
|---|---|---|
| 舞台底色 | `#5E0F08` | 与下条**语义相同但取值不同** |
| 下拉/工具底色 | `#5b1411` | 与 `#5E0F08` 仅差 2 个色阶，实为同一表面 |
| 强调金 | `#E1A857` `#b08031` `#d9a964` `#ebc68b` `#fedaa1` `#8a5408` `#572904` | **7 个金**，无层级定义 |
| Element Plus 浅灰 | `#f5f7fa` `#ebeef5` `#e4e7ed` `#303133` `#909399` `#c0c4cc` | 整包搬运，**未主题化** |

全项目 **76 处** 裸 hex / z-index / border-radius，散落在 9 个文件，无 token 层。

### 2.2 主题分裂（Section 4.11 违规）

`App.vue` 舞台是深红底，`LotteryConfig.vue` 弹窗是 `#f5f7fa` 浅灰底。用户在两个界面间切换时**主题没有共同祖先**——这正是 4.11 所说的「感觉换了个网站」。

### 2.3 z-index 失控（Section 6.F 违规）

现存：`z-[9999]`、`z-index: 10000`、`10001`（两处）、`10100`、`10200`、`11000`。

配套的 `!important` 覆写共 **6 处**（层级 hack，非防御性重置）：

| 位置 | 内容 |
|---|---|
| `index.css:37` | `.el-overlay.is-message-box { z-index: 11000 !important }` |
| `App.vue:352-362` | `:deep(.el-select-dropdown)` 四条颜色覆写 |
| `Tool.vue:344` | `:deep(.tool-select-dropdown) { z-index: 10001 !important }` |
| `LotteryConfig.vue:621` | `.exclude-mode-popper { z-index: 10200 !important }` |

> 注：`index.css` 另有 **20 处** `!important`（`html`/`body`/`#app` 的 `margin/padding/width/height/overflow` 各 5 个），属于防御性全局重置，**不在本次清理范围**（见 3.6）。

### 2.4 圆角无规则（Section 4.4 违规）

`4px`（Element Plus 默认）、`6px`（奖项卡）、`8px`（自定义排除区）、`rounded-lg`（结果卡）、`rounded-full`（头像）。无成文规则。

### 2.5 动效

| 位置 | 动画 | 问题 |
|---|---|---|
| `App.vue:326` | `bounce-in 1.5s` | 合理，保留 |
| `Tool.vue:358` | `preset-alert-pulse 1.6s **infinite**` | **无限循环**，Skill 5.D 明令禁止；投屏时持续闪烁扎眼 |
| `Tool.vue:357` | `box-shadow: 0 0 6px rgba(245,108,108,0.8)` | **霓虹外发光**，Skill 9.A 明令禁止；与上一行同属 `.preset-alert-dot`，一并整改 |
| 全局 | — | **无任何 `prefers-reduced-motion`** |

### 2.6 其他

- `constants/index.ts` 的 `FONT_SIZE_CONFIG` **命名与取值相反**：`SMALL: '100px'` 实际是最大值（人数少→字大）。逻辑对，命名是维护陷阱。
- 启动期无加载态：`onMounted` 同步读存储 + `initTagCanvas` 延迟 300ms。200 人带照片初始化时**白屏**。
- `index.css` 全局 `* { margin: 0; padding: 0 }` + `html/body/#app` 强制 `overflow: hidden`，这类全局重置在 Element Plus 下容易踩坑。

---

## 三、设计决策

### 3.1 双表面主题（对 4.11 的有理由偏离）

**决策**：舞台与管理界面**共用同一套 token 骨架**，但**各自定义表面色**。

**理由**：4.11 的「全页一个主题」是为**滚动式页面**写的——用户连续下滑，主题突变会被感知为断裂。桌面应用不同：舞台与管理之间是**显式导航**（点按钮切换），用户明确知道自己换了上下文。

**共享（不分裂）**：强调金、圆角刻度、间距节奏、z-index 刻度、字阶结构、阴影策略。
**分裂**：表面底色、文字色。

违规风险已用两点控制：管理界面**必须使用同一套金色强调色**，确保读起来是同一家族；切换点**只有导航这一处**。

### 3.2 Token 层

新建 `src/design/tokens.css`，Element Plus 通过其 CSS 变量（`--el-*`）接管，**无需 SCSS 编译**。

```css
:root {
  /* ---- 强调色（双表面共享，唯一强调色）---- */
  --ar-accent:        #E1A857;
  --ar-accent-hover:  #C08E3F;
  --ar-accent-press:  #8A5408;
  --ar-accent-soft:   #F0CE96;
  --ar-on-accent:     #2A0703;   /* 压在金色上，对比度 ≈ 8.6:1 */

  /* ---- 舞台（深色表面）---- */
  --ar-stage-bg:        #5E0F08;
  --ar-stage-bg-hover:  #8F2925;
  --ar-stage-overlay:   rgba(42, 7, 3, 0.72);
  --ar-on-stage:        #F0CE96;
  --ar-on-stage-muted:  #C9A87A;

  /* ---- 管理控制台（浅色表面）---- */
  --ar-bg:              #F5F7FA;
  --ar-surface:         #FFFFFF;
  --ar-surface-sunken:  #EBEEF5;
  --ar-border:          #E4E7ED;
  --ar-border-strong:   #D3D6DC;
  --ar-text:            #303133;
  --ar-text-regular:    #606266;
  --ar-text-secondary:  #909399;
  --ar-text-disabled:   #C0C4CC;

  /* ---- 语义色 ---- */
  --ar-danger:      #E23B32;
  --ar-danger-bg:   #FDEEEE;
  --ar-success:     #3E8E5A;
  --ar-warning:     #C88A2E;

  /* ---- 圆角（Section 4.4：单一刻度 + 成文规则）---- */
  --ar-radius-sm:   4px;    /* 输入框、标签、按钮 */
  --ar-radius-md:   8px;    /* 卡片、弹窗 */
  --ar-radius-lg:   12px;   /* 结果卡、大面板 */
  --ar-radius-full: 999px;  /* 头像 */

  /* ---- z-index（Section 6.F：严格分层，不写任意值）---- */
  --ar-z-base:          0;
  --ar-z-tagcloud:      1;
  --ar-z-header:        100;
  --ar-z-float:         500;
  --ar-z-dialog:        1000;
  --ar-z-popover:       1100;  /* select / popper */
  --ar-z-messagebox:    1200;
  --ar-z-toast:         1300;
  --ar-z-presentation:  2000;
}

/* Element Plus 接管：消除全部 !important 补丁 */
:root {
  --el-color-primary: var(--ar-accent);
  --el-color-primary-light-3: var(--ar-accent-hover);
  --el-color-primary-dark-2: var(--ar-accent-press);
  --el-border-color: var(--ar-border);
  --el-border-color-light: var(--ar-border);
  --el-text-color-primary: var(--ar-text);
  --el-text-color-regular: var(--ar-text-regular);
  --el-text-color-secondary: var(--ar-text-secondary);
  --el-bg-color: var(--ar-surface);
  --el-fill-color-light: var(--ar-bg);
  --el-border-radius-base: var(--ar-radius-sm);
}
```

**对照审计**：`#5b1411` 与 `#5E0F08` 合并为 `--ar-stage-bg`；7 个金归并为 4 阶 + 1 个前景色；`6px` 圆角归并为 `--ar-radius-md`。

**对比度校验**：`#2A0703` on `#E1A857` ≈ 8.6:1；`#F0CE96` on `#5E0F08` ≈ 8.75:1。均过 WCAG AAA。

### 3.3 大屏字阶

现状 `FONT_SIZE_CONFIG` 仅按人数分档，且命名与取值相反。改为**双因子**：视口尺寸 × 人数档位，取小值。

```css
--ar-display-1: clamp(48px,  6vw,  96px);  /* 结果标题 */
--ar-display-2: clamp(32px,  4vw,  64px);  /* 中奖人名 */
--ar-body-lg:   clamp(20px,  2.2vw, 32px); /* 标签云姓名 */
--ar-ui:        14px;                      /* 管理界面正文 */
```

人数档位降为**上限约束**而非唯一驱动：`人数 ≤ 20 → 不加约束；20–50 → ×0.85；> 50 → ×0.7`，再与 `clamp()` 取 `min()`。

**重命名** `FONT_SIZE_CONFIG` 消除命名陷阱：

| 旧名 | 新名 | 语义 |
|---|---|---|
| `SMALL: '100px'` | `XTRA_LARGE` | 人数最少时最大字号 |
| `MEDIUM: '80px'` | `LARGE` | |
| `LARGE: '60px'` | `MEDIUM` | |
| `DEFAULT: '30px'` | `BASE` | |

### 3.4 交互态完整循环（Section 4.5）

现状只有成功态。四个补充：

| 态 | 场景 | 处理 |
|---|---|---|
| **启动加载** | 首次启动 200 人 + 照片初始化 | 当前是白屏。加启动加载层，显示「正在加载 N 位参与者」 |
| **导入进行中** | CSV 200 行解析 + 照片压缩 | 进度条（`el-progress`），**不用 spinner**——耗时可预期时进度优于转圈 |
| **空状态** | 名单为空 | 已定（决策 16），出现在抽奖页与人员管理页 |
| **行内错误** | 工号重复 / 归一化异常 | 预检表内联标红 + 原因，不用 toast |

**触觉反馈**：所有主按钮 `:active` 加 `transform: translateY(1px)`。

**按钮文案**：主 CTA 不超过 3 字，禁止换行。当前「抽奖结果」「抽奖配置」等均满足。

### 3.5 动效策略与减弱动效（Section 6.B / 5.D）

**`MOTION_INTENSITY: 5`，但动效必须「有理由」**：

| 动效 | 去留 | 理由 |
|---|---|---|
| `bounce-in`（结果入场） | **保留** | 仪式感核心，状态转换反馈 |
| `preset-alert-pulse` | **改为有限次数** | 当前 `1.6s infinite` 是 Skill 5.D 点名的禁用模式；改为 3 次后停 |
| TagCanvas 球体旋转 | **保留** | 产品核心 |
| 其余新增动效 | **默认不加** | Section 5：答不出「传达了什么」就不加 |

**`prefers-reduced-motion` 必须实现**，且注意一个陷阱：

> TagCanvas 是 **JS rAF 循环**，CSS media query 管不到它。
> 必须在 `useTagCanvas` 里显式处理：检测 `matchMedia('(prefers-reduced-motion: reduce)')`，
> 命中时把 `TagCanvas.SetSpeed` 设为 `[0, 0]`（静止球云），而非只关 CSS 动画。

```ts
// useTagCanvas.ts
const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
const applyMotionPreference = () => {
  setSpeed(motionQuery.matches ? [0, 0] : getNormalSpeed());
};
motionQuery.addEventListener('change', applyMotionPreference);
```

同时 CSS 侧加：

```css
@media (prefers-reduced-motion: reduce) {
  .bounce-enter-active, .bounce-leave-active,
  .preset-alert-pulse { animation: none; }
}
```

**大屏演示模式**下减弱动效的处理策略：不做全屏遮罩（那是给敏感用户的网页模式用的），而是让用户**在设置里显式选择**「静止球云」，两种呈现都可用。

### 3.6 z-index 迁移（Section 6.F）

| 现状 | 迁移到 |
|---|---|
| `z-[9999]`（头部按钮） | `var(--ar-z-header)` |
| `z-index: 10000`（重置按钮） | `var(--ar-z-float)` |
| `z-index: 10001`（结果层 / `Tool.vue` 下拉） | `var(--ar-z-dialog)` / `var(--ar-z-popover)` |
| `10100`（弹窗）/ `10200`（popper） | `var(--ar-z-dialog)` / `var(--ar-z-popover)` |
| `index.css:37` 的 `11000 !important` | 删除，改由 `--el-messagebox*` + `--ar-z-messagebox` 控制 |
| `App.vue` / `Tool.vue` / `LotteryConfig.vue` 的 6 处覆写 | **全部删除**，由 token 接管 |

**验收标准（分层表述，非「归零」）**：

- [ ] 层级相关 `!important` = **0**（上表 6 处）
- [ ] `index.css` 的全局 reset 段 20 处 `!important` **保持原样**，不计入失败

上一版写的「`grep -c '!important' src/` 应为 0」不可达成——那 20 处是 `html`/`body`/`#app` 的防御性重置，剥掉会撞上 Element Plus 与 Tailwind preflight 的特异性，收益为零、风险为正。

### 3.7 背景与视觉资产（Section 4.8）

12 张预设背景走**图像生成工具**（Section 4.8 优先级 1），不手搓 CSS 渐变。

- 规格 1920×1080，WebP，q80，单张 150–250KB
- 全部以静态 `import` 打包，不走运行时文件 IO
- 12 张之间**必须拉开视觉差异**（题材/构图/明度至少两项不同），避免用户以为选错了

**背景与前景对比度**：每张背景生成后，需用取色器校验中央区域亮度，确保 `--ar-on-stage`（`#F0CE96`）与 `--ar-display-*` 文字在其上满足 ≥ 4.5:1。**不合格的背景直接返工**，不做半透明遮罩兜底。

### 3.8 AI 痕迹自检（Section 9）

| 项 | 状态 |
|---|---|
| 纯黑 `#000000` | 无，用 `#2A0703` |
| 霓虹外发光 | **有** — `Tool.vue:357` `box-shadow: 0 0 6px rgba(245,108,108,0.8)`，正是 9.A 禁止的外发光，须改为实心色点或内描边 |
| 无限循环动画 | **有** — `Tool.vue:358` `preset-alert-pulse ... infinite`（见 2.5） |
| 三等分特征卡 | 无，且**新增的设置页禁止三等分卡片布局** |
| 渐变文字 | 无 |
| 手搓 SVG 图标 | 无，沿用 Element Plus 图标 |
| 虚构精确数字 | **注意**：示例数据里的 152 人、1001–2050 工号是演示数据，**保持明显的假**，避免被误当真实名单 |

---

## 四、落地顺序

设计规范与实现阶段绑定，不单独排期：

| 阶段 | 落地内容 |
|---|---|
| 阶段 0 | `tokens.css` 建立；`FONT_SIZE_CONFIG` 重命名；**层级 `!important` 清零（6 处）** |
| 阶段 1 | z-index 迁移；启动加载态；两套字阶接入 |
| 阶段 2 | 空状态；导入进度条；行内错误；触觉反馈 |
| 阶段 3 | 单人操作态；清理工具反馈 |
| 阶段 4 | 12 张背景 + 对比度校验；适配模式；演示模式 |
| 阶段 5 | 全量对照度审计；减弱动效终验 |

---

## 五、验收清单

上线前逐项确认：

- [ ] 层级相关 `!important` = 0（`App.vue` 4 + `Tool.vue` 1 + `LotteryConfig.vue` 1 + `index.css:37` 1）；`index.css` 全局 reset 段 20 处保持原样
- [ ] 无任意 `z-[数字]` / `z-index: 数字`，全部走 `--ar-z-*`
- [ ] 圆角全部走 `--ar-radius-*`，无裸 `border-radius`
- [ ] 颜色全部走 `--ar-*` 或 `--el-*` token，无裸 hex（`tokens.css` 自身除外）
- [ ] 舞台与管理界面**共用**强调金，仅表面色不同
- [ ] `prefers-reduced-motion` 在 CSS **与** `useTagCanvas` 两侧均生效
- [ ] 启动加载态、导入进度、空状态、行内错误四态齐全
- [ ] 主 CTA 文案 ≤ 3 字，桌面不换行
- [ ] 12 张背景全部通过中央区域对比度 ≥ 4.5:1 校验
- [ ] 2560×1440 与 1280×800 两档窗口下结果层均不溢出、不变形
