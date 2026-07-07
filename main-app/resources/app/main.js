/**
 * D&E Media - 主进程（修复版）
 * D&E Media 出品 | MIT 开源 | 无VIP限制
 */

const { app, BrowserWindow, BrowserView, ipcMain, Menu, Tray, shell, session, globalShortcut } = require('electron')
const http = require('http')
const { join } = require('path')
const Store = require('electron-store')

const store = new Store()

// ==================== API 配置 ====================

// Agnes AI API 配置（帝意优选）
const AGNES_API_KEY = 'sk-l0JImHVaXxq565zohwqt0Mn8EI58c2l71EkFH5tvZ2DJwTdk'
const AGNES_BASE_URL = 'https://apihub.agnes-ai.com/v1'
const AGNES_DISPLAY_NAME = '帝意优选'  // 显示名称

// Agnes AI 模型配置（根据任务类型选择）
const AGNES_MODELS = {
  text: 'agnes-2.0-flash',        // 文本/多模态理解
  image: 'agnes-image-2.1-flash',  // 图片生成（2.1 版本，高密度视觉生成）
  video: 'agnes-video-v2.0'       // 视频生成（异步任务 API）
}

// 调用 Agnes AI API（帝意优选）- 文本生成
async function callAgnesAI(prompt, taskType = 'general', modelType = 'text') {
  const https = require('https')
  const model = AGNES_MODELS[modelType] || AGNES_MODELS.text
  
  return new Promise((resolve, reject) => {
    const messages = [
      { role: 'system', content: '你是一个专业的新媒体内容创作者，擅长撰写各类平台内容。请用中文回复，内容要实用、有深度、吸引人。' },
      { role: 'user', content: prompt }
    ]
    
    const data = JSON.stringify({
      model: model,
      messages: messages,
      max_tokens: 2000,
      temperature: 0.7
    })
    
    const options = {
      hostname: 'apihub.agnes-ai.com',
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AGNES_API_KEY}`,
        'Content-Length': Buffer.byteLength(data)
      },
      timeout: 30000
    }
    
    const req = https.request(options, (res) => {
      let body = ''
      
      res.on('data', (chunk) => {
        body += chunk
      })
      
      res.on('end', () => {
        try {
          const response = JSON.parse(body)
          if (response.choices && response.choices[0]) {
            resolve({
              content: response.choices[0].message.content,
              model: AGNES_DISPLAY_NAME,  // 显示"帝意优选"而不是原始模型名
              modelType: modelType
            })
          } else {
            reject(new Error('Agnes API 返回格式错误: ' + body.substring(0, 200)))
          }
        } catch (e) {
          reject(new Error('解析 Agnes API 响应失败: ' + body.substring(0, 200)))
        }
      })
    })
    
    req.on('error', (err) => {
      reject(err)
    })
    
    req.on('timeout', () => {
      req.destroy()
      reject(new Error('Agnes API 请求超时'))
    })
    
    req.write(data)
    req.end()
  })
}

// 调用 Agnes AI 图片生成 API
async function callAgnesImage(prompt, options = {}) {
  const https = require('https')
  const model = AGNES_MODELS.image
  
  return new Promise((resolve, reject) => {
    const requestBody = {
      model: model,
      prompt: prompt,
      n: options.n || 1,
      size: options.size || '1024x1024'
    }
    
    const data = JSON.stringify(requestBody)
    
    const reqOptions = {
      hostname: 'apihub.agnes-ai.com',
      path: '/v1/images/generations',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AGNES_API_KEY}`,
        'Content-Length': Buffer.byteLength(data)
      },
      timeout: 60000
    }
    
    const req = https.request(reqOptions, (res) => {
      let body = ''
      
      res.on('data', (chunk) => {
        body += chunk
      })
      
      res.on('end', () => {
        try {
          const response = JSON.parse(body)
          if (response.data && response.data[0]) {
            resolve({
              url: response.data[0].url,
              model: AGNES_DISPLAY_NAME,  // 显示"帝意优选"
              modelType: 'image'
            })
          } else {
            reject(new Error('Agnes 图片 API 返回格式错误: ' + body.substring(0, 200)))
          }
        } catch (e) {
          reject(new Error('解析 Agnes 图片 API 响应失败: ' + body.substring(0, 200)))
        }
      })
    })
    
    req.on('error', (err) => {
      reject(err)
    })
    
    req.on('timeout', () => {
      req.destroy()
      reject(new Error('Agnes 图片 API 请求超时'))
    })
    
    req.write(data)
    req.end()
  })
}

// 调用 Agnes AI 视频生成 API（异步任务）
async function callAgnesVideo(prompt, options = {}) {
  const https = require('https')
  const model = AGNES_MODELS.video
  
  return new Promise((resolve, reject) => {
    const requestBody = {
      model: model,
      prompt: prompt,
      duration: options.duration || 5  // 默认 5 秒
    }
    
    const data = JSON.stringify(requestBody)
    
    const reqOptions = {
      hostname: 'apihub.agnes-ai.com',
      path: '/v1/videos',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AGNES_API_KEY}`,
        'Content-Length': Buffer.byteLength(data)
      },
      timeout: 60000
    }
    
    const req = https.request(reqOptions, (res) => {
      let body = ''
      
      res.on('data', (chunk) => {
        body += chunk
      })
      
      res.on('end', () => {
        try {
          const response = JSON.parse(body)
          // 视频生成是异步的，返回 video_id 用于查询
          if (response.video_id) {
            resolve({
              video_id: response.video_id,
              model: AGNES_DISPLAY_NAME,  // 显示"帝意优选"
              modelType: 'video',
              status: 'processing'
            })
          } else {
            reject(new Error('Agnes 视频 API 返回格式错误: ' + body.substring(0, 200)))
          }
        } catch (e) {
          reject(new Error('解析 Agnes 视频 API 响应失败: ' + body.substring(0, 200)))
        }
      })
    })
    
    req.on('error', (err) => {
      reject(err)
    })
    
    req.on('timeout', () => {
      req.destroy()
      reject(new Error('Agnes 视频 API 请求超时'))
    })
    
    req.write(data)
    req.end()
  })
}

  // 引入自动登录模块（Electron session 版）
const { openLoginWindow, getLoginCookies, closeLoginWindow, getUserNameFromPage, testLoginStatus, getSavedCookies, deleteCookies, SUPPORTED_PLATFORMS, loginWindows } = require('./automation-login')

let mainWindow = null
let tray = null
let currentLoginAccountId = null  // 当前登录的账号 ID
let browserView = null          // 主窗口内嵌浏览器（BrowserView）
let browserViewVisible = false  // 浏览器面板是否显示
let browserViewWidth = 800      // 浏览器面板宽度
let browserViewHeight = 400     // 浏览器面板高度（下方模式）

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    icon: join(__dirname, 'icon.ico'),
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
      webviewTag: true           // 关键！允许 <webview> 标签
    },
    frame: false,           // 去掉原生标题栏，用自定义圆点按钮
    titleBarStyle: 'hidden', // 隐藏标题栏
    show: false,
    title: 'D&E Media - 新媒体管理平台'
  })

  // 立即保存 mainWindow 引用
  mainWindow = win

  // 确保窗口在可见区域（防止跑到屏幕外）
  win.center()

  win.on('ready-to-show', () => {
    win.show()
    win.maximize()
  })

  // 加载应用（优先加载本地文件，不依赖开发服务器）
  win.loadFile(join(__dirname, 'index.html')).catch((err) => {
    console.error('加载 index.html 失败:', err.message)
  })

  // 窗口大小改变时，自动调整 BrowserView 位置（右侧模式：左右分栏）
  win.on('resize', () => {
    if (browserView && browserViewVisible && mainWindow) {
      const [winWidth, winHeight] = mainWindow.getContentSize()
      const titleBarHeight = 34       // 自定义标题栏高度
      const bvToolbarHeight = 40      // BV 工具栏高度（地址栏+导航按钮）
      const bottomTabBarHeight = 56   // 底部导航栏高度
      // 使用当前分隔条位置（默认50%）
      const splitPos = currentSplitterPos || Math.floor(winWidth * 0.5)

      browserView.setBounds({
        x: splitPos,                              // 分隔条右侧
        y: titleBarHeight + bvToolbarHeight,      // 标题栏+工具栏下方
        width: winWidth - splitPos,                // 剩余宽度
        height: winHeight - titleBarHeight - bvToolbarHeight - bottomTabBarHeight  // 到底部导航栏上方
      })
    }
  })

  return win
}

function createTray() {
  try {
    const iconPath = join(__dirname, 'icon.ico')
    // 如果图标文件不存在，使用空图标（防止崩溃）
    let finalIconPath = iconPath
    try {
      if (!require('fs').existsSync(iconPath)) {
        finalIconPath = null  // Electron 会用默认图标
      }
    } catch (e2) {}
    
    tray = new Tray(finalIconPath || iconPath)
    const contextMenu = Menu.buildFromTemplate([
      {
        label: '打开 D&E Media',
        click: () => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.show()
            mainWindow.focus()
          } else {
            mainWindow = createWindow()
          }
        }
      },
      { type: 'separator' },
      {
        label: '✕ 退出程序',
        click: () => {
          app.isQuitting = true
          process.exit(0)
        }
      }
    ])
    tray.setContextMenu(contextMenu)  // 关键：把菜单设置到托盘
    tray.setToolTip('D&E Media - 新媒体管理平台')
    tray.on('click', () => {
      if (mainWindow) {
        if (mainWindow.isVisible()) {
          mainWindow.hide()
        } else {
          mainWindow.show()
          mainWindow.focus()
        }
      }
    })
  } catch (e) {
    console.error('创建托盘失败:', e.message)
  }
}

// ==================== Cookie 持久化恢复（启动时） ====================
// 关键修复：应用重启后自动恢复所有账号的登录 Cookie
async function restoreAllCookies() {
  try {
    const accounts = store.get('accounts', [])
    if (accounts.length === 0) {
      console.log('[Cookie恢复] 无已保存的账号')
      return
    }
    
    let restoredCount = 0
    for (const account of accounts) {
      // 获取该账号存储的 cookies（从 electron-store）
      const storedCookies = store.get(`cookies.${account.platform}.${account.id}`)
      if (!storedCookies || storedCookies.length === 0) continue
      
      // 获取该账号对应的 persist session partition
      const partition = account.partition || `persist:account-${account.id}`
      const targetSession = session.fromPartition(partition, { cache: true })
      
      // 将 cookies 写入 session（这样 BrowserView 使用同一 partition 时就能自动带上了）
      for (const cookie of storedCookies) {
        try {
          // 清理 cookie 对象，只保留 Electron 需要的字段
          const cookieData = {
            url: cookie.url || `https://${cookie.domain || ''}`,
            name: cookie.name,
            value: cookie.value,
            domain: cookie.domain,
            path: cookie.path || '/',
            secure: cookie.secure || false,
            httpOnly: cookie.httpOnly || false,
            expirationDate: cookie.expirationDate || (Date.now() / 1000 + 86400 * 365)
          }
          await targetSession.cookies.set(cookieData)
        } catch (e) {
          // 单个 cookie 设置失败不影响整体
        }
      }
      
      restoredCount++
      console.log(`[Cookie恢复] ${account.platformName || account.name}: ${storedCookies.length} 个Cookie → ${partition}`)
    }
    
    console.log(`[Cookie恢复] ✅ 完成！共恢复 ${restoredCount}/${accounts.length} 个账号`)
    
    // 通知前端 Cookie 已恢复
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('cookies-restored', { 
        count: restoredCount,
        message: `已恢复 ${restoredCount} 个账号的登录状态`
      })
    }
  } catch (error) {
    console.error('[Cookie恢复] 失败:', error.message)
  }
}

// ==================== Cookie 持久化保存（退出时） ====================
// 应用关闭前保存所有活跃 session 的 cookies 到 store
async function saveAllSessionCookies() {
  try {
    const accounts = store.get('accounts', [])
    let savedCount = 0
    
    for (const account of accounts) {
      try {
        const partition = account.partition || `persist:account-${account.id}`
        const sourceSession = session.fromPartition(partition, { cache: true })
        
        // 从 session 获取所有 cookies
        const cookies = await sourceSession.cookies.get({})
        
        if (cookies && cookies.length > 0) {
          // 保存到 electron-store（双重保险：persist session 本身会持久化 + store 备份）
          store.set(`cookies.${account.platform}.${account.id}`, cookies)
          savedCount++
          console.log(`[Cookie保存] ${account.platformName || account.name}: ${cookies.length} 个Cookie`)
        }
      } catch (e) {
        // 单个账号失败不影响其他
      }
    }
    
    console.log(`[Cookie保存] ✅ 完成！共保存 ${savedCount} 个账号`)
  } catch (error) {
    console.error('[Cookie保存] 失败:', error.message)
  }
}

app.whenReady().then(async () => {
  mainWindow = createWindow()
  createTray()
  Menu.setApplicationMenu(null)

  // 🔥 关键：启动时恢复所有账号的 Cookie（解决重启后丢失问题）
  console.log('[启动] 正在恢复登录状态...')
  await restoreAllCookies()

  // ✅ 全局反检测 + UA伪装：让所有 session 看起来像真实 Chrome 浏览器
  const defaultSess = session.defaultSession
  
  // 1. UA 伪装（Chrome 最新版）
  defaultSess.webRequest.onBeforeSendHeaders((details, callback) => {
    details.requestHeaders['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
    callback({ requestHeaders: details.requestHeaders })
  })

  // 2. 响应头处理：移除可能暴露 Electron 的安全头
  defaultSess.webRequest.onHeadersReceived((details, callback) => {
    const responseHeaders = details.responseHeaders || {}
    // 移除 X-Frame-Options，允许 iframe 嵌入（某些平台需要）
    delete responseHeaders['x-frame-options']
    delete responseHeaders['X-Frame-Options']
    callback({ responseHeaders })
  })

  // 3. 隐藏 webdriver 标志（最关键的！DeepSeek 等平台检测这个）
  // ⚠️ 安全保护：web-contents-created 会捕获所有 WebContents（包括 devtools/background），
  // 某些内部 WebContents 的 webPreferences 可能尚未初始化，直接调用 setPreloads 会崩溃！
  app.on('web-contents-created', (_event, contents) => {
    try {
      // ✅ 安全检查：只处理有完整 webPreferences 的 WebContents
      if (!contents || !contents.getType) return
      
      const wcType = contents.getType()
      // 跳过不需要反检测的内部 WebContents
      if (wcType === 'background' || wcType === 'remote' || wcType === 'webview') {
        return
      }
      
      // 安全地设置 preloads（用 try-catch 保护）
      try { contents.setPreloads([]) } catch(e) {}
    
      // 注入反检测脚本（页面加载完成后）
      contents.on('dom-ready', () => {
        try {
          contents.executeJavaScript(`
            if (!window.__antiDetectInjected) {
              window.__antiDetectInjected = true;
              Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
              if (window.chrome) { window.chrome.runtime = {}; }
              const origQuery = window.navigator.permissions?.query;
              if (origQuery) {
                window.navigator.permissions.query = (params) =>
                  params.name === 'notifications'
                    ? Promise.resolve({ state: Notification.permission })
                    : origQuery(params);
              }
              Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
              Object.defineProperty(navigator, 'languages', { get: () => ['zh-CN', 'zh', 'en-US', 'en'] });
            }
          `).catch(() => {})
        } catch(e) {}
      })

      // 拦截新窗口事件
      try {
        contents.setWindowOpenHandler(({ url }) => {
          contents.loadURL(url)
          return { action: 'deny' }
        })
      } catch(e) {}

    } catch(outerErr) {
      // 忽略所有反检测初始化错误，不影响主流程
    }
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow()
    }
  })
})

app.on('window-all-closed', (e) => {
  if (process.platform !== 'darwin') {
    if (!app.isQuitting) {
      e.preventDefault()
      // 先检查窗口是否还存在且未被销毁
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.hide()
      }
    }
    // 如果 isQuitting=true，让应用自然退出（不调用 app.quit() 防止递归）
  }
})

app.on('before-quit', async () => {
  app.isQuitting = true
  // 🔥 关键：退出前保存所有 session 的 cookies（确保不丢失）
  console.log('[退出] 正在保存登录状态...')
  await saveAllSessionCookies()
})

// ==================== IPC 通信 ====================

// 应用信息
ipcMain.handle('app:version', () => app.getVersion())
ipcMain.handle('app:name', () => app.getName())

// 真正退出应用
ipcMain.handle('app:quit', () => {
  app.isQuitting = true
  app.quit()
})

// 窗口控制
ipcMain.handle('window:minimize', () => {
  if (mainWindow) mainWindow.minimize()
})
ipcMain.handle('window:maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize()
    } else {
      mainWindow.maximize()
    }
  }
})
ipcMain.handle('window:close', () => {
  if (mainWindow) mainWindow.hide()
})

// ==================== 账号管理 ====================

ipcMain.handle('account:list', async () => {
  return store.get('accounts', [])
})

ipcMain.handle('account:save', async (_, accounts) => {
  store.set('accounts', accounts)
  return { success: true }
})

ipcMain.handle('account:delete', async (_, accountId) => {
  const accounts = store.get('accounts', [])
  const account = accounts.find(acc => acc.id === accountId)
  const filtered = accounts.filter(acc => acc.id !== accountId)
  store.set('accounts', filtered)
  
  // ✅ 修复：用 try-catch 包裹 deleteCookies，避免它抛异常导致整个 IPC 返回 reject
  // （即使 Cookie 清理失败，账号记录也已经删除成功了）
  try {
    if (account) {
      deleteCookies(account.platform)
      console.log(`[账号删除] 已清理平台 ${account.platform} 的 Cookie`)
    }
  } catch(e) {
    console.warn(`[账号删除] 清理 Cookie 失败（不影响账号删除结果）:`, e.message)
  }
  
  return { success: true }
})

ipcMain.handle('account:get-cookies', async (_, platformKey) => {
  return getSavedCookies(platformKey)
})

// ==================== 自动登录 ====================

ipcMain.handle('platform:list', () => {
  try {
    const platforms = {}
    for (const [key, val] of Object.entries(SUPPORTED_PLATFORMS)) {
      platforms[key] = {
        name: val.name,
        loginUrl: val.loginUrl,
        icon: val.icon || '🔗'
      }
    }
    console.log('platform:list 返回:', JSON.stringify(platforms))
    return platforms
  } catch (e) {
    console.error('platform:list 出错:', e.message)
    return {}
  }
})

ipcMain.handle('platform:start-login', async (_, platformKey, accountId = null) => {
  try {
    const platform = SUPPORTED_PLATFORMS[platformKey]
    if (!platform) {
      return { success: false, message: `不支持的平台: ${platformKey}` }
    }

    // 打开登录窗口（同步返回，不阻塞）
    const result = openLoginWindow(platformKey, mainWindow, accountId)
    
    // 保存当前登录的账号 ID
    currentLoginAccountId = result.accountId
    
    // 显示提示
    mainWindow.webContents.send('login-status', {
      platform: platformKey,
      message: `请在弹出的浏览器窗口中完成 ${platform.name} 的登录`,
      status: 'waiting',
      accountId: result.accountId
    })

    return { success: true, message: '登录窗口已打开', accountId: result.accountId }
  } catch (error) {
    return { success: false, message: error.message }
  }
})

ipcMain.handle('platform:complete-login', async (_, passedAccountId = null) => {
  try {
    // 优先使用传入的 accountId，fallback 到全局变量（兼容旧逻辑）
    const accountId = passedAccountId || currentLoginAccountId
    if (!accountId) {
      return { success: false, message: '未找到登录窗口，请重新操作' }
    }

    // 获取登录窗口
    const loginWin = loginWindows[accountId]
    if (!loginWin || loginWin.isDestroyed()) {
      return { success: false, message: '登录窗口已关闭，请重新操作' }
    }

    const platformKey = loginWin._platformKey
    const platform = SUPPORTED_PLATFORMS[platformKey]
    if (!platform) {
      return { success: false, message: `不支持的平台: ${platformKey}` }
    }

    // 从登录窗口的 session 获取 cookies
    const cookies = await getLoginCookies(accountId)
    
    if (!cookies || cookies.length === 0) {
      return { success: false, message: '未检测到登录 Cookie，请确认已完成登录' }
    }

    // 保存 cookies（按账号 ID 存储，支持多账号独立 session）
    // 关键：每个账号用独立的 cookie 存储，不互相覆盖
    store.set(`cookies.${platformKey}.${accountId}`, cookies)
    // 注意：不再写入平台级 cookies.${platformKey}，防止多账号互相覆盖

    // 尝试从页面获取用户名
    const userName = await getUserNameFromPage(loginWin)

    // 保存账号信息
    const accounts = store.get('accounts', [])
    const existingIndex = accounts.findIndex(acc => acc.id === accountId)

    // 小红书特殊处理：登录后自动打开创作者中心
    if (platformKey === 'xiaohongshu' && platform.creatorUrl) {
      console.log('[小红书] 登录完成，正在打开创作者中心...')
      loginWin.loadURL(platform.creatorUrl)
      
      // 等待页面加载完成
      loginWin.webContents.once('did-stop-loading', () => {
        console.log('[小红书] 创作者中心已加载')
        loginWin.webContents.send('login-status', {
          status: 'logged-in',
          platform: platformKey,
          message: '✅ 小红书登录成功！创作者中心已打开',
          autoOpened: true
        })
      })
    }
    const accountInfo = {
      id: accountId,
      platform: platformKey,
      platformName: platform.name,
      name: userName || `${platform.name} ${accounts.filter(acc => acc.platform === platformKey).length + 1}`,
      userName: userName,
      cookieTime: new Date().toISOString(),
      status: '已登录'
    }

    if (existingIndex >= 0) {
      accounts[existingIndex] = { ...accounts[existingIndex], ...accountInfo }
    } else {
      accounts.push(accountInfo)
    }
    store.set('accounts', accounts)

    // 关闭登录窗口
    closeLoginWindow(accountId)
    currentLoginAccountId = null

    // 通知前端
    mainWindow.webContents.send('login-status', {
      platform: platformKey,
      message: `${platform.name} 登录成功，已保存 ${cookies.length} 个 Cookie`,
      status: 'success'
    })

    mainWindow.webContents.send('accounts-updated')

    return { success: true, message: `${platform.name} 登录成功（${cookies.length} 个 Cookie）`, platform: platform.name }
  } catch (error) {
    console.error('完成登录出错:', error)
    return { success: false, message: error.message }
  }
})

ipcMain.handle('platform:cancel-login', async () => {
  if (currentLoginAccountId) {
    closeLoginWindow(currentLoginAccountId)
    currentLoginAccountId = null
  }
  return { success: true }
})

ipcMain.handle('platform:test-login', async (_, platformKey) => {
  try {
    const isValid = await testLoginStatus(platformKey)
    return { success: true, valid: isValid }
  } catch (error) {
    return { success: false, valid: false, message: error.message }
  }
})

ipcMain.handle('shell:open-external', async (_, url) => {
  shell.openExternal(url)
  return { success: true }
})

// ==================== 打开账号页面（并排显示在主窗口右侧）====================

// 打开账号页面 — 不再创建BrowserView！改为通知前端在 right-browser-panel 中打开
ipcMain.handle('account:open-page', async (_, accountId) => {
  try {
    const accounts = store.get('accounts', [])
    const acc = accounts.find(a => a.id === accountId)
    if (!acc) {
      return { success: false, message: '账号不存在' }
    }
    
    console.log(`[账号打开] ✅ 通知前端打开账号: ${acc.platformName} (${accountId})`)
    
    // 通知前端在 HTML 的 .right-browser-panel 内的 webview 中打开
    if (mainWindow) {
      mainWindow.webContents.send('account:open-in-webview', { 
        accountId, 
        platformName: acc.platformName,
        url: acc.url || '',
        partition: acc.partition || `persist:account-${accountId}`
      })
    }
    
    return { success: true, message: `已通知前端打开 ${acc.platformName}` }
  } catch (error) {
    console.error('打开账号页面失败:', error)
    return { success: false, message: error.message }
  }
})

// 关闭账号页面（通知前端）
ipcMain.handle('account:close-page', async () => {
  try {
    // 通知前端关闭右侧浏览器面板
    if (mainWindow) {
      mainWindow.webContents.send('account:close-webview', {})
    }
    return { success: true }
  } catch (error) {
    return { success: false, message: error.message }
  }
})

// ==================== 一键检测登录状态 ====================
ipcMain.handle('account:check-all-status', async () => {
  try {
    const accounts = store.get('accounts', [])
    if (accounts.length === 0) {
      return { success: true, results: [] }
    }

    const results = []
    
    for (const acc of accounts) {
      const platformKey = acc.platform
      const platform = SUPPORTED_PLATFORMS[platformKey]
      
      if (!platform) {
        results.push({
          platformKey,
          platformName: acc.platformName || platformKey,
          accountName: acc.name || acc.userName || '未命名',
          loggedIn: false,
          error: '不支持的平台'
        })
        continue
      }

      try {
        // 使用平台级 session 检测登录状态
        const platformPartition = `persist:platform-${platformKey}`
        const checkSession = session.fromPartition(platformPartition, { cache: true })
        
        // 获取该平台的 cookies
        const cookies = await checkSession.cookies.get({ url: platform.cookieUrl })
        
        // 检查关键 cookie（每个平台的登录标识不同）
        const keyCookies = detectLoginCookies(platformKey, cookies)
        
        results.push({
          id: acc.id,
          platformKey,
          platformName: acc.platformName || platform.name,
          accountName: acc.name || acc.userName || '未命名',
          loggedIn: keyCookies.loggedIn,
          cookieCount: cookies.length,
          details: keyCookies.details
        })
        
        console.log(`[登录检测] ${platform.name}: ${keyCookies.loggedIn ? '✅ 已登录' : '❌ 未登录'} (${cookies.length} 个Cookie)`)
      } catch (e) {
        results.push({
          id: acc.id,
          platformKey,
          platformName: acc.platformName || platform.name,
          accountName: acc.name || acc.userName || '未命名',
          loggedIn: false,
          error: e.message
        })
      }
    }

    return { success: true, results }
  } catch (error) {
    console.error('[登录检测] 批量检测失败:', error)
    return { success: false, message: error.message }
  }
})

// 检测各平台的关键登录 Cookie
function detectLoginCookies(platformKey, cookies) {
  const cookieNames = cookies.map(c => c.name)
  
  // 各平台的关键登录 cookie 名称
  const loginIndicators = {
    douyin: ['passport_csrf_token', 'sessionid', 'ttwid', 'odin_tt'],
    xiaohongshu: ['a1', 'web_session', 'customer-sheg-root'],
    kuaishou: ['kuaishou.login.token', 'userId', 'kuaishou.server.token', 'web_login_platform', 'kuaishou_token'],
    wechat: ['data_ticket', 'slave_user', 'slave_sid'],
    bilibili: ['SESSDATA', 'bili_jct', 'DedeUserID'],
    weibo: ['SUB', 'ALF', 'SUP'],
    zhihu: ['z_c0', 'cap_id'],
    toutiao: ['sessionid', 'csrftoken'],
    baidu: ['BAIDUID', 'BDUSS'],
    tencent: ['uin', 'skey'],
    youtube: ['SID', 'HSID', 'SSID'],
    twitter: ['auth_token', 'ct0'],
    facebook: ['xs', 'sb', 'datr'],
    instagram: ['sessionid', 'ds_user_id']
  }
  
  const indicators = loginIndicators[platformKey] || []
  const found = indicators.filter(name => cookieNames.includes(name))
  
  // 如果有关键 cookie，认为已登录
  // 或者 cookie 数量 > 10（说明有完整的 session）
  return {
    loggedIn: found.length >= 2 || cookies.length > 15,
    details: `找到 ${found.length}/${indicators.length} 个关键Cookie，共 ${cookies.length} 个`
  }
}

// ==================== 一键重新登录 ====================
ipcMain.handle('account:auto-relogin', async () => {
  try {
    const accounts = store.get('accounts', [])
    let reloginCount = 0
    
    for (const acc of accounts) {
      const platformKey = acc.platform
      const platform = SUPPORTED_PLATFORMS[platformKey]
      
      if (!platform) continue
      
      // 检查是否未登录（支持多域名 Cookie 采集）
      const platformPartition = `persist:platform-${platformKey}`
      const checkSession = session.fromPartition(platformPartition, { cache: true })
      
      // 支持多域名（快手等平台 Cookie 分布在多个域名）
      const cookieDomains = platform.cookieDomains || [platform.cookieUrl]
      let allCookies = []
      for (const url of cookieDomains) {
        try {
          const cs = await checkSession.cookies.get({ url })
          allCookies = allCookies.concat(cs)
        } catch (e) {}
      }
      // 去重
      const seen = new Set()
      const uniqueCookies = []
      for (const c of allCookies) {
        const key = `${c.domain}|${c.name}|${c.path}`
        if (!seen.has(key)) { seen.add(key); uniqueCookies.push(c) }
      }
      
      const keyCheck = detectLoginCookies(platformKey, uniqueCookies)
      
      if (!keyCheck.loggedIn) {
        // 未登录，自动打开登录窗口
        console.log(`[自动重新登录] ${platform.name} 需要重新登录，打开登录窗口...`)
        
        const { accountId } = openLoginWindow(platformKey, mainWindow, acc.id)
        currentLoginAccountId = accountId
        
        reloginCount++
        
        // 等待用户完成登录（不阻塞其他账号）
      }
    }
    
    return { 
      success: true, 
      count: reloginCount,
      message: `已打开 ${reloginCount} 个登录窗口，请完成扫码登录` 
    }
  } catch (error) {
    console.error('[自动重新登录] 失败:', error)
    return { success: false, message: error.message }
  }
})

// ==================== 内嵌 Webview 标签浏览器（融媒宝风格）====================

// 切换主窗口内 <webview> 的 session 到指定账号的 partition
ipcMain.handle('webview:switch-session', async (_, { partition, url }) => {
  try {
    if (!mainWindow) return { success: false, message: '主窗口未就绪' }
    
    // 获取目标 session
    const targetSession = session.fromPartition(partition, { cache: true })
    
    // 获取 cookie 数量
    let cookieCount = 0
    try {
      const cookies = await targetSession.cookies.get({})
      cookieCount = cookies.length
    } catch(e) {}
    
    console.log(`[Webview] 切换到 session ${partition}, 已有 ${cookieCount} 个 Cookie`)
    
    // 返回结果，让前端决定是否需要 reload
    // 注意：Electron 的 <webview> 不能直接切换 session
    // 解决方案：通过 preload 注入脚本，将目标 session 的 cookies 复制到 webview 当前使用的 session
    // 或者更简单：使用默认 session，通过 JS 注入 cookies
    
    // 这里采用更实用的方案：返回成功，让 webview 直接导航到 URL
    // 登录态通过后续的 cookie 注入实现
    return { success: true, message: `Session 已切换到 ${partition}`, cookieCount }
  } catch(error) {
    console.error('[Webview] Session 切换失败:', error)
    return { success: false, message: error.message }
  }
})

// 从当前 <webview> 保存为账号（提取 webview 内部 session 的 cookies）
ipcMain.handle('webview:save-account', async (_, accountData) => {
  try {
    const { accountId, platformKey, platformName, url, title, domain, partition } = accountData
    console.log(`[Webview保存账号] 平台: ${platformName}, URL: ${url}, partition: ${partition}`)
    
    // 从指定的 partition 获取 session（关键！这样才能获取到正确的 cookies）
    const sourcePartition = partition || 'persist:default'
    const sourceSession = session.fromPartition(sourcePartition, { cache: true })
    
    // 提取 cookies
    let allCookies = []
    const cookieUrls = new Set()
    
    // ✅ 修复：优先使用平台配置的 cookieDomains（多域名覆盖）
    const platformConfig = SUPPORTED_PLATFORMS[platformKey]
    const cookieDomains = platformConfig?.cookieDomains || []
    
    if (cookieDomains.length > 0) {
      // 使用平台配置的多域名列表
      for (const domainUrl of cookieDomains) {
        cookieUrls.add(domainUrl)
        // 同时加 http 版本
        if (domainUrl.startsWith('https://')) {
          cookieUrls.add(domainUrl.replace('https://', 'http://'))
        }
      }
      console.log(`[Webview保存] 使用平台多域名:`, cookieDomains)
    } else {
      // 兜底：使用 domain 和 url
      if (domain) {
        cookieUrls.add(`https://${domain}`)
        cookieUrls.add(`http://${domain}`)
      }
      if (url) {
        try {
          const urlObj = new URL(url)
          cookieUrls.add(url)
          cookieUrls.add(`${urlObj.protocol}//${urlObj.hostname}`)
        } catch(e) {}
      }
    }
    
    for (const cUrl of cookieUrls) {
      try {
        const cs = await sourceSession.cookies.get({ url: cUrl })
        allCookies = allCookies.concat(cs)
      } catch(e) {}
    }
    
    // 去重
    const seen = new Set()
    allCookies = allCookies.filter(c => { const k = `${c.domain}|${c.name}|${c.path}`; if(seen.has(k))return false; seen.add(k); return true })
    
    console.log(`[Webview保存] 获取到 ${allCookies.length} 个 Cookie`)
    
    // 写入独立 partition
    const targetPartition = `persist:account-${accountId}`
    const targetSession = session.fromPartition(targetPartition, { cache: true })
    for (const c of allCookies) {
      try {
        targetSession.cookies.set({
          url: `https://${c.domain.replace(/^\./, '')}${c.path}`,
          name: c.name, value: c.value, domain: c.domain,
          path: c.path || '/', secure: c.secure || false,
          httpOnly: c.httpOnly || false,
          sameSite: c.sameSite || 'no_restriction',
          expirationDate: c.expirationDate || (Date.now() / 1000 + 86400 * 365)
        })
      } catch(e) {}
    }
    
    // 保存账号记录
    const accounts = store.get('accounts', [])
    const newAccount = {
      id: accountId, platform: platformKey, platformName: platformName,
      name: `${platformName} #${accounts.filter(a => a.platform === platformKey).length + 1}`,
      userName: '', status: '已登录',
      cookieTime: new Date().toISOString(),
      partition: targetPartition, url, domain
    }
    accounts.push(newAccount)
    store.set('accounts', accounts)
    
    // 通知前端
    mainWindow.webContents.send('accounts-updated')
    
    return { success: true, accountId, cookieCount: allCookies.length, message: `${platformName} 账号已保存` }
  } catch(error) {
    console.error('[Webview保存] 失败:', error)
    return { success: false, message: error.message }
  }
})


// ==================== 浏览器工作台（Chromium 集成）====================
let browserPanelWindow = null
let browserPanelSessions = {}  // 存储各账号的 session 引用

// ==================== 内嵌浏览器（BrowserView，并列显示）====================
// 创建/显示内嵌浏览器（在主窗口右侧并列显示，像 Chrome 那样）
ipcMain.handle('browser-view:create', async (event, { url, accountId, platformKey } = {}) => {
  try {
    if (!mainWindow) return { success: false, message: '主窗口未就绪' }

    // ✅ 修复：拦截非 HTTP(S) 协议的 URL（如 bytedance:// snssdk1128:// weixin:// 等）
    // 这些深度链接会导致 Windows 弹出"查找应用"对话框
    if (url && !url.match(/^https?:\/\//i)) {
      console.warn(`[BrowserView] ⚠️ 拦截非HTTP协议URL: ${url}, accountId=${accountId}`)
      // 尝试根据 platformKey 推导正确的 HTTPS URL
      const SUPPORTED_PLATFORMS = require('./automation-login').SUPPORTED_PLATFORMS
      if (platformKey && SUPPORTED_PLATFORMS[platformKey]?.loginUrl) {
        url = SUPPORTED_PLATFORMS[platformKey].loginUrl
        console.log(`[BrowserView] ✅ 已替换为平台默认URL: ${url}`)
      } else {
        url = 'about:blank'
        console.warn(`[BrowserView] 无法推导正确URL，使用 about:blank`)
      }
    }

    // 确定 session 分区
    let partition = 'persist:default'
    if (accountId) partition = `persist:account-${accountId}`
    else if (platformKey) partition = `persist:platform-${platformKey}`

    const viewSession = session.fromPartition(partition, { cache: true })

    // ✅ 修复：伪装为普通 Chrome 浏览器，避免快手/企鹅号/网易号等平台的反爬检测返回JSON
    viewSession.webRequest.onBeforeSendHeaders((details, callback) => {
      details.requestHeaders['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
      callback({ requestHeaders: details.requestHeaders })
    })

    // 如果已存在 BrowserView，先销毁
    if (browserView) {
      mainWindow.removeBrowserView(browserView)
      browserView = null
    }

    // 创建 BrowserView
    browserView = new BrowserView({
      webPreferences: {
        session: viewSession,
        nodeIntegration: false,
        contextIsolation: true,
        webSecurity: true,
        allowDisplayingInsecureContent: true,
      }
    })

    // 设置初始大小（右侧模式：占满窗口右半部分，工具栏在顶部，底部留56px给导航栏）
    const [width, height] = mainWindow.getContentSize()
    const titleBarHeight = 34       // 自定义标题栏高度
    const bvToolbarHeight = 40      // BV 工具栏高度
    const bottomTabBarHeight = 56   // 底部导航栏高度（新增）
    const leftPanelWidth = Math.floor(width * 0.5)   // 左侧面板默认50%宽度
    const viewX = leftPanelWidth    // BrowserView从左侧面板右边开始
    const viewWidth = width - leftPanelWidth  // 剩余宽度给浏览器
    const viewHeight = height - titleBarHeight - bvToolbarHeight - bottomTabBarHeight  // 高度=窗口-标题栏-工具栏-底部导航栏
    
    browserView.setBounds({
      x: viewX,                              // 左侧面板右边
      y: titleBarHeight + bvToolbarHeight,   // 标题栏+工具栏下方
      width: viewWidth,                      // 占满剩余宽度
      height: viewHeight                     // 工具栏下方到底部导航栏上方
    })
    browserView.setAutoResize({ width: false, height: true, horizontal: false, vertical: true })

    // 拦截新窗口：让点击链接在同一BrowserView内打开（不弹窗）
    browserView.webContents.setWindowOpenHandler(({ url }) => {
      console.log('[BrowserView] 拦截新窗口，内部导航到:', url)
      browserView.webContents.loadURL(url)
      return { action: 'deny' }  // 阻止弹出新窗口
    })

    mainWindow.addBrowserView(browserView)
    browserViewVisible = true
    browserViewWidth = viewWidth
    browserViewHeight = viewHeight
    currentSplitterPos = leftPanelWidth  // 记录当前分隔条位置

    // ✅ 反检测：在每个页面加载完成后注入反检测脚本（隐藏 webdriver 等自动化特征）
    const bvContents = browserView.webContents
    bvContents.on('dom-ready', () => {
      try {
        bvContents.executeJavaScript(`
          if (!window.__antiDetectInjected) {
            window.__antiDetectInjected = true;
            // 隐藏 webdriver 标志（最关键！DeepSeek/ChatGPT 等都检测这个）
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
            // 伪装 chrome.runtime
            if (window.chrome) {
              window.chrome.runtime = {};
            }
            // 伪装 permissions API
            const origQuery = window.navigator.permissions?.query;
            if (origQuery) {
              window.navigator.permissions.query = (params) =>
                params.name === 'notifications'
                  ? Promise.resolve({ state: Notification.permission })
                  : origQuery(params);
            }
            // 伪装 plugins
            Object.defineProperty(navigator, 'plugins', {
              get: () => [1, 2, 3, 4, 5]
            });
            // 伪装 languages
            Object.defineProperty(navigator, 'languages', {
              get: () => ['zh-CN', 'zh', 'en-US', 'en']
            });
            console.log('[反检测-BV] ✅ 已隐藏自动化特征');
          }
        `).catch(() => {})
      } catch(e) {}
    })

    // 导航到指定 URL 或默认页
    const targetUrl = url || 'https://www.baidu.com'
    browserView.webContents.loadURL(targetUrl)

    console.log(`[BrowserView] 已创建(右侧模式)，URL: ${targetUrl}, session: ${partition}, 尺寸:${viewWidth}x${viewHeight}, x:${viewX}`)
    return { success: true, message: '浏览器已打开', width: viewWidth, height: viewHeight }
  } catch (error) {
    console.error('[BrowserView] 创建失败:', error)
    return { success: false, message: error.message }
  }
})

// 隐藏内嵌浏览器
ipcMain.handle('browser-view:hide', () => {
  try {
    if (browserView && mainWindow) {
      mainWindow.removeBrowserView(browserView)
      browserViewVisible = false
      console.log('[BrowserView] 已隐藏')
    }
    return { success: true }
  } catch (error) {
    return { success: false, message: error.message }
  }
})

// 显示内嵌浏览器（右侧模式）
ipcMain.handle('browser-view:show', () => {
  try {
    if (browserView && mainWindow) {
      const [width, height] = mainWindow.getContentSize()
      const titleBarHeight = 34
      const bvToolbarHeight = 40
      const splitPos = currentSplitterPos || Math.floor(width * 0.5)

      browserView.setBounds({
        x: splitPos,
        y: titleBarHeight + bvToolbarHeight,
        width: width - splitPos,
        height: height - titleBarHeight - bvToolbarHeight
      })
      mainWindow.addBrowserView(browserView)
      browserViewVisible = true
      console.log('[BrowserView] 已显示(右侧模式)')
    }
    return { success: true }
  } catch (error) {
    return { success: false, message: error.message }
  }
})

// 导航控制
ipcMain.handle('browser-view:navigate', (_, url) => {
  try {
    if (browserView) {
      if (!url.startsWith('http')) url = 'https://' + url
      browserView.webContents.loadURL(url)
      console.log(`[BrowserView] 导航到: ${url}`)
    }
    return { success: true }
  } catch (error) {
    return { success: false, message: error.message }
  }
})

ipcMain.handle('browser-view:go-back', () => {
  try {
    if (browserView && browserView.webContents.canGoBack()) {
      browserView.webContents.goBack()
    }
    return { success: true }
  } catch (error) {
    return { success: false, message: error.message }
  }
})

ipcMain.handle('browser-view:go-forward', () => {
  try {
    if (browserView && browserView.webContents.canGoForward()) {
      browserView.webContents.goForward()
    }
    return { success: true }
  } catch (error) {
    return { success: false, message: error.message }
  }
})

ipcMain.handle('browser-view:reload', () => {
  try {
    if (browserView) {
      browserView.webContents.reload()
    }
    return { success: true }
  } catch (error) {
    return { success: false, message: error.message }
  }
})

// 调整 BrowserView 宽度（左右拖拽调整）
ipcMain.handle('browser-view:resize', (_, newSize) => {
  try {
    if (browserView && mainWindow) {
      const [winWidth, winHeight] = mainWindow.getContentSize()
      const titleBarHeight = 34
      const bvToolbarHeight = 40

      let newWidth = newSize
      if (typeof newSize === 'string' && newSize.endsWith('%')) {
        // newSize是右侧占比，比如"50%"表示右侧占50%
        const rightPct = parseFloat(newSize) / 100
        newWidth = Math.floor(winWidth * rightPct)
      }

      newWidth = Math.max(200, Math.min(newWidth, winWidth - 280))

      const splitPos = winWidth - newWidth
      currentSplitterPos = splitPos

      browserView.setBounds({
        x: splitPos,
        y: titleBarHeight + bvToolbarHeight,
        width: newWidth,
        height: winHeight - titleBarHeight - bvToolbarHeight
      })
      console.log(`[BrowserView] 分隔条位置调整为: ${splitPos}px, 浏览器宽度: ${newWidth}px`)
    }
    return { success: true, splitPos: currentSplitterPos }
  } catch (error) {
    return { success: false, message: error.message }
  }
})

// 更新分隔条位置（由前端拖拽触发）
let currentSplitterPos = null  // 当前分隔条x坐标
ipcMain.handle('browser-view:update-splitter', (_, leftPanelWidth) => {
  try {
    if (browserView && mainWindow) {
      const [winWidth, winHeight] = mainWindow.getContentSize()
      const titleBarHeight = 34
      const bvToolbarHeight = 40

      currentSplitterPos = leftPanelWidth

      browserView.setBounds({
        x: leftPanelWidth,
        y: titleBarHeight + bvToolbarHeight,
        width: winWidth - leftPanelWidth,
        height: winHeight - titleBarHeight - bvToolbarHeight
      })
      console.log(`[BrowserView] 分隔条拖拽更新: 左侧=${leftPanelWidth}px`)
    }
    return { success: true, splitPos: currentSplitterPos }
  } catch (error) {
    return { success: false, message: error.message }
  }
})

// 获取当前 URL（供地址栏显示）
ipcMain.handle('browser-view:get-url', () => {
  try {
    if (browserView) {
      const url = browserView.webContents.getURL()
      const title = browserView.webContents.getTitle()
      return { success: true, url, title }
    }
    return { success: false, message: '浏览器未打开' }
  } catch (error) {
    return { success: false, message: error.message }
  }
})

// 在 BrowserView 中执行 JavaScript（用于样式注入等）
ipcMain.handle('browser-view:execute-js', async (_, jsCode) => {
  try {
    if (!browserView) {
      return { success: false, message: '浏览器未打开', result: null }
    }
    const result = await browserView.webContents.executeJavaScript(jsCode)
    return { success: true, result }
  } catch (error) {
    return { success: false, message: error.message, result: null }
  }
})

// ==================== 浏览器 Cookie 提取 & 账号保存 ====================
// 从 BrowserView 的 session 提取 Cookies（用于保存账号，支持任意域名）
ipcMain.handle('browser-view:extract-cookies', async (event, platformKey) => {
  try {
    if (!browserView) {
      return { success: false, message: '浏览器未打开', cookies: [] }
    }

    // 获取 BrowserView 的 session
    const viewSession = browserView.webContents.session
    
    // 获取当前 URL 来确定 cookie 域名（支持任意平台，不再依赖 SUPPORTED_PLATFORMS）
    const currentUrl = browserView.webContents.getURL() || 'https://www.baidu.com'
    
    // 构造 URL 列表（尽可能多地获取 cookies）
    const cookieUrls = new Set()
    try {
      const urlObj = new URL(currentUrl)
      cookieUrls.add(currentUrl)
      cookieUrls.add(`${urlObj.protocol}//${urlObj.hostname}`)
      if (urlObj.hostname.startsWith('www.')) {
        cookieUrls.add(`${urlObj.protocol}//${urlObj.hostname.substring(4)}`)
      } else {
        cookieUrls.add(`${urlObj.protocol}//www.${urlObj.hostname}`)
      }
    } catch(e) {}
    // 如果有 platformKey 且是已知平台，也用原来的 cookieUrl
    if (platformKey && SUPPORTED_PLATFORMS[platformKey]) {
      const platform = SUPPORTED_PLATFORMS[platformKey]
      if (platform.cookieUrl) cookieUrls.add(platform.cookieUrl)
      if (platform.cookieDomains) {
        for (const d of platform.cookieDomains) cookieUrls.add(d)
      }
    }
    
    let allCookies = []
    for (const cUrl of cookieUrls) {
      try {
        const cs = await viewSession.cookies.get({ url: cUrl })
        allCookies = allCookies.concat(cs)
      } catch (e) {}
    }
    
    // 去重
    const seen = new Set()
    allCookies = allCookies.filter(c => {
      const key = `${c.domain}|${c.name}|${c.path}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    
    console.log(`[Cookie提取] 平台: ${platformKey || '任意'}, URL: ${currentUrl}, 获取到 ${allCookies.length} 个 Cookie`)
    
    return { success: true, cookies: allCookies, count: allCookies.length }
  } catch (error) {
    console.error('[Cookie提取] 失败:', error)
    return { success: false, message: error.message, cookies: [] }
  }
})

// 保存浏览器账号（将 BrowserView 的 Cookies 写入指定 partition，并保存账号记录）
ipcMain.handle('browser-view:save-account', async (event, { accountId, platformKey, cookies }) => {
  try {
    // 1. 确定目标 session 分区
    const targetPartition = `persist:account-${accountId}`
    const targetSession = session.fromPartition(targetPartition, { cache: true })

    // 2. 将 Cookies 写入目标 session
    for (const cookie of cookies) {
      try {
        const cookieData = {
          url: `https://${cookie.domain.replace(/^\./, '')}${cookie.path}`,
          name: cookie.name,
          value: cookie.value,
          domain: cookie.domain,
          path: cookie.path,
          secure: cookie.secure,
          httpOnly: cookie.httpOnly,
          sameSite: cookie.sameSite || 'no_restriction'
        }
        if (cookie.expirationDate) {
          cookieData.expirationDate = cookie.expirationDate
        }
        await targetSession.cookies.set(cookieData)
      } catch (e) {
        console.log(`[Cookie写入] 失败: ${cookie.name}, 错误: ${e.message}`)
      }
    }

    console.log(`[账号保存] 已写入 ${cookies.length} 个 Cookie 到 ${targetPartition}`)

    // 3. 获取用户名（尝试从页面获取）
    let userName = ''
    try {
      userName = await browserView.webContents.executeJavaScript(`
        (function() {
          const selectors = [
            '.user-name', '#user-name', '[class*="user"]', '[class*="name"]',
            'h1', 'h2', '.nickname', '[class*="nick"]'
          ];
          for (let s of selectors) {
            const el = document.querySelector(s);
            if (el && el.textContent.trim()) return el.textContent.trim().substring(0, 50);
          }
          return '';
        })()
      `)
    } catch (e) {}

    // 4. 获取平台名称（支持任意平台，不再依赖 SUPPORTED_PLATFORMS）
    let platformName = platformKey || '未知平台'
    
    // 尝试从已知平台列表匹配
    if (SUPPORTED_PLATFORMS[platformKey]) {
      platformName = SUPPORTED_PLATFORMS[platformKey].name
    }
    
    // 5. 使用 store 统一管理（替代原来的文件读写）
    let accounts = store.get('accounts', [])
    const existingIndex = accounts.findIndex(acc => acc.id === accountId)

    const newAccount = {
      id: accountId,
      platform: platformKey,
      platformName: platformName,
      name: userName || `${platformName} #${accounts.filter(a => a.platform === platformKey).length + 1}`,
      userName: userName || '',
      status: '已登录',
      cookieTime: new Date().toISOString(),
      partition: targetPartition
    }

    if (existingIndex >= 0) {
      accounts[existingIndex] = { ...accounts[existingIndex], ...newAccount }
    } else {
      accounts.push(newAccount)
    }
    store.set('accounts', accounts)
    console.log(`[账号保存] 已保存账号: ${newAccount.name}`)

    // 7. 通知渲染进程刷新账号列表
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('accounts-updated', accounts)
    }

    return { success: true, account: newAccount, userName }
  } catch (error) {
    console.error('[账号保存] 失败:', error)
    return { success: false, message: error.message }
  }
})

// ==================== 原有独立浏览器窗口（保留兼容）====================
// 浏览器工作台 — 不再创建子窗口！改为通知前端在 right-browser-panel 内显示
ipcMain.handle('browser:open-panel', async (event, { accountId, platformKey } = {}) => {
  try {
    // 不再创建 BrowserWindow 子窗口！
    // 直接通知前端在 HTML 的 .right-browser-panel 中打开
    if (mainWindow) {
      mainWindow.webContents.send('browser:open-in-panel', { accountId, platformKey })
    }
    console.log(`[浏览器面板] ✅ 通知前端显示内嵌浏览器 (accountId: ${accountId || '无'})`)
    return { success: true, message: '已通知前端打开浏览器面板' }
  } catch (error) {
    console.error('[浏览器面板] 处理失败:', error)
    return { success: false, message: error.message }
  }
})

// 为指定账号打开浏览器工作台（专用 IPC）
ipcMain.handle('browser:open-for-account', async (event, { accountId, platformKey }) => {
  return await ipcMain.handle('browser:open-panel')(event, { accountId, platformKey })
})

// 浏览器截图（简化版 - 保存页面信息）
ipcMain.handle('browser:screenshot', async (_, pageInfo) => {
  try {
    const fs = require('fs')
    const screenshotsDir = join(app.getPath('userData'), 'screenshots')
    
    // 确保目录存在
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true })
    }

    // 保存页面快照（文本形式）
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const filename = `snapshot_${timestamp}.json`
    const filepath = join(screenshotsDir, filename)

    fs.writeFileSync(filepath, JSON.stringify(pageInfo, null, 2), 'utf-8')

    console.log(`[浏览器截图] 已保存: ${filepath}`)
    
    return { 
      success: true, 
      path: filepath, 
      msg: `页面快照已保存 (${pageInfo.url.substring(0, 50)}...)` 
    }
  } catch (error) {
    console.error('[浏览器截图] 失败:', error)
    return { success: false, message: error.message }
  }
})

// 浏览器 Cookie 保存
ipcMain.handle('browser:save-cookies', async (_, { url, cookies, count }) => {
  try {
    // 解析 URL 获取域名
    let domain = ''
    try {
      const urlObj = new URL(url)
      domain = urlObj.hostname
    } catch (e) {
      domain = 'unknown'
    }

    // 匹配平台
    let matchedPlatform = null
    for (const [key, platform] of Object.entries(SUPPORTED_PLATFORMS)) {
      if (domain.includes(key) || platform.cookieUrl.includes(domain)) {
        matchedPlatform = key
        break
      }
    }

    if (matchedPlatform) {
      // 保存到 store
      const existingCookies = store.get(`cookies.${matchedPlatform}`, [])
      
      // 合并 cookies（简单追加）
      for (const cookieStr of cookies) {
        const [name, value] = cookieStr.split('=').map(s => s.trim())
        if (name && !existingCookies.find(c => c.name === name)) {
          existingCookies.push({
            name,
            value: value || '',
            domain: domain,
            path: '/',
            secure: url.startsWith('https'),
            httpOnly: false,
            sameSite: 'no_restriction',
            expirationDate: Date.now() / 1000 + 86400 * 365  // 1年有效
          })
        }
      }

      store.set(`cookies.${matchedPlatform}`, existingCookies)
      console.log(`[Cookie保存] 平台: ${matchedPlatform}, 数量: ${existingCookies.length}`)
      
      return { 
        success: true, 
        count: existingCookies.length, 
        msg: `Cookie 已保存到 ${SUPPORTED_PLATFORMS[matchedPlatform]?.name || matchedPlatform}` 
      }
    } else {
      return { 
        success: false, 
        count, 
        message: `未识别的平台: ${domain}` 
      }
    }
  } catch (error) {
    console.error('[Cookie保存] 失败:', error)
    return { success: false, message: error.message }
  }
})


// ==================== Cookie 导出 ====================
ipcMain.handle('browser:export-cookies', async (_, { url, cookieString, accountId, platformKey }) => {
  try {
    const fs = require('fs')
    const path = require('path')
    const cookiesDir = join(app.getPath('userData'), 'cookies')
    
    if (!fs.existsSync(cookiesDir)) {
      fs.mkdirSync(cookiesDir, { recursive: true })
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const filename = `cookies_${platformKey || 'unknown'}_${timestamp}.txt`
    const filepath = join(cookiesDir, filename)

    fs.writeFileSync(filepath, cookieString, 'utf-8')

    console.log(`[Cookie导出] 已保存: ${filepath}`)
    return { success: true, path: filepath, message: `Cookie 已导出到: ${filename}` }
  } catch (error) {
    console.error('[Cookie导出] 失败:', error)
    return { success: false, message: error.message }
  }
})


// ==================== 浏览器工作台窗口控制（苹果风格圆点按钮）====================
ipcMain.handle('browser-window:minimize', () => {
  if (browserPanelWindow && !browserPanelWindow.isDestroyed()) {
    browserPanelWindow.minimize()
  }
  return { success: true }
})

ipcMain.handle('browser-window:maximize', () => {
  if (browserPanelWindow && !browserPanelWindow.isDestroyed()) {
    if (browserPanelWindow.isMaximized()) {
      browserPanelWindow.unmaximize()
    } else {
      browserPanelWindow.maximize()
    }
  }
  return { success: true }
})

ipcMain.handle('browser-window:close', () => {
  if (browserPanelWindow && !browserPanelWindow.isDestroyed()) {
    browserPanelWindow.close()
    browserPanelWindow = null
  }
  return { success: true }
})

// ==================== 浏览器标签数据持久化 ====================
// 保存浏览器标签页数据
ipcMain.handle('browser:save-tabs', async (_, data) => {
  try {
    store.set('browserTabs', {
      tabs: data.tabs || [],
      activeTabId: data.activeTabId || null,
      savedAt: new Date().toISOString()
    })
    return { success: true }
  } catch (error) {
    console.error('[标签保存] 失败:', error)
    return { success: false, message: error.message }
  }
})

// 加载浏览器标签页数据
ipcMain.handle('browser:load-tabs', () => {
  try {
    const data = store.get('browserTabs', null)
    return data || { tabs: [], activeTabId: null }
  } catch (error) {
    console.error('[标签加载] 失败:', error)
    return { tabs: [], activeTabId: null }
  }
})


// ==================== 一键添加账号（从浏览器面板提取 Cookie，不限平台版）====================
ipcMain.handle('browser:save-account-from-panel', async (_, accountData) => {
  try {
    const fs = require('fs')
    
    const { accountId, platformKey, platformName, url, domain } = accountData
    console.log(`[一键添加账号] 平台: ${platformName}, URL: ${url}`)
    
    // 1. 获取 BrowserPanel 的 session cookies（不限域名！）
    let allCookies = []
    
    if (browserPanelWindow && !browserPanelWindow.isDestroyed()) {
      try {
        // 尝试从 session 获取完整 cookies（包括 httpOnly）
        const panelSession = browserPanelWindow.webContents.session
        
        // 构造 cookie URL 列表（支持任意域名）
        const cookieUrls = new Set()
        if (domain) {
          cookieUrls.add(`https://${domain}`)
          cookieUrls.add(`http://${domain}`)
        }
        if (url) {
          try { 
            const urlObj = new URL(url)
            cookieUrls.add(url)
            cookieUrls.add(`${urlObj.protocol}//${urlObj.hostname}`)
            cookieUrls.add(`${urlObj.protocol}//${urlObj.hostname}:${urlObj.port || (urlObj.protocol === 'https:' ? '443' : '80')}`)
          } catch(e) {}
        }
        
        for (const cUrl of cookieUrls) {
          try {
            const cs = await panelSession.cookies.get({ url: cUrl })
            allCookies = allCookies.concat(cs)
          } catch (e) {}
        }
        
        // 去重
        const seen = new Set()
        allCookies = allCookies.filter(c => {
          const key = `${c.domain}|${c.name}|${c.path}`
          if (seen.has(key)) return false
          seen.add(key)
          return true
        })
      } catch (e) {
        console.log('[一键添加账号] Session cookie 获取失败，使用 document.cookie:', e.message)
        // fallback 到前端传来的 document.cookie
        if (accountData.cookies) {
          for (const cStr of accountData.cookies.split(';')) {
            const [name, value] = cStr.trim().split('=').map(s => s.trim())
            if (name && value) {
              allCookies.push({
                name, value,
                domain: domain || '',
                path: '/',
                secure: url.startsWith('https'),
                httpOnly: false,
                sameSite: 'no_restriction'
              })
            }
          }
        }
      }
    }
    
    console.log(`[一键添加账号] 获取到 ${allCookies.length} 个 Cookie`)
    
    // 2. 将 Cookies 写入账号独立 partition（每个账号独立隔离）
    const targetPartition = `persist:account-${accountId}`
    const targetSession = session.fromPartition(targetPartition, { cache: true })
    
    for (const cookie of allCookies) {
      try {
        await targetSession.cookies.set({
          url: `https://${cookie.domain.replace(/^\./, '')}${cookie.path}`,
          name: cookie.name,
          value: cookie.value,
          domain: cookie.domain,
          path: cookie.path || '/',
          secure: cookie.secure || false,
          httpOnly: cookie.httpOnly || false,
          sameSite: cookie.sameSite || 'no_restriction',
          expirationDate: cookie.expirationDate || (Date.now() / 1000 + 86400 * 365)
        })
      } catch (e) {
        console.log(`[Cookie写入] 失败: ${cookie.name}, 错误: ${e.message}`)
      }
    }
    
    // 3. 尝试获取用户名（从页面提取）
    let userName = ''
    try {
      if (browserPanelWindow && !browserPanelWindow.isDestroyed()) {
        userName = await browserPanelWindow.webContents.executeJavaScript(`
          (function() {
            const selectors = [
              '.user-name', '#user-name', '[class*="user"]', '[class*="name"]',
              '.nickname', '[class*="nick"]', 'h1', 'h2',
              // 更多通用选择器
              '.username', '#username', '.profile-name', '.author-name',
              '[data-username]', '.account-name', '.display-name'
            ];
            for (let s of selectors) {
              const el = document.querySelector(s);
              if (el && el.textContent.trim()) return el.textContent.trim().substring(0, 50);
            }
            // 从 title 提取
            return document.title.substring(0, 50);
          })()
        `)
      }
    } catch (e) {}
    
    // 4. 保存/更新账号记录到 store（支持任意平台！不再依赖 SUPPORTED_PLATFORMS）
    const accounts = store.get('accounts', [])
    const existingIndex = accounts.findIndex(acc => acc.id === accountId)
    
    const newAccount = {
      id: accountId,
      platform: platformKey,
      platformName: platformName,
      name: userName || `${platformName} #${accounts.filter(a => a.platform === platformKey).length + 1}`,
      userName: userName || '',
      status: '已登录',
      cookieTime: new Date().toISOString(),
      partition: targetPartition,
      // 额外信息（自定义平台的 URL 记录）
      url: url,
      domain: domain
    }
    
    if (existingIndex >= 0) {
      accounts[existingIndex] = { ...accounts[existingIndex], ...newAccount }
    } else {
      accounts.push(newAccount)
    }
    store.set('accounts', accounts)
    
    console.log(`[一键添加账号] ✅ 成功！账号: ${newAccount.name}, Cookie数: ${allCookies.length}`)
    
    // 5. 通知主窗口刷新账号列表
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('accounts-updated')
    }
    
    return {
      success: true,
      accountId,
      userName,
      cookieCount: allCookies.length,
      message: `${platformName} 账号已成功添加（${allCookies.length} 个 Cookie）`
    }
  } catch (error) {
    console.error('[一键添加账号] 失败:', error)
    return { success: false, message: error.message }
  }
})


// ==================== 保存为模板 ====================
ipcMain.handle('browser:save-template', async (_, templateData) => {
  try {
    const fs = require('fs')
    const path = require('path')
    const templatesDir = join(app.getPath('userData'), 'templates')
    
    if (!fs.existsSync(templatesDir)) {
      fs.mkdirSync(templatesDir, { recursive: true })
    }

    // 生成模板名称
    const templateName = `${templateData.platformKey || 'unknown'}_${Date.now()}`
    const filename = `${templateName}.json`
    const filepath = join(templatesDir, filename)

    const template = {
      name: templateName,
      platformKey: templateData.platformKey,
      accountId: templateData.accountId,
      url: templateData.url,
      title: templateData.title,
      domain: templateData.domain,
      cookies: templateData.cookies,
      timestamp: templateData.timestamp,
      createdAt: new Date().toISOString()
    }

    fs.writeFileSync(filepath, JSON.stringify(template, null, 2), 'utf-8')

    console.log(`[模板保存] 已保存: ${filepath}`)
    return { 
      success: true, 
      name: templateName,
      path: filepath,
      message: `模板已保存: ${templateName}` 
    }
  } catch (error) {
    console.error('[模板保存] 失败:', error)
    return { success: false, message: error.message }
  }
})


// ==================== AI 模型配置 ====================

// 保存 AI API 配置
ipcMain.handle('ai:save-config', async (_, { provider, config }) => {
  try {
    const configs = store.get('ai_apis', {})
    configs[provider] = config
    store.set('ai_apis', configs)
    return { success: true }
  } catch (error) {
    return { success: false, message: error.message }
  }
})

// 获取 AI API 配置
ipcMain.handle('ai:get-config', async (_, provider) => {
  try {
    const configs = store.get('ai_apis', {})
    return configs[provider] || null
  } catch (error) {
    return null
  }
})

// ==================== AI 创作 ====================

// 加载 ai_models 模块
let aiModelsModule = null
try {
  aiModelsModule = require('./ai_models.js')
} catch (e) {
  console.log('ai_models.js 未找到，使用内置 AI 逻辑')
}

// 模拟内容生成（AI 不可用时的兜底）
function generateFallbackContent(prompt) {
  const topic = prompt.replace(/生成.*?[:：]/, '').replace(/写一篇.*?[:：]/, '').trim()
  
  return `# ${topic || 'AI 创作内容'}

> 由 D&E Media 生成 | ${new Date().toLocaleDateString('zh-CN')}

## 引言

${topic} 是当下备受关注的话题。随着行业的快速发展，这一领域正在经历深刻的变革。

## 核心观点

### 观点一：趋势研判

从当前市场表现来看，${topic} 的发展呈现出明显的加速态势。相关数据显示，过去一年中该领域的投入增长了 35%，预计这一趋势将在未来持续。

### 观点二：技术驱动

技术进步是推动 ${topic} 发展的核心动力。新技术的应用不仅提升了效率，也创造了全新的商业模式和机会。

### 观点三：用户需求

用户需求的变化正在重塑整个行业格局。了解用户真实需求，才能在竞争中占据主动。

## 实战建议

1. **内容为王**：质量是核心竞争力，不要为了数量牺牲质量
2. **持续迭代**：根据数据反馈不断优化内容和策略
3. **多平台分发**：不要把鸡蛋放在一个篮子里，多平台布局降低风险
4. **建立私域**：把公域流量导入私域，建立长期用户关系

## 总结

${topic} 的机遇与挑战并存。只有那些能够持续创造价值、真正帮助用户的内容创作者，才能在这个时代脱颖而出。

---
*本文由 D&E Media AI 辅助生成，仅供参考*
`
}

// AI 生成内容（支持多模型）
ipcMain.handle('ai:generate', async (_, { prompt, task_type = 'general', model = 'agnes', modelType = 'text' }) => {
  try {
    // 如果使用多模型模块
    if (aiModelsModule) {
      console.log(`使用模型: ${model}...`)
      const result = await aiModelsModule.callAIModel(model, prompt)
      return {
        success: true,
        content: result.content,
        model: result.model,
        modelType: result.provider || 'unknown'
      }
    }
    
    // 回退：使用原有 Agnes AI 逻辑
    console.log(`使用 Agnes AI（帝意优选）- 模型类型: ${modelType}...`)
    const result = await callAgnesAI(prompt, task_type, modelType)
    return {
      success: true,
      content: result.content,
      model: AGNES_DISPLAY_NAME,
      modelType: 'agnes',
      agnesModelType: modelType
    }
  } catch (err) {
    console.error(`AI 调用失败: ${err.message}`)
    // AI 失败，返回本地生成内容
    return {
      success: false,
      content: generateFallbackContent(prompt),
      error: `AI 调用失败: ${err.message}`,
      model: '本地生成',
      modelType: 'fallback'
    }
  }
})

// AI 生成图片（使用 Agnes AI 图片生成模型）
ipcMain.handle('ai:generate-image', async (_, { prompt, options = {} }) => {
  try {
    console.log('调用 Agnes AI 图片生成...')
    const result = await callAgnesImage(prompt, options)
    return {
      success: true,
      url: result.url,
      model: AGNES_DISPLAY_NAME,  // 显示"帝意优选"
      modelType: 'image'
    }
  } catch (err) {
    console.error('图片生成失败:', err.message)
    return {
      success: false,
      error: err.message
    }
  }
})

// AI 生成视频（使用 Agnes AI 视频生成模型）
ipcMain.handle('ai:generate-video', async (_, { prompt, options = {} }) => {
  try {
    console.log('调用 Agnes AI 视频生成...')
    const result = await callAgnesVideo(prompt, options)
    return {
      success: true,
      video_id: result.video_id,
      model: AGNES_DISPLAY_NAME,  // 显示"帝意优选"
      modelType: 'video',
      status: 'processing'
    }
  } catch (err) {
    console.error('视频生成失败:', err.message)
    return {
      success: false,
      error: err.message
    }
  }
})

// AI 生成日报（使用 Agnes AI（帝意优选））
ipcMain.handle('ai:daily', async (_, { category = 'general' }) => {
  const categoryMap = {
    tech: '科技',
    finance: '财经',
    entertainment: '娱乐',
    sports: '体育',
    general: '综合'
  }
  
  const prompt = `请生成一份今日${categoryMap[category] || '综合'}领域的自媒体热点日报，包括：
1. 3-5条今日热点新闻（标题+简要说明）
2. 每条热点的传播数据分析（热点指数、讨论量）
3. 一条深度解读（200字左右）
4. 今日创作建议（给自媒体人的3条建议）

用 Markdown 格式输出，风格专业但不失亲和力。`
  
  try {
    console.log(`使用 Agnes AI（帝意优选）生成日报...`)
    const result = await callAgnesAI(prompt, 'daily', 'text')
    return {
      success: true,
      content: result.content,
      model: AGNES_DISPLAY_NAME
    }
  } catch (err) {
    console.error(`Agnes AI 日报生成失败: ${err.message}`)
    // Agnes AI 失败，返回本地生成内容
    const today = new Date().toLocaleDateString('zh-CN')
    const catName = categoryMap[category] || '综合'
    return {
      success: false,
      content: `# 帝意日报 - ${catName}版

> 由 D&E Media AI 自动生成 | ${today}

## 🔥 今日热点

### 1. AI 大模型新一轮竞赛开启
据介绍，多家科技公司同时发布新一代大模型产品，性能提升显著...

### 2. 全球科技股持续走强
受 AI 应用落地加速影响，相关科技公司股票持续上涨...

### 3. 新能源汽车市场格局生变
最新数据显示，新能源汽车渗透率突破新高...

## 💡 深度解读

（此处为 AI 自动生成的深度分析内容）

## 📊 数据看板

- 热点指数: ⬆️ 8.5%
- 讨论量: 12.3万
- 传播平台: 22个

---
*本报告由 D&E Media AI 系统自动生成*
`,
      error: `Agnes AI 调用失败: ${err.message}`,
      model: '本地生成'
    }
  }
})

// ==================== 热点搜索 ====================

// 搜索热点（返回热点列表，支持关键词过滤）
ipcMain.handle('hot:search', async (_, { keyword, limit = 10 }) => {
  try {
    // 模拟热点数据（实际使用时可以调用真实的热点 API）
    const mockHotList = [
      { title: 'AI 大模型新一轮竞赛开启', hot: '850万', category: '科技' },
      { title: '全球科技股持续走强', hot: '623万', category: '财经' },
      { title: '新能源汽车市场格局生变', hot: '512万', category: '汽车' },
      { title: '短视频运营实战技巧', hot: '423万', category: '自媒体' },
      { title: '内容创作爆款公式', hot: '398万', category: '自媒体' },
      { title: '微信公众号改版影响', hot: '356万', category: '自媒体' },
      { title: '知乎好物推荐攻略', hot: '312万', category: '电商' },
      { title: '小红书笔记排名技巧', hot: '287万', category: '自媒体' },
      { title: '头条号收益提升方法', hot: '254万', category: '自媒体' },
      { title: 'B站UP主变现路径', hot: '231万', category: '视频' },
      { title: '抖音算法最新调整', hot: '198万', category: '短视频' },
      { title: '快手内容推荐机制', hot: '176万', category: '短视频' },
      { title: '视频号流量密码', hot: '165万', category: '短视频' },
      { title: 'AI 写作工具对比', hot: '154万', category: '科技' },
      { title: 'ChatGPT 使用技巧', hot: '143万', category: '科技' }
    ]
    
    // 如果有关键词，过滤结果
    const filteredList = keyword 
      ? mockHotList.filter(item => 
          item.title.includes(keyword) || 
          item.category.includes(keyword) ||
          (item.title.toLowerCase().includes(keyword.toLowerCase()))
        )
      : mockHotList
    
    return {
      success: true,
      data: filteredList.slice(0, limit),
      source: '模拟数据（实际使用时可接入真实热点 API）'
    }
    
  } catch (error) {
    return {
      success: false,
      data: [],
      error: error.message
    }
  }
})

// ==================== AI 创作 IPC（已合并到上方主handler）====================

// ==================== 帝意日报模板导入 IPC ====================
ipcMain.handle('daily:import-template', async () => {
  try {
    const fs = require('fs')
    const path = require('path')
    
    // 查找日报模板文件（支持多个可能的位置）
    const possiblePaths = [
      path.join(__dirname, '../daily-template.html'),
      path.join(app.getPath('userData'), 'templates/daily.html'),
      path.join(__dirname, '../../../新媒体之王/generated-articles/preview_ranking.html'),
      'D:\\融媒体发布助手\\新媒体之王\\preview_ranking.html',
      join(__dirname, '../../generated-articles/preview_ranking.html')
    ]
    
    for (const templatePath of possiblePaths) {
      try {
        if (fs.existsSync(templatePath)) {
          const html = fs.readFileSync(templatePath, 'utf-8')
          console.log(`[帝意日报] ✅ 模板加载成功: ${templatePath}`)
          return { success: true, html: html, path: templatePath }
        }
      } catch(e) {}
    }
    
    // 如果找不到模板文件，返回一个默认模板
    const defaultTemplate = `
      <div style="font-family:'PingFang SC','Microsoft YaHei',sans-serif;max-width:800px;margin:0 auto;padding:20px;background:#fff;">
        <div style="text-align:center;padding:30px 0;background:linear-gradient(135deg,#c41e1a,#8b0000);color:#fff;border-radius:12px;margin-bottom:20px;">
          <h1 style="font-size:28px;font-weight:900;letter-spacing:4px;">📰 帝 意 日 报</h1>
          <p style="margin-top:8px;font-size:14px;opacity:0.9;">每日热点 · 排行榜单 · 数据洞察</p>
        </div>
        <div style="background:#fef3ef;border-left:4px solid #ff6b00;padding:16px 20px;border-radius:0 8px 8px 0;margin-bottom:24px;">
          <p style="font-size:15px;color:#995200;line-height:1.7;">📋 今日日报模板已就绪！<br>您可以通过「帝意日报 Suite」生成完整的排行榜内容，然后导入到这里。</p>
        </div>
        <div style="text-align:center;padding:40px;color:#ccc;">
          <p>— 帝意传媒出品 —</p>
        </div>
      </div>`
    
    console.log('[帝意日报] ⚠️ 使用默认模板（未找到外部文件）')
    return { success: true, html: defaultTemplate, path: 'default' }
    
  } catch (error) {
    console.error('[帝意日报] 导入失败:', error.message)
    return { success: false, html: null, error: error.message }
  }
})

// ==================== 帝意日报自动分发（跨软件联动）====================
// 读取「新媒体之王」生成的日报产物，通过已登录平台 session 自动填表分发
ipcMain.handle('diyi:list-articles', async () => {
  try {
    const { listArticles } = require('./diyi-distribute')
    return { success: true, data: listArticles() }
  } catch (e) {
    return { success: false, error: e.message }
  }
})

// 列出已保存账号（供一键分发选择目标账号）
ipcMain.handle('diyi:list-accounts', async () => {
  try {
    const accounts = store.get('accounts', [])
    return { success: true, data: accounts }
  } catch (e) {
    return { success: false, error: e.message }
  }
})

// ========== 帝意日报分发（IPC 与 HTTP 服务共用）==========
async function doDistribute({ articleName, platformKey, accountId = null, autoSubmit = false }) {
  try {
    if (!mainWindow) return { success: false, message: '主窗口未就绪' }
    const diyi = require('./diyi-distribute')
    const login = require('./automation-login')
    const platform = login.SUPPORTED_PLATFORMS[platformKey]
    if (!platform) return { success: false, message: '不支持的平台: ' + platformKey }

    const article = diyi.getArticle(articleName)
    if (!article) return { success: false, message: '日报产物不存在: ' + articleName }

    // ① 解析目标账号：优先指定 accountId，否则取该平台第一个已登录账号
    const accounts = store.get('accounts', [])
    let acc = accountId
      ? accounts.find(a => a.id === accountId)
      : accounts.find(a => a.platform === platformKey && a.status === '已登录')
    if (!acc) {
      return { success: false, message: `平台【${platform.name}】尚未登录，请先在「账号」中登录后再分发`, needLogin: true }
    }

    // ② 用账号 partition 恢复登录态（cookie 已随 persist 分区落盘，无需重登）
    const partition = acc.partition || `persist:account-${acc.id}`
    const sess = session.fromPartition(partition, { cache: true })
    const savedCookies = await sess.cookies.get({}).catch(() => [])
    if (!savedCookies || savedCookies.length === 0) {
      return { success: false, message: `账号【${acc.name}】登录态已失效，请重新登录`, needLogin: true }
    }

    // ③ 复用/创建 BrowserView：若当前 view 不是目标分区则重建（保证带登录态）
    let view = browserView
    let needNew = false
    if (!view || view.isDestroyed()) needNew = true
    else if (view.webContents.session !== sess) needNew = true

    if (needNew) {
      sess.webRequest.onBeforeSendHeaders((details, cb) => {
        details.requestHeaders['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
        cb({ requestHeaders: details.requestHeaders })
      })
      view = new BrowserView({
        webPreferences: { session: sess, nodeIntegration: false, contextIsolation: true, webSecurity: true, allowDisplayingInsecureContent: true }
      })
      const [w, h] = mainWindow.getContentSize()
      const x = Math.floor(w * 0.5)
      view.setBounds({ x, y: 34 + 40, width: w - x, height: h - 34 - 40 - 56 })
      view.setAutoResize({ width: false, height: true, horizontal: false, vertical: true })
      mainWindow.addBrowserView(view)
      browserView = view
      browserViewVisible = true
    }

    // ④ 自动跳到发布页（用户存的 url）—— 分区带 cookie → 即登录态
    const publishUrl = login.PLATFORM_PUBLISH_URLS[platformKey] || diyi.getCreateUrl(platformKey) || platform.loginUrl
    await new Promise((resolve) => {
      view.webContents.once('did-finish-load', () => resolve())
      view.webContents.loadURL(publishUrl)
      setTimeout(resolve, 15000)
    })
    await new Promise(r => setTimeout(r, 3000))  // 等编辑区渲染

    // ⑤ 填表（默认不自动提交，安全）
    const script = diyi.buildFillScript(platformKey, article)
    const fill = await view.webContents.executeJavaScript(script).catch(e => ({ error: e.message }))

    // 仅当显式 autoSubmit 才尝试点击发布
    let submit = null
    if (autoSubmit) {
      submit = await view.webContents.executeJavaScript(`
        (function(){
          var b=[].slice.call(document.querySelectorAll('button'));
          var p=b.find(function(x){return /发布|发表|提交|保存并发布/.test(x.textContent);});
          if(p){p.click();return {clicked:true,text:p.textContent.trim()};}
          return {clicked:false};
        })()
      `).catch(e => ({ error: e.message }))
    }

    return {
      success: true,
      platform: platform.name,
      account: acc.name,
      article: article.title,
      fill,
      submit,
      note: autoSubmit ? '已尝试提交' : '已填表，请在右侧浏览器人工确认后点击发布'
    }
  } catch (e) {
    return { success: false, message: e.message }
  }
}

ipcMain.handle('diyi:distribute', async (_, args) => {
  try { return await doDistribute(args) } catch (e) { return { success: false, error: e.message } }
})

// ========== 本地 HTTP 分发服务（供后台 automation 远程触发）==========
function startDistributeServer() {
  const server = http.createServer((req, res) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    if (req.method === 'GET' && req.url === '/health') {
      res.end(JSON.stringify({ ok: true, ts: Date.now() })); return
    }
    if (req.method === 'POST' && req.url === '/distribute') {
      let body = ''
      req.on('data', c => body += c)
      req.on('end', async () => {
        try {
          const args = JSON.parse(body || '{}')
          const result = await doDistribute(args)
          res.end(JSON.stringify(result))
        } catch (e) {
          res.statusCode = 500
          res.end(JSON.stringify({ success: false, error: e.message }))
        }
      })
      return
    }
    res.statusCode = 404
    res.end(JSON.stringify({ success: false, error: 'not found' }))
  })
  server.listen(18765, '127.0.0.1', () => {
    console.log('[D&E Media] 分发 HTTP 服务已启动: http://127.0.0.1:18765')
  })
}
if (app.isReady()) startDistributeServer()
else app.whenReady().then(() => startDistributeServer())

// ========== 左侧功能面板大小调整 ==========
ipcMain.handle('panel:resize', async (_, { widthPx, heightPercent, collapsed }) => {
  try {
    const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0]
    if (!win) return { ok: false }

    const [winWidth, winHeight] = win.getContentSize()
    const titleBarHeight = 36
    const bvToolbarHeight = 44
    const sidebarWidth = global.sidebarCollapsed ? 0 : 220

    // 计算左侧面板实际占用的宽度
    let leftPanelWidth = sidebarWidth // 默认只有侧边栏
    if (!collapsed) {
      // 如果面板展开，取面板宽度和侧边栏宽度的最大值（因为面板在侧边栏下方）
      leftPanelWidth = Math.max(sidebarWidth, widthPx || 320)
    } else if (collapsed) {
      leftPanelWidth = sidebarWidth
    }

    // 调整所有 BrowserView：从左侧面板右侧开始
    const viewKeys = Object.keys(browserViews)
    for (const key of viewKeys) {
      const bv = browserViews[key]
      if (bv && !bv.isDestroyed()) {
        try {
          bv.setBounds({
            x: leftPanelWidth,
            y: titleBarHeight + bvToolbarHeight,
            width: winWidth - leftPanelWidth,
            height: winHeight - titleBarHeight - bvToolbarHeight
          })
        } catch(e) {}
      }
    }

    console.log(`[面板调整] 左侧面板宽度:${leftPanelWidth}px, 窗口总宽:${winWidth}px`)
    return { ok: true, leftPanelWidth: leftPanelWidth }
  } catch (e) {
    console.error('[面板调整] 错误:', e.message)
    return { ok: false, error: e.message }
  }
})
