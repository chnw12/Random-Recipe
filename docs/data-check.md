# 공공데이터 API 확인 결과

확인일: 2026-10-16 (`npm run data:check`). 키와 키가 들어간 URL은 이 문서에 쓰지 않는다. 원본 응답 전체를 저장하지도 않는다.

## 1. API 3개 호출 결과

| API | 성공 | 확인한 것 |
|---|---|---|
| 식약처 조리식품 레시피 DB (COOKRCP01) | 성공 | 전체 1156건. 메뉴명 `RCP_NM`, 재료 `RCP_PARTS_DTLS`, 조리 순서 `MANUAL01~20` |
| KAMIS 일별 소매가격 (dailySalesList) | 성공 | 품목 행 246개. 필드: product_cls_code, product_cls_name, category_code, category_name, productno, lastest_day, productName, item_name, unit, day1, dpr1, day2, dpr2, day3, dpr3, day4, dpr4, direction, value |
| 한국소비자원 생필품 가격 정보 (XML) | 실패/미확인 | 응답하는 엔드포인트 후보 없음 (요청주소 확인 필요) |

식약처 응답 필드: `RCP_PARTS_DTLS`, `RCP_WAY2`, `MANUAL_IMG20`, `MANUAL20`, `RCP_SEQ`, `INFO_NA`, `INFO_WGT`, `INFO_PRO`, `MANUAL_IMG13`, `MANUAL_IMG14`, `MANUAL_IMG15`, `MANUAL_IMG16`, `MANUAL_IMG10`, `MANUAL_IMG11`, `MANUAL_IMG12`, `MANUAL_IMG17`, `MANUAL_IMG18`, `MANUAL_IMG19`, `INFO_FAT`, `HASH_TAG`, `MANUAL_IMG02`, `MANUAL_IMG03`, `RCP_PAT2`, `MANUAL_IMG04`, `MANUAL_IMG05`, `MANUAL_IMG01`, `MANUAL01`, `ATT_FILE_NO_MK`, `MANUAL_IMG06`, `MANUAL_IMG07`, `MANUAL_IMG08`, `MANUAL_IMG09`, `MANUAL08`, `MANUAL09`, `MANUAL06`, `MANUAL07`, `MANUAL04`, `MANUAL05`, `MANUAL02`, `MANUAL03`, `ATT_FILE_NO_MAIN`, `MANUAL11`, `MANUAL12`, `MANUAL10`, `INFO_CAR`, `MANUAL19`, `RCP_NA_TIP`, `INFO_ENG`, `MANUAL17`, `MANUAL18`, `RCP_NM`, `MANUAL15`, `MANUAL16`, `MANUAL13`, `MANUAL14`

> 응답에 영양/열량 필드(`INFO_*`)가 들어 있다. 기획서 Won't 이므로 저장하지 않고 표시하지 않는다.

## 2. 재료 60개별 확인

- 식약처: 재료 문자열(`RCP_PARTS_DTLS`)에 이름이 들어간 레시피 건수. 0건이면 별칭으로 한 번 더 찾는다.
- KAMIS: 이름이 일치하거나 포함되는 품목 **후보**(`품목명/종류[productno]`). 응답에 `item_code`는 없고 품목+품종 단위 번호 `productno`만 있다. 자동 매칭이라 3단계에서 사람이 확인한다.
- 참가격: 상품명에 이름이 포함된 상품 수.

| id | 재료 | 칸 | 식약처 레시피 | KAMIS 후보 | 참가격 상품 |
|---|---|---|---|---|---|
| p-chicken-breast | 닭가슴살 | protein | 54건 | 없음 | 미확인 |
| p-chicken-tender | 닭안심 | protein | 2건 | 없음 | 미확인 |
| p-tofu | 두부 | protein | 156건 | 없음 | 미확인 |
| p-soft-tofu | 순두부 | protein | 11건 | 없음 | 미확인 |
| p-egg | 계란 | protein | 27건 | 계란/특란10구(일반란)[71], 계란/특란30구(일반란)[71] | 미확인 |
| p-salmon | 연어 | protein | 23건 | 없음 | 미확인 |
| p-tuna-can | 참치캔 | protein | 11건 (검색어 "참치") | 없음 | 미확인 |
| p-greek-yogurt | 그릭요거트 | protein | 4건 | 없음 | 미확인 |
| p-shrimp | 새우 | protein | 124건 | 새우젓/새우젓[683], 새우/흰다리(수입)[938] | 미확인 |
| p-squid | 오징어 | protein | 34건 | 물오징어/원양(냉동)(小)[2099], 물오징어/연근해(신선 냉장)(中)[2095], 물오징어/원양(냉동)(中)[2098] 외 6 | 미확인 |
| p-beef | 소고기 우둔살 | protein | 1건 | 수입 소고기/갈비(미국산)[81], 수입 소고기/갈비(호주산)[82], 수입 소고기/갈비살(미국산)[81] 외 1 | 미확인 |
| p-pork | 돼지 안심 | protein | 72건 (검색어 "돼지고기") | 수입 돼지고기/삼겹살[0] | 미확인 |
| p-smoked-duck | 훈제오리 | protein | 3건 | 없음 | 미확인 |
| p-natto | 낫또 | protein | 0건 | 없음 | 미확인 |
| p-chickpea | 병아리콩 | protein | 5건 | 없음 | 미확인 |
| p-cod | 대구살 | protein | 4건 | 없음 | 미확인 |
| p-mackerel-pike | 삼치 | protein | 5건 | 삼치/냉장[3021], 삼치/냉동[2801] | 미확인 |
| p-quail-egg | 메추리알 | protein | 10건 | 없음 | 미확인 |
| p-scallop | 가리비 관자 | protein | 11건 (검색어 "관자") | 없음 | 미확인 |
| p-mussel | 홍합살 | protein | 1건 | 홍합/깐홍합(냉장)[2894], 홍합/안깐홍합(냉장)[2895] | 미확인 |
| c-broccoli | 브로콜리 | carb | 42건 | 브로콜리/브로콜리(국산)[2239] | 미확인 |
| c-cabbage | 양배추 | carb | 46건 | 양배추/양배추[36] | 미확인 |
| c-konjac | 곤약 | carb | 28건 | 없음 | 미확인 |
| c-sweet-potato | 고구마 | carb | 64건 | 고구마/밤[20] | 미확인 |
| c-oatmeal | 오트밀 | carb | 2건 | 없음 | 미확인 |
| c-mushroom | 양송이버섯 | carb | 44건 | 느타리버섯/느타리버섯[152], 느타리버섯/애느타리버섯[1005], 팽이버섯/팽이버섯[154] 외 1 | 미확인 |
| c-pumpkin | 단호박 | carb | 74건 | 없음 | 미확인 |
| c-spinach | 시금치 | carb | 65건 | 시금치/시금치[38] | 미확인 |
| c-tomato | 방울토마토 | carb | 69건 | 토마토/토마토[60], 방울토마토/방울토마토[437], 방울토마토/대추방울토마토[1076] | 미확인 |
| c-cucumber | 오이 | carb | 96건 | 오이/가시계통[50], 오이/다다기계통[52], 오이/취청[54] 외 1 | 미확인 |
| c-zucchini | 애호박 | carb | 77건 | 호박/애호박[56] | 미확인 |
| c-eggplant | 가지 | carb | 67건 | 가지/가지[129] | 미확인 |
| c-paprika | 파프리카 | carb | 164건 | 파프리카/파프리카[139] | 미확인 |
| c-asparagus | 아스파라거스 | carb | 24건 | 없음 | 미확인 |
| c-cauliflower | 콜리플라워 | carb | 6건 | 없음 | 미확인 |
| c-brown-rice | 현미밥 | carb | 7건 | 현미/찰현미[3217] | 미확인 |
| c-oat | 귀리 | carb | 10건 | 없음 | 미확인 |
| c-bokchoy | 청경채 | carb | 21건 | 없음 | 미확인 |
| c-sprout | 숙주 | carb | 25건 | 없음 | 미확인 |
| c-lettuce | 양상추 | carb | 28건 | 없음 | 미확인 |
| s-perilla-oil | 들기름 | sauce | 24건 | 없음 | 미확인 |
| s-curry | 카레가루 | sauce | 31건 | 없음 | 미확인 |
| s-airfryer | 에어프라이어 | sauce | 0건 (검색어 "에어 프라이어") | 없음 | 미확인 |
| s-doenjang | 된장 | sauce | 76건 | 없음 | 미확인 |
| s-lemon | 레몬 | sauce | 164건 | 레몬/수입[666] | 미확인 |
| s-gim | 김가루 | sauce | 17건 | 없음 | 미확인 |
| s-soy-sauce | 간장 | sauce | 321건 | 없음 | 미확인 |
| s-gochujang | 고추장 | sauce | 66건 | 없음 | 미확인 |
| s-olive-oil | 올리브유 | sauce | 90건 | 없음 | 미확인 |
| s-green-chili | 청양고추 | sauce | 72건 | 풋고추/청양고추[94] | 미확인 |
| s-garlic | 마늘 | sauce | 523건 | 깐마늘(국산)/깐마늘(국산)[357], 깐마늘(국산)/깐마늘(대서)[1001], 깐마늘(국산)/깐마늘(남도)[1003] 외 2 | 미확인 |
| s-ginger | 생강 | sauce | 136건 | 생강/국산[126], 생강/수입[128] | 미확인 |
| s-wasabi | 와사비 | sauce | 8건 | 없음 | 미확인 |
| s-sesame | 참깨 | sauce | 43건 | 참깨/백색(국산)[143], 참깨/중국[145], 참깨/인도[612] | 미확인 |
| s-basil | 바질 | sauce | 48건 | 없음 | 미확인 |
| s-oven | 오븐구이 | sauce | 0건 (검색어 "오븐") | 없음 | 미확인 |
| s-steam | 스팀 찜 | sauce | 0건 (검색어 "스팀") | 없음 | 미확인 |
| s-tomato-sauce | 토마토소스 | sauce | 12건 | 없음 | 미확인 |
| s-balsamic | 발사믹식초 | sauce | 20건 | 없음 | 미확인 |
| s-mustard | 머스터드 | sauce | 19건 | 없음 | 미확인 |

## 3. 가격 없음 재료 — 잠정 (KAMIS 후보 없음. 참가격은 아직 확인 못 해서 "가격 없음"으로 단정할 수 없음)

- 닭가슴살
- 닭안심
- 두부
- 순두부
- 연어
- 참치캔
- 그릭요거트
- 훈제오리
- 낫또
- 병아리콩
- 대구살
- 메추리알
- 가리비 관자
- 곤약
- 오트밀
- 단호박
- 아스파라거스
- 콜리플라워
- 귀리
- 청경채
- 숙주
- 양상추
- 들기름
- 카레가루
- 에어프라이어
- 된장
- 김가루
- 간장
- 고추장
- 올리브유
- 와사비
- 바질
- 오븐구이
- 스팀 찜
- 토마토소스
- 발사믹식초
- 머스터드

## 4. 참고 레시피 없음 재료 (식약처 0건)

- 낫또
- 에어프라이어
- 오븐구이
- 스팀 찜

## 5. 한계

- 매칭은 이름 포함 검사다. 같은 이름의 다른 품목(예: 가공품, 다른 규격)이 후보에 섞일 수 있어 사람이 코드를 확정해야 한다.
- 식약처 건수는 재료 문자열 포함 검색 기준이며, 뽑힌 재료 **3개가 모두** 들어간 레시피는 훨씬 드물다 (기획서: "일부만 겹침"). 2단계에서는 뽑힌 재료 중 하나라도 들어간 레시피를 참고 자료로 쓴다.
- 한 번 호출한 결과의 스냅샷이다. 가격 API는 조사일마다 값이 바뀐다.
