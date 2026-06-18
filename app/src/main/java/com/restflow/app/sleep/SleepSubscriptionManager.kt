package com.restflow.app.sleep

import android.Manifest
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import androidx.core.content.ContextCompat
import com.google.android.gms.location.ActivityRecognition
import com.google.android.gms.location.SleepSegmentRequest

class SleepSubscriptionManager(private val context: Context) {
    private val pendingIntent: PendingIntent
        get() = PendingIntent.getBroadcast(
            context,
            4401,
            Intent(context, SleepEventReceiver::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE,
        )

    fun subscribe(onResult: (Result<Unit>) -> Unit) {
        if (
            ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.ACTIVITY_RECOGNITION,
            ) != PackageManager.PERMISSION_GRANTED
        ) {
            onResult(Result.failure(SecurityException("Activity Recognition is required")))
            return
        }

        ActivityRecognition.getClient(context)
            .requestSleepSegmentUpdates(
                pendingIntent,
                SleepSegmentRequest.getDefaultSleepSegmentRequest(),
            )
            .addOnSuccessListener { onResult(Result.success(Unit)) }
            .addOnFailureListener { onResult(Result.failure(it)) }
    }

    fun unsubscribe(onResult: (Result<Unit>) -> Unit) {
        ActivityRecognition.getClient(context)
            .removeSleepSegmentUpdates(pendingIntent)
            .addOnSuccessListener { onResult(Result.success(Unit)) }
            .addOnFailureListener { onResult(Result.failure(it)) }
    }
}

