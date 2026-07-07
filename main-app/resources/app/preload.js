/**
 * 帝意传媒 - 预加载脚本（最终完成版）
 * 安全暴露 API 给渲染进程
 * 第壹传媒 出品
 */

const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api', {
  // 应用信息
  appVersion: () => ipcRenderer.invoke('app:version'),
  appName: () => ipcRenderer.invoke('app:name'),

  // 窗口控制
  minimize: () => ipcRenderer.invoke('window:minimize'),
  maximize: () => ipcRenderer.invoke('window:maximize'),
  close: () => ipcRenderer.invoke('window:close'),
  closeWindow: () => ipcRenderer.invoke('window:close'),  // 别名：最小化到托盘
  quitApp: () => ipcRenderer.invoke('app:quit'),

  // AI 创作（支持多模型）
  aiGenerate: (prompt, taskType, model, modelType) => 
    ipcRenderer.invoke('ai:generate', { prompt, task_type: taskType, model, modelType }),
  aiGenerateImage: (prompt, options) => 
    ipcRenderer.invoke('ai:generate-image', { prompt, options }),
  aiGenerateVideo: (prompt, options) => 
    ipcRenderer.invoke('ai:generate-video', { prompt, options }),
  aiDaily: (category) => ipcRenderer.invoke('ai:daily', { category }),
  
  // 热点搜索
  hotSearch: (keyword, limit) => ipcRenderer.invoke('hot:search', { keyword, limit }),

  // 账号管理
  getAccounts: () => ipcRenderer.invoke('account:list'),
  saveAccounts: (accounts) => ipcRenderer.invoke('account:save', accounts),
  deleteAccount: (accountId) => ipcRenderer.invoke('account:delete', accountId),
  getCookies: (platformKey) => ipcRenderer.invoke('account:get-cookies', platformKey),

  // 平台登录
  listPlatforms: () => ipcRenderer.invoke('platform:list'),
  startLogin: (platformKey) => ipcRenderer.invoke('platform:start-login', platformKey),
  completeLogin: (accountId) => ipcRenderer.invoke('platform:complete-login', accountId),
  cancelLogin: () => ipcRenderer.invoke('platform:cancel-login'),
  testLogin: (platformKey) => ipcRenderer.invoke('platform:test-login', platformKey),
  // 打开/关闭账号页面（并排显示）
  openAccountPage: (accountId) => ipcRenderer.invoke('account:open-page', accountId),
  closeAccountPage: () => ipcRenderer.invoke('account:close-page'),

  // 外部链接
  openExternal: (url) => ipcRenderer.invoke('shell:open-external', url),

  // AI 模型配置
  saveAiConfig: (provider, config) => ipcRenderer.invoke('ai:save-config', { provider, config }),
  getAiConfig: (provider) => ipcRenderer.invoke('ai:get-config', provider),

  // 登录状态监听
  onLoginStatus: (callback) => {
    const listener = (_, data) => callback(data)
    ipcRenderer.on('login-status', listener)
    return () => ipcRenderer.removeListener('login-status', listener)
  },
  
  // 账号更新监听
  onAccountsUpdated: (callback) => {
    const listener = (_, data) => callback(data)
    ipcRenderer.on('accounts-updated', listener)
    return () => ipcRenderer.removeListener('accounts-updated', listener)
  },

  // 一键检测登录状态
  checkAllLoginStatus: () => ipcRenderer.invoke('account:check-all-status'),
  
  // 一键重新登录
  autoReloginAll: () => ipcRenderer.invoke('account:auto-relogin'),
  
  // 浏览器工作台（通用）
  openBrowserPanel: () => ipcRenderer.invoke('browser:open-panel'),
  
  // 为指定账号打开浏览器（使用独立 Session）
  openBrowserForAccount: (data) => ipcRenderer.invoke('browser:open-for-account', data),

  // ==================== 内嵌浏览器（BrowserView）====================
  // 创建/显示内嵌浏览器（在主窗口右侧并列显示）
  createBrowserView: (options) => ipcRenderer.invoke('browser-view:create', options),
  // 隐藏内嵌浏览器
  hideBrowserView: () => ipcRenderer.invoke('browser-view:hide'),
  // 显示内嵌浏览器
  showBrowserView: () => ipcRenderer.invoke('browser-view:show'),
  // 导航到指定 URL
  navigateBrowserView: (url) => ipcRenderer.invoke('browser-view:navigate', url),
  // 后退
  browserViewGoBack: () => ipcRenderer.invoke('browser-view:go-back'),
  // 前进
  browserViewGoForward: () => ipcRenderer.invoke('browser-view:go-forward'),
  // 刷新
  browserViewReload: () => ipcRenderer.invoke('browser-view:reload'),
  // 调整宽度
  resizeBrowserView: (width) => ipcRenderer.invoke('browser-view:resize', width),
  // 更新分隔条位置（左右分栏拖拽）
  updateSplitterPos: (leftWidth) => ipcRenderer.invoke('browser-view:update-splitter', leftWidth),
  // 获取当前 URL
  getBrowserViewUrl: () => ipcRenderer.invoke('browser-view:get-url'),
  // 在 BrowserView 中执行 JavaScript
  executeBrowserViewJS: (jsCode) => ipcRenderer.invoke('browser-view:execute-js', jsCode),

  // 从 BrowserView session 提取 Cookies（用于保存账号）
  extractBrowserViewCookies: (platformKey) => ipcRenderer.invoke('browser-view:extract-cookies', platformKey),
  // 保存浏览器账号（将 Cookies 写入指定 partition 并保存账号记录）
  saveBrowserViewAccount: (data) => ipcRenderer.invoke('browser-view:save-account', data),

  // ==================== 内嵌 Webview 标签浏览器（融媒宝风格）====================
  // 切换 webview session 到指定账号的 partition
  switchWebviewSession: (partition, url) => ipcRenderer.invoke('webview:switch-session', { partition, url }),
  // 从当前 webview 页面保存为账号
  saveWebviewAccount: (data) => ipcRenderer.invoke('webview:save-account', data),
  
  // 标签数据持久化
  saveBrowserTabs: (data) => ipcRenderer.invoke('browser:save-tabs', data),
  loadBrowserTabs: () => ipcRenderer.invoke('browser:load-tabs'),

  // ==================== 通用 IPC 事件监听（主进程→前端通知） ====================
  // 监听主进程发送的任意通知事件
  onNotify: (channel, callback) => {
    const listener = (_, data) => callback(data)
    ipcRenderer.on(channel, listener)
    return () => ipcRenderer.removeListener(channel, listener)
  },

  // ==================== 帝意日报自动分发 ====================
  diyiListArticles: () => ipcRenderer.invoke('diyi:list-articles'),
  diyiListAccounts: () => ipcRenderer.invoke('diyi:list-accounts'),
  diyiDistribute: (opts) => ipcRenderer.invoke('diyi:distribute', opts),
  diyiVerifyPlatform: (opts) => ipcRenderer.invoke('diyi:verify-platform', opts),
})
