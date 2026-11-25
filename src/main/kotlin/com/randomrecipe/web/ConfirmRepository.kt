package com.randomrecipe.web

import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.stereotype.Repository
import java.sql.Timestamp
import java.time.Instant

// 확정 기록 (익명 browserId·메뉴·재료 ID만 저장). 테이블은 db/changelog-master.yml (Liquibase) 이 만든다.
@Repository
class ConfirmRepository(private val jdbc: JdbcTemplate) {
	fun existsSince(
		browserId: String,
		menuName: String,
		since: Instant,
	): Boolean =
		jdbc.queryForList(
			"select 1 from confirmations where browser_id = ? and menu_name = ? and created_at > ? limit 1",
			browserId,
			menuName,
			Timestamp.from(since),
		).isNotEmpty()

	fun insert(
		browserId: String,
		menuName: String,
		ingredientIds: List<String>,
		at: Instant,
	) {
		jdbc.update(
			"insert into confirmations (created_at, browser_id, menu_name, ingredient_ids) values (?, ?, ?, ?)",
			Timestamp.from(at),
			browserId,
			menuName,
			ingredientIds.joinToString(","),
		)
	}

	/** health 용: DB 연결 확인 */
	fun ping(): Boolean = runCatching { jdbc.queryForObject("select 1", Int::class.java) == 1 }.getOrDefault(false)
}
