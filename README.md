# RestFlow Android MVP

RestFlow turns likely sleep into a once-per-night workflow trigger. Sleep detection,
rules, execution history, and the returned morning note stay on the Android phone.
The app has no hosted backend and no developer-owned LLM key.

## Cost model

- The developer pays no per-user AI bill.
- Users connect an HTTPS webhook they own, such as n8n, Make, or a custom service.
- If their workflow uses an LLM, they provide and pay for that model connection.
- The app sends one small request after sleep is confirmed, not continuous telemetry.
- Failed requests stop after three attempts, using exponential backoff.
- Google Play services performs the low-power sleep classification on-device.

## MVP behavior

1. The user chooses a night window, confidence threshold, and confirmation delay.
2. Google Play services sends low-power sleep classification updates.
3. RestFlow confirms that confidence remained high inside the night window.
4. A WorkManager job calls the user's webhook once for that night.
5. If the response contains a morning note, RestFlow stores it locally.
6. When wake-up is inferred, RestFlow adds estimated sleep duration and shows the note.
7. Sleep detection is restored after device reboot or app replacement.

Expected webhook response:

```json
{
  "title": "Good morning",
  "body": "Your first meeting is at 09:30. Finish the proposal before lunch."
}
```

## Privacy and safety defaults

- Raw movement, brightness, and classification history are not uploaded.
- Only HTTPS endpoints are accepted.
- Tokens are never supplied by the developer.
- Workflows should prepare drafts and summaries, not send, publish, delete, or spend
  without morning confirmation.
- Phone-only sleep detection is an estimate, not a medical measurement.

## Build

The machine that generated this scaffold did not have Android Studio, an Android SDK,
or Gradle installed, so the project could not be compiled locally.

1. Install Android Studio and Android SDK 36.
2. Open this directory as a project.
3. Use JDK 17 for Gradle.
4. Let Android Studio sync dependencies.
5. Run on an Android 10+ phone with Google Play services.

## n8n setup

Create a workflow with:

1. A `Webhook` node using `POST`.
2. Optional Header/Bearer authentication matching the token entered in RestFlow.
3. Calendar, task, email, research, or note-processing nodes owned by the user.
4. A final response containing `title` and `body`.

Keep the production webhook secret and rate-limit it on the n8n side.
