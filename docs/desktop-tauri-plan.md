# 年会抽奖系统 · 桌面客户端改造方案（定稿 v2）

> 状态：**五个阶段已全部交付**（详见[附录 A](#附录-a--实现落地记录v2-定稿--已交付)）。
> 本文档主体是设计决策记录，附录 A 记录实际落地与计划的差异。
> 变更说明：v2 依据四轮需求澄清（22 项决策）重构，废弃 v1 中的数字工号模型。
> 配套文档：[`design-system.md`](./design-system.md) — 视觉 token、双表面主题、字阶、动效与验收清单。

---

## 一、决策总表

### 第一轮 · 方案框架

| # | 决策项 | 结论 |
|---|---|---|
| 1 | 技术路线 | Tauri v2 → macOS `.dmg` + Windows `.msi`/`.exe` |
| 2 | 导入字段 | 仅「工号 + 姓名」 |
| 3 | 管理字段 | 工号、姓名、**参与开关**、**可参与奖项**（抗奖项增减） |
| 4 | 照片 | 批量导入 + 单人导入/修改/清除；格式校验 + Message 汇总 |
| 5 | 签名 | 不签名，GitHub Release 分发 |
| 6 | 网页版 | 保留，抽奖 + 名单管理；照片降级 |

### 第二轮 · 数据与流程

| # | 决策项 | 结论 |
|---|---|---|
| 7 | 工号类型 | **全链路改 `string`** |
| 8 | 结果存储 | **双轨**：`result`（算法）+ `resultMeta`（展示快照） |
| 9 | 音频 | BGM 与音效**均可上传替换**，音量分开控制 |
| 10 | 结果导出 | CSV（UTF-8 BOM），Excel/WPS 直接打开 |
| 11 | 现场形态 | 全屏演示模式 + 大屏适配（视口尺寸替代硬编码 1280px） |
| 12 | 网页版深度 | 抽奖 + 名单管理（照片退回 `public/user/` 约定） |

### 第三轮 · 导入与容错

| # | 决策项 | 结论 |
|---|---|---|
| 13 | 缺工号 | 该行**跳过**，进汇总明细 |
| 14 | 工号归一化 | trim + 全角转半角 + 去不可见字符；不动大小写/前导零 |
| 15 | 礼品发放标记 | **不做** |
| 16 | 首次启动 | **空状态引导**，不做向导 |
| 17 | 数据备份 | 手动导出 + **自动快照滚动保留 10 份** |
| 18 | 跨年/多场 | **导出归档**，不做多活动并存 |

### 第四轮 · 奖项与规模

| # | 决策项 | 结论 |
|---|---|---|
| 19 | 奖项管理 | 全部奖项（含内置）**可改名、可删除**，内置可一键恢复 |
| 20 | 名单规模 | 标签云**显示上限可配**，默认 300，不影响抽奖池全量 |
| 21 | 版本升级 | **「检查新版本」按钮**调 GitHub Releases API |
| 22 | 照片匹配 | 级联：`{工号}` → `{工号}-{姓名}` → `{姓名}`（姓名须唯一） |

---

## 二、关键结论

1. **改动比预期可控。** 算法层（`helper/algorithm.ts`、`config/lottery.ts`）是纯函数，`excludedUsers` 通过函数参数传入而非构建期 import。人员数据改运行时存储时，算法核心**一行不用改**，单元测试继续有效。

2. **真正的障碍是「名单写在代码里」。** 名单经 `import.meta.glob` 在构建期打包，改一个人就要重新发版。且 `excludedUsers` 从不落盘，重启即还原。

3. **两处既有缺陷需清理。**
   - `helper/db.ts`（IndexedDB）全项目只在重置时调用 `clear()`，读写路径从未使用 → 删除
   - `App.vue:179` 用 `store.photos.find(d => d.id === item)` 查照片，但 `store.photos` 恒为空，且 `PhotoItem.id`（自增主键）与头像匹配用的工号根本对不上 → 历史半成品
   - 奖项无删除/改名能力，自定义奖项加错即无法移除 → 本次补齐

4. **工具链就绪。** Node v24.18.0 / pnpm 10.34.4 / Rust 1.98.1 / Xcode CLT（arm64 Mac）。

5. **新架构顺带简化网页版构建**：`deploy.yml` 中 `cp user.example.ts user.ts` 步骤可删除。

---

## 三、现状盘点

| 数据 | 位置 | 生命周期 | 运行时可改 |
|---|---|---|---|
| 参与名单 `user` | `src/config/user.ts` → `userLoader.ts` | **构建期** | ❌ |
| 排除名单 `excludedUsers` | 同上，**从不落盘** | **构建期** | ❌ |
| 名单快照 `store.list` | localStorage `list` | 运行时 | ⚠️ 孤立 |
| 奖项配置 `config` | localStorage `config` | 运行时 | ✅ |
| 抽奖结果 `result` | localStorage `result` | 运行时 | ✅ |
| 奖项列表 `newLottery` | localStorage `newLottery` | 运行时 | ⚠️ 只能增 |
| 背景图 | `src/assets/bg.jpg` 硬编码 | **构建期** | ❌ |
| 音频 | `begin.mp3` / `bg.mp3` 打包写死 | **构建期** | ❌ |

**界面**：`router/index.ts` 仅 1 条路由，`views/Home.vue` 为空 div，全部界面在 `App.vue`（322 行）。右上角仅有「抽奖结果」「抽奖配置」两个入口，**无人员管理**。

**其他**：头像走 `public/user/{工号}.jpg` 约定（桌面端只读，行不通）；生产 `base: '/AnnualRaffle'` + `createWebHistory`；结果框硬编码 `width: 1280px`；背景 `backgroundSize: 100% 100%` 强制拉伸；8 个 Playwright e2e 跑在 web server 上。

---

## 四、数据模型

### 4.1 核心类型

```ts
interface Person {
  key: string;              // 工号，唯一，归一化后
  name: string;
  enabled: boolean;         // false 即「排除」，取代 excludedUsers
  allowedPrizes: string[];  // 空数组 = 参与全部奖项
}

interface Prize {
  key: string;
  name: string;
  builtin?: boolean;        // 内置 5 个，可删除、可一键恢复
}

// 算法读：保持纯 ID 数组，核心逻辑零改动
type ResultKeys = Record<string, string[]>;

// 展示读：抽奖当时的快照，名单被改动也不丢名字
interface WinRecord { name: string; time: number }
type ResultMeta = Record<string, Record<string, WinRecord>>;

interface Background {
  id: string;               // 'preset-01' … 'preset-12' | 'custom-<hash>'
  name: string;
  builtin: boolean;
  path?: string;            // 自定义背景在 app data 下的绝对路径
}
type FitMode = 'cover' | 'contain' | 'stretch';
```

### 4.2 存储布局（localStorage）

保留现有 key 以便迁移：`config` / `result` / `newLottery` / `excludeWinners` / `audioMuted` / `audioVolume`

新增：`schemaVersion`、`roster`、`resultMeta`、`appearance`、`display`

### 4.3 Schema 迁移

`schemaVersion: 2`。从 v1 迁移时：
- `list[]`（`{key: number}`）→ `roster[]`（`key: String(key)`），`enabled` 默认 `true`
- **无法还原的前导零**：旧数据若来自被 Excel 处理过的 CSV，前导零已在源头丢失，迁移时如实转换并计入告警
- `config[key].preset` 从逗号拼接字符串 `"a,b,c"` → `string[]`
- `config[key].excludedPersons` 从字符串 → `string[]`
- 新奖项对象的 `builtin` 字段：与 `LOTTERY_ITEMS` 的 key 匹配则置 `true`

### 4.4 工号归一化规则

| 处理 | 不处理 |
|---|---|
| trim 前后空格 | 大小写 |
| 全角数字/字母 → 半角 | 前导零补零 |
| 去零宽字符、BOM、软连字符 | — |

**配套措施**：
1. **模板 CSV** 工号列预置文本格式，从源头避免 Excel 转数值/科学计数法/吞前导零
2. **预检页双列展示**「原始值 → 归一化值」，供肉眼核对
3. **科学计数法（如 `2.20003E+15`）判定为损坏数据**，直接进失败明细，不尝试解析

---

## 五、奖项增减健壮性

**根因**：自定义奖项 key 由 `randomField()` 随机生成（10 位字母 + 时间戳）。删除再新增同名奖项，key 完全不同 → 原 `allowedPrizes` 限制不会关联，用户困惑。

**四条对策**：

1. **展示层过滤** — 人员编辑只渲染当前存在的奖项；残留 key 标记「已失效：{原名}」并提供一键清理
2. **新增时主动提示** — 「新增奖项『X』，有 N 人因参与限制无法参加，是否一并加入？」默认「加入」
3. **删除时预告影响** — 提示受影响人数并可展开名单；内置奖项额外提供「一键恢复」
4. **UI 语义明示** — 人员编辑框标注「参与全部奖项（默认）」/「仅参与已勾选的奖项」

---

## 六、人员管理

**入口**：右上角「人员管理」→ 独立页面。

| 列 | 说明 |
|---|---|
| 头像 | 点击预览 / 更换 / 清除 |
| 工号 | 可编辑，唯一性校验 |
| 姓名 | 可编辑 |
| 参与状态 | `el-switch` → `enabled` |
| 可参与奖项 | 标签展示，弹窗内多选 + 失效项标记 |
| 操作 | 编辑 / 删除 |

**顶部**：搜索、统计（共 N · 参与 M · 排除 K）、批量启停、批量删除、新增。

**删除保护**：删除或改工号时若该人**已中奖**，明确提示受影响的中奖记录。`resultMeta` 保证记录仍能正常展示。

**空状态引导**（决策 16）：名单为空时，抽奖页与人员管理页均显示显眼的「导入名单」入口与说明。任何时候名单被清空均触发，无需维护流程状态。

### 6.1 批量导入（CSV + 粘贴）

共用管线 `data/importer.ts`。

**CSV**：点击选择或拖拽文件入窗。
**粘贴**：大文本框，支持 Excel/WPS/飞书整块复制，自动识别制表符/逗号/中文逗号/空格。

**表头识别**：中文（`工号`/`编号`/`员工号` ↔ `姓名`）与英文（`id`/`no`/`number` ↔ `name`）；无表头按「第一列=工号，第二列=姓名」。

**编码**：UTF-8 / GBK / GB2312 自动探测（国内 Excel 另存的中文 CSV 极常见）。

**早期阻断**：若整份文件未识别到任何工号列，**直接阻断并提示**，不进入预检——否则用户会看到「成功 0 人，跳过 200 人」而无从判断原因。

**流程**：解析 → 预检表（缺失工号/缺失姓名/工号重复/与现有冲突）→ 冲突策略（跳过·默认 / 覆盖 / 新增）→ 确认写入 → Message 汇总 + 可展开明细。

**缺工号处理**：该行跳过并进汇总（决策 13）。

---

## 七、照片头像

**存储**：复制到 app data 下 `avatars/{工号}.jpg`，经 Tauri v2 asset 协议读取（`tauri.conf.json` 开启 `assetProtocol` + `$APPDATA/**` scope，前端 `convertFileSrc`）。

**网页版降级**：保留 `public/user/{工号}.jpg` 约定，`avatar/resolve.ts` 按运行环境分轨。

### 7.1 级联匹配（决策 22）

| 优先级 | 模式 | 约束 |
|---|---|---|
| 1 | `{工号}.ext` | — |
| 2 | `{工号}-{姓名}.ext` | — |
| 3 | `{姓名}.ext` | 姓名须在名册中**全局唯一**，否则判为歧义 |

未匹配的进失败明细，报错文案**直接指引**去人员管理页逐个指定（复用单人导入，不另建拖拽 UI）。

**孤儿照片照常保存**——IT 先导照片、行政后导名单是常见顺序，名单到位后自动匹配。

### 7.2 校验与压缩

| 检查项 | 规则 |
|---|---|
| 扩展名 | jpg / jpeg / png / webp |
| 文件头嗅探 | magic number，防伪装扩展名 |
| 大小上限 | 10 MB |
| 可解码性 | `createImageBitmap` 实测 |
| 压缩 | `createImageBitmap` → Canvas 等比缩放至最长边 512px → `toBlob('image/jpeg', 0.85)` |

压缩零依赖，复用 `scripts/process-images.ts` 的 sharp 思路但改用 WebView 原生 API，WKWebView 与 WebView2 均支持。

### 7.3 结果反馈

> **照片导入完成**
> ✅ 成功 186 · ⚠️ 跳过 12（已存在）· ❌ 失败 3
> ▸ 点击展开失败明细（文件名 + 原因）

### 7.4 单人操作

头像格点击 → 预览 → 更换 / 清除。人员删除**不自动删照片**，另提供「清理无人使用的照片」工具。

---

## 八、背景与音频

### 8.1 背景

**12 张预设**：`src/assets/backgrounds/`，静态 `import` 打包，无运行时文件 IO。
- 规格：1920×1080，WebP，质量 80，单张 150–250KB，合计约 2–3MB
- 风格：深红金年会基调（`#5E0F08` + `#E1A857`），保证与 UI 文字对比度
- 首批由我生成，后续可随时替换为正式素材

**自定义**：上传 → 复制到 app data → asset 协议读取；可删除。

**适配模式**（桌面窗口可缩放必须处理）：

| 模式 | 行为 |
|---|---|
| `cover`（默认） | 等比铺满，裁剪溢出，不变形 |
| `contain` | 完整显示，可能留边 |
| `stretch` | 拉伸，保持现有行为 |

### 8.2 音频

BGM 与音效**均可上传替换**（决策 9），存 app data，可恢复默认。

- 格式放开：mp3 / wav / ogg / m4a（浏览器原生均可播，不做白名单）
- **BGM 与音效音量分开控制**
- BGM 循环播放，音效一次性

---

## 九、抽奖流程与现场

### 9.1 全屏演示模式（决策 11）

- 入口：工具条按钮 + **F11** 双触发
- 效果：隐藏所有设置入口与工具条，仅留标签云和抽奖按钮，隐藏鼠标指针
- 退出：再次 F11 / 按钮 / `Esc`

### 9.2 大屏适配

| 问题 | 修复 |
|---|---|
| 结果框硬编码 `width: 1280px` | 改用视口尺寸（`min()` 夹取） |
| 背景 `100% 100%` 强制拉伸 | 默认 `cover` |
| 字号仅按人数单因子分档 | 改为**双因子**（视口 `clamp()` × 人数上限取小值），见[设计规范 §3.3](./design-system.md) |
| 缩放时 canvas 不重建 | `handleResize` 已有重建逻辑，确认在演示模式下正常触发 |

### 9.3 标签云显示上限（决策 20）

`numToShow = min(availableUsers.length, store.list.length, cap)`，默认 `cap = 300`，设置中可调。

现状为 `Math.min(availableUsers.length, store.list.length)`（`App.vue:157`），本方案在其外再夹一层 `cap`。

- 只限制**渲染多少个球体**
- **抽奖池仍是全量名单**，公平性完全不变

**性能依据**：每个标签 = 1 次 `<img>` 加载 + 1 次离屏 canvas 合成（`tagcanvas.ts:1390-1453` 的 `SetImage`→`Create`，canvas 由 `P()` 创建于 `tagcanvas.ts:345-353`），每次 `Reload` 全量重做。200 人带照片约几百毫秒；1000 人带照片达秒级。上限是性能保险。

---

## 十、数据备份与导出

### 10.1 自动快照（决策 17）

- 每次名单/配置/结果变更，在 app data 下 `backups/` 滚动写 JSON
- **保留最近 10 份**
- **写入必须 debounce（建议 3 秒静默期）**：批量导入 200 人会连续触发数十次变更，不节流会同步写盘数十次
- **照片与音频不入快照**：体积过大且可从源目录重新导入，快照只覆盖「不可再生的数据」——名单、奖项配置、中奖结果
- 成本极低，防的是不可逆故障：崩溃、误触「重置全部」——**名单可重新导入，中奖记录救不回来**

### 10.2 手动导出 / 导入

JSON 全量备份。**导出必须保留 `newLottery` 的自定义奖项 key**，否则 `allowedPrizes` 全部失效。

### 10.3 中奖结果导出（决策 10）

CSV + **UTF-8 BOM**（Excel/WPS 双击不乱码），可选**单个奖项**或**全部**。零依赖，零额外体积。

### 10.4 跨年归档（决策 18）

导出 JSON 存档 → 重置 → 导入新名单。不做多活动并存模型。

---

## 十一、分发

### 11.1 GitHub Actions

`.github/workflows/release.yml`，**推 tag `v*` 触发**：

| 平台 | Runner | 产物 |
|---|---|---|
| macOS | `macos-latest` | `.dmg`（arm64 + x86_64 / universal） |
| Windows | `windows-latest` | `.msi` + NSIS `.exe` |

使用 `tauri-apps/tauri-action`。Windows NSIS/WiX **无法在 macOS 交叉编译**，CI 是唯一路径。

### 11.2 检查新版本（决策 21）

设置中「检查新版本」按钮 → 调 GitHub Releases API 比对版本号 → 有新版弹窗给下载链接。手动触发，不在启动路径加网络依赖。

### 11.3 未签名安装引导（必做体验项）

- **macOS**：右键 → 打开 → 再次确认；或 `xattr -dr com.apple.quarantine /Applications/年会抽奖.app`
- **Windows**：SmartScreen →「更多信息」→「仍要运行」

README 增加安装章节 + Release notes 首屏图文引导。**年会当天必须提前实测一遍。**

### 11.4 版本目标

macOS 11+ / Windows 10+（依赖 WebView2）。包标识 `com.annualraffle.desktop`，起始版本 `1.0.0`。

---

## 十二、目录结构

```
src/
├── data/
│   ├── person.ts            # Person 类型、校验、归一化
│   ├── importer.ts          # CSV / 粘贴 → Person[] 统一管线
│   ├── prizes.ts            # 奖项增删与限制项健壮性
│   └── seed.ts              # 首次启动示例数据
├── storage/
│   ├── kv.ts                # localStorage 封装
│   ├── roster.ts            # 名册 + schema 迁移
│   ├── result.ts            # result + resultMeta
│   └── settings.ts          # 背景、音频、显示上限
├── avatar/
│   ├── resolve.ts           # Tauri / Web 双轨解析
│   ├── match.ts             # 级联文件名匹配
│   ├── validate.ts          # 格式/大小/尺寸校验
│   └── compress.ts          # Canvas 运行时压缩
├── io/
│   ├── backup.ts            # 自动快照 + 手动导出/导入
│   └── update.ts            # 检查新版本
├── assets/backgrounds/      # 12 张预设背景
├── views/
│   ├── Home.vue             # 抽奖舞台
│   ├── Settings.vue         # 设置中枢
│   ├── people/{People.vue, ImportDialog.vue}
│   └── appearance/{Background.vue, Audio.vue}
├── stores/{roster.ts, settings.ts, prizes.ts}
└── components/              # 现有组件复用
src-tauri/
```

---

## 十三、实施路线

### 阶段 0 · 数据地基（风险最高，单独隔离）
1. `Person` 类型 + 名册模块，`excludedUsers` → `enabled`，工号改 `string`
2. schema 迁移（v1 → v2）
3. `resultMeta` 双轨
4. 奖项增删改 + 健壮性四条对策
5. 改造 3 个调用点（`App.vue` / `Tool.vue` / `LotteryConfig.vue`）
6. 删除 `helper/db.ts` 死代码
7. **跑通单元测试 + 全部 8 个 e2e**
8. 建立 `src/design/tokens.css`，双表面 token 落地
9. 重命名 `FONT_SIZE_CONFIG`（`SMALL: '100px'` 实际是最大值，是维护陷阱）
10. **清理层级相关的 `!important` 补丁**（`App.vue` 4 处 / `Tool.vue` 1 处 / `LotteryConfig.vue` 1 处 / `index.css` 的 message-box 补丁），由 token 接管

> **验收**：抽奖行为与改造前逐条一致。任何回归在此暴露，不带到后面。
> **网页版回归**：同一批 e2e 必须覆盖 **web 模式**（`vite dev` + `vite build` 两种），决策 6/12 要求两版并行，不能只验桌面链路。

### 阶段 1 · Tauri 壳层
1. Tauri v2 + `src-tauri/`
2. `base` 与 hash 路由切换，原生窗口启动
3. 窗口配置（1280×800 可缩放）、图标
4. **打通 asset 协议**（优先验证，最易白屏）

### 阶段 2 · 人员管理
1. 人员管理页面（表格 + 单人增删改 + 参与开关 + 可参与奖项）
2. CSV 上传 + 批量粘贴 + 预检 + Message 反馈
3. 空状态引导
4. JSON 导入导出 + 自动快照

### 阶段 3 · 照片头像
1. 双轨解析、级联匹配、校验、压缩
2. 批量导入 + 汇总反馈
3. 单人导入/修改/清除 + 清理孤儿工具

### 阶段 4 · 背景、音频与现场
1. 12 张背景 + 自定义 + 适配模式
2. BGM/音效上传替换 + 分音量
3. 全屏演示模式 + 大屏适配
4. 标签云显示上限

### 阶段 5 · 打磨与分发
1. 结果导出 CSV、检查新版本
2. e2e 适配
3. GitHub Actions 发布流水线
4. README 安装引导 + 发布 v1.0.0

---

## 十四、风险清单

| 风险 | 影响 | 应对 |
|---|---|---|
| 阶段 0 抽奖行为回归 | **高** | 算法层纯函数 + 现有测试兜底，单独阶段验收 |
| asset 协议配置不当白屏 | 中 | 阶段 1 优先打通并验证 |
| 奖项增删引发限制错乱 | 中 | 第五节四条对策 + 专项用例 |
| 工号改 string 的全链路回归 | 中 | 集中在阶段 0，`preset`/`excludedPersons` 一并转数组 |
| 旧数据前导零不可还原 | 低 | 如实转换并计入迁移告警 |
| 未签名拦安装 | 高（体验） | 图文引导 + 会前实测 |
| 中文 CSV 编码乱码 | 中 | UTF-8/GBK 探测 + 预检双列确认 |
| 改工号/删人致结果悬空 | 中 | `resultMeta` 冻结快照 + 删除时提示 |
| 8 个 Playwright e2e 失效 | 低 | 阶段 0 确认基线，保留 Web 回归 |
| 12 张背景撑大安装包 | 低 | 压到 2–3MB |

---

## 十五、我方直接决定的事项（无需确认）

以下为实现细节，已按工程惯例定夺，如需调整请指出：

1. 改名后中奖记录**不跟随**，冻结为抽奖当时快照（审计语义）
2. 音频格式放开 mp3/wav/ogg/m4a；BGM 与音效音量分开
3. 演示模式入口为工具条按钮 + F11；字号改为视口 × 人数双因子（见[设计规范 §3.3](./design-system.md)），并同步重命名 `FONT_SIZE_CONFIG`
4. 应用图标按红金基调出一版
5. `preset` 与 `excludedPersons` 存储格式改为 `string[]`，随 schema v2 迁移
6. CSV 未识别到工号列时**早期阻断**，不进预检
7. 结果导出支持单奖项/全部两种范围
8. 重置类操作一律二次确认
9. web 版不做照片管理，头像退回 `public/user/` 约定

---

## 十六、明确的非目标

以下**不做**，避免范围蔓延：

- 局域网多人协同 / 主从机同步
- 多场活动并存模型
- 奖品图片、奖品描述等奖池富信息
- 多语言界面
- 内置自动更新器（无签名，改用检查新版本）
- PDF 导出（CSV 导出已覆盖）
- 礼品发放状态跟踪

---

## 附录 A · 实现落地记录（v2 定稿 → 已交付）

本附录记录**实际落地**与上文计划的差异，供后续维护者对照。

### A.1 计划 vs 实际

| 项 | 计划 | 实际 | 原因 |
|---|---|---|---|
| 设置页结构 | `views/appearance/{Background,Audio}.vue` | 单个 `views/Settings.vue`，三个页签（背景/音频/关于） | 三个页面共 40 行样板 + 共享「返回」壳，拆开反而更散 |
| 大屏字阶 | `clamp()` CSS 变量 | `FONT_SIZE_CONFIG` 数值常量 + 视口系数，在 `resCardStyle` 里取 `min()` | 常量用 `as const` 存字符串会锁死字面量类型，后续做 `min()` 必报类型错；改存数值 |
| 奖项奖品信息 | 曾考虑「奖品名称/图片」 | **未做**（决策 16 已列为非目标） | 范围控制 |
| 音频页 | 独立页面 | 并入设置页「音频」页签 | 同上 |

### A.2 计划外新增的模块

| 文件 | 用途 |
|---|---|
| `src/data/csv.ts` | 中奖结果导出（BOM + 字段转义 + 三级姓名回退） |
| `src/data/update.ts` | GitHub Releases 版本比较与检查 |
| `src/data/audio.ts` | 自定义音频校验（magic number）与落盘 |
| `src/data/appearance.ts` | 背景预设表（`import.meta.glob`）、自定义背景读写 |
| `src/config/release.ts` | 仓库地址与版本号常量（发布前改这里） |
| `src/platform/selfcheck.ts` | **开发模式**桌面端全链路自检，结果写 `app data/selfcheck.json` |
| `src/views/Settings.vue` | 设置中枢 |
| `src/views/ComingSoon.vue` | 占位页，**已删除**（被 Settings 取代） |

### A.3 计划外修复的既有缺陷

这些不是本次改造引入的，是改造过程中顺带发现并修掉的：

1. **e2e 从未真正跑过** — 5173 端口被本机其他项目占用，Playwright 打到了一个日文企业应用；已改 5188 + `strictPort`
2. **单元测试跑不起来** — vitest 4 要求 vite ^6||^7||^8，项目是 vite 5；已降到 3.2.7
3. **`:deep()` 死样式** — `el-select` 的 popper 被 teleport 到 body，scoped 选择器匹配不到，下拉配色从未生效
4. **`excludedUsers` 从不落盘** — 构建期静态 import，用户改了排除设置重启就还原
5. **IndexedDB 死代码** — `helper/db.ts` 只有 `clear()` 被调用过，写入路径从未使用
6. **阿里 CDN 图标字体** — 全项目无人使用，纯死依赖；离线会场会加载失败
7. **`preset-alert-pulse` 无限循环** — Skill 5.D 禁用模式，投屏时持续闪烁
8. **`FONT_SIZE_CONFIG` 命名与取值相反** — `SMALL: '100px'` 实为最大值

### A.4 当前测试规模

| 层 | 数量 | 覆盖 |
|---|---|---|
| 单元测试 | 117 | 算法排除逻辑、预设禁选、CSV 导入管线、头像匹配与格式校验、CSV 导出与版本比较 |
| e2e | 53 | 抽奖主流程 32 + 人员管理 11 + 批量导入 10 |

### A.5 尚未验证的路径

- **文件选择器对话框** — 原生窗口无法自动点击；整条链路（造图→校验→压缩→写盘→资产协议读回→枚举清理→背景写入→快照）已由 `selfcheck.ts` 在 dev 下真跑一遍，8/8 通过，但「用户点按钮选文件」这一步仍需人工验证。
- **Windows 产物** — NSIS/WiX 不支持跨平台交叉编译，只能靠 CI 产出，需在 Windows 真机上安装验证。

---

## 十七、已知特性（非缺陷，知情接受）

- **数据未加密**：名单与照片以明文存于 app data 目录。对内部工具可接受，加密属过度设计。
- **localStorage 容量**：名册上限约 5MB JSON，可容纳数万条记录，远超实际需要。
- **无优雅退出检测**：崩溃后重启不会提示恢复。Q11 的自动快照已覆盖数据可恢复性，故不实现退出标记。
