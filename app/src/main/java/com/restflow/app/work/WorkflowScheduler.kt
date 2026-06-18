package com.restflow.app.work

import android.content.Context
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.Data
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import com.restflow.app.data.AppPreferences
import java.time.Duration

object WorkflowScheduler {
    fun enqueue(context: Context, reason: String, force: Boolean = false) {
        val settings = AppPreferences(context).loadSettings()
        val constraints = Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .setRequiresCharging(settings.requireCharging && !force)
            .build()

        val request = OneTimeWorkRequestBuilder<WorkflowWorker>()
            .setConstraints(constraints)
            .setInputData(Data.Builder().putString("reason", reason).build())
            .setBackoffCriteria(
                BackoffPolicy.EXPONENTIAL,
                Duration.ofMinutes(15),
            )
            .build()

        WorkManager.getInstance(context).enqueueUniqueWork(
            if (force) "restflow_test" else "restflow_nightly",
            if (force) ExistingWorkPolicy.REPLACE else ExistingWorkPolicy.KEEP,
            request,
        )
    }
}
