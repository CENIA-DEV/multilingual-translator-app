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
import { VARIANT_LANG } from "../constants"

// Language codes produced by the selector, e.g. for the rap variant:
//   "spa-rap" (Spanish) | "rap" (Rapa Nui) | "eng-rap" (English)
export const SPANISH = `spa-${VARIANT_LANG}`
export const ENGLISH = `eng-${VARIANT_LANG}`
export const NATIVE = VARIANT_LANG

export const LANGUAGE_OPTIONS =
  VARIANT_LANG === "rap"
    ? [
        { value: SPANISH, label: "Español" },
        { value: NATIVE, label: "Rapa Nui" },
        { value: ENGLISH, label: "English" },
      ]
    : [
        { value: SPANISH, label: "Español" },
        { value: ENGLISH, label: "English" },
      ]

// A handful of entries in text.js predate the "<lang>-<variant>" convention and
// use bare "spa"/"eng" keys instead. Map to them before falling back.
const LEGACY_KEY = { [SPANISH]: "spa", [ENGLISH]: "eng" }

const isFilled = (value) => value !== undefined && value !== null && value !== ""

/**
 * Resolve one translated entry.
 *
 * Entries whose value for `language` is missing, empty or an explicit `null`
 * placeholder fall back to Spanish, so a pending translation shows readable
 * Spanish text rather than "undefined". See the TRANSLATION SLOTS note at the
 * top of text.js for how to fill one in.
 */
export function t(node, language) {
  if (!node) return ""
  if (isFilled(node[language])) return node[language]

  const legacy = LEGACY_KEY[language]
  if (legacy && isFilled(node[legacy])) return node[legacy]

  if (isFilled(node[SPANISH])) return node[SPANISH]
  if (isFilled(node.spa)) return node.spa
  return ""
}

/** True when `language` has no translation yet and `t()` is falling back. */
export function isPendingTranslation(node, language) {
  if (!node) return false
  return !isFilled(node[language]) && !isFilled(node[LEGACY_KEY[language]])
}
