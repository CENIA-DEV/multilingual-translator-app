/* Copyright 2026 Centro Nacional de Inteligencia Artificial (CENIA, Chile). All rights reserved.

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

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useConfig } from '@/customization/ConfigProvider';
import { useLanguageSides } from '@/customization/languages';
import { translate } from '@/customization/i18n';
import { API_ENDPOINTS } from '../../constants.js';
import api from '../../api.js';

/**
 * How a language code reads in the CSV screens: the language, and for a
 * variant its territory and alphabet as the translator's selectors name them
 * ("Mapuzungun · Nagche · Raguileo"), so two variants never look alike.
 */
export function useLangLabel() {
  const sides = useLanguageSides();
  return useCallback((code) => {
    if (!code) return '';
    const lang = sides.languageFor(code);
    const variant = sides.variantOf(lang);
    const parts = [sides.displayLanguage(lang).name];
    if (variant) {
      if (variant.dialect) parts.push(translate(variant.dialect, 'es'));
      else if (sides.dialects.length > 0) parts.push('sin territorio');
      if (variant.writing) parts.push(translate(variant.writing, 'es'));
    }
    return parts.join(' · ');
  }, [sides]);
}

/**
 * The languages a CSV's codes can be mapped to: those the backend knows (it
 * refuses any other), the translator's own first, each with its label.
 */
export function useMappableLanguages() {
  const label = useLangLabel();
  const nativePrefixes = useConfig().languages.nativeCodes.map((code) => code.split('_')[0]);
  const prefixKey = nativePrefixes.join(',');
  const [codes, setCodes] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api.get(API_ENDPOINTS.LANGUAGES)
      .then((res) => { if (!cancelled) setCodes(res.data.map((lang) => ({ code: lang.code, name: lang.name }))); })
      .catch(() => { if (!cancelled) setCodes([]); });
    return () => { cancelled = true; };
  }, []);

  return useMemo(() => {
    if (!codes) return null;
    const prefixes = prefixKey.split(',');
    const withLabels = codes.map((lang) => ({ ...lang, label: label(lang.code) }));
    const byLabel = (a, b) => a.label.localeCompare(b.label) || a.code.localeCompare(b.code);
    const own = withLabels.filter((lang) => prefixes.includes(lang.code.split('_')[0])).sort(byLabel);
    const others = withLabels.filter((lang) => !prefixes.includes(lang.code.split('_')[0])).sort(byLabel);
    return { own, others, all: own.concat(others) };
  }, [codes, label, prefixKey]);
}

/**
 * The language a code of the file stands for when they correspond directly:
 * the same code (ignoring case), else the same name or label.
 */
export function guessLanguage(raw, languages) {
  const value = String(raw || '').trim().toLowerCase();
  if (!value) return '';
  const match =
    languages.find((lang) => lang.code.toLowerCase() === value) ||
    languages.find((lang) => (lang.name || '').toLowerCase() === value) ||
    languages.find((lang) => lang.label.toLowerCase() === value);
  return match ? match.code : '';
}
