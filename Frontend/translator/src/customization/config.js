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

// THE CUSTOMIZATION DOCUMENT
// --------------------------
// Everything that differs between translators (names, colours, images, texts,
// languages, features, the whole landing page) lives in one JSON document.
//
//   * presets/<variant>.json is the built-in default for each deployment
//     (NEXT_PUBLIC_VARIANT picks it; unknown variants use the neutral
//     "generic" template). rap.json and arn.json reproduce the two sites as
//     they were before the editor existed.
//   * An admin edits the document in "Administrar Traductor"
//     (/manage-translator); the backend validates and stores it
//     (Backend/translatorapp_v2/customization).
//   * resolveWith() lays the stored document over the preset, so a field
//     added to the presets later shows up with its default in documents saved
//     before it existed.
//
// This module has no preset imports so it stays small in the client bundle;
// presets.js loads them (server components and the editor only).
//
// Adding a field: add it to the three presets, to the backend schema
// (customization/schema.py; its tests check the presets still validate) and
// to the editor section that should expose it.

const isPlainObject = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value)

/**
 * Deep-merge `override` onto `base`. Objects merge key by key; arrays and
 * scalars from `override` replace the base value wholesale (a list edited by an
 * admin is the whole list, not a patch).
 */
export function deepMerge(base, override) {
  if (override === undefined) return base
  if (!isPlainObject(base) || !isPlainObject(override)) return override
  const merged = { ...base }
  for (const [key, value] of Object.entries(override)) {
    merged[key] = deepMerge(base[key], value)
  }
  return merged
}

export const SECTION_IDS = [
  "about",
  "validation",
  "focus",
  "owners",
  "collaborators",
  "funding",
  "contact",
]

/** The document with the access rules in force (reported by the API, which
 * enforces them) in place of its own. */
export function withAccess(config, access) {
  return access ? { ...config, access } : config
}

/** The document to render: `stored` (if any) laid over the `base` preset. */
export function resolveWith(base, stored) {
  const merged = deepMerge(base, stored || undefined)
  // Sections added in later versions appear (hidden) at the end, so the
  // editor can offer them without breaking the saved order.
  const known = new Set(merged.landing.sections.map((section) => section.id))
  const missing = SECTION_IDS.filter((id) => !known.has(id)).map((id) => ({
    id,
    visible: false,
    tone: "paper",
  }))
  if (missing.length) {
    merged.landing = { ...merged.landing, sections: [...merged.landing.sections, ...missing] }
  }
  return merged
}

// ---------------------------------------------------------------- paths
/** Read a dotted path ("landing.hero.title") from an object. */
export function getIn(object, path) {
  if (!path) return object
  return String(path)
    .split(".")
    .reduce((node, key) => (node == null ? undefined : node[key]), object)
}

/** Immutable set of a dotted path; numeric segments index arrays. */
export function setIn(object, path, value) {
  const keys = String(path).split(".")
  const write = (node, index) => {
    const key = keys[index]
    const isIndex = Array.isArray(node)
    const copy = isIndex ? [...node] : { ...(node || {}) }
    const slot = isIndex ? Number(key) : key
    copy[slot] = index === keys.length - 1 ? value : write(node?.[slot], index + 1)
    return copy
  }
  return write(object, 0)
}
