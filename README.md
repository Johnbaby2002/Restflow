# FlowPortal

FlowPortal turns n8n workflows into branded client-facing applications.

Automation freelancers and agencies can connect a production webhook, configure the
client inputs, apply branding, and publish a portal without building a new frontend
for every customer.

## Features

- Manage multiple client portals
- Connect portals to n8n production webhooks
- Customize portal name, instructions, description, and brand color
- Preview the generated client experience
- Submit forms and files from the client portal
- Display structured workflow results
- Track workflow runs and failures
- Review and approve sensitive actions
- Responsive agency and client interfaces

## Run the React frontend

```bash
cd preview
npm install
npm run dev
```

Open `http://localhost:8765`.

## Production build

```bash
cd preview
npm run build
```

The current frontend is an interactive MVP. Workflow calls, authentication, persistent
storage, file uploads, and multi-tenant permissions are represented in the interface
but still require backend implementation.
