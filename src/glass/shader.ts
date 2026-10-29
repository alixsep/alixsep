import type { Piece } from "./geometry"

/** The tone curve's exposure: output = 1 - exp(-light * EXPOSURE). */
export const EXPOSURE = 1.3

const transforms = (count: number) => `
uniform mat3 uRotation[${count}];
uniform vec4 uPlacement[${count}];
uniform float uEyeDistance;`

const project = `
const float NEAR = 1.0;

vec4 project(vec3 world) {
  vec3 v = world - vec3(0.0, 0.0, uEyeDistance);
  float far = uEyeDistance * 2.0;
  float depth = (-(far + NEAR) * v.z - 2.0 * far * NEAR) / (far - NEAR);
  return vec4(v.xy / uHalfView, depth, -v.z);
}`

export function vertexShader(count: number) {
  return `#version 300 es
${transforms(count)}
uniform vec2 uHalfView;

in vec3 aPosition;
in vec3 aNormal;
in float aPiece;

centroid out vec3 vWorld;
centroid out vec3 vNormal;
flat out int vPiece;
${project}

void main() {
  int k = int(aPiece + 0.5);
  vWorld = uPlacement[k].xyz + uRotation[k] * (aPosition * uPlacement[k].w);
  vNormal = uRotation[k] * aNormal;
  vPiece = k;
  gl_Position = project(vWorld);
}`
}

/** The page as a depth-only plane at z = uClip: whatever sits behind it is hidden. */
export const paperVertexShader = `#version 300 es
uniform vec2 uHalfView;
uniform float uEyeDistance;
uniform float uClip;
${project}

void main() {
  vec2 corner = vec2(gl_VertexID == 1 ? 3.0 : -1.0, gl_VertexID == 2 ? 3.0 : -1.0);
  gl_Position = project(vec3(corner * uEyeDistance * 4.0, uClip));
}`

export const paperFragmentShader = `#version 300 es
precision mediump float;
out vec4 color;

void main() {
  color = vec4(0.0);
}`

/**
 * Refracts in at the rasterized surface, bounces under total internal reflection, and refracts
 * out. Overlapping pieces are traced as one union, so only the outer surface refracts.
 */
export function fragmentShader(
  pieces: Piece[],
  partners: number[][],
  { printed = false, inlaid = false } = {},
) {
  const count = pieces.length
  const firsts = pieces.reduce((list, piece) => [...list, list.at(-1)! + piece.planes.length], [0])
  const partnerFirsts = partners.reduce(
    (list, group) => [...list, list.at(-1)! + group.length],
    [0],
  )
  const partnerList = partners.flat()
  if (!partnerList.length) partnerList.push(-1)
  const groupSize = Math.max(...partners.map((group) => group.length))

  return `#version 300 es
precision highp float;
precision highp int;
${transforms(count)}
uniform highp sampler2D uPlanes;
uniform sampler2D uEnvironment;
uniform float uYaw;
// Pre-compensated so the tone curve returns the page colour unchanged.
uniform vec3 uBackdrop;
uniform float uSeeThrough;
uniform vec2 uBackdropRange;
uniform vec3 uAbsorption;
uniform sampler2D uPrint;
uniform vec2 uPrintSize;
uniform vec3 uInk;
uniform sampler2D uInlay;
uniform vec2 uInlaySize;
uniform vec2 uInlayGrid;

centroid in vec3 vWorld;
centroid in vec3 vNormal;
flat in int vPiece;

out vec4 fragColor;

const int FIRST[${count + 1}] = int[${count + 1}](${firsts.join(", ")});
const int FIRST_PARTNER[${count + 1}] = int[${count + 1}](${partnerFirsts.join(", ")});
const int PARTNERS[${partnerList.length}] = int[${partnerList.length}](${partnerList.join(", ")});
const int GROUP_SIZE = ${groupSize};

const float IOR = 2.02;
const float DISPERSION = 0.018;
const float GLINT = 1.35;
const float SATURATION = 0.7;
const float HIGHLIGHT = 8.25;
const float EXPOSURE = ${EXPOSURE.toFixed(2)};
const int BOUNCES = 4;
const bool PRINTED = ${printed};
const bool INLAID = ${inlaid};
const float EPSILON = 1e-4;
const vec3 LUMA = vec3(0.299, 0.587, 0.114);
const vec3 LIGHT = normalize(vec3(0.3, 1.0, 0.45));

// The studio lights all around, except straight behind the glass, where the page itself is.
vec3 environment(vec3 d) {
  float behind = uSeeThrough * smoothstep(uBackdropRange.x, uBackdropRange.y, -d.z);
  float c = cos(uYaw), s = sin(uYaw);
  vec3 turned = vec3(c * d.x - s * d.z, d.y, s * d.x + c * d.z);
  vec2 uv = vec2(
    atan(turned.z, turned.x) * 0.159154943 + 0.5,
    asin(clamp(turned.y, -1.0, 1.0)) * 0.318309886 + 0.5
  );
  vec3 color = texture(uEnvironment, uv).rgb;
  color *= 1.0 + HIGHLIGHT * smoothstep(0.86, 1.0, dot(color, LUMA));
  return mix(color, uBackdrop, behind);
}

// Entry and exit distances of a world-space ray through piece k, with the facet normals.
vec2 span(int k, vec3 origin, vec3 direction, out vec3 inward, out vec3 outward) {
  vec3 o = (origin - uPlacement[k].xyz) * uRotation[k] / uPlacement[k].w;
  vec3 d = direction * uRotation[k] / uPlacement[k].w;
  float near = -1e9, far = 1e9;
  inward = outward = vec3(0.0, 0.0, 1.0);
  for (int i = FIRST[k]; i < FIRST[k + 1]; i++) {
    vec4 p = texelFetch(uPlanes, ivec2(i, 0), 0);
    float dn = dot(p.xyz, d), gap = p.w - dot(p.xyz, o);
    if (dn < 0.0) {
      float t = gap / dn;
      if (t > near) { near = t; inward = p.xyz; }
    } else if (dn > 0.0) {
      float t = gap / dn;
      if (t < far) { far = t; outward = p.xyz; }
    } else if (gap < 0.0) {
      return vec2(1e9, -1e9);
    }
  }
  inward = uRotation[k] * inward;
  outward = uRotation[k] * outward;
  return vec2(near, far);
}

float leave(inout int k, vec3 origin, vec3 direction, out vec3 normal) {
  vec3 inward;
  float exit = span(k, origin, direction, inward, normal).y;
  for (int pass = 0; pass < GROUP_SIZE; pass++) {
    bool extended = false;
    for (int i = FIRST_PARTNER[k]; i < FIRST_PARTNER[k + 1]; i++) {
      int j = PARTNERS[i];
      vec3 outward;
      vec2 other = span(j, origin, direction, inward, outward);
      if (other.x <= exit + EPSILON && other.y > exit + EPSILON) {
        exit = other.y;
        normal = outward;
        k = j;
        extended = true;
      }
    }
    if (!extended) break;
  }
  return exit;
}

// Coverage of the print on the top face of piece 0 at world point p.
float print(vec3 p) {
  vec3 local = (p - uPlacement[0].xyz) * uRotation[0] / uPlacement[0].w;
  return texture(uPrint, local.xy / uPrintSize + 0.5).a;
}

// Artwork set behind the back table of piece k, seen where a ray leaves through it.
bool inlay(int k, vec3 p, vec3 normal, out vec3 color) {
  vec2 uv = ((p - uPlacement[k].xyz) * uRotation[k] / uPlacement[k].w).xy / uInlaySize + 0.5;
  bool back = (normal * uRotation[k]).z < -0.999;
  if (!back || any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0)))) return false;
  vec2 tile = vec2(mod(float(k), uInlayGrid.x), uInlayGrid.y - 1.0 - floor(float(k) / uInlayGrid.x));
  vec3 art = texture(uInlay, (tile + uv) / uInlayGrid).rgb;
  color = -log(1.0 - min(art, 0.995)) / EXPOSURE;
  return true;
}

void main() {
  vec3 ray = normalize(vWorld - vec3(0.0, 0.0, uEyeDistance));
  vec3 entryNormal = normalize(vNormal);

  // Traced once; dispersion is applied only at the exit, where nearly all fringing comes from.
  vec3 d = refract(ray, entryNormal, 1.0 / IOR);
  if (dot(d, d) < 1e-6) d = reflect(ray, entryNormal);
  vec3 p = vWorld;
  vec3 exitNormal = vec3(0.0);
  int k = vPiece;
  float path = 0.0;
  for (int i = 0; i < BOUNCES; i++) {
    vec3 n;
    float t = leave(k, p, d, n);
    if (t > 1e8 || t < 0.0) break;
    p += d * t;
    path += t;
    vec3 escaped = refract(d, -n, IOR);
    if (dot(escaped, escaped) > 1e-6) { exitNormal = n; break; }
    d = reflect(d, n);
  }

  vec3 color;
  bool showsArt = INLAID && exitNormal != vec3(0.0) && inlay(k, p, exitNormal, color);
  for (int channel = 0; channel < 3 && !showsArt; channel++) {
    vec3 leaving = d;
    if (exitNormal != vec3(0.0)) {
      vec3 escaped = refract(d, -exitNormal, IOR + float(channel - 1) * DISPERSION);
      if (dot(escaped, escaped) > 1e-6) leaving = escaped;
    }
    color[channel] = environment(leaving)[channel];
  }
  color *= exp(-path * uAbsorption);

  vec3 mirror = reflect(ray, entryNormal);
  float fresnel = pow(1.0 - max(dot(-ray, entryNormal), 0.0), 4.0);
  color = mix(color, environment(mirror), 0.05 + 0.85 * fresnel);
  color += pow(max(dot(mirror, LIGHT), 0.0), 120.0) * GLINT;
  color = mix(vec3(dot(color, LUMA)), color, showsArt ? 1.0 : SATURATION);
  fragColor = vec4(1.0 - exp(-color * EXPOSURE), 1.0);
  bool top = vPiece == 0 && dot(normalize(vNormal) * uRotation[0], vec3(0.0, 0.0, 1.0)) > 0.999;
  if (PRINTED && top) fragColor.rgb = mix(fragColor.rgb, uInk, print(vWorld));
}`
}
