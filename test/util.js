// 테스트 도우미: 가짜 req/res, 환경 변수 격리, 가짜 fetch, 가짜 sql
import { __setSqlForTests } from '../lib/db.js'
import { __resetMemoryRate } from '../lib/ratelimit.js'

export const ENV_KEYS = ['LLM_PROVIDER', 'OPENAI_API_KEY', 'OPENAI_MODEL', 'OPENAI_BASE_URL', 'GEMINI_API_KEY', 'GEMINI_MODEL', 'ANTHROPIC_API_KEY', 'ANTHROPIC_MODEL', 'DATABASE_URL']

/** 테스트 전: 환경 변수를 비우고, DB 없음, 메모리 카운터 초기화. 돌려주는 함수를 호출하면 원상복구. */
export function isolate(env = {}) {
  const saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]))
  const savedFetch = globalThis.fetch
  const savedErr = console.error
  for (const k of ENV_KEYS) delete process.env[k]
  Object.assign(process.env, env)
  __setSqlForTests(null)
  __resetMemoryRate()
  const logs = []
  console.error = (...a) => logs.push(a.map(String).join(' '))
  return {
    logs,
    restore() {
      for (const k of ENV_KEYS) saved[k] === undefined ? delete process.env[k] : (process.env[k] = saved[k])
      globalThis.fetch = savedFetch
      console.error = savedErr
      __setSqlForTests(undefined)
    }
  }
}

export function req({ method = 'POST', body, ip = '203.0.113.1', headers = {} } = {}) {
  return { method, body, headers: { 'x-forwarded-for': ip, ...headers }, socket: { remoteAddress: '127.0.0.1' } }
}

export function res() {
  const r = { statusCode: 200, headers: {}, body: undefined }
  r.status = (c) => ((r.statusCode = c), r)
  r.json = (b) => ((r.body = b), r)
  r.setHeader = (k, v) => ((r.headers[k] = v), r)
  return r
}

export async function call(handler, opts) {
  const rs = res()
  await handler(req(opts), rs)
  return rs
}

export const TRIPLE = ['p-tofu', 'c-cabbage', 's-curry']
export const GOOD_RECIPE = {
  menuName: '카레향 두부 양배추 볶음',
  minutes: 15,
  usedIngredientIds: TRIPLE,
  steps: ['두부는 깍둑 썰어 물기를 뺀다.', '양배추는 한입 크기로 썬다.', '두부와 양배추를 볶고 카레가루를 넣는다.']
}

/** OpenAI 형식 응답을 돌려주는 가짜 fetch. replies: 호출 순서대로의 응답 텍스트 | {status} | 'hang' */
export function fakeOpenAi(replies) {
  const calls = []
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init, body: JSON.parse(init.body) })
    const r = replies[Math.min(calls.length - 1, replies.length - 1)]
    if (r === 'hang') return new Promise((_, rej) => init.signal?.addEventListener('abort', () => rej(new DOMException('aborted', 'AbortError'))))
    if (r?.network) throw new TypeError('fetch failed')
    if (r?.status) return { ok: false, status: r.status, json: async () => ({ error: { message: r.leak ?? 'x' } }), text: async () => r.leak ?? 'x' }
    return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: typeof r === 'string' ? r : JSON.stringify(r) } }] }) }
  }
  return calls
}

/** 아주 작은 in-memory 가짜 neon sql (태그드 템플릿) */
export function fakeSql() {
  const db = { confirmations: [], rate: new Map(), queries: [], failNext: false }
  const sql = async (strings, ...v) => {
    const q = strings.join('?').replace(/\s+/g, ' ').trim()
    db.queries.push(q)
    if (db.failNext) {
      db.failNext = false
      throw new Error('connection to postgres://user:SECRETPASS@host/db failed')
    }
    if (q.startsWith('insert into rate_limits')) {
      const k = v[0] + '|' + v[1]
      db.rate.set(k, (db.rate.get(k) ?? 0) + 1)
      return [{ count: db.rate.get(k) }]
    }
    if (q.startsWith('delete from rate_limits')) return []
    if (q.startsWith('select 1 from confirmations')) {
      const [browser, menu, since] = v
      return db.confirmations.filter((c) => c.browser_id === browser && c.menu_name === menu && c.created_at > since).slice(0, 1).map(() => ({ '?column?': 1 }))
    }
    if (q.startsWith('insert into confirmations')) {
      db.confirmations.push({ browser_id: v[0], menu_name: v[1], ingredient_ids: v[2], created_at: new Date().toISOString() })
      return []
    }
    throw new Error('unexpected query: ' + q)
  }
  sql.db = db
  return sql
}
