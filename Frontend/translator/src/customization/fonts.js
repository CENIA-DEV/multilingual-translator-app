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

// Landing typefaces an admin can choose from. A curated list rather than a free
// text box: every entry is on Google Fonts, has the weights the page uses and
// covers the extended Latin that indigenous orthographies need (ā ē ŋ ü ñ ꞌ).
// `spec` is the Google Fonts axis request for that family.

export const DISPLAY_FONTS = [
  { name: "Newsreader", spec: "ital,opsz,wght@0,6..72,400..700;1,6..72,400..600", kind: "serif" },
  { name: "Noto Serif", spec: "ital,wght@0,400..700;1,400..700", kind: "serif" },
  { name: "Lora", spec: "ital,wght@0,400..700;1,400..700", kind: "serif" },
  { name: "Merriweather", spec: "ital,wght@0,400;0,700;1,400", kind: "serif" },
  { name: "Source Serif 4", spec: "ital,opsz,wght@0,8..60,400..700;1,8..60,400..700", kind: "serif" },
  { name: "Fraunces", spec: "ital,opsz,wght@0,9..144,400..700;1,9..144,400..700", kind: "serif" },
  { name: "Playfair Display", spec: "ital,wght@0,400..700;1,400..700", kind: "serif" },
  { name: "Archivo", spec: "wght@400;500;600;700", kind: "sans-serif" },
  { name: "Montserrat", spec: "wght@400;500;600;700", kind: "sans-serif" },
]

export const TEXT_FONTS = [
  { name: "Archivo", spec: "wght@400;500;600;700", kind: "sans-serif" },
  { name: "Noto Sans", spec: "ital,wght@0,400..700;1,400..700", kind: "sans-serif" },
  { name: "Inter", spec: "wght@400;500;600;700", kind: "sans-serif" },
  { name: "Work Sans", spec: "wght@400;500;600;700", kind: "sans-serif" },
  { name: "Nunito Sans", spec: "wght@400;500;600;700", kind: "sans-serif" },
  { name: "DM Sans", spec: "wght@400;500;600;700", kind: "sans-serif" },
  { name: "IBM Plex Sans", spec: "wght@400;500;600;700", kind: "sans-serif" },
  { name: "Source Sans 3", spec: "wght@400;500;600;700", kind: "sans-serif" },
]

const SPECS = Object.fromEntries(
  [...DISPLAY_FONTS, ...TEXT_FONTS].map((font) => [font.name, font.spec])
)

/** Google Fonts stylesheet URL for the landing typefaces (unknown names skipped). */
export function landingFontsHref(fonts) {
  const families = [...new Set([fonts?.display, fonts?.text])]
    .filter((name) => SPECS[name])
    .map((name) => `family=${name.replace(/ /g, "+")}:${SPECS[name]}`)
  if (!families.length) return null
  return `https://fonts.googleapis.com/css2?${families.join("&")}&display=swap`
}
