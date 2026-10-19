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

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import { usePathname } from "next/navigation"
import { themeCss } from "./theme"
import { landingFontsHref } from "./fonts"
import { LOCALE_COOKIE, resolveLocale } from "./locale"

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/+$/, "")

// Messages exchanged with the editor ("Administrar Traductor"), which shows
// the real pages in an iframe and pushes the unsaved draft into them.
export const PREVIEW_PARAM = "preview"
export const MSG = {
  READY: "customization:ready", // page -> editor, on load and navigation
  PREVIEW: "customization:preview", // editor -> page, { config } (already resolved)
  SCROLL: "customization:scroll", // editor -> page, { target: element id }
}
const PREVIEW_FLAG = "customization-preview"

const ConfigContext = createContext(null)

function isPreviewFrame() {
  if (typeof window === "undefined" || window.parent === window) return false
  try {
    if (new URLSearchParams(window.location.search).get(PREVIEW_PARAM) === "draft") {
      window.sessionStorage.setItem(PREVIEW_FLAG, "1")
      return true
    }
    return window.sessionStorage.getItem(PREVIEW_FLAG) === "1"
  } catch {
    return false
  }
}

/**
 * Makes the customization available to every page.
 *
 * `initial` comes from the root layout: { config, version, source }, with the
 * document already resolved against the preset on the server (so the presets
 * stay out of the page bundles). When the server could not reach the backend
 * (source "fallback") the browser fetches the published document once after
 * hydration. Inside the editor's preview iframe the document is replaced,
 * live, by the draft the editor sends.
 *
 * `initial.locale` is the language the visitor picked (a cookie, read by the
 * layout so the server renders it); the whole site follows it.
 */
export function ConfigProvider({ initial, children }) {
  const [site, setSite] = useState({ config: initial.config, version: initial.version })
  const [draft, setDraft] = useState(null)
  const [preview, setPreview] = useState(false)
  const [chosenLocale, setChosenLocale] = useState(initial.locale || null)
  const pathname = usePathname()

  useEffect(() => {
    if (initial.source !== "fallback" || !API_BASE) return
    let cancelled = false
    Promise.all([
      fetch(`${API_BASE}/api/customization/config/`, { headers: { Accept: "application/json" } })
        .then((response) => (response.ok ? response.json() : null)),
      import("./presets"),
    ])
      .then(([body, { resolveConfig }]) => {
        if (!cancelled && body && body.version !== initial.version) {
          setSite({ config: resolveConfig(body.config), version: body.version })
        }
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [initial.source, initial.version])

  useEffect(() => {
    if (!isPreviewFrame()) return undefined
    setPreview(true)
    const onMessage = (event) => {
      if (event.origin !== window.location.origin || event.source !== window.parent) return
      const message = event.data || {}
      if (message.type === MSG.PREVIEW && message.config) {
        setDraft(message.config)
      } else if (message.type === MSG.SCROLL && message.target) {
        document
          .getElementById(message.target)
          ?.scrollIntoView({ behavior: "smooth", block: "start" })
      }
    }
    window.addEventListener("message", onMessage)
    return () => window.removeEventListener("message", onMessage)
  }, [])

  // Tell the editor which page is showing, so it can (re)send the draft.
  useEffect(() => {
    if (!preview) return
    window.parent.postMessage({ type: MSG.READY, path: pathname }, window.location.origin)
  }, [preview, pathname])

  const value = useMemo(() => {
    const config = draft ?? site.config
    return {
      config,
      version: site.version,
      preview,
      chosenLocale,
      setChosenLocale,
    }
  }, [draft, site, preview, chosenLocale])

  // A locale removed in the editor (or never offered) falls back to the default
  const locale = resolveLocale(value.config.landing, chosenLocale)
  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  const fontsHref = landingFontsHref(value.config.theme.fonts)
  const initialFontsHref = useMemo(
    () => landingFontsHref(initial.config.theme.fonts),
    [initial.config]
  )

  return (
    <ConfigContext.Provider value={value}>
      <style
        id="translator-theme"
        dangerouslySetInnerHTML={{ __html: themeCss(value.config.theme) }}
      />
      {/* The layout's <head> already requests the published fonts; only a
          font picked in the editor (or loaded after a fallback) needs this. */}
      {fontsHref && fontsHref !== initialFontsHref && <link rel="stylesheet" href={fontsHref} />}
      {children}
    </ConfigContext.Provider>
  )
}

/** The resolved customization document. */
export function useConfig() {
  return useContext(ConfigContext).config
}

/** True inside the editor's live preview. */
export function useIsPreview() {
  return useContext(ConfigContext).preview
}

/**
 * The site language: { locale, defaultLocale, locales, setLocale }. The
 * languages offered are the page languages of the customization
 * ("Idiomas y secciones" in Administrar Traductor).
 */
export function useLocale() {
  const { config, chosenLocale, setChosenLocale } = useContext(ConfigContext)
  const { locales, defaultLocale } = config.landing
  const locale = resolveLocale(config.landing, chosenLocale)
  const setLocale = useCallback(
    (code) => {
      setChosenLocale(code)
      try {
        document.cookie = `${LOCALE_COOKIE}=${encodeURIComponent(code)}; path=/; max-age=31536000; samesite=lax`
      } catch {
        // cookies blocked: the choice still holds until the page is reloaded
      }
    },
    [setChosenLocale]
  )
  return { locale, defaultLocale, locales, setLocale }
}
