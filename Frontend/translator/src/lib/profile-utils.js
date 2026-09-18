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

// Parse a "YYYY-MM-DD" date of birth coming from the API as a local date.
// Defaults to today to avoid crashes when the value is missing or malformed.
// The time is set to noon so daylight-saving shifts can't move it to another day.
export const parseDate = (dob) => {
  if (!dob) return new Date();
  try {
    const [year, month, day] = dob.split('-').map(Number);
    if (year && month && day) {
      return new Date(year, month - 1, day, 12, 0, 0);
    }
    return new Date();
  } catch (e) {
    return new Date();
  }
};

// Format a date as "YYYY-MM-DD" using the local calendar day. Unlike
// toISOString(), this doesn't convert to UTC, which moved the day for users
// in timezones ahead of UTC.
export const getLocalYYYYMMDD = (date) => {
  if (!date) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

// Whether the profile form differs from the saved user data.
export const hasProfileChanges = (currentUser, { firstName, lastName, organization, languageProficiency, dateOfBirth }) => {
  if (!currentUser) return false;
  const currentDob = currentUser.profile?.date_of_birth || '';
  const newDob = getLocalYYYYMMDD(dateOfBirth);

  return currentUser.first_name !== firstName ||
    currentUser.last_name !== lastName ||
    (currentUser.profile?.organization || '') !== (organization || '') ||
    (currentUser.profile?.proficiency || '') !== (languageProficiency || '') ||
    currentDob !== newDob;
};
