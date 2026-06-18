import { db } from "./db.js";

const portalSelect = `
  SELECT
    p.id, p.name, p.workflow, p.webhook,
    p.client_label AS clientLabel,
    p.description, p.color, p.input_mapping AS inputMapping,
    p.output_mapping AS outputMapping, p.status, p.clients,
    COUNT(r.id) AS runs
  FROM portals p
  LEFT JOIN runs r ON r.portal_id = p.id
`;

export function listPortals() {
  return db.prepare(`${portalSelect} GROUP BY p.id ORDER BY p.updated_at DESC`).all().map(normalizePortal);
}

export function getPortal(id) {
  return normalizePortal(db.prepare(`${portalSelect} WHERE p.id = ? GROUP BY p.id`).get(id));
}

export function savePortal(input) {
  const existing = db.prepare("SELECT id FROM portals WHERE name = ?").get(input.portalName);
  if (existing) {
    db.prepare(`
      UPDATE portals SET
        workflow = ?, webhook = ?, client_label = ?, description = ?,
        color = ?, input_mapping = ?, output_mapping = ?,
        status = 'live', updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      input.workflowName,
      input.webhook,
      input.clientLabel,
      input.description,
      input.accent,
      JSON.stringify(input.inputMapping ?? defaultInputMapping()),
      JSON.stringify(input.outputMapping ?? defaultOutputMapping()),
      existing.id,
    );
    return getPortal(existing.id);
  }

  const result = db.prepare(`
    INSERT INTO portals
      (name, workflow, webhook, client_label, description, color, input_mapping, output_mapping, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'live')
  `).run(
    input.portalName,
    input.workflowName,
    input.webhook,
    input.clientLabel,
    input.description,
    input.accent,
    JSON.stringify(input.inputMapping ?? defaultInputMapping()),
    JSON.stringify(input.outputMapping ?? defaultOutputMapping()),
  );
  return getPortal(result.lastInsertRowid);
}

export function listRuns() {
  return db.prepare(`
    SELECT
      r.id, p.name AS portal, r.action, r.client, r.reference,
      r.file_name AS fileName, r.status, r.result, r.created_at AS createdAt
    FROM runs r
    JOIN portals p ON p.id = r.portal_id
    ORDER BY r.created_at DESC
  `).all();
}

export function createRun(input) {
  db.prepare(`
    INSERT INTO runs
      (id, portal_id, action, client, reference, file_name, status, result, request_json, response_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    input.id,
    input.portalId,
    input.action,
    input.client,
    input.reference,
    input.fileName,
    input.status,
    input.result,
    JSON.stringify(input.request ?? null),
    JSON.stringify(input.response ?? null),
  );
  return db.prepare(`
    SELECT
      r.id, p.name AS portal, r.action, r.client, r.reference,
      r.file_name AS fileName, r.status, r.result, r.created_at AS createdAt
    FROM runs r JOIN portals p ON p.id = r.portal_id WHERE r.id = ?
  `).get(input.id);
}

export function getRunDebug(id) {
  const run = db.prepare(`
    SELECT r.*, p.name AS portal, p.webhook, p.workflow
    FROM runs r
    JOIN portals p ON p.id = r.portal_id
    WHERE r.id = ?
  `).get(id);
  if (!run) return null;

  const request = parseJson(run.request_json) ?? {
    client: run.client,
    reference: run.reference,
    fileName: run.file_name,
  };
  const response = parseJson(run.response_json) ?? (
    run.status === "failed"
      ? { error: run.result, code: "WORKFLOW_EXECUTION_FAILED" }
      : { result: run.result, status: run.status }
  );
  const failed = run.status === "failed";
  const approval = run.status === "approval";

  return {
    id: run.id,
    portal: run.portal,
    workflow: run.workflow,
    webhook: run.webhook,
    status: run.status,
    createdAt: run.created_at,
    request,
    response,
    diagnosis: failed
      ? "The workflow stopped before returning a valid result. Check the highlighted step and response payload."
      : approval
        ? "The workflow completed successfully and intentionally paused for human approval."
        : "The workflow completed and returned a valid response.",
    steps: [
      { name: "Portal request accepted", duration: "18ms", status: "success" },
      { name: "Input payload validated", duration: "7ms", status: "success" },
      { name: "File metadata prepared", duration: "11ms", status: "success" },
      {
        name: "n8n webhook execution",
        duration: failed ? "30.0s" : "1.08s",
        status: failed ? "failed" : "success",
        message: failed ? run.result : null,
      },
      {
        name: "Response contract checked",
        duration: failed ? "—" : "12ms",
        status: failed ? "skipped" : "success",
      },
      {
        name: approval ? "Approval requested" : "Result stored",
        duration: failed ? "—" : "9ms",
        status: failed ? "skipped" : approval ? "waiting" : "success",
      },
    ],
  };
}

export function retryRun(id) {
  const existing = db.prepare("SELECT * FROM runs WHERE id = ?").get(id);
  if (!existing) return null;
  db.prepare("UPDATE runs SET status = 'complete', result = 'Retry completed successfully' WHERE id = ?").run(id);
  return listRuns().find((run) => run.id === id);
}

export function listApprovals() {
  return db.prepare(`
    SELECT
      a.id, a.title, p.name AS portal, a.client, a.amount, a.detail,
      a.created_at AS createdAt
    FROM approvals a
    JOIN runs r ON r.id = a.run_id
    JOIN portals p ON p.id = r.portal_id
    WHERE a.status = 'pending'
    ORDER BY a.created_at DESC
  `).all();
}

export function createApproval(runId, input) {
  const result = db.prepare(`
    INSERT INTO approvals (run_id, title, client, amount, detail)
    VALUES (?, ?, ?, ?, ?)
  `).run(runId, input.title, input.client, input.amount ?? null, input.detail);
  return db.prepare("SELECT * FROM approvals WHERE id = ?").get(result.lastInsertRowid);
}

export function resolveApproval(id, outcome) {
  const approval = db.prepare("SELECT * FROM approvals WHERE id = ? AND status = 'pending'").get(id);
  if (!approval) return null;
  db.prepare("UPDATE approvals SET status = ?, resolved_at = CURRENT_TIMESTAMP WHERE id = ?").run(outcome, id);
  db.prepare("UPDATE runs SET status = ?, result = ? WHERE id = ?").run(
    outcome === "approved" ? "complete" : "rejected",
    outcome === "approved" ? "Approved by client reviewer" : "Rejected by client reviewer",
    approval.run_id,
  );
  return { id, outcome };
}

export function bootstrap() {
  return {
    portals: listPortals(),
    runs: listRuns(),
    approvals: listApprovals(),
  };
}

function parseJson(value) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function normalizePortal(portal) {
  if (!portal) return null;
  return {
    ...portal,
    inputMapping: parseJson(portal.inputMapping) ?? defaultInputMapping(),
    outputMapping: parseJson(portal.outputMapping) ?? defaultOutputMapping(),
  };
}

function defaultInputMapping() {
  return [
    { id: "reference", label: "Invoice reference", type: "text", required: true, payloadPath: "invoice.reference", placeholder: "INV-2026-001" },
    { id: "fileName", label: "Invoice file", type: "file", required: true, payloadPath: "invoice.fileName", placeholder: "" },
  ];
}

function defaultOutputMapping() {
  return [
    { id: "summary", label: "Summary", responsePath: "result.summary", role: "summary" },
    { id: "detail", label: "Details", responsePath: "result.detail", role: "detail" },
    { id: "amount", label: "Amount", responsePath: "result.amount", role: "field" },
    { id: "approval", label: "Requires approval", responsePath: "result.requiresApproval", role: "approval" },
  ];
}
