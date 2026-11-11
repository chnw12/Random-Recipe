// GET /api/health  (프론트엔드가 백엔드와 연결됐는지 확인)
// 비밀 값은 절대 담지 않는다: 설정 여부(true/false)와 모드 이름만 알려 준다.
import { sendError, sendJson } from '../lib/http.js'
import { llmConfig, modeOf } from '../lib/llm.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader?.('Allow', 'GET')
    return sendError(res, 'method_not_allowed')
  }
  let mode = null
  try {
    mode = modeOf(llmConfig())
  } catch {
    /* AI 설정이 없으면 mode 는 null */
  }
  return sendJson(res, 200, { ok: true, mode, db: Boolean(process.env.DATABASE_URL) })
}
