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

// Editor sections for the site as a whole and the translator page.

import { useMemo, useState } from "react"
import { Eye, EyeOff, Plus, Search, Sparkles, Trash2 } from "lucide-react"
import { CATALOG } from "../languages"
import { mix, paletteFrom } from "../theme"
import { DISPLAY_FONTS, TEXT_FONTS } from "../fonts"
import { translate } from "../i18n"
import { TERRITORY_ICONS } from "../territoryHelper"
import {
  Callout,
  CodesField,
  ColorField,
  Field,
  Grid,
  I18nField,
  IconButton,
  ImageField,
  LanguageSelectField,
  LinesField,
  ListField,
  MiniButton,
  Panel,
  SegmentedField,
  SelectField,
  SliderField,
  TextField,
  ToggleField,
  UiTextField,
  inputBase,
  inputClass,
  useEditor,
  useField,
} from "./fields"

// ------------------------------------------------------------------ general
export function IdentitySection() {
  const { doc } = useEditor()
  const { identity } = doc
  return (
    <>
      <Panel
        title="Identidad"
        description="Nombre del idioma y logos que identifican a este traductor en todo el sitio."
      >
        <Grid>
          <TextField
            path="identity.languageName"
            label="Nombre del idioma"
            hint="Aparece en «Nivel de manejo escrito de …» (perfil e invitaciones) y en el texto alternativo del logo."
          />
          <TextField
            path="identity.organizationName"
            label="Organización que revisa las solicitudes"
            hint="Se muestra al confirmar una solicitud de acceso: «será revisada por personal de …»."
          />
        </Grid>
        <Grid>
          <ImageField
            path="identity.logo"
            label="Logo del traductor"
            hint="Arriba a la izquierda de la tarjeta de texto. PNG o SVG con fondo transparente."
            maxDimension={600}
            aspect="aspect-[3/2]"
          />
          <ImageField
            path="identity.favicon"
            label="Ícono de la pestaña (favicon)"
            hint="Cuadrado, ICO, PNG o SVG de 32 a 512 px."
            maxDimension={512}
            aspect="aspect-[3/2]"
          />
        </Grid>
      </Panel>

      <Panel
        title="Buscadores y redes sociales"
        description="Cómo aparece el sitio en Google y al compartir un enlace."
      >
        <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Vista previa</p>
          <p className="mt-2 truncate text-[18px] leading-6 text-[#1a0dab]">{identity.siteTitle || "Sin título"}</p>
          <p className="text-[13px] text-[#006621]">{typeof window !== "undefined" ? window.location.host : ""}</p>
          <p className="mt-0.5 line-clamp-2 text-[13px] leading-5 text-slate-600">{identity.siteDescription}</p>
        </div>
        <TextField path="identity.siteTitle" label="Título del sitio" maxLength={70} hint="Idealmente menos de 60 caracteres." />
        <TextField
          path="identity.siteDescription"
          label="Descripción"
          multiline
          rows={2}
          maxLength={300}
          hint="Una o dos frases; Google muestra unos 155 caracteres."
        />
        <LinesField path="identity.keywords" label="Palabras clave" hint="Una por línea." rows={5} />
      </Panel>
    </>
  )
}

// --------------------------------------------------------------- appearance
const LANDING_TOKENS = [
  {
    group: "Fondos",
    tokens: [
      ["page", "Fondo general"],
      ["paper", "Sección clara"],
      ["tint", "Sección suave"],
      ["night", "Sección oscura"],
      ["deepNight", "Pie de página"],
      ["heroBase", "Portada sin foto"],
      ["heroOverlay", "Velo sobre la foto de portada"],
    ],
  },
  {
    group: "Textos",
    tokens: [
      ["heading", "Títulos", "paper"],
      ["body", "Párrafos", "tint"],
      ["subtle", "Nombres y leyendas", "paper"],
      ["muted", "Textos secundarios", "paper"],
      ["highlight", "Texto destacado (negritas)", "tint"],
    ],
  },
  {
    group: "Acentos",
    tokens: [
      ["accent", "Acento: íconos, pines del mapa y botones", null],
      ["cta", "Botón «Probar el traductor»", null],
      ["link", "Enlaces", "paper"],
      ["onDarkAccent", "Acento sobre fondo oscuro", "night"],
    ],
  },
  {
    group: "Mapa",
    tokens: [
      ["mapDots", "Puntos del territorio"],
      ["mapSurface", "Fondo del círculo ampliado"],
    ],
  },
]

function FontSample({ font, text, size = 22 }) {
  return (
    <p
      className="truncate rounded-md bg-slate-50 px-3 py-2 text-slate-800"
      style={{ fontFamily: `'${font}', serif`, fontSize: size }}
      title={text}
    >
      {text}
    </p>
  )
}

/**
 * The bundled illustrations of the cards and access pages are drawn in the
 * original blue. When the brand colour moves away from it, offer to tint them.
 */
function IllustrationsHint() {
  const { doc, base, update } = useEditor()
  const recoloured = doc.theme.primary !== base.theme.primary
  const untinted = [
    doc.translator.rightCard.image && !doc.translator.rightCard.tint,
    (doc.authPages.loginImage || doc.authPages.formsImage) && !doc.authPages.tint,
  ].some(Boolean)
  if (!recoloured || !untinted) return null
  return (
    <Callout tone="warn">
      <p>
        Las ilustraciones de la tarjeta de traducción y de las páginas de acceso siguen en el color original.
        Puedes teñirlas con el nuevo color o subir otras en «Tarjetas y textos» y «Páginas de acceso».
      </p>
      <div className="mt-2">
        <MiniButton
          icon={Sparkles}
          onClick={() => {
            update("translator.rightCard.tint", true)
            update("authPages.tint", true)
          }}
        >
          Teñir ilustraciones
        </MiniButton>
      </div>
    </Callout>
  )
}

export function AppearanceSection() {
  const { doc, update } = useEditor()
  const theme = doc.theme
  const landing = theme.landing
  const [quick, setQuick] = useState({ accent: landing.accent, night: landing.night, paper: landing.paper })

  // A sample in each landing language, so a font that lacks ŋ, ā or ꞌ shows it
  const samples = doc.landing.locales.map((locale) => ({
    label: locale.label,
    text: translate(doc.landing.hero.title, locale.code, doc.landing.defaultLocale),
  }))

  return (
    <>
      <Panel
        title="Color principal de la aplicación"
        description="Botones, tarjeta de traducción, selectores y páginas de acceso."
        actions={
          <MiniButton
            icon={Sparkles}
            onClick={() => {
              update("theme.primaryHover", mix(theme.primary, "#ffffff", 0.14))
              update("theme.primaryStrong", mix(theme.primary, "#000000", 0.14))
            }}
            title="Calcula el tono de «encima» y el tono oscuro a partir del color principal"
          >
            Derivar tonos
          </MiniButton>
        }
      >
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/60 p-3">
          <span className="rounded-full px-4 py-1.5 text-sm font-semibold" style={{ background: theme.primary, color: theme.onPrimary }}>
            Traducir
          </span>
          <span className="rounded-full px-4 py-1.5 text-sm font-semibold" style={{ background: theme.primaryHover, color: theme.onPrimary }}>
            Al pasar el cursor
          </span>
          <span className="rounded-full px-4 py-1.5 text-sm font-semibold" style={{ background: theme.primaryStrong, color: theme.onPrimary }}>
            Presionado
          </span>
          <span
            className="rounded-full px-4 py-1.5 text-sm font-semibold"
            style={{ background: `${theme.primary}1a`, color: theme.primary }}
          >
            Secundario
          </span>
          <span className="rounded-md border-2 bg-white px-3 py-1 text-sm" style={{ borderColor: theme.line, color: theme.primary }}>
            Español
          </span>
        </div>
        <Grid>
          <ColorField path="theme.primary" label="Principal" />
          <ColorField
            path="theme.onPrimary"
            label="Texto sobre el principal"
            contrastWith={theme.primary}
            contrastLabel="contraste"
          />
          <ColorField path="theme.primaryHover" label="Al pasar el cursor" />
          <ColorField path="theme.primaryStrong" label="Presionado / oscuro" />
          <ColorField path="theme.line" label="Bordes y líneas suaves" />
        </Grid>
        <IllustrationsHint />
      </Panel>

      <Panel
        title="Colores de la página de inicio"
        description="La portada y las secciones usan su propia paleta, más sobria."
      >
        <div className="rounded-lg border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-4">
          <p className="text-[13px] font-medium text-slate-700">Paleta rápida</p>
          <p className="mb-3 text-xs text-slate-500">
            Elige tres colores y se calculan los demás. Luego puedes ajustar cada uno.
          </p>
          <div className="flex flex-wrap items-end gap-3">
            {[
              ["accent", "Acento"],
              ["night", "Oscuro"],
              ["paper", "Claro"],
            ].map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 text-xs font-medium text-slate-600">
                <span className="relative h-8 w-10 overflow-hidden rounded-md border border-slate-300" style={{ background: quick[key] }}>
                  <input
                    type="color"
                    value={quick[key]}
                    onChange={(event) => setQuick({ ...quick, [key]: event.target.value })}
                    className="absolute inset-0 cursor-pointer opacity-0"
                  />
                </span>
                {label}
              </label>
            ))}
            <MiniButton icon={Sparkles} tone="primary" onClick={() => update("theme.landing", paletteFrom(quick))}>
              Generar paleta
            </MiniButton>
          </div>
        </div>
        {LANDING_TOKENS.map(({ group, tokens }) => (
          <div key={group}>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{group}</p>
            <Grid>
              {tokens.map(([token, label, against]) => (
                <ColorField
                  key={token}
                  path={`theme.landing.${token}`}
                  label={label}
                  contrastWith={against ? landing[against] : undefined}
                  contrastLabel={against ? "contraste" : undefined}
                />
              ))}
            </Grid>
          </div>
        ))}
      </Panel>

      <Panel title="Tipografía de la página de inicio" description="La aplicación del traductor mantiene su tipografía.">
        <Grid>
          <div className="space-y-2">
            <SelectField
              path="theme.fonts.display"
              label="Títulos"
              options={DISPLAY_FONTS.map((font) => ({ value: font.name, label: `${font.name} (${font.kind === "serif" ? "con serifa" : "sin serifa"})` }))}
            />
          </div>
          <div className="space-y-2">
            <SelectField
              path="theme.fonts.text"
              label="Textos"
              options={TEXT_FONTS.map((font) => ({ value: font.name, label: font.name }))}
            />
          </div>
        </Grid>
        <div className="space-y-1.5">
          <p className="text-xs text-slate-500">
            Revisa que los caracteres propios del idioma (ŋ, ā, ü, ꞌ…) se vean bien en cada muestra:
          </p>
          {samples.map((sample) => (
            <div key={sample.label} className="grid grid-cols-[4.5rem_1fr] items-center gap-2">
              <span className="text-[11px] font-medium text-slate-400">{sample.label}</span>
              <div className="min-w-0 space-y-1">
                <FontSample font={theme.fonts.display} text={sample.text} />
                <FontSample font={theme.fonts.text} text={sample.text} size={15} />
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </>
  )
}

// --------------------------------------------------------------- translator
function BackdropEditor({ path, title, backdropColor }) {
  return (
    <div className="space-y-4 rounded-lg border border-slate-200 p-4">
      <p className="text-[13px] font-semibold text-slate-800">{title}</p>
      <ImageField
        path={`${path}.image`}
        label="Ilustración de fondo"
        maxDimension={1800}
        aspect="aspect-[2/1]"
        backdrop={backdropColor}
      />
      <div className="flex flex-wrap gap-x-6 gap-y-4">
        <SegmentedField
          path={`${path}.fit`}
          label="Tamaño"
          options={[
            { value: "contain", label: "Completa" },
            { value: "cover", label: "Rellenar" },
          ]}
        />
        <SegmentedField
          path={`${path}.position`}
          label="Posición"
          options={[
            { value: "top", label: "Arriba" },
            { value: "center", label: "Centro" },
            { value: "bottom", label: "Abajo" },
          ]}
        />
      </div>
      <SliderField path={`${path}.opacity`} label="Opacidad" />
      <ToggleField
        path={`${path}.tint`}
        label="Teñir con el color de la tarjeta"
        hint="Cualquier foto o dibujo toma el color de la tarjeta; útil si cambias el color principal."
      />
    </div>
  )
}

function PlaceholdersEditor({ languages }) {
  const [value = {}, set] = useField("translator.placeholders")
  const entries = Object.entries(value)
  const nameOf = (code) => languages.find((lang) => lang.code === code)?.name || code
  const rename = (from, to) => {
    const next = {}
    entries.forEach(([code, text]) => (next[code === from ? to : code] = text))
    set(next)
  }
  const unused = languages.find((lang) => !(lang.code in value))
  return (
    <Field
      label="Texto de ayuda por idioma de origen"
      hint="Reemplaza el texto anterior cuando se escribe en ese idioma, por ejemplo en el propio idioma."
      path="translator.placeholders"
    >
      <div className="space-y-2">
        {entries.map(([code, text]) => (
          <div key={code} className="flex items-center gap-2">
            <select
              className={`${inputBase} w-56 shrink-0`}
              value={code}
              onChange={(event) => rename(code, event.target.value)}
              aria-label="Idioma"
            >
              <option value={code}>{nameOf(code)}</option>
              {languages
                .filter((lang) => !(lang.code in value))
                .map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.name}
                  </option>
                ))}
            </select>
            <input
              className={inputClass}
              value={text}
              onChange={(event) => set({ ...value, [code]: event.target.value })}
              aria-label={`Texto de ayuda en ${nameOf(code)}`}
            />
            <IconButton
              title="Quitar"
              danger
              onClick={() => {
                const next = { ...value }
                delete next[code]
                set(next)
              }}
            >
              <Trash2 className="h-4 w-4" />
            </IconButton>
          </div>
        ))}
        {unused && (
          <MiniButton icon={Plus} onClick={() => set({ ...value, [unused.code]: "" })}>
            Agregar idioma
          </MiniButton>
        )}
      </div>
    </Field>
  )
}

export function TranslatorSection() {
  const { languages } = useEditor()
  return (
    <>
      <Panel title="Al abrir el traductor" description="Idiomas seleccionados cuando alguien entra al traductor.">
        <Grid>
          <LanguageSelectField path="translator.defaultSource" label="Idioma de origen" languages={languages} />
          <LanguageSelectField path="translator.defaultTarget" label="Idioma de destino" languages={languages} />
        </Grid>
      </Panel>

      <Panel title="Tarjetas" description="Ilustraciones decorativas al fondo de las dos tarjetas del traductor.">
        <div className="grid gap-4 xl:grid-cols-2">
          <BackdropEditor path="translator.leftCard" title="Tarjeta izquierda (texto a traducir)" backdropColor="#ffffff" />
          <BackdropEditor
            path="translator.rightCard"
            title="Tarjeta derecha (traducción)"
            backdropColor="rgb(var(--brand))"
          />
        </div>
      </Panel>

      <Panel title="Textos del traductor">
        <I18nField path="translator.placeholder" label="Texto de ayuda en la caja de texto" />
        <PlaceholdersEditor languages={languages} />
        <I18nField path="translator.feedbackPrompt" label="Invitación a opinar (junto a los pulgares)" />
      </Panel>

      <Panel title="Aviso al entrar" description="Ventana que se muestra una vez al abrir el traductor.">
        <ToggleField path="translator.notice.enabled" label="Mostrar el aviso" />
        <I18nField path="translator.notice.title" label="Título" />
        <I18nField rich path="translator.notice.body" label="Mensaje" />
      </Panel>

      <Panel
        title="Mensajes del sistema"
        description="Se muestran cuando el despliegue exige iniciar sesión o está en mantenimiento."
      >
        <div className="grid gap-4 xl:grid-cols-2">
          <div className="space-y-4 rounded-lg border border-slate-200 p-4">
            <p className="text-[13px] font-semibold text-slate-800">Acceso restringido</p>
            <I18nField path="translator.restricted.title" label="Título" />
            <I18nField rich path="translator.restricted.body" label="Mensaje" />
            <I18nField path="translator.restricted.button" label="Botón" />
          </div>
          <div className="space-y-4 rounded-lg border border-slate-200 p-4">
            <p className="text-[13px] font-semibold text-slate-800">Mantenimiento</p>
            <I18nField path="translator.maintenance.title" label="Título" />
            <I18nField rich path="translator.maintenance.body" label="Mensaje" />
            <I18nField path="translator.maintenance.button" label="Botón" />
          </div>
        </div>
      </Panel>
    </>
  )
}

// --------------------------------------------------------- languages/features
function LanguageVisibility() {
  const { doc, update } = useEditor()
  const hidden = useMemo(() => new Set(doc.languages.hidden), [doc.languages.hidden])
  const renamed = doc.languages.renamed
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState("all")

  const rows = CATALOG.filter((lang) => {
    const name = renamed[lang.code] || lang.name
    const matches =
      !query ||
      name.toLowerCase().includes(query.toLowerCase()) ||
      lang.code.toLowerCase().includes(query.toLowerCase())
    if (!matches) return false
    if (filter === "visible") return !hidden.has(lang.code)
    if (filter === "hidden") return hidden.has(lang.code)
    return true
  }).sort((a, b) => (renamed[a.code] || a.name).localeCompare(renamed[b.code] || b.name))

  const setHidden = (codes, hide) => {
    const next = new Set(hidden)
    codes.forEach((code) => (hide ? next.add(code) : next.delete(code)))
    update("languages.hidden", CATALOG.map((lang) => lang.code).filter((code) => next.has(code)))
  }
  const setName = (lang, name) => {
    const next = { ...renamed }
    if (!name.trim() || name === lang.name) delete next[lang.code]
    else next[lang.code] = name
    update("languages.renamed", next)
  }

  return (
    <Field
      label="Idiomas del selector"
      hint="Oculta los idiomas que no quieres ofrecer y corrige sus nombres. Haz clic en un nombre para editarlo."
      path="languages.hidden"
      aside={
        <span className="text-xs text-slate-500">
          {CATALOG.length - hidden.size} de {CATALOG.length} visibles
        </span>
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[12rem] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            className={`${inputClass} pl-9`}
            placeholder="Buscar idioma o código"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <select className={inputBase} value={filter} onChange={(event) => setFilter(event.target.value)}>
          <option value="all">Todos</option>
          <option value="visible">Visibles</option>
          <option value="hidden">Ocultos</option>
        </select>
        <MiniButton icon={Eye} onClick={() => setHidden(rows.map((lang) => lang.code), false)}>
          Mostrar estos
        </MiniButton>
        <MiniButton icon={EyeOff} onClick={() => setHidden(rows.map((lang) => lang.code), true)}>
          Ocultar estos
        </MiniButton>
      </div>
      <div className="max-h-[420px] overflow-y-auto rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <tbody>
            {rows.map((lang) => {
              const isHidden = hidden.has(lang.code)
              return (
                <tr key={lang.code} className={`border-b border-slate-100 last:border-0 ${isHidden ? "bg-slate-50/70" : ""}`}>
                  <td className="w-10 px-3 py-1.5">
                    <input
                      type="checkbox"
                      checked={!isHidden}
                      onChange={(event) => setHidden([lang.code], !event.target.checked)}
                      aria-label={`Mostrar ${lang.name}`}
                      className="h-4 w-4 accent-[rgb(var(--brand))]"
                    />
                  </td>
                  <td className="py-1">
                    <input
                      className={`w-full rounded border border-transparent bg-transparent px-1.5 py-1 text-sm hover:border-slate-200 focus:border-default focus:bg-white focus:outline-none ${
                        isHidden ? "text-slate-400" : "text-slate-800"
                      } ${renamed[lang.code] ? "font-medium" : ""}`}
                      defaultValue={renamed[lang.code] || lang.name}
                      key={`${lang.code}-${renamed[lang.code] || ""}`}
                      onBlur={(event) => setName(lang, event.target.value)}
                      aria-label={`Nombre de ${lang.code}`}
                    />
                  </td>
                  <td className="w-40 px-3 py-1.5 text-right font-mono text-xs text-slate-400">{lang.code}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Field>
  )
}

export function LanguagesSection() {
  const { languages, doc } = useEditor()
  const variant = doc.languages.variantSelector
  return (
    <>
      <Panel title="Idiomas" description="Qué idiomas ofrece el selector del traductor y cómo se llaman.">
        <LanguageVisibility />
        <ListField
          path="languages.custom"
          label="Idiomas propios"
          hint="Idiomas o variantes que no están en el catálogo (por ejemplo, un dialecto nuevo). El código debe coincidir con el del modelo."
          summary={(item) => (item.name ? `${item.name} — ${item.code}` : item.code)}
          newItem={() => ({ code: "", name: "", writing: "Latn", dialect: null })}
          addLabel="Agregar idioma"
          renderItem={(path) => (
            <Grid>
              <TextField path={`${path}.name`} label="Nombre" />
              <TextField path={`${path}.code`} label="Código" placeholder="kun_Latn" hint="Formato del modelo: idioma_escritura[_dialecto]" />
              <TextField path={`${path}.writing`} label="Escritura" placeholder="Latn" />
              <TextField path={`${path}.dialect`} label="Dialecto (opcional)" />
            </Grid>
          )}
        />
        <CodesField
          path="languages.nativeCodes"
          label="Idioma de este traductor"
          hint="Códigos del idioma originario. Se usan para filtrar las sugerencias en «Explorar Datos»."
          languages={languages}
        />
      </Panel>

      <Panel
        title="Selector de variantes"
        description="Selectores de variante territorial y alfabeto (grafemario) sin salir del idioma, como en mapuzungun."
      >
        <ToggleField path="languages.variantSelector.enabled" label="Mostrar el selector" />
        {variant.enabled && (
          <>
            <Grid>
              <TextField
                path="languages.variantSelector.prefix"
                label="Código del idioma"
                placeholder="arn"
                hint="Aparece cuando el idioma elegido empieza con este código."
              />
              <TextField
                path="languages.variantSelector.sourceCode"
                label="Código sin variantes (idioma de origen)"
                placeholder="arn_Latn"
                hint="Si se indica, el idioma aparece una sola vez en la lista y como idioma de origen no distingue variantes; solo el de destino muestra los selectores. Vacío: ambos lados los muestran."
              />
            </Grid>
            <I18nField path="languages.variantSelector.label" label="Título del selector de alfabeto" placeholder="Grafemario" />
            <ListField
              path="languages.variantSelector.options"
              label="Alfabetos (grafemarios)"
              hint={`Cada código corresponde a la parte central del código del idioma: ${variant.prefix || "arn"}_<alfabeto>_<territorio>.`}
              summary={(item) => (item.label ? `${translate(item.label, "es")} — ${item.code}` : item.code)}
              newItem={() => ({ code: "", label: "" })}
              addLabel="Agregar alfabeto"
              renderItem={(path) => (
                <Grid>
                  <TextField path={`${path}.label`} label="Nombre" />
                  <TextField path={`${path}.code`} label="Código" placeholder="raguileo" />
                </Grid>
              )}
            />
            <I18nField
              path="languages.variantSelector.dialectLabel"
              label="Título del selector de territorio"
              placeholder="Variante territorial"
            />
            <ListField
              path="languages.variantSelector.dialects"
              label="Variantes territoriales"
              hint={`Cada código es la parte final del código del idioma: ${variant.prefix || "arn"}_<alfabeto>_<territorio>. Sin territorios, solo se muestra el selector de alfabeto.`}
              summary={(item) =>
                item.label
                  ? `${translate(item.label, "es")} — ${item.code} (${(item.writings || []).join(", ") || "todos los alfabetos"})`
                  : item.code
              }
              newItem={() => ({ code: "", label: "", writings: [] })}
              addLabel="Agregar territorio"
              renderItem={(path) => (
                <>
                  <Grid>
                    <TextField path={`${path}.label`} label="Nombre" />
                    <TextField path={`${path}.code`} label="Código" placeholder="nagche" />
                  </Grid>
                  <LinesField
                    path={`${path}.writings`}
                    label="Alfabetos que usa"
                    hint="Un código de alfabeto por línea. Vacío: todos los alfabetos de la lista."
                    rows={3}
                  />
                </>
              )}
            />
          </>
        )}
      </Panel>

      <Panel title="Voz e información de palabras" description="Funciones extra del traductor según el idioma.">
        <Callout tone="warn">
          Activar una función solo muestra sus botones. El modelo correspondiente (voz, transcripción) debe estar
          desplegado para ese idioma; si no, los usuarios verán un error.
        </Callout>
        <div className="space-y-4 rounded-lg border border-slate-200 p-4">
          <ToggleField path="features.tts.enabled" label="Lectura en voz alta (TTS)" hint="Botón de parlante en las tarjetas." />
          {doc.features.tts.enabled && (
            <CodesField path="features.tts.languages" label="Idiomas con voz" languages={languages} prefixes placeholder="rap" />
          )}
        </div>
        <div className="space-y-4 rounded-lg border border-slate-200 p-4">
          <ToggleField path="features.asr.enabled" label="Dictado por voz (ASR)" hint="Botón de micrófono y subida de audios." />
          {doc.features.asr.enabled && (
            <>
              <CodesField
                path="features.asr.languages"
                label="Idiomas que se pueden dictar"
                hint="Código exacto que espera el modelo de transcripción (por ejemplo spa_Latn)."
                languages={languages}
              />
              <CodesField
                path="features.asr.uploadLanguages"
                label="Idiomas de origen que permiten subir un audio"
                languages={languages}
                prefixes
              />
            </>
          )}
        </div>
        <div className="space-y-4 rounded-lg border border-slate-200 p-4">
          <ToggleField
            path="features.wordInformation.enabled"
            label="Información de palabras"
            hint="Resalta palabras con sinónimos o explicaciones (se cargan en «Administrar Palabras»)."
          />
          {doc.features.wordInformation.enabled && (
            <CodesField path="features.wordInformation.languages" label="Idiomas" languages={languages} prefixes />
          )}
        </div>
      </Panel>
    </>
  )
}

// ---------------------------------------------------------------- auth pages
export function AuthPagesSection() {
  return (
    <Panel
      title="Páginas de acceso"
      description="Ilustraciones de inicio de sesión, solicitud de acceso, recuperación de contraseña, invitación y perfil."
    >
      <ToggleField
        path="authPages.tint"
        label="Teñir las ilustraciones con el color principal"
        hint="Útil si cambias el color principal y las ilustraciones fueron dibujadas en otro color."
      />
      <Grid>
        <ImageField
          path="authPages.loginImage"
          label="Iniciar sesión"
          hint="Se dibuja sobre el color principal, a la izquierda y abajo."
          maxDimension={1800}
          backdrop="rgb(var(--brand))"
        />
        <ImageField
          path="authPages.formsImage"
          label="Solicitud de acceso, contraseña e invitación"
          hint="Mismo tratamiento que la anterior."
          maxDimension={1800}
          backdrop="rgb(var(--brand))"
        />
      </Grid>
      <ImageField
        path="authPages.profileImage"
        label="Fondo del perfil"
        hint="Foto a pantalla completa detrás de la tarjeta del perfil."
        maxDimension={2400}
        fit="cover"
      />
    </Panel>
  )
}

// ------------------------------------------------------- territory helper
/** The picture of a territory, painted like in the popup (the file is a mask). */
function TerritoryIconPreview({ icon }) {
  const url = `url(/images/territories/${icon}.svg)`
  return (
    <span
      aria-hidden
      className="block h-6 w-6 shrink-0 bg-slate-600"
      style={{ WebkitMask: `${url} center / contain no-repeat`, mask: `${url} center / contain no-repeat` }}
    />
  )
}

/** "Ayúdame a decidir": the popup next to the territory selector. */
export function TerritoryHelpSection() {
  const { doc } = useEditor()
  const variant = doc.languages.variantSelector
  const dialects = variant.dialects || []
  const cards = variant.territoryHelp || []
  const dialectName = (code) => {
    const dialect = dialects.find((d) => d.code === code)
    return dialect ? translate(dialect.label, "es") || code : code
  }
  return (
    <>
      {(!variant.enabled || dialects.length === 0) && (
        <Callout tone="warn">
          La ventana aparece junto al selector de territorio, que se configura en «Idiomas y funciones» (Selector de
          variantes). Mientras no haya territorios, no se muestra.
        </Callout>
      )}
      <Panel
        title="Territorios"
        description="Una tarjeta por territorio: qué significa su nombre, dónde está y sus comunas, que la búsqueda usa para sugerir el territorio. Solo se muestran los territorios que ofrece el selector."
      >
        <ListField
          path="languages.variantSelector.territoryHelp"
          label="Tarjetas"
          summary={(item) =>
            `${dialectName(item.code) || "Sin territorio"} — ${(item.comunas || []).length} ${
              (item.comunas || []).length === 1 ? "comuna" : "comunas"
            }`
          }
          thumbnail={(item) => <TerritoryIconPreview icon={item.icon} />}
          newItem={() => {
            const free = dialects.find((d) => !cards.some((card) => card.code === d.code))
            return { code: free?.code || "", icon: TERRITORY_ICONS[0].code, meaning: {}, where: {}, comunas: [] }
          }}
          addLabel="Agregar territorio"
          max={20}
          renderItem={(path) => (
            <>
              <Grid>
                <SelectField
                  path={`${path}.code`}
                  label="Territorio"
                  options={[
                    { value: "", label: "Elige un territorio" },
                    ...dialects.map((d) => ({ value: d.code, label: `${dialectName(d.code)} — ${d.code}` })),
                  ]}
                />
                <SelectField
                  path={`${path}.icon`}
                  label="Ícono"
                  options={TERRITORY_ICONS.map((icon) => ({ value: icon.code, label: icon.label }))}
                />
              </Grid>
              <I18nField path={`${path}.meaning`} label="Qué significa el nombre" placeholder="Gente que vive cerca del mar" />
              <I18nField
                path={`${path}.where`}
                label="Dónde está (opcional)"
                hint="Se muestra bajo el significado en pantallas medianas y grandes."
              />
              <LinesField
                path={`${path}.comunas`}
                label="Comunas"
                hint="Una por línea. La búsqueda no distingue tildes ni mayúsculas; agrega otras formas de escribir un nombre (Cholchol, Chol Chol) en líneas aparte."
                rows={8}
              />
            </>
          )}
        />
      </Panel>

      <Panel
        title="Textos de la ventana"
        description="Vacío: se usa el texto predeterminado, que aparece en gris. Lo que escribas reemplaza el predeterminado en ese idioma."
      >
        <UiTextField uiKey="territoryHelp.open" label="Opción en el selector de territorio" />
        <UiTextField uiKey="territoryHelp.title" label="Título" />
        <UiTextField uiKey="territoryHelp.intro" label="Introducción" multiline rows={3} />
        <UiTextField uiKey="territoryHelp.search" label="Pregunta de la búsqueda" />
        <UiTextField uiKey="territoryHelp.searchHint" label="Ejemplo en el buscador" />
        <UiTextField uiKey="territoryHelp.notFound" label="Comuna no encontrada" />
        <UiTextField
          uiKey="territoryHelp.belongs"
          label="Comuna encontrada"
          hint="{place} se reemplaza por la comuna y {territory} por el territorio."
        />
        <UiTextField uiKey="territoryHelp.use" label="Botón para usar el territorio" hint="{territory} se reemplaza por el territorio." />
        <UiTextField uiKey="territoryHelp.pick" label="Botón sin territorio elegido" />
      </Panel>
    </>
  )
}
