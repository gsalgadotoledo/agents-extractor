import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Markdown from "react-markdown";
import {
  AlertTriangle, Check, CheckCircle, ChevronDown, ChevronRight, Clock,
  Copy, Eye, ExternalLink, FileText, Inbox, Mail, MailOpen, Bot, Mic, MicOff,
  GripHorizontal, Maximize2, Minimize2, Paperclip, Pencil, RefreshCw, Send, Sparkles, Trash2, User, X, XCircle,
} from "lucide-react";
import {
  deleteDocument, fetchAttachmentText, fetchDocuments, fetchMissingFields,
  generateDocument, generateDraft, getAttachmentUrl, getDocumentUrl,
  loadChatHistory, patchExtractedData, reExtractSubmission, sendChatMessage,
  sendComposedEmail, clearChatHistory, uploadDocument,
  type DocumentMeta, type ChatToolStep, type MissingFieldsResult,
} from "../api";
import { JsonViewer } from "./JsonViewer";
import type { Submission } from "../types";

interface Props { submission: Submission; onRefresh?: () => void; }

// Helpers
function ext(d: Record<string, unknown> | null, ...ks: string[]): unknown { if (!d) return null; let c: unknown = d; for (const k of ks) { if (c && typeof c === "object" && k in c) c = (c as Record<string, unknown>)[k]; else return null; } return c; }
function str(v: unknown): string { if (v === null || v === undefined || v === "") return "\u2014"; if (typeof v === "object") return JSON.stringify(v); return String(v); }
function timeAgo(d: string): string { const ms = Date.now() - new Date(d).getTime(); const m = Math.floor(ms / 60000); if (m < 1) return "just now"; if (m < 60) return `${m}m ago`; const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`; return new Date(d).toLocaleDateString(); }

const BTN: React.CSSProperties = { padding: "4px 10px", fontSize: 11, cursor: "pointer", background: "var(--surface-alt)", color: "var(--text-secondary)", border: "none", borderRadius: 4, display: "inline-flex", alignItems: "center", gap: 4 };

// --- Status Badge ---
function statusInfo(s: string): { label: string; bg: string; color: string } {
  const map: Record<string, { label: string; bg: string; color: string }> = {
    received: { label: "Open", bg: "#e8e8e8", color: "var(--text)" },
    ack_sent: { label: "Open", bg: "#e8e8e8", color: "var(--text)" },
    extracting: { label: "Processing", bg: "#fff3cd", color: "#664d03" },
    extracted: { label: "In Review", bg: "#cfe2ff", color: "#084298" },
    validated: { label: "In Review", bg: "#cfe2ff", color: "#084298" },
    needs_review: { label: "Needs Review", bg: "#f8d7da", color: "#842029" },
    auto_policy_ready: { label: "Quoting", bg: "#d1e7dd", color: "#0f5132" },
    policy_created: { label: "Quoted", bg: "#d1e7dd", color: "#0f5132" },
    completed: { label: "Completed", bg: "#d1e7dd", color: "#0f5132" },
    failed: { label: "Failed", bg: "#f8d7da", color: "#842029" },
  };
  return map[s] || { label: s, bg: "#e8e8e8", color: "var(--text)" };
}

// --- Timeline ---
function TimelineEvent({ icon, label, time }: { icon: React.ReactNode; label: string; time?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 0", fontSize: 12 }}>
      <div style={{ width: 24, height: 24, borderRadius: "50%", background: "var(--input-bg)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: "var(--text-secondary)" }}>{icon}</div>
      <span style={{ color: "var(--text-secondary)", flex: 1 }}>{label}</span>
      {time && <span style={{ color: "var(--text-muted)", fontSize: 11 }}>{timeAgo(time)}</span>}
    </div>
  );
}

// --- Attachment ---
function AttachmentCard({ submissionId, att }: { submissionId: string; att: { filename: string; content_type: string; size_bytes: number } }) {
  const [show, setShow] = useState(false);
  const [text, setText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const isPdf = att.filename.toLowerCase().endsWith(".pdf");
  const url = getAttachmentUrl(submissionId, att.filename);
  const toggle = async () => { if (show) { setShow(false); return; } setLoading(true); try { const r = await fetchAttachmentText(submissionId, att.filename); setText(r.text); } catch { setText("(Failed)"); } finally { setLoading(false); setShow(true); } };
  return (
    <div style={{ borderTop: "none" }}>
      <div style={{ padding: "8px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--surface-hover)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}><FileText size={14} style={{ color: "var(--text-muted)" }} /><div><div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)" }}>{att.filename}</div><div style={{ fontSize: 11, color: "var(--text-muted)" }}>{(att.size_bytes / 1024).toFixed(1)} KB</div></div></div>
        <div style={{ display: "flex", gap: 4 }}>
          <button onClick={toggle} style={BTN}><Eye size={11} /> {show ? "Hide" : "Preview"}</button>
          {isPdf && <a href={url} target="_blank" rel="noopener noreferrer" style={{ ...BTN, textDecoration: "none" }}><ExternalLink size={11} /> Open</a>}
        </div>
      </div>
      {show && <div style={{ padding: 12, borderTop: "none", maxHeight: 300, overflow: "auto" }}>{loading ? <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Extracting...</span> : <pre style={{ fontSize: 11, fontFamily: "monospace", whiteSpace: "pre-wrap", margin: 0, lineHeight: 1.5, color: "var(--text-secondary)" }}>{text}</pre>}</div>}
    </div>
  );
}

// --- Section helpers ---
function SH({ text }: { text: string }) { return <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>{text}</div>; }
function SF({ l, v }: { l: string; v: string }) { return <div style={{ fontSize: 12, padding: "1px 0", display: "flex", gap: 6 }}><span style={{ color: "var(--text-muted)", minWidth: 70 }}>{l}</span><span style={{ color: v === "\u2014" ? "var(--text-muted)" : "var(--text)" }}>{v}</span></div>; }

// --- Overview Tab (hierarchical: most important info biggest and first) ---
function OverviewTab({ submission, onUpdate, onReExtract }: { submission: Submission; onUpdate: () => void; onReExtract: () => void }) {
  const data = submission.extracted_data as Record<string, unknown> | null;
  const [dynamicMissing, setDynamicMissing] = useState<MissingFieldsResult | null>(null);

  useEffect(() => {
    fetchMissingFields(submission.id).then(setDynamicMissing).catch(() => {});
  }, [submission.id, submission.updated_at]);

  if (!data || "error" in data) {
    if (submission.status === "extracting") return <div style={{ padding: 20, color: "#996600", display: "flex", alignItems: "center", gap: 8 }}><Clock size={16} /> Extracting data with AI...</div>;
    return <div style={{ padding: 20, color: "var(--text-muted)" }}>No extracted data yet.</div>;
  }
  const warnings = (ext(data, "warnings") as string[] | null) ?? [];
  const confidence = submission.extraction_confidence ?? 0;
  const pct = Math.round(confidence * 100);
  const ov = ext(data, "overview") as Record<string, unknown> | null;
  const br = ext(data, "broker") as Record<string, unknown> | null;
  const cov = ext(data, "coverage") as Record<string, unknown> | null;
  const facs = ext(data, "facilities") as Array<Record<string, unknown>> | null;
  const lr = ext(data, "loss_runs") as Record<string, unknown> | null;
  const prior = ext(data, "prior_insurance") as Record<string, unknown> | null;
  const claims = ext(data, "claims_history") as Array<Record<string, unknown>> | null;
  const contacts = ext(data, "contacts") as Array<Record<string, unknown>> | null;

  const isManualReview = lr && (lr.years_covered as number) >= 4;
  const routeLabel = isManualReview ? "Manual Review Required" : "Auto Quote Eligible";
  const routeBg = "var(--surface-alt)";
  const routeColor = "var(--text)";

  return (
    <div style={{ background: "var(--surface)", borderRadius: 8, padding: 24 }}>

      {/* TIER 1: Hero */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "var(--text)", lineHeight: 1.2, marginBottom: 4 }}>
            {str(ov?.insured_name)}
          </div>
          {ov?.dba && str(ov.dba) !== "\u2014" && <div style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 2 }}>DBA: {str(ov.dba)}</div>}
          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
            {str(ov?.business_type)} · Est. {str(ov?.year_established)} · {str(ov?.number_of_employees)} employees · {str(ov?.annual_revenue)} revenue
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
          <span style={{ fontSize: 13, padding: "4px 14px", borderRadius: 6, background: routeBg, color: routeColor, fontWeight: 700 }}>{routeLabel}</span>
          <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 10, background: "var(--border)", color: "var(--text)", fontWeight: 600 }}>{pct}% extraction confidence</span>
        </div>
      </div>

      {/* TIER 2: Coverage + Loss Runs */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32, marginBottom: 28 }}>
        <div>
          <SH text="Coverage Requested" />
          <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text)", marginBottom: 6 }}>{str(cov?.policy_type)}</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
            <SF l="Effective" v={str(cov?.effective_date)} />
            <SF l="Expiration" v={str(cov?.expiration_date)} />
            <SF l="Occurrence" v={str(cov?.each_occurrence_limit)} />
            <SF l="Aggregate" v={str(cov?.general_aggregate)} />
          </div>
        </div>
        {lr && (
          <div>
            <SH text={`Loss Runs — ${(lr.present as boolean) ? `${lr.years_covered} year(s)` : "None"}`} />
            {lr.summary ? (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {[{ k: "total_claims", label: "Claims" }, { k: "total_incurred", label: "Incurred" }, { k: "total_paid", label: "Paid" }, { k: "loss_ratio", label: "Loss Ratio" }].map(({ k, label }) => (
                  <div key={k}>
                    <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{label}</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: "var(--text)" }}>{str((lr.summary as Record<string, unknown>)[k])}</div>
                  </div>
                ))}
              </div>
            ) : <div style={{ fontSize: 13, color: "var(--text-muted)" }}>No loss run data available</div>}
          </div>
        )}
      </div>

      {/* TIER 3: Broker, ID, Prior */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 24, marginBottom: 28 }}>
        <div>
          <SH text="Broker" />
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>{str(br?.name)}</div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{str(br?.company)}</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{str(br?.email)}</div>
          {br?.phone && str(br.phone) !== "\u2014" && <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{str(br.phone)}</div>}
        </div>
        <div>
          <SH text="Identification" />
          <SF l="FEIN" v={str(ov?.fein)} /><SF l="SIC" v={str(ov?.sic_code)} /><SF l="NAICS" v={str(ov?.naics_code)} />
        </div>
        <div>
          <SH text="Prior Insurance" />
          {prior ? <><SF l="Carrier" v={str(prior.carrier)} /><SF l="Policy" v={str(prior.policy_number)} /><SF l="Premium" v={str(prior.premium)} /></> : <div style={{ fontSize: 12, color: "var(--text-muted)" }}>None</div>}
        </div>
      </div>

      {/* TIER 4: Details */}
      {facs && facs.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <SH text={`Facilities (${facs.length})`} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            {facs.map((f, i) => (
              <div key={i} style={{ fontSize: 12, padding: "6px 10px", background: "var(--surface-alt)", borderRadius: 6, color: "var(--text)" }}>
                {[f.address, f.city, f.state, f.zip].filter(Boolean).join(", ") || "\u2014"}
                {f.type && <span style={{ color: "var(--text-muted)", marginLeft: 4 }}>({str(f.type)})</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {lr && lr.periods && (lr.periods as Array<Record<string, unknown>>).length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <SH text="Loss Run Periods" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            {(lr.periods as Array<Record<string, unknown>>).map((p, i) => (
              <div key={i} style={{ fontSize: 11, padding: "6px 10px", background: "var(--surface-alt)", borderRadius: 6 }}>
                <div style={{ fontWeight: 600, color: "var(--text)", marginBottom: 2 }}>{str(p.period)}</div>
                <span style={{ color: "var(--text-secondary)" }}>Claims: {str(p.total_claims)} · Incurred: {str(p.total_incurred)} · Paid: {str(p.total_paid)}</span>
                {p.open_claims !== undefined && (p.open_claims as number) > 0 && <span style={{ color: "#996600", marginLeft: 4 }}>· {str(p.open_claims)} open</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {claims && claims.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <SH text={`Claims (${claims.length})`} />
          {claims.map((c, i) => (
            <div key={i} style={{ fontSize: 12, padding: "4px 0 4px 10px", borderLeft: "3px solid #e0e0e0", marginBottom: 4, color: "var(--text-secondary)" }}>
              <span style={{ fontWeight: 600 }}>{str(c.date)}</span> — {str(c.description)}
              {c.amount && <span style={{ fontWeight: 600 }}> ({str(c.amount)})</span>}
              <span style={{ color: "var(--text-muted)" }}> [{str(c.status)}]</span>
            </div>
          ))}
        </div>
      )}

      {contacts && contacts.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <SH text={`Contacts (${contacts.length})`} />
          {contacts.map((c, i) => (
            <div key={i} style={{ fontSize: 12, color: "var(--text-secondary)", padding: "2px 0" }}>
              <span style={{ fontWeight: 600 }}>{str(c.name)}</span>
              {c.role && str(c.role) !== "\u2014" && <span style={{ color: "var(--text-muted)" }}> · {str(c.role)}</span>}
              {c.email && str(c.email) !== "\u2014" && <span style={{ color: "var(--text-muted)" }}> · {str(c.email)}</span>}
              {c.phone && str(c.phone) !== "\u2014" && <span style={{ color: "var(--text-muted)" }}> · {str(c.phone)}</span>}
            </div>
          ))}
        </div>
      )}

      {/* TIER 5: Dynamic Missing + Warnings */}
      {dynamicMissing && (dynamicMissing.total_required > 0 || dynamicMissing.total_recommended > 0 || warnings.length > 0) && (
        <div style={{ marginBottom: 16 }}>
          {/* Completion bar */}
          <div style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ flex: 1, height: 4, borderRadius: 2, background: "var(--input-bg)", overflow: "hidden" }}>
              <div style={{ width: `${dynamicMissing.completion_pct * 100}%`, height: "100%", background: "var(--primary)", borderRadius: 2, transition: "width 0.3s" }} />
            </div>
            <span style={{ fontSize: 11, color: "var(--text-muted)", flexShrink: 0 }}>{Math.round(dynamicMissing.completion_pct * 100)}% complete</span>
          </div>

          {dynamicMissing.total_required > 0 && (
            <div style={{ marginBottom: 10 }}>
              <SH text={`Required (${dynamicMissing.total_required} missing)`} />
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {dynamicMissing.required_missing.map((m, i) => <MissingChip key={i} label={m.label} submissionId={submission.id} onUpdate={onUpdate} fieldPath={m.path} />)}
              </div>
            </div>
          )}

          {dynamicMissing.total_recommended > 0 && (
            <div style={{ marginBottom: 10 }}>
              <SH text={`Recommended (${dynamicMissing.total_recommended} missing)`} />
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {dynamicMissing.recommended_missing.map((m, i) => <MissingChip key={i} label={m.label} submissionId={submission.id} onUpdate={onUpdate} fieldPath={m.path} />)}
              </div>
            </div>
          )}

          {!dynamicMissing.has_facilities && (
            <div style={{ fontSize: 11, color: "#996600", padding: "2px 0", display: "flex", alignItems: "center", gap: 4 }}><AlertTriangle size={11} /> No facilities/addresses extracted</div>
          )}

          {warnings.length > 0 && warnings.map((w, i) => (
            <div key={i} style={{ fontSize: 11, color: "#996600", padding: "2px 0", display: "flex", alignItems: "center", gap: 4 }}><AlertTriangle size={11} /> {w}</div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
        <button onClick={onReExtract} style={BTN}><RefreshCw size={11} /> Re-extract with AI</button>
      </div>
    </div>
  );
}

function MissingChip({ label, submissionId, onUpdate, fieldPath }: { label: string; submissionId: string; onUpdate: () => void; fieldPath?: string }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const path = fieldPath || label.toLowerCase().replace(/\s+/g, "_");
  const save = async () => { if (!value.trim()) return; await patchExtractedData(submissionId, path, value); onUpdate(); setEditing(false); setValue(""); };
  if (editing) return <div style={{ display: "inline-flex", gap: 2 }}><input value={value} onChange={(e) => setValue(e.target.value)} onKeyDown={(e) => e.key === "Enter" && save()} placeholder={label} autoFocus style={{ padding: "2px 6px", fontSize: 11, border: "1px solid #ddd", borderRadius: 3, width: 130 }} /><button onClick={save} style={{ ...BTN, background: "var(--primary)", color: "var(--header-text)", border: "none" }}><Check size={10} /></button><button onClick={() => setEditing(false)} style={BTN}><XCircle size={10} /></button></div>;
  return <span onClick={() => setEditing(true)} style={{ fontSize: 11, padding: "2px 8px", borderRadius: 10, background: "#fff3cd", color: "#664d03", cursor: "pointer", border: "1px solid #ffecb5", display: "inline-flex", alignItems: "center", gap: 3 }}><AlertTriangle size={10} /> {label}</span>;
}

// --- Activity Tab (timeline with reply on top) ---
function ActivityTab({ submission, hasMissing }: { submission: Submission; hasMissing: boolean }) {
  const s = submission;
  const [showReply, setShowReply] = useState(false);

  type Entry = { type: "event" | "email-in" | "compose"; icon: React.ReactNode; title: string; time?: string; content?: React.ReactNode; _sort: number };
  const entries: Entry[] = [];
  const createdMs = new Date(s.created_at).getTime();

  // Show compose only when opened (always at top, highest sort)
  if (showReply) {
    entries.push({
      type: "compose", icon: <Mail size={14} />, title: "Reply to broker", _sort: Date.now() + 1,
      content: (
        <div>
          <ComposeSection submissionId={s.id} brokerEmail={s.broker_email} subject={s.subject} hasMissing={hasMissing} />
          <button onClick={() => setShowReply(false)} style={{ fontSize: 11, color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", marginTop: 4 }}>Cancel</button>
        </div>
      ),
    });
  }

  // Sent emails
  if (s.sent_emails) {
    for (const email of s.sent_emails) {
      const ts = email.sent_at as string | undefined;
      entries.push({ type: "event", icon: <Send size={14} />, title: `Email sent to ${email.to || s.broker_email}`, time: ts, _sort: ts ? new Date(ts).getTime() : createdMs + 1 });
    }
  }

  // Status events — use incremental offsets from created_at to approximate order
  if (s.status !== "received")
    entries.push({ type: "event", icon: <MailOpen size={14} />, title: "Acknowledgment email sent to broker", _sort: createdMs + 1000 });
  if (["extracting", "extracted", "validated", "needs_review", "auto_policy_ready", "policy_created", "completed"].includes(s.status))
    entries.push({ type: "event", icon: <Bot size={14} />, title: "AI extraction started", _sort: createdMs + 2000 });
  if (["extracted", "validated", "needs_review", "auto_policy_ready", "policy_created", "completed"].includes(s.status)) {
    const c = s.extraction_confidence ? ` with ${Math.round(s.extraction_confidence * 100)}% extraction confidence` : "";
    entries.push({ type: "event", icon: <CheckCircle size={14} />, title: `AI extraction completed${c}`, _sort: createdMs + 3000 });
  }
  if (s.status === "needs_review")
    entries.push({ type: "event", icon: <AlertTriangle size={14} />, title: "Manual review required — loss runs meet 4-year threshold", _sort: createdMs + 4000 });
  if (["auto_policy_ready", "policy_created"].includes(s.status))
    entries.push({ type: "event", icon: <Check size={14} />, title: "Auto-policy eligible", _sort: createdMs + 4000 });

  // Chat history system entries
  for (const entry of (s.chat_history || []).filter(h => h.role === "system" && h.content)) {
    const content = entry.content as string;
    const actType = entry.activity_type as string | undefined;
    const actor = entry.actor as string | undefined;
    const actorRole = entry.actor_role as string | undefined;
    const ts = entry.timestamp as string | undefined;

    let icon: React.ReactNode = <Bot size={14} />;
    if (content.includes("Assigned") || content.includes("Reassigned")) icon = <User size={14} />;
    else if (content.includes("Approved")) icon = <CheckCircle size={14} />;
    else if (content.includes("Email") || content.includes("email")) icon = <Send size={14} />;
    else if (content.includes("Updated") || content.includes("Replaced") || content.includes("Added")) icon = <Check size={14} />;
    else if (content.includes("Status changed")) icon = <RefreshCw size={14} />;
    else if (content.includes("Note:")) icon = <AlertTriangle size={14} />;

    let richContent: React.ReactNode | undefined;
    if (actType && (actor || ts)) {
      richContent = (
        <div style={{ marginTop: 4, fontSize: 11, color: "var(--text-muted)", display: "flex", flexDirection: "column", gap: 2 }}>
          {actor && <div><span style={{ color: "var(--text-secondary)", fontWeight: 600 }}>{actor}</span>{actorRole && <span> · {actorRole}</span>}</div>}
          {ts && <div>{new Date(ts).toLocaleString()} · {timeAgo(ts)}</div>}
        </div>
      );
    }

    entries.push({ type: "event", icon, title: content, time: ts, content: richContent, _sort: ts ? new Date(ts).getTime() : createdMs + 5000 });
  }

  // Original email (oldest)
  entries.push({
    type: "email-in", icon: <Inbox size={14} />, title: "Submission received", time: s.created_at, _sort: createdMs,
    content: (
      <div style={{ border: "none", borderRadius: 6, overflow: "hidden", background: "var(--surface)" }}>
        <div style={{ padding: "10px 16px", background: "var(--surface-hover)", borderBottom: "none", display: "flex", justifyContent: "space-between" }}>
          <div><span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{s.broker_email}</span></div>
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{new Date(s.created_at).toLocaleString()}</span>
        </div>
        <div style={{ padding: 16, fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap", color: "var(--text)" }}>{s.body_text || "(empty)"}</div>
        {s.attachments.map((att, i) => <AttachmentCard key={i} submissionId={s.id} att={att} />)}
      </div>
    ),
  });

  return (
    <div>
      {/* Reply button — top right, outside the timeline */}
      {!showReply && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
          <button
            onClick={() => setShowReply(true)}
            style={{ padding: "5px 14px", fontSize: 12, cursor: "pointer", background: "var(--primary)", color: "var(--header-text)", border: "none", borderRadius: 4, display: "flex", alignItems: "center", gap: 5 }}
          >
            <Mail size={12} /> Reply to broker
          </button>
        </div>
      )}

      {entries.sort((a, b) => b._sort - a._sort).map((entry, i) => (
        <div key={i} style={{ display: "flex", gap: 12 }}>
          {/* Timeline rail — continuous vertical line */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 24, flexShrink: 0 }}>
            <div style={{
              width: 22, height: 22, borderRadius: "50%",
              background: entry.type === "compose" ? "var(--primary)" : entry.type === "email-in" ? "var(--border)" : "var(--input-bg)",
              color: entry.type === "compose" ? "var(--header-text)" : "var(--text-muted)",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, zIndex: 1,
            }}>
              {entry.icon}
            </div>
            {i < entries.length - 1 && <div style={{ width: 2, flex: 1, background: "var(--border)" }} />}
          </div>

          {/* Content */}
          <div style={{ flex: 1, minWidth: 0, paddingBottom: entry.content ? 16 : 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", minHeight: 22, marginBottom: entry.content ? 8 : 0 }}>
              {entry.onClick ? (
                <span onClick={entry.onClick} style={{ fontSize: 13, lineHeight: "22px", color: "var(--text-secondary)", cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 2 }}>{entry.title}</span>
              ) : (
                <span style={{ fontSize: 13, lineHeight: "22px", fontWeight: entry.content ? 600 : 400, color: entry.content ? "var(--text)" : "var(--text-secondary)" }}>{entry.title}</span>
              )}
              {entry.time && <span style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: "22px", flexShrink: 0, marginLeft: 12 }}>{timeAgo(entry.time)}</span>}
            </div>
            {entry.content}
          </div>
        </div>
      ))}
    </div>
  );
}

// --- Email Composer (inline) ---
function ComposeSection({ submissionId, brokerEmail, subject, hasMissing }: { submissionId: string; brokerEmail: string; subject: string; hasMissing: boolean }) {
  const [to, setTo] = useState(brokerEmail);
  const [subj, setSubj] = useState(`Re: ${subject}`);
  const [body, setBody] = useState("");
  const [tone, setTone] = useState("professional");
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [showAI, setShowAI] = useState(false);
  const tones = [{ id: "professional", label: "Professional" }, { id: "friendly", label: "Friendly" }, { id: "concise", label: "Concise" }, { id: "detailed", label: "Detailed" }, { id: "mirror", label: "Mirror sender" }];

  useEffect(() => {
    if (hasMissing && !body) {
      setGenerating(true);
      generateDraft(submissionId, "professional", "").then((r) => setBody(r.draft)).catch(() => {}).finally(() => setGenerating(false));
    }
  }, [submissionId, hasMissing]); // eslint-disable-line

  const handleGenerate = async () => { setGenerating(true); try { const r = await generateDraft(submissionId, tone, instruction); setBody(r.draft); setShowAI(false); } catch (e) { setBody(`Error: ${e}`); } finally { setGenerating(false); } };
  const handleSend = async () => { if (!body.trim()) return; setSending(true); try { await sendComposedEmail(submissionId, to, subj, body, body); setSent(true); setTimeout(() => setSent(false), 3000); } finally { setSending(false); } };

  return (
    <div style={{ background: "var(--surface)", borderRadius: 8, padding: 16 }}>
      {/* To + Subject in a compact row */}
      <div style={{ display: "flex", gap: 12, marginBottom: 8, fontSize: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ color: "var(--text-muted)" }}>To</span>
          <input value={to} onChange={(e) => setTo(e.target.value)} style={{ padding: "4px 8px", fontSize: 12, border: "none", background: "var(--input-bg)", borderRadius: 4, width: 200, color: "var(--text)" }} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4, flex: 1 }}>
          <span style={{ color: "var(--text-muted)" }}>Subject</span>
          <input value={subj} onChange={(e) => setSubj(e.target.value)} style={{ padding: "4px 8px", fontSize: 12, border: "none", background: "var(--input-bg)", borderRadius: 4, flex: 1, color: "var(--text)" }} />
        </div>
      </div>

      {/* Body editor */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ display: "flex", gap: 2, marginBottom: 4 }}>
          {["bold", "italic", "underline", "insertUnorderedList", "insertOrderedList"].map((cmd) => (
            <button key={cmd} onClick={() => document.execCommand(cmd)} style={{ width: 24, height: 20, fontSize: 10, cursor: "pointer", background: "transparent", border: "none", borderRadius: 3, color: "var(--text-muted)", fontWeight: cmd === "bold" ? 700 : 400, fontStyle: cmd === "italic" ? "italic" : "normal", textDecoration: cmd === "underline" ? "underline" : "none" }}>
              {cmd === "insertUnorderedList" ? "UL" : cmd === "insertOrderedList" ? "OL" : cmd[0].toUpperCase()}
            </button>
          ))}
        </div>
        {body ? (
          <div contentEditable suppressContentEditableWarning onBlur={(e) => setBody(e.currentTarget.innerText)} style={{ minHeight: 100, maxHeight: 250, overflow: "auto", padding: 12, background: "var(--surface-alt)", borderRadius: 6, fontSize: 13, lineHeight: 1.6, outline: "none", whiteSpace: "pre-wrap", color: "var(--text)" }} dangerouslySetInnerHTML={{ __html: body.replace(/\n/g, "<br>") }} />
        ) : (
          <div style={{ minHeight: 100, padding: 12, background: "var(--surface-alt)", borderRadius: 6, fontSize: 13, color: "var(--text-muted)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {generating ? "Generating draft..." : "Type a reply or use AI to generate one"}
          </div>
        )}
      </div>

      {/* AI assist bar — collapsed by default behind a sparkles icon */}
      {showAI && (
        <div style={{ background: "var(--surface-alt)", borderRadius: 6, padding: 10, marginBottom: 8, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <select value={tone} onChange={(e) => setTone(e.target.value)} style={{ padding: "4px 8px", fontSize: 11, border: "none", background: "var(--surface)", borderRadius: 4, color: "var(--text)" }}>
            {tones.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
          <input value={instruction} onChange={(e) => setInstruction(e.target.value)} placeholder="Hint: e.g. Ask for loss runs and FEIN" style={{ padding: "4px 8px", fontSize: 11, border: "none", background: "var(--surface)", borderRadius: 4, flex: 1, minWidth: 150, color: "var(--text-secondary)" }} />
          <button onClick={handleGenerate} disabled={generating} style={{ ...BTN, background: "var(--primary)", color: "var(--header-text)", border: "none", opacity: generating ? 0.6 : 1 }}>
            <Sparkles size={11} /> {generating ? "Generating..." : "Generate"}
          </button>
        </div>
      )}

      {/* Footer: AI toggle + send */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={() => setShowAI(!showAI)} style={{ ...BTN, background: showAI ? "var(--primary)" : "transparent", color: showAI ? "var(--header-text)" : "var(--text-muted)", border: "none", borderRadius: 6, padding: "5px 10px" }}>
            <Sparkles size={12} /> AI Assist
          </button>
          {sent && <span style={{ fontSize: 11, color: "#0f5132", display: "flex", alignItems: "center", gap: 3 }}><Check size={11} /> Sent</span>}
        </div>
        <button onClick={handleSend} disabled={sending || !body.trim()} style={{ padding: "6px 18px", fontSize: 12, fontWeight: 600, cursor: sending || !body.trim() ? "not-allowed" : "pointer", background: "var(--primary)", color: "var(--header-text)", border: "none", borderRadius: 4, opacity: sending || !body.trim() ? 0.4 : 1, display: "flex", alignItems: "center", gap: 4 }}>
          <Send size={12} /> {sending ? "Sending..." : "Send"}
        </button>
      </div>
    </div>
  );
}

// --- Floating Chat (always visible at bottom) ---
// Waveform animation component
function WaveformAnimation({ analyser }: { analyser?: AnalyserNode | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const historyRef = useRef<number[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    historyRef.current = [];

    const draw = () => {
      const w = canvas.width;
      const h = canvas.height;
      const mid = h / 2;

      // Sample current audio level
      if (analyser) {
        const data = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += Math.abs(data[i] - 128);
        const level = sum / data.length / 128;
        historyRef.current.push(level);
      } else {
        historyRef.current.push(0.02 + Math.random() * 0.05);
      }

      // Keep only enough samples to fill the canvas
      const barW = 3;
      const gap = 2;
      const step = barW + gap;
      const maxBars = Math.floor(w / step);
      if (historyRef.current.length > maxBars) {
        historyRef.current = historyRef.current.slice(-maxBars);
      }

      // Draw — newest samples on the right, scrolling left
      ctx.clearRect(0, 0, w, h);
      const samples = historyRef.current;
      const startX = w - samples.length * step;

      for (let i = 0; i < samples.length; i++) {
        const level = samples[i];
        const barH = Math.max(2, level * h * 1.8);
        const x = startX + i * step;
        const radius = barW / 2;

        ctx.fillStyle = "var(--accent, #111)";
        ctx.beginPath();
        ctx.roundRect(x, mid - barH / 2, barW, barH, radius);
        ctx.fill();
      }

      animRef.current = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(animRef.current);
  }, [analyser]);

  return <canvas ref={canvasRef} width={400} height={32} style={{ flex: 1, height: 32, borderRadius: 4 }} />;
}

// --- Email Draft Card (rendered inline in chat) ---
function EmailPreviewModal({ body, subject, to, onClose }: { body: string; subject: string; to: string; onClose: () => void }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "var(--surface)", borderRadius: 8, width: 600, maxHeight: "80vh", overflow: "auto", padding: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>Email Preview</span>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "var(--text-muted)" }}>&times;</button>
        </div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>To: {to}</div>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", marginBottom: 12 }}>{subject}</div>
        <div className="chat-md" style={{ fontSize: 13, lineHeight: 1.6, color: "var(--text)" }}>
          <Markdown>{body}</Markdown>
        </div>
      </div>
    </div>
  );
}

function EmailDraftCard({ draft, onSent }: { draft: { to: string; subject: string; body: string; submission_id: string }; onSent: () => void }) {
  const [to, setTo] = useState(draft.to);
  const [subject, setSubject] = useState(draft.subject);
  const [body, setBody] = useState(draft.body);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const handleSend = async () => {
    setSending(true);
    try {
      await sendComposedEmail(draft.submission_id, to, subject, body, body);
      setSent(true);
      onSent();
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <div style={{ margin: "8px 0", background: "var(--surface-alt)", borderRadius: 8, overflow: "hidden" }}>
        <div style={{ padding: "8px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "var(--text)", display: "flex", alignItems: "center", gap: 6 }}><Check size={13} /> Email sent to {to}</span>
          <button onClick={() => setShowPreview(true)} style={{ padding: 4, background: "transparent", border: "none", cursor: "pointer", color: "var(--text-muted)", display: "flex" }} title="View full email"><Maximize2 size={12} /></button>
        </div>
        <div style={{ padding: "0 12px 10px" }}>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>{subject}</div>
          <div className="chat-md" style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5, maxHeight: 100, overflow: "hidden" }}>
            <Markdown>{body}</Markdown>
          </div>
        </div>
        {showPreview && <EmailPreviewModal body={body} subject={subject} to={to} onClose={() => setShowPreview(false)} />}
      </div>
    );
  }

  return (
    <div style={{ margin: "8px 0", background: "var(--surface)", borderRadius: 8, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
      <div style={{ padding: "8px 12px", background: "var(--surface-alt)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", display: "flex", alignItems: "center", gap: 4 }}><Mail size={13} /> Email Draft</span>
        <button onClick={() => setShowPreview(true)} style={{ padding: 4, background: "transparent", border: "none", cursor: "pointer", color: "var(--text-muted)", display: "flex" }} title="Preview full email"><Maximize2 size={12} /></button>
      </div>
      <div style={{ padding: "6px 12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
          <span style={{ fontSize: 11, color: "var(--text-muted)", width: 50 }}>To</span>
          <input value={to} onChange={e => setTo(e.target.value)} style={{ flex: 1, padding: "3px 6px", fontSize: 12, border: "none", background: "var(--input-bg)", borderRadius: 3, color: "var(--text)" }} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
          <span style={{ fontSize: 11, color: "var(--text-muted)", width: 50 }}>Subject</span>
          <input value={subject} onChange={e => setSubject(e.target.value)} style={{ flex: 1, padding: "3px 6px", fontSize: 12, border: "none", background: "var(--input-bg)", borderRadius: 3, color: "var(--text)" }} />
        </div>
      </div>
      <div style={{ padding: "0 12px 8px" }}>
        <div className="chat-md" style={{ padding: 8, background: "var(--surface-alt)", borderRadius: 4, fontSize: 12, lineHeight: 1.5, minHeight: 80, maxHeight: 200, overflow: "auto", color: "var(--text)" }}>
          <Markdown>{body}</Markdown>
        </div>
        <textarea
          value={body}
          onChange={e => setBody(e.target.value)}
          rows={3}
          placeholder="Edit the email text here..."
          style={{ width: "100%", marginTop: 6, padding: 8, fontSize: 11, border: "none", background: "var(--surface-hover)", borderRadius: 4, resize: "vertical", fontFamily: "monospace", color: "var(--text-secondary)", outline: "none" }}
        />
      </div>
      <div style={{ padding: "6px 12px 10px", display: "flex", justifyContent: "flex-end" }}>
        <button onClick={handleSend} disabled={sending} style={{ padding: "6px 16px", fontSize: 12, fontWeight: 600, background: "var(--primary)", color: "var(--header-text)", border: "none", borderRadius: 4, cursor: sending ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 4, opacity: sending ? 0.5 : 1 }}>
          <Send size={12} /> {sending ? "Sending..." : "Send Email"}
        </button>
      </div>
      {showPreview && <EmailPreviewModal body={body} subject={subject} to={to} onClose={() => setShowPreview(false)} />}
    </div>
  );
}

function FloatingChat({ submissionId, onDataUpdated, attachedContext, onClearContext, onRemoveContext }: { submissionId: string; onDataUpdated: () => void; attachedContext?: Array<{ path: string; label: string }>; onClearContext?: () => void; onRemoveContext?: (path: string) => void }) {
  type EmailDraft = { to: string; subject: string; body: string; submission_id: string };
  type Msg = { role: "user" | "assistant" | "system"; content: string; fields?: string[]; files?: string[]; transcription?: string; toolSteps?: ChatToolStep[]; emailDrafts?: EmailDraft[] };
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [recording, setRecording] = useState(false);
  const [analyserNode, setAnalyserNode] = useState<AnalyserNode | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);

  const scrollToBottom = (smooth = false) => {
    setTimeout(() => {
      if (smooth) {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      } else {
        // Instant — no animation
        const container = chatScrollRef.current;
        if (container) container.scrollTop = container.scrollHeight;
      }
    }, 30);
  };

  const handleChatScroll = () => {
    const el = chatScrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    setShowScrollBtn(!atBottom);
  };

  // Load persisted history on mount
  useEffect(() => {
    if (loaded) return;
    loadChatHistory(submissionId).then(({ history }) => {
      const restored: Msg[] = history.map((h) => ({
        role: (h.role as "user" | "assistant" | "system") || "system",
        content: (h.content as string) || "",
        fields: h.updated_fields as string[] | undefined,
        files: h.files as string[] | undefined,
        transcription: h.transcription as string | undefined,
        toolSteps: h.tool_steps as ChatToolStep[] | undefined,
      }));
      setMsgs(restored);
      // History loaded but don't auto-expand — user will expand by submitting or clicking preview
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, [submissionId, loaded]);

  const send = async (audioBlob?: Blob) => {
    const text = input.trim();
    const hasFiles = pendingFiles.length > 0;
    const hasAudio = !!audioBlob;
    const hasContext = (attachedContext?.length ?? 0) > 0;
    if (!text && !hasFiles && !hasAudio && !hasContext) return;
    if (sending) return;

    // Prepend context fields to the message
    const contextPrefix = hasContext
      ? `[Missing fields to address: ${attachedContext!.map(c => `${c.label} (${c.path})`).join(", ")}]\n\n`
      : "";
    const fullText = contextPrefix + text;

    setExpanded(true);
    const displayText = [
      text,
      hasFiles ? `[${pendingFiles.map(f => f.name).join(", ")}]` : "",
    ].filter(Boolean).join(" ");

    // For audio-only messages, show a placeholder that will be replaced by the transcription
    const msgContent = displayText || (hasAudio ? "" : "");
    setMsgs(prev => [...prev, { role: "user", content: msgContent || "(processing audio...)", files: pendingFiles.map(f => f.name) }]);
    setInput("");
    const filesToSend = [...pendingFiles];
    setPendingFiles([]);
    setSending(true);

    try {
      const r = await sendChatMessage(submissionId, fullText, filesToSend.length > 0 ? filesToSend : undefined, audioBlob);
      if (hasContext) onClearContext?.();
      // If there's a transcription, update the last user message to show it
      if (r.transcription) {
        setMsgs(prev => {
          const updated = [...prev];
          // Find the last user message and add transcription
          for (let i = updated.length - 1; i >= 0; i--) {
            if (updated[i].role === "user") {
              updated[i] = { ...updated[i], content: "", transcription: r.transcription! };
              break;
            }
          }
          return updated;
        });
      }
      setMsgs(prev => [...prev, {
        role: "assistant",
        content: r.reply,
        fields: r.updated_fields,
        files: r.files_processed,
        toolSteps: r.tool_steps,
        emailDrafts: r.email_drafts.length > 0 ? r.email_drafts : undefined,
      }]);
      if (r.updated_fields.length > 0) onDataUpdated();
    } catch (e) {
      setMsgs(prev => [...prev, { role: "assistant", content: `Error: ${e}` }]);
    } finally {
      setSending(false);
      scrollToBottom(true);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setPendingFiles(prev => [...prev, ...files]);
    e.target.value = "";
  };

  const removePendingFile = (idx: number) => setPendingFiles(prev => prev.filter((_, i) => i !== idx));

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Set up audio analyser for waveform visualization
      const audioCtx = new AudioContext();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      setAnalyserNode(analyser);

      const mr = new MediaRecorder(stream, { mimeType: "audio/webm" });
      audioChunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mr.start();
      mediaRecorderRef.current = mr;
      setRecording(true);
    } catch {
      setMsgs(prev => [...prev, { role: "assistant", content: "Microphone access denied." }]);
    }
  };

  const stopAndSend = () => {
    const mr = mediaRecorderRef.current;
    if (!mr) return;
    mr.onstop = () => {
      streamRef.current?.getTracks().forEach(t => t.stop());
      const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
      send(blob);
    };
    mr.stop();
    mediaRecorderRef.current = null;
    streamRef.current = null;
    setRecording(false);
    setAnalyserNode(null);
  };

  const cancelRecording = () => {
    mediaRecorderRef.current?.stop();
    streamRef.current?.getTracks().forEach(t => t.stop());
    mediaRecorderRef.current = null;
    streamRef.current = null;
    audioChunksRef.current = [];
    setRecording(false);
    setAnalyserNode(null);
  };

  const clear = async () => { await clearChatHistory(submissionId); setMsgs([]); };

  const hasInput = input.trim() || pendingFiles.length > 0;
  const [chatHeight, setChatHeight] = useState(280);
  const resizingRef = useRef(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  const prevMsgCount = useRef(msgs.length);
  useEffect(() => {
    if (expanded) {
      const isNewMsg = msgs.length > prevMsgCount.current;
      scrollToBottom(isNewMsg);
      prevMsgCount.current = msgs.length;
    }
  }, [msgs.length, expanded]);

  // Get last assistant message for collapsed preview
  const lastAssistant = [...msgs].reverse().find(m => m.role === "assistant");
  const lastPreview = lastAssistant?.content?.split("\n")[0]?.slice(0, 100) || "";

  // Resize handler
  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    resizingRef.current = true;
    const startY = e.clientY;
    const startH = chatHeight;
    const onMove = (ev: MouseEvent) => {
      if (!resizingRef.current) return;
      const delta = startY - ev.clientY;
      setChatHeight(Math.max(120, Math.min(600, startH + delta)));
    };
    const onUp = () => { resizingRef.current = false; window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  return (
    <div ref={chatContainerRef}>
      {/* Resize handle */}
      {expanded && msgs.length > 0 && (
        <div onMouseDown={handleResizeStart} style={{ height: 6, cursor: "ns-resize", display: "flex", justifyContent: "center", alignItems: "center" }}>
          <GripHorizontal size={14} color="#ccc" />
        </div>
      )}

      {/* Messages area */}
      {expanded && msgs.length > 0 && (
        <div ref={chatScrollRef} onScroll={handleChatScroll} style={{ height: chatHeight, overflowY: "auto", padding: "10px 12px", position: "relative" }}>
          {msgs.map((m, i) => {
            if (m.role === "system") return (
              <div key={i} style={{ fontSize: 11, color: "var(--text-muted)", padding: "4px 0", textAlign: "center", fontStyle: "italic" }}>{m.content}</div>
            );
            const isUser = m.role === "user";
            return (
              <div key={i} style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start" }}>
                  <div style={{ maxWidth: "85%", padding: "8px 12px", borderRadius: 8, fontSize: 12, lineHeight: 1.5, background: isUser ? "var(--chat-user)" : "var(--chat-bot)", color: isUser ? "var(--chat-user-text)" : "var(--chat-bot-text)" }}>
                    {m.transcription && (
                      <div style={{ padding: "6px 10px", background: isUser ? "rgba(255,255,255,0.1)" : "var(--input-bg)", borderRadius: 4, borderLeft: "3px solid #999", display: "flex", alignItems: "flex-start", gap: 6, marginBottom: m.content && m.content !== "(processing audio...)" ? 6 : 0 }}>
                        <Mic size={11} style={{ marginTop: 2, flexShrink: 0, color: "var(--text-muted)" }} />
                        <span style={{ fontSize: 12, color: isUser ? "var(--text-muted)" : "var(--text-secondary)" }}>{m.transcription}</span>
                      </div>
                    )}
                    {m.content && m.content !== "(processing audio...)" && <div className="chat-md"><Markdown>{m.content}</Markdown></div>}
                    {m.files && m.files.length > 0 && <div style={{ marginTop: 4, fontSize: 11, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 3 }}><Paperclip size={10} /> {m.files.join(", ")}</div>}
                    {m.fields && m.fields.length > 0 && <div style={{ marginTop: 4, fontSize: 11, color: "#0f5132" }}>Updated: {m.fields.join(", ")}</div>}
                  </div>
                </div>
                {m.toolSteps && m.toolSteps.length > 0 && (
                  <div style={{ marginTop: 4, paddingLeft: 12 }}>
                    {m.toolSteps.map((step, j) => (
                      <div key={j} style={{ fontSize: 10, color: "var(--text-muted)", padding: "1px 0", display: "flex", alignItems: "center", gap: 4 }}>
                        {step.type === "call" ? <Bot size={9} /> : <Check size={9} />}
                        <span style={{ fontFamily: "monospace" }}>{step.tool}</span>
                        {step.type === "call" && step.args && <span style={{ color: "var(--text-muted)" }}>({Object.keys(step.args).join(", ")})</span>}
                        {step.type === "result" && step.result && <span style={{ color: "#0f5132" }}>{step.result}</span>}
                      </div>
                    ))}
                  </div>
                )}
                {/* Email draft cards */}
                {m.emailDrafts && m.emailDrafts.map((draft, j) => (
                  <EmailDraftCard key={j} draft={draft} onSent={onDataUpdated} />
                ))}
              </div>
            );
          })}
          {sending && <div style={{ fontSize: 11, color: "var(--text-muted)", padding: 4, display: "flex", alignItems: "center", gap: 4 }}><Bot size={12} /> Processing...</div>}
          <div ref={bottomRef} />
          {showScrollBtn && (
            <button
              onClick={() => scrollToBottom(true)}
              style={{
                position: "sticky", bottom: 4, left: "50%", transform: "translateX(-50%)",
                width: 28, height: 28, borderRadius: "50%", background: "var(--primary)", color: "var(--header-text)",
                border: "none", cursor: "pointer", display: "flex", alignItems: "center",
                justifyContent: "center", boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
              }}
            >
              <ChevronDown size={14} />
            </button>
          )}
        </div>
      )}

      {/* Collapsed preview — show last response summary */}
      {!expanded && msgs.length > 0 && lastPreview && (
        <div onClick={() => setExpanded(true)} style={{ padding: "4px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
          <Bot size={12} color="#bbb" />
          <span style={{ fontSize: 11, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{lastPreview}{lastPreview.length >= 100 ? "..." : ""}</span>
        </div>
      )}

      {/* Recording waveform */}
      {recording && (
        <div style={{ padding: "8px 12px", display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={cancelRecording} title="Discard" style={{ padding: 6, background: "transparent", border: "none", cursor: "pointer", color: "#ef4444", display: "flex" }}>
            <Trash2 size={16} />
          </button>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#ef4444", animation: "pulse 1s infinite", flexShrink: 0 }} />
          <WaveformAnimation analyser={analyserNode} />
          <button onClick={stopAndSend} title="Send recording" style={{ padding: "6px 14px", background: "var(--primary)", color: "var(--header-text)", border: "none", borderRadius: 6, cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontSize: 12 }}>
            <Send size={13} />
          </button>
          <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }`}</style>
        </div>
      )}

      {/* Attached context + Pending files */}
      {((attachedContext && attachedContext.length > 0) || pendingFiles.length > 0) && (
        <div style={{ padding: "4px 12px", display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center" }}>
          {attachedContext?.map((ctx, i) => (
            <span key={`ctx-${i}`} style={{ fontSize: 11, padding: "2px 6px 2px 8px", background: "var(--border)", borderRadius: 4, display: "inline-flex", alignItems: "center", gap: 3, color: "var(--text)" }}>
              <AlertTriangle size={9} color="#c9971c" /> {ctx.label}
              <button onClick={() => onRemoveContext?.(ctx.path)} style={{ padding: 1, background: "transparent", border: "none", cursor: "pointer", color: "var(--text-muted)", display: "flex", marginLeft: 2 }}><X size={10} /></button>
            </span>
          ))}
          {attachedContext && attachedContext.length > 1 && (
            <button onClick={onClearContext} style={{ fontSize: 10, padding: "2px 6px", background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer" }}>clear all</button>
          )}
          {pendingFiles.map((f, i) => (
            <span key={`file-${i}`} style={{ fontSize: 11, padding: "2px 8px", background: "var(--input-bg)", borderRadius: 4, display: "inline-flex", alignItems: "center", gap: 4, color: "var(--text-secondary)" }}>
              <Paperclip size={10} /> {f.name}
              <span onClick={() => removePendingFile(i)} style={{ cursor: "pointer", color: "var(--text-muted)" }}>&times;</span>
            </span>
          ))}
        </div>
      )}

      {/* Input bar */}
      <div
        onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.background = "#f8f8ff"; }}
        onDragLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
        onDrop={(e) => { e.preventDefault(); e.currentTarget.style.background = "transparent"; const f = Array.from(e.dataTransfer.files); if (f.length > 0) setPendingFiles(prev => [...prev, ...f]); }}
        style={{ display: "flex", gap: 4, padding: "8px 12px", alignItems: "center", transition: "background 0.15s" }}
      >
        <label style={{ cursor: "pointer", padding: 4, color: "var(--text-muted)", display: "flex" }}>
          <Paperclip size={14} />
          <input ref={fileInputRef} type="file" multiple onChange={handleFileSelect} style={{ display: "none" }} />
        </label>

        {!recording && (
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
            onFocus={() => {}}
            placeholder="Message, attach files, or drop files here..."
            disabled={sending}
            style={{ flex: 1, padding: "8px 12px", fontSize: 12, border: "none", borderRadius: 6, outline: "none", background: "var(--input-bg)", color: "var(--text)" }}
          />
        )}

        {!recording && (
          <>
            <button onClick={startRecording} disabled={sending} style={{ padding: 6, background: "transparent", border: "none", color: "var(--text-secondary)", cursor: "pointer", display: "flex" }}>
              <Mic size={16} />
            </button>
            <button onClick={() => send()} disabled={sending || !hasInput} style={{ padding: "6px 12px", background: "var(--primary)", color: "var(--header-text)", border: "none", borderRadius: 6, cursor: sending || !hasInput ? "not-allowed" : "pointer", opacity: sending || !hasInput ? 0.4 : 1, display: "flex", alignItems: "center", gap: 4, fontSize: 12 }}>
              <Send size={13} />
            </button>
          </>
        )}

        {/* Secondary actions — subtle icons, same size */}
        {msgs.length > 0 && !recording && (
          <div style={{ display: "flex", gap: 0 }}>
            <button onClick={() => setExpanded(!expanded)} style={{ padding: 6, background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer", display: "flex" }} title={expanded ? "Collapse" : "Expand"}>
              {expanded ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            </button>
            <button onClick={clear} style={{ padding: 6, background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer", display: "flex" }} title="Clear history">
              <Trash2 size={13} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// --- Inputs Tab (all collected data, structured and readable) ---
function InputsTab({ data, submissionId, onAddToChat, onUpdate }: { data: Record<string, unknown>; submissionId: string; onAddToChat: (path: string, label: string) => void; onUpdate: () => void }) {
  const [fieldStatus, setFieldStatus] = useState<MissingFieldsResult | null>(null);
  useEffect(() => { fetchMissingFields(submissionId).then(setFieldStatus).catch(() => {}); }, [submissionId]);

  const fieldMap = new Map<string, { required: boolean; filled: boolean }>();
  if (fieldStatus) {
    for (const f of fieldStatus.fields) {
      fieldMap.set(f.path, { required: f.required, filled: f.filled });
    }
  }

  const ov = (data.overview || {}) as Record<string, unknown>;
  const br = (data.broker || {}) as Record<string, unknown>;
  const cov = (data.coverage || {}) as Record<string, unknown>;
  const facs = (data.facilities || []) as Array<Record<string, unknown>>;
  const lr = (data.loss_runs || {}) as Record<string, unknown>;
  const prior = (data.prior_insurance || {}) as Record<string, unknown>;
  const claims = (data.claims_history || []) as Array<Record<string, unknown>>;
  const contacts = (data.contacts || []) as Array<Record<string, unknown>>;

  const [editingField, setEditingField] = useState<{ path: string; label: string; value: string } | { path: string; label: string; value: string }[] | null>(null);

  const Row = ({ label, value, path }: { label: string; value: unknown; path?: string }) => {
    const s = str(value);
    const isEmpty = s === "\u2014" || !s;
    const status = path ? fieldMap.get(path) : undefined;
    const isRequired = status?.required ?? false;
    const isMissing = isEmpty && isRequired;

    return (
      <div className="input-row" style={{ display: "flex", alignItems: "center", padding: "3px 0", fontSize: 13, gap: 4 }}>
        <span style={{ width: 180, flexShrink: 0, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 4 }}>
          {isMissing && <AlertTriangle size={11} color="#c9971c" />}
          {label}
          {isRequired && <span style={{ color: "#c9971c", fontSize: 10 }}>*</span>}
        </span>
        <span style={{ color: isEmpty ? "var(--text-muted)" : "var(--text)", flex: 1 }}>{s}</span>
        <span className="row-actions" style={{ display: "flex", gap: 2, opacity: 0 }}>
          {path && (
            <button
              onClick={() => onAddToChat(path, label)}
              title="Add to chat"
              style={{ padding: 3, background: "transparent", border: "none", cursor: "pointer", color: "var(--text-muted)", display: "flex" }}
            >
              <Send size={11} />
            </button>
          )}
          {path && (
            <button
              onClick={() => setEditingField({ path, label, value: isEmpty ? "" : s })}
              title="Edit value"
              style={{ padding: 3, background: "transparent", border: "none", cursor: "pointer", color: "var(--text-muted)", display: "flex" }}
            >
              <Pencil size={11} />
            </button>
          )}
        </span>
        <style>{`.input-row:hover .row-actions { opacity: 1 !important; }`}</style>
      </div>
    );
  };
  const Section = ({ title, children, count }: { title: string; children: React.ReactNode; count?: number }) => (
    <div style={{ marginBottom: 28 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
        {title}
        {count !== undefined && <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 400 }}>{count}</span>}
      </div>
      {children}
    </div>
  );

  return (
    <div style={{ background: "var(--surface)", borderRadius: 8, padding: 24 }}>

      <Section title="Applicant / Insured">
        <Row label="Insured Name" value={ov.insured_name} path="overview.insured_name" />
        <Row label="DBA" value={ov.dba} path="overview.dba" />
        <Row label="FEIN" value={ov.fein} path="overview.fein" />
        <Row label="Business Type" value={ov.business_type} path="overview.business_type" />
        <Row label="Year Established" value={ov.year_established} path="overview.year_established" />
        <Row label="Employees" value={ov.number_of_employees} path="overview.number_of_employees" />
        <Row label="Annual Revenue" value={ov.annual_revenue} path="overview.annual_revenue" />
        <Row label="SIC Code" value={ov.sic_code} path="overview.sic_code" />
        <Row label="NAICS Code" value={ov.naics_code} path="overview.naics_code" />
        <Row label="Operations" value={ov.description_of_operations} path="overview.description_of_operations" />
      </Section>

      <Section title="Broker">
        <Row label="Name" value={br.name} path="broker.name" />
        <Row label="Company" value={br.company} path="broker.company" />
        <Row label="Email" value={br.email} path="broker.email" />
        <Row label="Phone" value={br.phone} path="broker.phone" />
      </Section>

      <Section title="Coverage Requested">
        <Row label="Policy Type" value={cov.policy_type} path="coverage.policy_type" />
        <Row label="Effective Date" value={cov.effective_date} path="coverage.effective_date" />
        <Row label="Expiration Date" value={cov.expiration_date} path="coverage.expiration_date" />
        <Row label="Each Occurrence" value={cov.each_occurrence_limit} path="coverage.each_occurrence_limit" />
        <Row label="General Aggregate" value={cov.general_aggregate} path="coverage.general_aggregate" />
        <Row label="Products / Comp Ops" value={cov.products_completed_ops} path="coverage.products_completed_ops" />
        <Row label="Personal & Adv. Injury" value={cov.personal_advertising_injury} path="coverage.personal_advertising_injury" />
        <Row label="Fire Damage" value={cov.fire_damage} path="coverage.fire_damage" />
        <Row label="Medical Expense" value={cov.medical_expense} path="coverage.medical_expense" />
      </Section>

      <Section title="Facilities / Locations" count={facs.length}>
        {facs.length === 0 ? (
          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>No facilities extracted</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {facs.map((f, i) => (
              <div key={i} style={{ padding: "10px 14px", background: "var(--surface-alt)", borderRadius: 6, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", marginBottom: 2 }}>
                    {[f.address, f.city, f.state, f.zip].filter(Boolean).join(", ") || "\u2014"}
                  </div>
                  {f.type && <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{str(f.type)}</div>}
                  {f.notes && <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{str(f.notes)}</div>}
                </div>
                <button onClick={() => setEditingField([
                  { path: `facilities.${i}.address`, label: "Address", value: str(f.address) === "\u2014" ? "" : str(f.address) },
                  { path: `facilities.${i}.city`, label: "City", value: str(f.city) === "\u2014" ? "" : str(f.city) },
                  { path: `facilities.${i}.state`, label: "State", value: str(f.state) === "\u2014" ? "" : str(f.state) },
                  { path: `facilities.${i}.zip`, label: "ZIP", value: str(f.zip) === "\u2014" ? "" : str(f.zip) },
                  { path: `facilities.${i}.type`, label: "Type", value: str(f.type) === "\u2014" ? "" : str(f.type) },
                ])} style={{ padding: 3, background: "transparent", border: "none", cursor: "pointer", color: "var(--text-muted)", display: "flex" }}><Pencil size={12} /></button>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="Prior Insurance">
        <Row label="Carrier" value={prior.carrier} path="prior_insurance.carrier" />
        <Row label="Policy Number" value={prior.policy_number} path="prior_insurance.policy_number" />
        <Row label="Expiration" value={prior.expiration} />
        <Row label="Premium" value={prior.premium} path="prior_insurance.premium" />
      </Section>

      <Section title="Loss Runs" count={(lr.periods as unknown[])?.length}>
        <Row label="Present" value={(lr.present as boolean) ? "Yes" : "No"} />
        <Row label="Years Covered" value={lr.years_covered} />

        {lr.summary && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12, margin: "12px 0", padding: "12px 14px", background: "var(--surface-alt)", borderRadius: 6 }}>
            {[
              { k: "total_claims", l: "Total Claims" },
              { k: "total_incurred", l: "Total Incurred" },
              { k: "total_paid", l: "Total Paid" },
              { k: "loss_ratio", l: "Loss Ratio" },
            ].map(({ k, l }) => (
              <div key={k}>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 2 }}>{l}</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text)" }}>{str((lr.summary as Record<string, unknown>)[k])}</div>
              </div>
            ))}
          </div>
        )}

        {(lr.periods as Array<Record<string, unknown>> | undefined)?.map((p, i) => (
          <div key={i} style={{ padding: "10px 14px", background: "var(--surface-alt)", borderRadius: 6, marginBottom: 6, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", marginBottom: 4 }}>{str(p.period)}</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4, fontSize: 12 }}>
                <span style={{ color: "var(--text-secondary)" }}>Carrier: {str(p.carrier)}</span>
                <span style={{ color: "var(--text-secondary)" }}>Policy: {str(p.policy_number)}</span>
                <span style={{ color: "var(--text-secondary)" }}>Status: {str(p.status)}</span>
                <span style={{ color: "var(--text-secondary)" }}>Claims: {str(p.total_claims)}</span>
                <span style={{ color: "var(--text-secondary)" }}>Incurred: {str(p.total_incurred)}</span>
                <span style={{ color: "var(--text-secondary)" }}>Paid: {str(p.total_paid)}</span>
              </div>
              {(p.open_claims as number) > 0 && <div style={{ fontSize: 12, color: "#996600", marginTop: 2 }}>{str(p.open_claims)} open claim(s)</div>}
            </div>
            <div style={{ display: "flex", gap: 2, marginLeft: 6 }}>
              <button onClick={() => onAddToChat(`loss_runs.periods.${i}`, `Loss run period ${str(p.period)}`)} style={{ padding: 3, background: "transparent", border: "none", cursor: "pointer", color: "var(--text-muted)", display: "flex" }} title="Add to chat"><Send size={11} /></button>
              <button onClick={() => setEditingField([
                { path: `loss_runs.periods.${i}.period`, label: "Period", value: str(p.period) === "\u2014" ? "" : str(p.period) },
                { path: `loss_runs.periods.${i}.carrier`, label: "Carrier", value: str(p.carrier) === "\u2014" ? "" : str(p.carrier) },
                { path: `loss_runs.periods.${i}.policy_number`, label: "Policy #", value: str(p.policy_number) === "\u2014" ? "" : str(p.policy_number) },
                { path: `loss_runs.periods.${i}.total_claims`, label: "Total Claims", value: str(p.total_claims) === "\u2014" ? "" : str(p.total_claims) },
                { path: `loss_runs.periods.${i}.total_incurred`, label: "Total Incurred", value: str(p.total_incurred) === "\u2014" ? "" : str(p.total_incurred) },
                { path: `loss_runs.periods.${i}.total_paid`, label: "Total Paid", value: str(p.total_paid) === "\u2014" ? "" : str(p.total_paid) },
                { path: `loss_runs.periods.${i}.status`, label: "Status", value: str(p.status) === "\u2014" ? "" : str(p.status) },
              ])} style={{ padding: 3, background: "transparent", border: "none", cursor: "pointer", color: "var(--text-muted)", display: "flex" }} title="Edit"><Pencil size={11} /></button>
            </div>
          </div>
        ))}
      </Section>

      <Section title="Claims History" count={claims.length}>
        {claims.length === 0 ? (
          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>No claims reported</div>
        ) : (
          claims.map((c, i) => (
            <div key={i} style={{ padding: "8px 14px", background: "var(--surface-alt)", borderRadius: 6, marginBottom: 6, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{str(c.date)}</span>
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{str(c.status)}</span>
                </div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>{str(c.description)}</div>
                {c.amount && <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", marginTop: 2 }}>{str(c.amount)}</div>}
              </div>
              <div style={{ display: "flex", gap: 2, marginLeft: 6 }}>
                <button onClick={() => onAddToChat(`claims_history.${i}`, `Claim ${str(c.date)} — ${str(c.description)}`)} style={{ padding: 3, background: "transparent", border: "none", cursor: "pointer", color: "var(--text-muted)", display: "flex" }} title="Add to chat"><Send size={11} /></button>
                <button onClick={() => setEditingField([
                  { path: `claims_history.${i}.date`, label: "Date", value: str(c.date) === "\u2014" ? "" : str(c.date) },
                  { path: `claims_history.${i}.description`, label: "Description", value: str(c.description) === "\u2014" ? "" : str(c.description) },
                  { path: `claims_history.${i}.amount`, label: "Amount", value: str(c.amount) === "\u2014" ? "" : str(c.amount) },
                  { path: `claims_history.${i}.status`, label: "Status", value: str(c.status) === "\u2014" ? "" : str(c.status) },
                ])} style={{ padding: 3, background: "transparent", border: "none", cursor: "pointer", color: "var(--text-muted)", display: "flex" }} title="Edit"><Pencil size={11} /></button>
              </div>
            </div>
          ))
        )}
      </Section>

      <Section title="Contacts" count={contacts.length}>
        {contacts.length === 0 ? (
          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>No contacts extracted</div>
        ) : (
          contacts.map((c, i) => (
            <div key={i} style={{ padding: "8px 14px", background: "var(--surface-alt)", borderRadius: 6, marginBottom: 6, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{str(c.name)}</div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                  {[c.role && str(c.role), c.email && str(c.email), c.phone && str(c.phone)].filter(v => v && v !== "\u2014").join(" · ")}
                </div>
              </div>
              <div style={{ display: "flex", gap: 2 }}>
                <button onClick={() => onAddToChat(`contacts.${i}`, `Contact: ${str(c.name)}`)} style={{ padding: 3, background: "transparent", border: "none", cursor: "pointer", color: "var(--text-muted)", display: "flex" }} title="Add to chat"><Send size={11} /></button>
                <button onClick={() => setEditingField([
                  { path: `contacts.${i}.name`, label: "Name", value: str(c.name) === "\u2014" ? "" : str(c.name) },
                  { path: `contacts.${i}.role`, label: "Role", value: str(c.role) === "\u2014" ? "" : str(c.role) },
                  { path: `contacts.${i}.email`, label: "Email", value: str(c.email) === "\u2014" ? "" : str(c.email) },
                  { path: `contacts.${i}.phone`, label: "Phone", value: str(c.phone) === "\u2014" ? "" : str(c.phone) },
                ])} style={{ padding: 3, background: "transparent", border: "none", cursor: "pointer", color: "var(--text-muted)", display: "flex" }} title="Edit"><Pencil size={11} /></button>
              </div>
            </div>
          ))
        )}
      </Section>

      {/* Edit field modal */}
      {editingField && (
        <EditFieldModal
          field={editingField}
          submissionId={submissionId}
          onSave={() => { setEditingField(null); onUpdate(); }}
          onClose={() => setEditingField(null)}
        />
      )}
    </div>
  );
}

function EditFieldModal({ field, submissionId, onSave, onClose }: { field: { path: string; label: string; value: string } | { path: string; label: string; value: string }[]; submissionId: string; onSave: () => void; onClose: () => void }) {
  const fields = Array.isArray(field) ? field : [field];
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(fields.map(f => [f.path, f.value]))
  );
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      for (const f of fields) {
        if (values[f.path] !== f.value) {
          await patchExtractedData(submissionId, f.path, values[f.path]);
        }
      }
      onSave();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "var(--surface)", borderRadius: 8, padding: 20, width: 440 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>{fields.length === 1 ? fields[0].label : "Edit"}</span>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", display: "flex" }}><X size={16} /></button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
          {fields.map(f => (
            <div key={f.path}>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 3 }}>{f.label}</div>
              <input
                value={values[f.path] || ""}
                onChange={e => setValues(v => ({ ...v, [f.path]: e.target.value }))}
                onKeyDown={e => e.key === "Enter" && fields.length === 1 && handleSave()}
                autoFocus={f === fields[0]}
                style={{ width: "100%", padding: "7px 10px", fontSize: 13, border: "none", background: "var(--input-bg)", borderRadius: 6, outline: "none", color: "var(--text)" }}
              />
            </div>
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
          <button onClick={onClose} style={{ padding: "6px 14px", fontSize: 12, background: "transparent", border: "none", borderRadius: 4, cursor: "pointer", color: "var(--text-muted)" }}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={{ padding: "6px 14px", fontSize: 12, background: "var(--primary)", color: "var(--header-text)", border: "none", borderRadius: 4, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.5 : 1 }}>{saving ? "Saving..." : "Save"}</button>
        </div>
      </div>
    </div>
  );
}

// --- All Documents Tab (inbound attachments + generated/uploaded) ---
function AllDocumentsTab({ submission }: { submission: Submission }) {
  const [docs, setDocs] = useState<DocumentMeta[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetchDocuments(submission.id).then(r => { setDocs(r.documents); setLoaded(true); }).catch(() => setLoaded(true));
  }, [submission.id]);

  const inbound = submission.attachments;
  const hasAny = inbound.length > 0 || docs.length > 0;

  if (!loaded) return <div style={{ padding: 20, color: "var(--text-muted)", fontSize: 13 }}>Loading...</div>;

  if (!hasAny) return (
    <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
      <FileText size={28} style={{ color: "var(--text-muted)" }} style={{ marginBottom: 8 }} />
      <div>No documents associated with this submission yet.</div>
    </div>
  );

  return (
    <div>
      {/* Inbound attachments */}
      {inbound.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <SH text={`Inbound Attachments (${inbound.length})`} />
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {inbound.map((att, i) => {
              const url = getAttachmentUrl(submission.id, att.filename);
              const isPdf = att.filename.toLowerCase().endsWith(".pdf");
              return (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "var(--surface-alt)", borderRadius: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <FileText size={14} style={{ color: "var(--text-muted)" }} />
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)" }}>{att.filename}</div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{(att.size_bytes / 1024).toFixed(1)} KB · {att.content_type}</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 4 }}>
                    {isPdf && <a href={url} target="_blank" rel="noopener noreferrer" style={{ ...BTN, textDecoration: "none" }}><ExternalLink size={11} /> Open</a>}
                    <a href={url} download style={{ ...BTN, textDecoration: "none" }}>Download</a>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Generated / Uploaded documents */}
      {docs.length > 0 && (
        <div>
          <SH text={`Generated & Uploaded (${docs.length})`} />
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {docs.map((doc, i) => {
              const url = getDocumentUrl(submission.id, doc.filename);
              const isPdf = doc.filename.toLowerCase().endsWith(".pdf");
              return (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "var(--surface-alt)", borderRadius: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <FileText size={14} style={{ color: "var(--text-muted)" }} />
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)" }}>{doc.filename}</div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)", display: "flex", gap: 6 }}>
                        <span style={{ padding: "0 4px", background: "#ebebeb", borderRadius: 3 }}>{DOC_TYPE_LABELS[doc.doc_type] || doc.doc_type}</span>
                        <span>{(doc.size_bytes / 1024).toFixed(1)} KB</span>
                        <span>{new Date(doc.created_at).toLocaleDateString()}</span>
                        {doc.notes && <span>{doc.notes}</span>}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 4 }}>
                    {isPdf && <a href={url} target="_blank" rel="noopener noreferrer" style={{ ...BTN, textDecoration: "none" }}><ExternalLink size={11} /> Open</a>}
                    <a href={url} download style={{ ...BTN, textDecoration: "none" }}>Download</a>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// --- Outcomes Tab (was Documents — generate policies, quotes, etc.) ---
const DOC_TYPE_LABELS: Record<string, string> = {
  policy: "Policy", quote: "Quote", binder: "Binder", endorsement: "Endorsement",
  certificate: "Certificate", invoice: "Invoice", loss_runs: "Loss Runs",
  application: "Application", correspondence: "Correspondence", other: "Other",
};

function DocumentsTab({ submissionId, hasExtraction }: { submissionId: string; hasExtraction: boolean }) {
  const [docs, setDocs] = useState<DocumentMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadType, setUploadType] = useState("other");
  const [uploadNotes, setUploadNotes] = useState("");

  const load = useCallback(async () => {
    try { const r = await fetchDocuments(submissionId); setDocs(r.documents); } catch { /* */ }
    finally { setLoading(false); }
  }, [submissionId]);

  useEffect(() => { load(); }, [load]);

  const handleGenerate = async (docType: string) => {
    setGenerating(docType);
    try { await generateDocument(submissionId, docType); await load(); }
    finally { setGenerating(null); }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try { await uploadDocument(submissionId, file, uploadType, uploadNotes); setUploadNotes(""); await load(); }
    finally { setUploading(false); e.target.value = ""; }
  };

  const handleDelete = async (filename: string) => {
    await deleteDocument(submissionId, filename);
    await load();
  };

  const GENERATE_OPTIONS = [
    { type: "quote", label: "Quote Proposal", desc: "Pricing proposal for the broker" },
    { type: "policy", label: "Policy Declaration", desc: "Full policy dec page" },
    { type: "binder", label: "Binder", desc: "Temporary proof of coverage" },
    { type: "certificate", label: "Certificate of Insurance", desc: "COI for third parties" },
  ];

  if (loading) return <div style={{ padding: 20, color: "var(--text-muted)", fontSize: 13 }}>Loading...</div>;

  return (
    <div>
      {/* Generate section — primary action */}
      <div style={{ border: "none", borderRadius: 6, padding: 20, marginBottom: 20, background: "var(--surface)" }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>Generate Documents</div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16 }}>
          {hasExtraction
            ? "Generate PDF documents from the extracted submission data."
            : "Run extraction first to generate documents from the submission data."}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {GENERATE_OPTIONS.map((opt) => {
            const isGenerating = generating === opt.type;
            return (
              <button
                key={opt.type}
                onClick={() => handleGenerate(opt.type)}
                disabled={!hasExtraction || isGenerating}
                style={{
                  padding: "12px 16px",
                  textAlign: "left",
                  cursor: !hasExtraction || isGenerating ? "not-allowed" : "pointer",
                  background: isGenerating ? "var(--surface-hover)" : "var(--surface)",
                  border: "none",
                  borderRadius: 6,
                  opacity: !hasExtraction ? 0.5 : 1,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Sparkles size={14} color={isGenerating ? "var(--text-muted)" : "var(--text)"} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>
                    {isGenerating ? "Generating..." : opt.label}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{opt.desc}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Generated documents list */}
      {docs.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
            Generated & Uploaded ({docs.length})
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {docs.map((doc, i) => {
              const url = getDocumentUrl(submissionId, doc.filename);
              const isPdf = doc.filename.toLowerCase().endsWith(".pdf");
              return (
                <div key={i} style={{ border: "none", borderRadius: 6, padding: "10px 14px", background: "var(--surface)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <FileText size={16} style={{ color: "var(--text-muted)" }} />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{doc.filename}</div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)", display: "flex", gap: 6, alignItems: "center" }}>
                        <span style={{ padding: "1px 6px", background: "var(--input-bg)", borderRadius: 3, fontWeight: 600 }}>{DOC_TYPE_LABELS[doc.doc_type] || doc.doc_type}</span>
                        <span>{(doc.size_bytes / 1024).toFixed(1)} KB</span>
                        <span>{new Date(doc.created_at).toLocaleDateString()}</span>
                        {doc.notes && <span style={{ color: "var(--text-secondary)" }}>{doc.notes}</span>}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 4 }}>
                    {isPdf && <a href={url} target="_blank" rel="noopener noreferrer" style={{ ...BTN, textDecoration: "none" }}><ExternalLink size={11} /> Open</a>}
                    <a href={url} download style={{ ...BTN, textDecoration: "none" }}><Copy size={11} /> Download</a>
                    <button onClick={() => handleDelete(doc.filename)} style={{ ...BTN, color: "var(--text-muted)" }}><XCircle size={11} /></button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Upload — secondary, collapsible */}
      <div style={{ borderTop: "none", paddingTop: 12 }}>
        <button onClick={() => setShowUpload(!showUpload)} style={{ ...BTN, color: "var(--text-muted)", fontSize: 12 }}>
          {showUpload ? <ChevronDown size={12} /> : <ChevronRight size={12} />} Upload existing file
        </button>
        {showUpload && (
          <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <select value={uploadType} onChange={(e) => setUploadType(e.target.value)} style={{ padding: "6px 10px", fontSize: 12, border: "none", borderRadius: 4, background: "var(--surface)", color: "var(--text)" }}>
              {Object.entries(DOC_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <input value={uploadNotes} onChange={(e) => setUploadNotes(e.target.value)} placeholder="Notes" style={{ padding: "6px 10px", fontSize: 12, border: "none", borderRadius: 4, flex: 1, minWidth: 120 }} />
            <label style={{ ...BTN, cursor: "pointer", opacity: uploading ? 0.5 : 1 }}>
              <FileText size={11} /> {uploading ? "Uploading..." : "Choose File"}
              <input type="file" onChange={handleUpload} disabled={uploading} style={{ display: "none" }} />
            </label>
          </div>
        )}
      </div>
    </div>
  );
}

// --- Tab button ---
const TABS = ["Overview", "Inputs", "Activity", "Documents", "Outcomes", "Raw Data"] as const;
type Tab = (typeof TABS)[number];
function TabBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return <button onClick={onClick} style={{ padding: "8px 16px", fontSize: 12, cursor: "pointer", background: "transparent", color: active ? "var(--text)" : "var(--text-muted)", border: "none", borderBottom: active ? "2px solid var(--accent)" : "2px solid transparent", fontWeight: active ? 700 : 400, marginBottom: -1 }}>{label}</button>;
}

// --- Main ---
export function SubmissionDetail({ submission, onRefresh }: Props) {
  const nav = useNavigate();
  const [tab, setTab] = useState<Tab>("Overview");
  const [chatContext, setChatContext] = useState<Array<{ path: string; label: string }>>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const s = submission;
  const data = s.extracted_data as Record<string, unknown> | null;
  const hasData = data && !("error" in data && !("overview" in data));
  const missing = hasData ? (ext(data, "missing_fields") as string[] | null) ?? [] : [];

  const handleUpdate = useCallback(() => { onRefresh?.(); setRefreshKey(k => k + 1); }, [onRefresh]);
  const handleReExtract = useCallback(async () => { await reExtractSubmission(s.id); onRefresh?.(); }, [s.id, onRefresh]);

  const si = statusInfo(s.status);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: "auto", paddingBottom: 8 }}>
        <div style={{ padding: 20, maxWidth: 860, margin: "0 auto" }}>
          {/* Header with status */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <h2 style={{ margin: 0, fontSize: 17, color: "var(--text)", fontWeight: 700 }}>{s.subject || "(no subject)"}</h2>
                <span style={{ fontSize: 11, padding: "2px 10px", borderRadius: 10, background: si.bg, color: si.color, fontWeight: 600 }}>{si.label}</span>
              </div>
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                {s.id.slice(0, 8)} · {s.broker_email} · {new Date(s.created_at).toLocaleString()} · {timeAgo(s.created_at)}
                {(() => {
                  const otherIds = (s.related_submission_ids || []).filter(id => id !== s.id);
                  if (otherIds.length === 0) return null;
                  return (
                    <span style={{ marginLeft: 8, fontSize: 11, color: "var(--text-muted)" }}>
                      Linked to {otherIds.map((id, i) => (
                        <span key={id}>
                          {i > 0 && ", "}
                          <span onClick={() => nav(`/submissions/${id}`)} style={{ textDecoration: "underline", cursor: "pointer", color: "var(--text-secondary)" }}>{id.slice(0, 8)}</span>
                        </span>
                      ))}
                    </span>
                  );
                })()}
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div style={{ marginBottom: 20 }}>
            {TABS.map(t => <TabBtn key={t} label={t} active={tab === t} onClick={() => setTab(t)} />)}
          </div>

          {/* Content */}
          {tab === "Overview" && (
            <OverviewTab key={refreshKey} submission={s} onUpdate={handleUpdate} onReExtract={handleReExtract} />
          )}

          {tab === "Inputs" && hasData && data && <InputsTab key={refreshKey} data={data} submissionId={s.id} onAddToChat={(path, label) => setChatContext(prev => prev.some(c => c.path === path) ? prev : [...prev, { path, label }])} onUpdate={handleUpdate} />}
          {tab === "Inputs" && !hasData && <div style={{ padding: 20, color: "var(--text-muted)" }}>No extracted data yet.</div>}

          {tab === "Activity" && <ActivityTab key={refreshKey} submission={s} hasMissing={missing.length > 0} />}

          {tab === "Documents" && <AllDocumentsTab submission={s} />}

          {tab === "Outcomes" && <DocumentsTab submissionId={s.id} hasExtraction={!!hasData} />}

          {tab === "Raw Data" && (hasData && data ? <JsonViewer data={data} /> : <div style={{ padding: 20, color: "var(--text-muted)", textAlign: "center" }}>No extracted data.</div>)}
        </div>
      </div>

      {/* Floating chat at the bottom — always visible */}
      <div style={{ borderTop: "none", background: "var(--surface)", flexShrink: 0 }}>
        <div style={{ maxWidth: 860, margin: "0 auto" }}>
          <FloatingChat key={s.id} submissionId={s.id} onDataUpdated={handleUpdate} attachedContext={chatContext} onClearContext={() => setChatContext([])} onRemoveContext={(path) => setChatContext(prev => prev.filter(c => c.path !== path))} />
        </div>
      </div>
    </div>
  );
}
