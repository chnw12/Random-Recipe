// DB: Neon PostgreSQL (@neondatabase/serverless, pooled 연결 주소). DATABASE_URL이 없으면 null을 돌려주고 호출하는 쪽이 DB 없이 동작한다.
import { neon } from '@neondatabase/serverless'

let override // 테스트용: undefined = 환경 변수 사용, null = DB 없음, 함수 = 가짜 sql
let cached = { url: null, sql: null }

export function __setSqlForTests(fake) {
  override = fake
}

/** neon sql 함수(태그드 템플릿 + sql.query) 또는 null */
export function getSql(env = process.env) {
  if (override !== undefined) return override
  const url = (env.DATABASE_URL ?? '').trim()
  if (!url) return null
  if (cached.url !== url) cached = { url, sql: neon(url) }
  return cached.sql
}

/*
 * 목표 1 집계(확정 기록을 익명 브라우저 ID별로 센다):
 *   select count(distinct browser_id) from confirmations;
 * 10개 이상의 브라우저에서 확정했는지:
 *   select count(*) from (select browser_id from confirmations group by browser_id) t;
 */
