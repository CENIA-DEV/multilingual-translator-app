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

export const ACCESS_TOKEN = 'token'
// Fired on window by the API client when the backend rejects the stored token
export const AUTH_EXPIRED_EVENT = 'auth-token-expired'

export const API_ENDPOINTS = {
    TRANSLATION: 'api/translate/',
    TEXT_TO_SPEECH: 'api/text-to-speech/',
    SPEECH_TO_TEXT: 'api/speech-to-text/',
    INVITATIONS: 'api/invitations/',
    USERS: 'api/users/',
    REQUESTS: 'api/requests/',
    PENDING_REQUESTS: 'api/requests/get_pending_requests/',
    SEND_INVITATION: 'api/invitations/send_invitation/',
    SUGGESTIONS: 'api/suggestions/',
    PASSWORD_RECOVERY: 'api/password_reset/',
    LANGUAGES: 'api/languages/',
    WORDS_ANALYZE: 'api/words/analyze_sentence/' ,
    WORDS: 'api/words/',
    WORD_INFORMATION: 'api/word-information/',
    IMPORTED_FILES: 'api/imported-files/',





};

export const NATIVE_ADMIN = 'NativeAdmin';
export const ADMIN = 'Admin';
export const USER = 'User';
export const BASE_LANG = "spa";
// URL configuration for the sitemap, robots.txt and metadata. The deploy
// workflow writes NEXT_PUBLIC_BASE_URL for production builds; fallback to the
// development host otherwise.
export const BASE_URL =
  process.env.NEXT_PUBLIC_BASE_URL ||
  "http://localhost:3000";  // fallback for local dev

// Search engines may only index a production build that knows its public URL
export const ALLOW_INDEXING =
  process.env.NODE_ENV === "production" && Boolean(process.env.NEXT_PUBLIC_BASE_URL);

export const PUBLIC_PATHS = ['/login', '/reset-password', '/reset-password-request', '/request-access', '/invitation' , '/about', '/translator'];

// Which languages get TTS / ASR / word information is part of the
// customization ("Idiomas y funciones" in Administrar Traductor); who may use
// each feature, maintenance and the word limit are its "Visibilidad"
// (customization/access.js), enforced by the API.

export const AUTOFILL_TRANSCRIPT = process.env.NEXT_PUBLIC_AUTOFILL_TRANSCRIPT !== 'false'; // defaults to true
export const MAX_AUDIO_MB = Number(process.env.NEXT_PUBLIC_MAX_AUDIO_MB) || 25;

// Maintenance forced at deploy time (the deploy form's switch): shown even if
// the backend is down. Otherwise maintenance follows "Visibilidad".
export const FORCED_MAINTENANCE = process.env.NEXT_PUBLIC_MAINTENANCE_MODE === 'true';


// Admin pages (manage access, explore data, manage words) are for these roles
export const isAdminUser = (currentUser) => {
  const role = currentUser?.profile?.role;
  return role === NATIVE_ADMIN || role === ADMIN;
};

// "Administrar Traductor" (look, texts and languages of the site) is only for
// the technical team and Django staff; the backend decides and reports it.
export const canManageTranslator = (currentUser) => Boolean(currentUser?.can_manage_translator);

export const ROLES = [
  {name: "Administrador", value: "NativeAdmin"},
  {name: "Equipo técnico", value: "Admin"},
  {name: "Usuario", value: "User"}
];

export const REQUEST_ACCESS_REASONS = [
  {name: 'Por curiosidad', value: 'Curiosity'},
  {name: 'Para aprender', value: 'Learning'},
  {name: 'Por trabajo', value: 'Work'},
  {name: 'Para colaborar', value: 'Collaboration'}
];

// `key` names the menu text in customization/messages.js
export const NO_USER_PATHS = [
  {'name': 'Inicio', 'key': 'menu.home', 'route': '/about', 'icon': 'home'},
  {'name': 'Traductor', 'key': 'menu.translator', 'route': '/translator', 'icon': 'language'},
]

const USER_PATHS = [
  ...NO_USER_PATHS,
  {'name': 'Perfil', 'key': 'menu.profile', 'route': '/profile', 'icon': 'user'}
];

const ADMIN_PATHS = [
  ...USER_PATHS,
  {'name': 'Administrar Accesos', 'key': 'menu.manageAccess', 'route': '/manage-access', 'icon': 'users'},
  {'name': 'Explorar Datos', 'key': 'menu.exploreData', 'route': '/explore-data', 'icon': 'database'},
  {'name': 'Administrar Palabras', 'key': 'menu.manageWords', 'route': '/manage-word-information', 'icon': 'database'},
];

export const TRANSLATOR_ADMIN_PATH =
  {'name': 'Administrar Traductor', 'key': 'menu.manageTranslator', 'route': '/manage-translator', 'icon': 'palette'};

export const PATHS = {
  USER: USER_PATHS,
  ADMIN: ADMIN_PATHS
};
