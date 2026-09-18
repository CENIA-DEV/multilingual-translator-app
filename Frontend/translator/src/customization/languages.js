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

"use client"

import { useMemo } from "react"
import CATALOG from "./language-catalog.json"
import { useConfig } from "./ConfigProvider"

// The language selector offers the catalog (every language the models know,
// NLLB codes plus the Mapuzungun graphemaries and Rapa Nui) minus the codes
// the document hides, with the document's renames and custom languages on top.

export { CATALOG }

export function buildLanguageList(languages) {
  const hidden = new Set(languages?.hidden || [])
  const renamed = languages?.renamed || {}
  const custom = languages?.custom || []
  const customCodes = new Set(custom.map((lang) => lang.code))

  const list = CATALOG.filter((lang) => !hidden.has(lang.code) && !customCodes.has(lang.code))
    .map((lang) => (renamed[lang.code] ? { ...lang, name: renamed[lang.code] } : lang))
    .concat(
      custom.map((lang) => ({
        name: renamed[lang.code] || lang.name,
        code: lang.code,
        writing: lang.writing || lang.code.split("_")[1] || null,
        dialect: lang.dialect ?? null,
      }))
    )
  return list.sort((a, b) => a.name.localeCompare(b.name))
}

export const prefixOf = (code) => String(code || "").toLowerCase().split("_")[0]

export function findLanguage(list, code) {
  return list.find((lang) => lang.code === code) || null
}

/** Whether a language (object or code) belongs to one of the given prefixes. */
export function matchesPrefix(lang, prefixes) {
  const prefix = prefixOf(typeof lang === "string" ? lang : lang?.code)
  return Boolean(prefix) && (prefixes || []).some((p) => prefixOf(p) === prefix)
}

/** Languages offered by the selectors, already filtered, renamed and sorted. */
export function useLanguageList() {
  const { languages } = useConfig()
  return useMemo(() => buildLanguageList(languages), [languages])
}
