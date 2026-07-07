/**
 * 帝意传媒 - 帝意日报自动分发模块
 * 读取「新媒体之王」工作区生成的日报产物（generated-articles/），
 * 通过各平台已保存的登录 session（cookie partition）自动填表分发。
 *
 * 设计原则：
 *  - 复用 automation-login 的 SUPPORTED_PLATFORMS 与已保存 cookie
 *  - 默认「填好不自动提交」——安全，避免误发 + 规避平台反爬风控
 *  - 平台填表选择器为启发式，需在已登录账号下实测试微调（built-in debug 模式协助定位）
 *
 * 第壹传媒 / 自化真君 增强
 */
const fs = require('fs')
const path = require('path')

// 日报产物目录（新媒体之王工作区，跨软件联动点）
const ARTICLES_DIR = 'D:\\融媒体发布助手\\新媒体之王\\generated-articles'
// 封面图目录
const COVERS_DIR = 'D:\\融媒体发布助手\\新媒体之王\\covers'
// 本地资产服务（app 启动时在 18766 拉起），用于把本地封面暴露成 URL 填进「封面图 URL」输入框
const ASSET_BASE = 'http://127.0.0.1:18766'

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

// 探测与文章关联的封面图（优先同名 covers，其次模糊匹配）
function getCover(articleName) {
  try {
    const base = String(articleName || '').replace(/\.(html|md)$/i, '')
    // 1) 直接同名
    const direct = path.join(COVERS_DIR, `cover_${base}.png`)
    if (fs.existsSync(direct)) return direct
    // 2) generated-articles 同目录同名 png
    const direct2 = path.join(ARTICLES_DIR, `${base}.png`)
    if (fs.existsSync(direct2)) return direct2
    // 3) 模糊：covers 里文件名含 base 关键词
    if (fs.existsSync(COVERS_DIR)) {
      const norm = s => s.toLowerCase().replace(/[\s_]+/g, '').replace(/^cover/i, '')
      const target = norm(base)
      const hit = fs.readdirSync(COVERS_DIR)
        .filter(f => /\.png$/i.test(f))
        .find(f => norm(f).includes(target) || target.includes(norm(f).replace(/^cover/, '')))
      if (hit) return path.join(COVERS_DIR, hit)
    }
    return null
  } catch (e) { return null }
}

// 把本地封面路径转成资产服务 URL（需 app 已起 18766）
function coverToUrl(coverPath) {
  if (!coverPath) return null
  const rel = coverPath.replace(/\\/g, '/')
  if (rel.includes('/covers/')) return ASSET_BASE + '/covers/' + path.basename(coverPath)
  if (rel.includes('/generated-articles/')) return ASSET_BASE + '/generated-articles/' + path.basename(coverPath)
  return ASSET_BASE + '/covers/' + path.basename(coverPath)
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

/**
 * 生成平台特定的填表 JS（在创作页 context 中执行）
 * @param {string} platformKey
 * @param {object} article {title, bodyText}
 * @param {object} opts { coverUrl, debug }
 * @returns IIFE 字符串，结果 {title, body, cover, titleLen, bodyLen, coverLen, selectorsUsed[], debug?}
 */
function buildFillScript(platformKey, article, opts = {}) {
  const title = esc(article.title)
  const body = esc(article.bodyText)
  const coverUrl = esc(opts.coverUrl || '')
  const debug = opts.debug ? 'true' : 'false'

  // 通用稳健版：兼容 React 受控组件 + 富文本框架 + 回读验证 + 封面临时 URL
  const generic = `(function(){
    var title='${title}';
    var body='${body}';
    var coverUrl='${coverUrl}';
    var debug=${debug};
    var ok={title:false,body:false,cover:false,titleLen:0,bodyLen:0,coverLen:0,selectorsUsed:[],debug:null};

    // React 受控组件安全设值（绕过 value setter 拦截）
    function setVal(el,val){
      try{
        var proto=Object.getPrototypeOf(el);
        var desc=Object.getOwnPropertyDescriptor(proto,'value');
        if(desc&&desc.set){desc.set.call(el,val);}else{el.value=val;}
      }catch(e){el.value=val;}
      el.dispatchEvent(new Event('input',{bubbles:true}));
      el.dispatchEvent(new Event('change',{bubbles:true}));
      try{el.dispatchEvent(new KeyboardEvent('input',{bubbles:true}));}catch(e){}
    }
    function trySet(sels,val,kind){
      for(var i=0;i<sels.length;i++){
        var el=document.querySelector(sels[i]);
        if(el){setVal(el,val);ok[kind]=true;ok[kind+'Len']=(el.value||el.innerText||'').length;ok.selectorsUsed.push(kind+':'+sels[i]);return true;}
      }
      return false;
    }

    // 标题候选
    var titleSels=['input[placeholder*="标题"]','input.title','.title-input input','#title','input[name="title"]','.article-title input','input[name*="title"]','.editor-title input','[data-testid*="title"] input'];
    trySet(titleSels,title,'title');

    // 正文：textarea 优先，否则富文本（Quill/ProseMirror/UEditor/wangEditor/CKEditor/contenteditable）
    var ta=document.querySelector('textarea');
    if(ta){setVal(ta,body);ok.body=true;ok.bodyLen=ta.value.length;ok.selectorsUsed.push('body:textarea');}
    else{
      var ed=document.querySelector('[contenteditable="true"],.ql-editor,.ProseMirror,.edui-body-container,.w-e-text-container [contenteditable],.cke_editable,[class*="editor"] [contenteditable="true"]');
      if(ed){
        ed.focus();
        try{document.execCommand('selectAll',false,null);document.execCommand('insertText',false,body);}catch(e){ed.innerText=body;}
        ok.body=true;ok.bodyLen=(ed.innerText||'').length;ok.selectorsUsed.push('body:contenteditable');
      }
    }

    // 封面：优先填临时 URL（多数后台支持填图 URL）；file input 由后端 CDP 注入，这里标记
    if(coverUrl){
      var coverSels=['input[name="cover"]','input[name*="cover"]','input[placeholder*="封面"]','input[placeholder*="cover"]','input[accept*="image"][type="url"]','.cover-url input','#cover_input','input[name*="thumb"]','input[name*="image"]'];
      var done=trySet(coverSels,coverUrl,'cover');
      if(!done){
        var fi=document.querySelector('input[type="file"][accept*="image"],input[type="file"]');
        if(fi){ok.cover='file-input';ok.selectorsUsed.push('cover:file-input(后端CDP注入)');}
      }
    }

    if(debug){
      var els=[].slice.call(document.querySelectorAll('input,textarea,[contenteditable="true"]')).slice(0,40).map(function(e){
        return {t:e.tagName,type:e.type||'',ph:e.placeholder||'',name:e.name||'',cls:(e.className||'').toString().slice(0,40),ce:e.getAttribute&&e.getAttribute('contenteditable')};
      });
      ok.debug=els;
    }
    return ok;
  })()`

  // 平台精选（已知常见 DOM，实测微调）—— 比 generic 更准，优先采用
  const wechat = `(function(){
    var title='${title}';var body='${body}';var coverUrl='${coverUrl}';var debug=${debug};
    var ok={title:false,body:false,cover:false,titleLen:0,bodyLen:0,coverLen:0,selectorsUsed:[],debug:null};
    function setVal(el,val){var p=Object.getPrototypeOf(el);var d=Object.getOwnPropertyDescriptor(p,'value');if(d&&d.set){d.set.call(el,val);}else{el.value=val;}el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));}
    var t=document.querySelector('#title,.title-input input,.appmate_editor__title,.weui-desktop-form__input');if(t){setVal(t,title);ok.title=true;ok.titleLen=t.value.length;ok.selectorsUsed.push('title:#title');}
    var ed=document.querySelector('#ueditor_0,.edui-body-container,[contenteditable="true"],.weui-desktop-editor__content');if(ed){ed.focus();try{document.execCommand('selectAll',false,null);document.execCommand('insertText',false,body);}catch(e){ed.innerHTML=body.replace(/\\n/g,'<br>');}ok.body=true;ok.bodyLen=(ed.innerText||'').length;ok.selectorsUsed.push('body:ueditor');}
    if(coverUrl){var c=document.querySelector('input[name="file"]+,input[accept*="image"],.cover-upload input');if(c){/* 微信封面为上传，走后端CDP */ok.cover='file-input';ok.selectorsUsed.push('cover:wechat-file');}else if(coverUrl){var cu=document.querySelector('input[placeholder*="封面"],input[name*="cover"]');if(cu){setVal(cu,coverUrl);ok.cover=true;ok.coverLen=cu.value.length;ok.selectorsUsed.push('cover:url');}}}
    if(debug){ok.debug=[].slice.call(document.querySelectorAll('input,textarea,[contenteditable]')).slice(0,40).map(function(e){return{t:e.tagName,ph:e.placeholder||'',name:e.name||'',cls:(e.className||'').toString().slice(0,40)};});}
    return ok;
  })()`

  const toutiao = `(function(){
    var title='${title}';var body='${body}';var coverUrl='${coverUrl}';var debug=${debug};
    var ok={title:false,body:false,cover:false,titleLen:0,bodyLen:0,coverLen:0,selectorsUsed:[],debug:null};
    function setVal(el,val){var p=Object.getPrototypeOf(el);var d=Object.getOwnPropertyDescriptor(p,'value');if(d&&d.set){d.set.call(el,val);}else{el.value=val;}el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));}
    var t=document.querySelector('input[placeholder*="标题"],.title-input input,#title');if(t){setVal(t,title);ok.title=true;ok.titleLen=t.value.length;ok.selectorsUsed.push('title:#title');}
    var ta=document.querySelector('textarea');if(ta){setVal(ta,body);ok.body=true;ok.bodyLen=ta.value.length;ok.selectorsUsed.push('body:textarea');}
    else{var ed=document.querySelector('[contenteditable="true"],.ql-editor');if(ed){ed.focus();document.execCommand('insertText',false,body);ok.body=true;ok.bodyLen=(ed.innerText||'').length;ok.selectorsUsed.push('body:contenteditable');}}
    if(coverUrl){var c=document.querySelector('input[placeholder*="封面"],input[name*="cover"],input[accept*="image"][type="url"]');if(c){setVal(c,coverUrl);ok.cover=true;ok.coverLen=c.value.length;ok.selectorsUsed.push('cover:url');}}
    if(debug){ok.debug=[].slice.call(document.querySelectorAll('input,textarea,[contenteditable]')).slice(0,40).map(function(e){return{t:e.tagName,ph:e.placeholder||'',name:e.name||'',cls:(e.className||'').toString().slice(0,40)};});}
    return ok;
  })()`

  const xiaohongshu = `(function(){
    var title='${title}';var body='${body}';var coverUrl='${coverUrl}';var debug=${debug};
    var ok={title:false,body:false,cover:false,titleLen:0,bodyLen:0,coverLen:0,selectorsUsed:[],debug:null};
    function setVal(el,val){var p=Object.getPrototypeOf(el);var d=Object.getOwnPropertyDescriptor(p,'value');if(d&&d.set){d.set.call(el,val);}else{el.value=val;}el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));}
    var t=document.querySelector('textarea[placeholder*="标题"],.title-input textarea,#title-input');if(t){setVal(t,title);ok.title=true;ok.titleLen=t.value.length;ok.selectorsUsed.push('title:小红书标题');}
    var ed=document.querySelector('[contenteditable="true"],.ql-editor,.d-text');if(ed){ed.focus();document.execCommand('insertText',false,body);ok.body=true;ok.bodyLen=(ed.innerText||'').length;ok.selectorsUsed.push('body:小红书正文');}
    if(coverUrl){var c=document.querySelector('input[accept*="image"][type="url"],input[name*="cover"]');if(c){setVal(c,coverUrl);ok.cover=true;ok.coverLen=c.value.length;ok.selectorsUsed.push('cover:url');}else{ok.cover='file-input';ok.selectorsUsed.push('cover:小红书上传');}}
    if(debug){ok.debug=[].slice.call(document.querySelectorAll('input,textarea,[contenteditable]')).slice(0,40).map(function(e){return{t:e.tagName,ph:e.placeholder||'',name:e.name||'',cls:(e.className||'').toString().slice(0,40)};});}
    return ok;
  })()`

  const zhihu = `(function(){
    var title='${title}';var body='${body}';var coverUrl='${coverUrl}';var debug=${debug};
    var ok={title:false,body:false,cover:false,titleLen:0,bodyLen:0,coverLen:0,selectorsUsed:[],debug:null};
    function setVal(el,val){var p=Object.getPrototypeOf(el);var d=Object.getOwnPropertyDescriptor(p,'value');if(d&&d.set){d.set.call(el,val);}else{el.value=val;}el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));}
    var t=document.querySelector('input[placeholder*="标题"],.TitleInput input,#title');if(t){setVal(t,title);ok.title=true;ok.titleLen=t.value.length;ok.selectorsUsed.push('title:#title');}
    var ed=document.querySelector('.RichText,.zhihu-editor [contenteditable="true"],.ql-editor');if(ed){ed.focus();document.execCommand('selectAll',false,null);document.execCommand('insertText',false,body);ok.body=true;ok.bodyLen=(ed.innerText||'').length;ok.selectorsUsed.push('body:zhihu-editor');}
    if(coverUrl){var c=document.querySelector('input[placeholder*="封面"],input[name*="cover"]');if(c){setVal(c,coverUrl);ok.cover=true;ok.coverLen=c.value.length;ok.selectorsUsed.push('cover:url');}}
    if(debug){ok.debug=[].slice.call(document.querySelectorAll('input,textarea,[contenteditable]')).slice(0,40).map(function(e){return{t:e.tagName,ph:e.placeholder||'',name:e.name||'',cls:(e.className||'').toString().slice(0,40)};});}
    return ok;
  })()`

  const douyin = `(function(){
    var title='${title}';var body='${body}';var coverUrl='${coverUrl}';var debug=${debug};
    var ok={title:false,body:false,cover:false,titleLen:0,bodyLen:0,coverLen:0,selectorsUsed:[],debug:null};
    function setVal(el,val){var p=Object.getPrototypeOf(el);var d=Object.getOwnPropertyDescriptor(p,'value');if(d&&d.set){d.set.call(el,val);}else{el.value=val;}el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));}
    var t=document.querySelector('input[placeholder*="标题"],.title-input input,#title');if(t){setVal(t,title);ok.title=true;ok.titleLen=t.value.length;ok.selectorsUsed.push('title:抖音标题');}
    var ta=document.querySelector('textarea');if(ta){setVal(ta,body);ok.body=true;ok.bodyLen=ta.value.length;ok.selectorsUsed.push('body:textarea');}
    else{var ed=document.querySelector('[contenteditable="true"],.ql-editor');if(ed){ed.focus();document.execCommand('insertText',false,body);ok.body=true;ok.bodyLen=(ed.innerText||'').length;ok.selectorsUsed.push('body:contenteditable');}}
    if(coverUrl){var c=document.querySelector('input[accept*="image"][type="url"],input[name*="cover"],input[placeholder*="封面"]');if(c){setVal(c,coverUrl);ok.cover=true;ok.coverLen=c.value.length;ok.selectorsUsed.push('cover:url');}else{ok.cover='file-input';ok.selectorsUsed.push('cover:抖音上传');}}
    if(debug){ok.debug=[].slice.call(document.querySelectorAll('input,textarea,[contenteditable]')).slice(0,40).map(function(e){return{t:e.tagName,ph:e.placeholder||'',name:e.name||'',cls:(e.className||'').toString().slice(0,40)};});}
    return ok;
  })()`

  const map = { wechat, toutiao, xiaohongshu, zhihu, douyin }
  return map[platformKey] || generic
}

module.exports = {
  listArticles, getArticle, getCover, coverToUrl, buildFillScript, getCreateUrl,
  ARTICLES_DIR, COVERS_DIR, ASSET_BASE
}
