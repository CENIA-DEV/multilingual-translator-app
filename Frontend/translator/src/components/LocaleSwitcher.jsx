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

import { useConfig, useLocale } from "@/customization/ConfigProvider"
import { useT } from "@/customization/useT"
import { useAnalytics } from "@/hooks/useAnalytics"

/**
 * Pills to switch the language of the whole site (the landing page has its
 * own, styled for the hero). Renders nothing when the site has one language.
 */
export default function LocaleSwitcher({ className = "", page }) {
  const { locale, locales, setLocale } = useLocale()
  const { landing } = useConfig()
  const t = useT()
  const { trackEvent } = useAnalytics()

  if (locales.length < 2) return null

  const choose = (code) => {
    if (code === locale) return
    setLocale(code)
    trackEvent("language_change", { language: code, page })
  }

  return (
    <div
      role="group"
      aria-label={t.tr(landing.header.selectLanguageLabel)}
      className={`inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white/95 p-1 shadow-sm backdrop-blur ${className}`}
    >
      {locales.map((option) => {
        const active = option.code === locale
        return (
          <button
            key={option.code}
            type="button"
            lang={option.code}
            aria-pressed={active}
            onClick={() => choose(option.code)}
            className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
              active ? "bg-default text-white" : "text-slate-600 hover:bg-default/10 hover:text-default"
            }`}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
