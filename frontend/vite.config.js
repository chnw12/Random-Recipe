import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// 프론트엔드 ↔ 백엔드 연결:
//  - 개발: 브라우저가 부르는 /api/* 를 백엔드 서버(기본 http://localhost:3001)로 프록시한다.
//  - 배포: 프론트(정적 파일)와 백엔드를 같은 도메인의 /api 로 이어 주거나, 호스팅의 rewrite 로 연결한다.
// 재료 목록(lib/ingredients.js)은 서버와 화면이 같은 파일을 쓰므로 @backend 별칭으로 가져온다.

const here = path.dirname(fileURLToPath(import.meta.url))
const backendLib = path.resolve(here, '../backend/lib')
const SECRET_NAME = /KEY|SECRET|TOKEN|PASSWORD|DATABASE|CERT/i

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, here, '')
  // VITE_ 접두사 변수는 브라우저 번들에 그대로 들어간다. 비밀 값이 그렇게 이름 붙으면 즉시 막는다.
  const leaked = Object.keys(env).filter((k) => k.startsWith('VITE_') && SECRET_NAME.test(k))
  if (leaked.length) throw new Error(`.env 의 ${leaked.join(', ')} 는 VITE_ 접두사 때문에 브라우저에 노출돼요. 접두사를 빼세요.`)

  const target = env.BACKEND_URL || 'http://localhost:3001'
  return {
    plugins: [react()],
    resolve: { alias: { '@backend': backendLib } },
    server: {
      port: 5173,
      fs: { allow: [here, backendLib] },
      proxy: { '/api': { target, changeOrigin: false } }
    }
  }
})
