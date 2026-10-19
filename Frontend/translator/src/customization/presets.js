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

// The built-in documents. Imported by the root layout (server) and by the
// editor; regular pages receive the resolved document from the layout.

import { resolveWith } from "./config"
import rap from "./presets/rap.json"
import arn from "./presets/arn.json"
import generic from "./presets/generic.json"

export const PRESETS = { rap, arn, generic }

export const PRESET_LABELS = {
  rap: "Rapa Nui (traductor rapa nui - español)",
  arn: "Mapuzungun (traductor mapuzungun - español)",
  generic: "Plantilla neutra para un idioma nuevo",
}

export const VARIANT = process.env.NEXT_PUBLIC_VARIANT

export function presetFor(variant = VARIANT) {
  return PRESETS[variant] || PRESETS.generic
}

/** The document to render: the stored one (if any) over this deployment's preset. */
export function resolveConfig(stored, variant = VARIANT) {
  return resolveWith(presetFor(variant), stored)
}
