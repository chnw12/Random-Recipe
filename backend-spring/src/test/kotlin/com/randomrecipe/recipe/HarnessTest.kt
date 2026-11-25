package com.randomrecipe.recipe

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertNotEquals
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import kotlin.random.Random

// backend/test/harness.test.js 를 옮긴 것 (같은 사례, 같은 기대값)
class HarnessTest {
	private val mapper = ObjectMapper()
	private val triple = listOf("p-tofu", "c-cabbage", "s-curry")

	private fun ids(vararg n: String) = n.map { Ingredients.get(it)!! }

	private val picked = ids(*triple.toTypedArray())

	private fun good(extra: Map<String, Any?> = emptyMap()): JsonNode =
		mapper.valueToTree(
			mapOf(
				"menuName" to "카레향 두부 양배추 볶음",
				"minutes" to 15,
				"usedIngredientIds" to triple,
				"steps" to listOf("두부는 깍둑 썰어 물기를 뺀다.", "양배추는 한입 크기로 썬다.", "두부와 양배추를 볶고 카레가루를 넣는다."),
			) + extra,
		)

	private fun recipe(
		menuName: String,
		picked: List<Ingredient>,
		steps: List<String>,
		minutes: Int = 10,
	): JsonNode =
		mapper.valueToTree(
			mapOf(
				"menuName" to menuName,
				"minutes" to minutes,
				"usedIngredientIds" to
					picked.map {
						it.id
					},
				"steps" to steps,
			),
		)

	private fun check(
		data: JsonNode?,
		p: List<Ingredient> = picked,
		avoid: String? = null,
	) = Harness.checkRecipe(data, p, avoid)

	private fun ok(r: CheckResult) = r is CheckResult.Ok

	private fun reason(r: CheckResult) = (r as CheckResult.Fail).reason

	@Test
	fun `재료 목록 - 칸마다 20개, id·이름 중복 없음`() {
		for (s in Ingredients.SLOTS) assertEquals(20, Ingredients.bySlot(s.id).size)
		assertEquals(60, Ingredients.ALL.map { it.id }.toSet().size)
		assertEquals(60, Ingredients.ALL.map { it.name }.toSet().size)
	}

	@Test
	fun `하네스 - 정상 결과 통과`() {
		val r = check(good())
		assertTrue(ok(r))
		assertEquals(triple.sorted(), (r as CheckResult.Ok).recipe.usedIngredientIds)
	}

	@Test
	fun `하네스 - 재료 누락`() {
		val r = check(good(mapOf("menuName" to "두부 양배추 볶음", "steps" to listOf("두부를 볶는다.", "양배추를 넣는다.", "접시에 담는다."))))
		assertFalse(ok(r))
		assertTrue(reason(r).contains("카레가루"))
	}

	@Test
	fun `하네스 - 목록 밖 재료는 실패, 기본 재료는 허용`() {
		assertFalse(ok(check(good(mapOf("steps" to listOf("두부를 볶는다.", "양배추를 넣는다.", "간장을 넣고 카레가루를 섞는다."))))))
		assertTrue(ok(check(good(mapOf("steps" to listOf("두부를 볶는다.", "양배추를 넣고 물을 조금 붓는다.", "소금, 후추, 카레가루로 간한다."))))))
	}

	@Test
	fun `하네스 - 순두부는 두부가 아니다 (양방향)`() {
		val r1 = check(good(mapOf("steps" to listOf("순두부를 넣는다.", "양배추와 두부를 볶는다.", "카레가루를 넣는다."))))
		assertFalse(ok(r1))
		assertTrue(reason(r1).contains("순두부"))
		val soft = ids("p-soft-tofu", "c-cabbage", "s-curry")
		assertFalse(ok(check(recipe("두부 양배추 카레", soft, listOf("두부를 볶는다.", "양배추를 넣는다.", "카레가루를 넣는다.")), soft)))
		assertTrue(ok(check(recipe("순두부 양배추 카레", soft, listOf("순두부를 데운다.", "양배추를 넣는다.", "카레가루를 넣는다.")), soft)))
	}

	@Test
	fun `하네스 - 가지런히, 여러 가지는 가지(채소)가 아니다`() {
		assertEquals(emptyList<String>(), Harness.mentionedOutsiders("접시에 가지런히 담고 여러 가지 방법으로 먹는다", picked))
		assertEquals(listOf("가지"), Harness.mentionedOutsiders("가지를 굽는다", picked))
	}

	@Test
	fun `하네스 - 금지 표현 (칼로리·열량·효과·감량)`() {
		for (t in listOf("약 300kcal의", "칼로리가 낮아요", "열량 걱정 없는", "살이 빠지는", "체중 감량에 좋은", "다이어트 효과", "체지방 분해")) {
			assertTrue(Harness.hasBannedWording(t), t)
			assertFalse(ok(check(good(mapOf("menuName" to "$t 두부 양배추 카레가루")))), t)
		}
		assertFalse(Harness.hasBannedWording("가볍게 볶아 먹는 두부 요리"))
	}

	@Test
	fun `하네스 - 형식 오류`() {
		val bads: List<JsonNode?> =
			listOf(
				null,
				mapper.valueToTree("text"),
				mapper.createArrayNode(),
				mapper.createObjectNode(),
				good(mapOf("menuName" to "")),
				good(mapOf("menuName" to "x".repeat(41))),
				good(mapOf("minutes" to "x")),
				good(mapOf("minutes" to 0)),
				good(mapOf("minutes" to 999)),
				good(mapOf("steps" to listOf("하나", "둘"))),
				good(mapOf("steps" to List(9) { "두부 양배추 카레가루" })),
				good(mapOf("steps" to listOf("두부", 5, "양배추"))),
				good(mapOf("usedIngredientIds" to listOf("p-tofu", "c-cabbage", "s-lemon"))),
				good(mapOf("usedIngredientIds" to "p-tofu")),
				good(mapOf("usedIngredientIds" to triple.take(2))),
			)
		for (bad in bads) assertFalse(ok(check(bad)), bad.toString().take(60))
	}

	@Test
	fun `하네스 - 별칭 인정 (양송이, 요거트)`() {
		val p = ids("p-greek-yogurt", "c-mushroom", "s-lemon")
		assertTrue(ok(check(recipe("레몬 요거트 양송이 볼", p, listOf("요거트를 담는다.", "양송이를 얇게 썬다.", "레몬을 짜서 올린다."), 5), p)))
	}

	@Test
	fun `하네스 - 다시 창조에서 이전과 같은 이름이면 실패`() {
		assertFalse(ok(check(good(), avoid = "카레향 두부 양배추 볶음")))
		assertTrue(ok(check(good(), avoid = "다른 이름")))
	}

	@Test
	fun `JSON 느슨한 파싱 - 코드블록, 앞뒤 설명`() {
		assertEquals(1, Harness.parseJsonLoose("```json\n{\"a\":1}\n```")!!["a"].asInt())
		assertEquals(1, Harness.parseJsonLoose("결과입니다 {\"a\":1} 끝")!!["a"].asInt())
		assertNull(Harness.parseJsonLoose("{깨진"))
		assertNull(Harness.parseJsonLoose(null))
		assertNull(Harness.parseJsonLoose("아무 말"))
	}

	@Test
	fun `조리 순서 길이 - 3~6단계, 각 70자 이하`() {
		val line = "두부와 양배추를 볶고 카레가루를 넣는다."

		fun okSteps(steps: List<String>) = ok(check(good(mapOf("steps" to steps))))
		assertFalse(okSteps(List(2) { line }))
		assertTrue(okSteps(List(3) { line }))
		assertTrue(okSteps(List(6) { line }))
		assertFalse(okSteps(List(7) { line }))
		val head = "두부 양배추 카레가루를 "

		fun withLen(n: Int) = head + "가".repeat(n - head.length)
		assertEquals(70, withLen(70).length)
		assertTrue(okSteps(listOf(withLen(70), line, line)))
		assertFalse(okSteps(listOf(withLen(71), line, line)))
	}

	@Test
	fun `날생선·해산물 - 가열 단계가 있어야 하고 날것 조리법은 거절`() {
		val salmon = ids("p-salmon", "c-cabbage", "s-lemon")

		fun mk(steps: List<String>) = recipe("레몬 연어 양배추 요리", salmon, steps, 15)
		assertTrue(ok(check(mk(listOf("연어를 먹기 좋게 썬다.", "양배추를 손질한다.", "팬에 연어를 속까지 익도록 굽는다.", "레몬을 짜서 올린다.")), salmon)))
		val noHeat = check(mk(listOf("연어를 먹기 좋게 썬다.", "양배추를 채 썬다.", "접시에 담고 레몬을 짜서 올린다.")), salmon)
		assertFalse(ok(noHeat))
		assertTrue(reason(noHeat).contains("익히는 단계"))
		for (raw in listOf("연어를 날로 얇게 썰어 올린다.", "연어를 생으로 레몬에 재운다.", "연어 세비체처럼 버무린다.", "연어 타르타르를 만든다.")) {
			assertFalse(ok(check(mk(listOf("양배추를 볶는다.", raw, "레몬을 짜서 올린다.")), salmon)), raw)
		}
		assertTrue(ok(check(good(mapOf("steps" to listOf("두부를 썬다.", "양배추를 썬다.", "카레가루를 뿌려 섞는다."))))))
	}

	@Test
	fun `날생선·해산물 표시 - 7개만 cook`() {
		assertEquals(
			listOf("가리비 관자", "대구살", "삼치", "새우", "연어", "오징어", "홍합살").sorted(),
			Ingredients.ALL.filter { it.cook }.map { it.name }.sorted(),
		)
	}

	@Test
	fun `resolveTriple - 목록 밖·칸 중복·개수 오류를 거부하고 칸 순서로 정렬`() {
		assertEquals(triple, Ingredients.resolveTriple(listOf("s-curry", "p-tofu", "c-cabbage"))!!.map { it.id })
		for (bad in listOf(
			listOf("p-tofu", "p-egg", "s-curry"),
			listOf("p-tofu", "c-cabbage", "x"),
			listOf("p-tofu", "c-cabbage"),
			listOf("p-tofu", "p-tofu", "p-tofu"),
			null,
		)) {
			assertNull(Ingredients.resolveTriple(bad), bad.toString())
		}
	}

	@Test
	fun `mock 생성기 - 모든 조합(8,000가지) × 2회가 하네스를 통과한다`() {
		val fails = mutableListOf<String>()
		for (p in Ingredients.bySlot("protein")) for (c in Ingredients.bySlot("carb")) for (s in Ingredients.bySlot("sauce")) {
			val t = listOf(p, c, s)
			repeat(2) {
				val r = check(mapper.valueToTree(MockRecipe.generate(t)), t)
				if (r is CheckResult.Fail && fails.size < 5) fails += "${p.name}+${c.name}+${s.name}: ${r.reason}"
			}
		}
		assertEquals(emptyList<String>(), fails)
	}

	@Test
	fun `mock 생성기 - 다시 창조는 다른 이름, 조사도 맞다`() {
		val t = ids("p-tofu", "c-cabbage", "s-curry")
		repeat(30) {
			val first = MockRecipe.generate(t)
			assertNotEquals(first.menuName, MockRecipe.generate(t, first.menuName).menuName)
		}
		assertEquals("두부는", MockRecipe.josa("두부", "은"))
		assertEquals("연어를", MockRecipe.josa("연어", "을"))
		assertEquals("스팀 찜으로", MockRecipe.josa("스팀 찜", "로"))
		assertEquals("오븐구이로", MockRecipe.josa("오븐구이", "로"))
		assertFalse(Regex("""은\(는\)|을\(를\)""").containsMatchIn(MockRecipe.generate(t).toString()))
	}

	@Test
	fun `mock 생성기 - 날생선·해산물 조합은 속까지 익히는 문장을 넣는다`() {
		for (p in Ingredients.bySlot("protein").filter { it.cook }) for (s in listOf("s-curry", "s-oven", "s-steam")) {
			val t = listOf(p, Ingredients.get("c-cabbage")!!, Ingredients.get(s)!!)
			val r = MockRecipe.generate(t, rng = Random(1))
			assertTrue(r.steps.joinToString(" ").contains("속까지 완전히"), "${p.name}+$s")
			assertTrue(ok(check(mapper.valueToTree(r), t)))
		}
	}
}
