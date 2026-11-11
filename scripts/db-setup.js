// npm run db:setup — db/schema.sql 을 DATABASE_URL 의 DB에서 실행한다. (.env 가 있으면 읽는다)
// 연결 주소는 출력하지 않는다.
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { neon } from '@neondatabase/serverless'

const url = (process.env.DATABASE_URL ?? '').trim()
if (!url) {
  console.error('DATABASE_URL 이 설정되지 않았어요. .env 에 Neon의 pooled 연결 주소를 넣고 다시 실행하세요. (.env.example 참고)')
  process.exit(1)
}

const schema = await readFile(fileURLToPath(new URL('../db/schema.sql', import.meta.url)), 'utf8')
// 주석 줄을 지우고 세미콜론 단위로 나눠 한 문장씩 실행한다 (schema.sql 에는 문자열 안 세미콜론이 없다)
const statements = schema
  .split('\n')
  .filter((l) => !l.trim().startsWith('--'))
  .join('\n')
  .split(';')
  .map((s) => s.trim())
  .filter(Boolean)

const sql = neon(url)
try {
  for (const stmt of statements) {
    await sql.query(stmt)
    console.log('ok:', stmt.split('\n')[0].slice(0, 70))
  }
  console.log(`완료: ${statements.length}개 문장 실행`)
} catch (e) {
  console.error('DB 설정 중 오류:', e?.code ?? e?.name ?? 'error') // 메시지에 연결 정보가 섞일 수 있어 코드만 출력
  process.exit(1)
}
