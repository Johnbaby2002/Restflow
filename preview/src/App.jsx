import { useEffect, useState } from "react";
import {
  Activity, ArrowRight, Building2, Check, ChevronRight, CircleAlert,
  Braces, Bug, Clock3, Copy, Download, Eye, FileText, History,
  LayoutDashboard, LockKeyhole, Palette, Play, Plus, RefreshCw, Search,
  Settings2, ShieldCheck, Trash2, Upload, Users, Webhook, Workflow, X,
} from "lucide-react";
import { api, timeAgo } from "./api";

const navItems = [
  ["portals", LayoutDashboard, "Portals"],
  ["builder", Settings2, "Builder"],
  ["runs", Activity, "Runs"],
  ["debug", Bug, "Debug"],
  ["approvals", ShieldCheck, "Approvals"],
];

const defaultForm = {
  portalName: "Acme Finance",
  workflowName: "Invoice review",
  webhook: "https://n8n.example.com/webhook/invoice-review",
  clientLabel: "Upload invoices for review",
  description: "Submit an invoice and receive structured checks, expense details, and approval status.",
  accent: "#ceff4f",
  inputMapping: [
    { id: "reference", label: "Invoice reference", type: "text", required: true, payloadPath: "invoice.reference", placeholder: "INV-2026-001" },
    { id: "fileName", label: "Invoice file", type: "file", required: true, payloadPath: "invoice.fileName", placeholder: "" },
  ],
  outputMapping: [
    { id: "summary", label: "Summary", responsePath: "result.summary", role: "summary" },
    { id: "detail", label: "Details", responsePath: "result.detail", role: "detail" },
    { id: "amount", label: "Amount", responsePath: "result.amount", role: "field" },
    { id: "approval", label: "Requires approval", responsePath: "result.requiresApproval", role: "approval" },
  ],
};

export default function App() {
  const [view, setView] = useState("portals");
  const [portals, setPortals] = useState([]);
  const [runs, setRuns] = useState([]);
  const [approvals, setApprovals] = useState([]);
  const [form, setForm] = useState(defaultForm);
  const [selectedPortal, setSelectedPortal] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [debugRunId, setDebugRunId] = useState(null);
  const [debugDetail, setDebugDetail] = useState(null);
  const [debugLoading, setDebugLoading] = useState(false);

  async function refreshData() {
    const data = await api.bootstrap();
    setPortals(data.portals);
    setRuns(data.runs.map((run) => ({ ...run, time: timeAgo(run.createdAt) })));
    setApprovals(data.approvals);
    setSelectedPortal((current) =>
      data.portals.find((portal) => portal.id === current?.id) || data.portals[0] || null);
  }

  useEffect(() => {
    refreshData()
      .catch((error) => setLoadError(error.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(""), 2200);
    return () => clearTimeout(timer);
  }, [toast]);

  function updateForm(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function publishPortal() {
    try {
      const portal = await api.savePortal(form);
      await refreshData();
      setSelectedPortal(portal);
      setToast("Client portal published");
      setPreviewOpen(true);
    } catch (error) {
      setToast(error.message);
    }
  }

  async function resolveApproval(id, outcome) {
    try {
      const item = approvals.find((approval) => approval.id === id);
      await api.resolveApproval(id, outcome);
      await refreshData();
      setToast(`${item.title} ${outcome}`);
    } catch (error) {
      setToast(error.message);
    }
  }

  async function openDebugger(runId) {
    setView("debug");
    setDebugRunId(runId);
    setDebugLoading(true);
    try {
      setDebugDetail(await api.getRunDebug(runId));
    } catch (error) {
      setToast(error.message);
    } finally {
      setDebugLoading(false);
    }
  }

  if (loading) {
    return <div className="app-loading"><RefreshCw size={25} /> Loading FlowPortal…</div>;
  }
  if (loadError) {
    return <div className="app-loading error"><CircleAlert size={25} /> Backend unavailable: {loadError}</div>;
  }

  return (
    <div className="app-shell">
      <Sidebar view={view} setView={setView} approvalCount={approvals.length} />
      <main className="workspace">
        <Header view={view} onPreview={() => setPreviewOpen(true)} onNew={() => setView("builder")} />
        {view === "portals" && (
          <PortalsView
            portals={portals}
            selectedPortal={selectedPortal}
            setSelectedPortal={setSelectedPortal}
            edit={(portal) => {
              setSelectedPortal(portal);
              setForm({
                portalName: portal.name,
                workflowName: portal.workflow,
                webhook: portal.webhook,
                clientLabel: portal.clientLabel,
                description: portal.description,
                accent: portal.color,
                inputMapping: portal.inputMapping,
                outputMapping: portal.outputMapping,
              });
              setView("builder");
            }}
            preview={(portal) => {
              setSelectedPortal(portal);
              setPreviewOpen(true);
            }}
            create={() => setView("builder")}
          />
        )}
        {view === "builder" && (
          <BuilderView form={form} updateForm={updateForm} publish={publishPortal} preview={() => setPreviewOpen(true)} />
        )}
        {view === "runs" && (
          <RunsView
            runs={runs}
            debug={openDebugger}
            retry={async (run) => {
              try {
                await api.retryRun(run.id);
                await refreshData();
                setToast(`${run.id} completed`);
              } catch (error) {
                setToast(error.message);
              }
            }}
          />
        )}
        {view === "debug" && (
          <DebuggerView
            runs={runs}
            selectedId={debugRunId}
            detail={debugDetail}
            loading={debugLoading}
            select={openDebugger}
            replay={async (runId) => {
              try {
                await api.retryRun(runId);
                await refreshData();
                setDebugDetail(await api.getRunDebug(runId));
                setToast(`${runId} replayed`);
              } catch (error) {
                setToast(error.message);
              }
            }}
            notify={setToast}
          />
        )}
        {view === "approvals" && (
          <ApprovalsView
            approvals={approvals}
            approve={(id) => resolveApproval(id, "approved")}
            reject={(id) => resolveApproval(id, "rejected")}
          />
        )}
      </main>
      <MobileNav view={view} setView={setView} approvalCount={approvals.length} />
      {previewOpen && (
        <ClientPortal
          config={view === "builder" ? form : selectedPortal ? {
            portalName: selectedPortal.name,
            workflowName: selectedPortal.workflow,
            webhook: selectedPortal.webhook,
            clientLabel: selectedPortal.clientLabel,
            description: selectedPortal.description,
            accent: selectedPortal.color,
            inputMapping: selectedPortal.inputMapping,
            outputMapping: selectedPortal.outputMapping,
          } : form}
          portal={selectedPortal}
          runs={runs.filter((run) => run.portal === (selectedPortal?.name || form.portalName))}
          close={() => setPreviewOpen(false)}
          submit={async (input) => {
            const targetPortal = selectedPortal || portals[0];
            if (!targetPortal) throw new Error("No portal is selected");
            const result = await api.runPortal(targetPortal.id, input);
            await refreshData();
            setToast("Workflow completed");
            return result;
          }}
        />
      )}
      <div className={`toast ${toast ? "show" : ""}`}>{toast}</div>
    </div>
  );
}

function Sidebar({ view, setView, approvalCount }) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">FP</div>
        <div><strong>FlowPortal</strong><span>AGENCY CONSOLE</span></div>
      </div>
      <Nav className="desktop-nav" view={view} setView={setView} approvalCount={approvalCount} />
      <div className="instance-card">
        <span className="eyebrow">N8N CONNECTION</span>
        <strong>agency-production</strong>
        <div><i /> 12 workflows online</div>
      </div>
    </aside>
  );
}

function MobileNav(props) {
  return <Nav {...props} className="mobile-nav" />;
}

function Nav({ className, view, setView, approvalCount }) {
  return (
    <nav className={className} aria-label="Primary">
      {navItems.map(([id, Icon, label]) => (
        <button key={id} className={view === id ? "active" : ""} onClick={() => setView(id)}>
          <Icon size={18} /><span>{label}</span>
          {id === "approvals" && approvalCount > 0 && <b>{approvalCount}</b>}
        </button>
      ))}
    </nav>
  );
}

function Header({ view, onPreview, onNew }) {
  return (
    <header className="topbar">
      <div><span className="eyebrow">N8N CLIENT DELIVERY PLATFORM</span><h1>{navItems.find(([id]) => id === view)?.[2]}</h1></div>
      <div className="topbar-actions">
        <button className="secondary-button" onClick={onPreview}><Eye size={16} /> Client view</button>
        <button className="primary-button" onClick={onNew}><Plus size={17} /> New portal</button>
      </div>
    </header>
  );
}

function PortalsView({ portals, selectedPortal, setSelectedPortal, edit, preview, create }) {
  const totalRuns = portals.reduce((sum, portal) => sum + portal.runs, 0);
  const totalClients = portals.reduce((sum, portal) => sum + portal.clients, 0);
  return (
    <section className="view">
      <div className="metrics-grid">
        <Metric icon={LayoutDashboard} label="Client portals" value={portals.length} />
        <Metric icon={Users} label="Client users" value={totalClients} tone="green" />
        <Metric icon={Play} label="Workflow runs" value={totalRuns} />
        <Metric icon={CircleAlert} label="Awaiting approval" value="2" tone="amber" />
      </div>
      <div className="portal-layout">
        <div className="panel">
          <div className="panel-header">
            <div><span className="eyebrow">YOUR DELIVERY LAYER</span><h2>Client portals</h2></div>
            <button className="icon-button" aria-label="Create portal" onClick={create}><Plus size={18} /></button>
          </div>
          <div className="portal-list">
            {portals.map((portal) => (
              <button
                key={portal.id}
                className={`portal-row ${selectedPortal?.id === portal.id ? "active" : ""}`}
                onClick={() => setSelectedPortal(portal)}
              >
                <span className="portal-logo" style={{ "--portal-color": portal.color }}>{portal.name.slice(0, 2).toUpperCase()}</span>
                <span><strong>{portal.name}</strong><small>{portal.workflow}</small></span>
                <Status status={portal.status} />
                <ChevronRight size={18} />
              </button>
            ))}
          </div>
        </div>
        {selectedPortal && <div className="panel portal-detail">
          <div className="portal-banner" style={{ "--portal-color": selectedPortal.color }}>
            <span className="eyebrow">CLIENT PORTAL</span>
            <h2>{selectedPortal.name}</h2>
            <p>{selectedPortal.workflow}</p>
          </div>
          <div className="portal-stats">
            <div><strong>{selectedPortal.clients}</strong><span>Client users</span></div>
            <div><strong>{selectedPortal.runs}</strong><span>Total runs</span></div>
            <div><strong>98.4%</strong><span>Success rate</span></div>
          </div>
          <div className="portal-actions">
            <button className="secondary-button" onClick={() => edit(selectedPortal)}><Settings2 size={15} /> Edit portal</button>
            <button className="primary-button" onClick={() => preview(selectedPortal)}><Eye size={15} /> Open client view</button>
          </div>
        </div>}
      </div>
    </section>
  );
}

function BuilderView({ form, updateForm, publish, preview }) {
  const [sampleResponse, setSampleResponse] = useState(`{
  "result": {
    "summary": "Invoice reviewed",
    "detail": "No duplicate payment found",
    "amount": "€348",
    "requiresApproval": false
  }
}`);
  const [mappingTest, setMappingTest] = useState(null);
  const updateInput = (index, key, value) => {
    const next = form.inputMapping.map((item, itemIndex) =>
      itemIndex === index ? { ...item, [key]: value } : item);
    updateForm("inputMapping", next);
  };
  const updateOutput = (index, key, value) => {
    const next = form.outputMapping.map((item, itemIndex) =>
      itemIndex === index ? { ...item, [key]: value } : item);
    updateForm("outputMapping", next);
  };
  const addInput = () => updateForm("inputMapping", [
    ...form.inputMapping,
    { id: `field_${Date.now()}`, label: "New field", type: "text", required: false, payloadPath: "input.newField", placeholder: "" },
  ]);
  const addOutput = () => updateForm("outputMapping", [
    ...form.outputMapping,
    { id: `output_${Date.now()}`, label: "Result field", responsePath: "result.value", role: "field" },
  ]);
  const testMapping = () => {
    try {
      const data = JSON.parse(sampleResponse);
      setMappingTest({
        ok: true,
        values: form.outputMapping.map((item) => ({
          label: item.label,
          value: getObjectPath(data, item.responsePath),
          role: item.role,
        })),
      });
    } catch (error) {
      setMappingTest({ ok: false, error: error.message });
    }
  };

  return (
    <section className="view builder-layout">
      <div className="panel builder-settings">
        <div className="panel-header"><div><span className="eyebrow">PORTAL BUILDER</span><h2>Connect and customize</h2></div></div>
        <div className="form-section">
          <SectionTitle icon={Building2} title="Portal identity" />
          <label>Portal name<input value={form.portalName} onChange={(event) => updateForm("portalName", event.target.value)} /></label>
          <label>Client instruction<input value={form.clientLabel} onChange={(event) => updateForm("clientLabel", event.target.value)} /></label>
          <label>Description<textarea value={form.description} onChange={(event) => updateForm("description", event.target.value)} /></label>
        </div>
        <div className="form-section">
          <SectionTitle icon={Workflow} title="n8n workflow" />
          <label>Workflow name<input value={form.workflowName} onChange={(event) => updateForm("workflowName", event.target.value)} /></label>
          <label>Production webhook<input value={form.webhook} onChange={(event) => updateForm("webhook", event.target.value)} /></label>
        </div>
        <div className="form-section mapping-section">
          <div className="mapping-title">
            <SectionTitle icon={Braces} title="Portal inputs → n8n payload" />
            <button onClick={addInput}><Plus size={14} /> Add field</button>
          </div>
          <p className="mapping-help">Each client field is written to the JSON path you choose.</p>
          {form.inputMapping.map((field, index) => (
            <div className="mapping-row input-map" key={field.id}>
              <input aria-label={`Input label ${index + 1}`} value={field.label} onChange={(event) => updateInput(index, "label", event.target.value)} placeholder="Field label" />
              <select aria-label={`Input type ${index + 1}`} value={field.type} onChange={(event) => updateInput(index, "type", event.target.value)}>
                <option value="text">Text</option>
                <option value="email">Email</option>
                <option value="number">Number</option>
                <option value="textarea">Long text</option>
                <option value="file">File</option>
              </select>
              <span className="mapping-arrow">→</span>
              <input aria-label={`Payload path ${index + 1}`} value={field.payloadPath} onChange={(event) => updateInput(index, "payloadPath", event.target.value)} placeholder="customer.email" />
              <label className="required-toggle"><input type="checkbox" checked={field.required} onChange={(event) => updateInput(index, "required", event.target.checked)} /> Required</label>
              <button className="remove-map" aria-label={`Remove ${field.label}`} onClick={() => updateForm("inputMapping", form.inputMapping.filter((_, itemIndex) => itemIndex !== index))}><X size={14} /></button>
            </div>
          ))}
        </div>
        <div className="form-section mapping-section">
          <div className="mapping-title">
            <SectionTitle icon={Braces} title="n8n response → portal results" />
            <button onClick={addOutput}><Plus size={14} /> Add result</button>
          </div>
          <p className="mapping-help">Read values from the n8n JSON response and choose how they appear.</p>
          {form.outputMapping.map((field, index) => (
            <div className="mapping-row output-map" key={field.id}>
              <input aria-label={`Output label ${index + 1}`} value={field.label} onChange={(event) => updateOutput(index, "label", event.target.value)} placeholder="Result label" />
              <span className="mapping-arrow">←</span>
              <input aria-label={`Response path ${index + 1}`} value={field.responsePath} onChange={(event) => updateOutput(index, "responsePath", event.target.value)} placeholder="result.amount" />
              <select aria-label={`Output role ${index + 1}`} value={field.role} onChange={(event) => updateOutput(index, "role", event.target.value)}>
                <option value="field">Result field</option>
                <option value="summary">Headline</option>
                <option value="detail">Description</option>
                <option value="approval">Approval flag</option>
              </select>
              <button className="remove-map" aria-label={`Remove ${field.label}`} onClick={() => updateForm("outputMapping", form.outputMapping.filter((_, itemIndex) => itemIndex !== index))}><X size={14} /></button>
            </div>
          ))}
          <div className="mapping-preview">
            <div><span>Outgoing payload</span><pre>{JSON.stringify(buildMappingPreview(form.inputMapping), null, 2)}</pre></div>
            <div><span>Expected response paths</span><pre>{form.outputMapping.map((item) => `${item.label}: ${item.responsePath}`).join("\n")}</pre></div>
          </div>
          <div className="mapping-tester">
            <div className="mapping-title">
              <SectionTitle icon={Play} title="Test with sample n8n response" />
              <button onClick={testMapping}><Play size={13} /> Test mapping</button>
            </div>
            <textarea aria-label="Sample n8n response" value={sampleResponse} onChange={(event) => setSampleResponse(event.target.value)} />
            {mappingTest && (
              <div className={`mapping-test-result ${mappingTest.ok ? "ok" : "error"}`}>
                {mappingTest.ok
                  ? mappingTest.values.map((item) => <span key={`${item.label}-${item.role}`}><b>{item.label}</b>{item.value === undefined ? "Path not found" : String(item.value)}</span>)
                  : <span>{mappingTest.error}</span>}
              </div>
            )}
          </div>
        </div>
        <div className="form-section">
          <SectionTitle icon={Palette} title="Brand color" />
          <div className="color-row">
            {["#ceff4f", "#eda942", "#65d8ff", "#ff6f91"].map((color) => (
              <button key={color} aria-label={`Use ${color}`} className={form.accent === color ? "selected" : ""} style={{ background: color }} onClick={() => updateForm("accent", color)} />
            ))}
          </div>
        </div>
        <div className="builder-buttons">
          <button className="secondary-button" onClick={preview}><Eye size={15} /> Preview</button>
          <button className="primary-button" onClick={publish}><ArrowRight size={15} /> Publish portal</button>
        </div>
      </div>
      <PortalMockup form={form} />
    </section>
  );
}

function buildMappingPreview(mapping) {
  const payload = {};
  mapping.forEach((field) => {
    const value = field.type === "number" ? 42 : field.type === "file" ? "document.pdf" : `<${field.id}>`;
    setObjectPath(payload, field.payloadPath, value);
  });
  return payload;
}

function setObjectPath(target, path, value) {
  const parts = String(path || "").split(".").filter(Boolean);
  let cursor = target;
  parts.forEach((part, index) => {
    if (index === parts.length - 1) cursor[part] = value;
    else cursor = cursor[part] ??= {};
  });
}

function getObjectPath(target, path) {
  return String(path || "").split(".").filter(Boolean).reduce((value, key) => value?.[key], target);
}

function PortalMockup({ form }) {
  return (
    <div className="device-preview">
      <div className="browser-bar"><i /><i /><i /><span>{form.portalName.toLowerCase().replaceAll(" ", "-")}.flowportal.app</span></div>
      <div className="client-page" style={{ "--client-accent": form.accent }}>
        <div className="client-brand"><span>{form.portalName.slice(0, 2).toUpperCase()}</span><strong>{form.portalName}</strong></div>
        <div className="client-hero"><small>WORKFLOW PORTAL</small><h2>{form.clientLabel}</h2><p>{form.description}</p></div>
        <div className="client-form-card">
          {(form.inputMapping ?? []).slice(0, 3).map((field) => (
            <label key={field.id}>{field.label}
              {field.type === "file"
                ? <div className="upload-box"><Upload size={22} /><span>Drop file or click to browse</span></div>
                : <input placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`} readOnly />}
            </label>
          ))}
          <button style={{ background: form.accent }}>Run {form.workflowName}</button>
        </div>
      </div>
    </div>
  );
}

function RunsView({ runs, retry, debug }) {
  return (
    <section className="view">
      <div className="panel">
        <div className="panel-header">
          <div><span className="eyebrow">CLIENT EXECUTIONS</span><h2>Workflow runs</h2></div>
          <button className="icon-button" aria-label="Refresh runs"><RefreshCw size={17} /></button>
        </div>
        <div className="runs-table">
          {runs.map((run) => (
            <article className="run-row" key={run.id}>
              <span className={`run-state ${run.status}`}>{run.status === "complete" ? <Check size={16} /> : run.status === "failed" ? <X size={16} /> : <CircleAlert size={16} />}</span>
              <div><strong>{run.action}</strong><small>{run.portal} · {run.client}</small></div>
              <div className="run-result"><strong>{run.result}</strong><small>{run.id} · {run.time}</small></div>
              <div className="run-actions">
                <button className="debug-button" onClick={() => debug(run.id)}><Bug size={14} /> Debug</button>
                {run.status === "failed" ? <button className="secondary-button" onClick={() => retry(run)}>Retry</button> : <Status status={run.status} />}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function DebuggerView({ runs, selectedId, detail, loading, select, replay, notify }) {
  const [payloadTab, setPayloadTab] = useState("request");

  useEffect(() => {
    if (!selectedId && runs[0]) select(runs[0].id);
  }, [selectedId, runs]);

  return (
    <section className="view debugger-layout">
      <div className="panel debug-run-list">
        <div className="panel-header compact">
          <div><span className="eyebrow">EXECUTIONS</span><h2>Debug runs</h2></div>
          <Bug size={18} />
        </div>
        {runs.map((run) => (
          <button key={run.id} className={`debug-run-item ${selectedId === run.id ? "active" : ""}`} onClick={() => select(run.id)}>
            <span className={`debug-run-dot ${run.status}`} />
            <span><strong>{run.action}</strong><small>{run.id} · {run.portal}</small></span>
            <Status status={run.status} />
          </button>
        ))}
      </div>

      <div className="panel debug-detail">
        {loading && <div className="debug-empty"><RefreshCw className="spin" size={24} /> Loading execution…</div>}
        {!loading && !detail && <div className="debug-empty"><Bug size={28} /> Select a run to inspect it.</div>}
        {!loading && detail && (
          <>
            <div className="panel-header debug-header">
              <div>
                <span className="eyebrow">{detail.id} · {detail.portal}</span>
                <h2>{detail.workflow}</h2>
              </div>
              <div className="debug-toolbar">
                <button className="secondary-button" onClick={() => notify("Debug bundle copied")}><Copy size={15} /> Copy bundle</button>
                <button className="primary-button" onClick={() => replay(detail.id)}><Play size={15} /> Replay run</button>
              </div>
            </div>

            <div className={`diagnosis-card ${detail.status}`}>
              {detail.status === "failed" ? <CircleAlert size={20} /> : detail.status === "approval" ? <Clock3 size={20} /> : <Check size={20} />}
              <div><strong>{detail.status === "failed" ? "Failure diagnosed" : detail.status === "approval" ? "Paused intentionally" : "Execution healthy"}</strong><span>{detail.diagnosis}</span></div>
            </div>

            <div className="debug-meta">
              <div><Webhook size={16} /><span>Webhook</span><strong>{detail.webhook}</strong></div>
              <div><Activity size={16} /><span>Status</span><strong>{detail.status}</strong></div>
              <div><Clock3 size={16} /><span>Started</span><strong>{timeAgo(detail.createdAt)}</strong></div>
            </div>

            <div className="execution-timeline">
              <div className="debug-section-title"><span>Execution timeline</span><small>{detail.steps.length} steps</small></div>
              {detail.steps.map((step, index) => (
                <div className={`execution-step ${step.status}`} key={step.name}>
                  <span className="step-index">{String(index + 1).padStart(2, "0")}</span>
                  <span className="step-icon">{step.status === "success" ? <Check size={14} /> : step.status === "failed" ? <X size={14} /> : step.status === "waiting" ? <Clock3 size={14} /> : <span>—</span>}</span>
                  <div><strong>{step.name}</strong>{step.message && <p>{step.message}</p>}</div>
                  <time>{step.duration}</time>
                </div>
              ))}
            </div>

            <div className="payload-inspector">
              <div className="payload-tabs">
                <button className={payloadTab === "request" ? "active" : ""} onClick={() => setPayloadTab("request")}><Braces size={15} /> Request</button>
                <button className={payloadTab === "response" ? "active" : ""} onClick={() => setPayloadTab("response")}><Braces size={15} /> Response</button>
                <button className="copy-payload" onClick={() => notify(`${payloadTab} payload copied`)}><Copy size={14} /> Copy JSON</button>
              </div>
              <pre>{JSON.stringify(payloadTab === "request" ? detail.request : detail.response, null, 2)}</pre>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function ApprovalsView({ approvals, approve, reject }) {
  return (
    <section className="view">
      <div className="approval-heading">
        <div><span className="eyebrow">HUMAN REVIEW</span><h2>Client workflow approvals</h2><p>Review sensitive actions before n8n continues.</p></div>
        <strong>{approvals.length}</strong>
      </div>
      <div className="approval-grid">
        {approvals.map((approval) => (
          <article className="approval-card" key={approval.id}>
            <div className="approval-topline"><span>{approval.portal}</span><span>{approval.client}</span></div>
            <h3>{approval.title}</h3>
            {approval.amount && <div className="approval-amount">{approval.amount}</div>}
            <p>{approval.detail}</p>
            <div className="approval-actions">
              <button className="danger-button" onClick={() => reject(approval.id)}><X size={16} /> Reject</button>
              <button className="primary-button" onClick={() => approve(approval.id)}><Check size={16} /> Approve</button>
            </div>
          </article>
        ))}
        {!approvals.length && <EmptyState />}
      </div>
    </section>
  );
}

function ClientPortal({ config, portal, runs, close, submit }) {
  const [values, setValues] = useState({});
  const [state, setState] = useState("form");
  const [section, setSection] = useState("submit");
  const [workflowResult, setWorkflowResult] = useState(null);
  const [submitError, setSubmitError] = useState("");

  async function runWorkflow() {
    setSubmitError("");
    setState("running");
    try {
      const response = await submit({
        client: "Demo Client",
        inputs: values,
      });
      setState("result");
      setWorkflowResult(response.workflowResult);
    } catch (error) {
      setState("form");
      setSubmitError(error.message);
    }
  }

  const inputMapping = config.inputMapping?.length ? config.inputMapping : defaultForm.inputMapping;
  const requiredComplete = inputMapping
    .filter((field) => field.required)
    .every((field) => String(values[field.id] ?? "").trim());
  const referenceValue = values.reference ?? Object.values(values).find((value) => typeof value === "string") ?? "";
  const fileValue = values.fileName ?? Object.entries(values).find(([key]) => key.toLowerCase().includes("file"))?.[1] ?? "";
  const updateValue = (id, value) => setValues((current) => ({ ...current, [id]: value }));

  return (
    <div className="client-overlay">
      <div className="live-client-page" style={{ "--client-accent": config.accent || portal?.color || "#ceff4f" }}>
        <div className="live-client-nav">
          <div className="client-brand"><span>{(config.portalName || portal?.name || "FP").slice(0, 2).toUpperCase()}</span><strong>{config.portalName || portal?.name || "FlowPortal"}</strong></div>
          <div className="client-nav-actions">
            <span className="secure-label"><LockKeyhole size={13} /> Secure portal</span>
            <button className="client-user" aria-label="Client account">MC</button>
            <button className="client-exit" onClick={close} aria-label="Exit client view"><X size={17} /></button>
          </div>
        </div>

        <div className="client-workspace">
          <aside className="client-sidebar">
            <div>
              <small>WORKSPACE</small>
              <button className={section === "submit" ? "active" : ""} onClick={() => setSection("submit")}>
                <Upload size={17} /> New submission
              </button>
              <button className={section === "history" ? "active" : ""} onClick={() => setSection("history")}>
                <History size={17} /> Run history <b>{runs.length}</b>
              </button>
            </div>
            <div className="client-help">
              <ShieldCheck size={18} />
              <strong>Your data is protected</strong>
              <span>Files are sent only to your connected workflow.</span>
            </div>
          </aside>

          <main className="client-main">
          {section === "submit" && state !== "result" && (
            <>
              <div className="client-hero">
                <small>NEW WORKFLOW SUBMISSION</small>
                <h1>{config.clientLabel}</h1>
                <p>{config.description}</p>
                <div className="client-expectations">
                  <span><Clock3 size={15} /> Usually completes in under 2 minutes</span>
                  <span><ShieldCheck size={15} /> Human approval before sensitive actions</span>
                </div>
              </div>
              <div className="live-form-card">
                <div className="form-heading">
                  <div><span>01</span><strong>Submission details</strong></div>
                  <small>All fields marked required</small>
                </div>
                {inputMapping.map((field) => (
                  <label key={field.id}>{field.label} {field.required && <em>Required</em>}
                    {field.type === "file" ? (
                      <button className={`upload-box ${values[field.id] ? "has-file" : ""}`} onClick={() => updateValue(field.id, `${field.id}-upload.pdf`)}>
                        {values[field.id] ? (
                          <>
                            <span className="file-icon"><FileText size={23} /></span>
                            <span className="file-copy"><strong>{values[field.id]}</strong><small>PDF · 284 KB · Ready to submit</small></span>
                            <span className="remove-file" onClick={(event) => { event.stopPropagation(); updateValue(field.id, ""); }}><Trash2 size={16} /></span>
                          </>
                        ) : (
                          <>
                            <span className="file-icon"><Upload size={23} /></span>
                            <span className="file-copy"><strong>Choose a file or drop it here</strong><small>Maximum file size: 10 MB</small></span>
                          </>
                        )}
                      </button>
                    ) : field.type === "textarea" ? (
                      <textarea value={values[field.id] ?? ""} onChange={(event) => updateValue(field.id, event.target.value)} placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`} />
                    ) : (
                      <input type={field.type} value={values[field.id] ?? ""} onChange={(event) => updateValue(field.id, field.type === "number" ? Number(event.target.value) : event.target.value)} placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`} />
                    )}
                  </label>
                ))}
                {state === "running" ? (
                  <div className="workflow-progress">
                    <div className="progress-top"><span>Processing your submission</span><strong>68%</strong></div>
                    <div className="progress-track"><i /></div>
                    <div className="progress-steps">
                      <span className="done"><Check size={13} /> File received</span>
                      <span className="done"><Check size={13} /> Data extracted</span>
                      <span className="active"><RefreshCw size={13} /> Running checks</span>
                    </div>
                  </div>
                ) : (
                  <button className="client-run-button" disabled={!requiredComplete} onClick={runWorkflow}>
                    Run {config.workflowName} <ArrowRight size={17} />
                  </button>
                )}
                <div className="submit-footnote">
                  <LockKeyhole size={13} /> Your submission is encrypted in transit.
                </div>
                {submitError && <p className="client-error">{submitError}</p>}
              </div>
            </>
          )}

          {section === "submit" && state === "result" && (
            <div className="client-result-page">
              <button className="result-back" onClick={() => {
                setState("form");
                setWorkflowResult(null);
              }}><ArrowRight size={15} /> Back to submission</button>
              <div className="client-result">
                <div className="result-header">
                  <span className={workflowResult?.status === "approval" ? "result-alert" : "result-success"}>
                    {workflowResult?.status === "approval" ? <CircleAlert size={25} /> : <Check size={25} />}
                  </span>
                  <div><small>WORKFLOW COMPLETE</small><h1>{workflowResult?.status === "approval" ? "Review required" : "Completed successfully"}</h1></div>
                </div>
                <p className="result-summary">{workflowResult?.detail || workflowResult?.summary || "The workflow completed successfully."}</p>
                <div className="result-grid">
                  <div><span>Status</span><strong>{workflowResult?.status || "complete"}</strong></div>
                  {workflowResult?.amount && <div><span>Amount</span><strong>{workflowResult.amount}</strong></div>}
                  {(workflowResult?.fields ?? []).map((field) => (
                    <div key={field.id}><span>{field.label}</span><strong>{String(field.value)}</strong></div>
                  ))}
                  <div><span>Reference</span><strong>{referenceValue || "—"}</strong></div>
                  {fileValue && <div><span>File</span><strong>{fileValue}</strong></div>}
                </div>
                {workflowResult?.status === "approval" && (
                  <div className="next-step"><ShieldCheck size={20} /><div><strong>What happens next?</strong><span>Your agency has been notified. The workflow will continue after approval.</span></div></div>
                )}
                <div className="result-actions">
                  <button className="client-secondary"><Download size={16} /> Download report</button>
                  <button onClick={() => {
                    setState("form");
                    setWorkflowResult(null);
                    setValues({});
                  }}>Submit another invoice</button>
                </div>
              </div>
            </div>
          )}

          {section === "history" && (
            <div className="client-history">
              <div className="history-heading"><div><small>WORKFLOW ACTIVITY</small><h1>Run history</h1><p>Track every submission and its current status.</p></div><button onClick={() => setSection("submit")}><Plus size={16} /> New submission</button></div>
              <div className="history-card">
                {runs.map((run) => (
                  <article className="client-run-row" key={run.id}>
                    <span className={`client-run-icon ${run.status}`}>{run.status === "complete" ? <Check size={16} /> : run.status === "failed" ? <X size={16} /> : <Clock3 size={16} />}</span>
                    <div><strong>{run.action}</strong><small>{run.reference || run.id} · {run.fileName || "Uploaded file"}</small></div>
                    <div><strong>{run.result}</strong><small>{run.time}</small></div>
                    <span className={`client-status ${run.status}`}>{run.status}</span>
                  </article>
                ))}
                {!runs.length && <div className="client-empty"><History size={25} /><strong>No submissions yet</strong><span>Your workflow history will appear here.</span></div>}
              </div>
            </div>
          )}
          </main>
        </div>
      </div>
    </div>
  );
}

function Metric({ icon: Icon, label, value, tone = "" }) {
  return <article className={`metric-card ${tone}`}><div><Icon size={18} /></div><strong>{value}</strong><span>{label}</span></article>;
}

function Status({ status }) {
  const labels = { live: "Live", draft: "Draft", complete: "Complete", approval: "Approval", rejected: "Rejected" };
  return <span className={`status-badge ${status}`}><i /> {labels[status] || status}</span>;
}

function SectionTitle({ icon: Icon, title }) {
  return <div className="section-title"><Icon size={17} /><strong>{title}</strong></div>;
}

function EmptyState() {
  return <div className="empty-state"><div><ShieldCheck size={25} /></div><h3>Approval queue clear</h3><p>Client actions waiting for review will appear here.</p></div>;
}
