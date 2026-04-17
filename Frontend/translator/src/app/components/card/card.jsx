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

import { useState, useEffect, useRef } from "react";
import LangSelector from "../langSelector/langSelector.jsx";
import LangExtraSelector from "../langExtraSelector/langExtraSelector.jsx";
import { TypeAnimation } from "react-type-animation";
import Image from "next/image";
import { VARIANT_LANG, LANG_TITLE, API_ENDPOINTS } from "@/app/constants";
import api from "@/app/api";
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { faCheck, faCopy, faSpinner, faStop, faTrash, faVolumeHigh, faMars, faVenus } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Textarea } from "@/components/ui/textarea.jsx";

export default function Card(props) {
  const [showGenderOptions, setShowGenderOptions] = useState(false);
  const containerRef = useRef(null);
  
  const side = props.side;
  const lang = props.lang;
  const handleLangChange = side === 'left'? props.handleSrcLang : props.handleDstLang;
  const handleSrcText = props.handleSrcText;
  const dstText = props.dstText;
  const srcText = props.srcText;
  const handleCopyText = props.handleCopyText;
  const copyReady = props.copyReady;
  const showTextMessage = props.showTextMessage;
  const ttsEnabled = props.ttsEnabled;
  const ttsText = props.ttsText;
  const ttsLangCode = props.ttsLangCode;
  const isSpeaking = props.isSpeaking;
  const isLoadingAudio = props.isLoadingAudio;
  const onSpeak = props.onSpeak;
  const onStop = props.onStop;
  const speakerColor = side === 'left' ? "#0a8cde" : "#ffffff";
  const showSpeaker = ttsEnabled && !!ttsText?.trim();
  const showClearLeft = side === 'left' && !!srcText?.trim();

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setShowGenderOptions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    setShowGenderOptions(false);
  }, [srcText, dstText]);

  return(
    <div 
      className={`card-container flex flex-col items-center relative ${
        side === 'left' 
          ? 'card-container-left bg-gradient-to-b from-white to-white/10 bg-bottom bg-no-repeat bg-contain bg-white shadow-[0px_0_70px_rgba(0,0,0,0.50)] z-[1] animate-[card-slide-in-left_1.5s_cubic-bezier(0.390,0.575,0.565,1.000)_0.1s_both]' 
          : 'bg-gradient-to-b from-[rgb(10,141,222,1)] to-[rgba(10,141,222,0.1)] bg-bottom bg-no-repeat bg-contain z-0 animate-[fade-in_1.2s_cubic-bezier(0.390,0.575,0.565,1.000)_1.5s_both]'
      }`}
      style={ side === 'left'? {backgroundImage: `url('/images/${VARIANT_LANG}-white.png')`} : {backgroundImage: `url('/images/${VARIANT_LANG}-2-blue.png')`}}
    >

      <div className={`flex h-[70px] w-[calc(100%-80px)] z-[1] animate-[fade-in_1.2s_cubic-bezier(0.390,0.575,0.565,1.000)_1.5s_both] ${
        side === 'left' ? 'max-[850px]:h-[25px]' : 'w-full max-[850px]:h-[12px]'
      }`}>

        {side === 'left' &&
          <Image 
            src={`/logo-${VARIANT_LANG}.png`} 
            alt={`logo-${LANG_TITLE}`} 
            width={100} 
            height={100} 
            className="m-[15px_30px] h-[50px] object-contain"
          />
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

      {side === 'left' ? (
        <>
          <div className="flex flex-row w-[calc(100%-80px)] h-[calc(60%-80px)] mt-[15px]">
            <Textarea
              value={srcText}
              placeholder={lang.code === "rap_Latn"? "Ka pāpaꞌi ꞌa ruŋa nei te vānaŋa mo huri" :'Escriba aquí el texto a traducir'}
              onChange={e => handleSrcText(e.target.value)}
              className={`w-full h-full ${showTextMessage && 'border-red-500' } resize-none bg-transparent outline-none text-black text-lg font-light ${showTextMessage ? 'focus-visible:ring-red-500' : 'focus-visible:ring-0'}`}
            />
          </div>

          {showTextMessage && (
            <p className="text-red-500 text-sm">
              El texto no puede tener más de 150 palabras
            </p>
          )}
        </>
      ) : (
        <>
          <div className="flex flex-row w-[calc(100%-80px)] h-[calc(60%-80px)] mt-[15px]">
            <Textarea 
              readOnly 
              value={dstText}
              className="w-full h-full border-none resize-none bg-transparent outline-none text-white text-lg font-light focus-visible:ring-0"
            />
          </div>
        </>
      )}
      
    </div>
  )
}
