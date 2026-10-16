# 보조바퀴 (웹) — 다이어트 식단 재료 조합

재료 3개(단백질 / 채소·탄수화물 / 양념·조리법)를 무작위로 뽑고, AI가 새 메뉴와 조리법을 만든다.
Vite + React + MUI(JavaScript), 서버는 `/api` 폴더의 Vercel 서버리스 함수, DB는 Neon PostgreSQL(선택).

## 빠른 시작
```bash
npm install
cp .env.example .env     # 값 채우기 (아래 "환경 변수")
npm run dev              # 화면 + /api 가 http://localhost:5173 에서 같이 뜬다
npm test                 # node --test 58개 (서버 함수를 가짜 req/res로 직접 호출)
npm run build
npm run db:setup         # Neon에 테이블 만들기 (DATABASE_URL 필요, 선택)
```
키 없이 먼저 보려면 `.env` 에 `LLM_PROVIDER=mock` 만 두면 된다. 화면에 **"예시 모드"** 가 표시된다.
OpenAI를 쓰려면 `LLM_PROVIDER=openai` 와 `OPENAI_API_KEY` 를 넣는다 (모델은 `OPENAI_MODEL`, 비우면 `gpt-4o-mini`).

## 전체 기능 목록 (현재)
**화면 (6개 + 준비 중 화면 3개, 시트/사이드바)**
| 화면 | 하는 일 |
|---|---|
| 메인 | 서비스 한 줄 설명, "재료 3개 랜덤 뽑기", 왼쪽 위 메뉴(드로어) |
| 재료 뽑기 | 칸마다 1개씩 무작위 뽑기(브라우저에서 0.4초 안에 처리), 다시 뽑기("새 재료 3개로 바뀌었어요"), 재료를 누르면 가격 시트, 창조 버튼("만드는 중" 동안 비활성) |
| 재료 가격 시트 | 가격 정보가 아직 없으면 그 안내 + 쇼핑몰 4곳(쿠팡·마켓컬리·이마트몰·다나와) **검색 링크** (보류: 아래 "보류한 것") |
| 메뉴 결과 | 메뉴 이름, 조리 시간, 1인분, 재료와 **서버가 채운 기준량**, 조리 순서(3~6단계, 각 70자 이하). 버튼 순서: [다시 창조] [다시 뽑기] → 맨 아래 **[이 메뉴로 확정]** (실수로 확정을 먼저 누르는 것을 막기 위함). 다시 창조는 "같은 재료 · 새 메뉴", 실패하면 기존 메뉴 유지 + 알림 |
| 메뉴 확정 | 레시피 복사, "재료 샀어요"(재료별 쓴 금액 입력·저장, 숫자 아니면 저장 비활성), ☆ 즐겨찾기에 저장(누르면 "준비 중" 알림만), 홈으로 (뒤로 가기 없음) |
| 평균 열량 | 이번 주/이번 달 **쓴 금액**, 지난달과의 차이. 열량은 기획서 Won't 라서 제공하지 않는다고 안내 |
| 사이드바(드로어) | 아이콘 + 텍스트. **핵심 기능**: 재료 뽑기, 재료 제외(준비 중), 카테고리(준비 중) / **기록**: 즐겨찾기(준비 중), 평균 열량. 활성 항목은 연한 그린 배경. 메인과 뽑기·결과·확정 화면에서는 "재료 뽑기"가 활성. 메인은 왼쪽 위 ☰, 뽑기·평균 열량·준비 중 화면은 오른쪽 위 ☰로 연다 |
| 준비 중 화면 | 즐겨찾기 / 재료 제외 / 카테고리: 화면 진입과 안내 문구만 있고 **기능은 없다** (저장·제외·분야 선택 동작 안 함) |

**서버 (`/api`)**: `POST /api/create`, `POST /api/confirm` (아래 "API")
- 재료 검사(칸마다 1개), IP당 요청 횟수 제한(DB `rate_limits`, 없으면 메모리), 전체 14초 제한
- AI 결과 **하네스 검사** + 실패 시 자동 1회 재요청(남은 시간 ≥ 1.5초일 때)
- LLM provider: openai / gemini(OpenAI 호환) / anthropic / mock — `lib/llm.js` 한 곳에서만 호출
- 날생선·해산물 안전: 연어·대구살·삼치·오징어·새우·가리비 관자·홍합살이 뽑히면 프롬프트에 "반드시 속까지 익힌다"를 넣고, 하네스가 **가열 단계 없음 / 날것 조리법(회·날로·생으로·세비체·타르타르 등)** 을 거절한다. 결과 화면에도 "속까지 충분히 익혀서 드세요" 안내가 뜬다.
- 확정 기록(익명 browserId·메뉴·재료만 저장), 같은 browserId+메뉴 10분 안 중복 409. `DATABASE_URL` 이 없으면 `{ ok: true, recorded: false }`

**브라우저(이 기기에만 저장)**: 쓴 금액 기록, 익명 browserId. (서버로는 browserId 만 확정 기록에 쓰인다)

**준비 중(화면만 있음)**: 즐겨찾기, 재료 제외, 카테고리. 지금은 저장·제외 동작이 없고 모든 재료에서 무작위로 뽑는다. **뺀 것**: 채팅 메뉴 추천(서버 명세에 엔드포인트가 없음). 칼로리·영양 수치도 넣지 않는다.

## 디자인 시스템 (다이어트 앱 느낌)
모든 화면이 같은 스타일을 쓰고, **색·글꼴·모서리는 `src/theme.js` 한 곳**에서만 정한다. 화면 코드는 색을 직접 쓰지 않고 theme 키(`primary.main`, `text.secondary`, `divider` …)만 참조한다.
- 색: 배경 `#F3F6EF`(연한 민트/세이지), 포인트 그린 `#2A8453`, 카드 흰 배경 + 얇은 테두리 `#E7ECE2`, 활성/연한 강조 `#E4F2E9`. 카드 모서리 16px, 버튼은 완전 둥글게(pill).
- 버튼(`AppButton`): 주 행동 = 그린 배경 + 흰 글자(확정 포함, 위치는 맨 아래 유지), 보조 행동 = 흰 배경 + 그린 테두리. 높이 52px.
- 사이드바: 아이콘 + 텍스트, 그룹(핵심 기능 / 기록), 활성 항목은 연한 그린 배경.
- 아이콘: 선 굵기 2의 단순한 SVG(`src/icons.jsx`). **이모지는 쓰지 않는다.**
- 글꼴: Google Fonts의 Plus Jakarta Sans (영문·숫자). 한글 글리프는 없어서 Malgun Gothic 등 시스템 한글 글꼴로 대체된다. 한국어는 단어 단위로 줄바꿈(`keep-all`).
- 라이트 테마 하나만 쓴다 (이전의 자동 다크 모드는 없앴다).
- 접근성 메모: 버튼의 흰 글자(`#FFFFFF` on `#2A8453`)는 대비 4.64:1로 AA 일반 글자 기준(4.5:1)을 충족한다. 연한 배경 위의 초록 "글자"와 호버 색은 더 진한 `#25774A`(흰색 위 5.5:1, 연한 그린 `#E4F2E9` 위 4.8:1)를 쓴다.

## 환경 변수
`.env.example` 참고. **모두 서버 전용**이고 `VITE_` 로 시작하면 브라우저 번들에 들어가므로 쓰지 않는다
(비밀 이름에 `VITE_` 가 붙으면 개발 서버가 시작을 거부한다). `.env` 는 `.gitignore` 에 있다.

| 변수 | 용도 |
|---|---|
| `LLM_PROVIDER` | openai / gemini / anthropic / mock |
| `OPENAI_API_KEY`, `GEMINI_API_KEY`, `ANTHROPIC_API_KEY` | 선택한 provider의 키 |
| `OPENAI_MODEL`, `GEMINI_MODEL`, `ANTHROPIC_MODEL` | 선택. 기본 `gpt-4o-mini` / `gemini-2.5-flash` / `claude-sonnet-5-5` |
| `OPENAI_BASE_URL` | 선택. 프록시·호환 서버 (끝에 `/v1`) |
| `DATABASE_URL` | Neon **pooled** 연결 주소. 없으면 확정 기록을 저장하지 않는다 |
| `FOODSAFETY_API_KEY`, `KAMIS_CERT_KEY`, `KAMIS_CERT_ID`, `PRICE_API_KEY`, `PRICE_API_URL` | 공공데이터 (**보류**: `npm run data:check` 에서만 쓰인다) |

## 구조
```
api/create.js, api/confirm.js     서버리스 함수 (Vercel이 그대로 실행, 로컬은 vite.config.js 플러그인)
lib/ingredients.js                재료 60개(칸당 20) + 뽑기/검사 도우미. 화면도 import 하므로 Node 전용 API 금지
lib/harness.js                    AI 결과 검사 (재료 3개 사용, 목록 밖 재료, 금지 표현, 형식·길이, 날생선 익히기)
lib/prompt.js                     규칙은 system, 재료·참고 자료·이전 메뉴 이름은 user
lib/llm.js                        LLM 호출은 여기 한 곳 (openai | gemini | anthropic | mock)
lib/mock.js                       mock provider 의 예시 생성기 (조사 처리 포함)
lib/db.js, lib/ratelimit.js       Neon 연결, 요청 횟수 제한
lib/http.js                       오류 형식 { error, message }, 본문/IP 도우미
db/schema.sql, scripts/db-setup.js
scripts/check-data.js, docs/data-check.md   공공데이터 API 확인용 (보류, 아래 참고)
src/theme.js                      디자인 토큰(색·글꼴·모서리) + MUI 테마 — 색은 여기서만 정한다
src/ui.jsx, src/icons.jsx         공통 컴포넌트(AppButton, Surface, Top …)와 SVG 아이콘
src/screens.jsx, src/App.jsx      화면과 흐름 (브라우저는 /api 만 부른다)
test/                             node --test
```

## API
### `POST /api/create` — 창조, 다시 창조
요청 `{ ingredientIds: [단백질id, 채소id, 양념id], avoidMenuName?: 이전 메뉴 이름(다시 창조, 40자 이하) }`
순서: 재료 검사 → 요청 횟수(IP당 10분 20번) → AI 호출 → 하네스 검사(실패 시 남은 시간 ≥ 1.5초면 1번 재요청) → 응답. 전체 14초 제한.
성공 `{ menuName, minutes, servings: 1, ingredients: [{id,name,amount}], steps, references: [], mode: "ai" 또는 "mock" }`
재료의 **양은 AI가 아니라 서버**가 `lib/ingredients.js` 에서 채운다. `references` 는 지금 항상 빈 목록이다(참고 레시피 연결 보류).

### `POST /api/confirm` — 확정 기록
요청 `{ browserId(UUID), menuName(1~40자), ingredientIds }`
순서: 형식 검사 → 요청 횟수(IP당 10분 30번) → 같은 browserId+메뉴가 10분 안에 있으면 409 → DB 저장.
`DATABASE_URL` 이 없으면 `{ ok: true, recorded: false }`. 화면은 응답을 기다리지 않는다.

### 오류 형식 `{ error, message }`
| 상태 | error | 의미 |
|---|---|---|
| 400 | invalid_ingredients, invalid_request | 재료·요청 형식 오류 |
| 405 | method_not_allowed | POST 만 허용 |
| 409 | duplicate | 10분 안 같은 확정 |
| 422 | rule_failed | AI 결과가 검사를 두 번 통과 못함 |
| 429 | rate_limited | 요청 횟수 초과 (Retry-After 헤더) |
| 500 | not_configured, record_failed | .env 설정 없음(필요한 **변수 이름**만 안내) / 기록 저장 실패 |
| 502 | ai_failed | AI 호출 실패 (시간 초과·네트워크 포함) |

### 하네스가 거절하는 것 (`lib/harness.js`)
JSON 형식·길이(조리 순서 3~6단계, 각 70자 이하, 이름 40자 이하, 시간 1~180분) / 뽑은 재료 3개 중 하나라도 안 쓰면 / 뽑지 않은 목록 재료 언급(순두부≠두부, "가지런히"≠가지) / 칼로리·열량·영양·살 빠짐·체중 감량·효과 표현 / 날생선·해산물에 가열 단계 없음 또는 날것 조리법 / 다시 창조인데 이전과 같은 이름.

## DB (Neon)
`npm run db:setup` → `db/schema.sql` 실행 (`confirmations`, `rate_limits`, 모두 `create table if not exists`).
요청 횟수의 `ip` 칸에는 IP 원문이 아니라 구분(create/confirm)과 IP를 해시한 값이 들어간다.
목표 집계: `select count(distinct browser_id) from confirmations;`

## 배포 (Vercel Hobby, 수업용 비상업 데모)
저장소를 Vercel에 연결하고 Environment Variables 에 `.env.example` 의 같은 이름을 넣는다. `api/` 는 자동으로 서버리스 함수가 된다(`vercel.json` 에서 함수 최대 시간만 지정).
발표 전날 실제 주소에서 첫 요청 시간(Neon 대기 상태 포함)을 재 볼 것.

## 보류한 것 (범위를 줄여 만들지 않음)
- **식약처 참고 레시피(COOKRCP01)** 연결: 만들지 않았다. `references` 는 빈 목록이고, 프롬프트와 화면("참고한 레시피: ○○ (출처: …)")에는 자리만 있다.
- **가격(KAMIS·참가격)** 연결: 만들지 않았다. 가격 시트는 항상 "가격 정보가 아직 없어요" + 검색 링크다. `lib/ingredients.js` 의 `publicCode` 는 전부 `null`.
- 남겨 둔 것: `npm run data:check`(`scripts/check-data.js`)와 그 결과 `docs/data-check.md`. 더 진행하지 않는다. 확인된 사실만 적어 둔다:
  - 식약처 API 호스트는 `openapi.foodsafetykorea.go.kr` (전체 1,156건, 영양/열량 필드 `INFO_*` 포함 → 저장·표시 금지)
  - KAMIS `dailySalesList` 는 품목이 `price` 배열에 들어 있고 `item_code` 없이 `productno` 만 있다
  - 참가격(생필품 가격) 요청 주소는 확인하지 못했다 (`openapi.price.go.kr` 은 현재 국가공유자원포털 안내 페이지)

## 검증 상태 (정직하게)
확인함: 서버 테스트 58개(`npm test`), `npm run build`, 실제 `npm run dev` 에서 `/api` HTTP 호출과 Edge 브라우저로 전체 화면 흐름(날생선 뽑기 → 결과 → 다시 창조 → 확정 → 쓴 금액 → 통계).
확인 못 함:
- **실제 OpenAI/Gemini/Anthropic 호출** — 요청 형식은 OpenAI 호환 가짜 서버(`OPENAI_BASE_URL`)로 HTTP 수준까지만 확인. 기본 모델명이 계정에서 쓸 수 있는지, **실제 AI가 70자·3~6단계·날생선 규칙을 잘 지키는지(= 422 빈도)** 는 실제 키로 확인 필요.
- **실제 Neon DB** — 쿼리는 가짜 sql 로만 테스트. `npm run db:setup`, 배열 컬럼 저장, upsert 는 실제 DB에서 첫 실행 때 확인할 것.
- Vercel 배포, 쇼핑몰 검색 URL 형식(접속 확인 안 함), 재료 `amount`(1인분 기준량)는 임시 값 → 팀이 확정.

## 데스크톱 프로토타입과 다른 점
- 채팅 메뉴 추천은 뺐고, 즐겨찾기·재료 제외·카테고리는 "준비 중" 화면만 있다.
- "평균 열량" 화면은 칼로리가 기획서 Won't 라서 **쓴 금액 통계**만 보여준다.
- MUI 9 에서는 `Stack` 의 `justifyContent`/`alignItems`/`flexWrap` 같은 시스템 prop 이 적용되지 않는다 → `sx` 로 쓴다.
