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
import LangSelector from "../langSelector/langSelector.jsx";
import LangExtraSelector from "../langExtraSelector/langExtraSelector.jsx";
import { TypeAnimation } from "react-type-animation";
import Image from "next/image";
import { VARIANT_LANG, LANG_TITLE } from "@/app/constants";
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { faCheck, faCopy, faSpinner, faStop, faTrash, faVolumeHigh } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Textarea } from "@/components/ui/textarea.jsx";

export default function Card(props) {
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
  const showWordDefinitions = !!props.showWordDefinitions;
  const wordDefinitions = props.wordDefinitions || {};
  const speakerColor = side === 'left' ? "#0a8cde" : "#ffffff";
  const showSpeaker = ttsEnabled && !!ttsText?.trim();
  const showClearLeft = side === 'left' && !!srcText?.trim();

  const normalizeWordKey = (word = '') => {
    return word
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .replace(/[^\p{L}\p{N}_]+/gu, '')
      .toLowerCase();
  };

  const renderHighlightedText = (text, textColorClass) => {
    if (!text) {
      return null;
    }

    const chunks = [];
    // Include optional leading apostrophe so tokens like 'Iorana are highlighted as one word.
    const regex = /['’]?[\p{L}\p{N}_]+(?:['’][\p{L}\p{N}_]+)*/gu;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
      const [word] = match;
      const index = match.index;

      if (index > lastIndex) {
        chunks.push(
          <span key={`plain-${lastIndex}`}>{text.slice(lastIndex, index)}</span>
        );
      }

      const key = normalizeWordKey(word);
      const definitions = wordDefinitions[key];

      if (definitions?.length) {
        chunks.push(
          <Tooltip key={`word-${index}`} delayDuration={120}>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="inline-block rounded-sm border border-yellow-300 bg-yellow-100 px-1 text-slate-900 outline-none ring-offset-0 transition-colors hover:bg-yellow-200 focus-visible:ring-2 focus-visible:ring-yellow-400"
                aria-label={`Definicion de ${word}`}
                title="Ver definicion"
              >
                {word}
              </button>
            </TooltipTrigger>
            <TooltipContent
              side="top"
              className="max-w-[280px] rounded-md border border-slate-200 bg-white text-slate-900"
            >
              <div className="text-xs font-medium mb-1">{word}</div>
              <div className="space-y-1 text-xs leading-relaxed">
                {definitions.map((def, idx) => (
                  <p key={`${key}-${idx}`}>
                    {def?.part_of_speech ? `${def.part_of_speech}: ` : ''}
                    {def?.meaning}
                  </p>
                ))}
              </div>
            </TooltipContent>
          </Tooltip>
        );
      } else {
        chunks.push(<span key={`word-${index}`}>{word}</span>);
      }

      lastIndex = index + word.length;
    }

    if (lastIndex < text.length) {
      chunks.push(<span key={`plain-tail`}>{text.slice(lastIndex)}</span>);
    }

    return (
      <div className={`w-full h-full overflow-y-auto whitespace-pre-wrap break-words text-lg font-light leading-8 ${textColorClass}`}>
        {chunks}
      </div>
    );
  };

  const hasAnyDefinitions = Object.keys(wordDefinitions).length > 0;
  const shouldRenderHighlights = showWordDefinitions && hasAnyDefinitions;

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

        {side === 'left'?
            <Image 
              src={`/logo-${VARIANT_LANG}.png`} 
              alt={`logo-${LANG_TITLE}`} 
              priority={false} 
              width={100} 
              height={100} 
              className="m-[15px_30px] h-[50px] object-contain"
            />
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
	   <>
        <div className="flex flex-row w-[calc(100%-80px)] h-[calc(60%-80px)] mt-[15px]">
            <Textarea
              value={srcText}
              placeholder={lang.code === "rap_Latn"? "Ka pāpaꞌi ꞌa ruŋa nei te vānaŋa mo huri" :'Escriba aquí el texto a traducir'}
              onChange={e => handleSrcText(e.target.value)}
              className={`w-full h-full ${showTextMessage && 'border-red-500' } resize-none bg-transparent outline-none text-black text-lg font-light animate-[fade-in_1.2s_cubic-bezier(0.390,0.575,0.565,1.000)_1.5s_both] ${showTextMessage ? 'focus-visible:ring-red-500' : 'focus-visible:ring-0'}`}
            />
		    {/* speaker (only if text exists) */}
            {(showSpeaker || showClearLeft) && (
              <div className="ml-2 flex flex-col items-center justify-start gap-2 pt-1">
                {showSpeaker && (
                  <Tooltip delayDuration={1000}>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => (isSpeaking ? onStop() : onSpeak())}
                        aria-label={isSpeaking ? "Detener lectura" : "Reproducir lectura"}
                        title={isSpeaking ? "Detener" : "Escuchar"}
                        className="transition-transform duration-200 transform hover:scale-150 h-9 w-9 disabled:opacity-50"
                        disabled={isLoadingAudio}
                      >
                        <FontAwesomeIcon
                          icon={isSpeaking ? faStop : (isLoadingAudio ? faSpinner : faVolumeHigh)}
                          className={isLoadingAudio ? "fa-spin" : ""}
                          color={speakerColor}
                        />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="rounded-full">
                      <p>{isSpeaking ? "Detener" : "Reproducir audio"}</p>
                    </TooltipContent>
                  </Tooltip>
                )}
           
                {showClearLeft && (
                  <Tooltip delayDuration={1000}>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => { if (isSpeaking) onStop?.(); props.onClearTexts?.(); }}
                        aria-label="Borrar texto"
                        title="Borrar texto"
                        className="transition-transform duration-200 transform hover:scale-150 h-9 w-9"
                      >
                        <FontAwesomeIcon icon={faTrash} color={speakerColor} />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="rounded-full">
                      <p>Limpiar</p>
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
            )}
          </div>

          {showTextMessage && (
            <p className="text-red-500 text-sm">El texto no puede tener más de 150 palabras</p>
          )}

          {shouldRenderHighlights && srcText?.trim() && (
            <div className="w-[calc(100%-80px)] mt-3">
              <p className="text-xs text-slate-500 mb-2">
                {'Palabras con definicion: pasa el cursor o haz click en el resaltado amarillo.'}
              </p>
              <div className="max-h-[110px] rounded-md border border-slate-200 bg-white/80 p-3">
                {renderHighlightedText(srcText, 'text-black')}
              </div>
            </div>
          )}
        </>
        :
        <>
          <div className="flex flex-row w-[calc(100%-80px)] h-[calc(60%-80px)] mt-[15px] scrollbar-theme scrollbar-outer-border-white">

            {shouldRenderHighlights ? (
              renderHighlightedText(dstText, 'text-white')
            ) : (
              <Textarea readOnly 
                key={dstText}
                wrapper="span"
                cursor={false}
                speed={70}
                deletionSpeed={70}
                value={dstText}
                className="w-full h-full border-none resize-none bg-transparent outline-none text-white text-lg font-light focus-visible:ring-0 scrollbar-white-thumb"
              />
            )}

			{dstText && dstText.length > 0 && (
				<div className="ml-2 flex flex-col items-center justify-start gap-2 pt-1">	
				
				  {showSpeaker && (
					  <Tooltip delayDuration={1000}>
						<TooltipTrigger asChild>
						  <button
							onClick={() => (isSpeaking ? onStop() : onSpeak())}
							aria-label={isSpeaking ? "Detener lectura" : "Reproducir lectura"}
							title={isSpeaking ? "Detener" : "Escuchar"}
							className="transition-transform duration-200 transform hover:scale-150 h-9 w-9 disabled:opacity-50"
							disabled={isLoadingAudio}
						  >
							<FontAwesomeIcon
							  icon={isSpeaking ? faStop : (isLoadingAudio ? faSpinner : faVolumeHigh)}
							  className={isLoadingAudio ? "fa-spin" : ""}
							  color={speakerColor /* white on right */}
							/>
						  </button>
						</TooltipTrigger>
						<TooltipContent className="bg-default border-white text-white rounded-full border-2">
						  <p>{isSpeaking ? "Detener" : "Reproducir audio"}</p>
						</TooltipContent>
					  </Tooltip>
                  )}
				  
				  <Tooltip delayDuration={1000}>
					<TooltipTrigger asChild>
					  <button
						onClick={handleCopyText}
						aria-label="Copiar traducción"
						title="Copiar traducción"
						className="transition-transform duration-200 transform hover:scale-150 h-9 w-9"
					  >
						<FontAwesomeIcon icon={copyReady ? faCheck : faCopy} className="copy-icon" color="#ffffff" />
					  </button>
					</TooltipTrigger>
					<TooltipContent className="bg-default border-white text-white rounded-full border-2">
					  <p>Copiar traducción</p>
					</TooltipContent>
				  </Tooltip>
				</div>
            )}
          </div>
        </>
      }
      
    </div>
  )
}