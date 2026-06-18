# RestFlow

RestFlow is an Android app that runs a personal workflow when your phone detects that
you are likely asleep. The workflow can prepare useful information while you rest and
return a morning note when you wake up.

No smartwatch or additional hardware is required.

## Features

- Phone-based sleep and wake detection
- One workflow trigger per night
- Configurable start time, cutoff time, and sleep confidence
- Confirmation delay to reduce false triggers
- Optional charging requirement
- HTTPS webhook support for n8n, Make, and other services
- Optional Bearer-token authentication
- Morning note and estimated sleep duration
- Morning notification and recent activity log
- Automatic recovery after restarting the phone
- Manual webhook test

## User guide

For a ready-to-import connection, use the
[example n8n workflow](examples/n8n/restflow-morning-brief.json) and follow its
[connection guide](examples/n8n/README.md).

### 1. Grant permissions

Open RestFlow and select **Grant permissions**. Allow Physical Activity for sleep
detection and Notifications for the morning result.

### 2. Connect a workflow

Create an HTTPS `POST` webhook in n8n, Make, or another compatible service.

In RestFlow:

1. Paste the production URL into **HTTPS webhook URL**.
2. Add a Bearer token if your webhook requires one.
3. Select **Test webhook now**.
4. Select **Refresh** to view the returned result.

The webhook should return:

```json
{
  "title": "Good morning",
  "body": "Your first meeting is at 9:30. Finish the proposal before lunch."
}
```

Plain-text responses are also supported.

### 3. Configure sleep detection

Choose:

- **Start hour:** Earliest time sleep may be confirmed
- **Cutoff hour:** End of the overnight window
- **Sleep confidence:** Required confidence level
- **Confirmation minutes:** How long confidence must remain high
- **Only while charging:** Wait until the phone is connected to power

Suggested starting values:

```text
Start hour: 23
Cutoff hour: 5
Sleep confidence: 80
Confirmation minutes: 15
```

### 4. Activate RestFlow

Enable **Night workflow** and select **Save and activate**.

When sleep is confirmed, RestFlow calls the webhook once. When wake-up is detected,
it adds the estimated sleep duration and shows the morning note.

To stop sleep detection, disable **Night workflow** and save again.

## Workflow ideas

- Calendar and weather briefing
- Prioritized task list
- Email or meeting summary
- Organized daily notes
- Study summary or flashcards
- Draft content for morning review

## Troubleshooting

- Confirm that the webhook begins with `https://`.
- Use a production webhook URL rather than an inactive test URL.
- Check the Bearer token and internet connection.
- Allow Physical Activity and Notification permissions.
- If charging is required, leave the phone connected to power.
- Check **Recent activity** for errors.

RestFlow provides phone-based sleep estimates. It is a productivity tool, not a
medical device.
