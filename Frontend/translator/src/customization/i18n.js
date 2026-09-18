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

// Landing texts are objects keyed by locale: { es: "...", rap: "...", en: "..." }.
// A missing, empty or null translation falls back to the page's default locale
// (and then to Spanish), so a text that is not translated yet shows readable
// Spanish instead of a blank.

const isFilled = (value) => typeof value === "string" && value.trim() !== ""

export function translate(node, locale, fallbackLocale = "es") {
  if (node == null) return ""
  if (typeof node === "string") return node
  if (isFilled(node[locale])) return node[locale]
  if (isFilled(node[fallbackLocale])) return node[fallbackLocale]
  if (isFilled(node.es)) return node.es
  const first = Object.values(node).find(isFilled)
  return first || ""
}

/** A translator bound to the locale the visitor picked. */
export function makeTr(locale, fallbackLocale) {
  return (node) => translate(node, locale, fallbackLocale)
}

export function isTranslated(node, locale) {
  return node != null && typeof node === "object" && isFilled(node[locale])
}

const LOCALE_KEY = /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})?$/

/** Heuristic used by the editor: an object whose keys all look like locales. */
export function looksLikeI18n(value, locales) {
  if (value == null || typeof value !== "object" || Array.isArray(value)) return false
  const keys = Object.keys(value)
  if (!keys.length) return false
  return keys.every(
    (key) => LOCALE_KEY.test(key) && (typeof value[key] === "string" || value[key] === null)
  ) && keys.some((key) => locales.includes(key))
}
