// 요청 횟수 제한. 서버리스 함수는 메모리로 횟수를 셀 수 없어서(인스턴스가 바뀜) DB가 있으면 rate_limits에 upsert로 센다.
// DB가 없으면(로컬 개발) 메모리로 센다. DB 오류가 나면 서비스를 막지 않고 메모리 카운터로 대신한다(AI 비용 보호는 약해짐 → 로그로 알림).
import { createHash } from 'node:crypto'
import { getSql } from './db.js'
import { logSafe } from './http.js'

const memory = new Map() // key -> { windowStart, count }
export const __resetMemoryRate = () => memory.clear()

/** IP 원문을 DB에 남기지 않도록 bucket과 함께 해시한 값을 키로 쓴다. */
const keyOf = (bucket, ip) => createHash('sha256').update(`${bucket}:${ip}`).digest('hex').slice(0, 40)

function hitMemory(key, windowStart, now, windowMs) {
  const cur = memory.get(key)
  const count = cur && cur.windowStart === windowStart ? cur.count + 1 : 1
  memory.set(key, { windowStart, count })
  if (memory.size > 5000) for (const [k, v] of memory) if (now - v.windowStart > windowMs * 2) memory.delete(k)
  return count
}

/**
 * @param {{ip:string,bucket:string,limit:number,windowMs:number,now?:number,env?:object}} o
 * @returns {Promise<{allowed:boolean,count:number,retryAfterSec:number}>}
 */
export async function hitRate({ ip, bucket, limit, windowMs, now = Date.now(), env = process.env }) {
  const windowStart = Math.floor(now / windowMs) * windowMs
  const key = keyOf(bucket, ip)
  const sql = getSql(env)
  let count
  if (sql) {
    try {
      const rows = await sql`
        insert into rate_limits (ip, window_start, count) values (${key}, ${new Date(windowStart).toISOString()}, 1)
        on conflict (ip, window_start) do update set count = rate_limits.count + 1
        returning count`
      count = Number(rows?.[0]?.count)
      if (!Number.isFinite(count)) throw new Error('bad count')
      // 가끔 하루 지난 칸을 정리한다
      if (Math.random() < 0.02) void sql`delete from rate_limits where window_start < ${new Date(now - 864e5).toISOString()}`.catch(() => undefined)
    } catch {
      logSafe('ratelimit', { kind: 'db_error_fallback_memory' })
      count = hitMemory(key, windowStart, now, windowMs)
    }
  } else {
    count = hitMemory(key, windowStart, now, windowMs)
  }
  return { allowed: count <= limit, count, retryAfterSec: Math.max(1, Math.ceil((windowStart + windowMs - now) / 1000)) }
}
