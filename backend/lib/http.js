// 서버 공통: 오류 형식 { error, message }, 본문 읽기, 클라이언트 IP.

export const ERRORS = {
  invalid_ingredients: [400, '재료 3개(단백질·채소·양념 칸마다 하나)가 올바르지 않아요.'],
  invalid_request: [400, '요청 형식이 올바르지 않아요.'],
  method_not_allowed: [405, '허용되지 않는 요청 방식이에요.'],
  duplicate: [409, '방금 이미 확정한 메뉴예요.'],
  rule_failed: [422, '메뉴를 안전하게 만들지 못했어요. 다시 시도해 주세요.'],
  rate_limited: [429, '요청이 너무 많아요. 잠시 뒤에 다시 시도해 주세요.'],
  not_configured: [500, '서버 설정이 아직 없어요.'],
  record_failed: [500, '기록을 저장하지 못했어요.'],
  ai_failed: [502, 'AI 호출에 실패했어요. 잠시 뒤에 다시 시도해 주세요.']
}

/** { error: 코드, message: 화면에 보여줄 한국어 문구 }. message를 바꿔 쓸 수 있지만 키·응답 원문·.env 값은 넣지 않는다. */
export function sendError(res, code, message) {
  const [status, fallback] = ERRORS[code]
  res.status(status).json({ error: code, message: message ?? fallback })
}

export function sendJson(res, status, body) {
  res.status(status).json(body)
}

/** Vercel은 JSON 본문을 req.body로 파싱해 준다. 문자열로 오면 직접 파싱한다. 잘못된 JSON이면 undefined. */
export function bodyOf(req) {
  const b = req.body
  if (b === undefined || b === null) return undefined
  if (typeof b === 'string') {
    try {
      return JSON.parse(b)
    } catch {
      return undefined
    }
  }
  return typeof b === 'object' ? b : undefined
}

/** 프록시 뒤(Vercel)에서는 x-forwarded-for의 첫 값이 클라이언트다. */
export function clientIp(req) {
  const xff = req.headers?.['x-forwarded-for']
  const first = (Array.isArray(xff) ? xff[0] : xff)?.split(',')[0]?.trim()
  return first || req.headers?.['x-real-ip'] || req.socket?.remoteAddress || 'unknown'
}

/** 로그에는 오류 종류만 남긴다. 키, 요청/응답 원문, 환경 변수 값은 남기지 않는다. */
export function logSafe(tag, info) {
  console.error(`[${tag}]`, JSON.stringify(info))
}
