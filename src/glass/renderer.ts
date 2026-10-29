import { bakeEnvironment } from "./environment"
import { overlapping, triangulate } from "./geometry"
import {
  EXPOSURE,
  fragmentShader,
  paperFragmentShader,
  paperVertexShader,
  vertexShader,
} from "./shader"

import type { Piece } from "./geometry"

export const FIELD_OF_VIEW = (18 * Math.PI) / 180

/** Absorption per channel: neutral on a dark page, a cool smoke on a light one. */
const CLEAR = [0.055, 0.055, 0.055]
const INK = { light: [0.12, 0.12, 0.14], dark: [0.93, 0.93, 0.94] }
const SMOKE = [0.26, 0.23, 0.15]

export interface PoseBuffers {
  rotations: Float32Array
  /** Position and uniform scale per piece. */
  placements: Float32Array
}

function compile(gl: WebGL2RenderingContext, type: GLenum, source: string) {
  const shader = gl.createShader(type)!
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  return shader
}

export const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve))

async function link(gl: WebGL2RenderingContext, vertex: string, fragment: string) {
  const parallel = gl.getExtension("KHR_parallel_shader_compile")
  const program = gl.createProgram()
  gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, vertex))
  gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, fragment))
  gl.linkProgram(program)
  if (parallel) {
    while (!gl.getProgramParameter(program, parallel.COMPLETION_STATUS_KHR)) await nextFrame()
  }
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program) ?? "Glass shader failed to link")
  }
  return program
}

type View = { width: number; height: number }

interface Options {
  partners?: number[][]
  backdropRange?: readonly [number, number]
  fieldOfView?: number
  /** Ink printed on the top face of the first piece, spanning `size` world units. */
  print?: { image: TexImageSource; size: readonly [number, number] }
  /** Artwork behind each piece's back table, one atlas tile per piece in reading order. */
  inlay?: {
    atlas: TexImageSource
    grid: readonly [number, number]
    size: readonly [number, number]
  }
}

/** Frames the plane z = 0 to exactly `view` world units, so glass at rest covers its flat mark. */
export async function createRenderer(
  canvas: HTMLCanvasElement,
  pieces: Piece[],
  view: View,
  {
    partners,
    backdropRange = [0.55, 0.9],
    fieldOfView = FIELD_OF_VIEW,
    print,
    inlay,
  }: Options = {},
) {
  const gl = canvas.getContext("webgl2", { antialias: true, stencil: false })
  if (!gl) return null

  gl.enable(gl.DEPTH_TEST)
  gl.enable(gl.CULL_FACE)
  gl.clearColor(0, 0, 0, 0)
  gl.bindVertexArray(gl.createVertexArray())
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer())

  gl.activeTexture(gl.TEXTURE1)
  gl.bindTexture(gl.TEXTURE_2D, gl.createTexture())
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)

  gl.activeTexture(gl.TEXTURE0)
  gl.bindTexture(gl.TEXTURE_2D, gl.createTexture())
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bakeEnvironment())

  if (print) {
    gl.activeTexture(gl.TEXTURE2)
    gl.bindTexture(gl.TEXTURE_2D, gl.createTexture())
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, print.image)
  }

  if (inlay) {
    gl.activeTexture(gl.TEXTURE3)
    gl.bindTexture(gl.TEXTURE_2D, gl.createTexture())
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, inlay.atlas)
    gl.generateMipmap(gl.TEXTURE_2D)
  }

  let program: WebGLProgram | undefined
  let locations: Record<"rotation" | "placement" | "yaw", WebGLUniformLocation | null>
  let vertexCount = 0
  let page: { backdrop: readonly [number, number, number]; light: boolean } | undefined

  const uniform = (name: string) => gl.getUniformLocation(program!, name)

  const paint = () => {
    if (!page) return
    gl.useProgram(program!)
    const untone = (value: number) => -Math.log(1 - Math.min(value, 0.995)) / EXPOSURE
    const { backdrop, light } = page
    gl.uniform3f(
      uniform("uBackdrop"),
      untone(backdrop[0]),
      untone(backdrop[1]),
      untone(backdrop[2]),
    )
    gl.uniform1f(uniform("uSeeThrough"), light ? 1 : 0.2)
    gl.uniform3fv(uniform("uAbsorption"), light ? SMOKE : CLEAR)
    gl.uniform3fv(uniform("uInk"), light ? INK.light : INK.dark)
  }

  /**
   * Links a program for new `pieces` while the current ones keep drawing, and resolves to the
   * swap, so a caller can change what it shows in the same frame as the glass.
   */
  const reshape = async (
    pieces: Piece[],
    view: View,
    fieldOfView: number,
    partners = overlapping(pieces),
  ) => {
    const linked = await link(
      gl,
      vertexShader(pieces.length),
      fragmentShader(pieces, partners, { printed: !!print, inlaid: !!inlay }),
    )
    return () => {
      if (program) gl.deleteProgram(program)
      program = linked
      gl.useProgram(program)

      const mesh = triangulate(pieces)
      const stride = 7 * Float32Array.BYTES_PER_ELEMENT
      vertexCount = mesh.length / 7
      gl.bufferData(gl.ARRAY_BUFFER, mesh, gl.STATIC_DRAW)
      const attributes = { aPosition: [3, 0], aNormal: [3, 3], aPiece: [1, 6] } as const
      for (const [name, [size, offset]] of Object.entries(attributes)) {
        const location = gl.getAttribLocation(program, name)
        gl.enableVertexAttribArray(location)
        gl.vertexAttribPointer(location, size, gl.FLOAT, false, stride, offset * 4)
      }

      const planes = new Float32Array(pieces.flatMap((piece) => piece.planes.flat()))
      gl.activeTexture(gl.TEXTURE1)
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA32F,
        planes.length / 4,
        1,
        0,
        gl.RGBA,
        gl.FLOAT,
        planes,
      )
      gl.uniform1i(uniform("uPlanes"), 1)
      if (print) {
        gl.uniform1i(uniform("uPrint"), 2)
        gl.uniform2f(uniform("uPrintSize"), ...print.size)
      }
      if (inlay) {
        gl.uniform1i(uniform("uInlay"), 3)
        gl.uniform2f(uniform("uInlayGrid"), ...inlay.grid)
        gl.uniform2f(uniform("uInlaySize"), ...inlay.size)
      }
      gl.uniform2f(uniform("uBackdropRange"), backdropRange[0], backdropRange[1])
      locations = {
        rotation: uniform("uRotation"),
        placement: uniform("uPlacement"),
        yaw: uniform("uYaw"),
      }
      frame(view, fieldOfView)
      paint()
    }
  }

  // A mark too large for this GPU's uniform limits fails to link; the flat mark then stays.
  const [paper, swap] = await Promise.all([
    link(gl, paperVertexShader, paperFragmentShader),
    reshape(pieces, view, fieldOfView, partners),
  ]).catch(() => [null, null])
  if (!paper || !swap) return null
  const clip = gl.getUniformLocation(paper, "uClip")

  const frame = (view: View, fieldOfView: number) => {
    const tangent = Math.tan(fieldOfView / 2)
    for (const shaded of [paper, program!]) {
      gl.useProgram(shaded)
      gl.uniform2f(
        gl.getUniformLocation(shaded, "uHalfView"),
        (tangent * view.width) / view.height,
        tangent,
      )
      gl.uniform1f(gl.getUniformLocation(shaded, "uEyeDistance"), view.height / 2 / tangent)
    }
  }
  swap()

  return {
    frame,
    reshape,
    setPage(backdrop: readonly [number, number, number], light: boolean) {
      page = { backdrop, light }
      paint()
    },
    dispose() {
      gl.getExtension("WEBGL_lose_context")?.loseContext()
    },
    clear() {
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
    },
    resize(width: number, height: number) {
      canvas.width = width
      canvas.height = height
      gl.viewport(0, 0, width, height)
    },
    /** With `page` set, glass behind the plane z = `page` is hidden, as if emerging from it. */
    draw(pose: PoseBuffers, lightYaw: number, page?: number) {
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
      if (page !== undefined) {
        gl.useProgram(paper)
        gl.uniform1f(clip, page)
        gl.colorMask(false, false, false, false)
        gl.drawArrays(gl.TRIANGLES, 0, 3)
        gl.colorMask(true, true, true, true)
        gl.useProgram(program!)
      }
      gl.uniformMatrix3fv(locations.rotation, false, pose.rotations)
      gl.uniform4fv(locations.placement, pose.placements)
      gl.uniform1f(locations.yaw, lightYaw)
      gl.drawArrays(gl.TRIANGLES, 0, vertexCount)
    },
  }
}

export type Renderer = NonNullable<Awaited<ReturnType<typeof createRenderer>>>
