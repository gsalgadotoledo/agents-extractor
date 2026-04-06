import { useState } from "react";
import { generateDraft, sendComposedEmail } from "../api";

const TONE_OPTIONS = [
  { id: "professional", label: "Professional", desc: "Formal and courteous" },
  { id: "friendly", label: "Friendly", desc: "Warm but professional" },
  { id: "concise", label: "Concise", desc: "Brief and direct" },
  { id: "detailed", label: "Detailed", desc: "Thorough explanations" },
  { id: "mirror", label: "Mirror sender", desc: "Match their tone" },
  { id: "custom", label: "Custom...", desc: "Define your own" },
];

interface Props {
  submissionId: string;
  brokerEmail: string;
  subject: string;
}

export function EmailComposer({ submissionId, brokerEmail, subject }: Props) {
  const [to, setTo] = useState(brokerEmail);
  const [subj, setSubj] = useState(`Re: ${subject}`);
  const [body, setBody] = useState("");
  const [tone, setTone] = useState("professional");
  const [customTone, setCustomTone] = useState("");
  const [showTone, setShowTone] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [instruction, setInstruction] = useState("");

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const result = await generateDraft(
        submissionId,
        tone === "custom" ? "professional" : tone,
        instruction,
        tone === "custom" ? customTone : undefined
      );
      setBody(result.draft);
    } catch (e) {
      setBody(`Error generating draft: ${e}`);
    } finally {
      setGenerating(false);
    }
  };

  const handleSend = async () => {
    if (!body.trim()) return;
    setSending(true);
    try {
      await sendComposedEmail(submissionId, to, subj, body, body);
      setSent(true);
      setTimeout(() => setSent(false), 3000);
    } finally {
      setSending(false);
    }
  };

  const selectedTone = TONE_OPTIONS.find((t) => t.id === tone);

  return (
    <div style={{ border: "1px solid #d0d7de", borderRadius: 6, background: "#fff", overflow: "hidden" }}>
      {/* Toolbar */}
      <div style={{ padding: "8px 12px", background: "#f6f8fa", borderBottom: "1px solid #d0d7de", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>Reply</span>
          <div style={{ position: "relative" }}>
            <button
              onClick={() => setShowTone(!showTone)}
              style={{
                padding: "3px 10px",
                fontSize: 11,
                cursor: "pointer",
                background: "#fff",
                border: "1px solid #d0d7de",
                borderRadius: 12,
                color: "#57606a",
              }}
            >
              Tone: {selectedTone?.label || tone}
            </button>
            {showTone && (
              <div
                style={{
                  position: "absolute",
                  top: "100%",
                  left: 0,
                  marginTop: 4,
                  background: "#fff",
                  border: "1px solid #d0d7de",
                  borderRadius: 6,
                  padding: 4,
                  zIndex: 10,
                  width: 240,
                  boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                }}
              >
                {TONE_OPTIONS.map((t) => (
                  <div
                    key={t.id}
                    onClick={() => { setTone(t.id); if (t.id !== "custom") setShowTone(false); }}
                    style={{
                      padding: "6px 10px",
                      fontSize: 12,
                      cursor: "pointer",
                      borderRadius: 4,
                      background: tone === t.id ? "#f0f0f0" : "transparent",
                    }}
                  >
                    <div style={{ fontWeight: 600 }}>{t.label}</div>
                    <div style={{ color: "#8b949e", fontSize: 11 }}>{t.desc}</div>
                  </div>
                ))}
                {tone === "custom" && (
                  <div style={{ padding: "6px 10px" }}>
                    <input
                      value={customTone}
                      onChange={(e) => setCustomTone(e.target.value)}
                      placeholder="Describe the tone..."
                      style={{ width: "100%", padding: "4px 8px", fontSize: 11, border: "1px solid #d0d7de", borderRadius: 3 }}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        <button
          onClick={handleGenerate}
          disabled={generating}
          style={{
            padding: "4px 12px",
            fontSize: 11,
            cursor: generating ? "not-allowed" : "pointer",
            background: "#2da44e",
            color: "#fff",
            border: "none",
            borderRadius: 3,
            opacity: generating ? 0.6 : 1,
          }}
        >
          {generating ? "Generating..." : "\u{2728} Generate Draft"}
        </button>
      </div>

      {/* To / Subject */}
      <div style={{ padding: "8px 12px", borderBottom: "1px solid #eee", display: "flex", gap: 8, alignItems: "center" }}>
        <span style={{ fontSize: 12, color: "#8b949e", minWidth: 50 }}>To</span>
        <input value={to} onChange={(e) => setTo(e.target.value)} style={{ flex: 1, padding: "4px 8px", fontSize: 12, border: "1px solid #d0d7de", borderRadius: 3 }} />
      </div>
      <div style={{ padding: "8px 12px", borderBottom: "1px solid #eee", display: "flex", gap: 8, alignItems: "center" }}>
        <span style={{ fontSize: 12, color: "#8b949e", minWidth: 50 }}>Subject</span>
        <input value={subj} onChange={(e) => setSubj(e.target.value)} style={{ flex: 1, padding: "4px 8px", fontSize: 12, border: "1px solid #d0d7de", borderRadius: 3 }} />
      </div>

      {/* Optional instruction for AI */}
      <div style={{ padding: "8px 12px", borderBottom: "1px solid #eee", display: "flex", gap: 8, alignItems: "center" }}>
        <span style={{ fontSize: 12, color: "#8b949e", minWidth: 50 }}>AI hint</span>
        <input
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          placeholder="e.g. Ask for loss runs and FEIN number"
          style={{ flex: 1, padding: "4px 8px", fontSize: 12, border: "1px solid #d0d7de", borderRadius: 3, color: "#57606a" }}
        />
      </div>

      {/* Body editor */}
      <div style={{ padding: 12 }}>
        {/* Mini formatting bar */}
        <div style={{ display: "flex", gap: 2, marginBottom: 6 }}>
          {[
            { label: "B", cmd: "bold" },
            { label: "I", cmd: "italic" },
            { label: "U", cmd: "underline" },
            { label: "UL", cmd: "insertUnorderedList" },
            { label: "OL", cmd: "insertOrderedList" },
          ].map(({ label, cmd }) => (
            <button
              key={cmd}
              onClick={() => document.execCommand(cmd)}
              style={{
                width: 28,
                height: 24,
                fontSize: 11,
                fontWeight: label === "B" ? 700 : label === "I" ? 400 : 400,
                fontStyle: label === "I" ? "italic" : "normal",
                textDecoration: label === "U" ? "underline" : "none",
                cursor: "pointer",
                background: "#fff",
                border: "1px solid #d0d7de",
                borderRadius: 3,
                color: "#57606a",
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {body ? (
          <div
            contentEditable
            suppressContentEditableWarning
            onBlur={(e) => setBody(e.currentTarget.innerText)}
            style={{
              minHeight: 150,
              maxHeight: 300,
              overflow: "auto",
              padding: 10,
              border: "1px solid #d0d7de",
              borderRadius: 4,
              fontSize: 13,
              lineHeight: 1.6,
              outline: "none",
              whiteSpace: "pre-wrap",
            }}
            dangerouslySetInnerHTML={{ __html: body.replace(/\n/g, "<br>") }}
          />
        ) : (
          <div
            style={{
              minHeight: 150,
              padding: 10,
              border: "1px solid #d0d7de",
              borderRadius: 4,
              fontSize: 13,
              color: "#8b949e",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            Click "Generate Draft" to create an AI-assisted response, or type here
          </div>
        )}
      </div>

      {/* Send bar */}
      <div style={{ padding: "8px 12px", background: "#f6f8fa", borderTop: "1px solid #d0d7de", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 11, color: "#8b949e" }}>
          {sent && <span style={{ color: "#1a7f37" }}>&#10003; Email sent to {to}</span>}
        </div>
        <button
          onClick={handleSend}
          disabled={sending || !body.trim()}
          style={{
            padding: "6px 20px",
            fontSize: 13,
            fontWeight: 600,
            cursor: sending || !body.trim() ? "not-allowed" : "pointer",
            background: "#2da44e",
            color: "#fff",
            border: "none",
            borderRadius: 4,
            opacity: sending || !body.trim() ? 0.5 : 1,
          }}
        >
          {sending ? "Sending..." : "Send Email"}
        </button>
      </div>
    </div>
  );
}
