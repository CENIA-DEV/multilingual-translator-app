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

import Image from "next/image"

// Images in the document are one of:
//   "/images/rap-white.png"   a file bundled in /public (the presets use these)
//   "asset:<uuid>"            a file uploaded from the editor, served by the API
//   "https://..."             an external image
//   ""                        no image
// The "asset:" form keeps the document independent of the API host, so the
// same document works on staging and production.

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/+$/, "")

export function resolveMedia(ref) {
  if (!ref) return null
  if (ref.startsWith("asset:")) {
    return `${API_BASE}/api/customization/assets/${ref.slice("asset:".length)}/`
  }
  return ref
}

const isOptimizable = (src) =>
  src.startsWith("/") && !src.startsWith("//") && !/\.(svg|ico)$/i.test(src)

/**
 * next/image for bundled files (resized and optimised at request time),
 * unoptimized for uploads and external URLs -- the editor already compresses
 * uploads, and their hosts are not in next.config's allow-list.
 */
export function MediaImage({ src: ref, alt = "", ...props }) {
  const src = resolveMedia(ref)
  if (!src) return null
  return <Image src={src} alt={alt} unoptimized={!isOptimizable(src)} {...props} />
}

/** "url(...)" for inline backgrounds, or undefined when there is no image. */
export function cssUrl(ref) {
  const src = resolveMedia(ref)
  return src ? `url("${src.replace(/"/g, "%22")}")` : undefined
}
