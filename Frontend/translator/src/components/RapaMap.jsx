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

// Dot-matrix map of Rapa Nui: a circular close-up of Hanga Roa framed against a
// small inset of the whole island, with one pin per validation site.
//
// The drawing is plain geometry over the island outline, so it is built as an
// SVG string and injected once per layout rather than as a React tree -- there
// are a few thousand generated <circle> elements and none of them hold state.

const MAIN_W = 640
const MAIN_H = 520
const INSET_W = 250
const INSET_H = 190
const DOT_COLOR = "#b7d3ea"
const ACCENT = "#2b7fc4"

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

/**
 * Nudge overlapping pins apart so each one stays clickable, while pulling them
 * back toward their true coordinate and keeping them inside the circular frame.
 */
function declutter(anchors) {
  const pos = anchors.map((p) => p.slice())
  const minD = 17
  const cx = MAIN_W / 2
  const cy = MAIN_H / 2
  const radius = MAIN_H / 2 - 14
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
      const vx = pos[i][0] - cx
      const vy = pos[i][1] - cy
      const vr = Math.hypot(vx, vy)
      if (vr > radius) {
        pos[i][0] = cx + (vx / vr) * radius
        pos[i][1] = cy + (vy / vr) * radius
      }
    }
  }
  return pos
}

export default function RapaMap({ pins = [], geoJsonUrl = "/data/easter-island.geojson", label }) {
  const hostRef = useRef(null)
  const tipRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    let cleanupResize = () => {}
    if (!hostRef.current) return undefined

    fetch(geoJsonUrl)
      .then((response) => {
        if (!response.ok) throw new Error(`geojson ${response.status}`)
        return response.json()
      })
      .then((geo) => {
        if (cancelled || !hostRef.current) return
        const rings = geo.rings
        if (!rings || !rings.length) throw new Error("geojson has no rings")

        // Close-up viewport fitted to the pins, falling back to Hanga Roa.
        let zoom = [-109.465, -27.195, -109.395, -27.115]
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

        const main = dotField(rings, zoom, MAIN_W, MAIN_H, 20, 8.5, 2.6, DOT_COLOR, (x, y, r) =>
          Math.hypot(x - MAIN_W / 2, y - MAIN_H / 2) <= MAIN_H / 2 - 2 + r
        )

        const flat = rings.flat()
        const lons = flat.map((p) => p[0])
        const lats = flat.map((p) => p[1])
        const islandBox = [
          Math.min(...lons) - 0.01,
          Math.min(...lats) - 0.01,
          Math.max(...lons) + 0.01,
          Math.max(...lats) + 0.01,
        ]
        const inset = dotField(rings, islandBox, INSET_W, INSET_H, 14, 5.5, 1.7, DOT_COLOR)
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
            `L${at(c1, r1, theta - beta)} Z" fill="rgba(43,127,196,0.07)"></path>`

          const pinSvg = pins
            .map((pin, i) => {
              const x = Number(placed[i][0].toFixed(1))
              const y = Number((placed[i][1] + my).toFixed(1))
              const ax = Number(anchors[i][0].toFixed(1))
              const ay = Number((anchors[i][1] + my).toFixed(1))
              const moved = Math.hypot(x - ax, y - ay) > 6
              const leader = moved
                ? `<line x1="${ax}" y1="${ay}" x2="${x}" y2="${y}" stroke="${ACCENT}" stroke-width="1" opacity="0.45"></line>` +
                  `<circle cx="${ax}" cy="${ay}" r="1.8" fill="${ACCENT}" opacity="0.55"></circle>`
                : ""
              return (
                `<g class="rapa-pin" data-i="${i}" data-x="${x}" data-y="${y}" style="cursor:pointer" ` +
                `tabindex="0" role="button" aria-label="${escapeAttr(pin.name)}">${leader}` +
                `<circle cx="${x}" cy="${y}" r="9" fill="rgba(43,127,196,0.18)">` +
                `<animate attributeName="r" values="7;11;7" dur="2.4s" begin="${(i * 0.2).toFixed(1)}s" repeatCount="indefinite"></animate>` +
                `</circle>` +
                `<circle class="rapa-dot" cx="${x}" cy="${y}" r="5.5" fill="${ACCENT}" stroke="#ffffff" stroke-width="2"></circle>` +
                `<circle cx="${x}" cy="${y}" r="9" fill="transparent"></circle></g>`
              )
            })
            .join("")

          const svg =
            `<svg viewBox="0 0 ${tw} ${th}" style="width:100%;display:block" role="img"` +
            (label ? ` aria-label="${escapeAttr(label)}"` : "") +
            `><defs><clipPath id="rapa-mclip"><circle cx="${c1[0]}" cy="${c1[1]}" r="${r1 - 1}"></circle></clipPath></defs>` +
            beam +
            `<circle cx="${c1[0]}" cy="${c1[1]}" r="${r1}" fill="#f4f9fc" stroke="${ACCENT}" stroke-width="1.5"></circle>` +
            `<g clip-path="url(#rapa-mclip)"><g transform="translate(0,${my})">${main.svg}</g></g>` +
            `<g transform="translate(${ix},${iy})">${inset.svg}</g>` +
            `<circle cx="${czx.toFixed(1)}" cy="${czy.toFixed(1)}" r="${r2.toFixed(1)}" fill="rgba(43,127,196,0.08)" stroke="${ACCENT}" stroke-width="1.5" stroke-dasharray="4 3"></circle>` +
            tangent(theta + beta) +
            tangent(theta - beta) +
            pinSvg +
            `</svg>`
          return { svg, tw, th }
        }

        let vertical = null

        const apply = (nextVertical) => {
          const host = hostRef.current
          const tip = tipRef.current
          if (!host || !tip) return
          vertical = nextVertical
          const built = buildSvg(nextVertical)
          host.innerHTML = built.svg
          tip.style.opacity = "0"

          host.querySelectorAll("g.rapa-pin").forEach((group) => {
            const i = Number(group.getAttribute("data-i"))
            const show = () => {
              const rect = host.getBoundingClientRect()
              const dot = group.querySelector(".rapa-dot")
              if (dot) dot.setAttribute("r", "8")
              tip.textContent = pins[i].name
              tip.style.left = `${(Number(group.getAttribute("data-x")) / built.tw) * rect.width}px`
              tip.style.top = `${(Number(group.getAttribute("data-y")) / built.th) * rect.height}px`
              tip.style.opacity = "1"
            }
            const hide = () => {
              const dot = group.querySelector(".rapa-dot")
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
  }, [pins, geoJsonUrl, label])

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
