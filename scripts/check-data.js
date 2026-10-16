// npm run data:check — 공공데이터 API 3개를 한 번씩 호출해 성공 여부와 응답 필드를 확인하고,
// 재료 60개에 대해 식약처 레시피 건수 / KAMIS 품목 후보 / 참가격 상품명 유무를 docs/data-check.md 에 표로 남긴다.
// 기능 코드가 아니라 "확인용"이다. DB에 쓰지 않는다.
//
// 보안: 키(.env)와 키가 들어간 URL은 화면, 파일 어디에도 출력하지 않는다. 모든 출력은 scrub()을 거치고,
//       URL은 라벨로만 표시한다. (키 값이 응답 본문에 되돌아와도 [KEY]로 가려진다.)
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { INGREDIENTS } from '../lib/ingredients.js'

const SECRET_VARS = ['FOODSAFETY_API_KEY', 'KAMIS_CERT_KEY', 'KAMIS_CERT_ID', 'PRICE_API_KEY', 'DATABASE_URL', 'OPENAI_API_KEY', 'GEMINI_API_KEY', 'ANTHROPIC_API_KEY']
const secrets = () => SECRET_VARS.map((k) => (process.env[k] ?? '').trim()).filter((v) => v.length >= 4)

/** 어떤 문자열이든 키(원문, URL 인코딩, 인코딩된 형태)를 [KEY]로 바꾼다. */
function scrub(text) {
  let out = String(text ?? '')
  for (const s of secrets()) {
    for (const form of new Set([s, encodeURIComponent(s), encodeURI(s), decodeURIComponentSafe(s)])) if (form && form.length >= 4) out = out.split(form).join('[KEY]')
  }
  return out
}
function decodeURIComponentSafe(s) {
  try {
    return decodeURIComponent(s)
  } catch {
    return s
  }
}
const log = (...a) => console.log(scrub(a.join(' ')))
const env = (k) => (process.env[k] ?? '').trim()
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
// data.go.kr 키는 "인코딩된 형태"로 발급되기도 한다(% 포함). 이미 인코딩돼 있으면 그대로 쓴다.
const qKey = (k) => (k.includes('%') ? k : encodeURIComponent(k))

/** GET. URL은 호출하는 쪽에서 만들고 이 함수는 출력하지 않는다. 오류도 종류만 돌려준다. */
async function get(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(25_000), headers: { accept: '*/*' } })
    const text = await res.text()
    return { status: res.status, type: res.headers.get('content-type') ?? '', text }
  } catch (e) {
    return { status: 0, type: '', text: '', error: scrub(e?.cause?.code ?? e?.name ?? 'error') }
  }
}

/* ---------- 아주 단순한 XML 파싱 (새 라이브러리 없이) ---------- */
const decodeXml = (s) => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&').trim()
function xmlItems(xml, tag = 'item') {
  const out = []
  for (const m of xml.matchAll(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, 'g'))) {
    const o = {}
    for (const f of m[1].matchAll(/<([A-Za-z0-9_]+)>([\s\S]*?)<\/\1>/g)) o[f[1]] = decodeXml(f[2])
    out.push(o)
  }
  return out
}
const xmlTag = (xml, tag) => decodeXml(xml.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`))?.[1] ?? '')

const result = { fs: { ok: false }, kamis: { ok: false }, price: { ok: false } }

/* ================= 1) 식약처 조리식품 레시피 DB (COOKRCP01) ================= */
const FS_BASE = () => `http://openapi.foodsafetykorea.go.kr/api/${env('FOODSAFETY_API_KEY')}/COOKRCP01/json`
async function fsQuery(from, to, filter) {
  const r = await get(`${FS_BASE()}/${from}/${to}${filter ? '/' + filter : ''}`)
  if (r.error) return { error: r.error }
  let j
  try {
    j = JSON.parse(r.text)
  } catch {
    return { status: r.status, error: `JSON 아님 (${scrub(r.type)}): ${scrub(r.text.slice(0, 120)).replace(/\s+/g, ' ')}` }
  }
  const root = j.COOKRCP01 ?? j
  return { status: r.status, code: root?.RESULT?.CODE, msg: root?.RESULT?.MSG, total: Number(root?.total_count ?? 0), rows: root?.row ?? [] }
}

async function checkFoodSafety() {
  log('\n[식약처 COOKRCP01]')
  if (!env('FOODSAFETY_API_KEY')) return log('  FOODSAFETY_API_KEY 없음 → 건너뜀')
  const r = await fsQuery(1, 3)
  if (r.error) return log(`  실패: HTTP ${r.status ?? '-'} ${r.error}`)
  log(`  HTTP ${r.status}, 결과 코드 ${r.code}, 메시지 "${r.msg}", 전체 건수 ${r.total}, 받은 행 ${r.rows.length}`)
  if (!r.rows.length) return
  const fields = Object.keys(r.rows[0])
  const manual = fields.filter((f) => /^MANUAL\d+$/.test(f)).sort()
  result.fs = { ok: r.code === 'INFO-000', total: r.total, fields, manualCount: manual.length }
  log(`  필드(${fields.length}개): ${fields.join(', ')}`)
  log(`  → 메뉴명=RCP_NM, 재료=RCP_PARTS_DTLS, 조리 순서=${manual[0] ?? '?'}~${manual.at(-1) ?? '?'} (${manual.length}칸)`)
  const calorie = fields.filter((f) => /^INFO_(ENG|CAR|PRO|FAT|NA)$/.test(f))
  if (calorie.length) log(`  ⚠ 영양/열량 필드가 응답에 들어 있음(${calorie.join(', ')}) — 기획서 Won't 이므로 저장·표시하지 않는다`)
}

/* ================= 2) KAMIS 농산물 소매가격 ================= */
async function checkKamis() {
  log('\n[KAMIS 일별 소매가격 dailySalesList]')
  if (!env('KAMIS_CERT_KEY') || !env('KAMIS_CERT_ID')) return log('  KAMIS_CERT_KEY/ID 없음 → 건너뜀')
  const url = `http://www.kamis.or.kr/service/price/xml.do?action=dailySalesList&p_cert_key=${encodeURIComponent(env('KAMIS_CERT_KEY'))}&p_cert_id=${encodeURIComponent(env('KAMIS_CERT_ID'))}&p_returntype=json`
  const r = await get(url)
  if (r.error) return log(`  실패: ${r.error}`)
  let j
  try {
    j = JSON.parse(r.text)
  } catch {
    return log(`  HTTP ${r.status}, JSON 아님 (${scrub(r.type)}): ${scrub(r.text.slice(0, 160)).replace(/\s+/g, ' ')}`)
  }
  // 실제 응답: { condition: [...], error_code: "000", price: [ { item_name, kind_name, unit, day1, dpr1, ... } ] }
  const data = j.data ?? j
  const code = data?.error_code ?? j?.error_code
  const items = Array.isArray(j?.price) ? j.price : Array.isArray(data?.item) ? data.item : Array.isArray(data?.price) ? data.price : []
  log(`  HTTP ${r.status}, error_code ${code}, 품목 행 ${items.length}`)
  if (!items.length) return log(`  응답 요약: ${scrub(JSON.stringify(j)).slice(0, 200)}`)
  const fields = Object.keys(items[0])
  result.kamis = { ok: true, items, fields }
  log(`  필드(${fields.length}개): ${fields.join(', ')}`)
  log(`  예시: ${items.slice(0, 3).map((i) => `${i.item_name}${i.kind_name ? '/' + i.kind_name : ''}(${i.unit ?? '?'})`).join(', ')}`)
}

/* ================= 3) 한국소비자원 생필품 가격 정보 (참가격, XML) ================= */
// 주의: 정확한 엔드포인트는 data.go.kr 활용신청 화면의 값이 기준이다. 알려진 형식을 후보로 시도하고 어느 것이 응답했는지 보고한다.
async function checkPrice() {
  log('\n[한국소비자원 생필품 가격 정보 (XML)]')
  if (!env('PRICE_API_KEY')) return log('  PRICE_API_KEY 없음 → 건너뜀')
  const k = qKey(env('PRICE_API_KEY'))
  const custom = env('PRICE_API_URL')
  const candidates = []
  if (custom) {
    const sep = custom.includes('?') ? '&' : '?'
    candidates.push({ label: 'PRICE_API_URL(.env)', url: (extra = '') => `${custom}${sep}serviceKey=${k}${extra}` })
  }
  candidates.push(
    { label: 'A openapi.price.go.kr getProductInfoSvc', url: (extra = '') => `http://openapi.price.go.kr/openApiImpl/ProductPriceInfoService/getProductInfoSvc.do?serviceKey=${k}${extra}` },
    { label: 'B apis.data.go.kr (B553748) getProductInfoSvc', url: (extra = '') => `http://apis.data.go.kr/B553748/ProductPriceInfoService/getProductInfoSvc.do?serviceKey=${k}${extra}` }
  )
  for (const c of candidates) {
    const r = await get(c.url())
    if (r.error) { log(`  후보 ${c.label}: 연결 실패 (${r.error})`); continue }
    const items = xmlItems(r.text)
    const code = xmlTag(r.text, 'resultCode') || xmlTag(r.text, 'returnReasonCode') || xmlTag(r.text, 'errMsg')
    const msg = xmlTag(r.text, 'resultMsg') || xmlTag(r.text, 'returnAuthMsg')
    log(`  후보 ${c.label}: HTTP ${r.status}, ${scrub(r.type).split(';')[0]}, 코드 "${code}", 메시지 "${msg}", item ${items.length}개`)
    if (!items.length) { log(`    본문 앞부분: ${scrub(r.text.slice(0, 200)).replace(/\s+/g, ' ')}`); continue }
    const fields = Object.keys(items[0])
    result.price = { ok: true, candidate: c, fields, sample: items.slice(0, 3), total: Number(xmlTag(r.text, 'totalCount')) || undefined }
    log(`    필드(${fields.length}개): ${fields.join(', ')}`)
    log(`    예시 상품명: ${items.slice(0, 3).map((i) => i.goodName ?? i.good_name ?? Object.values(i)[1]).join(' | ')}`)
    return
  }
  log('  → 응답하는 후보가 없다. data.go.kr 활용신청 화면의 "요청주소"를 확인해 알려 주세요 (키는 포함하지 말 것).')
}

/* ================= 재료 60개 표 ================= */
const norm = (s) => s.replace(/\s+/g, '')
/** 검색어 후보: 이름 → (0건이면) 별칭(2자 이상). 식약처는 재료 문자열(RCP_PARTS_DTLS) 포함 검색. */
async function perIngredientRecipes() {
  const out = new Map()
  if (!result.fs.ok) return out
  for (const ing of INGREDIENTS) {
    const terms = [ing.name, ...(ing.aliases ?? []).filter((a) => a.length >= 2)]
    let found = { count: 0, term: ing.name }
    for (const t of terms) {
      const r = await fsQuery(1, 1, `RCP_PARTS_DTLS=${encodeURIComponent(t)}`)
      await sleep(120)
      const n = r.error ? -1 : r.code === 'INFO-200' ? 0 : r.total
      if (n === -1) { found = { count: -1, term: t }; break }
      if (n > found.count || found.count === 0) found = { count: n, term: t }
      if (n > 0) break
    }
    out.set(ing.id, found)
  }
  return out
}

function kamisCandidates() {
  const out = new Map()
  const items = result.kamis.items ?? []
  for (const ing of INGREDIENTS) {
    const terms = [ing.name, ...(ing.aliases ?? [])].map(norm).filter((t) => t.length >= 2)
    const hit = new Map()
    for (const it of items) {
      const n = norm(`${it.item_name ?? ''}`)
      if (n && terms.some((t) => n === t || n.includes(t) || t.includes(n))) hit.set(`${it.item_name}${it.kind_name ? '/' + it.kind_name : ''}`, it.productno ?? '')
    }
    out.set(ing.id, [...hit.entries()])
  }
  return out
}

async function priceNameMatches() {
  const out = new Map()
  if (!result.price.ok) return out
  const c = result.price.candidate
  // 상품 목록을 최대 12쪽(쪽당 최대 1000건)까지 받아 이름으로 찾는다. 전체를 못 받으면 "표본 한계"로 표시한다.
  const names = []
  let pages = 0
  for (let p = 1; p <= 12; p++) {
    const r = await get(c.url(`&pageNo=${p}&numOfRows=1000`))
    if (r.error || r.status !== 200) break
    const items = xmlItems(r.text)
    if (!items.length) break
    pages++
    for (const i of items) names.push(i.goodName ?? i.good_name ?? Object.values(i)[1] ?? '')
    if (items.length < 1000) break
    await sleep(150)
  }
  result.price.scanned = names.length
  result.price.pages = pages
  for (const ing of INGREDIENTS) {
    const terms = [ing.name, ...(ing.aliases ?? [])].map(norm).filter((t) => t.length >= 2)
    const hits = names.filter((n) => terms.some((t) => norm(n).includes(t)))
    out.set(ing.id, { count: hits.length, example: hits[0] ?? '' })
  }
  return out
}

/* ================= 실행 ================= */
await checkFoodSafety()
await checkKamis()
await checkPrice()

log('\n[재료 60개 조회 중…]')
const recipes = await perIngredientRecipes()
const kamis = kamisCandidates()
const price = await priceNameMatches()
if (result.price.ok) log(`  참가격 상품 ${result.price.scanned ?? 0}건(${result.price.pages ?? 0}쪽) 이름 대조`)

const cell = (s) => String(s).replace(/\|/g, '\\|')
const rows = INGREDIENTS.map((ing) => {
  const r = recipes.get(ing.id)
  const k = kamis.get(ing.id) ?? []
  const p = price.get(ing.id)
  return {
    ing, r, k, p,
    recipeText: !result.fs.ok ? '미확인' : r?.count === -1 ? '조회 실패' : `${r.count}건${r.term !== ing.name ? ` (검색어 "${r.term}")` : ''}`,
    kamisText: !result.kamis.ok ? '미확인' : k.length ? k.slice(0, 3).map(([n, c]) => `${n}${c ? `[${c}]` : ''}`).join(', ') + (k.length > 3 ? ` 외 ${k.length - 3}` : '') : '없음',
    priceText: !result.price.ok ? '미확인' : p?.count ? `${p.count}건 (예: ${p.example})` : '없음'
  }
})
const noPrice = rows.filter((x) => (result.kamis.ok ? x.k.length === 0 : true) && (result.price.ok ? !x.p?.count : true)).map((x) => x.ing.name)
const noRecipe = rows.filter((x) => result.fs.ok && x.r?.count === 0).map((x) => x.ing.name)

const today = new Date().toISOString().slice(0, 10)
const md = [
  '# 공공데이터 API 확인 결과',
  '',
  `확인일: ${today} (\`npm run data:check\`). 키와 키가 들어간 URL은 이 문서에 쓰지 않는다. 원본 응답 전체를 저장하지도 않는다.`,
  '',
  '## 1. API 3개 호출 결과',
  '',
  '| API | 성공 | 확인한 것 |',
  '|---|---|---|',
  `| 식약처 조리식품 레시피 DB (COOKRCP01) | ${result.fs.ok ? '성공' : '실패/미확인'} | ${result.fs.ok ? `전체 ${result.fs.total}건. 메뉴명 \`RCP_NM\`, 재료 \`RCP_PARTS_DTLS\`, 조리 순서 \`MANUAL01~${String(result.fs.manualCount).padStart(2, '0')}\`` : '-'} |`,
  `| KAMIS 일별 소매가격 (dailySalesList) | ${result.kamis.ok ? '성공' : '실패/미확인'} | ${result.kamis.ok ? `품목 행 ${result.kamis.items.length}개. 필드: ${result.kamis.fields.join(', ')}` : '-'} |`,
  `| 한국소비자원 생필품 가격 정보 (XML) | ${result.price.ok ? '성공' : '실패/미확인'} | ${result.price.ok ? `엔드포인트 후보 "${result.price.candidate.label}" 응답. 필드: ${result.price.fields.join(', ')}` : '응답하는 엔드포인트 후보 없음 (요청주소 확인 필요)'} |`,
  '',
  result.fs.ok ? `식약처 응답 필드: ${result.fs.fields.map((f) => `\`${f}\``).join(', ')}\n\n> 응답에 영양/열량 필드(\`INFO_*\`)가 들어 있다. 기획서 Won't 이므로 저장하지 않고 표시하지 않는다.` : '',
  '',
  '## 2. 재료 60개별 확인',
  '',
  '- 식약처: 재료 문자열(`RCP_PARTS_DTLS`)에 이름이 들어간 레시피 건수. 0건이면 별칭으로 한 번 더 찾는다.',
  '- KAMIS: 이름이 일치하거나 포함되는 품목 **후보**(`품목명/종류[productno]`). 응답에 `item_code`는 없고 품목+품종 단위 번호 `productno`만 있다. 자동 매칭이라 3단계에서 사람이 확인한다.',
  `- 참가격: 상품명에 이름이 포함된 상품 수${result.price.ok ? ` (조회한 상품 ${result.price.scanned ?? 0}건 기준${(result.price.scanned ?? 0) >= 12000 ? ', 표본 한계 가능' : ''})` : ''}.`,
  '',
  '| id | 재료 | 칸 | 식약처 레시피 | KAMIS 후보 | 참가격 상품 |',
  '|---|---|---|---|---|---|',
  ...rows.map((x) => `| ${x.ing.id} | ${x.ing.name} | ${x.ing.slot} | ${cell(x.recipeText)} | ${cell(x.kamisText)} | ${cell(x.priceText)} |`),
  '',
  result.price.ok ? '## 3. 가격 없음 재료 (KAMIS 후보도, 참가격 상품도 없음)' : '## 3. 가격 없음 재료 — 잠정 (KAMIS 후보 없음. 참가격은 아직 확인 못 해서 "가격 없음"으로 단정할 수 없음)',
  '',
  noPrice.length ? noPrice.map((n) => `- ${n}`).join('\n') : '- (없음)',
  '',
  '## 4. 참고 레시피 없음 재료 (식약처 0건)',
  '',
  noRecipe.length ? noRecipe.map((n) => `- ${n}`).join('\n') : '- (없음)',
  '',
  '## 5. 한계',
  '',
  '- 매칭은 이름 포함 검사다. 같은 이름의 다른 품목(예: 가공품, 다른 규격)이 후보에 섞일 수 있어 사람이 코드를 확정해야 한다.',
  '- 식약처 건수는 재료 문자열 포함 검색 기준이며, 뽑힌 재료 **3개가 모두** 들어간 레시피는 훨씬 드물다 (기획서: "일부만 겹침"). 2단계에서는 뽑힌 재료 중 하나라도 들어간 레시피를 참고 자료로 쓴다.',
  '- 한 번 호출한 결과의 스냅샷이다. 가격 API는 조사일마다 값이 바뀐다.',
  ''
].join('\n')

const out = fileURLToPath(new URL('../docs/data-check.md', import.meta.url))
await mkdir(fileURLToPath(new URL('../docs/', import.meta.url)), { recursive: true })
await writeFile(out, scrub(md), 'utf8') // 마지막 방어선: 파일에도 scrub 적용
log(`\n저장: docs/data-check.md`)
log(`요약: 식약처 ${result.fs.ok ? 'OK' : '실패'}, KAMIS ${result.kamis.ok ? 'OK' : '실패'}, 참가격 ${result.price.ok ? 'OK' : '실패'} | 레시피 없음 ${noRecipe.length}개, 가격 없음 ${noPrice.length}개`)
