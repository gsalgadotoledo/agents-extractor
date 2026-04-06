import { BrowserRouter, Routes, Route } from "react-router-dom";
import { SubmissionView } from "./SubmissionView";

export const BRAND = {
  primary: "#7BA4D4",
  primaryDark: "#5B8BC4",
  primaryLight: "#B8D4F0",
  bg: "#f8fafc",
  text: "#1e293b",
  textLight: "#64748b",
  textMuted: "#94a3b8",
};

export function Logo() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <svg width="28" height="36" viewBox="0 0 32 40" fill="none">
        <path d="M16 0C16 0 0 18 0 26C0 33.7 7.2 40 16 40C24.8 40 32 33.7 32 26C32 18 16 0 16 0Z" fill={BRAND.primaryLight} />
        <path d="M16 4C16 4 4 19 4 26C4 31.5 9.4 36 16 36C22.6 36 28 31.5 28 26C28 19 16 4 16 4Z" fill={BRAND.primary} opacity="0.5" />
      </svg>
      <div>
        <div style={{ fontSize: 16, fontWeight: 700, color: BRAND.primary, letterSpacing: 1, lineHeight: 1.1 }}>Apex Insurance</div>
        <div style={{ fontSize: 9, fontWeight: 600, color: BRAND.primaryLight, letterSpacing: 2.5, textTransform: "uppercase" }}>Insurance Group</div>
      </div>
    </div>
  );
}

function NotFound() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: BRAND.bg }}>
      <Logo />
      <h1 style={{ fontSize: 22, fontWeight: 700, color: BRAND.text, marginTop: 32 }}>Submission Not Found</h1>
      <p style={{ fontSize: 14, color: BRAND.textLight, marginTop: 8 }}>The link you followed may be invalid or expired.</p>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/portal/:id" element={<SubmissionView />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
