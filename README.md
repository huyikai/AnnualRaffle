# 年会抽奖系统

一个基于 Vue 3 + TypeScript 开发的年会抽奖系统，支持3D标签云可视化抽奖、多奖项配置、用户照片展示等功能，适用于企业年会、活动抽奖等场景。

## 项目特色

- 🎯 **3D标签云抽奖**：使用 TagCanvas 实现炫酷的3D旋转标签云效果，增强抽奖仪式感
- 📸 **照片展示**：支持为每个用户添加照片，照片会显示在标签云和抽奖结果中
- 🎁 **多奖项管理**：支持配置多个奖项，每个奖项可设置不同的中奖人数
- 🔊 **音频支持**：支持背景音乐和开始音效，可调节音量和静音控制，增强抽奖氛围
- ⚙️ **统一配置管理**：所有业务配置集中在 `config` 目录，易于维护和扩展
- 💾 **数据持久化**：使用 localStorage 和 IndexedDB 保存配置、结果和照片数据，刷新不丢失
- 🎨 **精美UI**：基于 Element Plus 和 Tailwind CSS 构建的现代化界面

## 功能特性

### 抽奖配置管理

- 可配置多个奖项（一等奖、二等奖、三等奖、幸运奖等）
- 每个奖项可设置中奖人数
- 支持自定义新增奖项
- **预设名单功能**：每个奖项都可以选择是否使用预设名单，预设名单与奖项配置集成，设置更便捷
- **音频设置**：支持静音/取消静音控制，音量调节（0-100%），设置会自动保存

### 用户名单管理

- 通过代码配置用户数据（号码 + 姓名格式）
- 支持排除特定用户不参与所有奖项的抽奖（比如排除领导、高管等）

### 照片管理

- 支持为每个用户添加照片（通过文件放置）
- 照片格式支持 JPG、PNG
- 照片会显示在3D标签云和抽奖结果中

### 抽奖功能

- 3D标签云展示参与抽奖的用户
- 开始/停止抽奖控制
- 抽奖结果动画展示
- 自动排除已中奖用户（可选）
- 支持预设名单：每个奖项可配置预设中奖名单，启用后直接使用预设名单，无需随机抽取
- 智能补抽：当预设名单人数不足时，自动补充随机抽取剩余名额
- **音频效果**：开始抽奖时播放音效，背景音乐循环播放（可在配置中控制）

### 结果管理

- 查看所有奖项的抽奖结果
- 支持删除已中奖号码（点击结果卡片即可删除）
- 结果数据持久化保存
- 结果展示包含用户照片和姓名

### 数据重置

- 支持重置全部数据（包括 localStorage 和 IndexedDB）
- 支持分别重置：
  - 抽奖配置
  - 用户名单
  - 照片数据（IndexedDB）
  - 抽奖结果

## 技术栈

- Vue 3 + TypeScript
- Vite
- Pinia（状态管理）
- Element Plus（UI组件库）
- Tailwind CSS（样式框架）
- Vue Router 4（路由管理）
- TagCanvas（3D标签云）
- IndexedDB（照片数据存储）

## 快速开始

### 安装依赖

```bash
pnpm install
```

### 启动开发服务器

```bash
pnpm dev
```

### 快速上手

启动项目后，你可以直接使用示例数据进行测试，无需任何配置！

**快速上手三步：**

1. 启动项目 → 打开浏览器即可测试（使用示例数据）
2. 配置用户数据（可选）→ 详见下方"使用指南"
3. 添加用户照片（可选）→ 详见下方"使用指南"

### 构建生产版本

```bash
pnpm build
```

### 预览生产构建

```bash
pnpm preview
```

## 使用指南

### 1. 配置用户数据（可选）

如果不配置，系统会自动使用示例数据。

**步骤**：

1. 复制 `src/config/user.example.ts` 为 `src/config/user.ts`
2. 在 `user.ts` 中修改用户列表：

```typescript
export const user: UserItem[] = [
  { key: 1001, name: '张三' },
  { key: 1002, name: '李四' },
  // ... 添加更多用户
];

// 排除用户（可选，适用于所有奖项）
export const excludedUsers: UserItem[] = [
  { key: 1001, name: '张三' }, // 不参与任何奖项抽奖的用户
];
```

### 2. 配置奖项和音频

1. 点击页面右上角的"抽奖配置"按钮
2. **音频设置**（可选）：
   - 点击"静音"按钮可切换静音/取消静音状态
   - 拖动音量滑块调节音量（0-100%）
   - 音频设置会自动保存，刷新后保持设置
3. **奖项配置**：
   - 设置每个奖项的中奖人数
   - （可选）为任意奖项启用预设名单：
     - 打开奖项对应的预设名单开关
     - 输入用户ID，用逗号分隔（例如：`1001,1002,1003`）
     - 启用预设名单后，该奖项将直接使用预设的用户ID，不再随机抽取
   - （可选）点击"增加奖项"添加自定义奖项
4. 点击"保存配置"

**预设名单说明**：预设名单是可选的，格式为用户ID用逗号分隔（如：`1001,1002,1003`）。启用后优先使用预设用户，不足时自动补充随机抽取。

### 3. 添加用户照片（可选）

照片是可选的，没有照片时会自动显示默认头像。

**步骤**：

1. 准备照片文件（JPG/PNG，建议 20-50KB，160×160px）
2. 放入 `public/user/` 目录，命名为 `{用户key}.jpg`（如：`1001.jpg`）
3. 刷新页面即可看到照片

**提示**：可以逐步添加，不需要一次性准备所有照片。

### 4. 开始抽奖

1. 在页面底部选择要抽取的奖项
2. 点击"开始抽奖"按钮
3. 等待抽奖动画完成
4. 点击"停止"按钮或等待自动停止
5. 查看抽奖结果

### 5. 查看和管理结果

- **查看结果**：点击页面右上角的"抽奖结果"按钮
- **删除中奖号码**：在结果列表中点击要删除的号码卡片

## 配置说明

### 奖项配置

编辑 `src/config/lottery.ts` 文件可以修改默认奖项配置。所有奖项定义在 `LOTTERY_ITEMS` 数组中，包括奖项的 key、名称和默认数量：

```typescript
export const LOTTERY_ITEMS: LotteryItem[] = [
  { key: 'firstPrize', name: '一等奖', defaultCount: 1 },
  { key: 'secondPrize', name: '二等奖', defaultCount: 2 },
  { key: 'thirdPrize', name: '三等奖', defaultCount: 3 },
  { key: 'luckyFirst', name: '幸运奖第一轮', defaultCount: 15 },
  { key: 'luckySecond', name: '幸运奖第二轮', defaultCount: 15 },
  // ... 更多奖项
];
```

**注意**：

- 修改 `LOTTERY_ITEMS` 数组后，所有相关的类型、默认配置和结果类型都会自动更新，无需手动维护
- 每个奖项配置支持 `count`（中奖人数）和 `preset`（预设名单，可选）两个属性
- 预设名单格式为逗号分隔的用户ID字符串，例如：`"1001,1002,1003"`

### 预设名单配置

在"抽奖配置"界面中，每个奖项下方都有预设名单配置选项。打开开关，输入用户ID（逗号分隔）即可。

### 照片目录

用户照片存放在 `public/user/` 目录中，文件命名：`{用户key}.jpg` 或 `{用户key}.png`。详见 `public/user/README.md`。

### 数据存储

- **配置、名单、结果、音频设置**：存储在 localStorage 中
- **照片文件**：存放在 `public/user/` 目录中，照片元数据存储在 IndexedDB 中

## 开发

### 代码检查

```bash
pnpm lint
```

### 代码架构

项目采用 Vue 3 Composition API 和 Composables 模式组织代码：

- **Composables**：业务逻辑封装在 `src/composables/` 目录
  - `useLottery.ts`：抽奖业务逻辑（开始、停止、结果显示等）
  - `useTagCanvas.ts`：TagCanvas 3D标签云管理（初始化、重载、速度控制等）
  - `useAudio.ts`：音频管理（背景音乐、音效播放、音量控制、静音控制等）
- **状态管理**：使用 Pinia 管理全局状态（`src/stores/lottery.ts`）
- **工具函数**：通用工具函数集中在 `src/helper/` 目录
- **常量管理**：所有魔法数字和字符串统一在 `src/constants/` 目录管理
- **类型定义**：TypeScript 类型定义集中在 `src/types/` 目录

### 项目结构

```text
AnnualRaffle/
├── public/              # 静态资源
│   └── user/            # 用户照片目录
├── src/
│   ├── assets/          # 静态资源文件
│   │   ├── begin.mp3    # 音频文件
│   │   ├── bg.jpg       # 背景图片
│   │   ├── bg.mp3       # 背景音频
│   │   └── style/       # 样式文件
│   ├── lib/             # 第三方库
│   │   ├── tagcanvas.ts  # TagCanvas 3D标签云库 (TypeScript)
│   │   └── tagcanvas.types.ts  # TagCanvas 类型定义
│   ├── composables/     # 组合式函数（Composables）
│   │   ├── useLottery.ts     # 抽奖业务逻辑
│   │   ├── useTagCanvas.ts   # TagCanvas 管理逻辑
│   │   └── useAudio.ts        # 音频管理逻辑
│   ├── config/          # 业务配置
│   │   ├── lottery.ts   # 奖项配置（统一管理）
│   │   ├── user.ts      # 用户数据（需自行创建）
│   │   ├── user.example.ts  # 用户数据示例
│   │   └── user.template.ts  # 用户数据模板
│   ├── constants/      # 常量定义
│   │   └── index.ts     # 统一常量管理
│   ├── components/      # 组件
│   │   ├── LotteryConfig.vue  # 抽奖配置组件
│   │   ├── Result.vue         # 结果展示组件
│   │   ├── Tool.vue           # 工具组件
│   │   └── Publicity.vue       # 公示组件
│   ├── helper/          # 工具函数
│   │   ├── algorithm.ts # 抽奖算法
│   │   ├── db.ts        # IndexedDB 数据库操作
│   │   └── index.ts     # 工具函数集合
│   ├── router/          # 路由配置
│   │   └── index.ts     # 路由定义
│   ├── stores/          # Pinia 状态管理
│   │   └── lottery.ts    # 抽奖状态管理
│   ├── types/           # TypeScript 类型定义
│   │   ├── index.ts     # 统一类型定义
│   │   └── tagcanvas.d.ts # TagCanvas 类型声明
│   ├── views/           # 页面视图
│   │   └── Home.vue     # 首页组件
│   ├── App.vue          # 根组件
│   └── main.ts          # 应用入口
└── README.md
```

## 注意事项

1. **首次使用**：`src/config/user.ts` 文件是可选的，不创建会自动使用示例数据
2. **照片文件**：`public/user/` 目录中的照片文件不会被提交到 Git
3. **数据存储**：配置、名单、结果存储在 localStorage 中；照片元数据存储在 IndexedDB 中（数据库名：`AnnualRaffle`）
4. **浏览器兼容性**：建议使用现代浏览器（Chrome、Firefox、Edge 等），需要支持 IndexedDB 和 HTML5 Audio API
5. **音频功能**：
   - 系统支持背景音乐（`bg.mp3`）和开始音效（`begin.mp3`）
   - 音频文件位于 `src/assets/` 目录
   - 由于浏览器自动播放策略，音频需要在用户交互后启用（首次点击页面）
   - 音频设置（静音状态、音量）会自动保存到 localStorage
   - 默认状态为静音，默认音量为 50%
6. **数据备份**：重要数据建议定期备份，可通过浏览器开发者工具导出：
   - localStorage 数据：Application → Local Storage
   - IndexedDB 数据：Application → IndexedDB → AnnualRaffle
7. **性能优化**：大量用户时建议压缩照片大小以提升加载速度
8. **奖项配置**：修改奖项只需编辑 `src/config/lottery.ts` 中的 `LOTTERY_ITEMS` 数组，所有相关配置会自动更新
9. **代码架构**：项目采用 Vue 3 Composition API 和 Composables 模式，业务逻辑封装在 `composables/` 目录中

## 许可证

MIT License
