import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { THEMES, applyTheme, type Theme } from "./theme";

interface ThemeContextValue {
  theme: Theme;
  themeKey: string;
  setThemeKey: (key: string) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: THEMES.light,
  themeKey: "light",
  setThemeKey: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeKey, setThemeKey] = useState(() => {
    return localStorage.getItem("app-theme") || "light";
  });

  const theme = THEMES[themeKey] || THEMES.light;

  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem("app-theme", themeKey);
  }, [themeKey, theme]);

  return (
    <ThemeContext.Provider value={{ theme, themeKey, setThemeKey }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
