// Copyright 2024 Centro Nacional de Inteligencia Artificial (CENIA, Chile). All rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
"use client"

import { useEffect, useRef } from "react"

// Dot-matrix map of a territory: a circular close-up around the pins framed
// against a small inset of the whole region, with one pin per place. Built for
// the Rapa Nui validation sites; any region works -- "Mapa de validación" in
// Administrar Traductor takes a GeoJSON outline and the list of places. With
// `closeUp` off it draws only the whole region, for a territory too large to
// zoom into (La Araucanía).
//
// The drawing is plain geometry over the outline, so it is built as an SVG
// string and injected once per layout rather than as a React tree -- there are
// a few thousand generated <circle> elements and none of them hold state.

const MAIN_W = 640
const MAIN_H = 520
const INSET_W = 250
const INSET_H = 190
const DEFAULT_COLORS = { dots: "#b7d3ea", accent: "#2b7fc4", surface: "#f4f9fc" }
const CONTEXT_STROKE = "#cfd4d9"
const CONTEXT_HALO = "#ffffff"
const HEX = /^#[0-9a-f]{6}$/i

const hexToRgba = (hex, alpha) => {
  const value = parseInt(hex.slice(1), 16)
  return `rgba(${(value >> 16) & 255},${(value >> 8) & 255},${value & 255},${alpha})`
}

// One request per outline, however often the map is rebuilt (the editor's
// live preview rebuilds it on every change).
const geoJsonCache = new Map()
function loadGeoJson(url) {
  if (!geoJsonCache.has(url)) {
    const request = fetch(url).then((response) => {
      if (!response.ok) throw new Error(`geojson ${response.status}`)
      return response.json()
    })
    request.catch(() => geoJsonCache.delete(url))
    geoJsonCache.set(url, request)
  }
  return geoJsonCache.get(url)
}

/**
 * Polygon rings from the formats the editor accepts: the legacy
 * { rings: [...] } file, or GeoJSON (Polygon, MultiPolygon, Feature,
 * FeatureCollection, GeometryCollection). Holes are just more rings: the
 * even-odd test below leaves them empty.
 */
export function ringsOf(geo) {
  if (!geo || typeof geo !== "object") return []
  if (Array.isArray(geo.rings)) return geo.rings
  switch (geo.type) {
    case "Polygon":
      return geo.coordinates || []
    case "MultiPolygon":
      return (geo.coordinates || []).flat()
    case "Feature":
      return ringsOf(geo.geometry)
    case "FeatureCollection":
      return (geo.features || []).flatMap(ringsOf)
    case "GeometryCollection":
      return (geo.geometries || []).flatMap(ringsOf)
    default:
      return []
  }
}

/**
 * Polylines of a context outline (the country around the region): line
 * geometries as they are, polygons as their rings.
 */
export function linesOf(geo) {
  if (!geo || typeof geo !== "object") return []
  switch (geo.type) {
    case "LineString":
      return [geo.coordinates || []]
    case "MultiLineString":
      return geo.coordinates || []
    case "Feature":
      return linesOf(geo.geometry)
    case "FeatureCollection":
      return (geo.features || []).flatMap(linesOf)
    case "GeometryCollection":
      return (geo.geometries || []).flatMap(linesOf)
    default:
      return ringsOf(geo)
  }
}

/**
 * The parts of the region's outline that are not on the context outline: its
 * limits with the neighbouring regions. Where the region meets the coast or a
 * border the country's contour already draws that line, and drawing the region
 * there too doubles it (the two outlines are simplified differently).
 * `tolerance` is in degrees; distances use a local equirectangular metric.
 */
function innerLimits(rings, contextLines, tolerance) {
  const lat0 = rings.flat().reduce((sum, p) => sum + p[1], 0) / rings.flat().length
  const cos = Math.cos((lat0 * Math.PI) / 180)
  const segments = contextLines.flatMap((line) => line.slice(1).map((b, i) => [line[i], b]))
  const nearContour = ([lon, lat]) => {
    const px = lon * cos
    for (const [[ax0, ay], [bx0, by]] of segments) {
      const ax = ax0 * cos
      const bx = bx0 * cos
      const dx = bx - ax
      const dy = by - ay
      const len = dx * dx + dy * dy
      const t = len ? Math.max(0, Math.min(1, ((px - ax) * dx + (lat - ay) * dy) / len)) : 0
      if (Math.hypot(px - (ax + t * dx), lat - (ay + t * dy)) < tolerance) return true
    }
    return false
  }
  const limits = []
  for (const ring of rings) {
    const on = ring.map(nearContour)
    const start = on.indexOf(true)
    if (start < 0) {
      limits.push(ring) // the region touches no contour: all of it is a limit
      continue
    }
    // walk once around from a point on the contour, collecting the runs off it
    // (with their end points on the contour, so they meet the country's line)
    let run = null
    for (let k = 0; k <= ring.length; k++) {
      const i = (start + k) % ring.length
      if (!on[i]) {
        if (!run) run = [ring[(i - 1 + ring.length) % ring.length]]
        run.push(ring[i])
      } else if (run) {
        run.push(ring[i])
        limits.push(run)
        run = null
      }
    }
  }
  return limits
}

const escapeAttr = (value) => String(value).split('"').join("&quot;")

/** Even-odd point-in-polygon test against the island rings. */
function pointInRings(lon, lat, rings) {
  let inside = false
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i]
      const [xj, yj] = ring[j]
      if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
        inside = !inside
      }
    }
  }
  return inside
}

/** Equirectangular projection fitted to `bbox` inside a w x h box. */
function makeProjection(bbox, w, h, pad) {
  const [minLon, minLat, maxLon, maxLat] = bbox
  const midLat = (minLat + maxLat) / 2
  const cos = Math.cos((midLat * Math.PI) / 180)
  const k = Math.min((w - 2 * pad) / ((maxLon - minLon) * cos), (h - 2 * pad) / (maxLat - minLat))
  const ox = (w - (maxLon - minLon) * cos * k) / 2
  const oy = (h - (maxLat - minLat) * k) / 2
  return {
    fwd: (lon, lat) => [ox + (lon - minLon) * cos * k, oy + (maxLat - lat) * k],
    inv: (x, y) => [minLon + (x - ox) / (cos * k), maxLat - (y - oy) / k],
  }
}

/** Hex-packed dots covering the land area inside `bbox`. */
function dotField(rings, bbox, w, h, pad, step, r, color, bound) {
  const proj = makeProjection(bbox, w, h, pad)
  let svg = ""
  let row = 0
  for (let y = step / 2; y < h; y += step, row++) {
    const offset = row % 2 ? step / 2 : 0
    for (let x = step / 2 + offset; x < w; x += step) {
      if (bound && !bound(x, y, r)) continue
      const [lon, lat] = proj.inv(x, y)
      if (pointInRings(lon, lat, rings)) {
        svg += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}" fill="${color}"></circle>`
      }
    }
  }
  return { svg, proj }
}

/** Keeps a pin inside the close-up's circular frame. */
function clampToCircle(p) {
  const cx = MAIN_W / 2
  const cy = MAIN_H / 2
  const radius = MAIN_H / 2 - 14
  const vx = p[0] - cx
  const vy = p[1] - cy
  const vr = Math.hypot(vx, vy)
  if (vr > radius) {
    p[0] = cx + (vx / vr) * radius
    p[1] = cy + (vy / vr) * radius
  }
}

/**
 * Nudge overlapping pins apart so each one stays clickable, while pulling them
 * back toward their true coordinate and keeping them inside the frame.
 */
function declutter(anchors, clamp = clampToCircle) {
  const pos = anchors.map((p) => p.slice())
  const minD = 17
  for (let iter = 0; iter < 240; iter++) {
    for (let i = 0; i < pos.length; i++) {
      for (let j = i + 1; j < pos.length; j++) {
        const dx = pos[j][0] - pos[i][0]
        const dy = pos[j][1] - pos[i][1]
        const d = Math.hypot(dx, dy) || 0.01
        if (d < minD) {
          const push = ((minD - d) / d) * 0.5
          pos[i][0] -= dx * push
          pos[i][1] -= dy * push
          pos[j][0] += dx * push
          pos[j][1] += dy * push
        }
      }
    }
    for (let i = 0; i < pos.length; i++) {
      pos[i][0] += (anchors[i][0] - pos[i][0]) * 0.02
      pos[i][1] += (anchors[i][1] - pos[i][1]) * 0.02
      clamp(pos[i])
    }
  }
  return pos
}

/** One pin: the pulsing halo, the dot, and a leader line when declutter moved it. */
function pinMarkup(pin, i, [x, y], [ax, ay], accent) {
  const moved = Math.hypot(x - ax, y - ay) > 6
  const leader = moved
    ? `<line x1="${ax}" y1="${ay}" x2="${x}" y2="${y}" stroke="${accent}" stroke-width="1" opacity="0.45"></line>` +
      `<circle cx="${ax}" cy="${ay}" r="1.8" fill="${accent}" opacity="0.55"></circle>`
    : ""
  return (
    `<g class="map-pin" data-i="${i}" data-x="${x}" data-y="${y}" style="cursor:pointer" ` +
    `tabindex="0" role="button" aria-label="${escapeAttr(pin.name)}">${leader}` +
    `<circle cx="${x}" cy="${y}" r="9" fill="${hexToRgba(accent, 0.18)}">` +
    `<animate attributeName="r" values="7;11;7" dur="2.4s" begin="${(i * 0.2).toFixed(1)}s" repeatCount="indefinite"></animate>` +
    `</circle>` +
    `<circle class="map-dot" cx="${x}" cy="${y}" r="5.5" fill="${accent}" stroke="#ffffff" stroke-width="2"></circle>` +
    `<circle cx="${x}" cy="${y}" r="9" fill="transparent"></circle></g>`
  )
}

const round1 = (value) => Number(value.toFixed(1))

export default function DotMap({ pins = [], geoJsonUrl, contextUrl, label, colors: colorProp, closeUp = true }) {
  const hostRef = useRef(null)
  const tipRef = useRef(null)

  // Only validated hex colours reach the SVG string
  const safe = (value, fallback) => (HEX.test(value || "") ? value : fallback)
  const dotColor = safe(colorProp?.dots, DEFAULT_COLORS.dots)
  const ACCENT = safe(colorProp?.accent, DEFAULT_COLORS.accent)
  const surface = safe(colorProp?.surface, DEFAULT_COLORS.surface)

  useEffect(() => {
    let cancelled = false
    let cleanupResize = () => {}
    if (!hostRef.current || !geoJsonUrl) return undefined

    // The context outline is decoration: without it the region still draws.
    const context = !closeUp && contextUrl ? loadGeoJson(contextUrl).catch(() => null) : null

    Promise.all([loadGeoJson(geoJsonUrl), context])
      .then(([geo, contextGeo]) => {
        if (cancelled || !hostRef.current) return
        const rings = ringsOf(geo).filter((ring) => Array.isArray(ring) && ring.length > 2)
        if (!rings.length) throw new Error("geojson has no rings")

        const flat = rings.flat()
        const lons = flat.map((p) => p[0])
        const lats = flat.map((p) => p[1])
        // 0.01 degrees around a small island, proportionally more for a region
        const extent = Math.max(Math.max(...lons) - Math.min(...lons), Math.max(...lats) - Math.min(...lats))
        const pad = Math.max(0.01, extent * 0.03)
        const islandBox = [
          Math.min(...lons) - pad,
          Math.min(...lats) - pad,
          Math.max(...lons) + pad,
          Math.max(...lats) + pad,
        ]

        const mount = (built) => {
          const host = hostRef.current
          const tip = tipRef.current
          if (!host || !tip) return
          host.innerHTML = built.svg
          tip.style.opacity = "0"

          host.querySelectorAll("g.map-pin").forEach((group) => {
            const i = Number(group.getAttribute("data-i"))
            const show = () => {
              // the region-only map can be narrower than its host, centred in it
              const hostRect = host.getBoundingClientRect()
              const rect = host.querySelector("svg").getBoundingClientRect()
              const dot = group.querySelector(".map-dot")
              if (dot) dot.setAttribute("r", "8")
              tip.textContent = pins[i].name
              tip.style.left = `${rect.left - hostRect.left + (Number(group.getAttribute("data-x")) / built.tw) * rect.width}px`
              tip.style.top = `${rect.top - hostRect.top + (Number(group.getAttribute("data-y")) / built.th) * rect.height}px`
              tip.style.opacity = "1"
            }
            const hide = () => {
              const dot = group.querySelector(".map-dot")
              if (dot) dot.setAttribute("r", "5.5")
              tip.style.opacity = "0"
            }
            group.addEventListener("mouseenter", show)
            group.addEventListener("mouseleave", hide)
            group.addEventListener("focus", show)
            group.addEventListener("blur", hide)
            group.addEventListener("click", show) // touch devices
          })
        }

        if (!closeUp) {
          // Whole region only, in its own proportions at the close-up's height
          // (capped at the close-up layout's width), so the section keeps its size.
          const framePad = 20
          const contextLines = linesOf(contextGeo).filter((line) => Array.isArray(line) && line.length > 1)
          // With a context outline, leave room above and below the region for
          // the surrounding country to read as such.
          let box = islandBox
          if (contextLines.length) {
            const dLat = (islandBox[3] - islandBox[1]) * 0.22
            const dLon = (islandBox[2] - islandBox[0]) * 0.06
            box = [islandBox[0] - dLon, islandBox[1] - dLat, islandBox[2] + dLon, islandBox[3] + dLat]
          }
          // Pins outside the region (a meeting in a neighbouring one) widen the
          // frame, so every pin sits on the map rather than clamped to its edge.
          if (pins.length) {
            const margin = Math.max(islandBox[2] - islandBox[0], islandBox[3] - islandBox[1]) * 0.05
            box = [
              Math.min(box[0], ...pins.map((p) => p.lon - margin)),
              Math.min(box[1], ...pins.map((p) => p.lat - margin)),
              Math.max(box[2], ...pins.map((p) => p.lon + margin)),
              Math.max(box[3], ...pins.map((p) => p.lat + margin)),
            ]
          }
          const [minLon, minLat, maxLon, maxLat] = box
          const cos = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180)
          const ratio = ((maxLon - minLon) * cos) / (maxLat - minLat)
          const th = MAIN_H
          const tw = Math.round(Math.min(MAIN_W + 90 + INSET_W, (th - 2 * framePad) * ratio + 2 * framePad))
          // A context with land (polygons) is filled with dots and the region
          // is told apart by its limits, drawn like the country's contour.
          const contextRings = ringsOf(contextGeo).filter((ring) => Array.isArray(ring) && ring.length > 2)
          const field = dotField(contextRings.length ? contextRings : rings, box, tw, th, framePad, 8.5, 2.6, dotColor)
          const regionSize = Math.max(islandBox[2] - islandBox[0], islandBox[3] - islandBox[1])
          const outlines = contextRings.length
            ? [...contextLines, ...innerLimits(rings, contextLines, regionSize * 0.012)]
            : contextLines
          // Each line sits on a white halo that hides the dots under it. All the
          // halos go first, so one line's halo never cuts through another line
          // where the region's limits meet the country's contour.
          const outlinePaths = outlines.map(
            (line) => `M${line.map(([lon, lat]) => field.proj.fwd(lon, lat).map((v) => v.toFixed(1)).join(",")).join("L")}`
          )
          const strokeAll = (stroke, width) =>
            outlinePaths
              .map(
                (d) =>
                  `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${width}" ` +
                  `stroke-linejoin="round" stroke-linecap="round"></path>`
              )
              .join("")
          const contextSvg = strokeAll(CONTEXT_HALO, 6) + strokeAll(CONTEXT_STROKE, 1.5)
          const anchors = pins.map((p) => field.proj.fwd(p.lon, p.lat))
          const placed = declutter(anchors, (p) => {
            p[0] = Math.min(tw - 10, Math.max(10, p[0]))
            p[1] = Math.min(th - 10, Math.max(10, p[1]))
          })
          const pinSvg = pins
            .map((pin, i) => pinMarkup(pin, i, placed[i].map(round1), anchors[i].map(round1), ACCENT))
            .join("")
          mount({
            svg:
              `<svg viewBox="0 0 ${tw} ${th}" style="width:100%;max-width:${tw}px;display:block;margin:0 auto" role="img"` +
              (label ? ` aria-label="${escapeAttr(label)}"` : "") +
              `>${field.svg}${contextSvg}${pinSvg}</svg>`,
            tw,
            th,
          })
          return
        }

        // Close-up viewport fitted to the pins, falling back to the region.
        let zoom = islandBox
        if (pins.length) {
          const pinLons = pins.map((p) => p.lon)
          const pinLats = pins.map((p) => p.lat)
          const x1 = Math.min(...pinLons)
          const x2 = Math.max(...pinLons)
          const y1 = Math.min(...pinLats)
          const y2 = Math.max(...pinLats)
          const mx = Math.max((x2 - x1) * 0.06, 0.002)
          const my = Math.max((y2 - y1) * 0.06, 0.002)
          zoom = [x1 - mx, y1 - my, x2 + mx, y2 + my]
        }

        const main = dotField(rings, zoom, MAIN_W, MAIN_H, 20, 8.5, 2.6, dotColor, (x, y, r) =>
          Math.hypot(x - MAIN_W / 2, y - MAIN_H / 2) <= MAIN_H / 2 - 2 + r
        )
        const inset = dotField(rings, islandBox, INSET_W, INSET_H, 14, 5.5, 1.7, dotColor)
        const [rzx1, rzy1] = inset.proj.fwd(zoom[0], zoom[3])
        const [rzx2, rzy2] = inset.proj.fwd(zoom[2], zoom[1])

        const anchors = pins.map((p) => main.proj.fwd(p.lon, p.lat))
        const placed = declutter(anchors)

        const buildSvg = (vertical) => {
          const gap = vertical ? 70 : 90
          const tw = vertical ? MAIN_W : MAIN_W + gap + INSET_W
          const th = vertical ? INSET_H + gap + MAIN_H : MAIN_H
          const ix = vertical ? (MAIN_W - INSET_W) / 2 : MAIN_W + gap
          const iy = vertical ? 0 : (MAIN_H - INSET_H) / 2
          const my = vertical ? INSET_H + gap : 0

          const c1 = [MAIN_W / 2, my + MAIN_H / 2]
          const r1 = MAIN_H / 2 - 2
          const zx1 = ix + rzx1
          const zy1 = iy + rzy1
          const zx2 = ix + rzx2
          const zy2 = iy + rzy2
          const czx = (zx1 + zx2) / 2
          const czy = (zy1 + zy2) / 2
          const r2 = Math.max(zx2 - zx1, zy2 - zy1) / 2

          const theta = Math.atan2(czy - c1[1], czx - c1[0])
          const beta = Math.acos((r1 - r2) / Math.hypot(czx - c1[0], czy - c1[1]))
          const at = (c, r, a) =>
            `${(c[0] + r * Math.cos(a)).toFixed(1)},${(c[1] + r * Math.sin(a)).toFixed(1)}`
          const tangent = (a) =>
            `<line x1="${(c1[0] + r1 * Math.cos(a)).toFixed(1)}" y1="${(c1[1] + r1 * Math.sin(a)).toFixed(1)}" ` +
            `x2="${(czx + r2 * Math.cos(a)).toFixed(1)}" y2="${(czy + r2 * Math.sin(a)).toFixed(1)}" ` +
            `stroke="${ACCENT}" stroke-width="1" stroke-dasharray="3 4" opacity="0.65"></line>`

          const beam =
            `<path d="M${at(c1, r1, theta + beta)} L${at([czx, czy], r2, theta + beta)} ` +
            `A${r2.toFixed(1)},${r2.toFixed(1)} 0 0 0 ${at([czx, czy], r2, theta - beta)} ` +
            `L${at(c1, r1, theta - beta)} Z" fill="${hexToRgba(ACCENT, 0.07)}"></path>`

          const pinSvg = pins
            .map((pin, i) =>
              pinMarkup(
                pin,
                i,
                [round1(placed[i][0]), round1(placed[i][1] + my)],
                [round1(anchors[i][0]), round1(anchors[i][1] + my)],
                ACCENT
              )
            )
            .join("")

          const svg =
            `<svg viewBox="0 0 ${tw} ${th}" style="width:100%;display:block" role="img"` +
            (label ? ` aria-label="${escapeAttr(label)}"` : "") +
            `><defs><clipPath id="dotmap-clip"><circle cx="${c1[0]}" cy="${c1[1]}" r="${r1 - 1}"></circle></clipPath></defs>` +
            beam +
            `<circle cx="${c1[0]}" cy="${c1[1]}" r="${r1}" fill="${surface}" stroke="${ACCENT}" stroke-width="1.5"></circle>` +
            `<g clip-path="url(#dotmap-clip)"><g transform="translate(0,${my})">${main.svg}</g></g>` +
            `<g transform="translate(${ix},${iy})">${inset.svg}</g>` +
            `<circle cx="${czx.toFixed(1)}" cy="${czy.toFixed(1)}" r="${r2.toFixed(1)}" fill="${hexToRgba(ACCENT, 0.08)}" stroke="${ACCENT}" stroke-width="1.5" stroke-dasharray="4 3"></circle>` +
            tangent(theta + beta) +
            tangent(theta - beta) +
            pinSvg +
            `</svg>`
          return { svg, tw, th }
        }

        let vertical = null

        const apply = (nextVertical) => {
          vertical = nextVertical
          mount(buildSvg(nextVertical))
        }

        const check = () => {
          const host = hostRef.current
          if (!host) return
          const width = (host.parentElement && host.parentElement.offsetWidth) || host.offsetWidth
          if (!width) return
          const next = width < 560
          if (next !== vertical) apply(next)
        }

        apply(false)
        check()
        window.addEventListener("resize", check)
        cleanupResize = () => window.removeEventListener("resize", check)
      })
      .catch(() => {
        if (!cancelled && hostRef.current) {
          hostRef.current.innerHTML =
            '<p style="text-align:center;color:#5a6e7c;font-size:15px;padding:32px 0">No se pudo cargar el mapa</p>'
        }
      })

    return () => {
      cancelled = true
      cleanupResize()
    }
  }, [pins, geoJsonUrl, contextUrl, label, dotColor, ACCENT, surface, closeUp])

  return (
    <div style={{ position: "relative", width: "100%" }}>
      <div ref={hostRef} style={{ position: "relative", width: "100%" }} />
      <div
        ref={tipRef}
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          pointerEvents: "none",
          opacity: 0,
          transition: "opacity .15s",
          background: "#12283a",
          color: "#ffffff",
          fontSize: "13.5px",
          fontWeight: 600,
          lineHeight: 1.4,
          padding: "8px 14px",
          borderRadius: "6px",
          boxShadow: "0 6px 20px rgba(18,40,58,.25)",
          whiteSpace: "nowrap",
          transform: "translate(-50%,-140%)",
          zIndex: 3,
        }}
      />
    </div>
  )
}
