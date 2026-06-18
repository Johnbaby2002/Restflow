import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const here = dirname(fileURLToPath(import.meta.url));
const dataDir = join(here, "data");
mkdirSync(dataDir, { recursive: true });

export const db = new DatabaseSync(join(dataDir, "flowportal.sqlite"));
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS portals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    workflow TEXT NOT NULL,
    webhook TEXT NOT NULL DEFAULT '',
    client_label TEXT NOT NULL,
    description TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#ceff4f',
    input_mapping TEXT,
    output_mapping TEXT,
    status TEXT NOT NULL DEFAULT 'draft',
    clients INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS runs (
    id TEXT PRIMARY KEY,
    portal_id INTEGER NOT NULL,
    action TEXT NOT NULL,
    client TEXT NOT NULL,
    reference TEXT NOT NULL DEFAULT '',
    file_name TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL,
    result TEXT NOT NULL,
    request_json TEXT,
    response_json TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (portal_id) REFERENCES portals(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS approvals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id TEXT NOT NULL,
    title TEXT NOT NULL,
    client TEXT NOT NULL,
    amount TEXT,
    detail TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    resolved_at TEXT,
    FOREIGN KEY (run_id) REFERENCES runs(id) ON DELETE CASCADE
  );
`);

try {
  db.exec("ALTER TABLE runs ADD COLUMN request_json TEXT");
} catch (error) {
  if (!String(error.message).includes("duplicate column name")) throw error;
}

for (const statement of [
  "ALTER TABLE portals ADD COLUMN input_mapping TEXT",
  "ALTER TABLE portals ADD COLUMN output_mapping TEXT",
]) {
  try {
    db.exec(statement);
  } catch (error) {
    if (!String(error.message).includes("duplicate column name")) throw error;
  }
}

const portalCount = db.prepare("SELECT COUNT(*) AS count FROM portals").get().count;
if (portalCount === 0) {
  const insertPortal = db.prepare(`
    INSERT INTO portals
      (name, workflow, webhook, client_label, description, color, status, clients)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const acme = insertPortal.run(
    "Acme Finance",
    "Invoice review",
    "https://n8n.example.com/webhook/invoice-review",
    "Upload invoices for review",
    "Submit an invoice and receive structured checks, expense details, and approval status.",
    "#ceff4f",
    "live",
    8,
  ).lastInsertRowid;
  const legal = insertPortal.run(
    "Northstar Legal",
    "Contract intake",
    "https://n8n.example.com/webhook/contract-intake",
    "Submit a contract for review",
    "Upload a contract to receive a structured summary and risk report.",
    "#eda942",
    "draft",
    4,
  ).lastInsertRowid;

  const insertRun = db.prepare(`
    INSERT INTO runs
      (id, portal_id, action, client, reference, file_name, status, result, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now', ?))
  `);
  insertRun.run("RUN-1842", acme, "Invoice review", "Maya Chen", "INV-903", "invoice-903.pdf", "approval", "Possible duplicate payment · €1,240", "-2 minutes");
  insertRun.run("RUN-1841", acme, "Invoice review", "Jon Bell", "INV-902", "invoice-902.pdf", "complete", "Approved expense · €348", "-18 minutes");
  insertRun.run("RUN-1840", legal, "Contract intake", "Sarah Kim", "MAT-442", "contract.pdf", "failed", "Missing client reference", "-1 hour");

  const insertApproval = db.prepare(`
    INSERT INTO approvals (run_id, title, client, amount, detail)
    VALUES (?, ?, ?, ?, ?)
  `);
  insertApproval.run("RUN-1842", "Approve possible duplicate invoice", "Maya Chen", "€1,240", "Invoice INV-903 resembles payment INV-851 from 12 days ago.");
  insertApproval.run("RUN-1840", "Send contract summary to client", "Sarah Kim", null, "The workflow prepared a 4-page contract summary and risk report.");
}
