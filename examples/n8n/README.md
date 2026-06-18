# Connect RestFlow to n8n

This example receives a RestFlow sleep event and returns a simple morning brief. It
does not require an AI model or another external service.

## Import and connect

1. In n8n, import `restflow-morning-brief.json` from this folder.
2. Open the **RestFlow Webhook** node.
3. Save and publish the workflow.
4. Copy its **Production URL**.
5. In RestFlow, paste the URL into **HTTPS webhook URL**.
6. Select **Test webhook now**.
7. Reopen RestFlow and select **Refresh**.

The result should be titled **RestFlow connection works**.

The production workflow must remain published. n8n test URLs work only temporarily
while the editor is listening for a test event.

## Optional authentication

To protect the webhook:

1. Open the **RestFlow Webhook** node in n8n.
2. Change Authentication from **None** to **Header Auth**.
3. Create a Header Auth credential with:

```text
Name: Authorization
Value: Bearer YOUR_PRIVATE_TOKEN
```

4. In RestFlow, enter only `YOUR_PRIVATE_TOKEN` in **Bearer token**.

RestFlow automatically adds the `Bearer ` prefix when sending the request.

## Customize the brief

Add nodes between **RestFlow Webhook** and **Build Morning Brief** to collect calendar,
task, weather, email, or note data. Update the Code node to include that data in its
final `title` and `body`.

Keep **Return Morning Note** as the final response node so RestFlow receives:

```json
{
  "title": "Good morning",
  "body": "Your prepared morning information"
}
```
