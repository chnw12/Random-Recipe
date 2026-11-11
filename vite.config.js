import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'

// 로컬 개발: /api/* 요청을 api/ 폴더의 서버리스 함수로 넘긴다 → npm run dev 하나로 화면과 서버가 같이 뜬다.
// 배포(Vercel)에서는 이 플러그인을 쓰지 않고 Vercel이 api/ 폴더를 서버리스 함수로 직접 실행한다.

const SECRET_NAME = /KEY|SECRET|TOKEN|PASSWORD|DATABASE|CERT/i

function localApi() {
  return {
    name: 'local-api',
    config(_, { mode }) {
      // VITE_ 접두사 변수는 브라우저 번들에 그대로 들어간다. 비밀 값이 그렇게 이름 붙으면 즉시 막는다.
      const env = loadEnv(mode, process.cwd(), '')
      const leaked = Object.keys(env).filter((k) => k.startsWith('VITE_') && SECRET_NAME.test(k))
      if (leaked.length) throw new Error(`.env 의 ${leaked.join(', ')} 는 VITE_ 접두사 때문에 브라우저에 노출돼요. 접두사를 빼세요.`)
    },
    configureServer(server) {
      const root = server.config.root
      // 서버용 변수를 process.env 로 올린다 (이미 설정된 실제 환경 변수가 우선). 브라우저에는 VITE_ 변수만 전달된다.
      for (const [k, v] of Object.entries(loadEnv(server.config.mode, root, ''))) if (process.env[k] === undefined) process.env[k] = v

      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url ?? '/', 'http://localhost')
        const m = url.pathname.match(/^\/api\/([a-z][a-z0-9-]*)$/)
        if (!m) return next()

        const send = (status, obj) => {
          res.statusCode = status
          res.setHeader('content-type', 'application/json; charset=utf-8')
          res.end(JSON.stringify(obj))
        }
        const file = path.join(root, 'api', `${m[1]}.js`)
        if (!fs.existsSync(file)) return send(404, { error: 'not_found', message: '없는 API예요.' })

        // Vercel처럼 JSON 본문을 req.body 로 파싱해서 넘긴다 (깨진 JSON은 문자열 그대로 두면 핸들러가 invalid_request 로 처리)
        const chunks = []
        let size = 0
        for await (const c of req) {
          size += c.length
          if (size > 100_000) return send(413, { error: 'invalid_request', message: '요청이 너무 커요.' })
          chunks.push(c)
        }
        const raw = Buffer.concat(chunks).toString('utf8')
        req.body = raw ? (() => { try { return JSON.parse(raw) } catch { return raw } })() : undefined

        // Vercel 응답 도우미
        res.status = (code) => ((res.statusCode = code), res)
        res.json = (obj) => {
          res.setHeader('content-type', 'application/json; charset=utf-8')
          res.end(JSON.stringify(obj))
          return res
        }
        try {
          const mod = await server.ssrLoadModule(`/api/${m[1]}.js`)
          await mod.default(req, res)
        } catch (e) {
          server.config.logger.error(`[api/${m[1]}] ${e?.name ?? 'Error'}`) // 메시지에 비밀이 섞일 수 있어 종류만 남긴다
          if (!res.headersSent) send(500, { error: 'record_failed', message: '서버에서 오류가 났어요.' })
        }
      })
    }
  }
}

export default defineConfig({
  plugins: [react(), localApi()],
  server: { port: 5173 }
})
