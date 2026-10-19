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
import { translate } from '@/customization/i18n';

/**
 * The territories and alphabets a word belongs to, for a language with
 * variants (the variant selector of "Idiomas y funciones"). Several of each
 * can be chosen; none means the word isn't labelled.
 */
export function useVariantOptions() {
  const { variantSelector } = useConfig().languages;
  if (!variantSelector?.enabled) return null;
  const territories = (variantSelector.dialects || []).map((d) => ({ code: d.code, label: translate(d.label, 'es') }));
  const writings = (variantSelector.options || []).map((o) => ({ code: o.code, label: translate(o.label, 'es') }));
  if (!territories.length && !writings.length) return null;
  return {
    territories,
    writings,
    territoryLabel: translate(variantSelector.dialectLabel, 'es') || 'Variante territorial',
    writingLabel: translate(variantSelector.label, 'es') || 'Grafemario',
  };
}

function ChipGroup({ title, options, value, onChange }) {
  const toggle = (code) => onChange(value.includes(code) ? value.filter((c) => c !== code) : [...value, code]);
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-semibold text-gray-700">{title}</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => {
          const on = value.includes(option.code);
          return (
            <button
              key={option.code}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(option.code)}
              className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                on ? 'border-[#0092d8] bg-[#0092d8] text-white' : 'border-gray-300 bg-white text-gray-600 hover:border-[#0092d8]'
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Pickers for both lists; `value` is { territories, writings }. */
export function VariantLabelsPicker({ options, value, onChange }) {
  return (
    <div className="grid w-full gap-3 md:grid-cols-2">
      {options.territories.length > 0 && (
        <ChipGroup
          title={options.territoryLabel}
          options={options.territories}
          value={value.territories}
          onChange={(territories) => onChange({ ...value, territories })}
        />
      )}
      {options.writings.length > 0 && (
        <ChipGroup
          title={options.writingLabel}
          options={options.writings}
          value={value.writings}
          onChange={(writings) => onChange({ ...value, writings })}
        />
      )}
    </div>
  );
}

/** A word's labels, read-only, in the list. */
export function VariantLabelsView({ options, word }) {
  const name = (list, code) => list.find((o) => o.code === code)?.label || code;
  const territories = word.territories || [];
  const writings = word.writings || [];
  if (!territories.length && !writings.length) {
    return <p className="mt-1 text-xs italic text-gray-400">Todas las variantes</p>;
  }
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {territories.map((code) => (
        <span key={`t-${code}`} className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800 border border-emerald-200">
          {name(options.territories, code)}
        </span>
      ))}
      {writings.map((code) => (
        <span key={`w-${code}`} className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800 border border-amber-200">
          {name(options.writings, code)}
        </span>
      ))}
    </div>
  );
}
