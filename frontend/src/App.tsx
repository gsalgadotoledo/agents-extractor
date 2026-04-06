import { useCallback, useEffect, useRef, useState } from "react";
import { BrowserRouter, Routes, Route, useParams, useNavigate } from "react-router-dom";
import { fetchSubmissions, fetchSyncState, triggerGmailSync } from "./api";
import { Header } from "./components/Header";
import { SettingsModal } from "./components/SettingsModal";
import { Sidebar } from "./components/Sidebar";
import { SubmissionDetail } from "./components/SubmissionDetail";
import { SubmissionList } from "./components/SubmissionList";
import type { Submission } from "./types";

function AppShell() {
  const { id: routeId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const intervalRef = useRef<number | null>(null);

  const loadSubmissions = useCallback(async () => {
    try {
      const subs = await fetchSubmissions();
      subs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setSubmissions(subs);
      setError(null);
    } catch {
      setError("Failed to load submissions. Is the API running?");
    }
  }, []);

  const loadSyncState = useCallback(async () => {
    try {
      const state = await fetchSyncState();
      if (state && typeof state.last_sync_at === "string") setLastSync(state.last_sync_at);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    loadSubmissions();
    loadSyncState();
    intervalRef.current = window.setInterval(() => { loadSubmissions(); loadSyncState(); }, 10000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [loadSubmissions, loadSyncState]);

  const handleSync = async () => {
    setSyncing(true);
    try { await triggerGmailSync(); await loadSubmissions(); await loadSyncState(); }
    catch { setError("Gmail sync failed."); }
    finally { setSyncing(false); }
  };

  const handleSelect = (id: string) => navigate(`/submissions/${id}`);
  const selected = submissions.find((s) => s.id === routeId) ?? null;

  return (
    <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', height: "100vh", display: "flex", flexDirection: "column", background: "var(--bg)", color: "var(--text)" }}>
      <Header submissionCount={submissions.length} onSync={handleSync} syncing={syncing} lastSync={lastSync} onOpenSettings={() => setSettingsOpen(true)} />
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      {error && <div style={{ padding: "8px 24px", background: "#FFF3CD", color: "#856404", fontSize: 13 }}>{error}</div>}

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        <div style={{ width: 340, minWidth: 280, borderRight: "1px solid var(--border)", overflowY: "auto", background: "var(--surface)" }}>
          <SubmissionList submissions={submissions} selectedId={routeId || null} onSelect={handleSelect} />
        </div>
        <div style={{ flex: 1, overflowY: "auto", background: "var(--bg)" }}>
          {selected ? (
            <SubmissionDetail submission={selected} onRefresh={loadSubmissions} />
          ) : (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-muted)", fontSize: 14 }}>
              Select a submission to view details
            </div>
          )}
        </div>
        {selected && (
          <div style={{ width: 220, minWidth: 200, overflowY: "auto", background: "var(--surface)", borderLeft: "1px solid var(--border)" }}>
            <Sidebar submission={selected} onRefresh={loadSubmissions} />
          </div>
        )}
      </div>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AppShell />} />
        <Route path="/submissions/:id" element={<AppShell />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
