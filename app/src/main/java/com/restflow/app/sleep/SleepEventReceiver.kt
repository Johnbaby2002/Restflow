package com.restflow.app.sleep

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.google.android.gms.location.SleepClassifyEvent
import com.restflow.app.data.AppPreferences
import com.restflow.app.data.MorningNote
import com.restflow.app.notifications.RestFlowNotifications
import com.restflow.app.work.WorkflowScheduler
import java.time.Duration
import java.time.Instant

class SleepEventReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (!SleepClassifyEvent.hasEvents(intent)) return

        val latestEvent = SleepClassifyEvent.extractEvents(intent)
            .maxByOrNull { it.timestampMillis }
            ?: return

        val preferences = AppPreferences(context)
        val result = SleepRuleEngine.evaluate(
            now = Instant.ofEpochMilli(latestEvent.timestampMillis),
            confidence = latestEvent.confidence,
            settings = preferences.loadSettings(),
            previous = preferences.loadRuntime(),
        )
        preferences.saveRuntime(result.runtime)
        preferences.appendLog("Sleep confidence ${latestEvent.confidence}%")

        if (result.shouldTrigger) {
            WorkflowScheduler.enqueue(context, reason = "sleep_confirmed")
            preferences.appendLog("Overnight workflow queued")
        }

        if (result.wokeUp) {
            val sleepSummary = buildSleepSummary(
                result.completedSleepStartEpochMs,
                latestEvent.timestampMillis,
            )
            val existing = preferences.loadMorningNote()
            val completedNote = MorningNote(
                title = existing?.title ?: "Good morning",
                body = listOfNotNull(sleepSummary, existing?.body)
                    .joinToString("\n\n")
                    .ifBlank { "Your phone detected that you are awake." },
                createdAtEpochMs = latestEvent.timestampMillis,
            )
            preferences.saveMorningNote(completedNote)
            RestFlowNotifications.showMorningBrief(context, completedNote)
            preferences.appendLog("Wake-up detected")
        }
    }

    private fun buildSleepSummary(startEpochMs: Long?, endEpochMs: Long): String? {
        startEpochMs ?: return null
        val minutes = Duration.ofMillis(endEpochMs - startEpochMs)
            .toMinutes()
            .coerceAtLeast(0)
        val hoursPart = minutes / 60
        val minutesPart = minutes % 60
        return "Estimated sleep: ${hoursPart}h ${minutesPart}m. Phone-based estimate only."
    }
}

