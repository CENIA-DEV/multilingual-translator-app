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
'use client'

import { useConfig } from '@/customization/ConfigProvider';
import { useLanguageSides, variantParts } from '@/customization/languages';
import { translate } from '@/customization/i18n';

/** The side of a pair in the translator's own language with variants, or null. */
export function variantSide(pair, prefix) {
  if (!pair || !prefix) return null;
  const inFamily = (lang) => lang?.code?.split('_')[0] === prefix && lang.code !== `${prefix}_Latn`;
  if (inFamily(pair.dst_lang)) return 'dst_lang';
  if (inFamily(pair.src_lang)) return 'src_lang';
  return null;
}

/** The labels of a variant code: { territory, writing } (null when absent). */
export function labelsOf(code) {
  const { writing, dialect } = variantParts(code);
  return { territory: dialect || null, writing: writing || null };
}

/**
 * Territory, alphabet and comuna of a suggestion, for administrators in
 * "Explorar datos". Feedback saved before the territory selector has no
 * territory ("sin definir") until one is chosen here.
 */
export default function SuggestionLabels({ value, onChange }) {
  const { variantSelector } = useConfig().languages;
  const sides = useLanguageSides();
  const writings = sides.writingsFor(value.territory);
  const field = "h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm outline-none focus:border-default";
  const label = "text-xs font-semibold text-slate-600";

  const setTerritory = (territory) => {
    // keep the alphabet when the territory uses it, else its first one
    const allowed = sides.writingsFor(territory).map((option) => option.code);
    onChange({ ...value, territory, writing: allowed.includes(value.writing) ? value.writing : allowed[0] || value.writing });
  };

  return (
    <div className="grid w-full grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:grid-cols-3">
      <label className="flex flex-col gap-1">
        <span className={label}>{translate(variantSelector.dialectLabel, 'es')}</span>
        <select className={field} value={value.territory || ''} onChange={(e) => setTerritory(e.target.value || null)}>
          {!value.territory && <option value="">Sin definir</option>}
          {sides.dialects.map((option) => (
            <option key={option.code} value={option.code}>{translate(option.label, 'es')}</option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className={label}>{translate(variantSelector.label, 'es')}</span>
        <select className={field} value={value.writing || ''} onChange={(e) => onChange({ ...value, writing: e.target.value })}>
          {(value.territory ? writings : variantSelector.options).map((option) => (
            <option key={option.code} value={option.code}>{translate(option.label, 'es')}</option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className={label}>Comuna</span>
        <input
          className={field}
          value={value.commune || ''}
          maxLength={100}
          placeholder="Sin definir"
          onChange={(e) => onChange({ ...value, commune: e.target.value })}
        />
      </label>
    </div>
  );
}
