import opentype from "opentype.js"
import { compress } from "wawoff2"

import { advanceOf, CAP_HEIGHT, CHARACTERS, EM_PER_UNIT, glyphs, SPACE } from "@/glass/font"
import { site } from "@/site"

import type { APIRoute } from "astro"

const UNIT = EM_PER_UNIT * 1000
/** Grows every piece slightly so that pieces sharing an edge fuse instead of leaving a hairline. */
const OVERLAP = 2

function outline(polygon: readonly number[]) {
  const points: [number, number][] = []
  for (let i = 0; i < polygon.length; i += 2) {
    points.push([(polygon[i]! + 0.5) * UNIT, (CAP_HEIGHT - polygon[i + 1]!) * UNIT])
  }
  const cx = points.reduce((sum, [x]) => sum + x, 0) / points.length
  const cy = points.reduce((sum, [, y]) => sum + y, 0) / points.length
  const grown = points.map(([x, y]) => {
    const length = Math.hypot(x - cx, y - cy) || 1
    return [x + ((x - cx) / length) * OVERLAP, y + ((y - cy) / length) * OVERLAP] as const
  })
  const area = grown.reduce((sum, [x, y], i) => {
    const [nx, ny] = grown[(i + 1) % grown.length]!
    return sum + x * ny - nx * y
  }, 0)
  return area < 0 ? grown.reverse() : grown
}

const COPYRIGHT = `Copyright © ${new Date().getFullYear()} ${site.name}. All rights reserved.`

export const GET: APIRoute = async () => {
  const characters = [...CHARACTERS].map((character) => {
    const glyph = glyphs[character]!
    const path = new opentype.Path()
    for (const polygon of glyph) {
      outline(polygon).forEach(([x, y], i) => (i ? path.lineTo(x, y) : path.moveTo(x, y)))
      path.close()
    }
    const code = character.charCodeAt(0)
    const lower = character.toLowerCase().charCodeAt(0)
    return new opentype.Glyph({
      name: `uni${code.toString(16).toUpperCase().padStart(4, "0")}`,
      unicodes: lower === code ? [code] : [code, lower],
      advanceWidth: (advanceOf(glyph) + 1) * UNIT,
      path,
    })
  })

  const font = new opentype.Font({
    familyName: site.name,
    styleName: "Regular",
    designer: site.name,
    designerURL: site.url,
    manufacturer: site.name,
    copyright: COPYRIGHT,
    trademark: `${site.name} is a trademark of ${site.name}.`,
    license: "All rights reserved. Not licensed for use outside alixsep.com.",
    unitsPerEm: 1000,
    ascender: 800,
    descender: -250,
    glyphs: [
      new opentype.Glyph({ name: ".notdef", advanceWidth: 5 * UNIT, path: new opentype.Path() }),
      new opentype.Glyph({
        name: "space",
        unicode: 32,
        advanceWidth: SPACE * UNIT,
        path: new opentype.Path(),
      }),
      ...characters,
    ],
  })

  const woff2 = await compress(new Uint8Array(font.toArrayBuffer()))
  return new Response(woff2, { headers: { "Content-Type": "font/woff2" } })
}
