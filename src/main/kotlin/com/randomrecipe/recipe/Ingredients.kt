package com.randomrecipe.recipe

// 재료 목록. 화면(frontend)은 backend/lib/ingredients.js 의 같은 목록으로 뽑기를 한다.
// 두 목록이 어긋나지 않게 IngredientsParityTest 가 JS 파일과 하나하나 비교한다.
// amount(1인분 기준량)는 임시 값이다. 팀이 확정해서 양쪽을 같이 고친다.
// cook = 날생선·해산물. 레시피에 "속까지 익히는" 단계가 있어야 하고 날것으로 먹는 조리법은 금지다 (Harness 가 검사).

data class Slot(val id: String, val label: String)

data class Ingredient(
	val id: String,
	val name: String,
	val slot: String,
	val amount: String,
	val aliases: List<String> = emptyList(),
	val guard: List<String> = emptyList(),
	val cook: Boolean = false,
)

object Ingredients {
	val SLOTS =
		listOf(
			Slot("protein", "단백질"),
			Slot("carb", "채소·탄수화물"),
			Slot("sauce", "양념·조리법"),
		)
	val SLOT_LABEL: Map<String, String> = SLOTS.associate { it.id to it.label }

	/** AI가 추가로 써도 되는 기본 재료. "목록 밖 재료"로 보지 않는다. */
	val PANTRY_BASICS = listOf("물", "소금", "후추")

	private fun p(
		id: String,
		name: String,
		amount: String,
		aliases: List<String> = emptyList(),
		cook: Boolean = false,
	) = Ingredient("p-$id", name, "protein", amount, aliases, cook = cook)

	private fun c(
		id: String,
		name: String,
		amount: String,
		aliases: List<String> = emptyList(),
		guard: List<String> = emptyList(),
	) = Ingredient("c-$id", name, "carb", amount, aliases, guard)

	private fun s(
		id: String,
		name: String,
		amount: String,
		aliases: List<String> = emptyList(),
	) = Ingredient("s-$id", name, "sauce", amount, aliases)

	val ALL: List<Ingredient> =
		listOf(
			p("chicken-breast", "닭가슴살", "100g", listOf("닭 가슴살")),
			p("chicken-tender", "닭안심", "100g"),
			p("tofu", "두부", "150g"),
			p("soft-tofu", "순두부", "150g"),
			p("egg", "계란", "2개", listOf("달걀")),
			p("salmon", "연어", "100g", cook = true),
			p("tuna-can", "참치캔", "1/2캔", listOf("참치")),
			p("greek-yogurt", "그릭요거트", "100g", listOf("요거트")),
			p("shrimp", "새우", "100g", cook = true),
			p("squid", "오징어", "100g", cook = true),
			p("beef", "소고기 우둔살", "100g", listOf("소고기", "우둔살")),
			p("pork", "돼지 안심", "100g", listOf("돼지고기", "돼지안심")),
			p("smoked-duck", "훈제오리", "100g"),
			p("natto", "낫또", "1팩"),
			p("chickpea", "병아리콩", "80g"),
			p("cod", "대구살", "100g", listOf("대구"), cook = true),
			p("mackerel-pike", "삼치", "100g", cook = true),
			p("quail-egg", "메추리알", "6개"),
			p("scallop", "가리비 관자", "80g", listOf("관자", "가리비"), cook = true),
			p("mussel", "홍합살", "100g", listOf("홍합"), cook = true),
			c("broccoli", "브로콜리", "100g"),
			c("cabbage", "양배추", "120g"),
			c("konjac", "곤약", "100g"),
			c("sweet-potato", "고구마", "100g"),
			c("oatmeal", "오트밀", "40g"),
			c("mushroom", "양송이버섯", "80g", listOf("양송이", "버섯")),
			c("pumpkin", "단호박", "100g"),
			c("spinach", "시금치", "80g"),
			c("tomato", "방울토마토", "8개", listOf("토마토")),
			c("cucumber", "오이", "1/2개"),
			c("zucchini", "애호박", "1/2개"),
			// '가지런히', '여러 가지'를 가지(채소)로 오인하지 않게 하는 예외 낱말 (공백 제거 기준)
			c(
				"eggplant",
				"가지",
				"1개",
				guard = listOf("가지런", "여러가지", "한가지", "두가지", "세가지", "몇가지", "가지고", "가지가지", "가지각색"),
			),
			c("paprika", "파프리카", "1개"),
			c("asparagus", "아스파라거스", "6대"),
			c("cauliflower", "콜리플라워", "100g"),
			c("brown-rice", "현미밥", "1/2공기", listOf("현미")),
			c("oat", "귀리", "50g"),
			c("bokchoy", "청경채", "80g"),
			c("sprout", "숙주", "100g"),
			c("lettuce", "양상추", "80g"),
			s("perilla-oil", "들기름", "1작은술"),
			s("curry", "카레가루", "1큰술"),
			s("airfryer", "에어프라이어", "180도", listOf("에어 프라이어")),
			s("doenjang", "된장", "1/2큰술"),
			s("lemon", "레몬", "1/4개"),
			s("gim", "김가루", "1큰술"),
			s("soy-sauce", "간장", "1큰술"),
			s("gochujang", "고추장", "1/2큰술"),
			s("olive-oil", "올리브유", "1작은술"),
			s("green-chili", "청양고추", "1개"),
			s("garlic", "마늘", "2쪽"),
			s("ginger", "생강", "1쪽"),
			s("wasabi", "와사비", "1/2작은술"),
			s("sesame", "참깨", "1작은술"),
			s("basil", "바질", "조금"),
			s("oven", "오븐구이", "200도", listOf("오븐")),
			s("steam", "스팀 찜", "10분", listOf("스팀", "찜", "쪄")),
			s("tomato-sauce", "토마토소스", "3큰술"),
			s("balsamic", "발사믹식초", "1큰술", listOf("발사믹")),
			s("mustard", "머스터드", "1작은술"),
		)

	private val BY_ID = ALL.associateBy { it.id }

	fun get(id: String): Ingredient? = BY_ID[id]

	fun bySlot(slot: String): List<Ingredient> = ALL.filter { it.slot == slot }

	/** 재료 ID 3개가 목록에 있고 칸마다 정확히 하나면 칸 순서로 정렬한 재료 목록, 아니면 null */
	fun resolveTriple(ids: List<String>?): List<Ingredient>? {
		if (ids == null || ids.size != 3) return null
		val found = ids.map { get(it) ?: return null }
		if (found.map { it.slot }.toSet().size != 3) return null
		return SLOTS.map { s -> found.first { it.slot == s.id } }
	}
}
