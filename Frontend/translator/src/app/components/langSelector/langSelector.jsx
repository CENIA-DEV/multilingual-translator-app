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
import { useCallback, useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowDown } from "@fortawesome/free-solid-svg-icons";
import { VARIANT_LANG } from "@/app/constants";

import languages_list_arn from "../../assets/languages_arn.json";
import languages_list_rap from "../../assets/languages_rap.json";

export default function LangSelector({lang, ...props}) {

  //const lang = props.lang;
  const side = props.side;
  const handleLangChange = props.handleLangChange;
  const handleLangModalBtn = props.handleLangModalBtn;
  const languages = VARIANT_LANG === 'arn'? languages_list_arn : languages_list_rap;

  const [lastLanguages, setLastLanguages] = useState(
    side === 'left'?
      VARIANT_LANG === 'arn'?
        [{"name": "Huilliche Azümchefe", "code": "arn_a0_h", "writing": "a0", "dialect": "h"}, {"name": "Inglés", "code": "eng_Latn", "writing": "Latn", "dialect": null}]
        :
        [{"name": "Rapa Nui", "code": "rap_Latn", "writing": "Latn", "dialect": null}, {"name": "Maori", "code": "mri_Latn", "writing": "Latn", "dialect": null}]
      :
      VARIANT_LANG === 'arn'?
        [{"name": "Castellano", "code": "spa_Latn", "writing": "Latn", "dialect": null}, {"name": "Inglés", "code": "eng_Latn", "writing": "Latn", "dialect": null}]
        :
        [{"name": "Castellano", "code": "spa_Latn", "writing": "Latn", "dialect": null}, {"name": "Maori", "code": "mri_Latn", "writing": "Latn", "dialect": null}]
  );

  const [lastLanguage, setLastLanguage] = useState(lang);

  const getLangByCode = useCallback((code) => {

    if(code !== lastLanguage.code){

      const lang = languages.filter((e) => e.code === code)[0];

      const lastLangsAux = [...lastLanguages];

      if (lastLangsAux[0].code === code){
        setLastLanguages([lastLanguage, lastLangsAux[1]]);
      }
      else if (lastLangsAux[1].code === code){
        setLastLanguages([lastLanguage, lastLangsAux[0]]);
      }
      else{
        setLastLanguages([lastLanguage, lastLangsAux[0]]);
      }
      setLastLanguage(lang);
    }
  }, [lastLanguage, lastLanguages, languages]);

  useEffect( () => {
    getLangByCode(lang.code);
  },[lang, getLangByCode])

  return(

    <div className="lang-container " style={side === 'right' ? {justifyContent: "flex-end"} : {justifyContent: "flex-start"}} key={lang}>
      {/* TO DO: Fix responsive view with large languages names */}
      <strong className="lang-selected" style={side === 'left'? {color: "#0a8cde"} : {color: "#fff"}}>{lang.name}</strong>

      {/*<div className="lang-last-elements">
        
        {lastLanguages.map(lang => (
        
          <span 
            key={lang.code} 
            className={`${side==='left'? 'lang-span-left' : 'lang-span-right'}`}
            onClick={() => handleLangChange(lang)}  
          >
            {lang.name}
          </span>
        
        ))}

      </div>*/}

      <div 
        className="lang-modal-btn"
        style={side==='left'? {background: "#0a8cde", color: "#fff"} : {background: "#fff", color: "#0a8cde"}}
        onClick={handleLangModalBtn}
      >
        <FontAwesomeIcon icon={faArrowDown} />
      </div>

    </div>
  )

};