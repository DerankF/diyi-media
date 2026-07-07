/**
 * 帝意传媒 - 帝意日报自动分发模块
 * 读取「新媒体之王」工作区生成的日报产物（generated-articles/），
 * 通过各平台已保存的登录 session（cookie partition）自动填表分发。
 *
 * 设计原则：
 *  - 复用 automation-login 的 SUPPORTED_PLATFORMS 与已保存 cookie
 *  - 默认「填好不自动提交」——安全，避免误发 + 规避平台反爬风控
 *  - 平台填表选择器为启发式，需在已登录账号下实测试微调
 *
 * 第壹传媒 / 自化真君 增强
 */
const fs = require('fs')
const path = require('path')

// 日报产物目录（新媒体之王工作区，跨软件联动点）
const ARTICLES_DIR = 'D:\\融媒体发布助手\\新媒体之王\\generated-articles'

// 取平台创作/发布页 URL（优先 PLATFORM_PUBLISH_URLS → creatorUrl → cookieUrl → loginUrl）
function getCreateUrl(platformKey) {
  try {
    const { SUPPORTED_PLATFORMS, PLATFORM_PUBLISH_URLS } = require('./automation-login')
    if (PLATFORM_PUBLISH_URLS && PLATFORM_PUBLISH_URLS[platformKey]) return PLATFORM_PUBLISH_URLS[platformKey]
    const p = SUPPORTED_PLATFORMS[platformKey]
    if (!p) return null
    return p.creatorUrl || p.cookieUrl || p.loginUrl
  } catch (e) { return null }
}

// 列出可分发产物（排除预览/封面/模板）
function listArticles(dir = ARTICLES_DIR) {
  try {
    if (!fs.existsSync(dir)) return []
    return fs.readdirSync(dir)
      .filter(f => /\.(html|md)$/i.test(f))
      .filter(f => !/(preview|cover|模板|template|^Copy|^~)/i.test(f))
      .map(f => {
        const fp = path.join(dir, f)
        const st = fs.statSync(fp)
        return {
          name: f,
          title: f.replace(/\.(html|md)$/i, '').replace(/_/g, ' '),
          ext: path.extname(f).toLowerCase(),
          size: st.size,
          mtime: st.mtimeMs,
          path: fp
        }
      })
      .sort((a, b) => b.mtime - a.mtime)
  } catch (e) { return [] }
}

// 读取文章：标题 + 正文（HTML 与纯文本双版本）
function getArticle(name, dir = ARTICLES_DIR) {
  const fp = path.join(dir, name)
  if (!fs.existsSync(fp)) return null
  const raw = fs.readFileSync(fp, 'utf-8')
  if (/\.html$/i.test(name)) {
    const titleMatch = raw.match(/<title>([^<]*)<\/title>/i)
    let body = raw.replace(/<script[\s\S]*?<\/script>/gi, '')
                   .replace(/<style[\s\S]*?<\/style>/gi, '')
    const bodyMatch = body.match(/<body[^>]*>([\s\S]*)<\/body>/i)
    if (bodyMatch) body = bodyMatch[1]
    const text = body.replace(/<[^>]+>/g, '\n')
                     .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
                     .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
                     .replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
    return {
      name,
      title: (titleMatch ? titleMatch[1] : name).trim().slice(0, 80),
      bodyHtml: raw,
      bodyText: text.slice(0, 20000)
    }
  } else {
    const lines = raw.split('\n')
    const h = lines.find(l => l.startsWith('# '))
    const title = h ? h.replace(/^#\s*/, '').trim() : name
    return { name, title: title.slice(0, 80), bodyHtml: null, bodyText: raw.slice(0, 20000) }
  }
}

// 转义，用于拼接到页面 JS 字符串
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/\\/g, '\\\\').replace(/'/g, "\\'")
    .replace(/\n/g, '\\n').replace(/\r/g, '')
}

// 生成平台特定的填表 JS（在创作页 context 中执行）
// 返回 IIFE 字符串，结果 {title:bool, body:bool}
function buildFillScript(platformKey, article) {
  const title = esc(article.title)
  const body = esc(article.bodyText)

  // 通用启发式：标题 input + 正文 textarea / contenteditable
  const generic = "(function(){" +
    "var title='" + title + "';" +
    "var body='" + body + "';" +
    "var ok={title:false,body:false};" +
    "var tSels=['input[placeholder*=\"标题\"]','input.title','.title-input input','#title','input[name=\"title\"]','.article-title input'];" +
    "for(var i=0;i<tSels.length;i++){var el=document.querySelector(tSels[i]);if(el){el.focus();el.value=title;el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));ok.title=true;break;}}" +
    "var ta=document.querySelector('textarea');" +
    "if(ta){ta.focus();ta.value=body;ta.dispatchEvent(new Event('input',{bubbles:true}));ta.dispatchEvent(new Event('change',{bubbles:true}));ok.body=true;}" +
    "else{var ed=document.querySelector('[contenteditable=\"true\"],.editor,.ql-editor,.ProseMirror');if(ed){ed.focus();document.execCommand('selectAll',false,null);document.execCommand('insertText',false,body);ok.body=true;}}" +
    "return ok;" +
    "})()"

  // 平台精选（已知常见 DOM，实测微调）
  const wechat = "(function(){" +
    "var title='" + title + "';var body='" + body + "';var ok={title:false,body:false};" +
    "var t=document.querySelector('#title,.title-input input,.appmate_editor__title');if(t){t.focus();t.value=title;t.dispatchEvent(new Event('input',{bubbles:true}));ok.title=true;}" +
    "var ed=document.querySelector('#ueditor_0,.edui-body-container,[contenteditable=\"true\"]');if(ed){ed.focus();ed.innerHTML=body.replace(/\\n/g,'<br>');document.execCommand('insertText',false,body);ok.body=true;}" +
    "return ok;})()"

  const toutiao = "(function(){" +
    "var title='" + title + "';var body='" + body + "';var ok={title:false,body:false};" +
    "var t=document.querySelector('input[placeholder*=\"标题\"],.title-input input,#title');if(t){t.focus();t.value=title;t.dispatchEvent(new Event('input',{bubbles:true}));ok.title=true;}" +
    "var ta=document.querySelector('textarea');if(ta){ta.focus();ta.value=body;ta.dispatchEvent(new Event('input',{bubbles:true}));ok.body=true;}" +
    "else{var ed=document.querySelector('[contenteditable=\"true\"],.ql-editor');if(ed){ed.focus();document.execCommand('insertText',false,body);ok.body=true;}}" +
    "return ok;})()"

  const zhihu = "(function(){" +
    "var title='" + title + "';var body='" + body + "';var ok={title:false,body:false};" +
    "var t=document.querySelector('input[placeholder*=\"标题\"],.TitleInput input');if(t){t.focus();t.value=title;t.dispatchEvent(new Event('input',{bubbles:true}));ok.title=true;}" +
    "var ed=document.querySelector('.RichText,.zhihu-editor [contenteditable=\"true\"]');if(ed){ed.focus();document.execCommand('selectAll',false,null);document.execCommand('insertText',false,body);ok.body=true;}" +
    "return ok;})()"

  const map = { wechat, toutiao, zhihu }
  return map[platformKey] || generic
}

module.exports = { listArticles, getArticle, buildFillScript, getCreateUrl, ARTICLES_DIR }
