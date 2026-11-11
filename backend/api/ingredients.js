// GET /api/ingredients  (재료 목록)
// 칸(slot)별 재료 목록. 화면은 지금 lib/ingredients.js 를 직접 import 하지만, 다른 클라이언트용으로 같은 목록을 API로도 준다.
import { INGREDIENTS, SLOTS } from '../lib/ingredients.js'
import { sendError, sendJson } from '../lib/http.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader?.('Allow', 'GET')
    return sendError(res, 'method_not_allowed')
  }
  return sendJson(res, 200, {
    slots: SLOTS,
    ingredients: INGREDIENTS.map(({ id, name, slot, amount }) => ({ id, name, slot, amount }))
  })
}
