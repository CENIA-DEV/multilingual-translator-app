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

// Line icons for the "Nuestro enfoque" pillars, drawn on a 40x40 grid with a
// 2px round stroke so they share one visual weight. The first three are the
// original landing icons.

export const FOCUS_ICONS = {
  community: {
    label: "Comunidad",
    paths: (
      <>
        <circle cx="15" cy="14" r="5" />
        <path d="M6 32c0-5 4-8 9-8s9 3 9 8" />
        <circle cx="27" cy="15" r="4" />
        <path d="M28 24c4 0.5 7 3.5 7 8" />
      </>
    ),
  },
  network: {
    label: "Inteligencia artificial",
    paths: (
      <>
        <circle cx="10" cy="12" r="3" />
        <circle cx="30" cy="10" r="3" />
        <circle cx="20" cy="22" r="3.5" />
        <circle cx="12" cy="32" r="3" />
        <circle cx="30" cy="30" r="3" />
        <path d="M12.5 14.2l5 5.5" />
        <path d="M27.8 12l-5.5 7.5" />
        <path d="M18 24.8l-4 4.5" />
        <path d="M23 24.5l4.5 3.5" />
      </>
    ),
  },
  open: {
    label: "Acceso libre",
    paths: (
      <>
        <rect x="9" y="18" width="18" height="14" rx="2" />
        <path d="M14 18v-5a6 6 0 0 1 12 0" />
        <circle cx="18" cy="25" r="2" />
      </>
    ),
  },
  book: {
    label: "Libro",
    paths: (
      <>
        <path d="M20 11c-4-3-9-3-13-2v21c4-1 9-1 13 2" />
        <path d="M20 11c4-3 9-3 13-2v21c-4-1-9-1-13 2" />
        <path d="M20 11v21" />
      </>
    ),
  },
  chat: {
    label: "Conversación",
    paths: (
      <>
        <path d="M7 10h18a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H15l-6 5v-5H7a3 3 0 0 1-3-3v-8a3 3 0 0 1 3-3z" />
        <path d="M31 16h2a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3h-1v4l-5-4h-6" />
      </>
    ),
  },
  microphone: {
    label: "Voz",
    paths: (
      <>
        <rect x="15" y="6" width="10" height="18" rx="5" />
        <path d="M10 20a10 10 0 0 0 20 0" />
        <path d="M20 30v5" />
        <path d="M15 35h10" />
      </>
    ),
  },
  globe: {
    label: "Mundo",
    paths: (
      <>
        <circle cx="20" cy="20" r="13" />
        <path d="M7 20h26" />
        <path d="M20 7c4 4 5 9 5 13s-1 9-5 13" />
        <path d="M20 7c-4 4-5 9-5 13s1 9 5 13" />
      </>
    ),
  },
  school: {
    label: "Educación",
    paths: (
      <>
        <path d="M4 16l16-8 16 8-16 8z" />
        <path d="M11 20v7c3 3 15 3 18 0v-7" />
        <path d="M36 16v9" />
      </>
    ),
  },
  heart: {
    label: "Cuidado",
    paths: <path d="M20 33S7 25 7 15.5A6.5 6.5 0 0 1 20 13a6.5 6.5 0 0 1 13 2.5C33 25 20 33 20 33z" />,
  },
  leaf: {
    label: "Territorio",
    paths: (
      <>
        <path d="M8 32c0-14 9-23 25-24-1 16-10 25-24 25" />
        <path d="M8 32c5-7 10-12 17-16" />
      </>
    ),
  },
  mountain: {
    label: "Paisaje",
    paths: (
      <>
        <path d="M4 32l11-17 7 10 4-5 10 12z" />
        <path d="M13 18l2 2 2-2" />
      </>
    ),
  },
  shield: {
    label: "Protección",
    paths: (
      <>
        <path d="M20 5l12 5v9c0 8-5 13-12 16-7-3-12-8-12-16v-9z" />
        <path d="M15 20l4 4 7-8" />
      </>
    ),
  },
}

export default function FocusIcon({ name, color, size = 40 }) {
  const icon = FOCUS_ICONS[name] || FOCUS_ICONS.community
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      stroke="currentColor"
      style={{ color }}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {icon.paths}
    </svg>
  )
}
