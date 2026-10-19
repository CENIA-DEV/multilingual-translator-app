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

// Finds every translatable text of the landing page, for the translation
// workbench and the "x pending" counters.

const LOCALE_KEY = /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})?$/
// Objects of the landing page that are not translations
const NOT_I18N = new Set(["focalPoint"])

function isI18n(value, key) {
  if (NOT_I18N.has(key)) return false
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false
  const keys = Object.keys(value)
  return keys.every((k) => LOCALE_KEY.test(k) && (typeof value[k] === "string" || value[k] === null))
}

export function collectTexts(landing) {
  const found = []
  const walk = (node, path, key) => {
    if (isI18n(node, key)) {
      found.push({ path, value: node, rich: /\.about\.items\.\d+\.text$/.test(path) })
      return
    }
    if (Array.isArray(node)) {
      // locales are {code, label} pairs, not translations
      if (key === "locales" || key === "sections" || key === "pins" || key === "names") return
      node.forEach((item, index) => walk(item, `${path}.${index}`, String(index)))
    } else if (node && typeof node === "object") {
      Object.entries(node).forEach(([k, v]) => walk(v, `${path}.${k}`, k))
    }
  }
  walk(landing, "landing", "landing")
  return found
}

const filled = (value) => typeof value === "string" && value.replace(/<br>/g, "").trim() !== ""

export function translationStats(landing) {
  const texts = collectTexts(landing).filter((text) => filled(text.value[landing.defaultLocale]))
  return landing.locales.map((locale) => {
    const done = texts.filter((text) => filled(text.value[locale.code])).length
    return { ...locale, done, total: texts.length }
  })
}

const GROUPS = {
  header: "Encabezado",
  hero: "Portada",
  about: "Acerca del proyecto",
  items: "",
  validation: "Mapa de validación",
  focus: "Nuestro enfoque",
  owners: "Proyecto",
  partners: "Institución",
  developer: "Desarrollador",
  collaborators: "Colaboradores",
  groups: "Grupo",
  funding: "Financiamiento",
  contact: "Contacto",
  form: "Formulario",
  footer: "Pie de página",
}

const FIELDS = {
  title: "Título",
  subtitle: "Bajada",
  text: "Texto",
  name: "Nombre",
  caption: "Leyenda",
  logoAlt: "Descripción del logo",
  brandTitle: "Nombre junto al logo",
  selectLanguageLabel: "Selector de idioma (celular)",
  imageAlt: "Descripción de la foto",
  primaryCta: "Botón principal",
  secondaryCta: "Botón secundario",
  developedByLabel: "«Desarrollado por»",
  mapLabel: "Descripción del mapa",
  label: "Título",
  button: "Botón",
  description: "Instrucción",
  firstName: "Campo nombre",
  lastName: "Campo apellido",
  email: "Campo correo",
  organization: "Campo organización",
  optional: "Marca opcional",
  message: "Campo mensaje",
  submit: "Botón enviar",
  successTitle: "Aviso de éxito",
  successBody: "Detalle del éxito",
  errorTitle: "Aviso de error",
  errorBody: "Detalle del error",
}

export function labelForPath(path) {
  const parts = path.split(".").slice(1)
  const out = []
  parts.forEach((part, index) => {
    if (/^\d+$/.test(part)) {
      const previous = parts[index - 1]
      const noun = { items: "Elemento", partners: "Institución", groups: "Grupo" }[previous] || "Elemento"
      out.push(`${noun} ${Number(part) + 1}`)
    } else if (index === parts.length - 1) {
      out.push(FIELDS[part] || part)
    } else if (GROUPS[part]) {
      out.push(GROUPS[part])
    }
  })
  return out.join(" · ")
}

/** Editor section that holds a landing path, for "go to field" links. */
export function sectionForPath(path) {
  const segment = path.split(".")[1]
  return (
    {
      header: "hero",
      hero: "hero",
      about: "about",
      validation: "validation",
      focus: "focus",
      owners: "owners",
      developer: "owners",
      collaborators: "collaborators",
      funding: "funding",
      contact: "contact",
      footer: "contact",
    }[segment] || "structure"
  )
}
