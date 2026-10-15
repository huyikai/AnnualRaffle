module.exports = {
  root: true,
  env: {
    browser: true,
    node: true,
    es2022: true,
  },
  extends: [
    'eslint:recommended',
    'plugin:vue/vue3-essential',
    'plugin:@typescript-eslint/recommended',
    '@vue/prettier',
  ],
  // vue-eslint-parser 解析 .vue，脚本块交给 TS 解析器
  // （旧配置里的 parserOptions.parser: 'babel-eslint' 指向一个早已废弃、
  //   且本仓库从未安装过的包，导致 ESLint 连自己的配置都加载不了）
  parser: 'vue-eslint-parser',
  parserOptions: {
    parser: '@typescript-eslint/parser',
    ecmaVersion: 'latest',
    sourceType: 'module',
    extraFileExtensions: ['.vue'],
  },
  plugins: ['@typescript-eslint'],
  globals: {
    // TagCanvas 通过 window 注入的全局变量
    __defaultAvatarUrl: 'readonly',
  },
  rules: {
    'no-console': 'off',
    'no-debugger': 'error',
    // 允许单文件组件用单词名（App.vue / Home.vue / Result.vue）
    'vue/multi-word-component-names': 'off',
    // no-unused-vars 交给 TS 版规则，避免与 TS 编译器的 noUnusedLocals 重复报错
    'no-unused-vars': 'off',
    // 保留未用参数但以 _ 前缀标注（保留函数签名以便将来使用）
    '@typescript-eslint/no-unused-vars': [
      'warn',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
    ],
  },
  overrides: [
    {
      // 测试文件允许更宽松
      files: ['**/__tests__/**/*', 'e2e/**/*'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-unused-vars': 'off',
      },
    },
  ],
};
