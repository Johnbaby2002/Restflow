package com.restflow.app.sleep

import com.restflow.app.data.RestFlowSettings
import com.restflow.app.data.RuntimeState
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.Instant
import java.time.ZoneId

class SleepRuleEngineTest {
    private val zone = ZoneId.of("Europe/Berlin")
    private val settings = RestFlowSettings(
        enabled = true,
        sleepConfidence = 80,
        confirmationMinutes = 15,
    )

    @Test
    fun `triggers after confidence stays high for confirmation period`() {
        val first = Instant.parse("2026-06-18T21:10:00Z")
        val initial = SleepRuleEngine.evaluate(
            now = first,
            confidence = 90,
            settings = settings,
            previous = RuntimeState(),
            zoneId = zone,
        )
        assertFalse(initial.shouldTrigger)

        val confirmed = SleepRuleEngine.evaluate(
            now = first.plusSeconds(15 * 60),
            confidence = 90,
            settings = settings,
            previous = initial.runtime,
            zoneId = zone,
        )
        assertTrue(confirmed.shouldTrigger)
    }

    @Test
    fun `does not trigger twice in the same night`() {
        val now = Instant.parse("2026-06-18T22:30:00Z")
        val result = SleepRuleEngine.evaluate(
            now = now,
            confidence = 95,
            settings = settings.copy(confirmationMinutes = 0),
            previous = RuntimeState(lastTriggeredNight = "2026-06-18"),
            zoneId = zone,
        )
        assertFalse(result.shouldTrigger)
    }

    @Test
    fun `detects wake after likely sleeping`() {
        val sleepStart = Instant.parse("2026-06-18T22:30:00Z").toEpochMilli()
        val result = SleepRuleEngine.evaluate(
            now = Instant.parse("2026-06-19T05:30:00Z"),
            confidence = 10,
            settings = settings,
            previous = RuntimeState(
                likelySleeping = true,
                sleepStartedEpochMs = sleepStart,
            ),
            zoneId = zone,
        )
        assertTrue(result.wokeUp)
        assertTrue(result.completedSleepStartEpochMs == sleepStart)
    }
}
