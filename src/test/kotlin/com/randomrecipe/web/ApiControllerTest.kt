package com.randomrecipe.web

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import com.randomrecipe.recipe.Ingredients
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.http.MediaType
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import java.util.concurrent.atomic.AtomicInteger

// 실제 Spring 앱을 띄워 HTTP 로 부른다. local 프로필 = H2 메모리 DB + 예시 모드(mock). 네트워크·외부 DB 없음.
// 요청 횟수 제한이 테스트끼리 섞이지 않게 요청마다 다른 IP(x-forwarded-for)를 쓴다.
@SpringBootTest
@AutoConfigureMockMvc
class ApiControllerTest {
	@Autowired lateinit var mvc: MockMvc

	@Autowired lateinit var mapper: ObjectMapper

	private val triple = listOf("p-tofu", "c-cabbage", "s-curry")
	private val uuid = "3f2a6c1e-5b7d-4e8a-9c0d-1a2b3c4d5e6f"

	data class Res(val status: Int, val body: JsonNode, val headers: Map<String, String?>)

	private fun call(req: MockHttpServletRequestBuilder): Res {
		val r = mvc.perform(req.header("x-forwarded-for", "198.51.100.${ip.incrementAndGet() % 250}")).andReturn().response
		val text = r.getContentAsString(Charsets.UTF_8)
		return Res(r.status, if (text.isBlank()) mapper.nullNode() else mapper.readTree(text), r.headerNames.associateWith { r.getHeader(it) })
	}

	private fun postJson(
		path: String,
		body: Any?,
	) = call(post(path).contentType(MediaType.APPLICATION_JSON).content(if (body is String) body else mapper.writeValueAsString(body)))

	@Test
	fun `GET 은 405 method_not_allowed (Allow 헤더)`() {
		for (path in listOf("/api/create", "/api/confirm")) {
			val r = call(get(path))
			assertEquals(405, r.status)
			assertEquals("method_not_allowed", r.body["error"].asText())
			assertEquals("POST", r.headers["Allow"])
			assertTrue(r.body["message"].isTextual)
		}
	}

	@Test
	fun `잘못된 재료는 400 invalid_ingredients`() {
		val bads =
			listOf(
				listOf("p-tofu", "c-cabbage"),
				listOf("p-tofu", "c-cabbage", "x-nope"),
				listOf("p-tofu", "p-egg", "s-curry"),
				"p-tofu",
				null,
				listOf(1, 2, 3),
			)
		for (ids in bads) {
			val r = postJson("/api/create", mapOf("ingredientIds" to ids))
			assertEquals(400, r.status, ids.toString())
			assertEquals("invalid_ingredients", r.body["error"].asText())
		}
	}

	@Test
	fun `본문이 없거나 객체가 아니면 400 invalid_request, avoidMenuName 형식 검사`() {
		for (b in listOf("null", "\"x\"", "[]", "5")) assertEquals("invalid_request", postJson("/api/create", b).body["error"].asText(), b)
		assertEquals("invalid_request", call(post("/api/create")).body["error"].asText())
		for (avoid in listOf("", "   ", "x".repeat(41), 5, mapOf<String, Any>(), null)) {
			val r = postJson("/api/create", mapOf("ingredientIds" to triple, "avoidMenuName" to avoid))
			assertEquals(400, r.status, avoid.toString())
			assertEquals("invalid_request", r.body["error"].asText())
		}
		assertEquals(200, postJson("/api/create", mapOf("ingredientIds" to triple, "avoidMenuName" to "x".repeat(40))).status)
	}

	@Test
	fun `본문이 JSON 문자열로 와도 파싱한다, 깨진 JSON 은 400`() {
		assertEquals(200, postJson("/api/create", mapper.writeValueAsString(mapper.writeValueAsString(mapOf("ingredientIds" to triple)))).status)
		assertEquals("invalid_request", postJson("/api/create", "{깨진").body["error"].asText())
		assertEquals("invalid_request", call(post("/api/create").contentType(MediaType.TEXT_PLAIN).content("hi")).body["error"].asText())
	}

	@Test
	fun `mock 모드 성공 응답 형식 - 양은 서버가 채우고 mode 는 mock`() {
		val r = postJson("/api/create", mapOf("ingredientIds" to listOf("s-curry", "p-tofu", "c-cabbage")))
		assertEquals(200, r.status)
		assertEquals("mock", r.body["mode"].asText())
		assertEquals(1, r.body["servings"].asInt())
		assertEquals(
			listOf("p-tofu" to "150g", "c-cabbage" to "120g", "s-curry" to "1큰술"),
			r.body["ingredients"].map {
				it["id"].asText() to it["amount"].asText()
			},
		)
		assertTrue(r.body["steps"].size() in 3..6)
		assertEquals(0, r.body["references"].size())
		assertTrue(r.body["minutes"].isInt)
	}

	@Test
	fun `모든 재료가 한 번씩 쓰이는 조합 20개가 전부 200`() {
		val p = Ingredients.bySlot("protein")
		val c = Ingredients.bySlot("carb")
		val s = Ingredients.bySlot("sauce")
		for (i in 0 until 20) {
			val r = postJson("/api/create", mapOf("ingredientIds" to listOf(p[i].id, c[i].id, s[i].id)))
			assertEquals(200, r.status, "${p[i].name}+${c[i].name}+${s[i].name}: ${r.body}")
		}
	}

	@Test
	fun `다시 창조는 다른 이름`() {
		repeat(5) {
			val first = postJson("/api/create", mapOf("ingredientIds" to triple)).body["menuName"].asText()
			assertNotEquals(first, postJson("/api/create", mapOf("ingredientIds" to triple, "avoidMenuName" to first)).body["menuName"].asText())
		}
	}

	@Test
	fun `confirm - 형식 검사 (browserId UUID, menuName 1~40자, 재료)`() {
		val ok = mapOf("browserId" to uuid, "menuName" to "메뉴", "ingredientIds" to triple)
		for (bad in listOf(
			ok + ("browserId" to "x"),
			ok + ("browserId" to null),
			ok + ("menuName" to " "),
			ok + ("menuName" to "x".repeat(41)),
			ok - "menuName",
		)) {
			assertEquals("invalid_request", postJson("/api/confirm", bad).body["error"].asText(), bad.toString())
		}
		assertEquals("invalid_ingredients", postJson("/api/confirm", ok + ("ingredientIds" to listOf("p-tofu"))).body["error"].asText())
	}

	@Test
	fun `confirm - DB 에 저장(recorded true), 같은 browserId+메뉴는 409, 다른 메뉴는 허용`() {
		val id = "7d1c2b3a-4e5f-4a6b-8c7d-9e0f1a2b3c4d"
		val first = postJson("/api/confirm", mapOf("browserId" to id, "menuName" to "확정 테스트 메뉴", "ingredientIds" to triple))
		assertEquals(200, first.status, first.body.toString())
		assertEquals(true, first.body["recorded"].asBoolean())
		val dup = postJson("/api/confirm", mapOf("browserId" to id, "menuName" to "확정 테스트 메뉴", "ingredientIds" to triple))
		assertEquals(409, dup.status)
		assertEquals("duplicate", dup.body["error"].asText())
		assertEquals(200, postJson("/api/confirm", mapOf("browserId" to id, "menuName" to "다른 메뉴", "ingredientIds" to triple)).status)
	}

	@Test
	fun `재료 목록, 화면용 health, 수업용 health`() {
		val ing = call(get("/api/ingredients"))
		assertEquals(60, ing.body["ingredients"].size())
		assertEquals(3, ing.body["slots"].size())
		val api = call(get("/api/health")).body
		assertEquals(true, api["ok"].asBoolean())
		assertEquals("mock", api["mode"].asText())
		assertEquals(true, api["db"].asBoolean())
		val common = call(get("/common/health"))
		assertEquals(200, common.status)
		assertEquals("ok", common.body["status"].asText())
		assertEquals("up", common.body["database"].asText())
	}

	@Test
	fun `없는 API 는 404 not_found (JSON)`() {
		val r = call(get("/api/nope"))
		assertEquals(404, r.status)
		assertEquals("not_found", r.body["error"].asText())
	}

	companion object {
		private val ip = AtomicInteger()
	}
}
