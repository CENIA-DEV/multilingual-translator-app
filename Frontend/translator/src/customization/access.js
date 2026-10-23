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

// Who may use each feature ("Visibilidad" in Administrar Traductor). The API
// enforces these rules (customization/access.py); here they only decide what
// to show, so the two always read the same rules: the backend reports the ones
// in force with the published document, and they replace the preset's.

import { useMemo } from "react"
import { useConfig } from "./ConfigProvider"

/** Features with a rule, as in the editor, with their Spanish names there. */
export const ACCESS_FEATURES = [
  ["translatorPage", "Página del traductor"],
  ["translation", "Traducir"],
  ["tts", "Escuchar la traducción (voz)"],
  ["separateGenders", "Voces masculina y femenina"],
  ["asr", "Dictar por voz"],
  ["wordInformation", "Información de palabras"],
  ["suggestions", "Enviar sugerencias"],
]

/** The roles a rule can name (the top-tier admins may always). */
export const ACCESS_ROLES = [
  ["NativeAdmin", "Administrador"],
  ["Annotator", "Anotador"],
  ["Native", "Hablante"],
  ["User", "Usuario"],
]

/** Whether `user` (the logged-in user, or null) may use `feature`. */
export function canUse(access, feature, user) {
  if (user?.can_manage_translator) return true
  const rule = access?.[feature]
  if (!rule || rule.level === "public") return true
  if (!user) return false
  if (rule.level === "login") return true
  return (rule.roles || []).includes(user?.profile?.role)
}

/** The rules for `user`: can(feature), and whether logging in would help. */
export function useAccess(user) {
  const { access } = useConfig()
  return useMemo(
    () => ({
      can: (feature) => canUse(access, feature, user || null),
      // a visitor kept out only for not being logged in (not for a role)
      needsLogin: (feature) => !user && access?.[feature]?.level === "login",
      maintenance: Boolean(access?.maintenance),
      maxWords: access?.maxWordsTranslation || 150,
      rule: (feature) => access?.[feature] || { level: "public", roles: [] },
    }),
    [access, user]
  )
}
