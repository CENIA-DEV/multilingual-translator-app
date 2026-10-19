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

import { cssUrl } from "./media"

/**
 * Decorative illustration behind a translator card.
 *
 * Rendered as its own layer (z-index -1 inside the card's stacking context) so
 * opacity and tint never affect the card's content. With `tint`, the image is
 * blended in "luminosity" mode over the card colour: any photo or drawing
 * takes the brand colour, so an illustration does not have to be recoloured
 * by hand when the colour changes.
 */
export default function Backdrop({ backdrop, className = "" }) {
  const image = cssUrl(backdrop?.image)
  if (!image) return null
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 -z-10 ${className}`}
      style={{
        backgroundImage: image,
        backgroundRepeat: "no-repeat",
        backgroundSize: backdrop.fit || "contain",
        backgroundPosition: `center ${backdrop.position || "bottom"}`,
        opacity: (backdrop.opacity ?? 100) / 100,
        mixBlendMode: backdrop.tint ? "luminosity" : undefined,
        // follow the card's rounded corners, like a background would
        borderRadius: "inherit",
      }}
    />
  )
}
