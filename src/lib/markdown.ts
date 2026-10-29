import type { SatteriProcessorOptions } from "@astrojs/markdown-satteri"

type HastPlugin = NonNullable<SatteriProcessorOptions["hastPlugins"]>[number]

export const newTab = "(opens in a new tab)"

export const externalLinks: HastPlugin = {
  name: "external-links",
  element: {
    filter: ["a"],
    visit(node, ctx) {
      if (!/^https?:/.test(String(node.properties?.["href"]))) return
      ctx.setProperty(node, "target", "_blank")
      ctx.appendChild(node, {
        type: "element",
        tagName: "span",
        properties: { className: ["sr-only"] },
        children: [{ type: "text", value: ` ${newTab}` }],
      })
    },
  },
}
