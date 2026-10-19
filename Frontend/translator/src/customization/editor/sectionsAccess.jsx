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

// "Visibilidad": who may use each feature, maintenance mode and the word
// limit. Only the top-tier admins reach the editor; the API enforces what is
// published here (customization/access.py), the site only shows it.

import { ACCESS_FEATURES, ACCESS_ROLES } from "../access"
import { Callout, NumberField, Panel, SegmentedField, ToggleField, useField } from "./fields"

const LEVELS = [
  { value: "public", label: "Público" },
  { value: "login", label: "Con sesión iniciada" },
  { value: "roles", label: "Solo algunos roles" },
]

const HINTS = {
  translatorPage: "Quien no tenga acceso a la página tampoco puede usar sus funciones.",
  translation: "Escribir un texto y traducirlo.",
  tts: "El botón para escuchar la traducción.",
  separateGenders: "Elegir entre voz masculina y femenina al escuchar.",
  asr: "Dictar o subir un audio para transcribirlo.",
  wordInformation: "Las palabras destacadas con su explicación.",
}

function RolesField({ path }) {
  const [roles = [], set] = useField(path)
  const toggle = (role) => set(roles.includes(role) ? roles.filter((r) => r !== role) : [...roles, role])
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {ACCESS_ROLES.map(([role, label]) => (
          <label
            key={role}
            className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
              roles.includes(role) ? "border-default bg-default/10 text-default" : "border-slate-200 text-slate-600 hover:border-slate-300"
            }`}
          >
            <input type="checkbox" className="accent-[rgb(var(--brand))]" checked={roles.includes(role)} onChange={() => toggle(role)} />
            {label}
          </label>
        ))}
      </div>
      {!roles.length && (
        <p className="text-xs text-amber-700">Sin roles elegidos: solo el equipo técnico del sitio tendrá acceso.</p>
      )}
    </div>
  )
}

function FeatureRule({ feature, label }) {
  const [level] = useField(`access.${feature}.level`)
  return (
    <div className="space-y-3 rounded-lg border border-slate-200 p-4">
      <SegmentedField path={`access.${feature}.level`} label={label} hint={HINTS[feature]} options={LEVELS} />
      {level === "roles" && <RolesField path={`access.${feature}.roles`} />}
    </div>
  )
}

export function AccessSection() {
  return (
    <>
      <Panel
        title="Visibilidad"
        description="Quién puede usar cada parte del traductor. El servidor aplica estas reglas en cuanto se publican; el sitio solo muestra lo que cada persona puede usar."
      >
        <Callout tone="info">
          El equipo técnico del sitio siempre tiene acceso a todo, para poder probar lo que restringe. Las páginas de
          administración (accesos, datos, palabras y este editor) no cambian aquí: siguen siendo solo para sus roles.
        </Callout>
        {ACCESS_FEATURES.map(([feature, label]) => (
          <FeatureRule key={feature} feature={feature} label={label} />
        ))}
      </Panel>
      <Panel title="Operación" description="Ajustes generales del traductor.">
        <ToggleField
          path="access.maintenance"
          label="Modo mantenimiento"
          hint="Muestra el aviso de mantenimiento al abrir el traductor (su texto está en «Tarjetas y textos»)."
        />
        <NumberField
          path="access.maxWordsTranslation"
          label="Máximo de palabras por traducción"
          hint="Un texto más largo se recorta; el servidor rechaza los que lo superen."
          min={1}
          max={2000}
          suffix="palabras"
        />
      </Panel>
    </>
  )
}
