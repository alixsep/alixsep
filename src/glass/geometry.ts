import type { Mark } from "./font"

/** World units of headroom around a mark, so moving and growing pieces are never clipped. */
export const framePad = 1.2

/** A plane as outward normal (x, y, z) and distance w from the piece's centre. */
type Plane = readonly [x: number, y: number, z: number, w: number]

export interface Piece {
  /** Centre in world units, y up, relative to the middle of the mark. */
  center: readonly [x: number, y: number]
  outline: (readonly [x: number, y: number])[]
  planes: Plane[]
  faces: Face[]
}

/**
 * A keycap profile: straight sides up to the waist, then a chamfer climbing inward to a raised
 * table. `inset` is how far the table sits in from the outline.
 */
interface Cut {
  depth: number
  bevel: number
  rise: number
  inset: number
}

const defaultCut: Cut = { depth: 0.8, bevel: 0.08, rise: 0.12, inset: 0.2 }

/** How far the outline's front edge stands proud of a piece's centre. */
export const waist = (cut: Cut = defaultCut) => cut.depth / 2 - cut.bevel
export const halfDepth = (cut: Cut = defaultCut) => cut.depth / 2

export type Vector = readonly [x: number, y: number, z: number]

interface Face {
  normal: Vector
  corners: Vector[]
}

function normalize(x: number, y: number, z: number, w: number): Plane {
  const length = Math.hypot(x, y, z)
  return [x / length, y / length, z / length, w / length]
}

function cutPiece(points: (readonly [number, number])[], cut: Cut): Piece {
  const cx = points.reduce((sum, [x]) => sum + x, 0) / points.length
  const cy = points.reduce((sum, [, y]) => sum + y, 0) / points.length
  const local = points.map(([x, y]) => [x - cx, y - cy] as const)

  const front = waist(cut)
  const table = cut.depth / 2 + cut.rise
  const climb = table - front

  const edges = local.map(([ax, ay], i) => {
    const [bx, by] = local[(i + 1) % local.length]!
    let [nx, ny] = [by - ay, ax - bx]
    if (nx * ax + ny * ay < 0) [nx, ny] = [-nx, -ny]
    const length = Math.hypot(nx, ny)
    return { nx: nx / length, ny: ny / length, distance: (nx * ax + ny * ay) / length }
  })

  // Each corner of the raised table, where the inset lines of its two edges cross.
  const tableCorners = edges.map((edge, i) => {
    const previous = edges[(i - 1 + edges.length) % edges.length]!
    const [d0, d1] = [previous.distance - cut.inset, edge.distance - cut.inset]
    const determinant = previous.nx * edge.ny - previous.ny * edge.nx
    return [
      (d0 * edge.ny - d1 * previous.ny) / determinant,
      (previous.nx * d1 - edge.nx * d0) / determinant,
    ] as const
  })

  const planes: Plane[] = [
    [0, 0, 1, table],
    [0, 0, -1, table],
  ]
  const faces: Face[] = [
    { normal: [0, 0, 1], corners: tableCorners.map(([x, y]) => [x, y, table]) },
    { normal: [0, 0, -1], corners: tableCorners.map(([x, y]) => [x, y, -table]) },
  ]

  edges.forEach(({ nx, ny, distance }, i) => {
    const next = (i + 1) % edges.length
    const [a, b] = [local[i]!, local[next]!]
    const [qa, qb] = [tableCorners[i]!, tableCorners[next]!]
    planes.push([nx, ny, 0, distance])
    faces.push({
      normal: [nx, ny, 0],
      corners: [
        [a[0], a[1], front],
        [b[0], b[1], front],
        [b[0], b[1], -front],
        [a[0], a[1], -front],
      ],
    })
    for (const side of [1, -1]) {
      const plane = normalize(
        nx * climb,
        ny * climb,
        side * cut.inset,
        climb * distance + cut.inset * front,
      )
      planes.push(plane)
      faces.push({
        normal: [plane[0], plane[1], plane[2]],
        corners: [
          [a[0], a[1], side * front],
          [b[0], b[1], side * front],
          [qb[0], qb[1], side * table],
          [qa[0], qa[1], side * table],
        ],
      })
    }
  })

  return { center: [cx, cy], outline: points, planes, faces }
}

/** Interleaved position, normal and piece index, wound counter-clockwise for back-face culling. */
export function triangulate(pieces: Piece[]) {
  const data: number[] = []
  pieces.forEach(({ faces }, index) => {
    for (const { normal, corners } of faces) {
      for (let i = 1; i < corners.length - 1; i++) {
        const a = corners[0]!
        let [b, c] = [corners[i]!, corners[i + 1]!]
        const [u, v] = [b.map((value, k) => value - a[k]!), c.map((value, k) => value - a[k]!)]
        const facing =
          (u[1]! * v[2]! - u[2]! * v[1]!) * normal[0] +
          (u[2]! * v[0]! - u[0]! * v[2]!) * normal[1] +
          (u[0]! * v[1]! - u[1]! * v[0]!) * normal[2]
        if (facing < 0) [b, c] = [c, b]
        for (const corner of [a, b, c]) data.push(...corner, ...normal, index)
      }
    }
  })
  return new Float32Array(data)
}

export function cutMark(mark: Mark, cut: Cut = defaultCut) {
  const pieces: Piece[] = []
  const glyphs = mark.glyphs.map((glyph) => {
    const members = glyph.map((polygon) => {
      const points: [number, number][] = []
      for (let i = 0; i < polygon.length; i += 2) {
        points.push([polygon[i]! - mark.width / 2, mark.height / 2 - polygon[i + 1]!])
      }
      return pieces.push(cutPiece(points, cut)) - 1
    })
    const points = members.flatMap((index) => pieces[index]!.outline)
    const xs = points.map(([x]) => x)
    const ys = points.map(([, y]) => y)
    const center = [
      (Math.min(...xs) + Math.max(...xs)) / 2,
      (Math.min(...ys) + Math.max(...ys)) / 2,
    ] as const
    return { center, members }
  })
  return { pieces, glyphs }
}

export type Glyph = ReturnType<typeof cutMark>["glyphs"][number]

/** A rectangular slab centred on the origin, its corners cut off at 45 degrees. */
export function cutSlab(width: number, height: number, corner: number, cut: Cut) {
  const [x, y] = [width / 2, height / 2]
  if (!corner)
    return cutPiece(
      [
        [x, y],
        [-x, y],
        [-x, -y],
        [x, -y],
      ],
      cut,
    )
  return cutPiece(
    [
      [x - corner, y],
      [corner - x, y],
      [-x, y - corner],
      [-x, corner - y],
      [corner - x, -y],
      [x - corner, -y],
      [x, corner - y],
      [x, y - corner],
    ],
    cut,
  )
}

type Outline = Piece["outline"]

function projection(outline: Outline, [nx, ny]: readonly [number, number]) {
  const lengths = outline.map(([x, y]) => x * nx + y * ny)
  return [Math.min(...lengths), Math.max(...lengths)] as const
}

/** Separating-axis test that ignores pieces which merely touch, like mitred corners. */
function overlaps(a: Outline, b: Outline) {
  return [a, b].every((outline) =>
    outline.every(([ax, ay], i) => {
      const [bx, by] = outline[(i + 1) % outline.length]!
      const axis = [by - ay, ax - bx] as const
      const [minA, maxA] = projection(a, axis)
      const [minB, maxB] = projection(b, axis)
      return Math.min(maxA, maxB) - Math.max(minA, minB) > 1e-6 * Math.hypot(...axis)
    }),
  )
}

export function overlapping(pieces: Piece[]) {
  return pieces.map((piece, i) =>
    pieces.flatMap((other, j) => (i !== j && overlaps(piece.outline, other.outline) ? [j] : [])),
  )
}

type Matrix = [number, number, number, number, number, number, number, number, number]

/** Column-major rotation: pitch about x, then yaw about y. */
export function rotation(pitch: number, yaw: number): Matrix {
  const [sx, cx, sy, cy] = [Math.sin(pitch), Math.cos(pitch), Math.sin(yaw), Math.cos(yaw)]
  return [cy, 0, -sy, sy * sx, cx, cy * sx, sy * cx, -sx, cy * cx]
}

/** `a` applied after `b`, both column-major. */
export function multiply(a: Matrix, b: Matrix): Matrix {
  return Array.from({ length: 9 }, (_, i) => {
    const [column, row] = [Math.floor(i / 3), i % 3]
    return (
      a[row]! * b[column * 3]! + a[row + 3]! * b[column * 3 + 1]! + a[row + 6]! * b[column * 3 + 2]!
    )
  }) as Matrix
}

export const transform = (m: Matrix, [x, y, z]: Vector): Vector => [
  m[0] * x + m[3] * y + m[6] * z,
  m[1] * x + m[4] * y + m[7] * z,
  m[2] * x + m[5] * y + m[8] * z,
]

export const subtract = (a: Vector, b: Vector): Vector => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const dot = (a: Vector, b: Vector) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const unitCross = (a: Vector, b: Vector): Vector => {
  const c: Vector = [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ]
  const length = Math.hypot(...c)
  return [c[0] / length, c[1] / length, c[2] / length]
}

/** The shelf's canvas view, in world units. */
export const shelfFrame = { width: 1.55, height: 1.1 }
/** How far, in world units, each neighbour sits from the record at the front of the shelf. */
export const SHELF_STEP = 0.98
/** The share of a record's side its cover art spans. */
export const RECORD_ART = 0.88
/** The share of a record's side its canvas overhangs each edge, so a tipped record is never clipped. */
export const RECORD_MARGIN = 0.08

export const CRYSTAL = { radius: 0.5, top: 0.92, bottom: 1.16, sides: 6 }
/** A stone's collision radius; stones are taller than wide, so vertical distance counts for less. */
export const CRYSTAL_RADIUS = 0.56

/** Where stone `index` of `count` rests, side by side along the pile. */
export const restingX = (index: number, count: number) =>
  (index - (count - 1) / 2) * CRYSTAL_RADIUS * 2

/** Room around the resting pile, in world units, so a stone knocked about is never clipped. */
const MARGIN = 1.2

/** The pile's resting box, and the larger view its canvas frames. */
export function crystalFrame(count: number) {
  const box = { width: 0.6 + count * 1.15, height: 2.5 }
  return { box, view: { width: box.width + MARGIN * 2, height: box.height + MARGIN * 2 } }
}

export function centroid(points: Vector[]) {
  const share = 1 / points.length
  return points.reduce<Vector>(
    (sum, [x, y, z]) => [sum[0] + x * share, sum[1] + y * share, sum[2] + z * share],
    [0, 0, 0],
  )
}

/** A convex solid from its faces, each a planar polygon; normals point away from its middle. */
export function solid(outlines: Vector[][]): Piece {
  const corners = [...new Set(outlines.flat())]
  const middle = centroid(corners)
  const faces = outlines.map((corners): Face => {
    const [a, b, c] = corners as [Vector, Vector, Vector]
    const normal = unitCross(subtract(b, a), subtract(c, a))
    const outward = dot(normal, subtract(a, middle)) < 0
    return { normal: outward ? [-normal[0], -normal[1], -normal[2]] : normal, corners }
  })
  const planes = faces.map(({ normal, corners }): Plane => [...normal, dot(normal, corners[0]!)])
  return { center: [0, 0], outline: [], planes, faces }
}

/** A hexagonal bipyramid, the cut of a single crystal, standing on its longer point. */
export function cutCrystal({ radius, top, bottom, sides } = CRYSTAL): Piece {
  const apexes: Vector[] = [
    [0, top, 0],
    [0, -bottom, 0],
  ]
  const ring = Array.from({ length: sides }, (_, i): Vector => {
    const angle = (i / sides) * Math.PI * 2
    return [Math.cos(angle) * radius, 0, Math.sin(angle) * radius]
  })
  return solid(ring.flatMap((a, i) => apexes.map((apex) => [a, ring[(i + 1) % sides]!, apex])))
}
