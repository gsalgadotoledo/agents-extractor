export interface Theme {
  name: string;
  bg: string;
  surface: string;
  surfaceHover: string;
  surfaceAlt: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  primary: string;
  accent: string;
  border: string;
  inputBg: string;
  headerBg: string;
  headerText: string;
  chatUser: string;
  chatUserText: string;
  chatBot: string;
  chatBotText: string;
}

export const THEMES: Record<string, Theme> = {
  light: {
    name: "Light",
    bg: "#f5f5f5",
    surface: "#ffffff",
    surfaceHover: "#fafafa",
    surfaceAlt: "#f8f8f8",
    text: "#111111",
    textSecondary: "#666666",
    textMuted: "#999999",
    primary: "#111111",
    accent: "#111111",
    border: "#e0e0e0",
    inputBg: "#f5f5f5",
    headerBg: "#111111",
    headerText: "#ffffff",
    chatUser: "#111111",
    chatUserText: "#ffffff",
    chatBot: "#f5f5f5",
    chatBotText: "#333333",
  },
  midnight: {
    name: "Midnight Dark",
    bg: "#1E242D",
    surface: "#222831",
    surfaceHover: "#2a3040",
    surfaceAlt: "#293040",
    text: "#EEEEEE",
    textSecondary: "#B0B0B0",
    textMuted: "#7a7a7a",
    primary: "#7A94D7",
    accent: "#7A94D7",
    border: "#393E46",
    inputBg: "#393E46",
    headerBg: "#1a1f27",
    headerText: "#EEEEEE",
    chatUser: "#7A94D7",
    chatUserText: "#ffffff",
    chatBot: "#393E46",
    chatBotText: "#EEEEEE",
  },
};

export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.style.setProperty("--bg", theme.bg);
  root.style.setProperty("--surface", theme.surface);
  root.style.setProperty("--surface-hover", theme.surfaceHover);
  root.style.setProperty("--surface-alt", theme.surfaceAlt);
  root.style.setProperty("--text", theme.text);
  root.style.setProperty("--text-secondary", theme.textSecondary);
  root.style.setProperty("--text-muted", theme.textMuted);
  root.style.setProperty("--primary", theme.primary);
  root.style.setProperty("--accent", theme.accent);
  root.style.setProperty("--border", theme.border);
  root.style.setProperty("--input-bg", theme.inputBg);
  root.style.setProperty("--header-bg", theme.headerBg);
  root.style.setProperty("--header-text", theme.headerText);
  root.style.setProperty("--chat-user", theme.chatUser);
  root.style.setProperty("--chat-user-text", theme.chatUserText);
  root.style.setProperty("--chat-bot", theme.chatBot);
  root.style.setProperty("--chat-bot-text", theme.chatBotText);
}
