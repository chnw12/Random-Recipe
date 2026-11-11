// 브라우저는 /api 만 부른다. 키, AI 호출, 검사, 요청 횟수 제한, 확정 기록은 전부 서버에서 한다.

export class ApiError extends Error {
  constructor(code, message) {
    super(message)
    this.code = code
  }
}

const CLIENT_TIMEOUT_MS = 16_000 // 서버 전체 제한(14초)보다 조금 길게

/** 창조 / 다시 창조. 다시 창조면 이전 메뉴 이름을 avoidMenuName 으로 보낸다. */
export async function createMenu(ingredientIds, avoidMenuName) {
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), CLIENT_TIMEOUT_MS)
  try {
    const res = await fetch('/api/create', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ingredientIds, ...(avoidMenuName ? { avoidMenuName } : {}) }),
      signal: ctl.signal
    })
    const data = await res.json().catch(() => null)
    if (!res.ok || !data || data.error) throw new ApiError(data?.error ?? 'network', data?.message ?? '서버에 연결하지 못했어요.')
    return data
  } catch (e) {
    if (e instanceof ApiError) throw e
    throw new ApiError(ctl.signal.aborted ? 'timeout' : 'network', ctl.signal.aborted ? '응답이 너무 오래 걸려요. 다시 시도해 주세요.' : '서버에 연결하지 못했어요.')
  } finally {
    clearTimeout(timer)
  }
}

/** 확정 기록. 응답을 기다리지 않고, 실패해도 화면 흐름을 막지 않는다. */
export function recordConfirm({ browserId, menuName, ingredientIds }) {
  try {
    void fetch('/api/confirm', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ browserId, menuName, ingredientIds }),
      keepalive: true
    }).catch(() => undefined)
  } catch {
    /* 무시 */
  }
}
