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

// Live preview: the real pages of the site in an iframe, with the unsaved
// draft pushed into them on every change (see ConfigProvider). Nothing is
// re-implemented for the preview, so what you see is exactly what visitors
// will get once published.

import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { ExternalLink, Monitor, RefreshCw, Smartphone, Tablet } from "lucide-react"
import { MSG, PREVIEW_PARAM } from "../ConfigProvider"

export const PREVIEW_PAGES = [
  { path: "/about", label: "Inicio" },
  { path: "/translator", label: "Traductor" },
  { path: "/login", label: "Iniciar sesión" },
  { path: "/request-access", label: "Solicitar acceso" },
  { path: "/profile", label: "Perfil" },
]

const DEVICES = [
  { id: "desktop", width: 1280, icon: Monitor, label: "Escritorio" },
  { id: "tablet", width: 834, icon: Tablet, label: "Tablet" },
  { id: "mobile", width: 390, icon: Smartphone, label: "Celular" },
]

export default function PreviewPane({ doc, page, onPageChange, scrollTarget }) {
  const frameRef = useRef(null)
  const boxRef = useRef(null)
  const docRef = useRef(doc)
  const targetRef = useRef(scrollTarget)
  const [device, setDevice] = useState("desktop")
  const [box, setBox] = useState({ width: 800, height: 600 })
  const [reloadKey, setReloadKey] = useState(0)
  const [loading, setLoading] = useState(true)

  // The editor appends "#<time>" so re-selecting a section scrolls again
  const targetId = scrollTarget ? scrollTarget.split("#")[0] : null
  docRef.current = doc
  targetRef.current = targetId

  const post = (message) => {
    const frame = frameRef.current?.contentWindow
    if (frame) frame.postMessage(message, window.location.origin)
  }

  // Resize-aware scaling: the page renders at the device width and is scaled
  // down to fit the pane.
  useLayoutEffect(() => {
    const node = boxRef.current
    if (!node) return undefined
    const observer = new ResizeObserver(([entry]) => {
      setBox({ width: entry.contentRect.width, height: entry.contentRect.height })
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  // The page announces itself on load and on every navigation inside it
  useEffect(() => {
    const onMessage = (event) => {
      if (event.origin !== window.location.origin || event.source !== frameRef.current?.contentWindow) return
      if (event.data?.type !== MSG.READY) return
      setLoading(false)
      post({ type: MSG.PREVIEW, config: docRef.current })
      if (targetRef.current) {
        setTimeout(() => post({ type: MSG.SCROLL, target: targetRef.current }), 350)
      }
      const path = event.data.path
      if (path && PREVIEW_PAGES.some((p) => p.path === path) && path !== page) onPageChange(path)
    }
    window.addEventListener("message", onMessage)
    return () => window.removeEventListener("message", onMessage)
  }, [page, onPageChange])

  // Push each edit, at most once per frame
  useEffect(() => {
    const frame = requestAnimationFrame(() => post({ type: MSG.PREVIEW, config: doc }))
    return () => cancelAnimationFrame(frame)
  }, [doc])

  useEffect(() => {
    if (scrollTarget) post({ type: MSG.SCROLL, target: scrollTarget.split("#")[0] })
  }, [scrollTarget])

  const deviceWidth = DEVICES.find((d) => d.id === device).width
  const scale = Math.min(1, (box.width - 24) / deviceWidth)
  const src = `${page}?${PREVIEW_PARAM}=draft`

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-3 py-2">
        <select
          value={page}
          onChange={(event) => {
            setLoading(true)
            onPageChange(event.target.value)
          }}
          className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700"
          aria-label="Página a previsualizar"
        >
          {PREVIEW_PAGES.map((p) => (
            <option key={p.path} value={p.path}>
              {p.label}
            </option>
          ))}
        </select>
        <div className="inline-flex rounded-md border border-slate-200 bg-slate-50 p-0.5">
          {DEVICES.map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              type="button"
              title={label}
              aria-label={label}
              onClick={() => setDevice(id)}
              className={`rounded px-1.5 py-1 ${device === id ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-700"}`}
            >
              <Icon className="h-3.5 w-3.5" />
            </button>
          ))}
        </div>
        <span className="text-[11px] tabular-nums text-slate-400">
          {deviceWidth}px · {Math.round(scale * 100)}%
        </span>
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            title="Recargar la vista previa"
            onClick={() => {
              setLoading(true)
              setReloadKey((key) => key + 1)
            }}
            className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
          <a
            href={page}
            target="_blank"
            rel="noopener noreferrer"
            title="Abrir el sitio publicado en otra pestaña"
            className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>
      <div ref={boxRef} className="relative min-h-0 flex-1 overflow-hidden bg-slate-200/70">
        <div
          className="absolute left-1/2 top-3 origin-top overflow-hidden rounded-md bg-white shadow-[0_8px_30px_rgba(15,23,42,0.18)]"
          style={{
            width: deviceWidth,
            height: (box.height - 24) / scale,
            transform: `translateX(-50%) scale(${scale})`,
          }}
        >
          <iframe
            key={`${page}-${reloadKey}`}
            ref={frameRef}
            src={src}
            title="Vista previa del sitio"
            className="h-full w-full border-0"
            onLoad={() => setLoading(false)}
          />
        </div>
        {loading && (
          <div className="pointer-events-none absolute inset-x-0 top-3 mx-auto w-fit rounded-full bg-slate-900/80 px-3 py-1 text-[11px] font-medium text-white">
            Cargando vista previa…
          </div>
        )}
      </div>
    </div>
  )
}
