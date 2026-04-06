import { useEffect, useState } from "react";
import { Pencil, Plus, Trash2, User } from "lucide-react";
import {
  createPersona, deletePersona, fetchPersonas, fetchSettings,
  generatePersona, getAvatarUrl, resetPrompt, updatePersona, updateSettings,
  type AppSettings, type Persona,
} from "../api";
import { useTheme } from "../ThemeContext";
import { THEMES } from "../theme";

interface Props {
  open: boolean;
  onClose: () => void;
}

const MODEL_LABELS: Record<string, string> = {
  "claude-sonnet-4-20250514": "Sonnet 4 — Fast, good accuracy",
  "claude-opus-4-20250514": "Opus 4 — Best accuracy, slower",
  "claude-haiku-4-20250514": "Haiku 4 — Fastest, lower accuracy",
};

type SettingsTab = "Theme" | "Personas" | "Models" | "Keys" | "Prompts" | "Schema";

export function SettingsModal({ open, onClose }: Props) {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const { themeKey, setThemeKey } = useTheme();
  const [tab, setTab] = useState<SettingsTab>("Theme");
  const [selectedModel, setSelectedModel] = useState("");
  const [anthropicKey, setAnthropicKey] = useState("");
  const [openaiKey, setOpenaiKey] = useState("");
  const [prompt, setPrompt] = useState("");
  const [fromName, setFromName] = useState("");
  const [fromAddress, setFromAddress] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [personasList, setPersonasList] = useState<Persona[]>([]);
  const [editingPersona, setEditingPersona] = useState<Partial<Persona> | null>(null);
  const [isNewPersona, setIsNewPersona] = useState(false);

  useEffect(() => {
    if (open) {
      fetchSettings().then((s) => {
        setSettings(s);
        setSelectedModel(s.extraction_model);
        setPrompt(s.extraction_prompt);
        setFromName(s.email_from_name || "");
        setFromAddress(s.email_from_address || "");
        setAnthropicKey("");
        setOpenaiKey("");
        setSaved(false);
      });
      fetchPersonas().then(setPersonasList).catch(() => {});
    }
  }, [open]);

  if (!open || !settings) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates: Record<string, string> = {};
      if (selectedModel !== settings.extraction_model) updates.extraction_model = selectedModel;
      if (anthropicKey) updates.anthropic_api_key = anthropicKey;
      if (openaiKey) updates.openai_api_key = openaiKey;
      if (prompt !== settings.extraction_prompt) updates.extraction_prompt = prompt;
      if (fromName !== settings.email_from_name) updates.email_from_name = fromName;
      if (fromAddress !== settings.email_from_address) updates.email_from_address = fromAddress;
      if (Object.keys(updates).length > 0) {
        await updateSettings(updates);
        const refreshed = await fetchSettings();
        setSettings(refreshed);
        setSelectedModel(refreshed.extraction_model);
        setPrompt(refreshed.extraction_prompt);
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally { setSaving(false); }
  };

  const handleResetPrompt = async () => {
    await resetPrompt();
    const refreshed = await fetchSettings();
    setPrompt(refreshed.extraction_prompt);
    setSettings(refreshed);
  };

  // Shared styles using CSS vars
  const inputStyle: React.CSSProperties = { width: "100%", padding: "8px 12px", fontSize: 13, border: "none", background: "var(--input-bg)", borderRadius: 6, color: "var(--text)", outline: "none" };
  const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4 };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--surface)", color: "var(--text)", borderRadius: 10, padding: 24, width: 600, maxHeight: "85vh", overflow: "auto" }}>

        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>Settings</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "var(--text-muted)" }}>&times;</button>
        </div>

        {/* Tabs — no borders, just underline */}
        <div style={{ marginBottom: 20, display: "flex", gap: 2 }}>
          {(["Theme", "Personas", "Models", "Keys", "Prompts", "Schema"] as SettingsTab[]).map((t) => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: "8px 14px", fontSize: 12, cursor: "pointer",
              background: "transparent", border: "none",
              color: tab === t ? "var(--text)" : "var(--text-muted)",
              borderBottom: tab === t ? "2px solid var(--accent)" : "2px solid transparent",
              fontWeight: tab === t ? 700 : 400,
            }}>{t}</button>
          ))}
        </div>

        {/* Theme tab */}
        {tab === "Theme" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {Object.entries(THEMES).map(([key, t]) => (
              <label key={key} onClick={() => setThemeKey(key)} style={{
                display: "flex", alignItems: "center", gap: 12, padding: "12px 14px",
                borderRadius: 8, cursor: "pointer",
                background: themeKey === key ? "var(--surface-hover)" : "transparent",
              }}>
                <input type="radio" name="theme" checked={themeKey === key} onChange={() => setThemeKey(key)} />
                <div style={{ display: "flex", gap: 3 }}>
                  {[t.headerBg, t.surface, t.bg, t.accent].map((c, i) => (
                    <div key={i} style={{ width: 20, height: 20, borderRadius: 4, background: c }} />
                  ))}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{t.name}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{key === "light" ? "Default light interface" : "Dark interface with blue accents"}</div>
                </div>
              </label>
            ))}
          </div>
        )}

        {/* Personas tab */}
        {tab === "Personas" && (
          <div>
            {/* Persona editor */}
            {editingPersona ? (
              <PersonaEditor
                persona={editingPersona}
                isNew={isNewPersona}
                onSave={async (data) => {
                  if (isNewPersona) {
                    await createPersona(data as Omit<Persona, "id" | "active">);
                  } else if (editingPersona.id) {
                    await updatePersona(editingPersona.id, data);
                  }
                  setEditingPersona(null);
                  fetchPersonas().then(setPersonasList);
                }}
                onCancel={() => setEditingPersona(null)}
              />
            ) : (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{personasList.length} persona{personasList.length !== 1 ? "s" : ""}</span>
                  <div style={{ display: "flex", gap: 6 }}>
                    <GeneratePersonaButton onGenerated={() => fetchPersonas().then(setPersonasList)} />
                    <button onClick={() => { setEditingPersona({ name: "", title: "", tone: "professional", personality: "", signature: "", greeting_style: "Hi,", closing_style: "", email_name: "", email_address: "" }); setIsNewPersona(true); }} style={{ padding: "5px 12px", fontSize: 12, cursor: "pointer", background: "var(--surface-alt)", color: "var(--text-secondary)", border: "none", borderRadius: 4, display: "flex", alignItems: "center", gap: 4 }}>
                      <Plus size={12} /> Manual
                    </button>
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {personasList.map((p) => (
                    <div key={p.id} style={{ padding: "12px 14px", borderRadius: 8, background: "var(--surface-alt)", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                        {p.photo ? (
                          <img src={getAvatarUrl(p.photo)} alt={p.name} style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
                        ) : (
                          <div style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--accent)", color: "var(--header-text)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, flexShrink: 0 }}>
                            {p.name.split(" ").map(w => w[0]).join("").slice(0, 2)}
                          </div>
                        )}
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600 }}>{p.name}</div>
                          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{p.title}</div>
                          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                            Tone: {p.tone} {p.personality && <span>· {p.personality.slice(0, 60)}{p.personality.length > 60 ? "..." : ""}</span>}
                          </div>
                          {p.email_name && <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{p.email_name}</div>}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 4 }}>
                        <button onClick={() => { setEditingPersona(p); setIsNewPersona(false); }} style={{ padding: 4, background: "transparent", border: "none", cursor: "pointer", color: "var(--text-muted)", display: "flex" }}><Pencil size={13} /></button>
                        <button onClick={async () => { await deletePersona(p.id); fetchPersonas().then(setPersonasList); }} style={{ padding: 4, background: "transparent", border: "none", cursor: "pointer", color: "var(--text-muted)", display: "flex" }}><Trash2 size={13} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Models tab */}
        {tab === "Models" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {settings.available_models.map((model) => (
              <label key={model} style={{
                display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
                borderRadius: 8, cursor: "pointer",
                background: selectedModel === model ? "var(--surface-hover)" : "transparent",
              }}>
                <input type="radio" name="model" value={model} checked={selectedModel === model} onChange={() => setSelectedModel(model)} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{model}</div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{MODEL_LABELS[model] || ""}</div>
                </div>
              </label>
            ))}
          </div>
        )}

        {/* Keys tab */}
        {tab === "Keys" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label style={labelStyle}>Anthropic API Key {settings.has_anthropic_key && <span style={{ color: "var(--accent)" }}>configured</span>}</label>
              <input type="password" value={anthropicKey} onChange={(e) => setAnthropicKey(e.target.value)} placeholder={settings.has_anthropic_key ? "leave blank to keep" : "sk-ant-..."} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>OpenAI API Key {settings.has_openai_key && <span style={{ color: "var(--accent)" }}>configured</span>}</label>
              <input type="password" value={openaiKey} onChange={(e) => setOpenaiKey(e.target.value)} placeholder={settings.has_openai_key ? "leave blank to keep" : "sk-..."} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Email Sender Name</label>
              <input value={fromName} onChange={(e) => setFromName(e.target.value)} placeholder="Processing Team at Apex Insurance" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Email Sender Address</label>
              <input value={fromAddress} onChange={(e) => setFromAddress(e.target.value)} placeholder="processing@apex-demo.com" style={inputStyle} />
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", padding: 8, background: "var(--surface-alt)", borderRadius: 6 }}>
              Settings are stored in memory only. For persistence, set them in .env
            </div>
          </div>
        )}

        {/* Prompts tab */}
        {tab === "Prompts" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <label style={labelStyle}>Extraction System Prompt</label>
              <button onClick={handleResetPrompt} style={{ fontSize: 11, padding: "3px 8px", cursor: "pointer", background: "var(--input-bg)", border: "none", borderRadius: 4, color: "var(--text-secondary)" }}>Reset to Default</button>
            </div>
            <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={18} style={{ ...inputStyle, fontFamily: "monospace", resize: "vertical", lineHeight: 1.5 }} />
          </div>
        )}

        {/* Schema tab */}
        {tab === "Schema" && (
          <div>
            <label style={{ ...labelStyle, marginBottom: 8 }}>Extraction JSON Schema (read-only)</label>
            <pre style={{ background: "var(--surface-alt)", padding: 12, borderRadius: 6, fontSize: 11, fontFamily: "monospace", overflow: "auto", maxHeight: "50vh", lineHeight: 1.4, color: "var(--text-secondary)" }}>
              {JSON.stringify(settings.extraction_schema, null, 2)}
            </pre>
          </div>
        )}

        {/* Save bar */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20 }}>
          {saved && <span style={{ fontSize: 13, color: "var(--text)", alignSelf: "center" }}>Saved</span>}
          <button onClick={onClose} style={{ padding: "8px 16px", fontSize: 13, cursor: "pointer", background: "transparent", border: "none", borderRadius: 4, color: "var(--text-muted)" }}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={{ padding: "8px 16px", fontSize: 13, cursor: saving ? "not-allowed" : "pointer", background: "var(--accent)", color: "var(--header-text)", border: "none", borderRadius: 4, opacity: saving ? 0.5 : 1 }}>{saving ? "Saving..." : "Save Changes"}</button>
        </div>
      </div>
    </div>
  );
}

const TONE_OPTIONS = ["professional", "friendly", "concise", "detailed", "mirror"];

function PersonaEditor({ persona, isNew, onSave, onCancel }: { persona: Partial<Persona>; isNew: boolean; onSave: (data: Partial<Persona>) => void; onCancel: () => void }) {
  const [form, setForm] = useState({ ...persona });
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));
  const inputStyle: React.CSSProperties = { width: "100%", padding: "7px 10px", fontSize: 13, border: "none", background: "var(--input-bg)", borderRadius: 6, color: "var(--text)", outline: "none" };
  const labelStyle: React.CSSProperties = { fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 3 };

  return (
    <div>
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>{isNew ? "New Persona" : `Edit ${persona.name}`}</div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
        <div><label style={labelStyle}>Name</label><input value={form.name || ""} onChange={e => set("name", e.target.value)} placeholder="Sarah Chen" style={inputStyle} /></div>
        <div><label style={labelStyle}>Title</label><input value={form.title || ""} onChange={e => set("title", e.target.value)} placeholder="Processing Specialist" style={inputStyle} /></div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
        <div><label style={labelStyle}>Email Display Name</label><input value={form.email_name || ""} onChange={e => set("email_name", e.target.value)} placeholder="Sarah Chen - Apex Insurance" style={inputStyle} /></div>
        <div><label style={labelStyle}>Email Address</label><input value={form.email_address || ""} onChange={e => set("email_address", e.target.value)} placeholder="sarah@apex-demo.com" style={inputStyle} /></div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={labelStyle}>Tone</label>
        <div style={{ display: "flex", gap: 6 }}>
          {TONE_OPTIONS.map(t => (
            <button key={t} onClick={() => set("tone", t)} style={{ padding: "4px 12px", fontSize: 11, cursor: "pointer", background: form.tone === t ? "var(--accent)" : "var(--input-bg)", color: form.tone === t ? "var(--header-text)" : "var(--text-secondary)", border: "none", borderRadius: 4 }}>{t}</button>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={labelStyle}>Personality</label>
        <textarea value={form.personality || ""} onChange={e => set("personality", e.target.value)} rows={3} placeholder="Warm and approachable. Uses first names. Explains things clearly..." style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
        <div><label style={labelStyle}>Greeting Style</label><input value={form.greeting_style || ""} onChange={e => set("greeting_style", e.target.value)} placeholder="Hi {broker_first_name}," style={inputStyle} /></div>
        <div><label style={labelStyle}>Closing Style</label><input value={form.closing_style || ""} onChange={e => set("closing_style", e.target.value)} placeholder="Let me know if you have questions." style={inputStyle} /></div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>Signature</label>
        <textarea value={form.signature || ""} onChange={e => set("signature", e.target.value)} rows={3} placeholder={"Best regards,\nSarah Chen\nProcessing Specialist\nApex Insurance Group"} style={{ ...inputStyle, resize: "vertical", fontFamily: "monospace", lineHeight: 1.5 }} />
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
        <button onClick={onCancel} style={{ padding: "6px 14px", fontSize: 12, background: "transparent", border: "none", borderRadius: 4, cursor: "pointer", color: "var(--text-muted)" }}>Cancel</button>
        <button onClick={() => onSave(form)} style={{ padding: "6px 14px", fontSize: 12, background: "var(--accent)", color: "var(--header-text)", border: "none", borderRadius: 4, cursor: "pointer" }}>{isNew ? "Create" : "Save"}</button>
      </div>
    </div>
  );
}

function GeneratePersonaButton({ onGenerated }: { onGenerated: () => void }) {
  const [generating, setGenerating] = useState(false);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await generatePersona();
      onGenerated();
    } catch (e) {
      alert(`Generation failed: ${e}`);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <button
      onClick={handleGenerate}
      disabled={generating}
      style={{
        padding: "5px 12px", fontSize: 12, cursor: generating ? "not-allowed" : "pointer",
        background: "var(--accent)", color: "var(--header-text)", border: "none", borderRadius: 4,
        display: "flex", alignItems: "center", gap: 4, opacity: generating ? 0.6 : 1,
      }}
    >
      <User size={12} /> {generating ? "Generating..." : "Generate Persona"}
    </button>
  );
}
