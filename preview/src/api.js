async function request(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || `Request failed with HTTP ${response.status}`);
  }
  return payload;
}

export const api = {
  bootstrap: () => request("/api/bootstrap"),
  savePortal: (portal) => request("/api/portals", {
    method: "POST",
    body: JSON.stringify(portal),
  }),
  runPortal: (portalId, input) => request(`/api/portals/${portalId}/runs`, {
    method: "POST",
    body: JSON.stringify(input),
  }),
  retryRun: (runId) => request(`/api/runs/${runId}/retry`, {
    method: "POST",
    body: "{}",
  }),
  getRunDebug: (runId) => request(`/api/runs/${runId}/debug`),
  resolveApproval: (approvalId, outcome) =>
    request(`/api/approvals/${approvalId}/resolve`, {
      method: "POST",
      body: JSON.stringify({ outcome }),
    }),
};

export function timeAgo(value) {
  if (!value) return "";
  const seconds = Math.max(0, Math.round((Date.now() - new Date(`${value}Z`).getTime()) / 1000));
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hr ago`;
  return `${Math.floor(seconds / 86400)} d ago`;
}
