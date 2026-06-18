const PLACEHOLDER_HOSTS = new Set(["n8n.example.com", "example.com"]);

export async function executeWorkflow(portal, input) {
  const url = new URL(portal.webhook);
  if (url.protocol !== "https:") {
    throw new Error("Workflow webhook must use HTTPS");
  }

  const requestPayload = buildPayload(portal, input);
  if (PLACEHOLDER_HOSTS.has(url.hostname)) {
    return {
      ...normalizeResult(demoInvoiceResponse(input), portal.outputMapping),
      requestPayload,
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(requestPayload),
      signal: controller.signal,
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`n8n returned HTTP ${response.status}`);

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { result: text };
    }
    return {
      ...normalizeResult(data, portal.outputMapping),
      requestPayload,
    };
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeResult(data, mapping = []) {
  const mapped = mapping.map((item) => ({
    ...item,
    value: getPath(data, item.responsePath),
  }));
  const byRole = (role) => mapped.find((item) => item.role === role)?.value;
  const value = data.result ?? data;
  const requiresApproval = Boolean(byRole("approval") ?? value.requiresApproval ?? data.requiresApproval);

  return {
    status: requiresApproval ? "approval" : "complete",
    summary: byRole("summary") ?? value.summary ?? value.message ?? value.body ?? "Workflow completed successfully",
    amount: mapped.find((item) => item.id === "amount")?.value ?? value.amount ?? null,
    detail: byRole("detail") ?? value.detail ?? value.reason ?? "Review the workflow result before continuing.",
    fields: mapped.filter((item) => item.role === "field" && item.value !== undefined),
    raw: data,
  };
}

function demoInvoiceResponse(input) {
  const reference = input.inputs?.reference ?? input.reference ?? "INV-2026-001";
  return {
    result: {
      summary: "Invoice requires approval · €1,240",
      amount: "€1,240",
      detail: `Invoice ${reference} resembles a payment made 12 days ago.`,
      requiresApproval: true,
      vendor: "Acme Supplies GmbH",
      currency: "EUR",
      duplicateConfidence: 0.91,
    },
  };
}

function buildPayload(portal, input) {
  const payload = {};
  for (const field of portal.inputMapping ?? []) {
    setPath(payload, field.payloadPath, input.inputs?.[field.id]);
  }
  payload._flowportal = {
    event: "flowportal_submission",
    portalId: portal.id,
    portal: portal.name,
    workflow: portal.workflow,
    client: input.client,
  };
  return payload;
}

function setPath(target, path, value) {
  if (!path) return;
  const parts = path.split(".").filter(Boolean);
  let cursor = target;
  parts.forEach((part, index) => {
    if (index === parts.length - 1) cursor[part] = value;
    else cursor = cursor[part] ??= {};
  });
}

function getPath(target, path) {
  if (!path) return undefined;
  return path.split(".").filter(Boolean).reduce((value, key) => value?.[key], target);
}
