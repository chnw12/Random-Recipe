// 로컬/단독 실행용 백엔드 서버: api/ 폴더의 함수들을 /api/<이름> 으로 연결한다.
// (배포가 Vercel이면 이 파일 없이 Vercel이 api/ 를 서버리스 함수로 직접 실행한다.)
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { logSafe } from './lib/http.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const PORT = Number(process.env.PORT) || 3001
const MAX_BODY = 100_000

// 배포(Docker)에서는 빌드된 화면(frontend/dist)도 이 서버가 같이 내보낸다. 폴더가 없으면(로컬 개발) API만 연다.
const STATIC_DIR = (() => {
  const dir = path.resolve(process.env.STATIC_DIR || path.join(here, '../frontend/dist'))
  return fs.existsSync(path.join(dir, 'index.html')) ? dir : null
})()
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon', '.webp': 'image/webp', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8'
}

function serveStatic(pathname, res) {
  let rel
  try {
    rel = decodeURIComponent(pathname)
  } catch {
    rel = '/'
  }
  let file = path.resolve(STATIC_DIR, '.' + rel)
  // 폴더 밖 경로(../)는 막고, 없는 경로는 index.html 로 (한 페이지 앱)
  if (!file.startsWith(STATIC_DIR + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    file = path.join(STATIC_DIR, 'index.html')
  }
  const isAsset = file.includes(`${path.sep}assets${path.sep}`)
  res.statusCode = 200
  res.setHeader('content-type', TYPES[path.extname(file)] ?? 'application/octet-stream')
  res.setHeader('cache-control', isAsset ? 'public, max-age=31536000, immutable' : 'no-cache')
  fs.createReadStream(file).pipe(res)
}

const handlers = new Map()
for (const f of fs.readdirSync(path.join(here, 'api'))) {
  if (!f.endsWith('.js')) continue
  const mod = await import(`./api/${f}`)
  handlers.set(f.slice(0, -3), mod.default)
}

export const server = http.createServer(async (req, res) => {
  const send = (status, obj) => {
    res.statusCode = status
    res.setHeader('content-type', 'application/json; charset=utf-8')
    res.end(JSON.stringify(obj))
  }
  // Vercel 응답 도우미
  res.status = (code) => ((res.statusCode = code), res)
  res.json = (obj) => (send(res.statusCode, obj), res)

  const pathname = new URL(req.url ?? '/', 'http://localhost').pathname
  if (!pathname.startsWith('/api/') && STATIC_DIR) return serveStatic(pathname, res)

  const m = pathname.match(/^\/api\/([a-z][a-z0-9-]*)$/)
  const handler = m && handlers.get(m[1])
  if (!handler) return send(404, { error: 'not_found', message: '없는 API예요.' })

  // JSON 본문을 req.body 로 파싱해서 넘긴다 (깨진 JSON은 문자열 그대로 두면 핸들러가 invalid_request 로 처리)
  const chunks = []
  let size = 0
  for await (const c of req) {
    size += c.length
    if (size > MAX_BODY) return send(413, { error: 'invalid_request', message: '요청이 너무 커요.' })
    chunks.push(c)
  }
  const raw = Buffer.concat(chunks).toString('utf8')
  req.body = raw ? (() => { try { return JSON.parse(raw) } catch { return raw } })() : undefined

  try {
    await handler(req, res)
  } catch (e) {
    logSafe(`api/${m[1]}`, { kind: e?.name ?? 'Error' }) // 메시지에 비밀이 섞일 수 있어 종류만 남긴다
    if (!res.headersSent) send(500, { error: 'record_failed', message: '서버에서 오류가 났어요.' })
  }
})

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  server.listen(PORT, () => {
    console.log(`백엔드 서버: http://localhost:${PORT}  (API: /api/${[...handlers.keys()].join(', /api/')})`)
    console.log(STATIC_DIR ? `화면 파일도 함께 서빙: ${STATIC_DIR}` : '화면 파일 없음: API만 연다 (개발 중에는 frontend 의 vite 를 쓴다)')
  })
}
