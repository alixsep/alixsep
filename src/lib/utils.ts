import { clsx } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

import type { ClassValue } from "clsx"

// Without this, tailwind-merge reads these custom utilities as colors and drops the wrong classes.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ["meta", "note", "copy", "lead", "item", "headline", "heading", "hero"],
    },
    classGroups: {
      shadow: [1, 2, 3, 4, 5, 6, 7, 8].map((level) => `shadow-surface-${level}`),
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
