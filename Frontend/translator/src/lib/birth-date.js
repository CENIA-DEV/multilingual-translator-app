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

// Rules for the day / month / year birth-date picker. Kept free of React so the
// same logic can be shared (and kept identical) with voces-platform-frontend.
//
// Months are 1-12 throughout. A part that hasn't been chosen yet is null.

/** How many years back the year list goes, counting the current one. */
export const BIRTH_YEAR_SPAN = 120;

export const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

/** Years offered, newest first: this year and the BIRTH_YEAR_SPAN - 1 before it. */
export const birthYears = (today = new Date()) =>
  Array.from({ length: BIRTH_YEAR_SPAN }, (_, i) => today.getFullYear() - i);

/**
 * Days in `month` of `year`. Before a year is chosen, February counts 29 so a
 * leap-day birthday can still be picked first; choosing a non-leap year then
 * moves it to the 28th (see `reconcileBirthDate`).
 */
export const daysInMonth = (year, month) => {
  if (!month) return 31;
  // Day 0 of the next month is the last day of this one.
  return new Date(year ?? 2000, month, 0).getDate();
};

/** Months that can be chosen: all of them, except the future ones this year. */
export const availableMonths = (year, today = new Date()) => {
  const last = year === today.getFullYear() ? today.getMonth() + 1 : 12;
  return Array.from({ length: last }, (_, i) => i + 1);
};

/** Days that can be chosen: the real ones of that month, none in the future. */
export const availableDays = (year, month, today = new Date()) => {
  let last = daysInMonth(year, month);
  if (year === today.getFullYear() && month === today.getMonth() + 1) {
    last = Math.min(last, today.getDate());
  }
  return Array.from({ length: last }, (_, i) => i + 1);
};

/**
 * Make a (possibly partial) selection consistent after one part changed.
 *
 * Returns `{ year, month, day, notice }`. `notice` explains, in Spanish, any
 * part that had to change, so the picker never alters the user's choice
 * silently:
 * - a day past the end of the month (31 -> February) moves to the last day;
 * - a month or day that would put the date in the future is cleared.
 */
export const reconcileBirthDate = ({ year, month, day }, today = new Date()) => {
  let notice = null;

  if (month && !availableMonths(year, today).includes(month)) {
    return {
      year, month: null, day: null,
      notice: 'Esa fecha aún no llega. Elige el mes y el día de nuevo.',
    };
  }

  if (day && month) {
    const days = availableDays(year, month, today);
    const lastDay = days[days.length - 1];
    if (day > lastDay) {
      const isFutureDay = lastDay < daysInMonth(year, month);
      if (isFutureDay) {
        return {
          year, month, day: null,
          notice: 'Esa fecha aún no llega. Elige el día de nuevo.',
        };
      }
      notice = `Ajustamos el día al ${lastDay}: ${MONTHS[month - 1].toLowerCase()}`
        + `${year ? ` de ${year}` : ''} tiene ${lastDay} días.`;
      day = lastDay;
    }
  }

  return { year, month, day, notice };
};

/**
 * The selection as a Date (at noon, so no timezone or daylight-saving shift
 * can move it to another day), or null while it is incomplete or not a real,
 * past date.
 */
export const toBirthDate = ({ year, month, day }, today = new Date()) => {
  if (!year || !month || !day) return null;
  const date = new Date(year, month - 1, day, 12, 0, 0);
  // Reject anything the Date constructor had to roll over (e.g. 31 April).
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  const endOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);
  if (date > endOfToday) return null;
  if (year < today.getFullYear() - BIRTH_YEAR_SPAN + 1) return null;
  return date;
};

/** Split a Date into the picker's parts (or all null). */
export const fromBirthDate = (date) =>
  date instanceof Date && !Number.isNaN(date.getTime())
    ? { year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate() }
    : { year: null, month: null, day: null };
