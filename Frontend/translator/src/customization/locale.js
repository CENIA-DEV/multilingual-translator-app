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

// The site language the visitor picked. Shared by the server (root layout,
// which reads the cookie so the first HTML is already in that language) and
// the browser (ConfigProvider), so it must not import client-only code.

export const LOCALE_COOKIE = "site_locale"

/** The picked locale if the site offers it, otherwise the site's default. */
export function resolveLocale(landing, chosen) {
  return landing.locales.some((option) => option.code === chosen) ? chosen : landing.defaultLocale
}
