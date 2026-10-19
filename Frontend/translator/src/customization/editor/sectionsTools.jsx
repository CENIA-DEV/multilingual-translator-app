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

// Translation workbench, publish history and the whole-document tools
// (templates, export / import).

import { useEffect, useRef, useState } from "react"
import { ArrowRight, Download, FileUp, History, Loader2, RotateCcw, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { resolveWith } from "../config"
import { PRESETS, PRESET_LABELS, VARIANT, resolveConfig } from "../presets"
import { resolveMedia } from "../media"
import { errorMessage, fetchRevision, fetchRevisions, uploadAsset } from "./api"
import { blobToDataUrl, dataUrlToFile } from "./imageTools"
import { MiniButton, Panel, RichTextEditor, inputBase, inputClass, useEditor } from "./fields"
import { collectTexts, labelForPath, sectionForPath, translationStats } from "./translations"
import { richTextToPlain } from "./richText"
import { SECTION_LABELS } from "./sectionsLanding"

// ------------------------------------------------------------ confirmation
export function ConfirmDialog({ open, title, description, confirmLabel, onConfirm, onCancel, danger, busy }) {
  return (
    <Dialog open={open} onOpenChange={(value) => !value && onCancel()}>
      <DialogContent className="w-[min(480px,92vw)] max-w-none">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription className="leading-6">{description}</DialogDescription>}
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button
            onClick={onConfirm}
            disabled={busy}
            className={danger ? "bg-red-600 text-white hover:bg-red-700" : "bg-default text-white hover:bg-defaultStrong"}
          >
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ------------------------------------------------------------ translations
export function TranslationsSection({ onNavigate }) {
  const { doc, update } = useEditor()
  const landing = doc.landing
  const others = landing.locales.filter((locale) => locale.code !== landing.defaultLocale)
  const [target, setTarget] = useState(others[0]?.code || "")
  const [onlyPending, setOnlyPending] = useState(true)
  // Rows stay listed until the admin leaves the page, so a text does not jump
  // away the moment its translation is typed.
  const [shown, setShown] = useState(null)

  const stats = translationStats(landing)
  const texts = collectTexts(landing).filter((text) => (text.value[landing.defaultLocale] || "").trim())
  const isPending = (text) => !(text.value[target] || "").replace(/<br>/g, "").trim()

  useEffect(() => {
    setShown(null)
  }, [target, onlyPending])
  useEffect(() => {
    if (shown === null && target) {
      setShown(new Set(texts.filter((text) => !onlyPending || isPending(text)).map((text) => text.path)))
    }
  }, [shown, target, onlyPending, texts]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!others.length) {
    return (
      <Panel title="Traducciones">
        <p className="text-sm text-slate-600">
          La página de inicio tiene un solo idioma. Agrega idiomas en «Idiomas y secciones» para traducirla.
        </p>
      </Panel>
    )
  }

  const rows = texts.filter((text) => shown?.has(text.path))
  const defaultLabel = landing.locales.find((l) => l.code === landing.defaultLocale)?.label

  return (
    <>
      <Panel title="Avance de las traducciones" description="Textos de la página de inicio traducidos por idioma.">
        <div className="grid gap-3 sm:grid-cols-3">
          {stats.map((stat) => {
            const pct = stat.total ? Math.round((stat.done / stat.total) * 100) : 100
            return (
              <button
                key={stat.code}
                type="button"
                onClick={() => stat.code !== landing.defaultLocale && setTarget(stat.code)}
                className={`rounded-lg border p-3 text-left transition ${
                  target === stat.code ? "border-default ring-2 ring-default/15" : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <div className="flex items-baseline justify-between">
                  <span className="text-[13px] font-semibold text-slate-800">{stat.label}</span>
                  <span className="text-xs tabular-nums text-slate-500">
                    {stat.done}/{stat.total}
                  </span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full rounded-full ${pct === 100 ? "bg-emerald-500" : "bg-default"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                {stat.code === landing.defaultLocale && <p className="mt-1.5 text-[11px] text-slate-400">Idioma por defecto</p>}
              </button>
            )
          })}
        </div>
      </Panel>

      <Panel
        title="Traducir"
        description={`Cada texto en ${defaultLabel} con su traducción al lado. Lo que quede vacío se muestra en ${defaultLabel}.`}
        actions={
          <div className="flex items-center gap-3">
            <select className={`${inputBase} py-1.5`} value={target} onChange={(event) => setTarget(event.target.value)}>
              {others.map((locale) => (
                <option key={locale.code} value={locale.code}>
                  {locale.label}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-1.5 text-xs text-slate-600">
              <input
                type="checkbox"
                checked={onlyPending}
                onChange={(event) => setOnlyPending(event.target.checked)}
                className="accent-[rgb(var(--brand))]"
              />
              Solo pendientes
            </label>
          </div>
        }
      >
        {rows.length === 0 && (
          <p className="py-6 text-center text-sm text-slate-500">¡Todo traducido! No quedan textos pendientes.</p>
        )}
        <div className="divide-y divide-slate-100">
          {rows.map((text) => (
            <div key={text.path} className="grid gap-3 py-4 first:pt-0 lg:grid-cols-2">
              <div className="min-w-0">
                <div className="mb-1 flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-700">{labelForPath(text.path)}</span>
                  <button
                    type="button"
                    onClick={() => onNavigate(sectionForPath(text.path))}
                    className="inline-flex items-center gap-0.5 text-[11px] text-slate-400 hover:text-default"
                  >
                    ir <ArrowRight className="h-3 w-3" />
                  </button>
                </div>
                <p className="whitespace-pre-line rounded-lg bg-slate-50 px-3 py-2 text-sm leading-6 text-slate-600">
                  {text.rich ? richTextToPlain(text.value[landing.defaultLocale]) : text.value[landing.defaultLocale]}
                </p>
              </div>
              <div className="min-w-0 lg:pt-5">
                {text.rich ? (
                  <RichTextEditor
                    value={text.value[target] || ""}
                    ariaLabel={`${labelForPath(text.path)} en ${target}`}
                    onChange={(html) => update(`${text.path}.${target}`, html)}
                  />
                ) : (
                  <textarea
                    rows={Math.min(6, Math.max(1, Math.ceil((text.value[landing.defaultLocale] || "").length / 60)))}
                    className={`${inputClass} resize-y leading-6`}
                    value={text.value[target] || ""}
                    onChange={(event) => update(`${text.path}.${target}`, event.target.value)}
                    aria-label={`${labelForPath(text.path)} en ${target}`}
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </>
  )
}

// ----------------------------------------------------------------- history
const GROUP_LABELS = {
  identity: "Identidad y SEO",
  theme: "Colores y tipografía",
  translator: "Traductor",
  languages: "Idiomas",
  features: "Funciones de voz",
  authPages: "Páginas de acceso",
}

/** Human summary of what differs between two documents. */
export function describeChanges(from, to) {
  if (!from || !to) return []
  const changed = []
  Object.entries(GROUP_LABELS).forEach(([key, label]) => {
    if (JSON.stringify(from[key]) !== JSON.stringify(to[key])) changed.push(label)
  })
  const landingKeys = {
    locales: "Idiomas de la página",
    sections: "Orden de secciones",
    header: "Encabezado",
    hero: "Portada",
    ...SECTION_LABELS,
    developer: "Desarrollador",
    footer: "Pie de página",
  }
  Object.entries(landingKeys).forEach(([key, label]) => {
    if (JSON.stringify(from.landing?.[key]) !== JSON.stringify(to.landing?.[key])) changed.push(label)
  })
  return [...new Set(changed)]
}

const formatDate = (value) =>
  value ? new Date(value).toLocaleString("es-CL", { dateStyle: "medium", timeStyle: "short" }) : ""

export function HistorySection() {
  const { doc, server, restore } = useEditor()
  const [revisions, setRevisions] = useState(null)
  const [error, setError] = useState(null)
  const [details, setDetails] = useState({})
  const [confirm, setConfirm] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    fetchRevisions()
      .then(setRevisions)
      .catch((err) => setError(errorMessage(err)))
  }, [server?.publishedVersion])

  const inspect = async (revision) => {
    if (details[revision.id]) {
      setDetails((current) => ({ ...current, [revision.id]: undefined }))
      return
    }
    const full = await fetchRevision(revision.id)
    setDetails((current) => ({ ...current, [revision.id]: describeChanges(resolveConfig(full.config), doc) }))
  }

  return (
    <Panel
      title="Historial de publicaciones"
      description="Cada vez que se publica se guarda una copia. Puedes cargar cualquiera en el borrador, revisarla y volver a publicarla."
    >
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!revisions && !error && (
        <p className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
        </p>
      )}
      {revisions && revisions.length === 0 && (
        <p className="text-sm text-slate-500">
          Todavía no se ha publicado nada: el sitio muestra la configuración original de este despliegue.
        </p>
      )}
      <ol className="relative space-y-3 border-l border-slate-200 pl-5">
        {(revisions || []).map((revision) => {
          const live = revision.version === server?.publishedVersion
          const changes = details[revision.id]
          return (
            <li key={revision.id} className="relative">
              <span
                className={`absolute -left-[27px] top-1.5 h-3 w-3 rounded-full border-2 border-white ${
                  live ? "bg-emerald-500" : "bg-slate-300"
                }`}
              />
              <div className="rounded-lg border border-slate-200 px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-[13px] font-semibold text-slate-800">
                      Versión {revision.version}
                      {live && (
                        <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                          En línea
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-slate-500">
                      {formatDate(revision.createdAt)}
                      {revision.createdBy ? ` · ${revision.createdBy}` : ""}
                    </p>
                  </div>
                  <div className="flex gap-1.5">
                    <MiniButton icon={History} onClick={() => inspect(revision)}>
                      {changes ? "Ocultar" : "Diferencias"}
                    </MiniButton>
                    <MiniButton icon={RotateCcw} onClick={() => setConfirm(revision)}>
                      Cargar en borrador
                    </MiniButton>
                  </div>
                </div>
                {revision.note && <p className="mt-2 text-[13px] text-slate-700">“{revision.note}”</p>}
                {changes && (
                  <p className="mt-2 text-xs text-slate-500">
                    {changes.length
                      ? `Comparada con el borrador actual cambia: ${changes.join(", ")}.`
                      : "Es igual al borrador actual."}
                  </p>
                )}
              </div>
            </li>
          )
        })}
      </ol>
      <ConfirmDialog
        open={Boolean(confirm)}
        title={`¿Cargar la versión ${confirm?.version} en el borrador?`}
        description="Reemplaza el borrador actual (puedes deshacer con Ctrl+Z). El sitio no cambia hasta que publiques."
        confirmLabel="Cargar"
        busy={busy}
        onCancel={() => setConfirm(null)}
        onConfirm={async () => {
          setBusy(true)
          await restore(confirm.id)
          setBusy(false)
          setConfirm(null)
        }}
      />
    </Panel>
  )
}

// ------------------------------------------------------------------- tools
const BUNDLE_FORMAT = "translator-customization"
const ASSET_REF = /asset:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g

async function buildBundle(doc) {
  const refs = [...new Set(JSON.stringify(doc).match(ASSET_REF) || [])]
  const assets = {}
  for (const ref of refs) {
    const response = await fetch(resolveMedia(ref))
    if (!response.ok) continue
    assets[ref] = await blobToDataUrl(await response.blob())
  }
  return {
    format: BUNDLE_FORMAT,
    version: 1,
    exportedAt: new Date().toISOString(),
    config: doc,
    assets,
  }
}

function download(filename, content) {
  const url = URL.createObjectURL(new Blob([content], { type: "application/json" }))
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function ToolsSection() {
  const { doc, replace } = useEditor()
  const [confirm, setConfirm] = useState(null)
  const [busy, setBusy] = useState(null)
  const [message, setMessage] = useState(null)
  const fileRef = useRef(null)

  const exportBundle = async () => {
    setBusy("export")
    setMessage(null)
    try {
      const bundle = await buildBundle(doc)
      const slug = (doc.identity.languageName || "traductor").toLowerCase().replace(/[^a-z0-9]+/g, "-")
      download(`traductor-${slug}-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(bundle, null, 2))
      setMessage({ tone: "ok", text: `Exportado con ${Object.keys(bundle.assets).length} archivos incluidos.` })
    } catch (error) {
      setMessage({ tone: "error", text: "No se pudo exportar." })
    } finally {
      setBusy(null)
    }
  }

  const importBundle = async (file) => {
    setBusy("import")
    setMessage(null)
    try {
      const parsed = JSON.parse(await file.text())
      const bundle = parsed.format === BUNDLE_FORMAT ? parsed : { config: parsed, assets: {} }
      if (!bundle.config?.landing || !bundle.config?.theme) throw new Error("not a customization")
      let text = JSON.stringify(bundle.config)
      // Files travel inside the bundle; upload them here and point to the new ids
      for (const [oldRef, dataUrl] of Object.entries(bundle.assets || {})) {
        const asset = await uploadAsset(await dataUrlToFile(dataUrl, oldRef.slice(6)))
        text = text.split(oldRef).join(asset.ref)
      }
      replace(resolveConfig(JSON.parse(text)))
      setMessage({ tone: "ok", text: "Importado en el borrador. Revísalo en la vista previa y publícalo." })
    } catch (error) {
      setMessage({
        tone: "error",
        text: error?.response ? errorMessage(error) : "El archivo no es una exportación de «Administrar Traductor».",
      })
    } finally {
      setBusy(null)
    }
  }

  const templates = Object.keys(PRESETS)

  return (
    <>
      <Panel
        title="Plantillas"
        description="Empieza desde una configuración completa. Reemplaza el borrador; se puede deshacer y nada cambia hasta publicar."
      >
        <div className="grid gap-3 sm:grid-cols-3">
          {templates.map((key) => (
            <div key={key} className="flex flex-col rounded-lg border border-slate-200 p-4">
              <p className="text-[13px] font-semibold text-slate-800">
                {key === "generic" ? "Idioma nuevo" : PRESETS[key].identity.languageName}
                {key === VARIANT && (
                  <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                    Original de este sitio
                  </span>
                )}
              </p>
              <p className="mt-1 flex-1 text-xs leading-5 text-slate-500">{PRESET_LABELS[key]}</p>
              <div className="mt-3">
                <MiniButton icon={RotateCcw} onClick={() => setConfirm(key)}>
                  {key === VARIANT ? "Volver al original" : "Usar plantilla"}
                </MiniButton>
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel
        title="Exportar e importar"
        description="Lleva la configuración de un sitio a otro (por ejemplo, de pruebas a producción, o para crear un traductor nuevo). El archivo incluye las imágenes subidas."
      >
        <div className="flex flex-wrap gap-2">
          <MiniButton icon={busy === "export" ? Loader2 : Download} onClick={exportBundle} disabled={Boolean(busy)}>
            Exportar borrador
          </MiniButton>
          <MiniButton icon={busy === "import" ? Loader2 : Upload} onClick={() => fileRef.current?.click()} disabled={Boolean(busy)}>
            Importar archivo
          </MiniButton>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.target.value = ""
              if (file) importBundle(file)
            }}
          />
        </div>
        {message && (
          <p className={`flex items-center gap-1.5 text-sm ${message.tone === "ok" ? "text-emerald-700" : "text-red-600"}`}>
            <FileUp className="h-4 w-4" /> {message.text}
          </p>
        )}
      </Panel>

      <ConfirmDialog
        open={Boolean(confirm)}
        title={confirm === VARIANT ? "¿Volver a la configuración original?" : "¿Usar esta plantilla?"}
        description="Reemplaza todo el borrador. Puedes deshacerlo con Ctrl+Z, y el sitio no cambia hasta que publiques."
        confirmLabel="Reemplazar borrador"
        danger
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          replace(resolveWith(PRESETS[confirm], null))
          setConfirm(null)
        }}
      />
    </>
  )
}
