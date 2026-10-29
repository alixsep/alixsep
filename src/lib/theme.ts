type Theme = "system" | "light" | "dark"

const STORAGE_KEY = "color-scheme"

export function readTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored === "light" || stored === "dark" ? stored : "system"
  } catch {
    return "system"
  }
}

export function setTheme(theme: Theme) {
  try {
    if (theme === "system") localStorage.removeItem(STORAGE_KEY)
    else localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    // Storage may be blocked; the theme still applies for this visit.
  }

  document.documentElement.classList.remove("light", "dark")
  if (theme !== "system") document.documentElement.classList.add(theme)
}
