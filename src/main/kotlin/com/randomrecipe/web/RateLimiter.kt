package com.randomrecipe.web

import jakarta.servlet.http.HttpServletRequest
import org.springframework.stereotype.Component
import java.security.MessageDigest
import java.util.concurrent.ConcurrentHashMap

// 요청 횟수 제한 (IP당, 고정 시간 창).
// Node 버전은 서버리스라 DB에 셌지만, Spring 은 컨테이너 하나가 계속 떠 있으므로 메모리로 센다.
// (컨테이너를 여러 개로 늘리면 개수만큼 한도가 늘어난다 → 그때 DB나 Redis 로 옮긴다.)

data class RateResult(val allowed: Boolean, val count: Int, val retryAfterSec: Long)

@Component
class RateLimiter {
	/** 테스트에서 시간을 바꿔 끼울 수 있게 둔다 */
	var clock: () -> Long = System::currentTimeMillis

	private data class Window(val start: Long, val count: Int)

	private val memory = ConcurrentHashMap<String, Window>()

	// IP 원문을 키로 들고 있지 않도록 구분과 함께 해시한다
	private fun keyOf(
		bucket: String,
		ip: String,
	): String =
		MessageDigest.getInstance("SHA-256").digest("$bucket:$ip".toByteArray())
			.joinToString("") { "%02x".format(it) }.take(40)

	fun hit(
		ip: String,
		bucket: String,
		limit: Int,
		windowMs: Long,
	): RateResult {
		val now = clock()
		val windowStart = Math.floorDiv(now, windowMs) * windowMs
		val w =
			memory.compute(
				keyOf(bucket, ip),
			) { _, cur -> if (cur != null && cur.start == windowStart) cur.copy(count = cur.count + 1) else Window(windowStart, 1) }!!
		if (memory.size > 5000) memory.entries.removeIf { now - it.value.start > windowMs * 2 }
		val leftMs = windowStart + windowMs - now
		return RateResult(w.count <= limit, w.count, maxOf(1L, (leftMs + 999) / 1000))
	}

	fun reset() = memory.clear()

	companion object {
		/** 프록시 뒤에서는 x-forwarded-for 의 첫 값이 클라이언트다. */
		fun clientIp(req: HttpServletRequest): String =
			req.getHeader("x-forwarded-for")?.split(',')?.firstOrNull()?.trim()?.takeIf { it.isNotEmpty() }
				?: req.getHeader("x-real-ip")?.takeIf { it.isNotBlank() }
				?: req.remoteAddr
				?: "unknown"
	}
}
