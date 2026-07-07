/**
 * AI 模型配置 - 支持多模型/多API
 * 用户只需填写 API Key 即可使用各种大模型
 * D&E Media 出品
 */

const Store = require('electron-store')
const store = new Store()

// ==================== 内置模型配置 ====================

// OpenRouter - 一个API访问200+模型（推荐）
// 免费获取API Key: https://openrouter.ai/keys
const OPENROUTER_MODELS = {
  'openrouter/auto': { name: 'OpenRouter 自动选择', model: 'auto' },
  'openrouter/anthropic/claude-3.5-sonnet': { name: 'Claude 3.5 Sonnet', model: 'anthropic/claude-3.5-sonnet' },
  'openrouter/anthropic/claude-3-haiku': { name: 'Claude 3 Haiku (快速)', model: 'anthropic/claude-3-haiku' },
  'openrouter/openai/gpt-4o': { name: 'GPT-4o', model: 'openai/gpt-4o' },
  'openrouter/openai/gpt-4o-mini': { name: 'GPT-4o Mini (便宜)', model: 'openai/gpt-4o-mini' },
  'openrouter/google/gemini-pro-1.5': { name: 'Gemini Pro 1.5', model: 'google/gemini-pro-1.5' },
  'openrouter/google/gemini-flash-1.5': { name: 'Gemini Flash 1.5 (快速)', model: 'google/gemini-flash-1.5' },
  'openrouter/meta-llama/llama-3.1-405b': { name: 'Llama 3.1 405B', model: 'meta-llama/llama-3.1-405b' },
  'openrouter/mistralai/mixtral-8x7b': { name: 'Mixtral 8x7B (开源)', model: 'mistralai/mixtral-8x7b' },
  'openrouter/qwen/qwen-2.5-72b': { name: '通义千问 2.5 72B', model: 'qwen/qwen-2.5-72b' },
  'openrouter/deepseek/deepseek-chat': { name: 'DeepSeek V3 (便宜)', model: 'deepseek/deepseek-chat' },
}

// OpenAI 兼容接口（支持任何兼容OpenAI格式的API）
const OPENAI_COMPATIBLE = {
  name: 'OpenAI 兼容接口',
  baseUrl: 'https://api.openai.com/v1',
  models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo']
}

// ==================== 获取用户配置的 API Keys ====================

function getApiConfig(provider) {
  const configs = store.get('ai_apis', {})
  return configs[provider] || null
}

function saveApiConfig(provider, config) {
  const configs = store.get('ai_apis', {})
  configs[provider] = config
  store.set('ai_apis', configs)
}

// ==================== 通用 AI 调用函数 ====================

/**
 * 调用 AI 模型
 * @param {string} modelKey - 模型标识（如 'openrouter/anthropic/claude-3.5-sonnet'）
 * @param {string} prompt - 提示词
 * @param {Array} messages - 消息历史（可选）
 * @returns {Promise<{content: string, model: string}>}
 */
async function callAIModel(modelKey, prompt, messages = null) {
  // 默认使用 Agnes AI（帝意优选）
  if (!modelKey || modelKey === 'agnes' || modelKey === 'auto') {
    return callAgnesAI(prompt, messages)
  }

  // OpenRouter
  if (modelKey.startsWith('openrouter/')) {
    return callOpenRouter(modelKey, prompt, messages)
  }

  // 自定义 OpenAI 兼容接口
  if (modelKey.startsWith('custom/')) {
    return callCustomOpenAI(modelKey, prompt, messages)
  }

  // 默认回退到 Agnes
  return callAgnesAI(prompt, messages)
}

/**
 * 调用 OpenRouter API
 */
async function callOpenRouter(modelKey, prompt, messages = null) {
  const https = require('https')
  const config = getApiConfig('openrouter')
  
  if (!config || !config.apiKey) {
    throw new Error('OpenRouter API Key 未配置，请在设置中填写')
  }

  const model = modelKey.replace('openrouter/', '')
  const msgs = messages || [
    { role: 'system', content: '你是一个专业的新媒体内容创作者，擅长撰写各类平台内容。请用中文回复，内容要实用、有深度、吸引人。' },
    { role: 'user', content: prompt }
  ]

  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      model: model,
      messages: msgs,
      max_tokens: 4000,
      temperature: 0.7
    })

    const options = {
      hostname: 'openrouter.ai',
      path: '/api/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Length': Buffer.byteLength(data),
        'HTTP-Referer': 'https://dne-media.com',
        'X-Title': 'D&E Media'
      },
      timeout: 60000
    }

    const req = https.request(options, (res) => {
      let body = ''
      res.on('data', chunk => body += chunk)
      res.on('end', () => {
        try {
          const response = JSON.parse(body)
          if (response.choices && response.choices[0]) {
            resolve({
              content: response.choices[0].message.content,
              model: `OpenRouter - ${model.split('/').pop()}`,
              provider: 'openrouter'
            })
          } else {
            reject(new Error('OpenRouter 返回格式错误: ' + body.substring(0, 200)))
          }
        } catch (e) {
          reject(new Error('解析 OpenRouter 响应失败: ' + body.substring(0, 200)))
        }
      })
    })

    req.on('error', reject)
    req.on('timeout', () => { req.destroy(); reject(new Error('OpenRouter 请求超时')) })
    req.write(data)
    req.end()
  })
}

/**
 * 调用自定义 OpenAI 兼容接口
 */
async function callCustomOpenAI(modelKey, prompt, messages = null) {
  const https = require('https')
  const url = require('url')
  
  const config = getApiConfig('custom')
  if (!config || !config.apiKey || !config.baseUrl) {
    throw new Error('自定义 API 未配置，请在设置中填写 Base URL 和 API Key')
  }

  const model = modelKey.replace('custom/', '')
  const msgs = messages || [
    { role: 'system', content: '你是一个专业的新媒体内容创作者' },
    { role: 'user', content: prompt }
  ]

  const parsedUrl = new url.URL(`${config.baseUrl}/chat/completions`)
  
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      model: model,
      messages: msgs,
      max_tokens: 4000,
      temperature: 0.7
    })

    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || 443,
      path: parsedUrl.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Length': Buffer.byteLength(data)
      },
      timeout: 60000
    }

    const req = https.request(options, (res) => {
      let body = ''
      res.on('data', chunk => body += chunk)
      res.on('end', () => {
        try {
          const response = JSON.parse(body)
          if (response.choices && response.choices[0]) {
            resolve({
              content: response.choices[0].message.content,
              model: model,
              provider: 'custom'
            })
          } else {
            reject(new Error('API 返回格式错误: ' + body.substring(0, 200)))
          }
        } catch (e) {
          reject(new Error('解析响应失败: ' + body.substring(0, 200)))
        }
      })
    })

    req.on('error', reject)
    req.on('timeout', () => { req.destroy(); reject(new Error('请求超时')) })
    req.write(data)
    req.end()
  })
}

/**
 * 调用 Agnes AI（帝意优选）- 保留原有逻辑
 */
async function callAgnesAI(prompt, messages = null) {
  const https = require('https')
  
  const AGNES_API_KEY = 'sk-l0JImHVaXxq565zohwqt0Mn8EI58c2l71EkFH5tvZ2DJwTdk'
  const AGNES_BASE_URL = 'https://apihub.agnes-ai.com/v1'
  
  const msgs = messages || [
    { role: 'system', content: '你是一个专业的新媒体内容创作者' },
    { role: 'user', content: prompt }
  ]

  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      model: 'agnes-2.0-flash',
      messages: msgs,
      max_tokens: 4000,
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
      timeout: 60000
    }

    const req = https.request(options, (res) => {
      let body = ''
      res.on('data', chunk => body += chunk)
      res.on('end', () => {
        try {
          const response = JSON.parse(body)
          if (response.choices && response.choices[0]) {
            resolve({
              content: response.choices[0].message.content,
              model: '帝意优选 (Agnes AI)',
              provider: 'agnes'
            })
          } else {
            reject(new Error('Agnes API 返回格式错误'))
          }
        } catch (e) {
          reject(new Error('解析 Agnes 响应失败'))
        }
      })
    })

    req.on('error', reject)
    req.on('timeout', () => { req.destroy(); reject(new Error('Agnes API 请求超时')) })
    req.write(data)
    req.end()
  })
}

/**
 * 获取所有可用模型列表（用于前端下拉框）
 */
function getAllModels() {
  const models = {
    '帝意优选 (默认)': { 'agnes': '帝意优选 (Agnes AI)' },
    'OpenRouter (200+模型)': Object.fromEntries(
      Object.entries(OPENROUTER_MODELS).map(([k, v]) => [k, v.name])
    ),
    '自定义接口': { 'custom/自定义模型': '填写 Base URL 后可用' }
  }
  return models
}

module.exports = {
  callAIModel,
  callOpenRouter,
  callCustomOpenAI,
  callAgnesAI,
  getApiConfig,
  saveApiConfig,
  getAllModels,
  OPENROUTER_MODELS
}
