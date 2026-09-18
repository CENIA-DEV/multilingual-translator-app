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

import "./langSelector.css"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowDown } from "@fortawesome/free-solid-svg-icons";

export default function LangSelector({ lang, side, handleLangModalBtn }) {
  return (
    <div
      className={`lang-container ${side === 'right' ? 'is-right' : 'is-left'}`}
      style={{ borderColor: side === 'left' ? 'rgb(var(--line))' : '#ffffff' }}
      key={lang.code}
    >
      {/* TO DO: Fix responsive view with large languages names */}
      <span
        className="lang-selected"
        style={{ color: side === 'left' ? 'rgb(var(--brand))' : '#fff' }}
      >
        {lang.name}
      </span>

      <div
        className="lang-modal-btn"
        style={side === 'left'
          ? { background: 'rgb(var(--brand))', color: '#fff' }
          : { background: '#fff', color: 'rgb(var(--brand))' }}
        onClick={handleLangModalBtn}
      >
        <FontAwesomeIcon icon={faArrowDown} />
      </div>
    </div>
  )
};
