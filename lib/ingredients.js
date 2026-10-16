// 재료 목록. 서버(검사·기준량)와 화면(뽑기)이 같이 쓰므로 Node 전용 API를 쓰지 않는다.
// amount(1인분 기준량)는 임시 값이다. 기획서상 "팀 기준량"이므로 팀이 확정해서 고친다.
// publicCode(공공데이터 품목 코드)는 가격 연결(보류) 때 채운다. 지어내지 않는다.
// cook: true = 날생선·해산물. 레시피에 "속까지 익히는" 단계가 있어야 하고 날것으로 먹는 조리법은 금지다 (lib/harness.js 가 검사).

export const SLOTS = [
  { id: 'protein', label: '단백질' },
  { id: 'carb', label: '채소·탄수화물' },
  { id: 'sauce', label: '양념·조리법' }
]
export const SLOT_LABEL = Object.fromEntries(SLOTS.map((s) => [s.id, s.label]))

const mk = (slot, prefix) => (id, name, amount, extra = {}) => ({ id: `${prefix}-${id}`, name, slot, amount, publicCode: null, ...extra })
const P = mk('protein', 'p')
const C = mk('carb', 'c')
const S = mk('sauce', 's')

export const INGREDIENTS = [
  P('chicken-breast', '닭가슴살', '100g', { aliases: ['닭 가슴살'] }),
  P('chicken-tender', '닭안심', '100g'),
  P('tofu', '두부', '150g'),
  P('soft-tofu', '순두부', '150g'),
  P('egg', '계란', '2개', { aliases: ['달걀'] }),
  P('salmon', '연어', '100g', { cook: true }),
  P('tuna-can', '참치캔', '1/2캔', { aliases: ['참치'] }),
  P('greek-yogurt', '그릭요거트', '100g', { aliases: ['요거트'] }),
  P('shrimp', '새우', '100g', { cook: true }),
  P('squid', '오징어', '100g', { cook: true }),
  P('beef', '소고기 우둔살', '100g', { aliases: ['소고기', '우둔살'] }),
  P('pork', '돼지 안심', '100g', { aliases: ['돼지고기', '돼지안심'] }),
  P('smoked-duck', '훈제오리', '100g'),
  P('natto', '낫또', '1팩'),
  P('chickpea', '병아리콩', '80g'),
  P('cod', '대구살', '100g', { aliases: ['대구'], cook: true }),
  P('mackerel-pike', '삼치', '100g', { cook: true }),
  P('quail-egg', '메추리알', '6개'),
  P('scallop', '가리비 관자', '80g', { aliases: ['관자', '가리비'], cook: true }),
  P('mussel', '홍합살', '100g', { aliases: ['홍합'], cook: true }),

  C('broccoli', '브로콜리', '100g'),
  C('cabbage', '양배추', '120g'),
  C('konjac', '곤약', '100g'),
  C('sweet-potato', '고구마', '100g'),
  C('oatmeal', '오트밀', '40g'),
  C('mushroom', '양송이버섯', '80g', { aliases: ['양송이', '버섯'] }),
  C('pumpkin', '단호박', '100g'),
  C('spinach', '시금치', '80g'),
  C('tomato', '방울토마토', '8개', { aliases: ['토마토'] }),
  C('cucumber', '오이', '1/2개'),
  C('zucchini', '애호박', '1/2개'),
  // '가지런히', '여러 가지'를 가지(채소)로 오인하지 않게 하는 예외 낱말 (공백 제거 기준)
  C('eggplant', '가지', '1개', { guard: ['가지런', '여러가지', '한가지', '두가지', '세가지', '몇가지', '가지고', '가지가지', '가지각색'] }),
  C('paprika', '파프리카', '1개'),
  C('asparagus', '아스파라거스', '6대'),
  C('cauliflower', '콜리플라워', '100g'),
  C('brown-rice', '현미밥', '1/2공기', { aliases: ['현미'] }),
  C('oat', '귀리', '50g'),
  C('bokchoy', '청경채', '80g'),
  C('sprout', '숙주', '100g'),
  C('lettuce', '양상추', '80g'),

  S('perilla-oil', '들기름', '1작은술'),
  S('curry', '카레가루', '1큰술'),
  S('airfryer', '에어프라이어', '180도', { aliases: ['에어 프라이어'] }),
  S('doenjang', '된장', '1/2큰술'),
  S('lemon', '레몬', '1/4개'),
  S('gim', '김가루', '1큰술'),
  S('soy-sauce', '간장', '1큰술'),
  S('gochujang', '고추장', '1/2큰술'),
  S('olive-oil', '올리브유', '1작은술'),
  S('green-chili', '청양고추', '1개'),
  S('garlic', '마늘', '2쪽'),
  S('ginger', '생강', '1쪽'),
  S('wasabi', '와사비', '1/2작은술'),
  S('sesame', '참깨', '1작은술'),
  S('basil', '바질', '조금'),
  S('oven', '오븐구이', '200도', { aliases: ['오븐'] }),
  S('steam', '스팀 찜', '10분', { aliases: ['스팀', '찜', '쪄'] }),
  S('tomato-sauce', '토마토소스', '3큰술'),
  S('balsamic', '발사믹식초', '1큰술', { aliases: ['발사믹'] }),
  S('mustard', '머스터드', '1작은술')
]

const BY_ID = new Map(INGREDIENTS.map((i) => [i.id, i]))
export const getIngredient = (id) => BY_ID.get(id)
export const bySlot = (slot) => INGREDIENTS.filter((i) => i.slot === slot)

/** AI가 추가로 써도 되는 기본 재료. "목록 밖 재료"로 보지 않는다. */
export const PANTRY_BASICS = ['물', '소금', '후추']

/** 재료 ID 3개가 목록에 있고 칸마다 정확히 하나면 칸 순서로 정렬한 재료 배열, 아니면 null */
export function resolveTriple(ids) {
  if (!Array.isArray(ids) || ids.length !== 3 || ids.some((x) => typeof x !== 'string')) return null
  const found = ids.map(getIngredient)
  if (found.some((f) => !f)) return null
  if (new Set(found.map((i) => i.slot)).size !== 3) return null
  return SLOTS.map((s) => found.find((i) => i.slot === s.id))
}

/** 칸마다 하나씩 무작위로 뽑는다. (칸 순서: 단백질, 채소·탄수화물, 양념·조리법) */
export function drawThree(rng = Math.random) {
  return { picked: SLOTS.map((s) => { const pool = bySlot(s.id); return pool[Math.floor(rng() * pool.length)] }) }
}
