import { satteri } from "@astrojs/markdown-satteri"
import react from "@astrojs/react"
import sitemap from "@astrojs/sitemap"
import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from "astro/config"

import { externalLinks } from "./src/lib/markdown"

export default defineConfig({
  site: "https://alixsep.com",
  trailingSlash: "always",
  server: { port: 3005 },
  devToolbar: { enabled: false },
  integrations: [react(), sitemap()],
  markdown: {
    processor: satteri({ hastPlugins: [externalLinks] }),
    shikiConfig: {
      themes: { light: "github-light", dark: "github-dark" },
      defaultColor: false,
    },
  },
  vite: {
    plugins: [tailwindcss()],
  },
})
