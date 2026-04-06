export interface Attachment {
  filename: string;
  content_type: string;
  size_bytes: number;
  storage_path: string;
}

export interface Submission {
  id: string;
  status: string;
  message_id: string;
  broker_email: string;
  broker_name: string | null;
  subject: string;
  body_text: string;
  body_html: string | null;
  attachments: Attachment[];
  extracted_data: Record<string, unknown> | null;
  extraction_confidence: number | null;
  validation_result: Record<string, unknown> | null;
  review_required: boolean;
  review_reason: string | null;
  application_id: string | null;
  policy_id: string | null;
  related_submission_ids: string[];
  relation_reason: string | null;
  assigned_to: string | null;
  persona_id: string | null;
  approved_by: string | null;
  approved_at: string | null;
  sent_emails: Array<Record<string, unknown>>;
  chat_history: Array<Record<string, unknown>>;
  created_at: string;
  updated_at: string;
}
