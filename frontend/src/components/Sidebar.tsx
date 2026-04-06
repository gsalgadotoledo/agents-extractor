import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, CheckCircle, Circle, Copy, ExternalLink, Link, Shield, Trash2, User } from "lucide-react";
import { approveSubmission, assignPersona, assignSubmission, deleteSubmission, fetchMissingFields, fetchPersonas, fetchUsers, getAvatarUrl, type MissingFieldsResult, type Persona, type UserInfo } from "../api";
import type { Submission } from "../types";

function fmtDate(d: string | null | undefined): string {
  if (!d) return "";
  const date = new Date(d);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHrs = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHrs / 24);

  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const day = date.getDate();
  const suffix = day === 1 || day === 21 || day === 31 ? "st" : day === 2 || day === 22 ? "nd" : day === 3 || day === 23 ? "rd" : "th";
  const hrs = date.getHours();
  const ampm = hrs >= 12 ? "pm" : "am";
  const hr12 = hrs % 12 || 12;
  const min = date.getMinutes().toString().padStart(2, "0");
  const formatted = `${months[date.getMonth()]} ${day}${suffix} at ${hr12}:${min}${ampm}`;

  let ago = "";
  if (diffMins < 1) ago = "just now";
  else if (diffMins < 60) ago = `${diffMins}m ago`;
  else if (diffHrs < 24) ago = `${diffHrs}h ago`;
  else if (diffDays < 30) ago = `${diffDays}d ago`;
  else ago = `${Math.floor(diffDays / 30)}mo ago`;

  return `${formatted}, ${ago}`;
}

interface Props {
  submission: Submission;
  onRefresh: () => void;
}

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

export function Sidebar({ submission, onRefresh }: Props) {
  const navigate = useNavigate();
  const [users, setUsers] = useState<{ representatives: UserInfo[]; approvers: UserInfo[] } | null>(null);
  const [fieldStatus, setFieldStatus] = useState<MissingFieldsResult | null>(null);
  const [personasList, setPersonasList] = useState<Persona[]>([]);
  const [assigning, setAssigning] = useState(false);
  const [approving, setApproving] = useState(false);

  useEffect(() => { fetchUsers().then(setUsers).catch(() => {}); }, []);
  useEffect(() => { fetchPersonas().then(setPersonasList).catch(() => {}); }, []);
  useEffect(() => { fetchMissingFields(submission.id).then(setFieldStatus).catch(() => {}); }, [submission.id, submission.updated_at]);

  const si = statusInfo(submission.status);
  const assignedUser = users?.representatives.find(r => r.id === submission.assigned_to)
    || users?.approvers.find(r => r.id === submission.assigned_to);
  const approverUser = users?.approvers.find(r => r.id === submission.approved_by);

  const handleAssign = async (repId: string) => {
    setAssigning(true);
    try { await assignSubmission(submission.id, repId); onRefresh(); }
    finally { setAssigning(false); }
  };

  const handleApprove = async (approverId: string) => {
    setApproving(true);
    try { await approveSubmission(submission.id, approverId); onRefresh(); }
    finally { setApproving(false); }
  };

  return (
    <div style={{ padding: 16, fontSize: 12 }}>
      {/* Status */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>Status</div>
        <span style={{ padding: "4px 12px", borderRadius: 6, background: si.bg, color: si.color, fontWeight: 700, fontSize: 12 }}>{si.label}</span>
      </div>

      {/* Assigned to */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>Assigned to</div>
        {assignedUser ? (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <User size={14} color="#666" />
            <div>
              <div style={{ fontWeight: 600, color: "var(--text)" }}>{assignedUser.name}</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{assignedUser.role}</div>
            </div>
          </div>
        ) : (
          <div style={{ color: "var(--text-muted)" }}>Unassigned</div>
        )}
        {users && (
          <select
            value={submission.assigned_to || ""}
            onChange={(e) => e.target.value && handleAssign(e.target.value)}
            disabled={assigning}
            style={{ marginTop: 6, width: "100%", padding: "4px 6px", fontSize: 11, border: "none", background: "var(--input-bg)", borderRadius: 4, color: "var(--text)" }}
          >
            <option value="">Reassign...</option>
            {users.representatives.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        )}
      </div>

      {/* Responder Persona */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>Responder</div>
        {(() => {
          const active = personasList.find(p => p.id === submission.persona_id);
          return active ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              {active.photo ? (
                <img src={getAvatarUrl(active.photo)} alt={active.name} style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover" }} />
              ) : (
                <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--accent)", color: "var(--header-text)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700 }}>
                  {active.name.split(" ").map(w => w[0]).join("").slice(0, 2)}
                </div>
              )}
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)" }}>{active.name}</div>
                <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{active.title}</div>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--surface-alt)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <User size={14} style={{ color: "var(--text-muted)" }} />
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)" }}>Underwriting Team</div>
                <div style={{ fontSize: 10, color: "var(--text-muted)" }}>Default (no persona)</div>
              </div>
            </div>
          );
        })()}
        <select
          value={submission.persona_id || "default"}
          onChange={async (e) => { await assignPersona(submission.id, e.target.value); onRefresh(); }}
          style={{ width: "100%", padding: "4px 6px", fontSize: 11, border: "none", background: "var(--input-bg)", borderRadius: 4, color: "var(--text)" }}
        >
          <option value="default">Underwriting Team (default)</option>
          {personasList.map(p => <option key={p.id} value={p.id}>{p.name} - {p.tone}</option>)}
        </select>
      </div>

      {/* Approval */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>Approval</div>
        {submission.approved_by && approverUser ? (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <CheckCircle size={14} color="#0f5132" />
            <div>
              <div style={{ fontWeight: 600, color: "#0f5132" }}>Approved</div>
              <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{approverUser.name}</div>
              {submission.approved_at && <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{fmtDate(submission.approved_at)}</div>}
            </div>
          </div>
        ) : (
          <>
            <div style={{ color: "var(--text-muted)", marginBottom: 6 }}>Pending approval</div>
            {users && (
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {users.approvers.map(a => (
                  <button
                    key={a.id}
                    onClick={() => handleApprove(a.id)}
                    disabled={approving}
                    style={{ padding: "5px 10px", fontSize: 11, cursor: "pointer", background: "var(--surface)", border: "none", borderRadius: 4, color: "var(--text)", textAlign: "left", display: "flex", alignItems: "center", gap: 4 }}
                  >
                    <Shield size={11} /> Approve as {a.name}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Related */}
      {submission.related_submission_ids.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>Related</div>
          {submission.related_submission_ids.map(id => (
            <button
              key={id}
              onClick={() => navigate(`/submissions/${id}`)}
              style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--text-secondary)", padding: "3px 0", background: "transparent", border: "none", cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 2 }}
            >
              <ExternalLink size={10} /> {id.slice(0, 8)}
            </button>
          ))}
          {submission.relation_reason && <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 4 }}>{submission.relation_reason}</div>}
        </div>
      )}

      {/* Validation */}
      {fieldStatus && (fieldStatus.total_required > 0 || fieldStatus.total_recommended > 0) && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
            Validation
          </div>

          {/* Progress */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <div style={{ flex: 1, height: 3, borderRadius: 2, background: "var(--border)", overflow: "hidden" }}>
              <div style={{ width: `${fieldStatus.completion_pct * 100}%`, height: "100%", background: "var(--accent)", borderRadius: 2 }} />
            </div>
            <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{Math.round(fieldStatus.completion_pct * 100)}%</span>
          </div>

          {/* Required missing */}
          {fieldStatus.total_required > 0 && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 10, color: "#c9971c", fontWeight: 600, marginBottom: 4, display: "flex", alignItems: "center", gap: 3 }}>
                <AlertTriangle size={10} /> {fieldStatus.total_required} required
              </div>
              {fieldStatus.required_missing.map((f, i) => (
                <div key={i} style={{ fontSize: 11, color: "var(--text-secondary)", padding: "1px 0", paddingLeft: 14 }}>{f.label}</div>
              ))}
            </div>
          )}

          {/* Recommended missing */}
          {fieldStatus.total_recommended > 0 && (
            <div>
              <div style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 600, marginBottom: 4, display: "flex", alignItems: "center", gap: 3 }}>
                <Circle size={10} /> {fieldStatus.total_recommended} recommended
              </div>
              {fieldStatus.recommended_missing.map((f, i) => (
                <div key={i} style={{ fontSize: 11, color: "var(--text-muted)", padding: "1px 0", paddingLeft: 14 }}>{f.label}</div>
              ))}
            </div>
          )}

          {/* All complete */}
          {fieldStatus.total_required === 0 && fieldStatus.total_recommended === 0 && (
            <div style={{ fontSize: 11, color: "#0f5132", display: "flex", alignItems: "center", gap: 4 }}>
              <CheckCircle size={11} /> All fields complete
            </div>
          )}
        </div>
      )}

      {/* Meta */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>Details</div>
        <div style={{ color: "var(--text-secondary)", lineHeight: 1.6 }}>
          <div>ID: {submission.id.slice(0, 8)}</div>
          <div>Created: {fmtDate(submission.created_at)}</div>
          <div>Updated: {fmtDate(submission.updated_at)}</div>
          {submission.extraction_confidence !== null && <div>Extraction confidence: {Math.round(submission.extraction_confidence * 100)}%</div>}
          <div>Attachments: {submission.attachments.length}</div>
        </div>
      </div>

      {/* Client Portal */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>Client Portal</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <a
            href={`http://localhost:5174/portal/${submission.id}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: 11, color: "var(--text-secondary)", textDecoration: "underline", textUnderlineOffset: 2, display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}
          >
            <ExternalLink size={10} /> Open portal view
          </a>
          <button
            onClick={() => {
              navigator.clipboard.writeText(`http://localhost:5174/portal/${submission.id}`);
            }}
            style={{ fontSize: 11, color: "var(--text-muted)", background: "transparent", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, padding: 0 }}
          >
            <Copy size={10} /> Copy portal link
          </button>
        </div>
      </div>

      {/* Archive */}
      <div style={{ marginTop: 20, paddingTop: 12 }}>
        <button
          onClick={async () => {
            if (confirm("Archive this submission? It will be hidden from all lists.")) {
              await deleteSubmission(submission.id);
              onRefresh();
            }
          }}
          style={{ width: "100%", padding: "6px 10px", fontSize: 11, cursor: "pointer", background: "transparent", border: "none", borderRadius: 4, color: "var(--text-muted)", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}
          onMouseEnter={e => { e.currentTarget.style.color = "#999"; }}
          onMouseLeave={e => { e.currentTarget.style.color = "#bbb"; }}
        >
          <Trash2 size={12} /> Archive submission
        </button>
      </div>
    </div>
  );
}
