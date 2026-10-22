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

// Form controls of "Administrar Traductor". Every control is bound to a dotted
// path of the document ("landing.hero.title") and reads/writes it through the
// editor context, so a section is just a list of controls with paths.

import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState } from "react"
import {
  AlertTriangle,
  Bold,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Crosshair,
  GripVertical,
  Images,
  Italic,
  Link2,
  Loader2,
  Plus,
  RemoveFormatting,
  RotateCcw,
  Search,
  Trash2,
  Underline,
  Upload,
  X,
} from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { getIn } from "../config"
import MESSAGES from "../messages"
import { resolveMedia } from "../media"
import { contrastRatio } from "../theme"
import { fetchAssets, uploadAsset, errorMessage } from "./api"
import { prepareImage, formatBytes } from "./imageTools"
import { cleanRichText } from "./richText"

// ------------------------------------------------------------------ context
export const EditorContext = createContext(null)
export const useEditor = () => useContext(EditorContext)

export function useField(path) {
  const { doc, update } = useEditor()
  const set = useCallback((value) => update(path, value), [path, update])
  return [getIn(doc, path), set]
}

function useErrors(path) {
  const { errors } = useEditor()
  return useMemo(
    () =>
      (errors || []).filter(
        (error) => error.path === path || error.path.startsWith(`${path}.`)
      ),
    [errors, path]
  )
}

/** The preset's value for a path, for "Restablecer". */
function usePresetValue(path) {
  const { base } = useEditor()
  return getIn(base, path)
}

// ------------------------------------------------------------------- layout
export function Panel({ title, description, children, actions }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      {(title || actions) && (
        <header className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div>
            {title && <h3 className="text-[15px] font-semibold text-slate-900">{title}</h3>}
            {description && <p className="mt-0.5 text-[13px] leading-5 text-slate-500">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className="space-y-5 px-5 py-5">{children}</div>
    </section>
  )
}

export function Grid({ children, cols = 2 }) {
  return (
    <div className={`grid gap-4 ${cols === 3 ? "sm:grid-cols-3" : cols === 4 ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-2"}`}>
      {children}
    </div>
  )
}

export function Callout({ tone = "info", children }) {
  const styles = {
    info: "border-sky-200 bg-sky-50 text-sky-900",
    warn: "border-amber-200 bg-amber-50 text-amber-900",
  }
  return (
    <div className={`flex gap-2.5 rounded-lg border px-3.5 py-2.5 text-[13px] leading-5 ${styles[tone]}`}>
      {tone === "warn" && <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}
      <div>{children}</div>
    </div>
  )
}

export function Field({ label, hint, path, children, htmlFor, aside }) {
  const errors = useErrors(path)
  return (
    <div className="space-y-1.5" data-path={path}>
      {(label || aside) && (
        <div className="flex items-center justify-between gap-2">
          {label && (
            <label htmlFor={htmlFor} className="text-[13px] font-medium text-slate-700">
              {label}
            </label>
          )}
          {aside}
        </div>
      )}
      {children}
      {hint && <p className="text-xs leading-5 text-slate-500">{hint}</p>}
      {errors.map((error) => (
        <p key={error.path} className="flex items-center gap-1 text-xs font-medium text-red-600">
          <AlertTriangle className="h-3.5 w-3.5" /> {error.message}
        </p>
      ))}
    </div>
  )
}

// inputBase has no width, for inline controls that set their own
const inputBase =
  "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-default focus:ring-2 focus:ring-default/20"
const inputClass = `w-full ${inputBase}`

// ------------------------------------------------------------------- basics
export function TextField({ path, label, hint, placeholder, multiline, rows = 3, maxLength }) {
  const [value, set] = useField(path)
  const id = useId()
  const Tag = multiline ? "textarea" : "input"
  return (
    <Field label={label} hint={hint} path={path} htmlFor={id}>
      <Tag
        id={id}
        className={`${inputClass} ${multiline ? "resize-y leading-6" : ""}`}
        value={value ?? ""}
        placeholder={placeholder}
        rows={multiline ? rows : undefined}
        maxLength={maxLength}
        onChange={(event) => set(event.target.value)}
      />
    </Field>
  )
}

export function NumberField({ path, label, hint, min, max, step = 1, suffix }) {
  const [value, set] = useField(path)
  const id = useId()
  return (
    <Field label={label} hint={hint} path={path} htmlFor={id}>
      <div className="relative">
        <input
          id={id}
          type="number"
          className={inputClass}
          value={value ?? ""}
          min={min}
          max={max}
          step={step}
          onChange={(event) => set(event.target.value === "" ? null : Number(event.target.value))}
        />
        {suffix && (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
            {suffix}
          </span>
        )}
      </div>
    </Field>
  )
}

export function SliderField({ path, label, hint, min = 0, max = 100, step = 1, suffix = "%" }) {
  const [value, set] = useField(path)
  const id = useId()
  return (
    <Field
      label={label}
      hint={hint}
      path={path}
      htmlFor={id}
      aside={<span className="text-xs tabular-nums text-slate-500">{value}{suffix}</span>}
    >
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value ?? 0}
        onChange={(event) => set(Number(event.target.value))}
        className="w-full accent-[rgb(var(--brand))]"
      />
    </Field>
  )
}

export function ToggleField({ path, label, hint }) {
  const [value, set] = useField(path)
  const id = useId()
  return (
    <div className="flex items-start justify-between gap-4" data-path={path}>
      <div>
        <label htmlFor={id} className="text-[13px] font-medium text-slate-700">
          {label}
        </label>
        {hint && <p className="mt-0.5 text-xs leading-5 text-slate-500">{hint}</p>}
      </div>
      <Switch id={id} checked={Boolean(value)} onCheckedChange={set} />
    </div>
  )
}

export function SelectField({ path, label, hint, options }) {
  const [value, set] = useField(path)
  const id = useId()
  return (
    <Field label={label} hint={hint} path={path} htmlFor={id}>
      <select id={id} className={inputClass} value={value ?? ""} onChange={(event) => set(event.target.value)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </Field>
  )
}

/** Segmented control for 2-4 short options. */
export function SegmentedField({ path, label, hint, options }) {
  const [value, set] = useField(path)
  return (
    <Field label={label} hint={hint} path={path}>
      <div className="inline-flex max-w-full flex-wrap rounded-lg border border-slate-200 bg-slate-50 p-0.5">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => set(option.value)}
            className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition ${
              value === option.value ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </Field>
  )
}

/** A list of strings edited as one per line (names, keywords). */
export function LinesField({ path, label, hint, rows = 6, placeholder }) {
  const [value, set] = useField(path)
  const id = useId()
  const joined = (value || []).join("\n")
  const [text, setText] = useState(joined)
  // follow outside changes (undo, template) without fighting the user's typing
  useEffect(() => {
    setText((current) => (current.split("\n").map((l) => l.trim()).filter(Boolean).join("\n") === joined ? current : joined))
  }, [joined])
  const count = (value || []).length
  return (
    <Field
      label={label}
      hint={hint}
      path={path}
      htmlFor={id}
      aside={<span className="text-xs text-slate-400">{count} {count === 1 ? "línea" : "líneas"}</span>}
    >
      <textarea
        id={id}
        rows={rows}
        className={`${inputClass} resize-y font-mono text-[13px] leading-6`}
        value={text}
        placeholder={placeholder}
        onChange={(event) => {
          setText(event.target.value)
          set(event.target.value.split("\n").map((line) => line.trim()).filter(Boolean))
        }}
      />
    </Field>
  )
}

// ------------------------------------------------------------------- colour
const HEX6 = /^#[0-9a-f]{6}$/i

function normaliseHex(raw) {
  let value = raw.trim().toLowerCase()
  if (!value.startsWith("#")) value = `#${value}`
  if (/^#[0-9a-f]{3}$/.test(value)) value = `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`
  return HEX6.test(value) ? value : null
}

export function ContrastBadge({ foreground, background }) {
  if (!HEX6.test(foreground || "") || !HEX6.test(background || "")) return null
  const ratio = contrastRatio(foreground, background)
  const ok = ratio >= 4.5
  const large = ratio >= 3
  return (
    <span
      title="Contraste según WCAG: 4.5:1 para texto normal, 3:1 para texto grande"
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums ${
        ok ? "bg-emerald-50 text-emerald-700" : large ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700"
      }`}
    >
      {ok ? <Check className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
      {ratio.toFixed(1)}:1
    </span>
  )
}

export function ColorField({ path, label, hint, contrastWith, contrastLabel }) {
  const [value, set] = useField(path)
  const presetValue = usePresetValue(path)
  const [text, setText] = useState(value || "")
  const id = useId()
  useEffect(() => setText(value || ""), [value])

  const commit = (raw) => {
    const hex = normaliseHex(raw)
    if (hex) set(hex)
    else setText(value || "")
  }

  return (
    <Field
      label={label}
      hint={hint}
      path={path}
      htmlFor={id}
      aside={
        contrastWith ? (
          <span className="flex items-center gap-1.5 text-[11px] text-slate-400">
            {contrastLabel}
            <ContrastBadge foreground={value} background={contrastWith} />
          </span>
        ) : null
      }
    >
      <div className="flex items-center gap-2">
        <label
          className="relative h-9 w-11 shrink-0 cursor-pointer overflow-hidden rounded-lg border border-slate-300 shadow-sm"
          style={{ background: HEX6.test(value || "") ? value : "#ffffff" }}
          title="Elegir color"
        >
          <input
            type="color"
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            value={HEX6.test(value || "") ? value : "#000000"}
            onChange={(event) => set(event.target.value)}
          />
        </label>
        <input
          id={id}
          className={`${inputClass} font-mono uppercase`}
          value={text}
          spellCheck={false}
          onChange={(event) => {
            setText(event.target.value)
            const hex = normaliseHex(event.target.value)
            if (hex && event.target.value.replace("#", "").length === 6) set(hex)
          }}
          onBlur={(event) => commit(event.target.value)}
          onKeyDown={(event) => event.key === "Enter" && commit(event.currentTarget.value)}
        />
        {presetValue && presetValue !== value && (
          <button
            type="button"
            title={`Volver al original (${presetValue})`}
            onClick={() => set(presetValue)}
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
        )}
      </div>
    </Field>
  )
}

// --------------------------------------------------------------- rich text
function ToolbarButton({ onClick, title, children }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
    >
      {children}
    </button>
  )
}

/**
 * A small WYSIWYG editor: bold, italic, underline and links. Admins see the
 * formatted text, never HTML; the value is normalised to the site's rich-text
 * dialect on every change.
 */
export function RichTextEditor({ value, onChange, placeholder, minHeight = 88, ariaLabel }) {
  const ref = useRef(null)
  const lastEmitted = useRef(null)

  useEffect(() => {
    const node = ref.current
    if (!node) return
    // Only rewrite the DOM for outside changes (undo, templates); writing back
    // what the user just typed would move the caret.
    if (value !== lastEmitted.current && node.innerHTML !== (value || "")) {
      node.innerHTML = value || ""
    }
    lastEmitted.current = value
  }, [value])

  const emit = () => {
    const cleaned = cleanRichText(ref.current.innerHTML)
    lastEmitted.current = cleaned
    onChange(cleaned)
  }

  const exec = (command, argument) => {
    ref.current.focus()
    document.execCommand(command, false, argument)
    emit()
  }

  const addLink = () => {
    const url = window.prompt("Dirección del enlace (https://…)", "https://")
    if (!url) return
    if (!/^(https?:\/\/|mailto:|\/|#)/i.test(url)) {
      window.alert("El enlace debe comenzar con https://, mailto:, / o #")
      return
    }
    exec("createLink", url)
  }

  return (
    <div className="overflow-hidden rounded-lg border border-slate-300 bg-white shadow-sm focus-within:border-default focus-within:ring-2 focus-within:ring-default/20">
      <div className="flex items-center gap-0.5 border-b border-slate-100 bg-slate-50/70 px-1.5 py-1">
        <ToolbarButton title="Negrita (Ctrl+B)" onClick={() => exec("bold")}>
          <Bold className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton title="Cursiva (Ctrl+I)" onClick={() => exec("italic")}>
          <Italic className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton title="Subrayado (Ctrl+U)" onClick={() => exec("underline")}>
          <Underline className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton title="Enlace" onClick={addLink}>
          <Link2 className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          title="Quitar formato"
          onClick={() => {
            exec("removeFormat")
            exec("unlink")
          }}
        >
          <RemoveFormatting className="h-3.5 w-3.5" />
        </ToolbarButton>
      </div>
      <div
        ref={ref}
        role="textbox"
        aria-multiline="true"
        aria-label={ariaLabel}
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder}
        onInput={emit}
        onBlur={emit}
        onPaste={(event) => {
          // paste as plain text; formatting comes from the toolbar
          event.preventDefault()
          document.execCommand("insertText", false, event.clipboardData.getData("text/plain"))
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault()
            document.execCommand("insertLineBreak")
            emit()
          }
        }}
        style={{ minHeight }}
        className="rich-editor max-h-80 overflow-y-auto px-3 py-2 text-sm leading-6 text-slate-900 outline-none [&_a]:text-default [&_a]:underline [&_strong]:font-semibold"
      />
    </div>
  )
}

// ------------------------------------------------------------ translations
/**
 * A text in every language of the landing page, stacked so all translations
 * are visible at once. An empty translation shows the default language on the
 * site, and is flagged here as pending.
 */
export function I18nField({ path, label, hint, multiline, rich, rows = 3, placeholder }) {
  const [value, set] = useField(path)
  return (
    <I18nInputs
      value={value}
      onChange={set}
      path={path}
      label={label}
      hint={hint}
      multiline={multiline}
      rich={rich}
      rows={rows}
      placeholder={placeholder}
    />
  )
}

/**
 * A fixed text of the app (messages.js, "territoryHelp.title") as the document
 * overrides it in its `ui` map. Its key has dots, so it is not a path: the
 * field writes ui[uiKey] itself. An empty language uses the built-in text,
 * shown as the placeholder.
 */
export function UiTextField({ uiKey, label, hint, multiline, rows = 3 }) {
  const { doc, update } = useEditor()
  const set = (next) => {
    const ui = { ...(doc.ui || {}) }
    if (Object.keys(next).length) ui[uiKey] = next
    else delete ui[uiKey]
    update("ui", ui)
  }
  return (
    <I18nInputs
      value={doc.ui?.[uiKey]}
      onChange={set}
      path={`ui.${uiKey}`}
      label={label}
      hint={hint}
      multiline={multiline}
      rows={rows}
      defaults={MESSAGES[uiKey]}
    />
  )
}

/** One input per site language for an { es, en, ... } text. `defaults`: the
 * built-in text per language, used where the value has none. */
function I18nInputs({ value, onChange: set, path, label, hint, multiline, rich, rows = 3, placeholder, defaults }) {
  const { doc } = useEditor()
  const locales = doc.landing.locales
  const defaultLocale = doc.landing.defaultLocale
  // A plain string (a text saved before it could be translated) is the
  // default language's version
  const current =
    value && typeof value === "object" ? value : typeof value === "string" && value ? { [defaultLocale]: value } : {}
  const fallback = current[defaultLocale] || ""

  const setLocale = (code, text) => {
    const next = { ...current }
    if (text && text.replace(/<br>/g, "").trim()) next[code] = text
    else delete next[code]
    set(next)
  }

  const builtIn = (code) => (typeof defaults?.[code] === "string" ? defaults[code] : "")
  const pending = locales.filter((l) => !(current[l.code] || "").trim() && !builtIn(l.code)).length

  return (
    <Field
      label={label}
      hint={hint}
      path={path}
      aside={
        locales.length > 1 && pending > 0 ? (
          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
            {pending} sin traducir
          </span>
        ) : null
      }
    >
      <div className="space-y-2">
        {locales.map((locale) => {
          const text = current[locale.code] || ""
          const missing = !text.trim() && !builtIn(locale.code)
          const badge = (
            <span
              title={locale.label}
              className={`inline-flex h-6 min-w-[2.6rem] shrink-0 items-center justify-center rounded-md px-1.5 text-[10.5px] font-bold uppercase tracking-wide ${
                missing ? "bg-amber-50 text-amber-700 ring-1 ring-amber-200" : "bg-slate-100 text-slate-600"
              }`}
            >
              {locale.code}
            </span>
          )
          const placeholderText = builtIn(locale.code)
            ? `Predeterminado: ${builtIn(locale.code)}`
            : locale.code === defaultLocale
              ? placeholder
              : missing && fallback
                ? `Sin traducir: se muestra en ${locales.find((l) => l.code === defaultLocale)?.label || defaultLocale}`
                : placeholder
          return (
            <div key={locale.code} className="flex items-start gap-2">
              <div className="pt-2">{badge}</div>
              <div className="min-w-0 flex-1">
                {rich ? (
                  <RichTextEditor
                    value={text}
                    ariaLabel={`${label} (${locale.label})`}
                    placeholder={placeholderText}
                    onChange={(html) => setLocale(locale.code, html)}
                  />
                ) : multiline ? (
                  <textarea
                    aria-label={`${label} (${locale.label})`}
                    rows={rows}
                    className={`${inputClass} resize-y leading-6`}
                    value={text}
                    placeholder={placeholderText}
                    onChange={(event) => setLocale(locale.code, event.target.value)}
                  />
                ) : (
                  <input
                    aria-label={`${label} (${locale.label})`}
                    className={inputClass}
                    value={text}
                    placeholder={placeholderText}
                    onChange={(event) => setLocale(locale.code, event.target.value)}
                  />
                )}
              </div>
            </div>
          )
        })}
      </div>
    </Field>
  )
}

// ------------------------------------------------------------------ images
function Checkerboard({ children, className = "", style }) {
  return (
    <div
      className={`relative overflow-hidden rounded-lg border border-slate-200 ${className}`}
      style={{
        backgroundColor: "#f8fafc",
        backgroundImage:
          "linear-gradient(45deg,#eef2f6 25%,transparent 25%),linear-gradient(-45deg,#eef2f6 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#eef2f6 75%),linear-gradient(-45deg,transparent 75%,#eef2f6 75%)",
        backgroundSize: "16px 16px",
        backgroundPosition: "0 0,0 8px,8px -8px,-8px 0",
        ...style,
      }}
    >
      {children}
    </div>
  )
}

export function AssetLibrary({ open, onClose, onPick, kind = "image" }) {
  const [assets, setAssets] = useState(null)
  const [query, setQuery] = useState("")
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!open) return
    setAssets(null)
    setError(null)
    fetchAssets(kind)
      .then(setAssets)
      .catch((err) => setError(errorMessage(err)))
  }, [open, kind])

  const filtered = (assets || []).filter((asset) =>
    (asset.name || "").toLowerCase().includes(query.toLowerCase())
  )

  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="max-h-[85vh] w-[min(920px,94vw)] max-w-none overflow-hidden">
        <DialogHeader>
          <DialogTitle>Biblioteca de archivos</DialogTitle>
          <DialogDescription>Archivos subidos antes. Reutilizarlos no ocupa espacio adicional.</DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            className={`${inputClass} pl-9`}
            placeholder="Buscar por nombre"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <div className="-mx-1 max-h-[55vh] overflow-y-auto px-1">
          {error && <p className="py-8 text-center text-sm text-red-600">{error}</p>}
          {!assets && !error && (
            <p className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
            </p>
          )}
          {assets && filtered.length === 0 && (
            <p className="py-12 text-center text-sm text-slate-500">Todavía no hay archivos subidos.</p>
          )}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {filtered.map((asset) => (
              <button
                key={asset.id}
                type="button"
                onClick={() => onPick(asset.ref)}
                className="group rounded-lg border border-slate-200 p-1.5 text-left transition hover:border-default hover:shadow-md"
              >
                <Checkerboard className="aspect-[4/3]">
                  {asset.kind === "image" ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={resolveMedia(asset.ref)}
                      alt=""
                      loading="lazy"
                      className="absolute inset-0 h-full w-full object-contain p-1.5"
                    />
                  ) : (
                    <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-slate-500">
                      GeoJSON
                    </span>
                  )}
                </Checkerboard>
                <p className="mt-1.5 truncate text-xs font-medium text-slate-700">{asset.name || "Sin nombre"}</p>
                <p className="text-[11px] text-slate-400">
                  {asset.width ? `${asset.width}×${asset.height} · ` : ""}
                  {formatBytes(asset.size)}
                </p>
              </button>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Image picker: upload (drag & drop or file dialog, resized in the browser),
 * reuse from the library, reset to the original, remove. With `focalPath`
 * clicking the preview sets the point that stays visible when the image is
 * cropped to fill its frame.
 */
export function ImageField({
  path,
  label,
  hint,
  maxDimension = 2400,
  focalPath,
  aspect = "aspect-[16/9]",
  fit = "contain",
  backdrop,
  accept = "image/png,image/jpeg,image/webp,image/gif,image/svg+xml,image/x-icon,.ico,.svg",
  kind = "image",
}) {
  const [value, set] = useField(path)
  const presetValue = usePresetValue(path)
  const [focal, setFocal] = useField(focalPath || `${path}__nofocal`)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [library, setLibrary] = useState(false)
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef(null)
  const src = resolveMedia(value)

  const upload = async (file) => {
    if (!file) return
    setBusy(true)
    setError(null)
    try {
      const prepared = kind === "image" ? await prepareImage(file, maxDimension) : file
      const asset = await uploadAsset(prepared)
      set(asset.ref)
    } catch (err) {
      setError(errorMessage(err, "No se pudo subir el archivo."))
    } finally {
      setBusy(false)
    }
  }

  const pickFocal = (event) => {
    if (!focalPath || !src) return
    const rect = event.currentTarget.getBoundingClientRect()
    const x = Math.round(((event.clientX - rect.left) / rect.width) * 100)
    const y = Math.round(((event.clientY - rect.top) / rect.height) * 100)
    setFocal({ x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) })
  }

  return (
    <Field label={label} hint={hint} path={path}>
      <div
        onDragOver={(event) => {
          event.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault()
          setDragging(false)
          upload(event.dataTransfer.files?.[0])
        }}
        className={`rounded-xl border border-dashed p-2 transition ${dragging ? "border-default bg-default/5" : "border-slate-300"}`}
      >
        <Checkerboard
          className={`${aspect} ${focalPath && src ? "cursor-crosshair" : ""}`}
          style={backdrop ? { backgroundColor: backdrop, backgroundImage: "none" } : undefined}
        >
          {src ? (
            kind === "image" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={src}
                alt=""
                onClick={pickFocal}
                className={`absolute inset-0 h-full w-full ${fit === "cover" ? "object-cover" : "object-contain p-2"}`}
                style={focalPath && focal ? { objectPosition: `${focal.x}% ${focal.y}%` } : undefined}
              />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-xs text-slate-500">
                <Check className="h-5 w-5 text-emerald-600" />
                {value.startsWith("asset:") ? "Archivo subido" : value}
              </div>
            )
          ) : (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-slate-400 hover:text-slate-600"
            >
              <Upload className="h-5 w-5" />
              <span className="text-xs font-medium">Arrastra un archivo o haz clic para subir</span>
            </button>
          )}
          {focalPath && src && focal && kind === "image" && (
            <span
              className="pointer-events-none absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.35),0_2px_6px_rgba(0,0,0,0.3)]"
              style={{ left: `${focal.x}%`, top: `${focal.y}%`, background: "rgb(var(--brand) / 0.55)" }}
            />
          )}
          {busy && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/70 text-sm font-medium text-slate-700">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Subiendo…
            </div>
          )}
        </Checkerboard>

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            hidden
            onChange={(event) => {
              upload(event.target.files?.[0])
              event.target.value = ""
            }}
          />
          <MiniButton onClick={() => inputRef.current?.click()} icon={Upload}>
            {src ? "Reemplazar" : "Subir"}
          </MiniButton>
          <MiniButton onClick={() => setLibrary(true)} icon={Images}>
            Biblioteca
          </MiniButton>
          {presetValue && presetValue !== value && (
            <MiniButton onClick={() => set(presetValue)} icon={RotateCcw}>
              Original
            </MiniButton>
          )}
          {value && (
            <MiniButton onClick={() => set("")} icon={X}>
              Quitar
            </MiniButton>
          )}
          {focalPath && src && kind === "image" && (
            <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-slate-400">
              <Crosshair className="h-3.5 w-3.5" /> Clic en la imagen para fijar el punto de interés
            </span>
          )}
        </div>
        {error && <p className="mt-1.5 text-xs font-medium text-red-600">{error}</p>}
      </div>
      <AssetLibrary
        open={library}
        kind={kind}
        onClose={() => setLibrary(false)}
        onPick={(ref) => {
          set(ref)
          setLibrary(false)
        }}
      />
    </Field>
  )
}

export function MiniButton({ onClick, icon: Icon, children, tone = "default", disabled, title }) {
  const tones = {
    default: "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
    danger: "border-red-200 bg-white text-red-600 hover:bg-red-50",
    primary: "border-transparent bg-default text-white hover:bg-defaultStrong",
  }
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50 ${tones[tone]}`}
    >
      {Icon && <Icon className="h-3.5 w-3.5" />}
      {children}
    </button>
  )
}

// ------------------------------------------------------------------- lists
/**
 * An ordered list of items: add, remove, duplicate, reorder (drag the handle
 * or use the arrows), collapse. `renderItem(itemPath, index, item)` renders
 * the item's fields; `summary(item, index)` is its one-line title.
 */
export function ListField({
  path,
  label,
  hint,
  summary,
  renderItem,
  newItem,
  addLabel = "Agregar",
  max,
  thumbnail,
  defaultOpen = false,
}) {
  const [items = [], set] = useField(path)
  const [open, setOpen] = useState(() => new Set(defaultOpen ? items.map((_, i) => i) : []))
  const [dragIndex, setDragIndex] = useState(null)
  const [overIndex, setOverIndex] = useState(null)

  const move = (from, to) => {
    if (to < 0 || to >= items.length || from === to) return
    const next = [...items]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    set(next)
    setOpen(new Set())
  }
  const remove = (index) => {
    set(items.filter((_, i) => i !== index))
    setOpen(new Set())
  }
  const duplicate = (index) => {
    const next = [...items]
    next.splice(index + 1, 0, JSON.parse(JSON.stringify(items[index])))
    set(next)
  }
  const toggle = (index) =>
    setOpen((current) => {
      const next = new Set(current)
      next.has(index) ? next.delete(index) : next.add(index)
      return next
    })

  return (
    <Field label={label} hint={hint} path={path}>
      <div className="space-y-2">
        {items.map((item, index) => {
          const isOpen = open.has(index)
          return (
            <div
              key={index}
              onDragOver={(event) => {
                if (dragIndex === null) return
                event.preventDefault()
                setOverIndex(index)
              }}
              onDrop={(event) => {
                event.preventDefault()
                if (dragIndex !== null) move(dragIndex, index)
                setDragIndex(null)
                setOverIndex(null)
              }}
              className={`rounded-lg border bg-white transition ${
                overIndex === index && dragIndex !== null && dragIndex !== index
                  ? "border-default ring-2 ring-default/20"
                  : "border-slate-200"
              } ${dragIndex === index ? "opacity-50" : ""}`}
            >
              <div className="flex items-center gap-1.5 px-2 py-1.5">
                <span
                  draggable
                  onDragStart={(event) => {
                    event.dataTransfer.effectAllowed = "move"
                    setDragIndex(index)
                  }}
                  onDragEnd={() => {
                    setDragIndex(null)
                    setOverIndex(null)
                  }}
                  title="Arrastra para reordenar"
                  className="cursor-grab rounded p-1 text-slate-300 hover:bg-slate-100 hover:text-slate-500 active:cursor-grabbing"
                >
                  <GripVertical className="h-4 w-4" />
                </span>
                {thumbnail && thumbnail(item)}
                <button
                  type="button"
                  onClick={() => toggle(index)}
                  className="flex min-w-0 flex-1 items-center gap-2 py-1 text-left"
                >
                  <span className="w-5 shrink-0 text-xs tabular-nums text-slate-400">{index + 1}</span>
                  <span className="truncate text-[13px] font-medium text-slate-800">
                    {summary(item, index) || <span className="italic text-slate-400">Sin título</span>}
                  </span>
                </button>
                <IconButton title="Subir" onClick={() => move(index, index - 1)} disabled={index === 0}>
                  <ChevronUp className="h-4 w-4" />
                </IconButton>
                <IconButton title="Bajar" onClick={() => move(index, index + 1)} disabled={index === items.length - 1}>
                  <ChevronDown className="h-4 w-4" />
                </IconButton>
                <IconButton title="Duplicar" onClick={() => duplicate(index)} disabled={max && items.length >= max}>
                  <Copy className="h-3.5 w-3.5" />
                </IconButton>
                <IconButton title="Eliminar (se puede deshacer)" onClick={() => remove(index)} danger>
                  <Trash2 className="h-3.5 w-3.5" />
                </IconButton>
              </div>
              {isOpen && (
                <div className="space-y-4 border-t border-slate-100 px-4 py-4">
                  {renderItem(`${path}.${index}`, index, item)}
                </div>
              )}
            </div>
          )
        })}
        {(!max || items.length < max) && (
          <button
            type="button"
            onClick={() => {
              set([...items, newItem()])
              setOpen((current) => new Set(current).add(items.length))
            }}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-300 py-2 text-[13px] font-medium text-slate-500 transition hover:border-default hover:text-default"
          >
            <Plus className="h-4 w-4" /> {addLabel}
          </button>
        )}
      </div>
    </Field>
  )
}

export function IconButton({ onClick, title, children, disabled, danger }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
      className={`rounded p-1 transition disabled:cursor-not-allowed disabled:opacity-30 ${
        danger ? "text-slate-400 hover:bg-red-50 hover:text-red-600" : "text-slate-400 hover:bg-slate-100 hover:text-slate-700"
      }`}
    >
      {children}
    </button>
  )
}

// --------------------------------------------------------------- languages
/**
 * Chips of language codes (or bare prefixes like "rap") with suggestions from
 * the catalog, each shown with its language name.
 */
export function CodesField({ path, label, hint, languages, prefixes = false, placeholder }) {
  const [value = [], set] = useField(path)
  const [text, setText] = useState("")
  const listId = useId()
  const options = useMemo(() => {
    if (!prefixes) return languages.map((lang) => ({ code: lang.code, name: lang.name }))
    // A prefix is named after its base language (arn_Latn: "Mapuzungun"), not
    // after whichever variant comes first ("Lafkenche Azümchefe")
    const rank = (code, prefix) => (code === prefix ? 0 : new RegExp(`^${prefix}_[A-Z][a-z]{3}$`).test(code) ? 1 : 2)
    const seen = new Map()
    languages.forEach((lang) => {
      const prefix = lang.code.split("_")[0]
      const current = seen.get(prefix)
      const r = rank(lang.code, prefix)
      if (!current || r < current.rank) seen.set(prefix, { name: lang.name, rank: r })
    })
    return [...seen].map(([code, { name }]) => ({ code, name }))
  }, [languages, prefixes])
  const nameOf = (code) => options.find((option) => option.code === code)?.name

  const add = (raw) => {
    const code = raw.trim()
    if (!code || value.includes(code)) return setText("")
    set([...value, code])
    setText("")
  }

  return (
    <Field label={label} hint={hint} path={path}>
      <div className="flex min-h-[42px] flex-wrap items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2 py-1.5 shadow-sm focus-within:border-default focus-within:ring-2 focus-within:ring-default/20">
        {value.map((code) => (
          <span
            key={code}
            className="inline-flex items-center gap-1 rounded-md bg-slate-100 py-0.5 pl-2 pr-1 text-xs text-slate-700"
          >
            <span className="font-mono font-semibold">{code}</span>
            {nameOf(code) && <span className="text-slate-500">· {nameOf(code)}</span>}
            <button
              type="button"
              aria-label={`Quitar ${code}`}
              onClick={() => set(value.filter((item) => item !== code))}
              className="rounded p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          list={listId}
          value={text}
          placeholder={value.length ? "" : placeholder || "Escribe un código…"}
          onChange={(event) => {
            const next = event.target.value
            // choosing from the datalist fills the whole code at once
            if (options.some((option) => option.code === next)) add(next)
            else setText(next)
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === ",") {
              event.preventDefault()
              add(text)
            } else if (event.key === "Backspace" && !text && value.length) {
              set(value.slice(0, -1))
            }
          }}
          onBlur={() => text && add(text)}
          className="min-w-[8rem] flex-1 border-0 bg-transparent px-1 py-0.5 text-sm outline-none"
        />
        <datalist id={listId}>
          {options.map((option) => (
            <option key={option.code} value={option.code}>
              {option.name}
            </option>
          ))}
        </datalist>
      </div>
    </Field>
  )
}

export function LanguageSelectField({ path, label, hint, languages }) {
  const [value, set] = useField(path)
  const id = useId()
  const known = languages.some((lang) => lang.code === value)
  return (
    <Field label={label} hint={hint} path={path} htmlFor={id}>
      <select id={id} className={inputClass} value={value ?? ""} onChange={(event) => set(event.target.value)}>
        {!known && value && <option value={value}>{value} (no está en la lista)</option>}
        {languages.map((lang) => (
          <option key={lang.code} value={lang.code}>
            {lang.name} — {lang.code}
          </option>
        ))}
      </select>
    </Field>
  )
}

/** Single-language rich text (translator dialogs). */
export function RichField({ path, label, hint }) {
  const [value, set] = useField(path)
  return (
    <Field label={label} hint={hint} path={path}>
      <RichTextEditor value={value || ""} onChange={set} ariaLabel={label} />
    </Field>
  )
}

export { inputBase, inputClass }
