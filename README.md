# 보조바퀴 (웹) — 다이어트 식단 재료 조합

재료 3개(단백질 / 채소·탄수화물 / 양념·조리법)를 무작위로 뽑고, AI가 새 메뉴와 조리법을 만든다.
Vite + React + MUI(JavaScript), 서버는 `/api` 폴더의 Vercel 서버리스 함수, DB는 Neon PostgreSQL.

## 빠른 시작
```bash
npm install
cp .env.example .env     # 값 채우기 (아래 "환경 변수")
npm run dev              # 화면 + /api 가 http://localhost:5173 에서 같이 뜬다
npm test                 # node --test (서버 함수를 가짜 req/res로 직접 호출)
npm run db:setup         # Neon에 테이블 만들기 (DATABASE_URL 필요, 선택)
```
키 없이 먼저 보고 싶으면 `.env` 에 `LLM_PROVIDER=mock` 만 두면 된다. 화면에 **"예시 모드"** 가 표시된다.
OpenAI를 쓰려면 `LLM_PROVIDER=openai` 와 `OPENAI_API_KEY` 를 넣는다 (모델은 `OPENAI_MODEL`, 비우면 `gpt-4o-mini`).

## 환경 변수
`.env.example` 참고. **모두 서버 전용**이고 `VITE_` 로 시작하면 브라우저 번들에 들어가므로 쓰지 않는다
(비밀 이름에 `VITE_` 가 붙으면 개발 서버가 시작을 거부한다). `.env` 는 `.gitignore` 에 있다.

| 변수 | 용도 |
|---|---|
| `LLM_PROVIDER` | `openai` \| `gemini` \| `anthropic` \| `mock` |
| `OPENAI_API_KEY` / `GEMINI_API_KEY` / `ANTHROPIC_API_KEY` | 선택한 provider의 키 |
| `OPENAI_MODEL` / `GEMINI_MODEL` / `ANTHROPIC_MODEL` | 선택. 기본 `gpt-4o-mini` / `gemini-2.5-flash` / `claude-sonnet-5-5` |
| `OPENAI_BASE_URL` | 선택. 프록시·호환 서버 (끝에 `/v1`) |
| `DATABASE_URL` | Neon **pooled** 연결 주소. 없으면 확정 기록을 저장하지 않는다 |
| `FOODSAFETY_API_KEY`, `KAMIS_CERT_KEY`, `KAMIS_CERT_ID`, `PRICE_API_KEY` | 공공데이터 (자리만, 아래 "3순위") |

## 구조
```
api/create.js, api/confirm.js     서버리스 함수 (Vercel이 그대로 실행, 로컬은 vite.config.js 플러그인)
lib/ingredients.js                재료 60개(칸당 20) + 뽑기/검사 도우미. 화면도 import 하므로 Node 전용 API 금지
lib/harness.js                    AI 결과 검사 (재료 3개 사용, 목록 밖 재료, 금지 표현, 형식)
lib/prompt.js                     규칙은 system, 재료·참고 자료·이전 메뉴 이름은 user
lib/llm.js                        LLM 호출은 여기 한 곳 (openai | gemini | anthropic | mock)
lib/mock.js                       mock provider 의 예시 생성기 (조사 처리 포함)
lib/db.js, lib/ratelimit.js       Neon 연결, 요청 횟수 제한(DB 없으면 메모리)
lib/http.js                       오류 형식 { error, message }, 본문/IP 도우미
db/schema.sql, scripts/db-setup.js
src/                              React + MUI 화면 (브라우저는 /api 만 부른다)
test/                             node --test
```

## API
### `POST /api/create` — 창조, 다시 창조
요청 `{ ingredientIds: [단백질id, 채소id, 양념id], avoidMenuName?: 이전 메뉴 이름(다시 창조, 40자 이하) }`
순서: 재료 검사 → 요청 횟수(IP당 10분 20번) → AI 호출 → 하네스 검사(실패 시 남은 시간 ≥ 1.5초면 1번 재요청) → 응답. 전체 14초 제한.
성공 `{ menuName, minutes, servings: 1, ingredients: [{id,name,amount}], steps, references: [], mode: "ai"|"mock" }`
재료의 **양은 AI가 아니라 서버**가 `lib/ingredients.js` 에서 채운다.

### `POST /api/confirm` — 확정 기록
요청 `{ browserId(UUID), menuName(1~40자), ingredientIds }`
순서: 형식 검사 → 요청 횟수(IP당 10분 30번) → 같은 browserId+메뉴가 10분 안에 있으면 409 → DB 저장.
`DATABASE_URL` 이 없으면 `{ ok: true, recorded: false }`. 화면은 응답을 기다리지 않는다.

### 오류 형식 `{ error, message }`
| 상태 | error | 의미 |
|---|---|---|
| 400 | `invalid_ingredients` / `invalid_request` | 재료·요청 형식 오류 |
| 405 | `method_not_allowed` | POST 만 허용 |
| 409 | `duplicate` | 10분 안 같은 확정 |
| 422 | `rule_failed` | AI 결과가 검사를 두 번 통과 못함 |
| 429 | `rate_limited` | 요청 횟수 초과 (`Retry-After` 헤더) |
| 500 | `not_configured` | `.env` 설정 없음 (필요한 **변수 이름**만 안내) / `record_failed` |
| 502 | `ai_failed` | AI 호출 실패 (시간 초과·네트워크 포함) |

## DB (Neon)
`npm run db:setup` → `db/schema.sql` 실행 (`confirmations`, `rate_limits`, 모두 `create table if not exists`).
요청 횟수의 `ip` 칸에는 IP 원문이 아니라 구분(create/confirm)과 IP를 해시한 값이 들어간다.
목표 집계: `select count(distinct browser_id) from confirmations;`

## 배포 (Vercel Hobby, 수업용 비상업 데모)
저장소를 Vercel에 연결하고 Environment Variables 에 `.env.example` 의 같은 이름을 넣는다. `api/` 는 자동으로 서버리스 함수가 된다(`vercel.json` 에서 함수 최대 시간만 지정).
발표 전날 실제 주소에서 첫 요청 시간(Neon 대기 상태 포함)을 재 볼 것.

## 3순위 설계 (지금은 만들지 않음, 자리만)
- **가격**: 하루 1회 `scripts/collect-prices.js` 가 KAMIS(`KAMIS_CERT_KEY/ID`, 농산물)와 소비자원 참가격(`PRICE_API_KEY`, 가공식품, XML)을 불러 `prices` 표(재료 id, 평균·최저·최고, 규격, 출처, 기준 날짜)에 저장한다. 마지막 성공 시각을 기록하고, 수집 실패 시 기존 값을 유지한다. 실행은 GitHub Actions 예약 + 수동 실행.
  `GET /api/prices?ids=...` 는 **저장된 값만** 돌려준다(공공 API를 요청마다 부르지 않는다). 화면은 저장값 + 출처 + 기준 날짜만 보여주고 "실시간"이라고 쓰지 않는다. 공공데이터에 없는 재료는 가격 없이 링크만.
  선행 작업: `lib/ingredients.js` 의 `publicCode` 를 채운다 (지금은 전부 `null`).
- **참고 레시피**: `/api/create` 안에서 `FOODSAFETY_API_KEY` 로 식약처 COOKRCP01 을 재료로 찾아 `lib/prompt.js` 의 `references` 로 넣고, 응답 `references` 에 제목·출처를 담는다. 14초 예산 안에서 짧은 시간 제한(예: 2초)을 두고 실패하면 참고 자료 없이 진행한다. 참고 자료는 데이터일 뿐이고 하네스 검사는 그대로 적용된다.
- 쇼핑몰은 **검색 링크만**(쿠팡·마켓컬리·이마트몰·다나와, `src/shop.js`). 수집·크롤링 없음.

## 검증 상태 (정직하게)
확인함: 서버 테스트 54개(`npm test`), 실제 `npm run dev` 에서 `/api` HTTP 호출, 브라우저(Edge)에서 전체 화면 흐름, 요청 제한·AI 장애·재시도 동작.
확인 못 함:
- **실제 OpenAI/Gemini/Anthropic 호출** — 요청 형식은 OpenAI 호환 가짜 서버(`OPENAI_BASE_URL`)로 HTTP 수준까지만 확인. 기본 모델명(`gpt-4o-mini` 등)이 계정에서 쓸 수 있는지는 실제 키로 확인 필요.
- **실제 Neon DB** — 쿼리는 가짜 sql 로만 테스트. `npm run db:setup`, 배열 컬럼 저장(`ingredient_ids text[]`), upsert 동작은 실제 DB에서 첫 실행 때 확인할 것.
- Vercel 배포, 쇼핑몰 검색 URL 형식(접속 확인 안 함).
- 재료 `amount`(1인분 기준량)는 임시 값 → 팀이 확정.

## 데스크톱 프로토타입과 다른 점
- 채팅으로 메뉴 3개 추천(`메뉴 추천` 화면)은 이번 서버 명세(`/api/create`, `/api/confirm` 둘뿐)에 없어서 뺐다. 필요하면 `/api/recommend` 를 추가하면 된다.
- 가격은 3순위라 가격 시트·확정 화면에서 빈 상태("가격 정보가 아직 없어요") + 검색 링크로 표시한다. 가격을 지어내지 않는다.
- "평균 열량" 화면은 칼로리가 기획서 Won't 라서 **쓴 금액 통계**만 보여준다.
- MUI 9 에서는 `Stack` 의 `justifyContent`/`alignItems`/`flexWrap` 같은 시스템 prop 이 적용되지 않는다 → `sx` 로 쓴다.
