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
import { translate } from "./i18n"

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

/** The alphabet and territory encoded in a code like arn_azumchefe_nagche. */
export function variantParts(code) {
  const [, writing = null, dialect = null] = String(code || "").split("_")
  return { writing, dialect }
}

/**
 * The two sides of the translator for a language with variants (the variant
 * selector in "Idiomas y funciones"): its codes encode an alphabet and a
 * territory, <prefix>_<alphabet>_<territory>. With a `sourceCode` the source
 * side offers the language once, without variants (arn_Latn), and the target
 * side always holds a complete variant: a territory and one of the alphabets
 * that territory allows. Without one, both sides keep the variants as before.
 */
export function useLanguageSides() {
  const { languages, translator } = useConfig()
  const all = useLanguageList()

  return useMemo(() => {
    const vs = languages.variantSelector
    const active = Boolean(vs.enabled && vs.prefix)
    const sourceCode = active ? vs.sourceCode || "" : ""
    const dialects = active ? vs.dialects || [] : []

    const isFamily = (lang) => active && matchesPrefix(lang, [vs.prefix])
    const optionFor = (code) => vs.options.find((option) => option.code === code)
    const dialectFor = (code) => dialects.find((dialect) => dialect.code === code)
    const codeFor = (writing, dialect) =>
      dialect ? `${vs.prefix}_${writing}_${dialect}` : `${vs.prefix}_${writing}`

    /** Alphabets offered for a territory (all of them without territories). */
    const writingsFor = (dialect) => {
      const allowed = dialectFor(dialect)?.writings
      const codes = allowed?.length ? allowed : vs.options.map((option) => option.code)
      return codes.map(optionFor).filter(Boolean)
    }

    // A code missing from the catalog still works (the model may know it); its
    // name is built from the selector's labels.
    const languageFor = (code) => {
      const known = findLanguage(all, code)
      if (known) return known
      const { writing, dialect } = variantParts(code)
      const label = isFamily(code)
        ? [dialectFor(dialect)?.label, optionFor(writing)?.label]
            .filter(Boolean)
            .map((text) => translate(text, "es"))
            .join(" ")
        : ""
      return { name: label || code, code, writing, dialect }
    }

    const isValidTarget = (code) => {
      const { writing, dialect } = variantParts(code)
      if (!dialects.length) return Boolean(optionFor(writing))
      return writingsFor(dialect).some((option) => option.code === writing) && Boolean(dialectFor(dialect))
    }

    const defaultTarget = () => {
      if (isFamily(translator.defaultTarget) && isValidTarget(translator.defaultTarget)) {
        return languageFor(translator.defaultTarget)
      }
      const dialect = dialects[0]?.code || null
      return languageFor(codeFor(writingsFor(dialect)[0]?.code, dialect))
    }

    return {
      languageFor,
      writingsFor,
      codeFor,
      dialects,
      /** The source side: the language without variants, when configured. */
      toSource: (lang) => (sourceCode && isFamily(lang) ? languageFor(sourceCode) : lang),
      /** The target side: a complete variant (the previous one, or the default). */
      toTarget: (lang, previous) => {
        if (!sourceCode || !isFamily(lang)) return lang
        if (isValidTarget(lang.code)) return languageFor(lang.code)
        if (previous && isValidTarget(previous.code)) return previous
        return defaultTarget()
      },
      /**
       * The territory and alphabet of a variant code, as the selectors' labels
       * (i18n texts, null when the code has none): null for other languages.
       */
      variantOf: (lang) => {
        if (!isFamily(lang) || lang?.code === sourceCode) return null
        const { writing, dialect } = variantParts(lang.code)
        const dialectLabel = dialectFor(dialect)?.label || null
        const writingLabel = optionFor(writing)?.label || null
        return dialectLabel || writingLabel ? { dialect: dialectLabel, writing: writingLabel } : null
      },
      /** Whether the territory / alphabet selectors apply to this language. */
      showsVariants: (lang) => isFamily(lang) && lang?.code !== sourceCode,
      /** The name to show in the language row: the language, not the variant. */
      displayLanguage: (lang) => (sourceCode && isFamily(lang) ? languageFor(sourceCode) : lang),
      /** The selector's list: the variants appear once, as the language. */
      selectorList: sourceCode
        ? all
            .filter((lang) => !isFamily(lang) || lang.code === sourceCode)
            .concat(findLanguage(all, sourceCode) ? [] : [languageFor(sourceCode)])
        : all,
      /** Same entry of the selector's list (any two variants are the language). */
      sameEntry: (a, b) => (sourceCode && isFamily(a) && isFamily(b)) || a?.code === b?.code,
    }
  }, [languages, translator.defaultTarget, all])
}
