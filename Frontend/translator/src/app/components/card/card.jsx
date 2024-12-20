// Copyright 2024 Centro Nacional de Inteligencia Artificial (CENIA, Chile). All rights reserved.
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

import "./card.css"
import LangSelector from "../langSelector/langSelector.jsx";
import LangExtraSelector from "../langExtraSelector/langExtraSelector.jsx";
import { TypeAnimation } from "react-type-animation";
import Image from "next/image";
import { VARIANT_LANG, LANG_TITLE } from "@/app/constants";

export default function Card(props) {
  const side = props.side;
  const lang = props.lang;
  const handleLangChange = side === 'left'? props.handleSrcLang : props.handleDstLang;
  const handleSrcText = props.handleSrcText;
  const dstText = props.dstText;
  const srcText = props.srcText;

  return(
    <div className={side === 'left'? "card-container-left" : "card-container-right"} 
      style={ side === 'left'? {backgroundImage: `url('/images/${VARIANT_LANG}-white.png')`} : {backgroundImage: `url('/images/${VARIANT_LANG}-2-blue.png')`}}
    >

      <div className={side === 'left'? "card-header-left" : "card-header-right"}>

        {side === 'left'?
            <Image src={`/logo-${VARIANT_LANG}.png`} alt={`logo-${LANG_TITLE}`} priority={false} width={100} height={100} style={{objectFit: "contain"}}/>
            :
            <></>
          }
        
      </div>
      
      <LangExtraSelector
        side={side}
        lang={lang}
        handleLangChange={handleLangChange}
      />

      <LangSelector
        side={side}
        lang={lang}
        handleLangChange={handleLangChange}
        handleLangModalBtn={props.handleLangModalBtn} 
      />

      {side === 'left'?
        <textarea
          value={srcText}
          placeholder={lang.code === "rap_Latn"? "Ka pāpaꞌi ꞌa ruŋa nei te vānaŋa mo huri" :'Escriba aquí el texto a traducir'}
          onChange={e => handleSrcText(e.target.value)}
          className="card-textbox-left"
        /> 
        :
        <TypeAnimation
          key={dstText}
          wrapper="span"
          cursor={false}
          speed={70}
          deletionSpeed={70}
          sequence={[dstText]}
          className="card-textbox-right"
        />
      }
      
    </div>
  )
}