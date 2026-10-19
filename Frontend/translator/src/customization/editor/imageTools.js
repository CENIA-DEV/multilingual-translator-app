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

// Photos straight from a camera are 5-15 MB; the site never shows them wider
// than ~2400 px. Resize and re-encode as WebP in the browser before upload so
// uploads are fast, the database stays small and pages load quickly. Logos
// keep their transparency (WebP has alpha). SVG, GIF and ICO go up untouched.

const RESIZABLE = /^image\/(png|jpeg|webp)$/

export async function prepareImage(file, maxDimension = 2400) {
  if (!RESIZABLE.test(file.type) || typeof createImageBitmap !== "function") return file
  let bitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    return file
  }
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height))
  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  canvas.getContext("2d").drawImage(bitmap, 0, 0, width, height)
  bitmap.close?.()

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/webp", 0.86))
  // Browsers without WebP encoding hand back a PNG; keep whichever is smaller
  if (!blob || blob.type !== "image/webp") return file
  if (scale === 1 && blob.size >= file.size) return file
  const name = (file.name || "imagen").replace(/\.[^.]+$/, "") + ".webp"
  return new File([blob], name, { type: "image/webp" })
}

export const formatBytes = (bytes) => {
  if (!bytes && bytes !== 0) return ""
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

export async function dataUrlToFile(dataUrl, name) {
  const blob = await (await fetch(dataUrl)).blob()
  return new File([blob], name || "archivo", { type: blob.type })
}
