// 개인 기록: 서버에 보내지 않고 이 브라우저(localStorage)에만 둔다. (익명 브라우저 ID만 확정 기록에 쓰인다)
const mem = new Map() // 저장소를 못 쓰는 환경(사생활 보호 모드 등)에서의 대체. 새로고침하면 사라진다.

function read(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key) ?? mem.get(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    try {
      const raw = mem.get(key)
      return raw ? JSON.parse(raw) : fallback
    } catch {
      return fallback
    }
  }
}
/** 저장에 성공하면 true. 실패하면 호출한 쪽이 "저장하지 못했어요"를 보여준다. */
function write(key, value) {
  const raw = JSON.stringify(value)
  mem.set(key, raw)
  try {
    window.localStorage.setItem(key, raw)
    return true
  } catch {
    return false
  }
}

function uuid() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID()
  const b = crypto.getRandomValues(new Uint8Array(16)) // http 로 여는 환경(randomUUID 없음) 대비
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
export function browserId() {
  let id = read('dr.browser', '')
  if (!UUID.test(id)) {
    id = uuid()
    write('dr.browser', id)
  }
  return id
}

export const getExcluded = () => read('dr.exclude', [])
export const setExcluded = (ids) => write('dr.exclude', ids)

export const getFavorites = () => read('dr.favorites', [])
export const isFavorite = (menuName) => getFavorites().some((f) => f.menu.menuName === menuName)
export function toggleFavorite(menu) {
  const cur = getFavorites()
  const has = cur.find((f) => f.menu.menuName === menu.menuName)
  const next = has ? cur.filter((f) => f !== has) : [{ id: uuid(), savedAt: Date.now(), menu }, ...cur].slice(0, 100)
  return { saved: !has, ok: write('dr.favorites', next) }
}

export const getSpend = () => read('dr.spend', [])
export const addSpend = (rec) => write('dr.spend', [...getSpend(), rec].slice(-1000))

export const getCategory = () => read('dr.category', 'diet')

/** 이번 주(월요일 시작)/이번 달/지난달 쓴 금액 합계 (이 기기의 시간 기준) */
export function spendStats(records, now = new Date()) {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const week = new Date(d)
  week.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  const month = new Date(now.getFullYear(), now.getMonth(), 1).getTime()
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime()
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime()
  const sum = (from, to) => records.filter((r) => r.at >= from && r.at < to).reduce((a, r) => a + r.total, 0)
  return {
    week: sum(week.getTime(), week.getTime() + 7 * 864e5),
    month: sum(month, next),
    prevMonth: sum(prev, month),
    hasAny: records.length > 0,
    hasPrev: records.some((r) => r.at >= prev && r.at < month)
  }
}

export const won = (n) => `${n.toLocaleString('ko-KR')}원`
