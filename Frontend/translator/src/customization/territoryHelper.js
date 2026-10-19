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

// Content of the "Ayúdame a decidir" popup next to the territory selector:
// what each territory is and where it lies, so a speaker who knows where they
// live (or where their family is from) can find their variant.
//
// DRAFT: the descriptions and the comunas below follow the commonly cited
// association of each fütal mapu with its land, and must be reviewed by the
// Instituto Aukiñ Mapu before they are published. The borders are not sharp:
// a comuna listed under one territory can have communities of another.
// The `arn` texts are Spanish for now, until their Mapuzungun translations.

/** Territories by the variant selector's codes, from the sea to the mountains. */
export const TERRITORY_HELP = {
  arn: [
    {
      code: "lafkenche",
      icon: "sea",
      meaning: { es: "Gente del mar", en: "People of the sea", arn: "Gente del mar" },
      where: {
        es: "La costa, desde Arauco hasta Toltén y el norte de Los Ríos",
        en: "The coast, from Arauco to Toltén and northern Los Ríos",
        arn: "La costa, desde Arauco hasta Toltén y el norte de Los Ríos",
      },
      comunas: [
        "Arauco", "Lebu", "Los Álamos", "Cañete", "Contulmo", "Tirúa",
        "Carahue", "Saavedra", "Puerto Saavedra", "Teodoro Schmidt", "Toltén", "Mariquina",
      ],
    },
    {
      code: "nagche",
      icon: "hills",
      meaning: { es: "Gente de las tierras bajas", en: "People of the lowlands", arn: "Gente de las tierras bajas" },
      where: {
        es: "Las lomas y valles junto a la cordillera de Nahuelbuta",
        en: "The hills and valleys by the Nahuelbuta range",
        arn: "Las lomas y valles junto a la cordillera de Nahuelbuta",
      },
      comunas: [
        "Purén", "Lumaco", "Los Sauces", "Traiguén", "Galvarino", "Cholchol", "Chol Chol",
        "Ercilla", "Collipulli", "Angol",
      ],
    },
    {
      code: "wenteche",
      icon: "sun",
      meaning: { es: "Gente de los llanos altos", en: "People of the high plains", arn: "Gente de los llanos altos" },
      where: {
        es: "El valle central, alrededor de Temuco",
        en: "The central valley, around Temuco",
        arn: "El valle central, alrededor de Temuco",
      },
      comunas: [
        "Temuco", "Padre Las Casas", "Nueva Imperial", "Lautaro", "Perquenco", "Victoria",
        "Vilcún", "Freire", "Cunco", "Pitrufquén", "Gorbea",
      ],
    },
    {
      code: "pewenche",
      icon: "araucaria",
      meaning: { es: "Gente del pewen (la araucaria)", en: "People of the pewen (monkey puzzle tree)", arn: "Gente del pewen (la araucaria)" },
      where: {
        es: "La cordillera de los Andes, entre araucarias y volcanes",
        en: "The Andes, among monkey puzzle trees and volcanoes",
        arn: "La cordillera de los Andes, entre araucarias y volcanes",
      },
      comunas: [
        "Alto Biobío", "Santa Bárbara", "Lonquimay", "Curacautín", "Melipeuco", "Curarrehue",
      ],
    },
    {
      code: "williche",
      icon: "south",
      meaning: { es: "Gente del sur", en: "People of the south", arn: "Gente del sur" },
      where: {
        es: "Los Ríos, Los Lagos y Chiloé",
        en: "Los Ríos, Los Lagos and Chiloé",
        arn: "Los Ríos, Los Lagos y Chiloé",
      },
      comunas: [
        "Valdivia", "La Unión", "Río Bueno", "Lago Ranco", "Osorno", "San Juan de la Costa",
        "San Pablo", "Río Negro", "Purranque", "Puerto Montt", "Ancud", "Castro", "Chonchi",
        "Quellón", "Queilén", "Dalcahue", "Quemchi", "Chiloé",
      ],
    },
  ],
}

/** Comparable form of a place name: no accents, case or extra spaces. */
export const placeKey = (text) =>
  String(text || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
