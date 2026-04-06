import { useRef, useState } from "react";
import { clearChatHistory, sendChatMessage } from "../api";

interface Message {
  role: "user" | "assistant";
  content: string;
  updatedFields?: string[];
}

interface Props {
  submissionId: string;
  onDataUpdated: () => void;
}

export function ChatPanel({ submissionId, onDataUpdated }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) return;

    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setInput("");
    setSending(true);

    try {
      const result = await sendChatMessage(submissionId, text);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: result.reply,
          updatedFields: result.updated_fields,
        },
      ]);
      if (result.updated_fields.length > 0) {
        onDataUpdated();
      }
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Error: ${e}` },
      ]);
    } finally {
      setSending(false);
      setTimeout(
        () => bottomRef.current?.scrollIntoView({ behavior: "smooth" }),
        50
      );
    }
  };

  const handleClear = async () => {
    await clearChatHistory(submissionId);
    setMessages([]);
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        maxHeight: "60vh",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 8,
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 600 }}>
          Chat with Agent
        </div>
        {messages.length > 0 && (
          <button
            onClick={handleClear}
            style={{
              fontSize: 11,
              padding: "3px 8px",
              cursor: "pointer",
              background: "#fff",
              border: "1px solid #ddd",
              borderRadius: 3,
              color: "#888",
            }}
          >
            Clear
          </button>
        )}
      </div>

      {/* Messages */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          border: "1px solid #e5e7eb",
          borderRadius: 6,
          padding: 12,
          marginBottom: 8,
          background: "#fafafa",
          minHeight: 200,
        }}
      >
        {messages.length === 0 && (
          <div style={{ color: "#aaa", fontSize: 13, textAlign: "center", paddingTop: 40 }}>
            Ask the agent to update fields, fix data, or explain the extraction.
            <br />
            <span style={{ fontSize: 12 }}>
              e.g. "Set the insured name to Acme Corp" or "What fields are missing?"
            </span>
          </div>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
              marginBottom: 8,
            }}
          >
            <div
              style={{
                maxWidth: "85%",
                padding: "8px 12px",
                borderRadius: 8,
                fontSize: 13,
                lineHeight: 1.5,
                background: msg.role === "user" ? "#333" : "#fff",
                color: msg.role === "user" ? "#fff" : "#222",
                border: msg.role === "user" ? "none" : "1px solid #e5e7eb",
              }}
            >
              <div style={{ whiteSpace: "pre-wrap" }}>{msg.content}</div>
              {msg.updatedFields && msg.updatedFields.length > 0 && (
                <div
                  style={{
                    marginTop: 6,
                    paddingTop: 6,
                    borderTop: "1px solid #e5e7eb",
                    fontSize: 11,
                    color: "#4CAF50",
                  }}
                >
                  Updated: {msg.updatedFields.join(", ")}
                </div>
              )}
            </div>
          </div>
        ))}
        {sending && (
          <div style={{ fontSize: 12, color: "#999", padding: "4px 0" }}>
            Agent is thinking...
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ display: "flex", gap: 6 }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
          placeholder="Ask the agent to update data..."
          disabled={sending}
          style={{
            flex: 1,
            padding: "8px 12px",
            fontSize: 13,
            border: "1px solid #ddd",
            borderRadius: 4,
            outline: "none",
          }}
        />
        <button
          onClick={handleSend}
          disabled={sending || !input.trim()}
          style={{
            padding: "8px 16px",
            fontSize: 13,
            cursor: sending ? "not-allowed" : "pointer",
            background: "#333",
            color: "#fff",
            border: "none",
            borderRadius: 4,
            opacity: sending || !input.trim() ? 0.5 : 1,
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
}
