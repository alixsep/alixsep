import { openProfile } from "./browser.ts"

const context = await openProfile(false)
const page = context.pages()[0] ?? (await context.newPage())
await page.goto("https://accounts.spotify.com/login")
console.log("Log in to Spotify, then close the browser window.")
await new Promise((resolve) => context.on("close", resolve))
