package com.restflow.app.notifications

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import com.restflow.app.MainActivity
import com.restflow.app.data.MorningNote

object RestFlowNotifications {
    private const val CHANNEL_ID = "morning_briefs"

    fun createChannel(context: Context) {
        val manager = context.getSystemService(NotificationManager::class.java)
        manager.createNotificationChannel(
            NotificationChannel(
                CHANNEL_ID,
                "Morning briefs",
                NotificationManager.IMPORTANCE_DEFAULT,
            ).apply {
                description = "A brief prepared by your overnight workflow"
            },
        )
    }

    fun showMorningBrief(context: Context, note: MorningNote) {
        if (
            Build.VERSION.SDK_INT >= 33 &&
            ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.POST_NOTIFICATIONS,
            ) != PackageManager.PERMISSION_GRANTED
        ) return

        createChannel(context)
        val openApp = PendingIntent.getActivity(
            context,
            4402,
            Intent(context, MainActivity::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val notification = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle(note.title)
            .setContentText(note.body.take(140))
            .setStyle(NotificationCompat.BigTextStyle().bigText(note.body))
            .setContentIntent(openApp)
            .setAutoCancel(true)
            .build()

        NotificationManagerCompat.from(context).notify(4403, notification)
    }
}
