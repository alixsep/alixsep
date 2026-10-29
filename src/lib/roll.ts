const glyphs = (text: Element) => [...text.querySelectorAll<HTMLElement>("[data-glyph]")]

const place = (glyph: Element) => {
  const { left, top } = glyph.getBoundingClientRect()
  return `${glyph.textContent}@${Math.round(left)},${Math.round(top)}`
}

const hold = (text: Element, other: Element) => {
  const shared = new Set(glyphs(other).map(place))
  let order = 0
  for (const glyph of glyphs(text)) {
    const still = shared.has(place(glyph))
    glyph.toggleAttribute("data-still", still)
    if (!still) glyph.style.setProperty("--index", String(order++))
  }
}

/** Holds still each character drawn in the same place by both texts, so only the difference rolls. */
export function rollBetween(from: Element, to: Element) {
  hold(from, to)
  hold(to, from)
}
