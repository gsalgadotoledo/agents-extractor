import { RefreshCw, Settings } from "lucide-react";

interface Props {
  submissionCount: number;
  onSync: () => void;
  syncing: boolean;
  lastSync: string | null;
  onOpenSettings: () => void;
}

export function Header({ submissionCount, onSync, syncing, lastSync, onOpenSettings }: Props) {
  return (
    <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 20px", borderBottom: "1px solid var(--border)", background: "var(--header-bg)", color: "var(--header-text)" }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 16, fontWeight: 700, letterSpacing: -0.3 }}>Submission Platform</h1>
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
          {submissionCount} submission{submissionCount !== 1 ? "s" : ""}
          {lastSync && ` · Synced ${new Date(lastSync).toLocaleTimeString()}`}
        </span>
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <button onClick={onOpenSettings} style={{ padding: "6px 12px", fontSize: 12, cursor: "pointer", background: "transparent", color: "var(--text-muted)", border: "1px solid var(--border)", borderRadius: 4, display: "flex", alignItems: "center", gap: 4 }}>
          <Settings size={13} /> Settings
        </button>
        <button onClick={onSync} disabled={syncing} style={{ padding: "6px 12px", fontSize: 12, cursor: syncing ? "not-allowed" : "pointer", background: "var(--accent)", color: "var(--header-bg)", border: "none", borderRadius: 4, display: "flex", alignItems: "center", gap: 4, opacity: syncing ? 0.6 : 1 }}>
          <RefreshCw size={13} /> {syncing ? "Syncing..." : "Sync Gmail"}
        </button>
      </div>
    </header>
  );
}
