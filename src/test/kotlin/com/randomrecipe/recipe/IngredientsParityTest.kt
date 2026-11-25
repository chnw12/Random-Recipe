package com.randomrecipe.recipe

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import java.io.File

// 화면은 backend/lib/ingredients.js 로 재료를 뽑고, 서버는 Ingredients.kt 로 검사한다.
// 한쪽만 고치면 "목록 밖 재료" 오류가 나므로 두 목록이 같은지 줄마다 비교한다.
class IngredientsParityTest {
	private val js = File("backend/lib/ingredients.js")

	private val line = Regex("""^\s*([PCS])\('([^']+)',\s*'([^']+)',\s*'([^']+)'(?:,\s*\{(.*)\})?\)""")
	private val list = Regex("""(aliases|guard):\s*\[([^\]]*)\]""")
	private val slotOf = mapOf("P" to ("protein" to "p"), "C" to ("carb" to "c"), "S" to ("sauce" to "s"))

	private fun strings(s: String) = Regex("'([^']*)'").findAll(s).map { it.groupValues[1] }.toList()

	@Test
	fun `Kotlin 재료 목록이 화면의 ingredients js 와 같다`() {
		val parsed =
			js.readLines().mapNotNull { raw ->
				val m = line.find(raw) ?: return@mapNotNull null
				val (kind, id, name, amount, extra) = m.destructured
				val (slot, prefix) = slotOf.getValue(kind)
				val lists = list.findAll(extra).associate { it.groupValues[1] to strings(it.groupValues[2]) }
				Ingredient(
					"$prefix-$id",
					name,
					slot,
					amount,
					lists["aliases"] ?: emptyList(),
					lists["guard"] ?: emptyList(),
					extra.contains("cook: true"),
				)
			}
		assertEquals(60, parsed.size, "ingredients.js 에서 재료 60개를 읽어야 한다")
		assertEquals(parsed, Ingredients.ALL)
	}
}
