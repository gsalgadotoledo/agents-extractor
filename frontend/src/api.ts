import type { Submission } from "./types";

const API_BASE = "http://localhost:8000";

// --- Users ---

export interface UserInfo { id: string; name: string; role: string }

export async function fetchUsers(): Promise<{ representatives: UserInfo[]; approvers: UserInfo[] }> {
  const res = await fetch(`${API_BASE}/submissions/meta/users`);
  if (!res.ok) throw new Error(`Failed: ${res.status}`);
  return res.json();
}

export async function assignSubmission(submissionId: string, repId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/submissions/${submissionId}/assign`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rep_id: repId }),
  });
  if (!res.ok) throw new Error(`Assign failed: ${res.status}`);
}

export interface FieldStatus {
  path: string;
  label: string;
  section: string;
  required: boolean;
  filled: boolean;
  value: string | null;
}

export interface MissingFieldsResult {
  fields: FieldStatus[];
  required_missing: FieldStatus[];
  recommended_missing: FieldStatus[];
  total_required: number;
  total_recommended: number;
  total_fields: number;
  filled_fields: number;
  completion_pct: number;
  has_facilities: boolean;
  has_loss_runs: boolean;
}

export async function fetchMissingFields(submissionId: string): Promise<MissingFieldsResult> {
  const res = await fetch(`${API_BASE}/submissions/${submissionId}/missing-fields`);
  if (!res.ok) throw new Error(`Failed: ${res.status}`);
  return res.json();
}

export async function approveSubmission(submissionId: string, approverId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/submissions/${submissionId}/approve`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ approver_id: approverId }),
  });
  if (!res.ok) throw new Error(`Approve failed: ${res.status}`);
}

export async function deleteSubmission(submissionId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/submissions/${submissionId}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`Delete failed: ${res.status}`);
}

// --- Personas ---

export interface Persona {
  id: string;
  name: string;
  title: string;
  photo: string;
  email_name: string;
  email_address: string;
  tone: string;
  personality: string;
  signature: string;
  greeting_style: string;
  closing_style: string;
  active: boolean;
}

export async function fetchPersonas(): Promise<Persona[]> {
  const res = await fetch(`${API_BASE}/personas/`);
  if (!res.ok) throw new Error(`Failed: ${res.status}`);
  const data = await res.json();
  return data.personas;
}

export async function createPersona(p: Omit<Persona, "id" | "active">): Promise<Persona> {
  const res = await fetch(`${API_BASE}/personas/`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(p) });
  if (!res.ok) throw new Error(`Failed: ${res.status}`);
  return res.json();
}

export async function updatePersona(id: string, p: Partial<Persona>): Promise<Persona> {
  const res = await fetch(`${API_BASE}/personas/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(p) });
  if (!res.ok) throw new Error(`Failed: ${res.status}`);
  return res.json();
}

export async function deletePersona(id: string): Promise<void> {
  await fetch(`${API_BASE}/personas/${id}`, { method: "DELETE" });
}

export async function assignPersona(submissionId: string, personaId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/submissions/${submissionId}/extracted-data`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: "__persona_id", value: personaId }),
  });
  // Use a direct submission update instead
  await fetch(`${API_BASE}/submissions/${submissionId}/assign-persona`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ persona_id: personaId }),
  });
}

export async function generatePersona(): Promise<Persona> {
  const res = await fetch(`${API_BASE}/personas/generate`, { method: "POST" });
  if (!res.ok) throw new Error(`Generate failed: ${res.status}`);
  return res.json();
}

export function getAvatarUrl(photo: string): string {
  if (!photo) return "";
  return `${API_BASE}/personas${photo}`;
}

export async function fetchSubmissions(): Promise<Submission[]> {
  const res = await fetch(`${API_BASE}/submissions/`);
  if (!res.ok) throw new Error(`Failed to fetch submissions: ${res.status}`);
  return res.json();
}

export async function fetchSubmission(id: string): Promise<Submission> {
  const res = await fetch(`${API_BASE}/submissions/${id}`);
  if (!res.ok) throw new Error(`Failed to fetch submission: ${res.status}`);
  return res.json();
}

export async function triggerGmailSync(): Promise<{
  submission_ids: string[];
  count: number;
}> {
  const res = await fetch(`${API_BASE}/gmail/sync`, { method: "POST" });
  if (!res.ok) throw new Error(`Failed to sync: ${res.status}`);
  return res.json();
}

export async function fetchSyncState(): Promise<Record<string, unknown> | null> {
  const res = await fetch(`${API_BASE}/gmail/sync-state`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to fetch sync state: ${res.status}`);
  return res.json();
}

// --- Settings ---

export interface AppSettings {
  extraction_model: string;
  available_models: string[];
  gmail_address: string;
  gmail_reconciler_interval_seconds: number;
  extraction_prompt: string;
  extraction_schema: Record<string, unknown>;
  has_anthropic_key: boolean;
  has_openai_key: boolean;
  email_from_name: string;
  email_from_address: string;
}

export async function fetchSettings(): Promise<AppSettings> {
  const res = await fetch(`${API_BASE}/settings/`);
  if (!res.ok) throw new Error(`Failed to fetch settings: ${res.status}`);
  return res.json();
}

export async function updateSettings(updates: {
  extraction_model?: string;
  anthropic_api_key?: string;
  openai_api_key?: string;
  extraction_prompt?: string;
}): Promise<Record<string, unknown>> {
  const res = await fetch(`${API_BASE}/settings/`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error(`Failed to update settings: ${res.status}`);
  return res.json();
}

export async function resetPrompt(): Promise<void> {
  await fetch(`${API_BASE}/settings/reset-prompt`, { method: "POST" });
}

// --- Submission data ---

export async function patchExtractedData(
  submissionId: string,
  path: string,
  value: string | number | boolean | null
): Promise<void> {
  const res = await fetch(
    `${API_BASE}/submissions/${submissionId}/extracted-data`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path, value }),
    }
  );
  if (!res.ok) throw new Error(`Failed to patch: ${res.status}`);
}

export async function reExtractSubmission(
  submissionId: string
): Promise<void> {
  const res = await fetch(
    `${API_BASE}/submissions/${submissionId}/extract`,
    { method: "POST" }
  );
  if (!res.ok) throw new Error(`Failed to re-extract: ${res.status}`);
}

// --- Attachments ---

export function getAttachmentUrl(
  submissionId: string,
  filename: string
): string {
  return `${API_BASE}/submissions/${submissionId}/attachments/${encodeURIComponent(filename)}`;
}

export async function fetchAttachmentText(
  submissionId: string,
  filename: string
): Promise<{ filename: string; text: string; chars: number }> {
  const res = await fetch(
    `${API_BASE}/submissions/${submissionId}/attachments/${encodeURIComponent(filename)}/text`
  );
  if (!res.ok) throw new Error(`Failed: ${res.status}`);
  return res.json();
}

// --- Chat ---

export interface ChatToolStep {
  tool: string;
  args?: Record<string, unknown>;
  result?: string;
  type: "call" | "result";
}

export async function loadChatHistory(
  submissionId: string
): Promise<{ history: Array<Record<string, unknown>> }> {
  const res = await fetch(`${API_BASE}/submissions/${submissionId}/chat`);
  if (!res.ok) throw new Error(`Failed: ${res.status}`);
  return res.json();
}

export async function sendChatMessage(
  submissionId: string,
  message: string,
  files?: File[],
  audioBlob?: Blob,
): Promise<{ reply: string; updated_fields: string[]; transcription: string | null; files_processed: string[]; tool_steps: ChatToolStep[]; email_drafts: Array<{ to: string; subject: string; body: string; submission_id: string }> }> {
  const form = new FormData();
  form.append("message", message);
  if (files) {
    for (const f of files) form.append("files", f);
  }
  if (audioBlob) {
    form.append("audio", audioBlob, "recording.webm");
  }
  const res = await fetch(
    `${API_BASE}/submissions/${submissionId}/chat`,
    { method: "POST", body: form }
  );
  if (!res.ok) throw new Error(`Chat failed: ${res.status}`);
  return res.json();
}

export async function clearChatHistory(submissionId: string): Promise<void> {
  await fetch(`${API_BASE}/submissions/${submissionId}/chat`, {
    method: "DELETE",
  });
}

// --- Compose ---

export async function fetchTones(): Promise<{ tones: Record<string, string> }> {
  const res = await fetch(`${API_BASE}/submissions/_/tones`);
  if (!res.ok) throw new Error(`Failed: ${res.status}`);
  return res.json();
}

export async function generateDraft(
  submissionId: string,
  tone: string,
  instruction: string,
  customTone?: string
): Promise<{ draft: string; tone: string }> {
  const res = await fetch(`${API_BASE}/submissions/${submissionId}/compose/draft`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tone, instruction, custom_tone: customTone || null }),
  });
  if (!res.ok) throw new Error(`Draft failed: ${res.status}`);
  return res.json();
}

export async function sendComposedEmail(
  submissionId: string,
  to: string,
  subject: string,
  bodyHtml: string,
  bodyText: string
): Promise<{ sent: boolean }> {
  const res = await fetch(`${API_BASE}/submissions/${submissionId}/compose/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ to, subject, body_html: bodyHtml, body_text: bodyText }),
  });
  if (!res.ok) throw new Error(`Send failed: ${res.status}`);
  return res.json();
}

// --- Documents ---

export interface DocumentMeta {
  filename: string;
  doc_type: string;
  size_bytes: number;
  created_at: string;
  notes: string;
}

export async function fetchDocuments(
  submissionId: string
): Promise<{ documents: DocumentMeta[]; count: number }> {
  const res = await fetch(`${API_BASE}/submissions/${submissionId}/documents`);
  if (!res.ok) throw new Error(`Failed: ${res.status}`);
  return res.json();
}

export function getDocumentUrl(submissionId: string, filename: string): string {
  return `${API_BASE}/submissions/${submissionId}/documents/${encodeURIComponent(filename)}`;
}

export async function uploadDocument(
  submissionId: string,
  file: File,
  docType: string,
  notes: string = ""
): Promise<void> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(
    `${API_BASE}/submissions/${submissionId}/documents?doc_type=${encodeURIComponent(docType)}&notes=${encodeURIComponent(notes)}`,
    { method: "POST", body: form }
  );
  if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
}

export async function deleteDocument(
  submissionId: string,
  filename: string
): Promise<void> {
  await fetch(
    `${API_BASE}/submissions/${submissionId}/documents/${encodeURIComponent(filename)}`,
    { method: "DELETE" }
  );
}

export async function generateDocument(
  submissionId: string,
  docType: string,
  notes: string = ""
): Promise<{ ok: boolean; filename: string; doc_type: string }> {
  const res = await fetch(
    `${API_BASE}/submissions/${submissionId}/documents/generate`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ doc_type: docType, notes }),
    }
  );
  if (!res.ok) throw new Error(`Generate failed: ${res.status}`);
  return res.json();
}
