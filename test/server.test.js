import { afterEach, beforeEach, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import create, { RATE as CREATE_RATE, createHandler } from '../api/create.js'
import confirm, { RATE as CONFIRM_RATE } from '../api/confirm.js'
import { __setSqlForTests } from '../lib/db.js'
import { llmConfig } from '../lib/llm.js'
import { INGREDIENTS, bySlot } from '../lib/ingredients.js'
import { GOOD_RECIPE, TRIPLE, call, fakeOpenAi, fakeSql, isolate } from './util.js'

let env
const setup = (vars) => { env = isolate(vars); return env }
afterEach(() => env?.restore())

const KEY = 'sk-test-SECRET-key-1234567890abcdef'
const OPENAI = { LLM_PROVIDER: 'openai', OPENAI_API_KEY: KEY }
const UUID = '3f2a6c1e-5b7d-4e8a-9c0d-1a2b3c4d5e6f'
const body = (b) => ({ body: b })

describe('POST /api/create — 입력 검사', () => {
  beforeEach(() => setup({ LLM_PROVIDER: 'mock' }))

  test('GET은 405 method_not_allowed (Allow 헤더)', async () => {
    const r = await call(create, { method: 'GET' })
    assert.equal(r.statusCode, 405)
    assert.equal(r.body.error, 'method_not_allowed')
    assert.equal(r.headers.Allow, 'POST')
    assert.equal(typeof r.body.message, 'string')
  })

  test('잘못된 재료는 400 invalid_ingredients (개수/목록 밖/칸 중복/형식)', async () => {
    for (const ids of [['p-tofu', 'c-cabbage'], ['p-tofu', 'c-cabbage', 'x-nope'], ['p-tofu', 'p-egg', 's-curry'], 'p-tofu', null, [1, 2, 3], undefined, ['p-tofu', 'p-tofu', 'p-tofu']]) {
      const r = await call(create, body({ ingredientIds: ids }))
      assert.equal(r.statusCode, 400, JSON.stringify(ids))
      assert.equal(r.body.error, 'invalid_ingredients')
    }
  })

  test('본문이 없거나 객체가 아니면 400 invalid_request, avoidMenuName 형식 검사', async () => {
    for (const b of [undefined, null, 'x', [], 5]) assert.equal((await call(create, { body: b })).body.error, 'invalid_request', String(b))
    for (const avoid of ['', '   ', 'x'.repeat(41), 5, {}]) {
      const r = await call(create, body({ ingredientIds: TRIPLE, avoidMenuName: avoid }))
      assert.equal(r.statusCode, 400)
      assert.equal(r.body.error, 'invalid_request')
    }
    assert.equal((await call(create, body({ ingredientIds: TRIPLE, avoidMenuName: 'x'.repeat(40) }))).statusCode, 200)
  })

  test('본문이 JSON 문자열로 와도 파싱한다 / 깨진 JSON 문자열은 400', async () => {
    assert.equal((await call(create, { body: JSON.stringify({ ingredientIds: TRIPLE }) })).statusCode, 200)
    assert.equal((await call(create, { body: '{깨진' })).body.error, 'invalid_request')
  })
})

describe('POST /api/create — mock 모드', () => {
  beforeEach(() => setup({ LLM_PROVIDER: 'mock' }))

  test('성공 응답 형식: 양은 서버가 채우고 mode는 mock', async () => {
    const r = await call(create, body({ ingredientIds: ['s-curry', 'p-tofu', 'c-cabbage'] })) // 칸 순서가 달라도 됨
    assert.equal(r.statusCode, 200)
    assert.deepEqual(Object.keys(r.body).sort(), ['ingredients', 'menuName', 'minutes', 'mode', 'references', 'servings', 'steps'])
    assert.equal(r.body.mode, 'mock')
    assert.equal(r.body.servings, 1)
    assert.deepEqual(r.body.references, [])
    assert.deepEqual(r.body.ingredients, [
      { id: 'p-tofu', name: '두부', amount: '150g' },
      { id: 'c-cabbage', name: '양배추', amount: '120g' },
      { id: 's-curry', name: '카레가루', amount: '1큰술' }
    ])
    assert.ok(r.body.steps.length >= 3)
  })

  test('모든 재료가 최소 한 번씩 쓰이는 조합 60개가 전부 200', async () => {
    const P = bySlot('protein'), C = bySlot('carb'), S = bySlot('sauce')
    for (let i = 0; i < 20; i++) {
      for (const [a, b, c] of [[P[i], C[(i + 3) % 20], S[(i + 7) % 20]], [P[(i + 5) % 20], C[i], S[(i + 11) % 20]], [P[(i + 9) % 20], C[(i + 13) % 20], S[i]]]) {
        const r = await call(create, { body: { ingredientIds: [a.id, b.id, c.id] }, ip: `10.0.${i}.${Math.floor(Math.random() * 250)}` })
        assert.equal(r.statusCode, 200, `${a.name}+${b.name}+${c.name} → ${JSON.stringify(r.body)}`)
      }
    }
  })

  test('다시 창조(avoidMenuName)는 다른 이름', async () => {
    for (let i = 0; i < 10; i++) {
      const first = await call(create, { body: { ingredientIds: TRIPLE }, ip: `10.1.0.${i}` })
      const again = await call(create, { body: { ingredientIds: TRIPLE, avoidMenuName: first.body.menuName }, ip: `10.1.1.${i}` })
      assert.equal(again.statusCode, 200)
      assert.notEqual(again.body.menuName, first.body.menuName)
    }
  })
})

describe('POST /api/create — 설정(.env) 점검', () => {
  test('LLM_PROVIDER가 없으면 500 not_configured, 필요한 변수 이름을 안내', async () => {
    setup({})
    const r = await call(create, body({ ingredientIds: TRIPLE }))
    assert.equal(r.statusCode, 500)
    assert.equal(r.body.error, 'not_configured')
    assert.match(r.body.message, /LLM_PROVIDER/)
  })
  test('provider는 있는데 키가 없으면 그 키 이름만 안내', async () => {
    for (const [provider, key] of [['openai', 'OPENAI_API_KEY'], ['gemini', 'GEMINI_API_KEY'], ['anthropic', 'ANTHROPIC_API_KEY']]) {
      setup({ LLM_PROVIDER: provider })
      const r = await call(create, body({ ingredientIds: TRIPLE }))
      assert.equal(r.statusCode, 500)
      assert.equal(r.body.error, 'not_configured')
      assert.ok(r.body.message.includes(key), r.body.message)
      env.restore()
    }
  })
  test('알 수 없는 provider도 not_configured', async () => {
    setup({ LLM_PROVIDER: 'foo' })
    assert.equal((await call(create, body({ ingredientIds: TRIPLE }))).body.error, 'not_configured')
  })
  test('입력 검사는 설정 점검보다 먼저 (잘못된 재료는 설정이 없어도 400)', async () => {
    setup({})
    assert.equal((await call(create, body({ ingredientIds: [] }))).statusCode, 400)
  })
  test('llmConfig: 대소문자/공백 허용, 기본 모델, 모델 덮어쓰기', () => {
    assert.equal(llmConfig({ LLM_PROVIDER: ' OpenAI ', OPENAI_API_KEY: 'k' }).provider, 'openai')
    assert.equal(llmConfig({ LLM_PROVIDER: 'openai', OPENAI_API_KEY: 'k' }).model, 'gpt-4o-mini')
    assert.equal(llmConfig({ LLM_PROVIDER: 'openai', OPENAI_API_KEY: 'k', OPENAI_MODEL: 'my-model' }).model, 'my-model')
    assert.equal(llmConfig({ LLM_PROVIDER: 'mock' }).provider, 'mock')
  })
})

describe('POST /api/create — OpenAI / Gemini / Anthropic 호출', () => {
  test('openai: chat/completions, Bearer 키, 규칙은 system·재료는 user, JSON 모드', async () => {
    setup(OPENAI)
    const calls = fakeOpenAi([GOOD_RECIPE])
    const r = await call(create, body({ ingredientIds: TRIPLE }))
    assert.equal(r.statusCode, 200)
    assert.equal(r.body.mode, 'ai')
    assert.equal(r.body.menuName, GOOD_RECIPE.menuName)
    assert.equal(calls.length, 1)
    assert.equal(calls[0].url, 'https://api.openai.com/v1/chat/completions')
    assert.equal(calls[0].init.headers.authorization, `Bearer ${KEY}`)
    const b = calls[0].body
    assert.equal(b.model, 'gpt-4o-mini')
    assert.deepEqual(b.response_format, { type: 'json_object' })
    assert.equal(b.messages[0].role, 'system')
    assert.match(b.messages[0].content, /칼로리/) // 규칙은 system
    assert.equal(b.messages[1].role, 'user')
    for (const id of TRIPLE) assert.ok(b.messages[1].content.includes(id)) // 재료는 user
    assert.ok(!b.messages[0].content.includes('p-tofu'))
  })

  test('AI가 재료 양을 응답에 써도 무시하고 서버 기준량을 쓴다', async () => {
    setup(OPENAI)
    fakeOpenAi([{ ...GOOD_RECIPE, ingredients: [{ id: 'p-tofu', name: '두부', amount: '999kg' }] }])
    const r = await call(create, body({ ingredientIds: TRIPLE }))
    assert.equal(r.body.ingredients[0].amount, '150g')
  })

  test('OPENAI_MODEL/OPENAI_BASE_URL을 바꿀 수 있다', async () => {
    setup({ ...OPENAI, OPENAI_MODEL: 'm-x', OPENAI_BASE_URL: 'https://proxy.example/v1/' })
    const calls = fakeOpenAi([GOOD_RECIPE])
    await call(create, body({ ingredientIds: TRIPLE }))
    assert.equal(calls[0].url, 'https://proxy.example/v1/chat/completions')
    assert.equal(calls[0].body.model, 'm-x')
  })

  test('gemini: OpenAI 호환 엔드포인트', async () => {
    setup({ LLM_PROVIDER: 'gemini', GEMINI_API_KEY: 'g-key' })
    const calls = fakeOpenAi([GOOD_RECIPE])
    const r = await call(create, body({ ingredientIds: TRIPLE }))
    assert.equal(r.statusCode, 200)
    assert.equal(calls[0].url, 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions')
    assert.equal(calls[0].init.headers.authorization, 'Bearer g-key')
  })

  test('anthropic: messages API (x-api-key, anthropic-version, system 분리)', async () => {
    setup({ LLM_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: 'a-key' })
    const calls = []
    globalThis.fetch = async (url, init) => {
      calls.push({ url, init, body: JSON.parse(init.body) })
      return { ok: true, status: 200, json: async () => ({ content: [{ type: 'text', text: JSON.stringify(GOOD_RECIPE) }] }) }
    }
    const r = await call(create, body({ ingredientIds: TRIPLE }))
    assert.equal(r.statusCode, 200)
    assert.equal(calls[0].url, 'https://api.anthropic.com/v1/messages')
    assert.equal(calls[0].init.headers['x-api-key'], 'a-key')
    assert.equal(calls[0].init.headers['anthropic-version'], '2023-06-01')
    assert.equal(typeof calls[0].body.system, 'string')
    assert.equal(calls[0].body.messages[0].role, 'user')
  })

  test('avoidMenuName은 user(데이터 구역)에만 들어간다', async () => {
    setup(OPENAI)
    const calls = fakeOpenAi([{ ...GOOD_RECIPE, menuName: '새로운 두부 양배추 카레가루 볶음' }])
    const r = await call(create, body({ ingredientIds: TRIPLE, avoidMenuName: '이전 메뉴 이름' }))
    assert.equal(r.statusCode, 200)
    assert.ok(calls[0].body.messages[1].content.includes('이전 메뉴 이름'))
    assert.ok(!calls[0].body.messages[0].content.includes('이전 메뉴 이름'))
  })
})

describe('POST /api/create — 재시도, 오류 매핑', () => {
  beforeEach(() => setup(OPENAI))

  test('첫 응답이 검사에 걸리면 1번 재요청하고, 재요청에는 거절 이유가 들어간다', async () => {
    const calls = fakeOpenAi(['JSON 아님', GOOD_RECIPE])
    const r = await call(create, body({ ingredientIds: TRIPLE }))
    assert.equal(r.statusCode, 200)
    assert.equal(calls.length, 2)
    assert.match(calls[1].body.messages[1].content, /거절/)
  })

  test('두 번 다 실패하면 422 rule_failed, 더 부르지 않는다', async () => {
    const calls = fakeOpenAi([{ ...GOOD_RECIPE, menuName: '300kcal 두부 양배추 카레가루' }])
    const r = await call(create, body({ ingredientIds: TRIPLE }))
    assert.equal(r.statusCode, 422)
    assert.equal(r.body.error, 'rule_failed')
    assert.equal(calls.length, 2)
  })

  test('남은 시간이 1.5초 미만이면 재요청하지 않는다', async () => {
    const calls = fakeOpenAi(['JSON 아님', GOOD_RECIPE])
    const r = await call(createHandler({ deadlineMs: 1000 }), body({ ingredientIds: TRIPLE })) // 남은 시간 < 1500ms
    assert.equal(r.statusCode, 422)
    assert.equal(calls.length, 1)
  })

  test('AI HTTP 오류는 502 ai_failed, 로그에는 상태만 (키·응답 원문 없음)', async () => {
    const calls = fakeOpenAi([{ status: 401, leak: `invalid api key ${KEY}` }])
    const r = await call(create, body({ ingredientIds: TRIPLE }))
    assert.equal(r.statusCode, 502)
    assert.equal(r.body.error, 'ai_failed')
    assert.equal(calls.length, 1) // 호출 실패는 재시도하지 않는다
    const out = JSON.stringify(r.body) + env.logs.join('\n')
    assert.ok(!out.includes(KEY), '키가 응답/로그에 노출됨')
    assert.ok(!out.includes('invalid api key'), '응답 원문이 노출됨')
    assert.match(env.logs.join('\n'), /"status":401/)
  })

  test('네트워크 오류도 502', async () => {
    fakeOpenAi([{ network: true }])
    const r = await call(create, body({ ingredientIds: TRIPLE }))
    assert.equal(r.statusCode, 502)
    assert.match(r.body.message, /연결/)
  })

  test('시간 초과는 502 ai_failed (AbortController로 끊는다)', async () => {
    fakeOpenAi(['hang'])
    const t0 = Date.now()
    const r = await call(createHandler({ deadlineMs: 150 }), body({ ingredientIds: TRIPLE }))
    assert.equal(r.statusCode, 502)
    assert.equal(r.body.error, 'ai_failed')
    assert.match(r.body.message, /오래/)
    assert.ok(Date.now() - t0 < 2000)
  })

  test('응답 모양이 이상하면(choices 없음) 502', async () => {
    globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => ({}) })
    assert.equal((await call(create, body({ ingredientIds: TRIPLE }))).statusCode, 502)
  })
})

describe('요청 횟수 제한', () => {
  test('create: IP당 10분 20번, 21번째는 429 + Retry-After, 다른 IP·다른 구분은 영향 없음', async () => {
    setup({ LLM_PROVIDER: 'mock' })
    for (let i = 0; i < CREATE_RATE.limit; i++) assert.equal((await call(create, { body: { ingredientIds: TRIPLE }, ip: '198.51.100.7' })).statusCode, 200, `#${i + 1}`)
    const over = await call(create, { body: { ingredientIds: TRIPLE }, ip: '198.51.100.7' })
    assert.equal(over.statusCode, 429)
    assert.equal(over.body.error, 'rate_limited')
    assert.ok(Number(over.headers['Retry-After']) >= 1)
    assert.equal((await call(create, { body: { ingredientIds: TRIPLE }, ip: '198.51.100.8' })).statusCode, 200)
    // confirm은 별도 구분(bucket)이라 create 횟수에 영향받지 않는다
    assert.equal((await call(confirm, { body: { browserId: UUID, menuName: 'm', ingredientIds: TRIPLE }, ip: '198.51.100.7' })).statusCode, 200)
  })

  test('잘못된 요청은 횟수를 쓰지 않는다 (검사가 먼저)', async () => {
    setup({ LLM_PROVIDER: 'mock' })
    for (let i = 0; i < 30; i++) await call(create, { body: { ingredientIds: [] }, ip: '198.51.100.9' })
    assert.equal((await call(create, { body: { ingredientIds: TRIPLE }, ip: '198.51.100.9' })).statusCode, 200)
  })

  test('DB가 있으면 rate_limits에 upsert로 센다 (IP 원문은 저장하지 않는다)', async () => {
    setup({ LLM_PROVIDER: 'mock' })
    const sql = fakeSql()
    __setSqlForTests(sql)
    for (let i = 0; i < 3; i++) await call(create, { body: { ingredientIds: TRIPLE }, ip: '198.51.100.77' })
    const q = sql.db.queries.find((x) => x.startsWith('insert into rate_limits'))
    assert.match(q, /on conflict \(ip, window_start\) do update set count = rate_limits\.count \+ 1 returning count/)
    for (const k of sql.db.rate.keys()) assert.ok(!k.includes('198.51.100.77'))
    assert.equal([...sql.db.rate.values()][0], 3)
  })

  test('DB 오류가 나도 요청을 막지 않고 메모리 카운터로 대신한다', async () => {
    setup({ LLM_PROVIDER: 'mock' })
    const sql = fakeSql()
    sql.db.failNext = true
    __setSqlForTests(sql)
    assert.equal((await call(create, body({ ingredientIds: TRIPLE }))).statusCode, 200)
    assert.ok(!env.logs.join('\n').includes('SECRETPASS'))
  })

  test('x-forwarded-for의 첫 값을 클라이언트 IP로 쓴다', async () => {
    setup({ LLM_PROVIDER: 'mock' })
    for (let i = 0; i < CREATE_RATE.limit; i++) await call(create, { body: { ingredientIds: TRIPLE }, headers: { 'x-forwarded-for': '192.0.2.5, 10.0.0.1' }, ip: '192.0.2.5, 10.0.0.1' })
    const r = await call(create, { body: { ingredientIds: TRIPLE }, ip: '192.0.2.5, 10.9.9.9' }) // 뒤쪽(프록시) 값이 달라도 같은 클라이언트
    assert.equal(r.statusCode, 429)
  })
})

describe('POST /api/confirm', () => {
  const ok = { browserId: UUID, menuName: '카레향 두부 양배추 볶음', ingredientIds: TRIPLE }

  test('GET은 405', async () => {
    setup({})
    const r = await call(confirm, { method: 'GET' })
    assert.equal(r.statusCode, 405)
    assert.equal(r.body.error, 'method_not_allowed')
  })

  test('DATABASE_URL이 없으면 저장하지 않고 { ok: true, recorded: false }', async () => {
    setup({})
    const r = await call(confirm, body(ok))
    assert.equal(r.statusCode, 200)
    assert.deepEqual(r.body, { ok: true, recorded: false })
  })

  test('형식 검사: browserId(UUID), menuName(1~40자), 재료', async () => {
    setup({})
    for (const [b, code] of [
      [{ ...ok, browserId: 'abc' }, 'invalid_request'], [{ ...ok, browserId: undefined }, 'invalid_request'], [{ ...ok, browserId: '../../etc/passwd' }, 'invalid_request'],
      [{ ...ok, menuName: '' }, 'invalid_request'], [{ ...ok, menuName: '   ' }, 'invalid_request'], [{ ...ok, menuName: 'x'.repeat(41) }, 'invalid_request'], [{ ...ok, menuName: 5 }, 'invalid_request'],
      [{ ...ok, ingredientIds: ['p-tofu'] }, 'invalid_ingredients'], [{ ...ok, ingredientIds: ['p-tofu', 'p-egg', 's-curry'] }, 'invalid_ingredients'], [undefined, 'invalid_request']
    ]) {
      const r = await call(confirm, { body: b })
      assert.equal(r.statusCode, 400, JSON.stringify(b))
      assert.equal(r.body.error, code, JSON.stringify(b))
    }
    assert.equal((await call(confirm, body({ ...ok, menuName: 'x'.repeat(40) }))).statusCode, 200)
  })

  test('DB가 있으면 저장(recorded: true), 같은 browserId+메뉴는 409 duplicate, 다른 메뉴/브라우저는 허용', async () => {
    setup({})
    const sql = fakeSql()
    __setSqlForTests(sql)
    assert.deepEqual((await call(confirm, body(ok))).body, { ok: true, recorded: true })
    assert.equal(sql.db.confirmations.length, 1)
    assert.deepEqual(sql.db.confirmations[0].ingredient_ids, TRIPLE)
    const dup = await call(confirm, body(ok))
    assert.equal(dup.statusCode, 409)
    assert.equal(dup.body.error, 'duplicate')
    assert.equal((await call(confirm, body({ ...ok, menuName: '다른 메뉴' }))).statusCode, 200)
    assert.equal((await call(confirm, body({ ...ok, browserId: '11111111-2222-4333-8444-555555555555' }))).statusCode, 200)
    assert.equal(sql.db.confirmations.length, 3)
  })

  test('10분이 지난 같은 메뉴는 다시 기록할 수 있다', async () => {
    setup({})
    const sql = fakeSql()
    __setSqlForTests(sql)
    await call(confirm, body(ok))
    sql.db.confirmations[0].created_at = new Date(Date.now() - 11 * 60_000).toISOString()
    assert.equal((await call(confirm, body(ok))).statusCode, 200)
  })

  test('DB 오류는 500 record_failed, 연결 정보/오류 원문은 응답·로그에 없다', async () => {
    setup({})
    const sql = fakeSql()
    __setSqlForTests(sql)
    // 쿼리 순서가 아니라 내용으로 실패 지점을 정한다 (요청 제한이 가끔 정리 쿼리를 추가로 실행하므로 순서는 불안정)
    const orig = sql
    const wrapped = async (s, ...v) => (s.join('?').includes('from confirmations') ? Promise.reject(new Error('postgres://user:SECRETPASS@host/db')) : orig(s, ...v))
    wrapped.db = sql.db
    __setSqlForTests(wrapped)
    const r = await call(confirm, body(ok))
    assert.equal(r.statusCode, 500)
    assert.equal(r.body.error, 'record_failed')
    assert.ok(!(JSON.stringify(r.body) + env.logs.join('\n')).includes('SECRETPASS'))
  })

  test('IP당 10분 30번 제한 → 429', async () => {
    setup({})
    for (let i = 0; i < CONFIRM_RATE.limit; i++) assert.equal((await call(confirm, { body: ok, ip: '203.0.113.50' })).statusCode, 200)
    assert.equal((await call(confirm, { body: ok, ip: '203.0.113.50' })).statusCode, 429)
  })
})

test('보안: 어떤 응답 객체에도 환경 변수 값이 들어가지 않는다 (mock·ai·오류)', async () => {
  setup({ ...OPENAI, DATABASE_URL: 'postgres://u:DBSECRET@h/d' })
  __setSqlForTests(null)
  fakeOpenAi([GOOD_RECIPE])
  const outs = [await call(create, body({ ingredientIds: TRIPLE })), await call(create, body({ ingredientIds: [] })), await call(create, { method: 'GET' }), await call(confirm, body({ browserId: UUID, menuName: 'm', ingredientIds: TRIPLE }))]
  for (const r of outs) {
    const s = JSON.stringify(r.body) + JSON.stringify(r.headers)
    assert.ok(!s.includes(KEY) && !s.includes('DBSECRET'))
  }
})

test('재료 데이터는 서버/화면 공용 모듈이라 Node 전용 API를 쓰지 않는다', async () => {
  const { readFile } = await import('node:fs/promises')
  const src = await readFile(new URL('../lib/ingredients.js', import.meta.url), 'utf8')
  assert.ok(!/from 'node:|require\(|process\./.test(src))
  assert.equal(INGREDIENTS.length, 60)
})
