import { afterEach, test } from 'node:test'
import assert from 'node:assert/strict'
import health from '../api/health.js'
import ingredients from '../api/ingredients.js'
import { INGREDIENTS } from '../lib/ingredients.js'
import { call, isolate } from './util.js'

let env
afterEach(() => env?.restore())

test('GET /api/health: 연결 확인 (비밀 값 없음)', async () => {
  env = isolate({ LLM_PROVIDER: 'mock' })
  const r = await call(health, { method: 'GET' })
  assert.equal(r.statusCode, 200)
  assert.deepEqual(r.body, { ok: true, mode: 'mock', db: false })
})

test('GET /api/health: POST는 405', async () => {
  env = isolate()
  const r = await call(health, { method: 'POST' })
  assert.equal(r.statusCode, 405)
})

test('GET /api/ingredients: 전체 재료와 칸 목록', async () => {
  env = isolate()
  const r = await call(ingredients, { method: 'GET' })
  assert.equal(r.statusCode, 200)
  assert.equal(r.body.ingredients.length, INGREDIENTS.length)
  assert.equal(r.body.slots.length, 3)
})
