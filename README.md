# FlowPortal

FlowPortal turns n8n workflows into branded client-facing applications.

Automation freelancers and agencies can connect a production webhook, configure the
client inputs, apply branding, and publish a portal without building a new frontend
for every customer.

## Features

- Manage multiple client portals
- Connect portals to n8n production webhooks
- Generate client fields and map them to nested n8n JSON payload paths
- Map arbitrary n8n response paths into portal headlines, details, fields, and approvals
- Test response mappings with sample JSON before publishing
- Customize portal name, instructions, description, and brand color
- Preview the generated client experience
- Submit forms and files from the client portal
- Display structured workflow results
- Track workflow runs and failures
- Inspect execution timelines and request/response payloads
- Diagnose failed webhook steps and replay runs
- Review and approve sensitive actions
- Responsive agency and client interfaces

## Run the React frontend

```bash
cd preview
npm install
npm run api
```

In another terminal:

```bash
cd preview
npm run dev
```

Open `http://localhost:8765`.

## Production build

```bash
cd preview
npm run build
npm start
```

The Node backend uses SQLite for local persistence and serves the built frontend.
By default it listens on `http://localhost:8766`.

## Backend API

- `GET /api/health`
- `GET /api/bootstrap`
- `POST /api/portals`
- `POST /api/portals/:id/runs`
- `POST /api/runs/:id/retry`
- `GET /api/runs/:id/debug`
- `POST /api/approvals/:id/resolve`

Portal configuration, workflow runs, and approvals are persisted in SQLite. Placeholder
`example.com` webhooks return a demo invoice result; other HTTPS webhook URLs are
called directly.

Authentication, multi-tenant authorization, real binary file storage, and production
deployment configuration remain to be implemented.
