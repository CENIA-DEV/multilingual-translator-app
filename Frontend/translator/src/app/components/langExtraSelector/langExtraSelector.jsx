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
import { useEffect, useId, useState } from "react";
import { ChevronDown, HelpCircle } from "lucide-react";
import TerritoryHelper from "../territoryHelper/territoryHelper.jsx";
import { TERRITORY_HELP } from "@/customization/territoryHelper";
import * as SelectPrimitive from "@radix-ui/react-select";
import { SelectContent, SelectItem } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useConfig } from "@/customization/ConfigProvider";
import { useLanguageSides, variantParts } from "@/customization/languages";
import { useT } from "@/customization/useT";

/**
 * A pill-shaped dropdown. Not a native <select>: its open list can't be styled,
 * and here the pill squares its bottom corners while open so the list hangs
 * from it. The radius is exactly half the height: a larger one is only shrunk
 * to fit while all four corners are round, so the top curve would change on
 * opening. Radix wraps the texts in <span>, which the global styles size as
 * text-base, hence [&_span]:text-sm. While open, Radix turns pointer events off
 * outside the list; the trigger takes them back so it keeps the hand cursor,
 * and a click on it still closes the list (as a click outside it). On phones
 * it fills its column, cutting a long name short rather than overflowing.
 */
// The value of the optional last entry that runs an action instead of being chosen
const ACTION_VALUE = "__action__"

function PillSelect({ id, value, onValueChange, options, action }) {
  // The action entry is an option like the others, so the keyboard reaches it,
  // but choosing it runs the action and keeps the current value
  const handleChange = (next) => (action && next === ACTION_VALUE ? action.onSelect() : onValueChange(next))
  return (
    <SelectPrimitive.Root value={value || undefined} onValueChange={handleChange}>
      <SelectPrimitive.Trigger
        id={id}
        className="group flex h-[39px] items-center justify-between gap-3 rounded-[19.5px] border-[1.5px] border-gray-400 bg-gray-50 pl-4 pr-4 text-sm font-semibold text-default outline-none [&_span]:text-sm focus-visible:ring-2 focus-visible:ring-white cursor-pointer data-[state=open]:pointer-events-auto data-[state=open]:rounded-b-none data-[state=open]:ring-0 max-[850px]:w-full"
      >
        <span className="min-w-0 truncate">
          <SelectPrimitive.Value />
        </span>
        <SelectPrimitive.Icon asChild>
          <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-data-[state=open]:rotate-180" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectContent
        side="bottom"
        sideOffset={0}
        avoidCollisions={false}
        className="w-[var(--radix-select-trigger-width)] min-w-0 rounded-b-[12px] rounded-t-none border-[1.5px] border-t-0 border-gray-400 bg-gray-50 shadow-md data-[side=bottom]:translate-y-0 data-[side=bottom]:slide-in-from-top-0 data-[state=open]:zoom-in-100"
      >
        {options.map((option) => (
          <SelectItem
            key={option.code}
            value={option.code}
            className="cursor-pointer rounded-[8px] pl-3 text-sm font-semibold [&_span]:text-sm text-gray-400 focus:bg-gray-200 focus:text-gray-500 data-[state=checked]:text-default data-[state=checked]:focus:text-default"
          >
            {option.label}
          </SelectItem>
        ))}
        {action && (
          <>
            <SelectPrimitive.Separator className="mx-1 my-1 h-px bg-gray-300" />
            <SelectItem
              value={ACTION_VALUE}
              className="cursor-pointer rounded-[8px] pl-3 pr-2 text-[13px] font-bold leading-tight text-default [&_span]:text-[13px] focus:bg-default/10 focus:text-default"
            >
              <span className="flex items-center gap-1.5">
                <HelpCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                {action.label}
              </span>
            </SelectItem>
          </>
        )}
      </SelectContent>
    </SelectPrimitive.Root>
  );
}

// Territory ("Variante territorial") and alphabet ("Grafemario") of a language
// whose codes encode both, e.g. arn_azumchefe_nagche: Mapuzungun, Nagche territory, in
// the Azümchefe alphabet. Each territory lists the alphabets it uses (Williche:
// Cacicado and Rumian). The language prefix, labels, territories and alphabets
// come from "Idiomas y funciones" in Administrar Traductor.
export default function LangExtraSelector({ lang, side, handleLangChange, commune, onCommuneChange, autoOpenHelp, onHelpClosed }) {
  const { variantSelector } = useConfig().languages;
  const sides = useLanguageSides();
  const t = useT();
  const dialectId = useId();
  const writingId = useId();
  const [helpOpen, setHelpOpen] = useState(false);

  // Opened on arrival when the page asks for it (and this side has the help)
  const canHelp = sides.showsVariants(lang) && (TERRITORY_HELP[variantSelector.prefix] || []).length > 0;
  useEffect(() => {
    if (autoOpenHelp && canHelp) setHelpOpen(true);
  }, [autoOpenHelp, canHelp]);
  const closeHelp = () => {
    setHelpOpen(false);
    onHelpClosed?.();
  };

  if (!sides.showsVariants(lang)) return null;

  // "Ayúdame a decidir": for languages with territory help, about the
  // territories the selector offers
  const dialectLabel = (code) => t.tr(sides.dialects.find((d) => d.code === code)?.label) || code;
  const helpZones = (TERRITORY_HELP[variantSelector.prefix] || []).filter((zone) =>
    sides.dialects.some((d) => d.code === zone.code)
  );
  const helpAction = helpZones.length
    ? {
        label: t("territoryHelp.open"),
        // after the dropdown has closed and handed focus back, or the popup
        // would lose it to the trigger
        onSelect: () => setTimeout(() => setHelpOpen(true), 0),
      }
    : null;

  const { writing, dialect } = variantParts(lang.code);
  const writings = sides.writingsFor(dialect);
  const labelClass = `text-sm font-semibold ${side === 'left' ? 'text-default' : 'text-white'}`;

  const choose = (nextWriting, nextDialect) => {
    const next = sides.languageFor(sides.codeFor(nextWriting, nextDialect));
    if (next.code !== lang.code) handleLangChange(next);
  };

  // Keep the alphabet when the new territory uses it too
  const chooseDialect = (nextDialect) => {
    const allowed = sides.writingsFor(nextDialect).map((option) => option.code);
    choose(allowed.includes(writing) ? writing : allowed[0], nextDialect);
  };

  // The alphabets are tabs only from 1100px up: below that the card is too
  // narrow for the territory dropdown and the tabs side by side, and wrapping
  // them would overflow the fixed band above the language row (off the top of
  // the screen). There both selectors are dropdowns, side by side; on phones
  // (the cards' 850px breakpoint) they share the row in halves, with their
  // labels left to screen readers.
  return (
    <div data-swap className="lang-variants flex flex-wrap items-end justify-end gap-x-5 gap-y-2 max-[1100px]:flex-nowrap max-[1100px]:gap-x-3 max-[850px]:w-full max-[850px]:pt-3">
      {sides.dialects.length > 0 && (
        <div className="flex flex-col gap-1 max-[850px]:min-w-0 max-[850px]:flex-1">
          <label htmlFor={dialectId} className={`${labelClass} max-[850px]:sr-only`}>
            {t.tr(variantSelector.dialectLabel)}
          </label>
          <PillSelect
            id={dialectId}
            value={dialect}
            onValueChange={chooseDialect}
            options={sides.dialects.map((option) => ({ code: option.code, label: t.tr(option.label) }))}
            action={helpAction}
          />
          {helpAction && (
            <TerritoryHelper
              open={helpOpen}
              onOpenChange={(open) => (open ? setHelpOpen(true) : closeHelp())}
              zones={helpZones}
              current={dialect}
              currentCommune={commune?.territory === dialect ? commune.name : null}
              label={dialectLabel}
              // a territory picked from its card has no comuna: that clears it
              onChoose={(code, communeName) => {
                chooseDialect(code);
                onCommuneChange?.(communeName ? { name: communeName, territory: code } : null);
                closeHelp();
              }}
            />
          )}
        </div>
      )}

      <div className="hidden flex-col gap-1 max-[1100px]:flex max-[850px]:min-w-0 max-[850px]:flex-1">
        <label htmlFor={writingId} className={`${labelClass} max-[850px]:sr-only`}>
          {t.tr(variantSelector.label)}
        </label>
        <PillSelect
          id={writingId}
          value={writing}
          onValueChange={(code) => choose(code, dialect)}
          options={writings.map((option) => ({ code: option.code, label: t.tr(option.label) }))}
        />
      </div>

      <div className="flex flex-col gap-1 max-[1100px]:hidden">
        <span className={labelClass}>{t.tr(variantSelector.label)}</span>
        <Tabs value={writing} className="w-fit bg-gray-400 p-[1.5px] rounded-[25px]">
          <TabsList className="flex rounded-[25px] bg-gray-50 ">
            {writings.map((option) => (
              <TabsTrigger
                // keyboard focus as a soft ring inside the pill, not the kit's
                // dark ring around it (Chrome also shows it after a click when
                // a key is pressed next, or a popup hands focus back)
                className="rounded-[25px] font-semibold text-gray-400 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/70 focus-visible:ring-offset-0"
                key={option.code}
                value={option.code}
                onClick={() => choose(option.code, dialect)}
              >
                {t.tr(option.label)}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>
    </div>
  );
}
