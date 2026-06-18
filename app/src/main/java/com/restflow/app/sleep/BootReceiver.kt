package com.restflow.app.sleep

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.restflow.app.data.AppPreferences

class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (
            intent.action != Intent.ACTION_BOOT_COMPLETED &&
            intent.action != Intent.ACTION_MY_PACKAGE_REPLACED
        ) return

        val preferences = AppPreferences(context)
        if (!preferences.loadSettings().enabled) return

        val pendingResult = goAsync()
        SleepSubscriptionManager(context).subscribe { result ->
            preferences.appendLog(
                if (result.isSuccess) {
                    "Sleep detection restored after restart"
                } else {
                    "Could not restore sleep detection"
                },
            )
            pendingResult.finish()
        }
    }
}
