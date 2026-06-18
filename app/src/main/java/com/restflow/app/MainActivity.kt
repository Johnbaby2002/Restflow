package com.restflow.app

import android.Manifest
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import com.restflow.app.data.AppPreferences
import com.restflow.app.data.RestFlowSettings
import com.restflow.app.notifications.RestFlowNotifications
import com.restflow.app.sleep.SleepSubscriptionManager
import com.restflow.app.work.WorkflowScheduler

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        RestFlowNotifications.createChannel(this)
        setContent {
            MaterialTheme {
                RestFlowScreen()
            }
        }
    }

    @Composable
    private fun RestFlowScreen() {
        val preferences = remember { AppPreferences(this) }
        var settings by remember { mutableStateOf(preferences.loadSettings()) }
        var status by remember { mutableStateOf("Ready") }
        var note by remember { mutableStateOf(preferences.loadMorningNote()) }
        var log by remember { mutableStateOf(preferences.loadLog()) }

        val permissionLauncher = rememberLauncherForActivityResult(
            ActivityResultContracts.RequestMultiplePermissions(),
        ) { grants ->
            status = if (grants[Manifest.permission.ACTIVITY_RECOGNITION] == true) {
                "Permission granted. Save to activate sleep detection."
            } else {
                "Activity Recognition permission is required."
            }
        }

        Scaffold(containerColor = Color(0xFFF7F5FF)) { padding ->
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding)
                    .verticalScroll(rememberScrollState())
                    .padding(20.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp),
            ) {
                Text(
                    text = "RestFlow",
                    style = MaterialTheme.typography.headlineLarge,
                    fontWeight = FontWeight.Bold,
                )
                Text(
                    "Use resting time for useful work—without using the developer’s API key.",
                    style = MaterialTheme.typography.bodyLarge,
                )

                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(
                        modifier = Modifier.padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text("Night workflow", fontWeight = FontWeight.SemiBold)
                                Text("Runs once after sleep is likely")
                            }
                            Switch(
                                checked = settings.enabled,
                                onCheckedChange = {
                                    settings = settings.copy(enabled = it)
                                },
                            )
                        }

                        OutlinedTextField(
                            value = settings.webhookUrl,
                            onValueChange = { settings = settings.copy(webhookUrl = it) },
                            modifier = Modifier.fillMaxWidth(),
                            label = { Text("HTTPS webhook URL") },
                            supportingText = {
                                Text("Use your own n8n, Make, or custom endpoint")
                            },
                            singleLine = true,
                        )

                        OutlinedTextField(
                            value = settings.bearerToken,
                            onValueChange = { settings = settings.copy(bearerToken = it) },
                            modifier = Modifier.fillMaxWidth(),
                            label = { Text("Bearer token (optional)") },
                            visualTransformation = PasswordVisualTransformation(),
                            singleLine = true,
                        )

                        SettingsNumberField(
                            label = "Start hour (0–23)",
                            value = settings.startHour,
                            range = 0..23,
                        ) { settings = settings.copy(startHour = it) }

                        SettingsNumberField(
                            label = "Cutoff hour (0–23)",
                            value = settings.cutoffHour,
                            range = 0..23,
                        ) { settings = settings.copy(cutoffHour = it) }

                        SettingsNumberField(
                            label = "Sleep confidence (50–100)",
                            value = settings.sleepConfidence,
                            range = 50..100,
                        ) { settings = settings.copy(sleepConfidence = it) }

                        SettingsNumberField(
                            label = "Confirmation minutes (0–60)",
                            value = settings.confirmationMinutes,
                            range = 0..60,
                        ) { settings = settings.copy(confirmationMinutes = it) }

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text("Only while charging")
                                Text(
                                    "Saves battery and avoids mobile overnight work",
                                    style = MaterialTheme.typography.bodySmall,
                                )
                            }
                            Switch(
                                checked = settings.requireCharging,
                                onCheckedChange = {
                                    settings = settings.copy(requireCharging = it)
                                },
                            )
                        }

                        Button(
                            modifier = Modifier.fillMaxWidth(),
                            onClick = {
                                val permissions = buildList {
                                    add(Manifest.permission.ACTIVITY_RECOGNITION)
                                    if (Build.VERSION.SDK_INT >= 33) {
                                        add(Manifest.permission.POST_NOTIFICATIONS)
                                    }
                                }.toTypedArray()
                                permissionLauncher.launch(permissions)
                            },
                        ) {
                            Text("Grant permissions")
                        }

                        Button(
                            modifier = Modifier.fillMaxWidth(),
                            onClick = {
                                preferences.saveSettings(settings)
                                val manager = SleepSubscriptionManager(this@MainActivity)
                                if (settings.enabled) {
                                    manager.subscribe {
                                        status = it.fold(
                                            onSuccess = { "Sleep detection is active" },
                                            onFailure = { error ->
                                                "Could not activate: ${error.message}"
                                            },
                                        )
                                    }
                                } else {
                                    manager.unsubscribe {
                                        status = "Sleep detection is off"
                                    }
                                }
                            },
                        ) {
                            Text("Save and activate")
                        }

                        Button(
                            modifier = Modifier.fillMaxWidth(),
                            onClick = {
                                preferences.saveSettings(settings)
                                WorkflowScheduler.enqueue(
                                    this@MainActivity,
                                    reason = "manual_test",
                                    force = true,
                                )
                                status = "Test queued. Reopen shortly to refresh the result."
                            },
                        ) {
                            Text("Test webhook now")
                        }

                        Text(status, color = MaterialTheme.colorScheme.primary)
                    }
                }

                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(
                        modifier = Modifier.padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                        ) {
                            Text("Morning result", fontWeight = FontWeight.SemiBold)
                            Button(onClick = {
                                note = preferences.loadMorningNote()
                                log = preferences.loadLog()
                            }) {
                                Text("Refresh")
                            }
                        }
                        Text(note?.title ?: "Nothing prepared yet")
                        Text(
                            note?.body
                                ?: "Your webhook can return {\"title\":\"...\",\"body\":\"...\"}.",
                        )
                    }
                }

                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(
                        modifier = Modifier.padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        Text("Recent activity", fontWeight = FontWeight.SemiBold)
                        Text(log.ifBlank { "No events yet." })
                    }
                }

                Spacer(Modifier.height(20.dp))
            }
        }
    }

    @Composable
    private fun SettingsNumberField(
        label: String,
        value: Int,
        range: IntRange,
        onValueChanged: (Int) -> Unit,
    ) {
        OutlinedTextField(
            value = value.toString(),
            onValueChange = { raw ->
                raw.toIntOrNull()?.coerceIn(range)?.let(onValueChanged)
            },
            modifier = Modifier.fillMaxWidth(),
            label = { Text(label) },
            singleLine = true,
        )
    }
}

