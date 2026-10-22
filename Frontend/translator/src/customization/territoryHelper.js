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

// "Ayúdame a decidir", the popup next to the territory selector: what each
// territory is and where it lies, so a speaker who knows where they live (or
// where their family is from) can find their variant.
//
// Its territories -- what each name means, where it lies, its comunas -- are
// languages.variantSelector.territoryHelp in the customization document,
// edited in Administrar Traductor > "Ayúdame a decidir" (the preset has the
// defaults); its fixed texts are the "territoryHelp.*" messages, overridden in
// the document's `ui` map from the same section.
//
// The arn preset's content follows the commonly cited association of each
// fütal mapu with its land, to be reviewed by the Instituto Aukiñ Mapu; its
// `arn` texts are by Flor (Instituto Aukiñ Mapu). The borders are not sharp:
// a comuna listed under one territory can have communities of another.

/** Pictures in /public/images/territories, offered by the editor. */
export const TERRITORY_ICONS = [
  { code: "lafkenche", label: "Mar (lafkenche)" },
  { code: "nagche", label: "Lomas y valle (nagche)" },
  { code: "wenteche", label: "Llanos (wenteche)" },
  { code: "pewenche", label: "Araucaria y cordillera (pewenche)" },
  { code: "williche", label: "Bosque y lluvia (williche)" },
]

/** Comparable form of a place name: no accents, case or extra spaces. */
export const placeKey = (text) =>
  String(text || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
