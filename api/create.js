// POST /api/create  (창조, 다시 창조)
// 순서: 재료 검사 → 요청 횟수 확인(IP당 10분 20번) → AI 호출 → 하네스 검사(실패 시 남은 시간이 1.5초 이상이면 1번 재요청) → 응답
// 재시도 포함 전체 14초 제한. 재료의 양은 AI가 아니라 서버가 lib/ingredients.js에서 채운다.
import { resolveTriple } from '../lib/ingredients.js'
import { bodyOf, clientIp, logSafe, sendError, sendJson } from '../lib/http.js'
import { hitRate } from '../lib/ratelimit.js'
import { LlmError, callLlm, llmConfig, modeOf } from '../lib/llm.js'
import { recipePrompt } from '../lib/prompt.js'
import { checkRecipe, parseJsonLoose } from '../lib/harness.js'

export const DEADLINE_MS = 14_000
export const RETRY_MIN_REMAINING_MS = 1_500
export const RATE = { limit: 20, windowMs: 10 * 60_000 }

const AI_MESSAGES = {
  timeout: 'AI 응답이 너무 오래 걸려요(14초 초과). 다시 시도해 주세요.',
  network: 'AI 서버에 연결하지 못했어요. 잠시 뒤에 다시 시도해 주세요.',
  upstream: 'AI 호출에 실패했어요. 잠시 뒤에 다시 시도해 주세요.'
}

/** 시간 제한을 바꿔 테스트할 수 있게 팩토리로 둔다. 배포 기본값은 14초. */
export const createHandler = ({ deadlineMs = DEADLINE_MS, retryMinRemainingMs = RETRY_MIN_REMAINING_MS } = {}) => async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader?.('Allow', 'POST')
    return sendError(res, 'method_not_allowed')
  }
  const body = bodyOf(req)
  if (!body || Array.isArray(body)) return sendError(res, 'invalid_request')
  const picked = resolveTriple(body.ingredientIds)
  if (!picked) return sendError(res, 'invalid_ingredients')
  let avoidMenuName
  if (body.avoidMenuName !== undefined) {
    if (typeof body.avoidMenuName !== 'string' || !body.avoidMenuName.trim() || body.avoidMenuName.length > 40) return sendError(res, 'invalid_request')
    avoidMenuName = body.avoidMenuName.trim()
  }

  const rate = await hitRate({ ip: clientIp(req), bucket: 'create', ...RATE })
  if (!rate.allowed) {
    res.setHeader?.('Retry-After', String(rate.retryAfterSec))
    return sendError(res, 'rate_limited')
  }

  let cfg
  try {
    cfg = llmConfig()
  } catch (e) {
    return sendError(res, 'not_configured', `서버 설정이 필요해요: ${e.hint ?? 'LLM_PROVIDER'} (.env 확인)`)
  }

  const t0 = Date.now()
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), deadlineMs)
  try {
    let retryReason
    let lastReason = ''
    for (let attempt = 0; attempt < 2; attempt++) {
      const { system, user } = recipePrompt({ picked, references: [], avoidMenuName, retryReason })
      let text
      try {
        text = await callLlm({ system, user, picked, avoidMenuName, signal: ctl.signal })
      } catch (e) {
        const kind = e instanceof LlmError ? e.kind : 'network'
        logSafe('create', { kind, status: e?.status }) // 종류와 HTTP 상태만. 키·응답 원문은 남기지 않는다.
        if (kind === 'not_configured') return sendError(res, 'not_configured', `서버 설정이 필요해요: ${e.hint ?? 'LLM_PROVIDER'} (.env 확인)`)
        return sendError(res, 'ai_failed', AI_MESSAGES[kind] ?? AI_MESSAGES.upstream)
      }
      const chk = checkRecipe(parseJsonLoose(text), picked, { avoidMenuName })
      if (chk.ok) {
        return sendJson(res, 200, {
          menuName: chk.recipe.menuName,
          minutes: chk.recipe.minutes,
          servings: 1,
          ingredients: picked.map((p) => ({ id: p.id, name: p.name, amount: p.amount })),
          steps: chk.recipe.steps,
          references: [], // 3순위: 식약처 레시피(COOKRCP01) 연결 시 제목·출처를 담는다
          mode: modeOf(cfg)
        })
      }
      lastReason = chk.reason
      const remaining = deadlineMs - (Date.now() - t0)
      if (attempt === 0 && remaining >= retryMinRemainingMs) {
        retryReason = chk.reason
        continue
      }
      break
    }
    logSafe('create', { kind: 'rule_failed', reason: lastReason })
    return sendError(res, 'rule_failed')
  } finally {
    clearTimeout(timer)
  }
}

export default createHandler()
