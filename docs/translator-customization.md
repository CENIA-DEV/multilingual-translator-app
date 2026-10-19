# Administrar Traductor — per-translator customization

Everything that used to differ between the Rapa Nui (`rap`) and Mapuzungun (`arn`)
builds (names, colours, images, texts, languages, voice features, the whole landing
page) is now one JSON document that the technical team edits from the site itself,
at **/manage-translator** ("Administrar Traductor" in the menu). The same build can
become a translator for any language without touching code.

## Who can use it

The technical team (`Profile.role == "Admin"`, shown as "Equipo técnico") and Django
staff/superusers. Community administrators (`NativeAdmin`) keep managing access and
data but do not see the editor. The rule lives in one place,
`main.roles.can_manage_translator`, and is exposed to the frontend as
`can_manage_translator` in the user payload.

## What can be customized

| Area | Editor section | Fields |
| --- | --- | --- |
| Identity | Identidad y SEO | language name, organisation that reviews access requests, translator logo, favicon, site title, description, keywords (with a Google-result preview) |
| App colours | Colores y tipografía | primary, hover, pressed, text-on-primary (WCAG contrast badge), soft lines; "derive shades" helper; warning + one-click tint when illustrations no longer match |
| Landing palette | Colores y tipografía | 17 tokens (backgrounds, text, accents, map) with contrast badges and a 3-colour palette generator |
| Typography | Colores y tipografía | landing display/text faces from a curated Google Fonts list, with live samples in every landing language to check ŋ, ā, ü, ꞌ |
| Translator cards | Tarjetas y textos | left/right illustration, fit, position, opacity, tint-to-brand; default source/target language |
| Translator texts | Tarjetas y textos | input placeholder (global and per source language), feedback prompt, entry notice (on/off, rich text), "restricted access" and "maintenance" dialogs |
| Languages | Idiomas y funciones | which catalog languages the selector offers (search, bulk show/hide), renames, custom languages/dialects, the translator's own language codes, the variant selectors: territory (Nagche, Williche, ...) and alphabet/graphemary, with the alphabets each territory uses, and the code of the language without variants that the source side offers (prefix, labels, options) |
| Voice & words | Idiomas y funciones | TTS, ASR (dictation + audio upload) and word information: on/off and which languages |
| Access pages | Páginas de acceso | login, forms (request access, password, invitation) and profile images; tint-to-brand |
| Landing structure | Idiomas y secciones | page languages (add/remove/rename/default), section order (drag), visibility, tone (light / soft / dark) |
| Landing content | one section each | header logo & title, hero photo with focal point and overlay strength, CTAs, "about" paragraphs (rich text + photo + focal point), validation map (GeoJSON outline upload + places table with spreadsheet paste + live map), focus pillars (12-icon picker), partner institutions, developer (VOCES) block, credit columns, funders, contact section and form texts, footer |
| Translations | Traducciones | per-language progress and a side-by-side workbench listing every pending text of the landing page |
| Versions | Historial, Plantillas e importación | publish history with notes and change summaries, restore any version into the draft, templates (Rapa Nui, Mapuzungun, neutral), export/import of the whole document including uploaded images |

Deliberately **not** in the editor (deploy-time settings, unchanged): whether
translation / TTS / ASR / word information / gender voices require login, the word
limit, maintenance mode, API URLs, analytics IDs and model endpoints. Those depend
on the infrastructure of each deployment, and the backend enforces some of them.

## How editing works

* **One working copy, autosaved.** Every change updates an in-memory draft that is
  saved to the backend 1.2 s after the last edit (status in the top bar). Nothing is
  visible to visitors until **Publicar**.
* **Live preview of the real site.** The right pane is the actual site in an iframe.
  The editor pushes the unsaved draft into it with `postMessage` on every change, so
  the preview is the real code, not a re-implementation. It has desktop, tablet and
  phone sizes, a page switcher, and it scrolls to the section being edited.
* **Undo/redo** (Ctrl+Z / Ctrl+Shift+Z, 100 steps, typing in a field is one step),
  Ctrl+S to save now, and a warning before leaving with unsaved changes.
* **Publish** shows what changed compared with the live version, asks for an
  optional note and records a revision. The site shows it on the next page load.
* **Conflicts:** writes carry the version they were based on. If two admins edit at
  once, the second gets a banner to load the other version or keep their own,
  instead of silently overwriting.
* **Validation** happens on the server. Unsafe links, invalid colours and missing
  fields come back with their path and are shown on the field and in a banner that
  links to the section.
* **Images** are resized and re-encoded to WebP in the browser (a 730 KB, 2400 px
  photo uploads as ~300 KB), de-duplicated by hash, and reusable from the library.

## Architecture

```
Frontend/translator/src/customization/
  presets/{rap,arn,generic}.json   built-in documents (rap/arn = the sites as they were)
  config.js                        deepMerge / resolveWith / getIn / setIn (no presets: small)
  presets.js                       picks the preset from NEXT_PUBLIC_VARIANT, resolveConfig()
  server.js                        server-side loader with in-process cache (layout only)
  ConfigProvider.jsx               context, theme CSS variables, live-preview receiver
  theme.js / fonts.js / i18n.js / media.jsx / languages.js / RichText.jsx / icons.jsx / Backdrop.jsx
  editor/                          the editor (Editor, fields, sections*, PreviewPane, useEditorState)
Backend/translatorapp_v2/customization/
  schema.py     pydantic schema: the gatekeeper (extra keys forbidden, colours, links,
                media refs and rich text sanitised)
  models.py     TranslatorCustomization (draft + published, versions),
                CustomizationRevision, CustomizationAsset (files in the DB)
  views.py      API, see the docstring for the endpoint list
```

**Document resolution.** The stored document is laid over the preset for the
deployment's `NEXT_PUBLIC_VARIANT` (unknown variants use the neutral template).
Objects merge key by key and lists are replaced whole, so a field added to the
presets later shows up with its default in documents saved before it existed.
Until someone publishes, the site renders the preset. For rap and arn that is
pixel-identical to the previous hard-coded site (see Verification).

**First paint.** The root layout is rendered per request (`dynamic = "force-dynamic"`)
and loads the published document on the server. The loader caches it in-process for
30 s and refreshes it in the background, so HTML arrives already themed and
translated, with no flash of defaults. Publishing drops the cache of the instance
that served the editor. Other instances catch up within 30 s. If the frontend
server cannot reach the API, it renders the preset and backs off for 30 s, and the
browser then fetches the published document after hydration. `CONFIG_API_URL` can
point the server at an internal API address. It defaults to `NEXT_PUBLIC_API_URL`,
so the deploy workflows need no change.

**Theme.** Colours become CSS variables on `:root`. The Tailwind colour `default`
(used everywhere as `text-default`, `bg-default`, `bg-default/10`, …) now reads
`--brand`. Every existing component follows the admin's colour without being
rewritten. `globals.css` declares the historical values, so a page renders
correctly even before the document arrives.

**Uploaded files** are stored in PostgreSQL (`CustomizationAsset`) and served by
`GET /api/customization/assets/<uuid>/` with `Cache-Control: immutable`,
`nosniff` and a sandboxing CSP. The type is detected from the bytes: raster
formats via Pillow, SVG only without scripts or embeds, and GeoJSON must parse and
contain polygons. The document references them as `asset:<uuid>`, which keeps it
portable between staging and production. `manage.py prune_customization_assets`
removes files that no draft, published version or revision references.

## Launching a new language

1. Deploy as usual. The deploy workflow's `variant` input only chooses the starting
   template now.
2. Open **Administrar Traductor → Plantillas e importación → Idioma nuevo**, or
   import an export from another site.
3. Walk the sections top to bottom. The live preview shows every change, and
   **Traducciones** lists what still needs translating.
4. **Publicar.**

Model services, analytics IDs and service names are still selected per variant by
the GitHub workflows. Adding a third variant there is the only infrastructure step
left, and it was intentionally not changed here.

## Site languages

The page languages (`landing.locales`, "Idiomas y secciones") are the languages of
the whole site: landing page, translator, menu and dialogs. The visitor's choice is
stored in the `site_locale` cookie, which the root layout reads so the server renders
the first HTML in that language. `useLocale()` gives the current language and
`useT()` the texts:

* Texts of the document (`{ es, en, arn }` objects, or plain strings saved before
  they could be translated) go through `t.tr(node)`.
* The app's fixed texts (buttons, toasts, menu) live in
  `customization/messages.js` in Spanish and English, and are read with
  `t("menu.home")`. A deployment translates them into its own language with the
  document's `ui` map (same keys, e.g. `ui["menu.home"].arn`). `lang.<code>` keys
  rename a language in the selector for one site language only.
* A missing text falls back to the default language (Spanish), so a site language
  without a translation shows Spanish rather than a blank.
* A label that introduces names ("Proyecto de", "Desarrollado por") can be written
  as `...ñi küzaw` to go after them in languages with that word order.

## Adding a customizable field

1. Add it to the three presets (`presets/*.json`) with its current value.
2. Add it to `customization/schema.py` (backend tests fail if a preset does not
   validate).
3. Read it where it is used (`useConfig()` in client components).
4. Expose it in the relevant `editor/sections*.jsx` with the field components
   (`TextField`, `I18nField`, `ImageField`, `ColorField`, `ListField`, …), each bound
   to a dotted path.

## Verification

* Backend: 43 new tests (schema and sanitisers, presets validate, permissions,
  draft/publish/discard/restore, optimistic locking, conditional GET, uploads and
  file-type rejection). The full suite passes (181 tests).
* Visual parity: the untouched `origin/dev` build and this build were screenshotted
  page by page (landing, translator, login, request access, password reset) at
  1440 px and 390 px, for both variants, and compared pixel by pixel. **arn: 0
  differing pixels. rap: identical except one intentional fix** (a stray space
  before a comma in the first landing paragraph).
* End to end (Playwright against the local stack, 21 checks): role gating, autosave,
  live preview, undo/redo, image upload and compression, server rejection of an
  unsafe link, publish and history, server-rendered HTML carrying the published
  text and theme, restoring the original template. No page errors.

## Behaviour changes worth knowing

* The request-access, password and invitation pages now show their illustration.
  Before, it was set with a Tailwind class built from a template string
  (`bg-[url('/images/${VARIANT_LANG}-2-blue.png')]`), which Tailwind cannot
  generate, so it never rendered.
* "El texto no puede tener más de 150 palabras" now uses the configured word limit.
* Font Awesome's `height: 1em` is pinned in `globals.css`. It used to win over
  Tailwind `h-*` classes only by accident of CSS chunk order.
* The arn landing page, preserved as it was, still shows the Rapa Nui photos in
  "Acerca del proyecto" and the Rapa Nui municipality among the funders. That is
  probably a leftover, and it can now be fixed from the editor.
* Removed as superseded or dead code: `about/text.js`, `about/credits.js`,
  `about/i18n.js`, the three per-variant language lists (replaced by one catalog
  plus the document's hidden and renamed languages), and the unused
  `components/modal`.

## Possible next steps

* Serve uploaded files from a public GCS bucket behind a CDN if the library grows
  large (the `asset:` indirection makes that a backend-only change).
* Move the remaining fixed UI copy (login, profile and invitation forms) into the
  document if those pages need to be multilingual too.
* Add a third variant option to the deploy workflows, or derive the service names
  from an input, so a new language does not need a workflow edit.
