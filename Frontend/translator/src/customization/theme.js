// Copyright 2026 Centro Nacional de Inteligencia Artificial (CENIA, Chile). All rights reserved.
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

// The theme reaches the page as CSS custom properties on :root.
//
//   --brand, --brand-hover, --brand-strong, --on-brand, --line
//       "R G B" triplets, so Tailwind can add opacity:
//       bg-default/10 -> rgb(var(--brand) / 0.1). The Tailwind colours
//       `default`, `defaultHover`, `defaultStrong` and `onDefault` point here,
//       which is how every existing `text-default` / `bg-default` follows the
//       admin's colour without touching the components.
//   --lp-<token>  landing palette, as hex, plus --lp-font-display / -text.
//
// globals.css declares the same variables with the historical values, so a
// page renders identically even before (or without) a stored theme.

const HEX = /^#([0-9a-f]{6})$/i

export function hexToRgb(hex) {
  const match = HEX.exec(hex || "")
  if (!match) return null
  const value = parseInt(match[1], 16)
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255]
}

export function rgbToHex([r, g, b]) {
  const clamp = (n) => Math.max(0, Math.min(255, Math.round(n)))
  return "#" + [r, g, b].map((n) => clamp(n).toString(16).padStart(2, "0")).join("")
}

const triplet = (hex) => {
  const rgb = hexToRgb(hex)
  return rgb ? rgb.join(" ") : null
}

/** Mix two colours; weight is the share of `b` (0..1). */
export function mix(a, b, weight) {
  const x = hexToRgb(a)
  const y = hexToRgb(b)
  if (!x || !y) return a
  return rgbToHex(x.map((channel, i) => channel + (y[i] - channel) * weight))
}

// WCAG relative luminance / contrast, for the editor's legibility hints.
function luminance(hex) {
  const rgb = hexToRgb(hex)
  if (!rgb) return 0
  const [r, g, b] = rgb.map((c) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contrastRatio(a, b) {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (light + 0.05) / (dark + 0.05)
}

const fontStack = (name, fallback) =>
  /^[A-Za-z0-9 ]{2,40}$/.test(name || "") ? `'${name}', ${fallback}` : fallback

/** CSS text for the theme. Only validated values make it into the string. */
export function themeCss(theme) {
  if (!theme) return ""
  const declarations = []
  const push = (name, value) => {
    if (value) declarations.push(`${name}:${value}`)
  }
  push("--brand", triplet(theme.primary))
  push("--brand-hover", triplet(theme.primaryHover))
  push("--brand-strong", triplet(theme.primaryStrong))
  push("--on-brand", triplet(theme.onPrimary))
  push("--line", triplet(theme.line))
  for (const [token, value] of Object.entries(theme.landing || {})) {
    if (HEX.test(value || "")) push(`--lp-${token}`, value)
  }
  push("--lp-font-display", fontStack(theme.fonts?.display, "Georgia, serif"))
  push("--lp-font-text", fontStack(theme.fonts?.text, "system-ui, sans-serif"))
  return `:root{${declarations.join(";")}}`
}

/**
 * A complete landing palette from three brand colours, for the editor's
 * "generate palette" helper. The rap / arn presets keep their exact tokens;
 * this is only a starting point for new languages.
 */
export function paletteFrom({ accent, night, paper = "#fdfdfc" }) {
  return {
    page: mix(paper, accent, 0.04),
    paper,
    tint: mix(paper, accent, 0.1),
    night,
    deepNight: mix(night, "#000000", 0.4),
    heroBase: mix(night, "#000000", 0.2),
    heroOverlay: mix(night, "#000000", 0.55),
    heading: mix(night, "#000000", 0.15),
    body: mix(night, "#7f8c8d", 0.35),
    subtle: mix(night, "#8a9aa8", 0.45),
    muted: mix(night, "#a0acb6", 0.55),
    accent,
    cta: accent,
    link: mix(accent, night, 0.15),
    highlight: mix(accent, night, 0.5),
    onDarkAccent: mix(accent, "#ffffff", 0.4),
    mapDots: mix(accent, "#ffffff", 0.65),
    mapSurface: mix(accent, "#ffffff", 0.95),
  }
}
