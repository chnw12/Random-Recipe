// POST /api/confirm  (확정 기록)
// 순서: 형식 검사 → 요청 횟수 확인(IP당 10분 30번) → 같은 browserId+메뉴가 10분 안에 있으면 409 → DB 저장
// DATABASE_URL이 없으면 저장하지 않고 { ok: true, recorded: false }. 화면은 이 응답을 기다리지 않는다.
import { resolveTriple } from '../lib/ingredients.js'
import { bodyOf, clientIp, logSafe, sendError, sendJson } from '../lib/http.js'
import { hitRate } from '../lib/ratelimit.js'
import { getSql } from '../lib/db.js'

export const RATE = { limit: 30, windowMs: 10 * 60_000 }
export const DUPLICATE_WINDOW_MS = 10 * 60_000
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader?.('Allow', 'POST')
    return sendError(res, 'method_not_allowed')
  }
  const body = bodyOf(req)
  if (!body || Array.isArray(body)) return sendError(res, 'invalid_request')
  const { browserId } = body
  const menuName = typeof body.menuName === 'string' ? body.menuName.trim() : ''
  if (typeof browserId !== 'string' || !UUID.test(browserId)) return sendError(res, 'invalid_request')
  if (menuName.length < 1 || menuName.length > 40) return sendError(res, 'invalid_request')
  const picked = resolveTriple(body.ingredientIds)
  if (!picked) return sendError(res, 'invalid_ingredients')

  const rate = await hitRate({ ip: clientIp(req), bucket: 'confirm', ...RATE })
  if (!rate.allowed) {
    res.setHeader?.('Retry-After', String(rate.retryAfterSec))
    return sendError(res, 'rate_limited')
  }

  const sql = getSql()
  if (!sql) return sendJson(res, 200, { ok: true, recorded: false })

  try {
    const since = new Date(Date.now() - DUPLICATE_WINDOW_MS).toISOString()
    const dup = await sql`select 1 from confirmations where browser_id = ${browserId} and menu_name = ${menuName} and created_at > ${since} limit 1`
    if (dup?.length) return sendError(res, 'duplicate')
    await sql`insert into confirmations (browser_id, menu_name, ingredient_ids) values (${browserId}, ${menuName}, ${picked.map((p) => p.id)})`
    return sendJson(res, 200, { ok: true, recorded: true })
  } catch {
    logSafe('confirm', { kind: 'record_failed' }) // DB 오류 원문(연결 주소가 섞일 수 있음)은 남기지 않는다
    return sendError(res, 'record_failed')
  }
}
