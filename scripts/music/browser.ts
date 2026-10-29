import { chromium } from "playwright"

export const profile = new URL("../../.browser-profile", import.meta.url).pathname

export const openProfile = (headless: boolean) =>
  chromium.launchPersistentContext(profile, {
    headless,
    locale: "en-US",
    viewport: { width: 1300, height: 1000 },
    userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/130 Safari/537.36",
  })
