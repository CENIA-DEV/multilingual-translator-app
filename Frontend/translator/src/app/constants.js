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
    LANGUAGES: 'api/languages/'
  };

export const NATIVE_ADMIN = 'NativeAdmin';
export const ADMIN = 'Admin';
export const USER = 'User';
export const MAX_WORDS_TRANSLATION = Number(process.env.NEXT_PUBLIC_MAX_WORDS_TRANSLATION);
export const BASE_LANG = "spa";
export const VARIANT_LANG = process.env.NEXT_PUBLIC_VARIANT;
export const LANG_TITLE = VARIANT_LANG === 'rap' ? 'Rapa Nui' : 'Mapuzungun';
export const PUBLIC_PATHS = ['/login', '/reset-password', '/reset-password-request', '/request-access', '/invitation' , '/about', '/translator'];

// Translation restriction configuration
export const TRANSLATION_REQUIRES_AUTH = process.env.NEXT_PUBLIC_TRANSLATION_REQUIRES_AUTH === 'true';
export const TTS_REQUIRES_AUTH = process.env.NEXT_PUBLIC_TTS_REQUIRES_AUTH === 'true';
export const ASR_REQUIRES_AUTH = process.env.NEXT_PUBLIC_ASR_REQUIRES_AUTH === 'true';

// Feature availability by variant
export const TTS_ENABLED = VARIANT_LANG === 'rap'; // Only enable TTS for Rapa Nui
export const ASR_ENABLED = VARIANT_LANG === 'rap'; // Only enable ASR for Rapa Nui

export const AUTOFILL_TRANSCRIPT = process.env.NEXT_PUBLIC_AUTOFILL_TRANSCRIPT !== 'false'; // defaults to true
export const MAX_AUDIO_MB = Number(process.env.NEXT_PUBLIC_MAX_AUDIO_MB) || 25;


export const isTranslationRestricted = (currentUser) => {
  return TRANSLATION_REQUIRES_AUTH && !currentUser;
};

export const isTTSRestricted = (currentUser) => {
    return !TTS_ENABLED || (TTS_REQUIRES_AUTH && !currentUser);
}

export const isASRRestricted = (currentUser) => {
    return !ASR_ENABLED || (ASR_REQUIRES_AUTH && !currentUser);
  
}


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

export const NO_USER_PATHS = [
  {'name': 'Inicio', 'route': '/about', 'icon': 'home'},
  {'name': 'Traductor', 'route': '/translator', 'icon': 'language'},
]

const USER_PATHS = [
  ...NO_USER_PATHS,
  {'name': 'Perfil', 'route': '/profile', 'icon': 'user'}
];

const ADMIN_PATHS = [
  ...USER_PATHS,
  {'name': 'Administrar Accesos', 'route': '/manage-access', 'icon': 'users'},
  {'name': 'Explorar Datos', 'route': '/explore-data', 'icon': 'database'},
];

export const PATHS = {
  USER: USER_PATHS,
  ADMIN: ADMIN_PATHS
};
