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

// "Administrar Traductor": the editor of the customization document.
//
//   left    sections of the document
//   center  the controls of the selected section
//   right   the real site, live, with the draft applied (PreviewPane)
//
// Edits autosave to a private draft; "Publicar" makes them visible to
// everyone and records a version in the history.

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  AlertTriangle,
  ArrowLeft,
  BadgeInfo,
  Check,
  CircleDashed,
  CloudOff,
  Columns2,
  FileClock,
  Globe2,
  HandCoins,
  Heart,
  Image as ImageIcon,
  Info,
  Languages,
  LayoutList,
  Loader2,
  LogIn,
  Map as MapIcon,
  MessageSquareText,
  Palette,
  Redo2,
  Rocket,
  ShieldCheck,
  Undo2,
  Users,
  Wand2,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import api from "@/app/api"
import { buildLanguageList } from "../languages"
import { presetFor, resolveConfig } from "../presets"
import { landingFontsHref } from "../fonts"
import { EditorContext } from "./fields"
import { STATUS, useEditorState } from "./useEditorState"
import PreviewPane from "./PreviewPane"
import { AppearanceSection, AuthPagesSection, IdentitySection, LanguagesSection, TranslatorSection } from "./sectionsGeneral"
import { AccessSection } from "./sectionsAccess"
import {
  AboutSection,
  CollaboratorsSection,
  ContactSection,
  FocusSection,
  FundingSection,
  HeroSection,
  LandingStructureSection,
  OwnersSection,
  ValidationSection,
} from "./sectionsLanding"
import { ConfirmDialog, HistorySection, ToolsSection, TranslationsSection, describeChanges } from "./sectionsTools"
import { sectionForPath, translationStats } from "./translations"

const NAV = [
  {
    group: "Sitio",
    items: [
      { id: "identity", label: "Identidad y SEO", icon: BadgeInfo, page: "/about", render: () => <IdentitySection /> },
      { id: "appearance", label: "Colores y tipografía", icon: Palette, page: "/about", render: () => <AppearanceSection /> },
    ],
  },
  {
    group: "Traductor",
    items: [
      { id: "translator", label: "Tarjetas y textos", icon: Columns2, page: "/translator", render: () => <TranslatorSection /> },
      { id: "languages", label: "Idiomas y funciones", icon: Languages, page: "/translator", render: () => <LanguagesSection /> },
      { id: "auth", label: "Páginas de acceso", icon: LogIn, page: "/login", render: () => <AuthPagesSection /> },
      { id: "access", label: "Visibilidad", icon: ShieldCheck, page: "/translator", render: () => <AccessSection /> },
    ],
  },
  {
    group: "Página de inicio",
    items: [
      { id: "structure", label: "Idiomas y secciones", icon: LayoutList, page: "/about", render: () => <LandingStructureSection /> },
      { id: "hero", label: "Encabezado y portada", icon: ImageIcon, page: "/about", target: "hero", render: () => <HeroSection /> },
      { id: "about", label: "Acerca del proyecto", icon: Info, page: "/about", target: "about", render: () => <AboutSection /> },
      { id: "validation", label: "Mapa de validación", icon: MapIcon, page: "/about", target: "validation", render: () => <ValidationSection /> },
      { id: "focus", label: "Nuestro enfoque", icon: Heart, page: "/about", target: "focus", render: () => <FocusSection /> },
      { id: "owners", label: "Proyecto y socios", icon: Globe2, page: "/about", target: "owners", render: () => <OwnersSection /> },
      { id: "collaborators", label: "Colaboradores", icon: Users, page: "/about", target: "collaborators", render: () => <CollaboratorsSection /> },
      { id: "funding", label: "Financiamiento", icon: HandCoins, page: "/about", target: "financers", render: () => <FundingSection /> },
      { id: "contact", label: "Contacto y pie", icon: MessageSquareText, page: "/about", target: "contact", render: () => <ContactSection /> },
      { id: "translations", label: "Traducciones", icon: Languages, page: "/about", render: (ctx) => <TranslationsSection onNavigate={ctx.go} /> },
    ],
  },
  {
    group: "Versiones",
    items: [
      { id: "history", label: "Historial", icon: FileClock, render: () => <HistorySection /> },
      { id: "tools", label: "Plantillas e importación", icon: Wand2, render: () => <ToolsSection /> },
    ],
  },
]
const ITEMS = NAV.flatMap((group) => group.items)

/** Editor section that owns an error path from the backend. */
function sectionOfError(path) {
  const [root] = path.split(".")
  if (root === "identity") return "identity"
  if (root === "theme") return "appearance"
  if (root === "translator") return "translator"
  if (root === "languages" || root === "features") return "languages"
  if (root === "authPages") return "auth"
  if (root === "access") return "access"
  if (/^landing\.(locales|defaultLocale|sections)/.test(path) || path === "landing") return "structure"
  return sectionForPath(path)
}

const STATUS_VIEW = {
  [STATUS.SAVED]: { icon: Check, text: "Borrador guardado", tone: "text-slate-500" },
  [STATUS.DIRTY]: { icon: CircleDashed, text: "Cambios sin guardar", tone: "text-slate-500" },
  [STATUS.SAVING]: { icon: Loader2, text: "Guardando…", tone: "text-slate-500", spin: true },
  [STATUS.PUBLISHING]: { icon: Loader2, text: "Publicando…", tone: "text-slate-500", spin: true },
  [STATUS.INVALID]: { icon: AlertTriangle, text: "Hay campos con problemas", tone: "text-red-600" },
  [STATUS.CONFLICT]: { icon: AlertTriangle, text: "Conflicto de edición", tone: "text-amber-600" },
  [STATUS.ERROR]: { icon: CloudOff, text: "No se pudo guardar", tone: "text-red-600" },
  [STATUS.LOADING]: { icon: Loader2, text: "Cargando…", tone: "text-slate-500", spin: true },
}

const formatTime = (value) =>
  value ? new Date(value).toLocaleString("es-CL", { dateStyle: "medium", timeStyle: "short" }) : null

function PublishDialog({ open, onClose, editor }) {
  const [note, setNote] = useState("")
  const [changes, setChanges] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    setNote("")
    setChanges(null)
    api
      .get("api/customization/config/")
      .then((response) => setChanges(describeChanges(resolveConfig(response.data.config), editor.doc)))
      .catch(() => setChanges([]))
  }, [open, editor.doc])

  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="w-[min(520px,92vw)] max-w-none">
        <DialogHeader>
          <DialogTitle>Publicar los cambios</DialogTitle>
          <DialogDescription className="leading-6">
            Todas las personas que visiten el sitio verán esta versión en menos de un minuto. Se guarda una copia en
            el historial para poder volver atrás.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-[13px] text-slate-700">
            {changes === null ? (
              <span className="flex items-center gap-2 text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" /> Comparando con lo publicado…
              </span>
            ) : changes.length ? (
              <>
                <p className="mb-1 font-medium">Cambia:</p>
                <p className="leading-6 text-slate-600">{changes.join(" · ")}</p>
              </>
            ) : (
              <p>No hay diferencias con lo publicado (se publicará la configuración tal como está).</p>
            )}
          </div>
          <label className="block text-[13px] font-medium text-slate-700" htmlFor="publish-note">
            Nota para el historial <span className="font-normal text-slate-400">(opcional)</span>
          </label>
          <input
            id="publish-note"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-default focus:ring-2 focus:ring-default/20"
            placeholder="Ej.: nuevas fotos de la portada"
            value={note}
            maxLength={300}
            onChange={(event) => setNote(event.target.value)}
          />
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            className="bg-default text-white hover:bg-defaultStrong"
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              const ok = await editor.publish(note)
              setBusy(false)
              if (ok) onClose(true)
              else onClose(false)
            }}
          >
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Rocket className="mr-2 h-4 w-4" />}
            Publicar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function Editor() {
  const editor = useEditorState()
  const { doc, server, status, errors, conflict } = editor
  const [active, setActive] = useState("identity")
  const [page, setPage] = useState("/about")
  const [target, setTarget] = useState(null)
  const [showPreview, setShowPreview] = useState(true)
  const [publishOpen, setPublishOpen] = useState(false)
  const [discardOpen, setDiscardOpen] = useState(false)
  const [flash, setFlash] = useState(null)

  const base = useMemo(() => presetFor(), [])

  useEffect(() => {
    if (!flash) return undefined
    const timer = setTimeout(() => setFlash(null), 6000)
    return () => clearTimeout(timer)
  }, [flash])
  const languages = useMemo(() => (doc ? buildLanguageList(doc.languages) : []), [doc])

  const go = useCallback((id) => {
    const item = ITEMS.find((entry) => entry.id === id)
    if (!item) return
    setActive(id)
    if (item.page) setPage(item.page)
    setTarget(item.target ? `${item.target}#${Date.now()}` : null)
    window.history.replaceState(null, "", `#${id}`)
    document.getElementById("editor-main")?.scrollTo({ top: 0 })
  }, [])

  // The section lives in the URL (#hero): survives reloads and can be linked
  useEffect(() => {
    const follow = () => {
      const fromHash = window.location.hash.slice(1)
      if (ITEMS.some((item) => item.id === fromHash)) go(fromHash)
    }
    follow()
    window.addEventListener("hashchange", follow)
    return () => window.removeEventListener("hashchange", follow)
  }, [go])

  // Keyboard: undo / redo / save now
  const editorRef = useRef(editor)
  editorRef.current = editor
  useEffect(() => {
    const onKey = (event) => {
      const mod = event.metaKey || event.ctrlKey
      if (!mod) return
      const key = event.key.toLowerCase()
      const actions = editorRef.current
      if (key === "z" && !event.shiftKey) {
        event.preventDefault()
        actions.undo()
      } else if ((key === "z" && event.shiftKey) || key === "y") {
        event.preventDefault()
        actions.redo()
      } else if (key === "s") {
        event.preventDefault()
        actions.save()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  const errorsBySection = useMemo(() => {
    const counts = {}
    errors.forEach((error) => {
      const section = sectionOfError(error.path)
      counts[section] = (counts[section] || 0) + 1
    })
    return counts
  }, [errors])

  const pendingTranslations = useMemo(() => {
    if (!doc) return 0
    return translationStats(doc.landing).reduce((sum, stat) => sum + (stat.total - stat.done), 0)
  }, [doc])

  if (editor.loadError) {
    const forbidden = [401, 403].includes(editor.loadError?.response?.status)
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <AlertTriangle className="mx-auto h-8 w-8 text-amber-500" />
          <h1 className="mt-3 text-lg font-semibold text-slate-900">
            {forbidden ? "Sin permiso" : "No se pudo cargar la configuración"}
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            {forbidden
              ? "Solo el equipo técnico puede administrar el traductor."
              : "Revisa la conexión con el servidor e inténtalo de nuevo."}
          </p>
          {!forbidden && (
            <Button className="mt-4 bg-default text-white hover:bg-defaultStrong" onClick={editor.load}>
              Reintentar
            </Button>
          )}
        </div>
      </div>
    )
  }

  if (!doc) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-slate-50 text-sm text-slate-500">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Cargando la configuración…
      </div>
    )
  }

  const current = ITEMS.find((item) => item.id === active) || ITEMS[0]
  const statusView = STATUS_VIEW[status]
  const StatusIcon = statusView.icon
  const canPublish = status !== STATUS.PUBLISHING && status !== STATUS.CONFLICT
  const neverPublished = !server?.publishedVersion
  const fontsHref = landingFontsHref(doc.theme.fonts)

  const context = { ...editor, base, languages, go }

  return (
    <EditorContext.Provider value={context}>
      {/* Fonts picked in the editor, for its samples */}
      {fontsHref && <link rel="stylesheet" href={fontsHref} />}
      <style>{`
        .rich-editor:empty:before { content: attr(data-placeholder); color: #94a3b8; }
        /* globals.css sizes every p and span as text-base; inside the editor
           they inherit instead. Same specificity as that base rule (so this
           later one wins) and lower than any text-* utility. */
        :where(.editor-root) p, :where(.editor-root) span { font-size: inherit; line-height: inherit; }
      `}</style>

      <div className="editor-root fixed inset-0 z-40 flex flex-col bg-slate-100 font-[system-ui] text-slate-900">
        {/* ------------------------------------------------------ top bar */}
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-3 sm:px-4">
          <a
            href="/about"
            onClick={async (event) => {
              if (editor.isDirty) {
                event.preventDefault()
                await editor.save()
                window.location.href = "/about"
              }
            }}
            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            title="Volver al sitio"
          >
            <ArrowLeft className="h-5 w-5" />
          </a>
          <div className="min-w-0">
            <p className="truncate text-[15px] font-semibold leading-5">Administrar Traductor</p>
            <p className="truncate text-xs text-slate-500">{doc.identity.siteTitle}</p>
          </div>

          <div className={`ml-2 hidden items-center gap-1.5 text-xs md:flex ${statusView.tone}`}>
            <StatusIcon className={`h-3.5 w-3.5 ${statusView.spin ? "animate-spin" : ""}`} />
            <span>{statusView.text}</span>
            {status === STATUS.ERROR && (
              <button type="button" onClick={editor.save} className="font-medium underline">
                Reintentar
              </button>
            )}
          </div>

          <div className="ml-auto flex items-center gap-1.5">
            <button
              type="button"
              title="Deshacer (Ctrl+Z)"
              aria-label="Deshacer"
              disabled={!editor.canUndo}
              onClick={editor.undo}
              className="rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-30"
            >
              <Undo2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              title="Rehacer (Ctrl+Shift+Z)"
              aria-label="Rehacer"
              disabled={!editor.canRedo}
              onClick={editor.redo}
              className="rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-30"
            >
              <Redo2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setShowPreview((value) => !value)}
              className={`hidden rounded-md px-2.5 py-1.5 text-xs font-medium lg:inline-flex ${
                showPreview ? "bg-slate-100 text-slate-900" : "text-slate-500 hover:bg-slate-100"
              }`}
            >
              Vista previa
            </button>
            {server?.hasUnpublishedChanges && (
              <Button variant="outline" size="sm" onClick={() => setDiscardOpen(true)} className="hidden sm:inline-flex">
                Descartar
              </Button>
            )}
            <Button
              size="sm"
              disabled={!canPublish}
              onClick={() => setPublishOpen(true)}
              className="bg-default text-white hover:bg-defaultStrong"
            >
              <Rocket className="mr-1.5 h-4 w-4" />
              Publicar
            </Button>
          </div>
        </header>

        {/* --------------------------------------------------- banners */}
        {conflict && (
          <div className="flex flex-wrap items-center gap-3 border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-[13px] text-amber-900">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span className="flex-1">
              {conflict.updatedBy || "Otro administrador"} guardó cambios en el borrador mientras editabas.
            </span>
            <Button size="sm" variant="outline" onClick={() => editor.resolveConflict("theirs")}>
              Cargar su versión
            </Button>
            <Button size="sm" className="bg-amber-600 text-white hover:bg-amber-700" onClick={() => editor.resolveConflict("mine")}>
              Mantener la mía
            </Button>
          </div>
        )}
        {errors.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-b border-red-200 bg-red-50 px-4 py-2 text-[13px] text-red-800">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>
              {errors.length === 1 ? "Un campo necesita revisión" : `${errors.length} campos necesitan revisión`} antes de
              guardar:
            </span>
            {Object.entries(errorsBySection).map(([section, count]) => (
              <button
                key={section}
                type="button"
                onClick={() => go(section)}
                className="rounded-full bg-white px-2.5 py-0.5 text-xs font-medium text-red-700 ring-1 ring-red-200 hover:bg-red-100"
              >
                {ITEMS.find((item) => item.id === section)?.label || section} ({count})
              </button>
            ))}
          </div>
        )}
        {flash && (
          <div className="flex items-center gap-2 border-b border-emerald-200 bg-emerald-50 px-4 py-2 text-[13px] text-emerald-800">
            <Check className="h-4 w-4" /> {flash}
            <button type="button" onClick={() => setFlash(null)} className="ml-auto rounded p-0.5 hover:bg-emerald-100">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        <div className="flex min-h-0 flex-1">
          {/* ------------------------------------------------------ nav */}
          <nav className="hidden w-60 shrink-0 overflow-y-auto border-r border-slate-200 bg-white py-3 md:block">
            {NAV.map((group) => (
              <div key={group.group} className="mb-3">
                <p className="px-4 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  {group.group}
                </p>
                {group.items.map((item) => {
                  const Icon = item.icon
                  const isActive = item.id === active
                  const errorCount = errorsBySection[item.id]
                  const badge = item.id === "translations" && pendingTranslations > 0 ? pendingTranslations : null
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => go(item.id)}
                      className={`mx-2 flex w-[calc(100%-1rem)] items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-[13px] transition ${
                        isActive ? "bg-default/10 font-semibold text-default" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="flex-1 truncate">{item.label}</span>
                      {errorCount && (
                        <span className="rounded-full bg-red-100 px-1.5 text-[10px] font-bold text-red-700">{errorCount}</span>
                      )}
                      {badge && (
                        <span className="rounded-full bg-amber-100 px-1.5 text-[10px] font-bold text-amber-700" title="Textos sin traducir">
                          {badge}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            ))}
            <div className="mx-4 mt-4 border-t border-slate-100 pt-3 text-[11px] leading-5 text-slate-400">
              {neverPublished ? (
                <p>Aún sin publicar: el sitio usa la configuración original.</p>
              ) : (
                <p>
                  Versión {server.publishedVersion} en línea
                  {server.publishedAt ? ` desde ${formatTime(server.publishedAt)}` : ""}
                  {server.publishedBy ? `, por ${server.publishedBy}` : ""}.
                </p>
              )}
              {server?.hasUnpublishedChanges && <p className="mt-1 text-amber-600">El borrador tiene cambios sin publicar.</p>}
            </div>
          </nav>

          {/* ----------------------------------------------------- main */}
          <main id="editor-main" className="min-h-0 flex-1 overflow-y-auto">
            <div className="border-b border-slate-200 bg-white px-4 py-2 md:hidden">
              <select
                value={active}
                onChange={(event) => go(event.target.value)}
                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                aria-label="Sección"
              >
                {NAV.map((group) => (
                  <optgroup key={group.group} label={group.group}>
                    {group.items.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
            <div className="mx-auto max-w-3xl space-y-5 px-4 py-6 sm:px-6">
              <h2 className="text-xl font-semibold text-slate-900">{current.label}</h2>
              {current.render({ go })}
            </div>
          </main>

          {/* -------------------------------------------------- preview */}
          {showPreview && (
            <aside className="hidden min-h-0 w-[44%] shrink-0 border-l border-slate-200 lg:block">
              <PreviewPane
                doc={doc}
                page={page}
                onPageChange={setPage}
                scrollTarget={target}
              />
            </aside>
          )}
        </div>
      </div>

      <PublishDialog
        open={publishOpen}
        editor={editor}
        onClose={(published) => {
          setPublishOpen(false)
          if (published === true) setFlash("Publicado. Los visitantes verán los cambios en menos de un minuto.")
        }}
      />
      <ConfirmDialog
        open={discardOpen}
        title="¿Descartar los cambios sin publicar?"
        description="El borrador vuelve a ser igual a lo publicado. Puedes recuperarlo con Deshacer mientras no cierres esta página."
        confirmLabel="Descartar"
        danger
        onCancel={() => setDiscardOpen(false)}
        onConfirm={async () => {
          await editor.discard()
          setDiscardOpen(false)
        }}
      />
    </EditorContext.Provider>
  )
}
