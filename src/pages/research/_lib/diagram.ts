type Box = Pick<DOMRect, "left" | "right" | "top" | "bottom" | "width" | "height">

const middle = (box: Box) => [box.left + box.width / 2, box.top + box.height / 2] as const

/** A curve between two boxes, leaving sideways to the right when `across`, otherwise downwards. */
export function connect(from: Box, to: Box, across = false) {
  const [[fromX, fromY], [toX, toY]] = [middle(from), middle(to)]
  if (across) {
    const bend = (from.right + to.left) / 2
    return `M${from.right} ${fromY}C${bend} ${fromY} ${bend} ${toY} ${to.left} ${toY}`
  }
  const bend = (from.bottom + to.top) / 2
  return `M${fromX} ${from.bottom}C${fromX} ${bend} ${toX} ${bend} ${toX} ${to.top}`
}

/** A box relative to `origin`, so curves can be drawn in an SVG laid over it. */
export const within = (element: Element, origin: DOMRect): Box => {
  const { left, top, width, height } = element.getBoundingClientRect()
  const [x, y] = [left - origin.left, top - origin.top]
  return { left: x, top: y, right: x + width, bottom: y + height, width, height }
}

export function svgElement(tag: "path", attributes: Record<string, string | number>) {
  const element = document.createElementNS("http://www.w3.org/2000/svg", tag)
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, String(value))
  return element
}
