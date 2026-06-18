package com.restflow.app.data

import android.content.Context
import java.time.Instant

data class RestFlowSettings(
    val enabled: Boolean = false,
    val webhookUrl: String = "",
    val bearerToken: String = "",
    val startHour: Int = 23,
    val startMinute: Int = 0,
    val cutoffHour: Int = 5,
    val cutoffMinute: Int = 0,
    val sleepConfidence: Int = 80,
    val awakeConfidence: Int = 25,
    val confirmationMinutes: Int = 15,
    val requireCharging: Boolean = false,
)

data class RuntimeState(
    val highConfidenceSinceEpochMs: Long? = null,
    val sleepStartedEpochMs: Long? = null,
    val lastTriggeredNight: String? = null,
    val likelySleeping: Boolean = false,
)

data class MorningNote(
    val title: String,
    val body: String,
    val createdAtEpochMs: Long,
)

class AppPreferences(context: Context) {
    private val preferences =
        context.getSharedPreferences("restflow_preferences", Context.MODE_PRIVATE)

    fun loadSettings() = RestFlowSettings(
        enabled = preferences.getBoolean("enabled", false),
        webhookUrl = preferences.getString("webhook_url", "").orEmpty(),
        bearerToken = preferences.getString("bearer_token", "").orEmpty(),
        startHour = preferences.getInt("start_hour", 23),
        startMinute = preferences.getInt("start_minute", 0),
        cutoffHour = preferences.getInt("cutoff_hour", 5),
        cutoffMinute = preferences.getInt("cutoff_minute", 0),
        sleepConfidence = preferences.getInt("sleep_confidence", 80),
        awakeConfidence = preferences.getInt("awake_confidence", 25),
        confirmationMinutes = preferences.getInt("confirmation_minutes", 15),
        requireCharging = preferences.getBoolean("require_charging", false),
    )

    fun saveSettings(settings: RestFlowSettings) {
        preferences.edit()
            .putBoolean("enabled", settings.enabled)
            .putString("webhook_url", settings.webhookUrl.trim())
            .putString("bearer_token", settings.bearerToken.trim())
            .putInt("start_hour", settings.startHour)
            .putInt("start_minute", settings.startMinute)
            .putInt("cutoff_hour", settings.cutoffHour)
            .putInt("cutoff_minute", settings.cutoffMinute)
            .putInt("sleep_confidence", settings.sleepConfidence)
            .putInt("awake_confidence", settings.awakeConfidence)
            .putInt("confirmation_minutes", settings.confirmationMinutes)
            .putBoolean("require_charging", settings.requireCharging)
            .apply()
    }

    fun loadRuntime() = RuntimeState(
        highConfidenceSinceEpochMs =
            preferences.getLongOrNull("high_confidence_since"),
        sleepStartedEpochMs = preferences.getLongOrNull("sleep_started"),
        lastTriggeredNight = preferences.getString("last_triggered_night", null),
        likelySleeping = preferences.getBoolean("likely_sleeping", false),
    )

    fun saveRuntime(runtime: RuntimeState) {
        preferences.edit()
            .putLongOrRemove("high_confidence_since", runtime.highConfidenceSinceEpochMs)
            .putLongOrRemove("sleep_started", runtime.sleepStartedEpochMs)
            .putString("last_triggered_night", runtime.lastTriggeredNight)
            .putBoolean("likely_sleeping", runtime.likelySleeping)
            .apply()
    }

    fun saveMorningNote(note: MorningNote) {
        preferences.edit()
            .putString("note_title", note.title)
            .putString("note_body", note.body)
            .putLong("note_created_at", note.createdAtEpochMs)
            .apply()
    }

    fun loadMorningNote(): MorningNote? {
        val body = preferences.getString("note_body", null) ?: return null
        return MorningNote(
            title = preferences.getString("note_title", "Your morning brief").orEmpty(),
            body = body,
            createdAtEpochMs = preferences.getLong(
                "note_created_at",
                Instant.now().toEpochMilli(),
            ),
        )
    }

    fun appendLog(message: String) {
        val existing = preferences.getString("execution_log", "").orEmpty()
            .lineSequence()
            .filter { it.isNotBlank() }
            .take(19)
            .toList()
        val next = (listOf("${Instant.now()}  $message") + existing).joinToString("\n")
        preferences.edit().putString("execution_log", next).apply()
    }

    fun loadLog(): String = preferences.getString("execution_log", "").orEmpty()

    private fun android.content.SharedPreferences.getLongOrNull(key: String): Long? =
        if (contains(key)) getLong(key, 0L) else null

    private fun android.content.SharedPreferences.Editor.putLongOrRemove(
        key: String,
        value: Long?,
    ) = apply {
        if (value == null) remove(key) else putLong(key, value)
    }
}

