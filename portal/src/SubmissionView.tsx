import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { BRAND, Logo } from "./App";

const API = "http://localhost:8000";

interface Submission {
  id: string;
  status: string;
  broker_email: string;
  subject: string;
  created_at: string;
  updated_at: string;
  extraction_confidence: number | null;
  extracted_data: Record<string, unknown> | null;
  attachments: Array<{ filename: string; size_bytes: number }>;
  assigned_to: string | null;
  approved_by: string | null;
  approved_at: string | null;
}

function statusLabel(s: string): { label: string; color: string } {
  const map: Record<string, { label: string; color: string }> = {
    received: { label: "Received", color: BRAND.textMuted },
    ack_sent: { label: "Received", color: BRAND.textMuted },
    extracting: { label: "Processing", color: BRAND.primary },
    extracted: { label: "Under Review", color: BRAND.primary },
    validated: { label: "Under Review", color: BRAND.primary },
    needs_review: { label: "Under Review", color: BRAND.primary },
    auto_policy_ready: { label: "Quoting", color: BRAND.primaryDark },
    policy_created: { label: "Quoted", color: BRAND.primaryDark },
    completed: { label: "Completed", color: "#16a34a" },
    failed: { label: "Needs Attention", color: "#dc2626" },
  };
  return map[s] || { label: s, color: BRAND.textMuted };
}

function fmtDate(d: string): string {
  const date = new Date(d);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const day = date.getDate();
  const suffix = day === 1 || day === 21 || day === 31 ? "st" : day === 2 || day === 22 ? "nd" : day === 3 || day === 23 ? "rd" : "th";
  const hr = date.getHours() % 12 || 12;
  const ampm = date.getHours() >= 12 ? "pm" : "am";
  return `${months[date.getMonth()]} ${day}${suffix}, ${date.getFullYear()} at ${hr}:${date.getMinutes().toString().padStart(2, "0")}${ampm}`;
}

function str(v: unknown): string {
  if (v === null || v === undefined || v === "") return "\u2014";
  return String(v);
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: BRAND.textMuted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 14, color: value === "\u2014" ? BRAND.textMuted : BRAND.text }}>{value}</div>
    </div>
  );
}

function timeAgo(d: string): string {
  const ms = Date.now() - new Date(d).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

const STEPS = [
  { key: "received", label: "Received" },
  { key: "review", label: "Under Review" },
  { key: "quoting", label: "Quoting" },
  { key: "approved", label: "Approved" },
  { key: "completed", label: "Completed" },
] as const;

function mapStatusToStep(status: string): number {
  if (["received", "ack_sent"].includes(status)) return 0;
  if (["extracting", "extracted", "validated", "needs_review"].includes(status)) return 1;
  if (["auto_policy_ready", "policy_created"].includes(status)) return 2;
  if (status === "completed") return 4;
  if (status === "failed") return -1;
  return 1;
}

function ProgressStepper({ status }: { status: string }) {
  const current = mapStatusToStep(status);
  const isFailed = status === "failed";

  return (
    <div style={{ background: "#fff", borderRadius: 12, padding: "20px 24px", marginBottom: 24 }}>
      <div style={{ display: "flex", alignItems: "center" }}>
        {STEPS.map((step, i) => {
          const done = i < current;
          const active = i === current && !isFailed;
          return (
            <div key={step.key} style={{ display: "flex", alignItems: "center", flex: i < STEPS.length - 1 ? 1 : "none" }}>
              {/* Circle */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, minWidth: 60 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: "50%",
                  background: done ? BRAND.primary : active ? BRAND.primary : isFailed && i === 0 ? "#dc2626" : "#e2e8f0",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "all 0.3s",
                }}>
                  {done ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                  ) : (
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: active ? "#fff" : "transparent" }} />
                  )}
                </div>
                <span style={{
                  fontSize: 11, fontWeight: active || done ? 600 : 400,
                  color: active ? BRAND.primary : done ? BRAND.text : BRAND.textMuted,
                  textAlign: "center", lineHeight: 1.2,
                }}>
                  {step.label}
                </span>
              </div>
              {/* Line */}
              {i < STEPS.length - 1 && (
                <div style={{ flex: 1, height: 2, background: done ? BRAND.primary : "#e2e8f0", marginBottom: 20, marginLeft: -4, marginRight: -4, transition: "background 0.3s" }} />
              )}
            </div>
          );
        })}
      </div>
      {isFailed && (
        <div style={{ marginTop: 12, fontSize: 13, color: "#dc2626", textAlign: "center" }}>
          There was an issue processing your submission. Our team has been notified.
        </div>
      )}
    </div>
  );
}

export function SubmissionView() {
  const { id } = useParams<{ id: string }>();
  const [sub, setSub] = useState<Submission | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetch(`${API}/submissions/${id}`)
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(setSub)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: BRAND.bg }}>
      <div style={{ color: BRAND.textMuted, fontSize: 14 }}>Loading...</div>
    </div>
  );

  if (error || !sub) return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: BRAND.bg }}>
      <Logo />
      <h1 style={{ fontSize: 22, fontWeight: 700, color: BRAND.text, marginTop: 32 }}>Submission Not Found</h1>
      <p style={{ fontSize: 14, color: BRAND.textLight, marginTop: 8 }}>This link may be invalid or the submission may have been removed.</p>
    </div>
  );

  const data = sub.extracted_data || {};
  const overview = (data.overview || {}) as Record<string, unknown>;
  const coverage = (data.coverage || {}) as Record<string, unknown>;
  const broker = (data.broker || {}) as Record<string, unknown>;
  const facilities = (data.facilities || []) as Array<Record<string, unknown>>;
  const lossRuns = (data.loss_runs || {}) as Record<string, unknown>;
  const si = statusLabel(sub.status);

  // Compute missing fields from extracted data
  const missingFields: string[] = [];
  const missing = (data.missing_fields || []) as string[];
  if (missing.length > 0) {
    missingFields.push(...missing);
  } else {
    if (!overview.insured_name) missingFields.push("Insured name");
    if (!overview.fein) missingFields.push("FEIN number");
    if (!coverage.policy_type) missingFields.push("Coverage type");
    if (!coverage.effective_date) missingFields.push("Effective date");
    if (!coverage.each_occurrence_limit) missingFields.push("Coverage limits");
  }

  return (
    <div style={{ minHeight: "100vh", background: BRAND.bg }}>
      {/* Header */}
      <header style={{ background: "#fff", padding: "16px 0" }}>
        <div style={{ maxWidth: 800, margin: "0 auto", padding: "0 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Logo />
          <span style={{ fontSize: 12, color: BRAND.textMuted }}>Submission Portal</span>
        </div>
      </header>

      {/* Content */}
      <main style={{ maxWidth: 800, margin: "0 auto", padding: "32px 24px" }}>

        {/* Title */}
        <div style={{ marginBottom: 8 }}>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: BRAND.text, margin: 0 }}>{str(overview.insured_name)}</h1>
          <p style={{ fontSize: 13, color: BRAND.textLight, marginTop: 4 }}>
            Ref: {sub.id.slice(0, 8)} &middot; Submitted {fmtDate(sub.created_at)}
          </p>
        </div>

        {/* Last updated */}
        <div style={{ fontSize: 12, color: BRAND.textMuted, marginBottom: 24 }}>
          Last updated {fmtDate(sub.updated_at)} &middot; {timeAgo(sub.updated_at)}
        </div>

        {/* Progress stepper */}
        <ProgressStepper status={sub.status} />

        {/* Missing information — primary focus */}
        {missingFields.length > 0 && (
          <div style={{ background: "#fff", borderRadius: 12, padding: 24, marginBottom: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: BRAND.primaryDark, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Information Needed</div>
            <p style={{ fontSize: 13, color: BRAND.textLight, marginBottom: 16 }}>
              To continue processing your submission, we need the following information. Please reply to our email or contact your broker.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {missingFields.map((f, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: BRAND.bg, borderRadius: 8, fontSize: 13, color: BRAND.text }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: BRAND.primary, flexShrink: 0 }} />
                  {f}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Coverage summary */}
        <div style={{ background: "#fff", borderRadius: 12, padding: 24, marginBottom: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: BRAND.primary, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 16 }}>Coverage Requested</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <Field label="Policy Type" value={str(coverage.policy_type)} />
            <Field label="Effective Date" value={str(coverage.effective_date)} />
            <Field label="Each Occurrence" value={str(coverage.each_occurrence_limit)} />
            <Field label="General Aggregate" value={str(coverage.general_aggregate)} />
          </div>
        </div>

        {/* Applicant + Broker name */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 24 }}>
          <div style={{ background: "#fff", borderRadius: 12, padding: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: BRAND.primary, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 16 }}>Applicant</div>
            <Field label="Insured Name" value={str(overview.insured_name)} />
            {overview.dba && str(overview.dba) !== "\u2014" && <Field label="DBA" value={str(overview.dba)} />}
            <Field label="Business Type" value={str(overview.business_type)} />
            <Field label="Employees" value={str(overview.number_of_employees)} />
            <Field label="Annual Revenue" value={str(overview.annual_revenue)} />
          </div>
          <div style={{ background: "#fff", borderRadius: 12, padding: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: BRAND.primary, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 16 }}>Broker</div>
            <Field label="Name" value={str(broker.name)} />
            {broker.company && str(broker.company) !== "\u2014" && <Field label="Company" value={str(broker.company)} />}
          </div>
        </div>

        {/* Loss Runs */}
        {lossRuns.present && (
          <div style={{ background: "#fff", borderRadius: 12, padding: 24, marginBottom: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: BRAND.primary, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 16 }}>Loss Runs — {str(lossRuns.years_covered)} year(s)</div>
            {lossRuns.summary && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 16 }}>
                {[{ k: "total_claims", l: "Claims" }, { k: "total_incurred", l: "Incurred" }, { k: "total_paid", l: "Paid" }, { k: "loss_ratio", l: "Loss Ratio" }].map(({ k, l }) => (
                  <div key={k}>
                    <div style={{ fontSize: 11, color: BRAND.textMuted }}>{l}</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: BRAND.text }}>{str((lossRuns.summary as Record<string, unknown>)[k])}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div style={{ textAlign: "center", padding: "32px 0", fontSize: 12, color: BRAND.textMuted }}>
          Apex Insurance Group &middot; Powered by real-operational expertise & real-time intelligence
        </div>
      </main>
    </div>
  );
}
