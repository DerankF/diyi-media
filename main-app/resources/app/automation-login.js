/**
 * 帝意传媒 - 自动化登录模块（Electron session 版）
 * 使用 Electron 内置 Chromium + session API，无需 Playwright
 * 支持多账号独立 session，每个账号使用独立的 partition
 * 第壹传媒 出品
 */

const { session, BrowserWindow } = require('electron')
const Store = require('electron-store')
const path = require('path')

const store = new Store()

// 支持的平台列表（国内 + 国外）
const SUPPORTED_PLATFORMS = {
  // 国内平台
  wechat: {
    name: '微信公众号',
    loginUrl: 'https://mp.weixin.qq.com/',
    cookieUrl: 'https://mp.weixin.qq.com/',
    testUrl: 'https://mp.weixin.qq.com/',
    icon: '💬'
  },
  zhihu: {
    name: '知乎',
    loginUrl: 'https://www.zhihu.com/signin',
    cookieUrl: 'https://www.zhihu.com/',
    testUrl: 'https://www.zhihu.com/settings/profile',
    icon: '🤔'
  },
  toutiao: {
    name: '头条号',
    loginUrl: 'https://mp.toutiao.com/',
    cookieUrl: 'https://mp.toutiao.com/',
    testUrl: 'https://mp.toutiao.com/profile_v4/',
    icon: '📰'
  },
  bilibili: {
    name: 'B站',
    loginUrl: 'https://passport.bilibili.com/login',
    cookieUrl: 'https://member.bilibili.com/',
    testUrl: 'https://member.bilibili.com/platform/home',
    icon: '📺'
  },
  douyin: {
    name: '抖音创作者中心',
    loginUrl: 'https://creator.douyin.com/',
    cookieUrl: 'https://creator.douyin.com/',
    testUrl: 'https://creator.douyin.com/content/manage',
    icon: '🎵'
  },
  xiaohongshu: {
    name: '小红书',
    loginUrl: 'https://www.xiaohongshu.com/explore',  // 从探索页开始，点击登录
    cookieUrl: 'https://www.xiaohongshu.com/',
    testUrl: 'https://creator.xiaohongshu.com/',  // 创作者中心（后台）
    creatorUrl: 'https://creator.xiaohongshu.com/',  // 创作者后台
    icon: '📖',
    // 小红书多账号登录重要提示
    // 短信验证码对同一设备/IP有严格限制，第二个账号几乎一定收不到验证码
    // 必须使用扫码登录，每个账号用独立的APP扫码
    loginSteps: [
      '⚠️ 重要：小红书多账号登录，必须使用「扫码登录」！',
      '⚠️ 短信验证码对同一设备有风控限制，第二个账号无法收到！',
      '步骤1：点击右上角「登录」→ 选择「扫码登录」tab',
      '步骤2：用第1个小红书APP扫第1个账号，第2个APP扫第2个账号',
      '（如果没有两个手机，可以在一个手机上切换账号扫码）',
      '登录成功后，系统会自动打开创作者中心'
    ],
    // 登录成功后，自动跳转到创作者中心
    afterLoginUrl: 'https://creator.xiaohongshu.com/'
  },
  baidu: {
    name: '百家号',
    loginUrl: 'https://baijiahao.baidu.com/',
    cookieUrl: 'https://baijiahao.baidu.com/',
    testUrl: 'https://baijiahao.baidu.com/bjh/asset/overview',
    icon: '🔍'
  },
  tencent: {
    name: '企鹅号',
    loginUrl: 'https://om.qq.com/',
    cookieUrl: 'https://om.qq.com/',
    testUrl: 'https://om.qq.com/',
    icon: '🐧'
  },
  wangyi: {
    name: '网易号',
    loginUrl: 'https://mp.163.com/',
    cookieUrl: 'https://mp.163.com/',
    testUrl: 'https://mp.163.com/',
    icon: '🎵'
  },
  weibo: {
    name: '微博',
    loginUrl: 'https://weibo.com/',
    cookieUrl: 'https://weibo.com/',
    testUrl: 'https://weibo.com/settings/account',
    icon: '📢'
  },
  // 国外平台
  medium: {
    name: 'Medium',
    loginUrl: 'https://medium.com/',
    cookieUrl: 'https://medium.com/',
    testUrl: 'https://medium.com/me/settings',
    icon: '✍️'
  },
  linkedin: {
    name: 'LinkedIn',
    loginUrl: 'https://www.linkedin.com/login',
    cookieUrl: 'https://www.linkedin.com/',
    testUrl: 'https://www.linkedin.com/feed/',
    icon: '💼'
  },
  youtube: {
    name: 'YouTube',
    loginUrl: 'https://www.youtube.com/',
    cookieUrl: 'https://www.youtube.com/',
    testUrl: 'https://studio.youtube.com/',
    icon: '▶️'
  },
  twitter: {
    name: 'X (Twitter)',
    loginUrl: 'https://twitter.com/i/flow/login',
    cookieUrl: 'https://twitter.com/',
    testUrl: 'https://twitter.com/home',
    icon: '🐦'
  },
  facebook: {
    name: 'Facebook',
    loginUrl: 'https://www.facebook.com/',
    cookieUrl: 'https://www.facebook.com/',
    testUrl: 'https://www.facebook.com/settings',
    icon: '👥'
  },
  instagram: {
    name: 'Instagram',
    loginUrl: 'https://www.instagram.com/',
    cookieUrl: 'https://www.instagram.com/',
    testUrl: 'https://www.instagram.com/accounts/edit/',
    icon: '📸'
  },
  tiktok: {
    name: 'TikTok',
    loginUrl: 'https://www.tiktok.com/',
    cookieUrl: 'https://www.tiktok.com/',
    testUrl: 'https://www.tiktok.com/',
    icon: '🎶'
  },
  kuaishou: {
    name: '快手创作者中心',
    loginUrl: 'https://creator.kuaishou.com/',
    cookieUrl: 'https://creator.kuaishou.com/',
    // 快手登录后 Cookie 分布在多个域名，需要全部采集
    cookieDomains: [
      'https://creator.kuaishou.com/',
      'https://www.kuaishou.com/',
      'https://kuaishou.com/'
    ],
    testUrl: 'https://creator.kuaishou.com/',
    icon: '🎬',
    loginSteps: [
      '访问 creator.kuaishou.com',
      '点击右上角「登录」按钮',
      '推荐：使用快手APP扫码登录（更稳定）',
      '也可以输入手机号和密码登录'
    ]
  },
  // AI 工具平台
  deepseek: {
    name: 'DeepSeek',
    loginUrl: 'https://chat.deepseek.com/',
    cookieUrl: 'https://chat.deepseek.com/',
    testUrl: 'https://chat.deepseek.com/',
    icon: '🧠',
    cookieDomains: [
      'https://chat.deepseek.com',
      'https://platform.deepseek.com'
    ]
  },
  chatgpt: {
    name: 'ChatGPT',
    loginUrl: 'https://chatgpt.com/',
    cookieUrl: 'https://chatgpt.com/',
    testUrl: 'https://chatgpt.com/',
    icon: '🤖',
    cookieDomains: [
      'https://chatgpt.com',
      'https://auth0.openai.com'
    ]
  },
  claude: {
    name: 'Claude',
    loginUrl: 'https://claude.ai/',
    cookieUrl: 'https://claude.ai/',
    testUrl: 'https://claude.ai/',
    icon: '💬',
    cookieDomains: [
      'https://claude.ai',
      'https://console.anthropic.com'
    ]
  },
  qwen: {
    name: '通义千问',
    loginUrl: 'https://tongyi.aliyun.com/',
    cookieUrl: 'https://tongyi.aliyun.com/',
    testUrl: 'https://tongyi.aliyun.com/qianwen/',
    icon: '☁️'
  },
  doubao: {
    name: '豆包',
    loginUrl: 'https://www.doubao.com/',
    cookieUrl: 'https://www.doubao.com/',
    testUrl: 'https://www.doubao.com/chat/',
    icon: '🫘'
  }
}

// 各平台「发布/创作」页 URL —— 一键分发时自动跳转，配合已存 cookie 即登录态
// 这正是用户要的「先存 url，exe 一键点击即用」中的 url
const PLATFORM_PUBLISH_URLS = {
  wechat: 'https://mp.weixin.qq.com/cgi-bin/appmsg?t=media/appmsg_edit&action=edit&type=10&isMul=1&isNew=1&lang=zh_CN',
  zhihu: 'https://www.zhihu.com/write',
  toutiao: 'https://mp.toutiao.com/profile_v4/rich/content/create',
  bilibili: 'https://member.bilibili.com/platform/article',
  douyin: 'https://creator.douyin.com/creator-b/content/publish?enter_from=creator_center',
  xiaohongshu: 'https://creator.xiaohongshu.com/publish/publish',
  baidu: 'https://baijiahao.baidu.com/bjh/editor?type=article',
  tencent: 'https://om.qq.com/article/create',
  wangyi: 'https://mp.163.com/article/create',
  weibo: 'https://weibo.com/compose',
  kuaishou: 'https://creator.kuaishou.com/publish/article',
  medium: 'https://medium.com/new-story',
  linkedin: 'https://www.linkedin.com/post/new',
  youtube: 'https://www.youtube.com/upload',
  twitter: 'https://twitter.com/compose/tweet',
  facebook: 'https://www.facebook.com/',
  instagram: 'https://www.instagram.com/',
  tiktok: 'https://www.tiktok.com/upload'
}

// 存储当前打开的登录窗口 { accountId: BrowserWindow }
const loginWindows = {}

/**
 * 打开登录窗口（使用 Electron 内置浏览器）
 * @param {string} platformKey - 平台标识
 * @param {BrowserWindow} parentWindow - 父窗口
 * @param {string} accountId - 账号 ID（用于多账号隔离，如果为空则自动生成）
 * @returns {object} { accountId, platformKey }
 */
function openLoginWindow(platformKey, parentWindow, accountId = null) {
  const platform = SUPPORTED_PLATFORMS[platformKey]
  if (!platform) {
    throw new Error(`不支持的平台: ${platformKey}`)
  }

  // 生成账号 ID（用于多账号隔离）
  // 关键：必须用绝对唯一的 ID，防止多账号 session 冲突
  if (!accountId) {
    const { randomUUID } = require('crypto')
    accountId = `${platformKey}_${Date.now()}_${randomUUID().substring(0, 8)}`
  }

  // 如果已存在同平台同账号的登录窗口，先关闭
  if (loginWindows[accountId] && !loginWindows[accountId].isDestroyed()) {
    loginWindows[accountId].destroy()
  }

  // 创建独立的 session partition（每个账号完全独立，类似 Playwright 的 isolated context）
  const partition = `persist:account-${accountId}`
  const accountSession = session.fromPartition(partition, { cache: true })

  // 创建登录窗口（使用独立 session，独立窗口不依赖父窗口）
  const loginWin = new BrowserWindow({
    width: 1000,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    show: true,
    icon: path.join(__dirname, 'icon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      session: accountSession  // 使用独立 session
    },
    title: `帝意传媒 - ${platform.name} 登录`
  })

  // 保存登录窗口引用
  loginWindows[accountId] = loginWin
  loginWin._accountId = accountId
  loginWin._platformKey = platformKey
  loginWin._session = accountSession

  // 打开开发者工具（方便调试登录问题）
  // loginWin.webContents.openDevTools()

  // 轻量级清理：只清除 cookies（不阻塞，后台异步执行）
  // 注意：不用 clearStorageData，它在某些 Electron 版本会导致 session 异常
  accountSession.cookies.get({}).then(cookies => {
    if (cookies.length > 0) {
      console.log(`[登录] 后台清除 ${cookies.length} 个旧 Cookie...`)
      cookies.forEach(cookie => {
        try { 
          const url = `https://${cookie.domain.replace(/^\./, '')}/`
          accountSession.cookies.remove(url, cookie.name).catch(() => {})
        } catch(e) {}
      })
    }
  }).catch(() => {})

  // 导航到登录页面（不等清理完成，立即加载）
  loginWin.loadURL(platform.loginUrl)

  // 针对小红书：页面加载后自动尝试点击「扫码登录」tab（避免短信验证码问题）
  if (platformKey === 'xiaohongshu') {
    loginWin.webContents.on('did-finish-load', () => {
      // 延迟执行，确保页面完全渲染
      setTimeout(async () => {
        try {
          // 注入 JS：查找并点击「扫码登录」tab
          await loginWin.webContents.executeJavaScript(`
            (function() {
              // 查找包含「扫码」或「二维码」的 tab/按钮
              const scanTabs = document.querySelectorAll('*');
              for (let el of scanTabs) {
                const text = el.textContent || '';
                if ((text.includes('扫码') || text.includes('二维码') || text.includes('扫一扫')) && 
                    (el.tagName === 'DIV' || el.tagName === 'A' || el.tagName === 'BUTTON' || el.tagName === 'SPAN')) {
                  // 检查是否是可点击的 tab（不是隐藏元素）
                  const rect = el.getBoundingClientRect();
                  if (rect.width > 0 && rect.height > 0) {
                    el.click();
                    console.log('[小红书] 自动点击扫码登录 tab:', text);
                    return true;
                  }
                }
              }
              return false;
            })();
          `)
          console.log('[小红书] 已尝试自动切换到扫码登录')
        } catch (e) {
          console.log('[小红书] 自动切换扫码登录失败（可手动点击）:', e.message)
        }
      }, 2000) // 延迟2秒，确保页面渲染完成
    })
  }

  // 窗口关闭时清理引用
  loginWin.on('closed', () => {
    delete loginWindows[accountId]
  })

  return {
    accountId,
    platformKey,
    loginWin
  }
}

/**
 * 获取登录窗口的 Cookies（用户点击"已完成登录"时调用）
 * @param {string} accountId - 账号 ID
 * @returns {Promise<Array>} cookies
 */
async function getLoginCookies(accountId) {
  const loginWin = loginWindows[accountId]
  if (!loginWin || loginWin.isDestroyed()) {
    throw new Error('登录窗口已关闭')
  }

  const platformKey = loginWin._platformKey
  const platform = SUPPORTED_PLATFORMS[platformKey]
  const accountSession = loginWin._session

  // 支持多域名 Cookie 采集（快手等平台 Cookie 分布在多个域名）
  const cookieDomains = platform.cookieDomains || [platform.cookieUrl]
  
  let allCookies = []
  for (const url of cookieDomains) {
    try {
      const cookies = await accountSession.cookies.get({ url })
      allCookies = allCookies.concat(cookies)
      console.log(`[Cookie采集] ${url} → ${cookies.length} 个`)
    } catch (e) {
      console.log(`[Cookie采集] ${url} 失败:`, e.message)
    }
  }

  // 去重（同一 domain + name + path 的 Cookie 只保留一个）
  const seen = new Set()
  const uniqueCookies = []
  for (const c of allCookies) {
    const key = `${c.domain}|${c.name}|${c.path}`
    if (!seen.has(key)) {
      seen.add(key)
      uniqueCookies.push(c)
    }
  }

  console.log(`[Cookie采集] 总计 ${allCookies.length} 个，去重后 ${uniqueCookies.length} 个`)
  return uniqueCookies
}

/**
 * 关闭登录窗口
 * @param {string} accountId - 账号 ID
 */
function closeLoginWindow(accountId) {
  const loginWin = loginWindows[accountId]
  if (loginWin && !loginWin.isDestroyed()) {
    loginWin.destroy()
  }
  delete loginWindows[accountId]
}

/**
 * 尝试从页面获取用户名
 * @param {BrowserWindow} loginWin 
 * @returns {Promise<string>}
 */
async function getUserNameFromPage(loginWin) {
  try {
    const userInfo = await loginWin.webContents.executeJavaScript(`
      (function() {
        // 尝试从页面中提取用户名
        const userNameSelectors = [
          '.user-name', '.nickname', '.account-name', '[class*="user"]', '[class*="name"]',
          'h1', 'h2', '.title', '.name'
        ]
        
        for (const selector of userNameSelectors) {
          const el = document.querySelector(selector)
          if (el && el.textContent.trim()) {
            return el.textContent.trim()
          }
        }
        
        // 尝试从 cookie 中获取用户名
        const cookies = document.cookie
        const nameMatch = cookies.match(/(username|nickname|name)=([^;]+)/)
        if (nameMatch) {
          return decodeURIComponent(nameMatch[2])
        }
        
        return ''
      })()
    `)
    return userInfo || ''
  } catch (e) {
    console.log('获取用户信息失败:', e.message)
    return ''
  }
}

/**
 * 测试登录状态是否有效
 * @param {string} platformKey - 平台标识
 * @returns {Promise<boolean>}
 */
async function testLoginStatus(platformKey) {
  const platform = SUPPORTED_PLATFORMS[platformKey]
  const savedCookies = store.get(`cookies.${platformKey}`)

  if (!savedCookies || savedCookies.length === 0) return false

  // 简单判断：有 Cookie 就认为有效（实际使用时可发起请求验证）
  return savedCookies.length > 0
}

/**
 * 获取已保存的 Cookie
 * @param {string} platformKey 
 * @returns {Array} cookies
 */
function getSavedCookies(platformKey) {
  return store.get(`cookies.${platformKey}`, [])
}

/**
 * 删除已保存的 Cookie
 * @param {string} platformKey 
 */
function deleteCookies(platformKey) {
  store.delete(`cookies.${platformKey}`)
}

module.exports = {
  openLoginWindow,
  getLoginCookies,
  closeLoginWindow,
  getUserNameFromPage,
  testLoginStatus,
  getSavedCookies,
  deleteCookies,
  SUPPORTED_PLATFORMS,
  PLATFORM_PUBLISH_URLS,
  loginWindows
}
