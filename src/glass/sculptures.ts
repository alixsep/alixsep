import { brands } from "./brands"
import { advanceOf, glyphs } from "./font"
import { solid } from "./geometry"

import type { Piece, Vector } from "./geometry"

type Place = (point: Vector) => Vector
type Point = readonly [x: number, y: number]
/** Radius from the axis and height along it, in order along the solid. */
type Profile = (readonly [radius: number, y: number])[]

interface Sculpture {
  pieces: Piece[]
  parts: number[][]
  partners: number[][]
  /** Furthest any point reaches from the middle, whichever way the sculpture turns. */
  radius: number
}

export const SCULPTURE_FIELD_OF_VIEW = 0.25
/** Room around the sculpture, so the corners nearest the camera are never clipped. */
const MARGIN = 1.12

const spin =
  (axis: 0 | 1 | 2, angle: number): Place =>
  (point) => {
    const [c, s] = [Math.cos(angle), Math.sin(angle)]
    const [x, y, z] = point
    if (axis === 0) return [x, y * c - z * s, y * s + z * c]
    if (axis === 1) return [x * c + z * s, y, z * c - x * s]
    return [x * c - y * s, x * s + y * c, z]
  }
const shift =
  (dx: number, dy: number, dz: number): Place =>
  ([x, y, z]) => [x + dx, y + dy, z + dz]
const stretch =
  (sx: number, sy: number, sz: number): Place =>
  ([x, y, z]) => [x * sx, y * sy, z * sz]
const chain =
  (...steps: Place[]): Place =>
  (point) =>
    steps.reduce((moved, step) => step(moved), point)

/** A solid of revolution about y cut into `sides` facets; the profile must bulge to stay convex. */
function lathe(sides: number, profile: Profile, place: Place): Piece {
  const rings = profile.map(([radius, y]) =>
    radius < 1e-6
      ? [place([0, y, 0])]
      : Array.from({ length: sides }, (_, i) => {
          const angle = ((i + 0.5) / sides) * Math.PI * 2
          return place([Math.cos(angle) * radius, y, Math.sin(angle) * radius])
        }),
  )
  const at = (ring: Vector[], i: number) => ring[i % ring.length]!
  const bands = rings.slice(1).flatMap((ring, r) =>
    Array.from({ length: sides }, (_, i) => {
      const previous = rings[r]!
      return [...new Set([at(previous, i), at(previous, i + 1), at(ring, i + 1), at(ring, i)])]
    }),
  )
  const caps = [rings[0]!, rings.at(-1)!].filter((ring) => ring.length > 1)
  return solid([...bands, ...caps])
}

const dome = (radius: number, y: number, latitudes: number[]): Profile =>
  latitudes.map((degrees) => {
    const angle = (degrees * Math.PI) / 180
    return [radius * Math.cos(angle), y + radius * Math.sin(angle)]
  })

function box([width, height, depth]: Vector, place: Place) {
  return lathe(
    4,
    [
      [Math.SQRT2, -0.5],
      [Math.SQRT2, 0.5],
    ],
    chain(stretch(width / 2, height, depth / 2), place),
  )
}

const separately = (pieces: Piece[]) => pieces.map((piece) => [piece])

function microphone() {
  const lean = chain(spin(0, 0.32), spin(2, -0.34))
  return [
    [
      lathe(16, dome(0.8, 1.72, [90, 66, 42, 16, -12, -38, -58]), lean),
      lathe(
        16,
        [
          [0.5, 1.1],
          [0.5, 0.86],
        ],
        lean,
      ),
      lathe(
        10,
        [
          [0.44, 0.86],
          [0.27, -2.15],
          [0.2, -2.32],
        ],
        lean,
      ),
    ],
  ]
}

function pen() {
  const slant = chain(spin(1, 0.5), spin(2, 2.25), spin(0, 0.3))
  return separately([
    lathe(
      8,
      [
        [0.2, -3.1],
        [0.3, -2.92],
        [0.32, 0.15],
        [0.29, 0.42],
      ],
      slant,
    ),
    lathe(
      16,
      [
        [0.35, -0.3],
        [0.35, 0.02],
      ],
      slant,
    ),
    lathe(
      12,
      [
        [0.26, 0.42],
        [0.21, 1.3],
      ],
      slant,
    ),
    lathe(
      8,
      [
        [0.21, 1.25],
        [0, 2.5],
      ],
      chain(stretch(1, 1, 0.45), slant),
    ),
    box([0.14, 1.7, 0.1], chain(shift(0, -1.75, 0.36), slant)),
  ])
}

function magnifier() {
  const tilt = chain(spin(1, -0.45), spin(0, 0.3))
  const handle = chain(spin(2, -2.44), tilt)
  const lens = lathe(
    24,
    [
      [0.45, 0.17],
      [0.8, 0.13],
      [1.02, 0.06],
      [1.08, 0],
      [1.02, -0.06],
      [0.8, -0.13],
      [0.45, -0.17],
    ],
    chain(spin(0, Math.PI / 2), tilt),
  )
  const frame = strip(arc(1.15, 0, Math.PI * 2, 24), [0.1, 0.28], tilt)
  const grip = [
    lathe(
      10,
      [
        [0.09, 1.19],
        [0.14, 1.6],
      ],
      handle,
    ),
    lathe(
      10,
      [
        [0.23, 1.6],
        [0.3, 1.82],
        [0.31, 3.3],
        [0.24, 3.55],
      ],
      handle,
    ),
  ]
  return [[lens], frame, grip]
}

const arc = (radius: number, from: number, to: number, count: number) =>
  Array.from({ length: count + 1 }, (_, i) => {
    const angle = from + ((to - from) * i) / count
    return [radius * Math.cos(angle), radius * Math.sin(angle)] as const
  })

/** A convex outline in the xy plane, given `depth` along z. */
function plate(outline: Point[], depth: number, place: Place) {
  const [front, back] = [depth / 2, -depth / 2].map((z) =>
    outline.map(([x, y]) => place([x, y, z])),
  ) as [Vector[], Vector[]]
  const sides = front.map((corner, k) => [
    corner,
    front[(k + 1) % front.length]!,
    back[(k + 1) % back.length]!,
    back[k]!,
  ])
  return solid([front, back, ...sides])
}

function strip(path: Point[], [thickness, depth]: [number, number], place: Place) {
  const normals = path.map((_, i) => {
    const [ax, ay] = path[Math.max(i - 1, 0)]!
    const [bx, by] = path[Math.min(i + 1, path.length - 1)]!
    const length = Math.hypot(bx - ax, by - ay)
    return [(by - ay) / length, (ax - bx) / length] as const
  })
  const edge = (i: number, side: number): Point => {
    const [x, y] = path[i]!
    const [nx, ny] = normals[i]!
    return [x + (nx * side * thickness) / 2, y + (ny * side * thickness) / 2]
  }
  return path
    .slice(1)
    .map((_, i) => plate([edge(i, 1), edge(i + 1, 1), edge(i + 1, -1), edge(i, -1)], depth, place))
}

function headphones() {
  const pose = chain(spin(1, 0.32), spin(0, 0.12))
  const band = strip(arc(1.95, -0.22, Math.PI + 0.22, 16), [0.24, 0.5], pose)
  const cups = [1, -1].map((side) =>
    lathe(
      16,
      [
        [0.95, 0],
        [1.12, 0.1],
        [1.2, 0.3],
        [1.2, 0.5],
        [1.12, 0.78],
        [0.9, 0.95],
        [0, 1.04],
      ],
      chain(
        stretch(1, 1, 0.62),
        spin(2, -side * (Math.PI / 2)),
        shift(-side * 0.5, 0, 0),
        spin(2, -side * 0.2),
        shift(side * 1.72, -0.85, 0),
        pose,
      ),
    ),
  )
  return separately([...band, ...cups])
}

function plane() {
  const flight = chain(spin(0, 0.4), spin(1, -0.6), spin(2, 0.38), spin(0, 0.3))
  const along = chain(spin(2, -Math.PI / 2), flight)
  const flat = (outline: Point[], depth: number, lift: number) =>
    [1, -1].map((side) =>
      plate(
        outline.map(([x, z]) => [x, z * side]),
        depth,
        chain(spin(0, Math.PI / 2), shift(0, lift, 0), flight),
      ),
    )
  return [
    [
      lathe(
        12,
        [
          [0.12, -3],
          [0.36, -1.7],
          [0.38, -1],
          [0.38, 1.6],
          [0.34, 2.3],
          [0.24, 2.75],
          [0, 3.05],
        ],
        along,
      ),
      ...flat(
        [
          [0.9, 0],
          [-0.9, 3.2],
          [-1.4, 3.2],
          [-0.4, 0],
        ],
        0.1,
        -0.18,
      ),
      ...flat(
        [
          [-2.1, 0],
          [-2.9, 1.1],
          [-3.15, 1.1],
          [-2.9, 0],
        ],
        0.07,
        0.05,
      ),
      plate(
        [
          [-1.9, 0.1],
          [-2.75, 1.45],
          [-3.1, 1.45],
          [-3, 0.1],
        ],
        0.07,
        flight,
      ),
      ...[1, -1].map((side) =>
        lathe(
          10,
          [
            [0.12, -0.55],
            [0.2, -0.3],
            [0.2, 0.4],
          ],
          chain(spin(2, -Math.PI / 2), shift(0.3, -0.4, side * 1.3), flight),
        ),
      ),
    ],
  ]
}

function code() {
  const view = chain(spin(1, -0.42), spin(0, 0.2), spin(2, -0.05))
  let left = 0
  return [..."</>"].map((character) => {
    const glyph = glyphs[character]!
    const x = left
    left += advanceOf(glyph) + 1
    return glyph.map((polygon) =>
      plate(
        Array.from({ length: polygon.length / 2 }, (_, i): Point => [
          x + polygon[i * 2]!,
          -polygon[i * 2 + 1]!,
        ]),
        1.4,
        view,
      ),
    )
  })
}

function spotlight() {
  const view = chain(spin(1, -0.55), spin(0, 0.16))
  const aim = chain(spin(2, 0.75), spin(0, -0.3), shift(0, 0.55, 0), view)
  return [
    [
      lathe(
        16,
        [
          [0.34, -1.15],
          [0.5, -0.95],
          [0.78, 0.7],
        ],
        aim,
      ),
      lathe(
        16,
        [
          [0.86, 0.62],
          [0.86, 0.92],
        ],
        aim,
      ),
    ],
    [
      ...[1, -1].map((side) => box([0.14, 1.05, 0.4], chain(shift(side * 1.02, 0.08, 0), view))),
      box([2.18, 0.14, 0.4], chain(shift(0, -0.5, 0), view)),
      lathe(
        10,
        [
          [0.09, -1.95],
          [0.09, -0.5],
        ],
        view,
      ),
      lathe(
        20,
        [
          [0.78, -2.1],
          [0.72, -1.98],
          [0.24, -1.9],
        ],
        view,
      ),
    ],
  ]
}

/** Yugilife's mark: five cells of a square grid, sheared 20 degrees. */
function yugilife() {
  const shear = Math.tan((20 * Math.PI) / 180)
  const view = chain(spin(1, -0.4), spin(0, 0.18))
  const cell = (x: number, y: number, width: number, height: number): Point[] => [
    [x, y],
    [x + width, y],
    [x + width, y + height],
    [x, y + height],
  ]
  const cells = [
    cell(0, 1, 1, 2),
    cell(1, 2, 1, 1),
    cell(2, 0, 1, 5),
    cell(3, 4, 1, 1),
    cell(4, 3, 1, 2),
  ]
  return separately(
    cells.map((outline) =>
      plate(
        outline.map(([across, down]) => [across - shear * down, -down]),
        0.7,
        view,
      ),
    ),
  )
}

/** CircleLens's mark: three rings open to the right, around a lens. */
function circlelens() {
  const view = chain(spin(1, -0.42), spin(0, 0.22))
  const rings = [2, 1.5, 1].map((radius) =>
    strip(arc(radius, Math.PI / 3, (Math.PI * 5) / 3, Math.round(radius * 7)), [0.25, 0.4], view),
  )
  const lens = lathe(
    16,
    [
      [0.3, 0.2],
      [0.5, 0.14],
      [0.58, 0.05],
      [0.58, -0.05],
      [0.5, -0.14],
      [0.3, -0.2],
    ],
    chain(spin(0, Math.PI / 2), view),
  )
  return [...rings, [lens]]
}

/** Chromapair's mark: a pair of prisms, one the other turned over. */
function chromapair() {
  const view = chain(spin(1, -0.5), spin(0, 0.22))
  const rise = Math.sqrt(3)
  const gap = 0.25
  const prisms: Point[][] = [
    [
      [0, 0],
      [2, 0],
      [1, rise],
    ],
    [
      [1 + gap, rise],
      [3 + gap, rise],
      [2 + gap, 0],
    ],
  ]
  return separately(prisms.map((outline) => plate(outline, 1.2, view)))
}

/** Where the line from `inner` through `outer` meets the ground, at y = 0. */
const grounded = ([x, y, z]: Vector, [ox, oy, oz]: Vector): Vector => {
  const along = y / (y - oy)
  return [x + (ox - x) * along, 0, z + (oz - z) * along]
}

/**
 * Amirkabir University's gate: two half-rings of stone blocks, one behind the other, tipped toward
 * each other so they nearly meet at the top. The end blocks run down to the ground and stand on it.
 */
function gate() {
  const view = chain(spin(1, 0.7), spin(0, 0.25))
  const [blocks, radius, depth, thickness, joint] = [11, 2, 1, 0.32, 0.016]
  const [apart, tip] = [1.4, 0.32]
  const step = Math.PI / blocks
  const ring = (side: 1 | -1) => {
    const pose = chain(spin(0, -side * tip), shift(0, 0, side * apart))
    const section = (angle: number) =>
      [
        [1, 1],
        [1, -1],
        [-1, -1],
        [-1, 1],
      ].map(([out, across]) => {
        const reach = radius + (out! * thickness) / 2
        return pose([reach * Math.cos(angle), reach * Math.sin(angle), (across! * depth) / 2])
      })
    return Array.from({ length: blocks }, (_, i) => {
      let near = section(Math.PI - step * i - joint)
      let far = section(Math.PI - step * (i + 1) + joint)
      if (i === 0) near = near.map((corner, k) => grounded(far[k]!, corner))
      if (i === blocks - 1) far = far.map((corner, k) => grounded(near[k]!, corner))
      const [front, back] = [near.map(view), far.map(view)]
      const sides = front.map((corner, k) => [
        corner,
        front[(k + 1) % 4]!,
        back[(k + 1) % 4]!,
        back[k]!,
      ])
      return solid([front, back, ...sides])
    })
  }
  return separately([...ring(-1), ...ring(1)])
}

/** A mortarboard, the cap worn at graduation, with its tassel hanging from one side. */
function mortarboard() {
  const view = chain(spin(1, 0.6), spin(0, 0.42), spin(2, -0.08))
  const corner = 1.45
  return [
    [
      lathe(
        16,
        [
          [1.05, -1.1],
          [1.12, -0.35],
          [1.1, -0.06],
        ],
        view,
      ),
    ],
    [
      box([3.1, 0.12, 3.1], view),
      lathe(
        12,
        [
          [0.16, 0.06],
          [0.12, 0.16],
        ],
        view,
      ),
    ],
    [
      box(
        [0.05, 0.04, corner * Math.SQRT2],
        chain(spin(1, Math.PI / 4), shift(corner / 2, 0.08, corner / 2), view),
      ),
      lathe(
        10,
        [
          [0.05, -0.02],
          [0.17, -0.9],
          [0.04, -1.02],
        ],
        chain(shift(corner, 0, corner), view),
      ),
    ],
  ]
}

/** NODET's emblem: eight arrows around an octagonal hole, each arrow a shaft and a head. */
function sampad() {
  const view = chain(spin(1, 0.5), spin(0, 0.28), spin(2, 0.1))
  const [tip, base, shaft, head, hole, depth] = [2.6, 1.72, 0.3, 0.62, 0.59, 0.4]
  const [between, corner] = [Math.PI / 8, hole / Math.cos(Math.PI / 8)]
  const meet = shaft / Math.sin(between)
  const polar = (radius: number, angle: number): Point => [
    radius * Math.cos(angle),
    radius * Math.sin(angle),
  ]
  const turn =
    (angle: number) =>
    ([x, y]: Point): Point => [
      x * Math.cos(angle) - y * Math.sin(angle),
      x * Math.sin(angle) + y * Math.cos(angle),
    ]
  const body: Point[] = [
    polar(corner, -between),
    polar(meet, -between),
    [base, -shaft],
    [base, shaft],
    polar(meet, between),
    polar(corner, between),
  ]
  const point: Point[] = [
    [tip, 0],
    [base, head],
    [base, shaft],
    [base, -shaft],
    [base, -head],
  ]
  return Array.from({ length: 8 }, (_, i) => {
    const toward = turn((i * Math.PI) / 4)
    return [body, point].map((outline) => plate(outline.map(toward), depth, view))
  })
}

/** A brand mark, cut through a slab of glass and turned by `yaw`. */
const brand = (name: keyof typeof brands, yaw: number) => () => {
  const view = chain(spin(1, yaw), spin(0, 0.22))
  return [
    brands[name].map((polygon) =>
      plate(
        Array.from({ length: polygon.length / 2 }, (_, i): Point => [
          polygon[i * 2]!,
          polygon[i * 2 + 1]!,
        ]),
        0.48,
        view,
      ),
    ),
  ]
}

const makers = {
  microphone,
  pen,
  magnifier,
  headphones,
  plane,
  code,
  spotlight,
  yugilife,
  circlelens,
  chromapair,
  gate,
  mortarboard,
  sampad,
  spotify: brand("spotify", 0.45),
  soundcloud: brand("soundcloud", -0.4),
  appleMusic: brand("appleMusic", 0.4),
  youtube: brand("youtube", -0.2),
}

export type SculptureName = keyof typeof makers

export const isSculpture = (name: unknown): name is SculptureName =>
  typeof name === "string" && Object.hasOwn(makers, name)

const cornersOf = (piece: Piece) => piece.faces.flatMap(({ corners }) => corners)

const extent = (corners: Vector[], [x, y, z]: Vector) => {
  let [min, max] = [Infinity, -Infinity]
  for (const corner of corners) {
    const length = corner[0] * x + corner[1] * y + corner[2] * z
    min = Math.min(min, length)
    max = Math.max(max, length)
  }
  return [min, max] as const
}

const AXES: Vector[] = [
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1],
]

/** Separating-axis test, bounds first; pieces that merely touch still fuse. */
function overlap(a: Piece, b: Piece) {
  const [cornersA, cornersB] = [cornersOf(a), cornersOf(b)]
  const apart = (normal: Vector) => {
    const [minA, maxA] = extent(cornersA, normal)
    const [minB, maxB] = extent(cornersB, normal)
    return Math.min(maxA, maxB) - Math.max(minA, minB) < -1e-3
  }
  return !AXES.some(apart) && ![...a.faces, ...b.faces].some(({ normal }) => apart(normal))
}

export function sculpture(name: SculptureName): Sculpture {
  const grouped = makers[name]()
  const raw = grouped.flat()
  const corners = raw.flatMap(cornersOf)
  const middle = [0, 1, 2].map((axis) => {
    const values = corners.map((corner) => corner[axis]!)
    return (Math.min(...values) + Math.max(...values)) / 2
  })
  const center = shift(-middle[0]!, -middle[1]!, -middle[2]!)
  const pieces = raw.map(({ faces }) => solid(faces.map(({ corners }) => corners.map(center))))
  const radius = Math.max(...pieces.flatMap(cornersOf).map((corner) => Math.hypot(...corner)))
  const partners = pieces.map((piece, i) =>
    pieces.flatMap((other, j) => (i !== j && overlap(piece, other) ? [j] : [])),
  )
  let next = 0
  const parts = grouped.map((group) => group.map(() => next++))
  return { pieces, parts, partners, radius }
}

export const sculptureView = ({ radius }: Sculpture) => radius * 2 * MARGIN

interface Etch {
  /** Leaves out the walls lying inside or against another piece, where pieces touch or overlap. */
  joined?: boolean
  /** Faces meeting at a shallower angle than this, in radians, are etched as one surface. */
  smooth?: number
}

const joinedSmooth: Etch = { joined: true, smooth: 0.2 }
const etches: Partial<Record<SculptureName, Etch>> = {
  sampad: joinedSmooth,
  spotify: joinedSmooth,
  soundcloud: joinedSmooth,
  appleMusic: joinedSmooth,
  youtube: joinedSmooth,
}

export function etching(
  name: SculptureName,
  { joined = false, smooth = 0 }: Etch = etches[name] ?? {},
) {
  const built = sculpture(name)
  const size = sculptureView(built)
  const eye = size / 2 / Math.tan(SCULPTURE_FIELD_OF_VIEW / 2)
  const project = ([x, y, z]: Vector) => {
    const scale = eye / (eye - z)
    return `${(x * scale).toFixed(3)} ${(-y * scale).toFixed(3)}`
  }
  const within = (point: Vector, skip: number) =>
    built.pieces.some(
      ({ planes }, index) =>
        index !== skip &&
        planes.every(([x, y, z, w]) => x * point[0] + y * point[1] + z * point[2] <= w + 1e-6),
    )
  const facing = new Map<string, Vector>()
  const edges = new Set<string>()
  built.pieces.forEach(({ faces }, index) => {
    for (const { normal, corners } of faces) {
      if (normal[2] < 0.02) continue
      const average = (axis: 0 | 1 | 2) =>
        corners.reduce((sum, corner) => sum + corner[axis], 0) / corners.length
      const middle: Vector = [average(0), average(1), average(2)]
      if (joined && within(middle, index)) continue
      corners.forEach((corner, i) => {
        const next = corners[(i + 1) % corners.length]!
        const [a, b] = [project(corner), project(next)]
        const edge = a < b ? `M${a}L${b}` : `M${b}L${a}`
        const other = facing.get(edge)
        const bend =
          other &&
          Math.acos(
            Math.min(
              1,
              other.reduce((sum, value, axis) => sum + value * normal[axis]!, 0),
            ),
          )
        if (smooth && bend !== undefined && bend < smooth) edges.delete(edge)
        else edges.add(edge)
        facing.set(edge, normal)
      })
    }
  })
  return { viewBox: `${-size / 2} ${-size / 2} ${size} ${size}`, path: [...edges].join("") }
}
