import type { Glyph } from "./font"

type Point = readonly [x: number, y: number]

const key = ([x, y]: Point) => `${x.toFixed(4)},${y.toFixed(4)}`

function corners(polygon: readonly number[]) {
  const points: Point[] = []
  for (let i = 0; i < polygon.length; i += 2) points.push([polygon[i]!, polygon[i + 1]!])
  return points
}

/** Points of `all` lying strictly inside segment a–b, in order from a. */
function between(a: Point, b: Point, all: Point[]) {
  const [dx, dy] = [b[0] - a[0], b[1] - a[1]]
  const length = dx * dx + dy * dy
  return all
    .map((p) => ({ p, t: ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / length }))
    .filter(
      ({ p, t }) =>
        t > 1e-6 && t < 1 - 1e-6 && Math.abs((p[0] - a[0]) * dy - (p[1] - a[1]) * dx) < 1e-6,
    )
    .toSorted((u, v) => u.t - v.t)
    .map(({ p }) => p)
}

/**
 * The glyph's outer contour as continuous pen strokes: edges shared by two pieces cancel out,
 * including where a piece's corner lands mid-edge on another, and the rest is chained together.
 */
export function sketchStrokes(glyph: Glyph) {
  const pieces = glyph.map(corners)
  const all = pieces.flat()
  const edges = new Map<string, [Point, Point]>()

  for (const points of pieces) {
    points.forEach((a, i) => {
      const b = points[(i + 1) % points.length]!
      const run = [a, ...between(a, b, all), b]
      for (let j = 0; j < run.length - 1; j++) {
        const [from, to] = [run[j]!, run[j + 1]!]
        const id = [key(from), key(to)].toSorted().join("|")
        if (edges.has(id)) edges.delete(id)
        else edges.set(id, [from, to])
      }
    })
  }

  const unused = new Set(edges.values())
  const touches =
    (point: Point) =>
    ([a, b]: [Point, Point]) =>
      key(a) === key(point) || key(b) === key(point)
  const strokes: string[] = []
  for (const edge of edges.values()) {
    if (!unused.delete(edge)) continue
    const [start] = edge
    let current = edge[1]
    const stroke = [start, current]
    for (
      let next = [...unused].find(touches(current));
      next;
      next = [...unused].find(touches(current))
    ) {
      unused.delete(next)
      current = key(next[0]) === key(current) ? next[1] : next[0]
      stroke.push(current)
      if (key(current) === key(start)) break
    }
    strokes.push(`M${stroke.map(([x, y]) => `${x} ${y}`).join("L")}`)
  }
  return strokes
}
