import { useState } from "react";

interface Props {
  data: Record<string, unknown>;
}

function countEntries(val: unknown): string {
  if (Array.isArray(val)) return `${val.length} item${val.length !== 1 ? "s" : ""}`;
  if (val && typeof val === "object") return `${Object.keys(val).length} field${Object.keys(val).length !== 1 ? "s" : ""}`;
  return "";
}

function SectionNode({ name, value, depth }: { name: string; value: unknown; depth: number }) {
  const [expanded, setExpanded] = useState(depth < 1);
  const isExpandable = value !== null && typeof value === "object";
  const count = isExpandable ? countEntries(value) : "";

  return (
    <div style={{ marginLeft: depth > 0 ? 16 : 0 }}>
      <div onClick={() => isExpandable && setExpanded(!expanded)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 0", cursor: isExpandable ? "pointer" : "default", userSelect: "none" }}>
        {isExpandable ? <span style={{ fontSize: 10, color: "var(--text-muted)", width: 12, textAlign: "center" }}>{expanded ? "\u25BC" : "\u25B6"}</span> : <span style={{ width: 12 }} />}
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text)" }}>{name}</span>
        {count && <span style={{ fontSize: 11, color: "var(--text-muted)", background: "var(--input-bg)", padding: "1px 6px", borderRadius: 8 }}>{count}</span>}
        {!isExpandable && (
          <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
            {value === null ? <span style={{ color: "var(--text-muted)" }}>null</span> :
             typeof value === "boolean" ? <span style={{ color: "var(--text)", fontWeight: 600 }}>{String(value)}</span> :
             typeof value === "number" ? <span style={{ color: "var(--text)", fontWeight: 600 }}>{value}</span> :
             <span style={{ color: "var(--text)" }}>"{String(value)}"</span>}
          </span>
        )}
      </div>
      {expanded && isExpandable && (
        <div>
          {Array.isArray(value)
            ? value.map((item, i) => <SectionNode key={i} name={`[${i}]`} value={item} depth={depth + 1} />)
            : Object.entries(value as Record<string, unknown>).map(([k, v]) => <SectionNode key={k} name={k} value={v} depth={depth + 1} />)}
        </div>
      )}
    </div>
  );
}

export function JsonViewer({ data }: Props) {
  const [mode, setMode] = useState<"tree" | "raw">("raw");
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ background: "var(--surface)", borderRadius: 8, padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ display: "flex", gap: 4 }}>
          <button onClick={() => setMode("raw")} style={{ padding: "4px 12px", fontSize: 11, cursor: "pointer", background: mode === "raw" ? "#111" : "transparent", color: mode === "raw" ? "#fff" : "#888", border: "none", borderRadius: 4, fontWeight: mode === "raw" ? 600 : 400 }}>Raw</button>
          <button onClick={() => setMode("tree")} style={{ padding: "4px 12px", fontSize: 11, cursor: "pointer", background: mode === "tree" ? "#111" : "transparent", color: mode === "tree" ? "#fff" : "#888", border: "none", borderRadius: 4, fontWeight: mode === "tree" ? 600 : 400 }}>Tree</button>
        </div>
        <button onClick={handleCopy} style={{ padding: "4px 12px", fontSize: 11, cursor: "pointer", background: "transparent", border: "none", borderRadius: 4, color: copied ? "#0f5132" : "#888" }}>
          {copied ? "\u2713 Copied" : "Copy JSON"}
        </button>
      </div>

      <div style={{ maxHeight: "60vh", overflow: "auto", padding: 12, background: "var(--surface-alt)", borderRadius: 6 }}>
        {mode === "tree" ? (
          <div>{Object.entries(data).map(([key, value]) => <SectionNode key={key} name={key} value={value} depth={0} />)}</div>
        ) : (
          <pre style={{ fontSize: 11, fontFamily: "monospace", margin: 0, lineHeight: 1.4, whiteSpace: "pre-wrap", color: "var(--text)" }}>{JSON.stringify(data, null, 2)}</pre>
        )}
      </div>
    </div>
  );
}
