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

import api from "@/app/api"

// Endpoints of Backend/translatorapp_v2/customization (see views.py there).
const BASE = "api/customization/"

export const fetchDraft = () => api.get(`${BASE}draft/`).then((r) => r.data)

export const saveDraft = (config, baseVersion) =>
  api.put(`${BASE}draft/`, { config, baseVersion }).then((r) => r.data)

export const publishDraft = (config, baseVersion, note) =>
  api.post(`${BASE}publish/`, { config, baseVersion, note }).then((r) => r.data)

export const discardDraft = (baseVersion) =>
  api.post(`${BASE}discard/`, { baseVersion }).then((r) => r.data)

export const fetchRevisions = () => api.get(`${BASE}revisions/`).then((r) => r.data)

export const fetchRevision = (id) => api.get(`${BASE}revisions/${id}/`).then((r) => r.data)

export const restoreRevision = (id, baseVersion) =>
  api.post(`${BASE}revisions/${id}/restore/`, { baseVersion }).then((r) => r.data)

export const fetchAssets = (kind) =>
  api.get(`${BASE}assets/`, { params: kind ? { kind } : {} }).then((r) => r.data)

export function uploadAsset(file) {
  const form = new FormData()
  form.append("file", file, file.name || "archivo")
  return api.post(`${BASE}assets/`, form).then((r) => r.data)
}

/** Ask this Next server to drop its cached copy of the published document. */
export const refreshSiteCache = () =>
  fetch("/manage-translator/revalidate", { method: "POST" }).catch(() => {})

/** A readable message from an API error. */
export function errorMessage(error, fallback = "No se pudo completar la acción.") {
  const data = error?.response?.data
  if (typeof data?.detail === "string") return data.detail
  if (!error?.response) return "No hay conexión con el servidor."
  return fallback
}
