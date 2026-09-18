/* Copyright 2024 Centro Nacional de Inteligencia Artificial (CENIA, Chile). All rights reserved.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

     http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License. */
'use client'

import './langExtraSelector.css'
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useConfig } from "@/customization/ConfigProvider";
import { findLanguage, prefixOf, useLanguageList } from "@/customization/languages";

// Writing-system ("Grafemario") switch for languages whose codes encode the
// variant, e.g. arn_a0_n / arn_r0_n / arn_u0_n: Mapuzungun in the Azümchefe,
// Raguileo or Unificado alphabet, Nguluche dialect. Which language prefix gets
// it, its label and its options come from "Idiomas y funciones" in
// Administrar Traductor.
export default function LangExtraSelector({ lang, side, handleLangChange }) {
  const { variantSelector } = useConfig().languages;
  const languageList = useLanguageList();
  const prefix = prefixOf(lang?.code);

  if (!variantSelector.enabled || !prefix || prefix !== variantSelector.prefix) {
    return null;
  }

  const selectVariant = (variant) => {
    const code = lang.dialect ? `${prefix}_${variant}_${lang.dialect}` : `${prefix}_${variant}`;
    const next = findLanguage(languageList, code);
    if (next && next.code !== lang.code) {
      handleLangChange(next);
    }
  };

  return (
    <div className="lang-selector">
      <span className={`ml-3 font-semibold ${side === 'left' ? "text-default" : "text-white"}`}>
        {variantSelector.label}
      </span>

      <Tabs value={lang.writing} className="w-fit bg-gray-400 p-[1.5px] rounded-[25px]">
        <TabsList className="flex rounded-[25px] bg-gray-50 ">
          {variantSelector.options.map((option) => (
            <TabsTrigger
              className="rounded-[25px] font-semibold text-gray-400"
              key={option.code}
              value={option.code}
              onClick={() => selectVariant(option.code)}
            >
              {option.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </div>
  );
}
