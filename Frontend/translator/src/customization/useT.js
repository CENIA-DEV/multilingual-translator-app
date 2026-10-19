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
import { useConfig, useLocale } from "./ConfigProvider"
import { translate } from "./i18n"
import MESSAGES from "./messages"

const fill = (text, vars) =>
  vars ? text.replace(/\{(\w+)\}/g, (match, name) => (name in vars ? String(vars[name]) : match)) : text

/**
 * Texts in the visitor's language.
 *
 *   t("menu.home")                 fixed text (messages.js + the document's `ui` map)
 *   t("card.maxWords", { max: 5 }) with placeholders
 *   t.tr(node)                     a text of the document ({ es, en, ... } or a plain string)
 *   t.strict("asr.speaking.arn")   only if it exists in this language, else null
 *   t.langName(lang)               a language's name in this language
 *
 * Missing texts fall back to the site's default language, then to Spanish.
 */
export function useT() {
  const { ui } = useConfig()
  const { locale, defaultLocale } = useLocale()

  return useMemo(() => {
    const entry = (key) => {
      const base = MESSAGES[key]
      const custom = ui?.[key]
      if (!custom) return base
      return base ? { ...base, ...custom } : custom
    }
    const t = (key, vars) => {
      const node = entry(key)
      return node ? fill(translate(node, locale, defaultLocale), vars) : key
    }
    t.tr = (node) => translate(node, locale, defaultLocale)
    t.strict = (key, vars) => {
      const text = entry(key)?.[locale]
      return typeof text === "string" && text.trim() ? fill(text, vars) : null
    }
    t.langName = (lang) => (lang ? t.strict(`lang.${lang.code}`) || lang.name : "")
    t.locale = locale
    return t
  }, [ui, locale, defaultLocale])
}
