/** A convex polygon as a flat x, y list in SVG coordinates (y down). Pieces may overlap. */
type Polygon = readonly number[]

export type Glyph = readonly Polygon[]

export interface Mark {
  width: number
  height: number
  glyphs: readonly Glyph[]
}

/** Characters sit on a grid four units tall with one-unit strokes and one unit between them. */
export const CAP_HEIGHT = 4
/** Size of one grid unit in the font file, as a fraction of the em. */
export const EM_PER_UNIT = 0.175
export const SPACE = 3

const transform = (glyph: Glyph, map: (x: number, y: number) => [number, number]): Glyph =>
  glyph.map((polygon) => polygon.flatMap((value, i) => (i % 2 ? [] : map(value, polygon[i + 1]!))))

const arch: Glyph = [
  [0, 0, 6, 0, 5, 1, 1, 1],
  [0, 0, 1, 1, 1, 4, 0, 4],
  [6, 0, 6, 4, 5, 4, 5, 1],
]
const frame: Glyph = [
  [0, 0, 6, 0, 5, 1, 1, 1],
  [1, 3, 5, 3, 6, 4, 0, 4],
  [0, 0, 1, 1, 1, 3, 0, 4],
  [6, 0, 6, 4, 5, 3, 5, 1],
]
const cup: Glyph = [
  [0, 0, 1, 0, 1, 3, 0, 4],
  [5, 0, 6, 0, 6, 4, 5, 3],
  [0, 4, 1, 3, 5, 3, 6, 4],
]
const bracket: Glyph = [
  [0, 0, 1, 1, 1, 3, 0, 4],
  [0, 0, 6, 0, 6, 1, 1, 1],
  [0, 4, 1, 3, 6, 3, 6, 4],
]
const bowl: Glyph = [
  [0, 0, 6, 0, 5, 1, 1, 1],
  [5, 1, 6, 0, 6, 2.5, 5, 1.5],
  [1, 1.5, 5, 1.5, 6, 2.5, 1, 2.5],
]
/** How far a 45° stroke spans horizontally to stay one unit thick across its width. */
const DIAGONAL = Math.SQRT2
/** The Z's corner-to-corner stroke spans this far horizontally to stay one unit thick. */
const Z_STROKE = (Math.sqrt(624) - 12) / 6
const mirror = (glyph: Glyph, width = 6) => transform(glyph, (x, y) => [width - x, y])
const vStem: Polygon = [0, 0, 1, 0, 1, 2.5 - DIAGONAL, 0, 1.5]
const vStroke: Polygon = [0, 1.5, 1, 2.5 - DIAGONAL, 3.5, 5 - DIAGONAL, 3.5, 4, 2.5, 4]
const kArm: Polygon = [1, 2.5 - DIAGONAL, 3.5 - DIAGONAL, 0, 2.5, 1, 1, 2.5]
const kBar: Polygon = [3.5 - DIAGONAL, 0, 6, 0, 6, 1, 2.5, 1]
const yArm: Polygon = [0, 0, 1, 0, 3.5, 2.5, 3.5, 3, 4 - DIAGONAL, 3, 0, DIAGONAL - 1]
const tick: Polygon = [0, 0, 1, 0, 1, 1.5, 0, 1.5]
const quotes: Glyph = [tick, [2, 0, 3, 0, 3, 1.5, 2, 1.5]]
const dash = (width: number): Glyph => [[0, 1.5, width, 1.5, width, 2.5, 0, 2.5]]
const plus: Glyph = [...dash(4), [1.5, 0, 2.5, 0, 2.5, 4, 1.5, 4]]
/** Where the ↗ head's corner sits so its shaft runs straight into it. */
const TIP = 4 + DIAGONAL / 2
const chevron: Glyph = [
  [0, 0, DIAGONAL, 0, 2 + DIAGONAL, 2, 2, 2],
  [0, 4, DIAGONAL, 4, 2 + DIAGONAL, 2, 2, 2],
]
const parenthesis: Glyph = [
  [1, 0, 2, 0, 2, 1, 0, 1],
  [0, 1, 1, 1, 1, 3, 0, 3],
  [0, 3, 2, 3, 2, 4, 1, 4],
]
const squareBracket: Glyph = [
  [0, 0, 1, 1, 1, 3, 0, 4],
  [0, 0, 2, 0, 2, 1, 1, 1],
  [0, 4, 1, 3, 2, 3, 2, 4],
]
const stem: Polygon = [0, 0, 1, 1, 1, 4, 0, 4]
const middle: Polygon = [1, 1.5, 5, 1.5, 5, 2.5, 1, 2.5]
const two: Glyph = [
  [0, 0, 6, 0, 5, 1, 0, 1],
  [5, 1, 6, 0, 6, 2.5, 5, 1.5],
  [0, 1.5, 5, 1.5, 6, 2.5, 1, 2.5],
  [0, 1.5, 1, 2.5, 1, 3, 0, 4],
  [0, 4, 1, 3, 6, 3, 6, 4],
]
const six: Glyph = [
  [0, 0, 1, 1, 1, 3, 0, 4],
  [0, 0, 6, 0, 6, 1, 1, 1],
  [0, 4, 1, 3, 5, 3, 6, 4],
  [1, 1.5, 6, 1.5, 5, 2.5, 1, 2.5],
  [5, 2.5, 6, 1.5, 6, 4, 5, 3],
]

export const glyphs: Record<string, Glyph> = {
  A: [
    [0, 0, 8, 0, 7, 1, 1, 1],
    [0, 0, 1, 1, 1, 4, 0, 4],
    [8, 0, 8, 4, 7, 4, 7, 1],
    [2, 1.5, 6, 1.5, 6, 2.5, 2, 2.5],
  ],
  B: [
    [0, 0, 1, 1, 1, 3, 0, 4],
    [0, 0, 5, 0, 4, 1, 1, 1],
    [4, 1, 5, 0, 5, 1.5, 4, 1.5],
    [1, 1.5, 6, 1.5, 5, 2.5, 1, 2.5],
    [5, 2.5, 6, 1.5, 6, 4, 5, 3],
    [0, 4, 1, 3, 5, 3, 6, 4],
  ],
  C: bracket,
  D: [
    [0, 0, 1, 1, 1, 3, 0, 4],
    [0, 0, 5, 0, 6, 1, 1, 1],
    [5, 1, 6, 1, 6, 3, 5, 3],
    [1, 3, 6, 3, 5, 4, 0, 4],
  ],
  E: [...bracket, middle],
  F: [[0, 0, 1, 1, 1, 4, 0, 4], [0, 0, 6, 0, 6, 1, 1, 1], middle],
  G: [
    [0, 0, 1, 1, 1, 3, 0, 4],
    [0, 0, 6, 0, 6, 1, 1, 1],
    [0, 4, 1, 3, 5, 3, 6, 4],
    [3, 1.5, 6, 1.5, 5, 2.5, 3, 2.5],
    [5, 2.5, 6, 1.5, 6, 4, 5, 3],
  ],
  H: [[0, 0, 1, 0, 1, 4, 0, 4], [5, 0, 6, 0, 6, 4, 5, 4], middle],
  I: [[0, 0, 1, 0, 1, 4, 0, 4]],
  J: [
    [5, 0, 6, 0, 6, 4, 5, 3],
    [0, 3, 5, 3, 6, 4, 0, 4],
    [0, 2, 1, 2, 1, 3, 0, 3],
  ],
  K: [[0, 0, 1, 0, 1, 4, 0, 4], kArm, kBar, ...transform([kArm, kBar], (x, y) => [x, 4 - y])],
  L: [
    [0, 0, 1, 0, 1, 3, 0, 4],
    [0, 4, 1, 3, 7, 3, 7, 4],
  ],
  M: [
    [0, 0, 8, 0, 7, 1, 1, 1],
    [0, 0, 1, 1, 1, 4, 0, 4],
    [8, 0, 8, 4, 7, 4, 7, 1],
    [3.5, 1, 4.5, 1, 4.5, 4, 3.5, 4],
  ],
  N: arch,
  O: frame,
  P: [...bowl, stem],
  Q: [...frame, [4 - DIAGONAL, 2, 4, 2, 6, 4, 6 - DIAGONAL, 4]],
  R: [...bowl, stem, [4.5 - DIAGONAL, 2.5, 4.5, 2.5, 6, 4, 6 - DIAGONAL, 4]],
  S: mirror(two),
  T: [
    [0, 0, 6, 0, 6, 1, 0, 1],
    [2.5, 1, 3.5, 1, 3.5, 4, 2.5, 4],
  ],
  U: cup,
  V: [vStem, vStroke, ...mirror([vStem, vStroke])],
  W: [
    [0, 0, 1, 0, 1, 3, 0, 4],
    [7, 0, 8, 0, 8, 4, 7, 3],
    [0, 4, 1, 3, 7, 3, 8, 4],
    [3.5, 1, 4.5, 1, 4.5, 3, 3.5, 3],
  ],
  X: [
    [0, 0, 8, 3, 8, 4, 0, 1],
    [8, 0, 8, 1, 0, 4, 0, 3],
  ],
  Y: [yArm, ...mirror([yArm]), [2.5, 2.5, 3.5, 2.5, 3.5, 4, 2.5, 4]],
  Z: [
    [0, 0, 6, 0, 6, 1, 0, 1],
    [6 - Z_STROKE, 1, 6, 1, Z_STROKE, 3, 0, 3],
    [0, 3, 6, 3, 6, 4, 0, 4],
  ],
  "0": frame,
  "1": [
    [1, 0, 2, 0, 2, 4, 1, 4],
    [0, 1, 1, 0, 1, DIAGONAL, 0, 1 + DIAGONAL],
  ],
  "2": two,
  "3": [
    [0, 0, 6, 0, 5, 1, 0, 1],
    [5, 1, 6, 0, 6, 4, 5, 3],
    [0, 3, 5, 3, 6, 4, 0, 4],
    [2, 1.5, 5, 1.5, 5, 2.5, 2, 2.5],
  ],
  "4": [
    [0, 0, 1, 0, 1, 2, 0, 3],
    [0, 3, 1, 2, 6, 2, 6, 3],
    [4, 0, 5, 0, 5, 4, 4, 4],
  ],
  "5": [
    [0, 0, 6, 0, 6, 1, 1, 1],
    [0, 0, 1, 1, 1, 1.5, 0, 2.5],
    [0, 2.5, 1, 1.5, 5, 1.5, 6, 2.5],
    [5, 2.5, 6, 2.5, 6, 4, 5, 3],
    [0, 3, 5, 3, 6, 4, 0, 4],
  ],
  "6": six,
  "7": [
    [0, 0, 6, 0, 6, 1, 0, 1],
    [6 - DIAGONAL, 1, 6, 1, 3, 4, 3 - DIAGONAL, 4],
  ],
  "8": [...frame, middle],
  "9": transform(six, (x, y) => [6 - x, 4 - y]),
  ".": [[0, 3, 1, 3, 1, 4, 0, 4]],
  ",": [[0, 3, 1, 3, 1, 4, 0, 5]],
  ":": [
    [0, 1, 1, 1, 1, 2, 0, 2],
    [0, 3, 1, 3, 1, 4, 0, 4],
  ],
  "!": [
    [0, 0, 1, 0, 1, 2.5, 0, 2.5],
    [0, 3, 1, 3, 1, 4, 0, 4],
  ],
  "?": [
    [0, 0, 6, 0, 5, 1, 0, 1],
    [5, 1, 6, 0, 6, 2.5, 5, 1.5],
    [2.5, 1.5, 5, 1.5, 6, 2.5, 3.5, 2.5],
    [2.5, 3, 3.5, 3, 3.5, 4, 2.5, 4],
  ],
  ";": [
    [0, 1, 1, 1, 1, 2, 0, 2],
    [0, 3, 1, 3, 1, 4, 0, 5],
  ],
  "'": [tick],
  '"': quotes,
  "`": [[0, 0, DIAGONAL, 0, 1.5 + DIAGONAL, 1.5, 1.5, 1.5]],
  "·": [[0, 1.5, 1, 1.5, 1, 2.5, 0, 2.5]],
  "-": dash(4),
  "–": dash(6),
  "—": dash(8),
  "+": plus,
  "=": [
    [0, 0.5, 4, 0.5, 4, 1.5, 0, 1.5],
    [0, 2.5, 4, 2.5, 4, 3.5, 0, 3.5],
  ],
  "×": [
    [0, 0.5, DIAGONAL, 0.5, 3 + DIAGONAL, 3.5, 3, 3.5],
    [3, 0.5, 3 + DIAGONAL, 0.5, DIAGONAL, 3.5, 0, 3.5],
  ],
  "÷": [...dash(4), [1.5, 0, 2.5, 0, 2.5, 1, 1.5, 1], [1.5, 3, 2.5, 3, 2.5, 4, 1.5, 4]],
  "<": mirror(chevron, 2 + DIAGONAL),
  ">": chevron,
  "%": [
    [0, 0, 1, 0, 1, 1, 0, 1],
    [4, 0, 4 + DIAGONAL, 0, DIAGONAL, 4, 0, 4],
    [3 + DIAGONAL, 3, 4 + DIAGONAL, 3, 4 + DIAGONAL, 4, 3 + DIAGONAL, 4],
  ],
  $: [...mirror(two), [2.5, -1, 3.5, -1, 3.5, 0, 2.5, 0], [2.5, 4, 3.5, 4, 3.5, 5, 2.5, 5]],
  "#": [
    [1, 0, 2, 0, 2, 4, 1, 4],
    [3, 0, 4, 0, 4, 4, 3, 4],
    [0, 0.5, 5, 0.5, 5, 1.5, 0, 1.5],
    [0, 2.5, 5, 2.5, 5, 3.5, 0, 3.5],
  ],
  "(": parenthesis,
  ")": mirror(parenthesis, 2),
  "[": squareBracket,
  "]": mirror(squareBracket, 2),
  "/": [[4, 0, 4 + DIAGONAL, 0, DIAGONAL, 4, 0, 4]],
  "→": [
    [0, 1.5, 5, 1.5, 5, 2.5, 0, 2.5],
    [4 - DIAGONAL, 0, 4, 0, 6, 2, 6 - DIAGONAL, 2],
    [4 - DIAGONAL, 4, 4, 4, 6, 2, 6 - DIAGONAL, 2],
  ],
  "↗": [
    [TIP - 3, 0, TIP, 0, TIP - 1, 1, TIP - 3, 1],
    [TIP, 0, TIP, 3, TIP - 1, 3, TIP - 1, 1],
    [0, 4, DIAGONAL, 4, TIP - 1, 1 + DIAGONAL / 2, TIP - 1, 1, 3, 1],
  ],
}

export const CHARACTERS = `ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.,:;!?'"\`·-–—+=×÷<>%#$()[]/→↗`

export const advanceOf = (glyph: Glyph) =>
  Math.max(...glyph.flatMap((polygon) => polygon.filter((_, i) => i % 2 === 0)))

const LEADING = 2
/** As wide as DEVELOPMENT, the longest single word in a title. */
const MEASURE = 80

function setLine(text: string, top: number) {
  let x = 0
  const set: Glyph[] = []
  for (const character of text.toUpperCase()) {
    const glyph = glyphs[character]
    if (!glyph) {
      if (character === " ") x += SPACE
      continue
    }
    set.push(glyph.map((polygon) => polygon.map((value, i) => (i % 2 ? value + top : value + x))))
    x += advanceOf(glyph) + 1
  }
  return { width: Math.max(x - 1, 1), glyphs: set }
}

/** Sets text on the grid, one line per newline. Lowercase is set in capitals; unknown characters are skipped. */
export function setText(text: string): Mark {
  const lines = text.split("\n").map((line, row) => setLine(line, row * (CAP_HEIGHT + LEADING)))
  return {
    width: Math.max(...lines.map((line) => line.width)),
    height: lines.length * (CAP_HEIGHT + LEADING) - LEADING,
    glyphs: lines.flatMap((line) => line.glyphs),
  }
}

export function wrapText(text: string) {
  const words = text.split(" ")
  const limit = Math.max(MEASURE, ...words.map((word) => setLine(word, 0).width))
  let best = { lines: words, count: Infinity, width: Infinity }
  for (let breaks = 0; breaks < 2 ** (words.length - 1); breaks++) {
    const lines = [words[0]!]
    words.slice(1).forEach((word, i) => {
      if (breaks & (1 << i)) lines.push(word)
      else lines[lines.length - 1] += ` ${word}`
    })
    const width = Math.max(...lines.map((line) => setLine(line, 0).width))
    const count = width <= limit ? lines.length : Infinity
    if (count < best.count || (count === best.count && width < best.width))
      best = { lines, count, width }
  }
  return best.lines.join("\n")
}
