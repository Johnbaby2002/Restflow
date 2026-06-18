import { useEffect, useState } from "react";
import {
  Activity, ArrowRight, Building2, Check, ChevronRight, CircleAlert,
  Eye, FileText, Image, LayoutDashboard, Link2, Palette, Play, Plus,
  RefreshCw, Search, Settings2, ShieldCheck, Upload, Users, Workflow, X,
} from "lucide-react";

const navItems = [
  ["portals", LayoutDashboard, "Portals"],
  ["builder", Settings2, "Builder"],
  ["runs", Activity, "Runs"],
  ["approvals", ShieldCheck, "Approvals"],
];

const initialPortals = [
  { id: 1, name: "Acme Finance", workflow: "Invoice review", clients: 8, runs: 142, color: "#ceff4f", status: "live" },
  { id: 2, name: "Northstar Legal", workflow: "Contract intake", clients: 4, runs: 57, color: "#eda942", status: "draft" },
];

const initialRuns = [
  { id: "RUN-1842", portal: "Acme Finance", action: "Invoice review", client: "Maya Chen", time: "2 min ago", status: "approval", result: "Possible duplicate payment · €1,240" },
  { id: "RUN-1841", portal: "Acme Finance", action: "Invoice review", client: "Jon Bell", time: "18 min ago", status: "complete", result: "Approved expense · €348" },
  { id: "RUN-1840", portal: "Northstar Legal", action: "Contract intake", client: "Sarah Kim", time: "1 hr ago", status: "failed", result: "Missing client reference" },
];

const initialApprovals = [
  { id: 1, title: "Approve possible duplicate invoice", portal: "Acme Finance", client: "Maya Chen", amount: "€1,240", detail: "Invoice INV-903 resembles payment INV-851 from 12 days ago." },
  { id: 2, title: "Send contract summary to client", portal: "Northstar Legal", client: "Sarah Kim", amount: null, detail: "The workflow prepared a 4-page contract summary and risk report." },
];

const defaultForm = {
  portalName: "Acme Finance",
  workflowName: "Invoice review",
  webhook: "https://n8n.example.com/webhook/invoice-review",
  clientLabel: "Upload invoices for review",
  description: "Submit an invoice and receive structured checks, expense details, and approval status.",
  accent: "#ceff4f",
};

export default function App() {
  const [view, setView] = useState("portals");
  const [portals, setPortals] = useState(initialPortals);
  const [runs, setRuns] = useState(initialRuns);
  const [approvals, setApprovals] = useState(initialApprovals);
  const [form, setForm] = useState(defaultForm);
  const [selectedPortal, setSelectedPortal] = useState(initialPortals[0]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(""), 2200);
    return () => clearTimeout(timer);
  }, [toast]);

  function updateForm(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function publishPortal() {
    const existing = portals.find((portal) => portal.name === form.portalName);
    if (existing) {
      setPortals((current) => current.map((portal) =>
        portal.id === existing.id
          ? { ...portal, workflow: form.workflowName, color: form.accent, status: "live" }
          : portal));
    } else {
      setPortals((current) => [{
        id: Date.now(), name: form.portalName, workflow: form.workflowName,
        clients: 0, runs: 0, color: form.accent, status: "live",
      }, ...current]);
    }
    setToast("Client portal published");
    setPreviewOpen(true);
  }

  function resolveApproval(id, outcome) {
    const item = approvals.find((approval) => approval.id === id);
    setApprovals((current) => current.filter((approval) => approval.id !== id));
    setToast(`${item.title} ${outcome}`);
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
              setForm((current) => ({ ...current, portalName: portal.name, workflowName: portal.workflow, accent: portal.color }));
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
        {view === "runs" && <RunsView runs={runs} retry={(run) => setToast(`${run.id} queued again`)} />}
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
          form={form}
          portal={selectedPortal}
          close={() => setPreviewOpen(false)}
          submit={(submission) => {
            setRuns((current) => [submission, ...current]);
            setToast("Workflow started");
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
                className={`portal-row ${selectedPortal.id === portal.id ? "active" : ""}`}
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
        <div className="panel portal-detail">
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
        </div>
      </div>
    </section>
  );
}

function BuilderView({ form, updateForm, publish, preview }) {
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

function PortalMockup({ form }) {
  return (
    <div className="device-preview">
      <div className="browser-bar"><i /><i /><i /><span>{form.portalName.toLowerCase().replaceAll(" ", "-")}.flowportal.app</span></div>
      <div className="client-page" style={{ "--client-accent": form.accent }}>
        <div className="client-brand"><span>{form.portalName.slice(0, 2).toUpperCase()}</span><strong>{form.portalName}</strong></div>
        <div className="client-hero"><small>WORKFLOW PORTAL</small><h2>{form.clientLabel}</h2><p>{form.description}</p></div>
        <div className="client-form-card">
          <label>Invoice reference<input placeholder="INV-2026-001" readOnly /></label>
          <label>Upload file<div className="upload-box"><Upload size={22} /><span>Drop PDF or click to browse</span></div></label>
          <button style={{ background: form.accent }}>Run {form.workflowName}</button>
        </div>
      </div>
    </div>
  );
}

function RunsView({ runs, retry }) {
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
              {run.status === "failed" ? <button className="secondary-button" onClick={() => retry(run)}>Retry</button> : <Status status={run.status} />}
            </article>
          ))}
        </div>
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

function ClientPortal({ form, portal, close, submit }) {
  const [reference, setReference] = useState("");
  const [file, setFile] = useState("");
  const [state, setState] = useState("form");

  function runWorkflow() {
    setState("running");
    setTimeout(() => {
      setState("result");
      submit({
        id: `RUN-${Math.floor(2000 + Math.random() * 7000)}`,
        portal: form.portalName || portal.name,
        action: form.workflowName || portal.workflow,
        client: "Demo Client",
        time: "just now",
        status: "approval",
        result: "Invoice requires approval · €1,240",
      });
    }, 900);
  }

  return (
    <div className="client-overlay">
      <button className="close-preview" onClick={close}><X size={18} /> Exit client view</button>
      <div className="live-client-page" style={{ "--client-accent": form.accent || portal.color }}>
        <div className="live-client-nav">
          <div className="client-brand"><span>{(form.portalName || portal.name).slice(0, 2).toUpperCase()}</span><strong>{form.portalName || portal.name}</strong></div>
          <div className="client-user">MC</div>
        </div>
        <main>
          {state !== "result" && (
            <>
              <div className="client-hero"><small>SECURE CLIENT PORTAL</small><h1>{form.clientLabel}</h1><p>{form.description}</p></div>
              <div className="live-form-card">
                <label>Invoice reference<input value={reference} onChange={(event) => setReference(event.target.value)} placeholder="INV-2026-001" /></label>
                <label>Invoice file
                  <button className={`upload-box ${file ? "has-file" : ""}`} onClick={() => setFile("invoice-acme-903.pdf")}>
                    {file ? <FileText size={24} /> : <Upload size={24} />}
                    <span>{file || "Choose a PDF invoice"}</span>
                  </button>
                </label>
                <button className="client-run-button" disabled={state === "running"} onClick={runWorkflow}>
                  {state === "running" ? "Running workflow…" : `Run ${form.workflowName}`}
                </button>
              </div>
            </>
          )}
          {state === "result" && (
            <div className="client-result">
              <span className="result-alert"><CircleAlert size={24} /></span>
              <small>WORKFLOW COMPLETE</small>
              <h1>Review required</h1>
              <p>This invoice resembles a payment made 12 days ago.</p>
              <div><span>Vendor</span><strong>Acme Supplies GmbH</strong></div>
              <div><span>Amount</span><strong>€1,240</strong></div>
              <div><span>Reference</span><strong>{reference || "INV-2026-001"}</strong></div>
              <button onClick={() => setState("form")}>Submit another invoice</button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function Metric({ icon: Icon, label, value, tone = "" }) {
  return <article className={`metric-card ${tone}`}><div><Icon size={18} /></div><strong>{value}</strong><span>{label}</span></article>;
}

function Status({ status }) {
  const labels = { live: "Live", draft: "Draft", complete: "Complete", approval: "Approval" };
  return <span className={`status-badge ${status}`}><i /> {labels[status] || status}</span>;
}

function SectionTitle({ icon: Icon, title }) {
  return <div className="section-title"><Icon size={17} /><strong>{title}</strong></div>;
}

function EmptyState() {
  return <div className="empty-state"><div><ShieldCheck size={25} /></div><h3>Approval queue clear</h3><p>Client actions waiting for review will appear here.</p></div>;
}
