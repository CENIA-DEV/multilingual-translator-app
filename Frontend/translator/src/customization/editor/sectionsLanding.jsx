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

// Editor sections for the landing page (/about).

import { useMemo, useState } from "react"
import { ClipboardPaste, Eye, EyeOff, Plus, Trash2 } from "lucide-react"
import DotMap from "@/components/DotMap"
import { resolveMedia } from "../media"
import { translate } from "../i18n"
import FocusIcon, { FOCUS_ICONS } from "../icons"
import { richTextToPlain } from "./richText"
import {
  Callout,
  Field,
  Grid,
  I18nField,
  IconButton,
  ImageField,
  LinesField,
  ListField,
  MiniButton,
  NumberField,
  Panel,
  SegmentedField,
  SliderField,
  TextField,
  ToggleField,
  inputBase,
  inputClass,
  useEditor,
  useField,
} from "./fields"

export const SECTION_LABELS = {
  about: "Acerca del proyecto",
  validation: "Mapa de validación",
  focus: "Nuestro enfoque",
  owners: "Proyecto y socios",
  collaborators: "Colaboradores",
  funding: "Financiamiento",
  contact: "Contacto",
}

const TONE_OPTIONS = [
  { value: "paper", label: "Claro" },
  { value: "tint", label: "Suave" },
  { value: "dark", label: "Oscuro" },
]

function useTr() {
  const { doc } = useEditor()
  return (node) => translate(node, doc.landing.defaultLocale, doc.landing.defaultLocale)
}

function Thumb({ src, contain = true }) {
  const url = resolveMedia(src)
  return (
    <span className="relative h-8 w-12 shrink-0 overflow-hidden rounded border border-slate-200 bg-slate-50">
      {url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className={`absolute inset-0 h-full w-full ${contain ? "object-contain p-0.5" : "object-cover"}`} />
      )}
    </span>
  )
}

// ------------------------------------------------------- languages & order
function LocalesEditor() {
  const { doc, update } = useEditor()
  const locales = doc.landing.locales
  const defaultLocale = doc.landing.defaultLocale
  const [code, setCode] = useState("")
  const [label, setLabel] = useState("")
  const valid = /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})?$/.test(code) && !locales.some((l) => l.code === code)

  return (
    <Field
      label="Idiomas de la página"
      hint="El selector de la portada ofrece estos idiomas. Un texto sin traducir se muestra en el idioma por defecto."
      path="landing.locales"
    >
      <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
        {locales.map((locale, index) => (
          <div key={locale.code} className="flex items-center gap-3 px-3 py-2">
            <span className="w-12 font-mono text-xs font-semibold uppercase text-slate-500">{locale.code}</span>
            <input
              className={`${inputClass} py-1.5`}
              value={locale.label}
              onChange={(event) => update(`landing.locales.${index}.label`, event.target.value)}
              aria-label={`Nombre visible de ${locale.code}`}
            />
            <label className="flex shrink-0 items-center gap-1.5 text-xs text-slate-600">
              <input
                type="radio"
                name="default-locale"
                checked={defaultLocale === locale.code}
                onChange={() => update("landing.defaultLocale", locale.code)}
                className="accent-[rgb(var(--brand))]"
              />
              Por defecto
            </label>
            <IconButton
              title="Quitar idioma (las traducciones se conservan)"
              danger
              disabled={locales.length === 1 || defaultLocale === locale.code}
              onClick={() => update("landing.locales", locales.filter((l) => l.code !== locale.code))}
            >
              <Trash2 className="h-4 w-4" />
            </IconButton>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          className={`${inputBase} w-28 font-mono`}
          placeholder="código"
          value={code}
          onChange={(event) => setCode(event.target.value.trim().toLowerCase())}
          aria-label="Código del nuevo idioma"
        />
        <input
          className={`${inputBase} w-48`}
          placeholder="Nombre visible"
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          aria-label="Nombre del nuevo idioma"
        />
        <MiniButton
          icon={Plus}
          disabled={!valid || !label.trim()}
          onClick={() => {
            update("landing.locales", [...locales, { code, label: label.trim() }])
            setCode("")
            setLabel("")
          }}
        >
          Agregar idioma
        </MiniButton>
        <span className="text-xs text-slate-400">Código corto: es, en, rap, arn, mi…</span>
      </div>
    </Field>
  )
}

function SectionsOrder() {
  const [sections = [], set] = useField("landing.sections")
  const [drag, setDrag] = useState(null)
  const move = (from, to) => {
    if (to < 0 || to >= sections.length) return
    const next = [...sections]
    const [item] = next.splice(from, 1)
    next.splice(to, 0, item)
    set(next)
  }
  const patch = (index, change) => set(sections.map((s, i) => (i === index ? { ...s, ...change } : s)))
  return (
    <Field
      label="Secciones"
      hint="Arrastra para reordenar. La portada va siempre primero y el pie de página al final. El tono define el fondo de cada sección."
      path="landing.sections"
    >
      <div className="space-y-1.5">
        {sections.map((section, index) => (
          <div
            key={section.id}
            draggable
            onDragStart={() => setDrag(index)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => {
              if (drag !== null) move(drag, index)
              setDrag(null)
            }}
            onDragEnd={() => setDrag(null)}
            className={`flex cursor-grab items-center gap-3 rounded-lg border bg-white px-3 py-2 active:cursor-grabbing ${
              drag === index ? "opacity-50" : ""
            } ${section.visible ? "border-slate-200" : "border-dashed border-slate-200 bg-slate-50"}`}
          >
            <span className="w-4 text-xs tabular-nums text-slate-400">{index + 1}</span>
            <span
              className="h-5 w-5 shrink-0 rounded border border-slate-300"
              style={{
                background:
                  section.tone === "dark" ? "var(--lp-night)" : section.tone === "tint" ? "var(--lp-tint)" : "var(--lp-paper)",
              }}
            />
            <span className={`flex-1 text-[13px] font-medium ${section.visible ? "text-slate-800" : "text-slate-400 line-through"}`}>
              {SECTION_LABELS[section.id]}
            </span>
            <div className="inline-flex rounded-md border border-slate-200 bg-slate-50 p-0.5">
              {TONE_OPTIONS.map((tone) => (
                <button
                  key={tone.value}
                  type="button"
                  onClick={() => patch(index, { tone: tone.value })}
                  className={`rounded px-2 py-0.5 text-[11px] font-medium ${
                    section.tone === tone.value ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
                  }`}
                >
                  {tone.label}
                </button>
              ))}
            </div>
            <IconButton
              title={section.visible ? "Ocultar sección" : "Mostrar sección"}
              onClick={() => patch(index, { visible: !section.visible })}
            >
              {section.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            </IconButton>
            <IconButton title="Subir" onClick={() => move(index, index - 1)} disabled={index === 0}>
              ↑
            </IconButton>
            <IconButton title="Bajar" onClick={() => move(index, index + 1)} disabled={index === sections.length - 1}>
              ↓
            </IconButton>
          </div>
        ))}
      </div>
    </Field>
  )
}

export function LandingStructureSection() {
  return (
    <>
      <Panel title="Idiomas" description="La página de inicio puede estar en varios idiomas; el visitante elige.">
        <LocalesEditor />
      </Panel>
      <Panel title="Orden y apariencia de las secciones">
        <SectionsOrder />
      </Panel>
    </>
  )
}

// ------------------------------------------------------------------- hero
export function HeroSection() {
  const { doc } = useEditor()
  return (
    <>
      <Panel title="Encabezado" description="Barra superior de la portada.">
        <Grid>
          <ImageField
            path="landing.header.logo"
            label="Logo"
            hint="Se muestra sobre una etiqueta blanca."
            maxDimension={600}
            aspect="aspect-[3/2]"
          />
          <div className="space-y-4">
            <I18nField path="landing.header.brandTitle" label="Nombre junto al logo" />
            <I18nField path="landing.header.logoAlt" label="Descripción del logo (accesibilidad)" />
          </div>
        </Grid>
        <I18nField
          path="landing.header.selectLanguageLabel"
          label="Texto del selector de idioma en celulares"
        />
      </Panel>

      <Panel title="Portada" description="Primera pantalla: foto, título y botones.">
        <ImageField
          path="landing.hero.image"
          label="Foto de fondo"
          hint="Horizontal, al menos 1600 px de ancho. Haz clic en la foto para elegir qué parte queda siempre visible."
          focalPath="landing.hero.focalPoint"
          fit="cover"
          aspect="aspect-[16/7]"
        />
        <SliderField
          path="landing.hero.overlayOpacity"
          label="Oscurecer la foto"
          hint="100% es el velo original; súbelo si el texto se lee con dificultad."
          max={150}
        />
        <I18nField path="landing.hero.imageAlt" label="Descripción de la foto (accesibilidad)" />
        <I18nField path="landing.hero.title" label="Título" multiline rows={2} />
        <I18nField path="landing.hero.subtitle" label="Bajada" multiline rows={2} />
        <Grid>
          <I18nField path="landing.hero.primaryCta" label="Botón principal (va al traductor)" />
          <I18nField path="landing.hero.secondaryCta" label="Botón secundario (baja a la primera sección)" />
        </Grid>
        {doc.landing.developer.enabled && (
          <ToggleField
            path="landing.hero.showDeveloperBadge"
            label={`Mostrar «${translate(doc.landing.owners.developedByLabel, doc.landing.defaultLocale)} ${doc.landing.developer.name}» en la esquina`}
          />
        )}
      </Panel>
    </>
  )
}

// ------------------------------------------------------------------ about
export function AboutSection() {
  const tr = useTr()
  return (
    <Panel title="Acerca del proyecto" description="Párrafos con foto, alternando lados.">
      <I18nField path="landing.about.title" label="Título de la sección" />
      <ListField
        path="landing.about.items"
        label="Párrafos"
        max={12}
        defaultOpen={false}
        summary={(item) => richTextToPlain(tr(item.text)).slice(0, 90)}
        thumbnail={(item) => <Thumb src={item.image} contain={false} />}
        newItem={() => ({ text: {}, image: "", imageAlt: {}, imageFit: "cover", focalPoint: { x: 50, y: 50 } })}
        addLabel="Agregar párrafo"
        renderItem={(path) => (
          <>
            <I18nField path={`${path}.text`} label="Texto" rich />
            <ImageField
              path={`${path}.image`}
              label="Foto (opcional)"
              focalPath={`${path}.focalPoint`}
              fit="cover"
              aspect="aspect-[3/2]"
              maxDimension={1600}
            />
            <SegmentedField
              path={`${path}.imageFit`}
              label="Encuadre de la foto"
              options={[
                { value: "cover", label: "Rellenar el marco" },
                { value: "contain", label: "Completa sobre blanco (logos, gráficos)" },
              ]}
            />
            <I18nField path={`${path}.imageAlt`} label="Descripción de la foto (accesibilidad)" />
          </>
        )}
      />
    </Panel>
  )
}

// ----------------------------------------------------------------- map
function parsePins(text) {
  // "Nombre; -27.14; -109.42" or tab separated (pasted from a spreadsheet)
  return text
    .split(/\r?\n/)
    .map((line) => line.split(/\t|;|\s*,\s*(?=-?\d)/).map((cell) => cell.trim()))
    .filter((cells) => cells.length >= 3)
    .map(([name, lat, lon]) => ({ name, lat: Number(lat.replace(",", ".")), lon: Number(lon.replace(",", ".")) }))
    .filter((pin) => pin.name && Number.isFinite(pin.lat) && Number.isFinite(pin.lon))
}

function PinsTable() {
  const [pins = [], set] = useField("landing.validation.pins")
  const [paste, setPaste] = useState(null)
  const parsed = useMemo(() => (paste ? parsePins(paste) : []), [paste])
  const patch = (index, change) => set(pins.map((pin, i) => (i === index ? { ...pin, ...change } : pin)))

  return (
    <Field
      label={`Lugares (${pins.length})`}
      hint="Latitud y longitud en grados decimales (clic derecho en Google Maps → copiar coordenadas)."
      path="landing.validation.pins"
      aside={
        <MiniButton icon={ClipboardPaste} onClick={() => setPaste(paste === null ? "" : null)}>
          Pegar desde planilla
        </MiniButton>
      }
    >
      {paste !== null && (
        <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs text-slate-600">
            Una fila por lugar: <span className="font-mono">nombre, latitud, longitud</span> (separados por tabulación,
            punto y coma o coma). Reemplaza la lista actual.
          </p>
          <textarea
            className={`${inputClass} h-32 font-mono text-xs`}
            value={paste}
            onChange={(event) => setPaste(event.target.value)}
            placeholder={"Hospital de Hanga Roa\t-27.150516\t-109.420939"}
          />
          <div className="flex items-center gap-2">
            <MiniButton
              tone="primary"
              disabled={!parsed.length}
              onClick={() => {
                set(parsed)
                setPaste(null)
              }}
            >
              Usar {parsed.length} lugares
            </MiniButton>
            <MiniButton onClick={() => setPaste(null)}>Cancelar</MiniButton>
          </div>
        </div>
      )}
      <div className="max-h-80 overflow-y-auto rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-slate-50 text-left text-[11px] uppercase tracking-wider text-slate-400">
            <tr>
              <th className="px-3 py-2 font-semibold">Nombre</th>
              <th className="w-32 px-2 py-2 font-semibold">Latitud</th>
              <th className="w-32 px-2 py-2 font-semibold">Longitud</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {pins.map((pin, index) => (
              <tr key={index} className="border-t border-slate-100">
                <td className="px-2 py-1">
                  <input
                    className="w-full rounded border border-transparent px-1.5 py-1 hover:border-slate-200 focus:border-default focus:outline-none"
                    value={pin.name}
                    onChange={(event) => patch(index, { name: event.target.value })}
                    aria-label="Nombre del lugar"
                  />
                </td>
                {["lat", "lon"].map((key) => (
                  <td key={key} className="px-1 py-1">
                    <input
                      type="number"
                      step="0.000001"
                      className="w-full rounded border border-transparent px-1.5 py-1 font-mono text-xs hover:border-slate-200 focus:border-default focus:outline-none"
                      value={pin[key]}
                      onChange={(event) => patch(index, { [key]: Number(event.target.value) })}
                      aria-label={key === "lat" ? "Latitud" : "Longitud"}
                    />
                  </td>
                ))}
                <td className="px-1">
                  <IconButton title="Quitar" danger onClick={() => set(pins.filter((_, i) => i !== index))}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </IconButton>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <MiniButton
        icon={Plus}
        onClick={() => set([...pins, { name: "", lat: pins.at(-1)?.lat ?? 0, lon: pins.at(-1)?.lon ?? 0 }])}
      >
        Agregar lugar
      </MiniButton>
    </Field>
  )
}

export function ValidationSection() {
  const { doc } = useEditor()
  const validation = doc.landing.validation
  const pinsKey = JSON.stringify(validation.pins)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const pins = useMemo(() => validation.pins, [pinsKey])
  const visible = doc.landing.sections.find((section) => section.id === "validation")?.visible
  return (
    <Panel
      title="Mapa de validación"
      description="Mapa de puntos del territorio con los lugares donde se validó el traductor con la comunidad."
    >
      {!visible && (
        <Callout tone="warn">Esta sección está oculta. Actívala en «Idiomas y secciones».</Callout>
      )}
      <I18nField path="landing.validation.title" label="Título" multiline rows={2} />
      <I18nField path="landing.validation.mapLabel" label="Descripción del mapa (accesibilidad)" />
      <ImageField
        path="landing.validation.geojson"
        label="Contorno del territorio (GeoJSON)"
        hint="Polígono o multipolígono del territorio (isla, comuna, región). Se puede exportar desde geojson.io o QGIS."
        kind="geojson"
        accept=".json,.geojson,application/json,application/geo+json"
        aspect="aspect-[5/1]"
      />
      <PinsTable />
      {validation.geojson && (
        <div className="rounded-lg border border-slate-200 p-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Vista del mapa</p>
          <DotMap
            pins={pins}
            geoJsonUrl={resolveMedia(validation.geojson)}
            colors={{
              dots: doc.theme.landing.mapDots,
              accent: doc.theme.landing.accent,
              surface: doc.theme.landing.mapSurface,
            }}
          />
        </div>
      )}
    </Panel>
  )
}

// ---------------------------------------------------------------- focus
function IconPicker({ path }) {
  const [value, set] = useField(path)
  return (
    <Field label="Ícono" path={path}>
      <div className="flex flex-wrap gap-1.5">
        {Object.entries(FOCUS_ICONS).map(([name, icon]) => (
          <button
            key={name}
            type="button"
            title={icon.label}
            onClick={() => set(name)}
            className={`rounded-lg border p-1.5 transition ${
              value === name ? "border-default bg-default/10" : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
            }`}
          >
            <FocusIcon name={name} color={value === name ? "rgb(var(--brand))" : "#64748b"} size={28} />
          </button>
        ))}
      </div>
    </Field>
  )
}

export function FocusSection() {
  const tr = useTr()
  return (
    <Panel title="Nuestro enfoque" description="Pilares del proyecto, con ícono, título y texto.">
      <I18nField path="landing.focus.title" label="Título de la sección" />
      <ListField
        path="landing.focus.items"
        label="Pilares"
        max={8}
        summary={(item) => tr(item.title)}
        thumbnail={(item) => (
          <span className="shrink-0 text-slate-500">
            <FocusIcon name={item.icon} color="#64748b" size={22} />
          </span>
        )}
        newItem={() => ({ icon: "book", title: {}, text: {} })}
        addLabel="Agregar pilar"
        renderItem={(path) => (
          <>
            <IconPicker path={`${path}.icon`} />
            <I18nField path={`${path}.title`} label="Título" />
            <I18nField path={`${path}.text`} label="Texto" multiline rows={3} />
          </>
        )}
      />
    </Panel>
  )
}

// --------------------------------------------------------------- owners
export function OwnersSection() {
  const tr = useTr()
  const { doc } = useEditor()
  return (
    <>
      <Panel title="Proyecto colaborativo" description="Instituciones a cargo del proyecto, con logo y enlace.">
        <I18nField path="landing.owners.title" label="Título de la sección" />
        <ListField
          path="landing.owners.partners"
          label="Instituciones"
          max={20}
          summary={(item) => tr(item.name)}
          thumbnail={(item) => <Thumb src={item.logo} />}
          newItem={() => ({ logo: "", name: {}, url: "", urlLabel: "", logoHeight: 72 })}
          addLabel="Agregar institución"
          renderItem={(path) => (
            <>
              <Grid>
                <ImageField path={`${path}.logo`} label="Logo" maxDimension={800} aspect="aspect-[3/2]" />
                <div className="space-y-4">
                  <I18nField path={`${path}.name`} label="Nombre" />
                  <NumberField path={`${path}.logoHeight`} label="Alto del logo" min={24} max={200} suffix="px" />
                </div>
              </Grid>
              <Grid>
                <TextField path={`${path}.url`} label="Enlace (opcional)" placeholder="https://" />
                <TextField path={`${path}.urlLabel`} label="Texto del enlace" placeholder="www.ejemplo.cl" />
              </Grid>
            </>
          )}
        />
        <p className="text-xs text-slate-500">
          Los nombres de las instituciones también forman la línea del pie de página.
        </p>
      </Panel>

      <Panel
        title="Desarrollado por"
        description="Equipo desarrollador: aparece en la portada, en esta sección y en el pie de página."
      >
        <ToggleField path="landing.developer.enabled" label="Mostrar el equipo desarrollador" />
        {doc.landing.developer.enabled && (
          <>
            <I18nField path="landing.owners.developedByLabel" label="Texto «Desarrollado por»" />
            <Grid>
              <ImageField
                path="landing.developer.logo"
                label="Logo (sobre fondo claro)"
                hint="En fondos oscuros se muestra en blanco automáticamente."
                maxDimension={1200}
                aspect="aspect-[4/1]"
              />
              <div className="space-y-4">
                <TextField path="landing.developer.name" label="Nombre" />
                <TextField path="landing.developer.url" label="Enlace" placeholder="https://" />
                <TextField path="landing.developer.urlLabel" label="Texto del enlace" />
              </div>
            </Grid>
          </>
        )}
      </Panel>
    </>
  )
}

// ---------------------------------------------------------- collaborators
export function CollaboratorsSection() {
  const tr = useTr()
  return (
    <Panel title="Colaboradores" description="Columnas de créditos: un título y una lista de nombres.">
      <I18nField path="landing.collaborators.title" label="Título de la sección" />
      <ListField
        path="landing.collaborators.groups"
        label="Grupos"
        max={40}
        summary={(item) => `${tr(item.title)} · ${item.names.length}`}
        newItem={() => ({ title: {}, names: [] })}
        addLabel="Agregar grupo"
        renderItem={(path) => (
          <>
            <I18nField path={`${path}.title`} label="Título del grupo" />
            <LinesField
              path={`${path}.names`}
              label="Personas o instituciones"
              hint="Una por línea. Los nombres propios no se traducen."
              rows={8}
            />
          </>
        )}
      />
    </Panel>
  )
}

// --------------------------------------------------------------- funding
export function FundingSection() {
  const tr = useTr()
  return (
    <Panel title="Financiamiento" description="Logos de quienes financian el proyecto.">
      <I18nField path="landing.funding.title" label="Título de la sección" />
      <ListField
        path="landing.funding.items"
        label="Financistas"
        max={40}
        summary={(item) => tr(item.caption).replace(/\n/g, " · ")}
        thumbnail={(item) => <Thumb src={item.logo} />}
        newItem={() => ({ logo: "", caption: {}, url: "" })}
        addLabel="Agregar financista"
        renderItem={(path) => (
          <Grid>
            <ImageField path={`${path}.logo`} label="Logo" maxDimension={800} aspect="aspect-[3/2]" />
            <div className="space-y-4">
              <I18nField
                path={`${path}.caption`}
                label="Leyenda"
                multiline
                rows={2}
                hint="Puede tener dos líneas (por ejemplo, el código del proyecto)."
              />
              <TextField path={`${path}.url`} label="Enlace (opcional)" placeholder="https://" />
            </div>
          </Grid>
        )}
      />
    </Panel>
  )
}

// ------------------------------------------------------ contact & footer
export function ContactSection() {
  return (
    <>
      <Panel title="Contacto" description="Invitación a colaborar y formulario de contacto.">
        <I18nField path="landing.contact.title" label="Título" />
        <I18nField path="landing.contact.subtitle" label="Bajada" />
        <I18nField path="landing.contact.button" label="Botón" />
      </Panel>
      <Panel title="Formulario de contacto" description="Textos de la ventana que se abre con el botón.">
        <I18nField path="landing.contact.form.description" label="Instrucción" />
        <Grid>
          <I18nField path="landing.contact.form.firstName" label="Campo «Nombre»" />
          <I18nField path="landing.contact.form.lastName" label="Campo «Apellido»" />
          <I18nField path="landing.contact.form.email" label="Campo «Correo»" />
          <I18nField path="landing.contact.form.organization" label="Campo «Organización»" />
          <I18nField path="landing.contact.form.optional" label="Marca «Opcional»" />
          <I18nField path="landing.contact.form.message" label="Campo «Mensaje»" />
          <I18nField path="landing.contact.form.submit" label="Botón «Enviar»" />
        </Grid>
        <Grid>
          <I18nField path="landing.contact.form.successTitle" label="Aviso de éxito" />
          <I18nField path="landing.contact.form.successBody" label="Detalle del éxito" />
          <I18nField path="landing.contact.form.errorTitle" label="Aviso de error" />
          <I18nField path="landing.contact.form.errorBody" label="Detalle del error" />
        </Grid>
      </Panel>
      <Panel title="Pie de página">
        <I18nField path="landing.footer.label" label="Título" />
        <ToggleField path="landing.footer.showPartnerNames" label="Mostrar los nombres de las instituciones" />
      </Panel>
    </>
  )
}
