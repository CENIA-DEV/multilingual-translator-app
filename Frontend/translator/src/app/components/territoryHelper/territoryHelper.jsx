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

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, MapPin, Search } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { placeKey } from "@/customization/territoryHelper";
import { useT } from "@/customization/useT";

// "Ayúdame a decidir": helps a speaker who knows where they live, but not the
// name of their variant, pick their territory. Two ways in, both big and
// tappable: a search by comuna, first, and one tile per territory (what it
// means and where it lies). A comuna picked from the search goes back with the
// territory, to tag translations and feedback. Nothing changes until "Usar ...".
// Its texts are the "territoryHelp.*" messages (messages.js), and its territories
// (`zones`) languages.variantSelector.territoryHelp: both are edited in
// Administrar Traductor > "Ayúdame a decidir".

/** The card's picture, /public/images/territories/<icon>.svg, painted in the
 * brand colour (the file is a mask, so it takes whatever colour the text has). */
function TerritoryIcon({ icon, className = "h-9 w-9" }) {
  const url = `url(/images/territories/${icon}.svg)`
  return (
    <span
      aria-hidden
      className={`block bg-current ${className}`}
      style={{ WebkitMask: `${url} center / contain no-repeat`, mask: `${url} center / contain no-repeat` }}
    />
  )
}

export default function TerritoryHelper({ open, onOpenChange, zones, current, currentCommune = null, onChoose, label }) {
  const t = useT()
  const [selected, setSelected] = useState(current)
  // the comuna picked from the search, if the territory came from one
  const [place, setPlace] = useState(currentCommune)
  const [query, setQuery] = useState("")
  const contentRef = useRef(null)

  // Each opening starts from the territory (and comuna) in use
  useEffect(() => {
    if (open) {
      setSelected(current)
      setPlace(currentCommune)
      setQuery(currentCommune || "")
    }
  }, [open, current, currentCommune])

  const places = useMemo(
    () => zones.flatMap((z) => (z.comunas || []).map((name) => ({ name, code: z.code, key: placeKey(name) }))),
    [zones]
  )
  const key = placeKey(query)
  const matches = key
    ? places
        .filter((p) => p.key.includes(key))
        .sort((a, b) => Number(!a.key.startsWith(key)) - Number(!b.key.startsWith(key)))
        .filter((p, i, all) => all.findIndex((q) => q.key === p.key) === i)
        .slice(0, 5)
    : []

  const chosen = zones.find((z) => z.code === selected)

  const pickPlace = (match) => {
    setSelected(match.code)
    setPlace(match.name)
    setQuery(match.name) // keeps the picked comuna in view, highlighted
  }
  const pickTerritory = (code) => {
    setSelected(code)
    setPlace(null) // a territory chosen by itself has no comuna
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        ref={contentRef}
        // focus the dialog itself: on the first tile, its focus ring looked
        // like a second territory chosen
        onOpenAutoFocus={(event) => {
          event.preventDefault()
          contentRef.current?.focus()
        }}
        className="max-h-[92dvh] w-[min(820px,94vw)] max-w-none overflow-y-auto rounded-2xl p-4 outline-none sm:p-7">
        <div className="flex flex-col gap-4 sm:gap-5">
          <div className="pr-8">
            <DialogTitle className="text-2xl font-bold leading-tight text-default sm:text-3xl">{t("territoryHelp.title")}</DialogTitle>
            <DialogDescription className="mt-2 text-base leading-relaxed text-slate-700">
              {t("territoryHelp.intro")}
            </DialogDescription>
          </div>

          {/* By comuna, first: what people know */}
          <div className="flex flex-col gap-2 rounded-2xl bg-slate-50 p-3 sm:p-4">
            <label htmlFor="territory-search" className="text-base font-semibold text-slate-800">
              {t("territoryHelp.search")}
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <input
                id="territory-search"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  setPlace(null) // a new search: pick again
                }}
                placeholder={t("territoryHelp.searchHint")}
                autoComplete="off"
                className="h-12 w-full rounded-full border-2 border-slate-200 bg-white pl-12 pr-4 text-base outline-none focus:border-default"
              />
            </div>
            {key && (
              <div className="flex flex-wrap gap-2" aria-live="polite">
                {matches.length ? (
                  matches.map((match) => {
                    const isOn = place === match.name
                    return (
                      <button
                        key={match.key}
                        type="button"
                        onClick={() => pickPlace(match)}
                        aria-pressed={isOn}
                        className={`flex items-center gap-2 rounded-full border-2 px-4 py-2 text-base transition ${
                          isOn ? "border-default bg-default text-white shadow-md" : "border-default/40 bg-white text-slate-800 hover:border-default"
                        }`}
                      >
                        {isOn ? <Check className="h-4 w-4" aria-hidden="true" /> : <MapPin className="h-4 w-4" aria-hidden="true" />}
                        <span className="font-semibold">{match.name}</span>
                        <span aria-hidden="true">→</span>
                        <span>{label(match.code)}</span>
                      </button>
                    )
                  })
                ) : (
                  <p className="text-[15px] text-slate-600">{t("territoryHelp.notFound")}</p>
                )}
              </div>
            )}
            {place && chosen && (
              <p className="flex items-center gap-2 text-[15px] font-semibold text-default" aria-live="polite">
                <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
                {t("territoryHelp.belongs", { place, territory: label(chosen.code) })}
              </p>
            )}
          </div>

          {/* One tile per territory */}
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 sm:gap-3">
            {zones.map((zone) => {
              const isOn = selected === zone.code
              const where = zone.where ? t.tr(zone.where) : ""
              return (
                <button
                  key={zone.code}
                  type="button"
                  onClick={() => pickTerritory(zone.code)}
                  aria-pressed={isOn}
                  className={`relative flex flex-col items-center gap-0.5 rounded-xl border-2 px-1 py-2 text-center transition sm:gap-1 sm:rounded-2xl sm:px-2 sm:py-3 ${
                    isOn ? "border-default bg-default/10 shadow-md" : "border-slate-200 bg-white hover:border-default/60"
                  }`}
                >
                  {isOn && (
                    <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-default text-white sm:right-2 sm:top-2 sm:h-6 sm:w-6">
                      <Check className="h-3 w-3 sm:h-4 sm:w-4" />
                    </span>
                  )}
                  <span className="text-default"><TerritoryIcon icon={zone.icon} className="h-11 w-11 sm:h-14 sm:w-14" /></span>
                  <span className="text-[14px] font-bold text-slate-900 sm:text-[17px]">{label(zone.code)}</span>
                  <span className="text-[11.5px] leading-snug text-slate-600 sm:text-[13px]">{t.tr(zone.meaning)}</span>
                  {where && <span className="hidden text-[12px] leading-snug text-slate-500 sm:block">{where}</span>}
                </button>
              )
            })}
          </div>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="h-12 rounded-full border-2 border-slate-300 px-6 text-base font-semibold text-slate-700 hover:bg-slate-50"
            >
              {t("common.cancel")}
            </button>
            <button
              type="button"
              disabled={!chosen}
              onClick={() => onChoose(chosen.code, place)}
              className="h-12 rounded-full bg-default px-8 text-base font-bold text-white shadow-md transition hover:bg-defaultHover disabled:cursor-not-allowed disabled:opacity-40"
            >
              {chosen ? t("territoryHelp.use", { territory: label(chosen.code) }) : t("territoryHelp.pick")}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
