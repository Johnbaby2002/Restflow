package com.restflow.app.work

import android.content.Context
import androidx.work.Worker
import androidx.work.WorkerParameters
import com.restflow.app.data.AppPreferences
import com.restflow.app.data.MorningNote
import com.restflow.app.notifications.RestFlowNotifications
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.time.Instant

class WorkflowWorker(
    appContext: Context,
    workerParams: WorkerParameters,
) : Worker(appContext, workerParams) {

    override fun doWork(): Result {
        val preferences = AppPreferences(applicationContext)
        val settings = preferences.loadSettings()
        val endpoint = settings.webhookUrl

        if (runAttemptCount >= 3) {
            preferences.appendLog("Workflow stopped after 3 attempts")
            return Result.failure()
        }

        if (!endpoint.startsWith("https://")) {
            preferences.appendLog("Blocked workflow: webhook must use HTTPS")
            return Result.failure()
        }

        return try {
            val reason = inputData.getString("reason") ?: "sleep_confirmed"
            val payload = JSONObject()
                .put("event", reason)
                .put("timestamp", Instant.now().toString())
                .put("source", "restflow_android")
                .put("sleepStartEpochMs", preferences.loadRuntime().sleepStartedEpochMs)

            val connection = (URL(endpoint).openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                connectTimeout = 15_000
                readTimeout = 45_000
                doOutput = true
                setRequestProperty("Content-Type", "application/json")
                setRequestProperty("Accept", "application/json")
                if (settings.bearerToken.isNotBlank()) {
                    setRequestProperty("Authorization", "Bearer ${settings.bearerToken}")
                }
            }

            connection.outputStream.use {
                it.write(payload.toString().toByteArray(Charsets.UTF_8))
            }

            val responseCode = connection.responseCode
            val stream = if (responseCode in 200..299) {
                connection.inputStream
            } else {
                connection.errorStream
            }
            val responseBody = stream?.bufferedReader()?.use { it.readText() }.orEmpty()

            if (responseCode !in 200..299) {
                preferences.appendLog("Webhook returned HTTP $responseCode")
                connection.disconnect()
                return if (responseCode == 408 || responseCode == 429 || responseCode >= 500) {
                    Result.retry()
                } else {
                    Result.failure()
                }
            }

            val note = parseMorningNote(responseBody)
            preferences.saveMorningNote(note)
            preferences.appendLog("Morning brief received")
            if (!preferences.loadRuntime().likelySleeping) {
                RestFlowNotifications.showMorningBrief(applicationContext, note)
            }
            connection.disconnect()
            Result.success()
        } catch (error: Exception) {
            preferences.appendLog("Workflow failed: ${error.message ?: "unknown error"}")
            Result.retry()
        }
    }

    private fun parseMorningNote(responseBody: String): MorningNote {
        val fallback = responseBody.ifBlank {
            "The overnight workflow completed successfully. Open its connected service for details."
        }.take(8_000)

        return runCatching {
            val json = JSONObject(responseBody)
            MorningNote(
                title = json.optString("title", "Your morning brief").take(100),
                body = json.optString("body", fallback).take(8_000),
                createdAtEpochMs = Instant.now().toEpochMilli(),
            )
        }.getOrElse {
            MorningNote(
                title = "Your morning brief",
                body = fallback,
                createdAtEpochMs = Instant.now().toEpochMilli(),
            )
        }
    }
}
