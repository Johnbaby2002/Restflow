import { createServer } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  bootstrap, createApproval, createRun, getPortal, getRunDebug,
  resolveApproval, retryRun, savePortal,
} from "./repository.js";
import { executeWorkflow } from "./workflow.js";

const here = dirname(fileURLToPath(import.meta.url));
const distDir = join(here, "..", "dist");
const port = Number(process.env.PORT || 8766);

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host}`);
    if (url.pathname.startsWith("/api/")) {
      await handleApi(request, response, url);
      return;
    }
    serveStatic(response, url.pathname);
  } catch (error) {
    sendJson(response, 500, { error: error.message || "Internal server error" });
  }
});

async function handleApi(request, response, url) {
  if (request.method === "GET" && url.pathname === "/api/health") {
    return sendJson(response, 200, { status: "ok" });
  }
  if (request.method === "GET" && url.pathname === "/api/bootstrap") {
    return sendJson(response, 200, bootstrap());
  }
  if (request.method === "POST" && url.pathname === "/api/portals") {
    const body = await readJson(request);
    validatePortal(body);
    return sendJson(response, 201, savePortal(body));
  }

  const runMatch = url.pathname.match(/^\/api\/portals\/(\d+)\/runs$/);
  if (request.method === "POST" && runMatch) {
    const portal = getPortal(Number(runMatch[1]));
    if (!portal) return sendJson(response, 404, { error: "Portal not found" });
    const body = await readJson(request);
    const workflowResult = await executeWorkflow(portal, body);
    const runId = `RUN-${Date.now().toString().slice(-6)}`;
    const run = createRun({
      id: runId,
      portalId: portal.id,
      action: portal.workflow,
      client: body.client || "Portal client",
      reference: body.inputs?.reference || Object.values(body.inputs ?? {}).find((value) => typeof value === "string") || "",
      fileName: body.inputs?.fileName || Object.entries(body.inputs ?? {}).find(([key]) => key.toLowerCase().includes("file"))?.[1] || "",
      status: workflowResult.status,
      result: workflowResult.summary,
      request: workflowResult.requestPayload,
      response: workflowResult.raw,
    });
    if (workflowResult.status === "approval") {
      createApproval(runId, {
        title: `Approve ${portal.workflow.toLowerCase()} result`,
        client: body.client || "Portal client",
        amount: workflowResult.amount,
        detail: workflowResult.detail,
      });
    }
    return sendJson(response, 201, { run, workflowResult });
  }

  const retryMatch = url.pathname.match(/^\/api\/runs\/([^/]+)\/retry$/);
  if (request.method === "POST" && retryMatch) {
    const run = retryRun(retryMatch[1]);
    return run
      ? sendJson(response, 200, run)
      : sendJson(response, 404, { error: "Run not found" });
  }

  const debugMatch = url.pathname.match(/^\/api\/runs\/([^/]+)\/debug$/);
  if (request.method === "GET" && debugMatch) {
    const detail = getRunDebug(debugMatch[1]);
    return detail
      ? sendJson(response, 200, detail)
      : sendJson(response, 404, { error: "Run not found" });
  }

  const approvalMatch = url.pathname.match(/^\/api\/approvals\/(\d+)\/resolve$/);
  if (request.method === "POST" && approvalMatch) {
    const body = await readJson(request);
    if (!["approved", "rejected"].includes(body.outcome)) {
      return sendJson(response, 400, { error: "Outcome must be approved or rejected" });
    }
    const result = resolveApproval(Number(approvalMatch[1]), body.outcome);
    return result
      ? sendJson(response, 200, result)
      : sendJson(response, 404, { error: "Pending approval not found" });
  }

  sendJson(response, 404, { error: "Route not found" });
}

function validatePortal(body) {
  const required = ["portalName", "workflowName", "webhook", "clientLabel", "description", "accent"];
  for (const field of required) {
    if (!String(body[field] || "").trim()) throw new Error(`${field} is required`);
  }
  const webhook = new URL(body.webhook);
  if (webhook.protocol !== "https:") throw new Error("Webhook must use HTTPS");
}

async function readJson(request) {
  let body = "";
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 1_000_000) throw new Error("Request body is too large");
  }
  return body ? JSON.parse(body) : {};
}

function sendJson(response, status, payload) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(payload));
}

function serveStatic(response, pathname) {
  if (!existsSync(distDir)) {
    return sendJson(response, 503, { error: "Frontend is not built. Run npm run build." });
  }
  const requested = pathname === "/" ? "index.html" : pathname.slice(1);
  const safePath = normalize(requested).replace(/^(\.\.[/\\])+/, "");
  let filePath = join(distDir, safePath);
  if (!existsSync(filePath)) filePath = join(distDir, "index.html");
  response.writeHead(200, { "Content-Type": mimeTypes[extname(filePath)] || "application/octet-stream" });
  response.end(readFileSync(filePath));
}

server.listen(port, "0.0.0.0", () => {
  console.log(`FlowPortal API listening on http://0.0.0.0:${port}`);
});
