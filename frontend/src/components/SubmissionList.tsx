import { FileText } from "lucide-react";
import type { Submission } from "../types";

const statusColors: Record<string, string> = {
  received: "#666",
  ack_sent: "#666",
  extracting: "#996600",
  extracted: "#333",
  validated: "#333",
  needs_review: "#333",
  auto_policy_ready: "#333",
  policy_created: "#333",
  completed: "#1a7f37",
  failed: "#cf222e",
};

interface Props {
  submissions: Submission[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function SubmissionList({ submissions, selectedId, onSelect }: Props) {
  if (submissions.length === 0) {
    return <div style={{ padding: 24, color: "var(--text-muted)", fontSize: 13 }}>No submissions yet.</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {submissions.map((sub) => (
        <div
          key={sub.id}
          onClick={() => onSelect(sub.id)}
          style={{
            padding: "12px 16px",
            cursor: "pointer",
            background: selectedId === sub.id ? "var(--surface-hover)" : "transparent",
            borderBottom: "1px solid var(--border)",
            borderLeft: selectedId === sub.id ? "3px solid var(--accent)" : "3px solid transparent",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
            <span style={{ fontWeight: 600, fontSize: 13, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 240 }}>
              {sub.subject || "(no subject)"}
            </span>
            <span style={{ fontSize: 11, color: statusColors[sub.status] || "#999" }}>{sub.status}</span>
          </div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{sub.broker_email}</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2, display: "flex", alignItems: "center", gap: 4 }}>
            {sub.id.slice(0, 8)} · {new Date(sub.created_at).toLocaleString()}
            {sub.attachments.length > 0 && <><FileText size={11} /> {sub.attachments.length}</>}
          </div>
        </div>
      ))}
    </div>
  );
}
