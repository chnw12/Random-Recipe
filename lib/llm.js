// LLM 호출은 이 파일 한 곳에서만 한다.
// LLM_PROVIDER = openai (chat/completions) | gemini (OpenAI 호환 엔드포인트) | anthropic (messages) | mock
// 규칙은 system, 재료·참고 자료는 user. 오류는 not_configured / upstream(HTTP 상태만) / timeout / network 로 나눈다.
// 키와 응답 원문은 오류 객체, 로그, 응답 어디에도 넣지 않는다.
import { mockRecipe } from './mock.js'

export class LlmError extends Error {
  /** @param {'not_configured'|'upstream'|'timeout'|'network'} kind */
  constructor(kind, { status, hint } = {}) {
    super(kind) // 메시지는 종류만. 상세(키/원문)를 담지 않는다.
    this.kind = kind
    this.status = status
    this.hint = hint // 설정 안내(필요한 환경 변수 이름만)
  }
}

export const PROVIDERS = ['openai', 'gemini', 'anthropic', 'mock']

// 모델 이름은 계정/시점마다 달라질 수 있어 환경 변수로 바꿀 수 있게 둔다. 기본값은 가볍고 흔한 모델이다.
const DEFAULTS = {
  openai: { url: 'https://api.openai.com/v1/chat/completions', keyVar: 'OPENAI_API_KEY', modelVar: 'OPENAI_MODEL', model: 'gpt-4o-mini', baseVar: 'OPENAI_BASE_URL' },
  gemini: { url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', keyVar: 'GEMINI_API_KEY', modelVar: 'GEMINI_MODEL', model: 'gemini-2.5-flash' },
  anthropic: { url: 'https://api.anthropic.com/v1/messages', keyVar: 'ANTHROPIC_API_KEY', modelVar: 'ANTHROPIC_MODEL', model: 'claude-sonnet-5-5' }
}

/** 설정 점검. 문제가 있으면 LlmError('not_configured')에 "어떤 설정이 필요한지"(변수 이름만)를 담아 던진다. */
export function llmConfig(env = process.env) {
  const provider = (env.LLM_PROVIDER ?? '').trim().toLowerCase()
  if (!provider) throw new LlmError('not_configured', { hint: `LLM_PROVIDER (${PROVIDERS.join(' | ')})` })
  if (!PROVIDERS.includes(provider)) throw new LlmError('not_configured', { hint: `LLM_PROVIDER는 ${PROVIDERS.join(' | ')} 중 하나여야 해요` })
  if (provider === 'mock') return { provider }
  const d = DEFAULTS[provider]
  const apiKey = (env[d.keyVar] ?? '').trim()
  if (!apiKey) throw new LlmError('not_configured', { hint: d.keyVar })
  let url = d.url
  if (d.baseVar && env[d.baseVar]) url = `${env[d.baseVar].replace(/\/+$/, '')}/chat/completions`
  return { provider, apiKey, model: (env[d.modelVar] ?? '').trim() || d.model, url }
}

/** 실제 호출 없이 모드만 알고 싶을 때: 'mock' | 'ai' */
export const modeOf = (cfg) => (cfg.provider === 'mock' ? 'mock' : 'ai')

/**
 * @param {{system:string,user:string,picked:object[],avoidMenuName?:string,signal?:AbortSignal,env?:object,fetchImpl?:Function}} o
 * @returns {Promise<string>} 모델이 돌려준 텍스트 (JSON 문자열이어야 하며 검사는 하네스가 한다)
 */
export async function callLlm({ system, user, picked, avoidMenuName, signal, env = process.env, fetchImpl = globalThis.fetch }) {
  const cfg = llmConfig(env)
  if (cfg.provider === 'mock') return JSON.stringify(mockRecipe(picked, { avoidMenuName }))

  let req
  if (cfg.provider === 'anthropic') {
    req = {
      headers: { 'content-type': 'application/json', 'x-api-key': cfg.apiKey, 'anthropic-version': '2023-06-01' },
      body: { model: cfg.model, max_tokens: 1200, system, messages: [{ role: 'user', content: user }] }
    }
  } else {
    // openai, gemini(OpenAI 호환)
    req = {
      headers: { 'content-type': 'application/json', authorization: `Bearer ${cfg.apiKey}` },
      body: { model: cfg.model, messages: [{ role: 'system', content: system }, { role: 'user', content: user }], response_format: { type: 'json_object' } }
    }
  }

  let res
  try {
    res = await fetchImpl(cfg.url, { method: 'POST', headers: req.headers, body: JSON.stringify(req.body), signal })
  } catch {
    throw new LlmError(signal?.aborted ? 'timeout' : 'network')
  }
  if (!res.ok) throw new LlmError('upstream', { status: res.status }) // 응답 본문은 읽지도, 남기지도 않는다
  let json
  try {
    json = await res.json()
  } catch {
    throw new LlmError(signal?.aborted ? 'timeout' : 'upstream', { status: res.status })
  }
  const text = cfg.provider === 'anthropic'
    ? (json?.content ?? []).filter((c) => c?.type === 'text').map((c) => c.text ?? '').join('')
    : json?.choices?.[0]?.message?.content
  if (typeof text !== 'string' || !text.trim()) throw new LlmError('upstream', { status: res.status })
  return text
}
