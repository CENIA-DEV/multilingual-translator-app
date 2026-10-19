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

// Server-side loading of the published customization (import it from server
// components only), so the first HTML a visitor receives already has the right
// colours, texts and images -- no flash of the preset while the browser
// fetches the document.
//
// The document is cached in this process for FRESH_MS and refreshed in the
// background after that (stale-while-revalidate): page renders never wait on
// the backend once the cache is warm. If the backend cannot be reached the
// preset is used and the browser fetches the document itself after hydration
// (ConfigProvider), with further server attempts backed off for RETRY_MS so a
// down backend does not slow down every render.
//
// CONFIG_API_URL can point the server at an internal backend address; by
// default it uses the same public URL as the browser.

const API_BASE = (process.env.CONFIG_API_URL || process.env.NEXT_PUBLIC_API_URL || "").replace(
  /\/+$/,
  ""
)
const FRESH_MS = 30_000
const RETRY_MS = 30_000
const TIMEOUT_MS = 2_500

let cache = null // { stored, version, at }
let inflight = null
let failedAt = 0

async function fetchPublished() {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const response = await fetch(`${API_BASE}/api/customization/config/`, {
      cache: "no-store",
      signal: controller.signal,
      headers: { Accept: "application/json" },
    })
    if (!response.ok) throw new Error(`config ${response.status}`)
    const body = await response.json()
    // `access`: the rules the API enforces, in place of the document's own
    cache = { stored: body.config ?? null, version: body.version ?? 0, access: body.access ?? null, at: Date.now() }
    failedAt = 0
    return cache
  } catch (error) {
    failedAt = Date.now()
    console.warn(`[customization] could not load the published config: ${error.message}`)
    return null
  } finally {
    clearTimeout(timer)
  }
}

function refresh() {
  if (!inflight) {
    inflight = fetchPublished().finally(() => {
      inflight = null
    })
  }
  return inflight
}

/**
 * The stored (published) document for this render.
 * Returns { stored, version, source } where source is "server" when the
 * document came from the backend and "fallback" when the preset must be used.
 */
export async function loadPublishedConfig() {
  if (!API_BASE) return { stored: null, version: 0, source: "fallback" }

  const now = Date.now()
  if (cache) {
    if (now - cache.at > FRESH_MS && now - failedAt > RETRY_MS) refresh()
    return { stored: cache.stored, version: cache.version, access: cache.access, source: "server" }
  }
  if (now - failedAt < RETRY_MS) return { stored: null, version: 0, source: "fallback" }

  const loaded = await refresh()
  return loaded
    ? { stored: loaded.stored, version: loaded.version, access: loaded.access, source: "server" }
    : { stored: null, version: 0, source: "fallback" }
}

/** Drop the cached document (after a publish) so the next render refetches. */
export function invalidatePublishedConfig() {
  cache = null
  failedAt = 0
}
