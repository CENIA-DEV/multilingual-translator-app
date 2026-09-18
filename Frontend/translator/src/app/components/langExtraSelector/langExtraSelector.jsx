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

import { useCallback, useEffect, useState } from 'react'
import './langExtraSelector.css'
import { VARIANT_LANG } from "@/app/constants";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

import languages from "../../assets/languages_arn.json";

export default function LangExtraSelector(props) {

  const [selectedGrapheme, setSelectedGrapheme] = useState(props.lang.writing);

  const [selectedDialect, setSelectedDialect] = useState(props.lang.dialect);
  
  const graphemes = [
    { Language: "Azümchefe", code: "a0" },
    { Language: "Raguileo", code: "r0" },
    { Language: "Unificado", code: "u0" },
  ];

  //const dialects = [{'Language':'Huilliche','code':'h'},{'Language':'Lafkenche','code':'l'},{'Language':'Nguluche','code':'n'},{'Language':'Pewenche','code':'p'}];


  const { lang: currentLang, handleLangChange } = props;

  // Stable between renders, so the effect below runs when the language (or
  // its change handler) changes rather than after every render.
  const updateLangByCode = useCallback((grapheme, dialect) => {

    setSelectedGrapheme(grapheme);
    setSelectedDialect(dialect);

    const code = `${currentLang.code.split("_")[0]}_${grapheme}_${dialect}`;

    const lang = languages.filter((e) => e.code === code)[0];

    if(code !== currentLang.code){
      handleLangChange(lang);
    }

  }, [currentLang.code, handleLangChange]);

  useEffect(() => {
    if (currentLang.code.split("_")[0] === "arn"){
      updateLangByCode(currentLang.writing, currentLang.dialect);
    }
  }, [currentLang, updateLangByCode])

  if(VARIANT_LANG === 'arn' && props.lang.code.split('_')[0] === 'arn'){
    return (
      <div className="lang-selector">
        <span className={`ml-3 font-semibold ${props.side === 'left'? "text-default" : "text-white"}`}>Grafemario</span>

        <Tabs value={selectedGrapheme}  className="w-fit bg-gray-400 p-[1.5px] rounded-[25px]">
          <TabsList className="flex rounded-[25px] bg-gray-50 ">
            {graphemes.map((grapheme) => (
              <TabsTrigger
                className="rounded-[25px] font-semibold text-gray-400"
                key={grapheme.code}
                value={grapheme.code}
                onClick={() => updateLangByCode(grapheme.code , selectedDialect)}
              >
                {grapheme.Language}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {/* <span className='font-bold'>Grafemario</span>
        
        <div className="lang-grapheme-options">

          {graphemes.map(grapheme => (
            <label key={grapheme.code}>
              <input type="radio" id={grapheme.code} name={`grapheme-${props.side}`} value={grapheme.code}/>
              <span>{grapheme.Language}</span>
            </label>
          ))}

          <span id={`1-${props.side}`} className="lang-grapheme-selected"></span>

        </div>

        <span>Dialecto</span>

        <div className="lang-dialect-options">

          {dialects.map(dialect => (
            <label key={dialect.code}>
              <input type="radio" id={dialect.code} name={`dialect-${props.side}`} value={dialect.code}/>
              <span>{dialect.Language}</span>
            </label>
          ))}

          <span id={`2-${props.side}`} className="lang-dialect-selected"></span>

        </div> */}
      </div>
    );
  }
  
}