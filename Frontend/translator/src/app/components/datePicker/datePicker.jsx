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

import { useEffect, useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  MONTHS,
  availableDays,
  availableMonths,
  birthYears,
  fromBirthDate,
  reconcileBirthDate,
  toBirthDate,
} from "@/lib/birth-date";

// Birth date as three dropdowns (day / month / year), which is quicker on a
// phone than paging a calendar back decades. Only real, past dates can be
// picked; the rules live in lib/birth-date so voces-platform-frontend can
// share them unchanged.
//
// `handleDateUpdate` receives a Date (at noon) once all three parts form a
// valid date, and null while the selection is incomplete, so the form's own
// "is the date set?" check keeps its submit button disabled until then.
export default function DatePicker({ disabled = false, selectedDate = null, handleDateUpdate, label }) {

  const id = useId();
  const [parts, setParts] = useState(() => fromBirthDate(selectedDate));
  const [notice, setNotice] = useState(null);

  // Follow the parent when it sets a date (initial load, "cancel" restoring the
  // saved one). A null coming back is only our own "incomplete" report, so it
  // must not wipe what the user has half-picked.
  useEffect(() => {
    if (!(selectedDate instanceof Date)) return;
    setParts((current) => {
      const shown = toBirthDate(current);
      return shown && shown.getTime() === selectedDate.getTime()
        ? current
        : fromBirthDate(selectedDate);
    });
  }, [selectedDate]);

  const update = (key, value) => {
    const next = reconcileBirthDate({ ...parts, [key]: value ? Number(value) : null });
    setParts({ year: next.year, month: next.month, day: next.day });
    setNotice(next.notice);
    handleDateUpdate(toBirthDate(next));
  };

  const days = availableDays(parts.year, parts.month);
  const months = availableMonths(parts.year);
  const years = birthYears();

  const selectClasses = "block h-full px-1 min-[400px]:px-2.5 pb-2.5 pt-4 w-full text-[13px] min-[400px]:text-sm text-gray-900 bg-transparent rounded-lg border border-gray-300 disabled:text-gray-400 disabled:border-gray-200 disabled:cursor-not-allowed appearance-none focus:outline-none focus:ring-0 focus:border-default peer cursor-pointer";
  const chevronClasses = "absolute right-1 min-[400px]:right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 min-[400px]:h-5 min-[400px]:w-5 text-gray-400 pointer-events-none";

  return (
    <fieldset className="flex flex-col gap-2 w-full" aria-describedby={notice ? `${id}-notice` : undefined}>
      <legend className="text-sm text-gray-500 ml-1 mb-2">{label || 'Fecha de nacimiento'}</legend>
      <div className="flex gap-1 min-[400px]:gap-3 h-[50px]">
        <div className="relative flex-1 h-full">
          <select
            aria-label="Día"
            value={parts.day ?? ''}
            disabled={disabled}
            onChange={(e) => update('day', e.target.value)}
            className={selectClasses}
          >
            <option value="" disabled>Día</option>
            {days.map((d) => <option key={d} value={d}>{String(d).padStart(2, '0')}</option>)}
          </select>
          <ChevronDown className={chevronClasses} aria-hidden="true" />
        </div>

        <div className="relative flex-[1.8] h-full">
          <select
            aria-label="Mes"
            value={parts.month ?? ''}
            disabled={disabled}
            onChange={(e) => update('month', e.target.value)}
            className={selectClasses}
          >
            <option value="" disabled>Mes</option>
            {months.map((m) => <option key={m} value={m}>{MONTHS[m - 1]}</option>)}
          </select>
          <ChevronDown className={chevronClasses} aria-hidden="true" />
        </div>

        <div className="relative flex-[1.2] h-full">
          <select
            aria-label="Año"
            value={parts.year ?? ''}
            disabled={disabled}
            onChange={(e) => update('year', e.target.value)}
            className={selectClasses}
          >
            <option value="" disabled>Año</option>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <ChevronDown className={chevronClasses} aria-hidden="true" />
        </div>
      </div>
      <p id={`${id}-notice`} aria-live="polite" className="text-xs text-amber-700 ml-1">
        {notice}
      </p>
    </fieldset>
  )
}
