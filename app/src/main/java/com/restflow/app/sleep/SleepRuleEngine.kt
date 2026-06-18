package com.restflow.app.sleep

import com.restflow.app.data.RestFlowSettings
import com.restflow.app.data.RuntimeState
import java.time.Duration
import java.time.Instant
import java.time.LocalDateTime
import java.time.LocalTime
import java.time.ZoneId

data class RuleResult(
    val runtime: RuntimeState,
    val shouldTrigger: Boolean = false,
    val wokeUp: Boolean = false,
    val completedSleepStartEpochMs: Long? = null,
)

object SleepRuleEngine {
    fun evaluate(
        now: Instant,
        confidence: Int,
        settings: RestFlowSettings,
        previous: RuntimeState,
        zoneId: ZoneId = ZoneId.systemDefault(),
    ): RuleResult {
        if (!settings.enabled) return RuleResult(previous)

        val localDateTime = LocalDateTime.ofInstant(now, zoneId)
        val inWindow = isInsideWindow(localDateTime.toLocalTime(), settings)

        if (previous.likelySleeping && confidence <= settings.awakeConfidence) {
            return RuleResult(
                runtime = previous.copy(
                    highConfidenceSinceEpochMs = null,
                    sleepStartedEpochMs = null,
                    likelySleeping = false,
                ),
                wokeUp = true,
                completedSleepStartEpochMs = previous.sleepStartedEpochMs,
            )
        }

        if (!inWindow || confidence < settings.sleepConfidence) {
            return RuleResult(
                previous.copy(highConfidenceSinceEpochMs = null),
            )
        }

        val firstHigh = previous.highConfidenceSinceEpochMs ?: now.toEpochMilli()
        val confirmed = Duration.between(
            Instant.ofEpochMilli(firstHigh),
            now,
        ).toMinutes() >= settings.confirmationMinutes

        val sleepingRuntime = previous.copy(
            highConfidenceSinceEpochMs = firstHigh,
            sleepStartedEpochMs = previous.sleepStartedEpochMs ?: firstHigh,
            likelySleeping = confirmed || previous.likelySleeping,
        )

        if (!confirmed) return RuleResult(sleepingRuntime)

        val nightKey = nightKey(localDateTime, settings)
        if (previous.lastTriggeredNight == nightKey) {
            return RuleResult(sleepingRuntime)
        }

        return RuleResult(
            runtime = sleepingRuntime.copy(lastTriggeredNight = nightKey),
            shouldTrigger = true,
        )
    }

    private fun isInsideWindow(time: LocalTime, settings: RestFlowSettings): Boolean {
        val start = LocalTime.of(settings.startHour, settings.startMinute)
        val cutoff = LocalTime.of(settings.cutoffHour, settings.cutoffMinute)
        return if (start <= cutoff) {
            !time.isBefore(start) && time.isBefore(cutoff)
        } else {
            !time.isBefore(start) || time.isBefore(cutoff)
        }
    }

    private fun nightKey(
        localDateTime: LocalDateTime,
        settings: RestFlowSettings,
    ): String {
        val cutoff = LocalTime.of(settings.cutoffHour, settings.cutoffMinute)
        val date = if (localDateTime.toLocalTime().isBefore(cutoff)) {
            localDateTime.toLocalDate().minusDays(1)
        } else {
            localDateTime.toLocalDate()
        }
        return date.toString()
    }
}
