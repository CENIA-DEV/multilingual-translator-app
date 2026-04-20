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
import api from "@/app/api";
import { API_ENDPOINTS } from "@/app/constants";
import LangSelector from "../langSelector/langSelector.jsx";
import LangExtraSelector from "../langExtraSelector/langExtraSelector.jsx";
import Image from "next/image";
import { VARIANT_LANG, LANG_TITLE } from "@/app/constants";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { faCheck, faCopy, faSpinner, faStop, faTrash, faVolumeHigh, faMars, faVenus, faInfoCircle } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Textarea } from "@/components/ui/textarea.jsx";

export default function Card(props) {
  const [showGenderOptions, setShowGenderOptions] = useState(false);
  const containerRef = useRef(null);

  const side = props.side;
  const lang = props.lang;
  const handleLangChange = side === 'left' ? props.handleSrcLang : props.handleDstLang;
  const handleSrcText = props.handleSrcText;
  const dstText = props.dstText;
  const srcText = props.srcText;
  const handleCopyText = props.handleCopyText;
  const copyReady = props.copyReady;
  const showTextMessage = props.showTextMessage;
  const ttsEnabled = props.ttsEnabled;
  const ttsText = props.ttsText;
  const isSpeaking = props.isSpeaking;
  const isLoadingAudio = props.isLoadingAudio;
  const onSpeak = props.onSpeak;
  const onStop = props.onStop;
  const speakerColor = side === 'left' ? "#0a8cde" : "#ffffff";
  const showSpeaker = ttsEnabled && !!ttsText?.trim();
  const showClearLeft = side === 'left' && !!srcText?.trim();
  const [wordInfo, setWordInfo] = useState([]);

  useEffect(() => {
    const textToAnalyze = side === 'left' ? srcText : dstText;
    if (!textToAnalyze) {
      setWordInfo([]);
      return;
    }

    const timeoutId = setTimeout(async () => {
      try {
        const res = await api.post(API_ENDPOINTS.WORDS_ANALYZE, { sentence: textToAnalyze });
        if (res.data && res.data.results) {
          setWordInfo(res.data.results.filter(w => w.information));
        }
      } catch (e) {
        console.error("Failed to analyze sentence for word information", e);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [srcText, dstText, side]);

  // Close options if clicked outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setShowGenderOptions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close options if text changes
  useEffect(() => {
    setShowGenderOptions(false);
  }, [srcText, dstText]);

  const renderHighlightedText = (text, textColorClass) => {
    if (!text) return null;

    const wordsWithInfo = wordInfo
      .filter(w => w.information?.other_ways_to_say?.length > 0 || w.information?.additional_explanation)
      .map(w => w.text.toLowerCase());

    const dotColor = side === 'left' ? '#000000' : '#ffffff';
    const parts = text.split(/(\s+)/);

    const elements = parts.map((word, idx) => {
      if (word.match(/^\s+$/)) {
        return <span key={idx}>{word}</span>;
      }

      const baseWord = word.replace(/^[.,!?;:—\-()[\]{}""']+|[.,!?;:—\-()[\]{}""']+$/g, '').toLowerCase();
      const candidates = [baseWord, "'" + baseWord, "'" + baseWord, baseWord.replace(/^['']/, "")].filter(Boolean);
      const hasInfo = candidates.some(c => wordsWithInfo.includes(c));

      if (hasInfo) {
        return (
          <span
            key={idx}
            className={textColorClass}
            style={{
              backgroundImage: `radial-gradient(circle, ${dotColor} 2px, transparent 2px)`,
              backgroundRepeat: 'repeat-x',
              backgroundSize: '8px 3px',
              backgroundPosition: '0 100%',
              paddingBottom: '5px',
            }}
          >
            {word}
          </span>
        );
      }
      return <span key={idx} className={textColorClass}>{word}</span>;
    });

    return <>{elements}</>;
  };

  const renderInfoPopover = () => {
    if (wordInfo.length === 0) return null;
    const infoTooltipClassName = side === 'left'
      ? 'rounded-full'
      : 'bg-default border-white text-white rounded-full border-2';

    return (
      <Popover>
        <Tooltip delayDuration={1000}>
          <PopoverTrigger asChild>
            <TooltipTrigger asChild>
              <button type="button" className="transition-transform duration-200 transform hover:scale-150 h-9 w-9 disabled:opacity-50" aria-label="Información adicional">
                <FontAwesomeIcon icon={faInfoCircle} className={`h-6 w-6 ${speakerColor === '#ffffff' ? 'text-white' : 'text-[#0a8cde]'}`} />
              </button>
            </TooltipTrigger>
          </PopoverTrigger>
          <TooltipContent className={infoTooltipClassName}>
            <p>Información palabras</p>
          </TooltipContent>
        </Tooltip>
        <PopoverContent side="bottom" align="end" className="w-80 p-4 bg-white/95 backdrop-blur-md border shadow-2xl rounded-xl z-50 text-black">
          <h4 className="font-bold mb-3 border-b pb-2">Información adicional</h4>
          <div className="max-h-[300px] overflow-y-auto">
            {wordInfo.map(w => (
              <div key={w.id} className="mb-4 last:mb-0">
                <strong className="text-lg text-blue-500 capitalize">{w.text}</strong>
                {w.information?.other_ways_to_say?.length > 0 && (
                  <p className="text-sm mt-1"><strong>Sinónimos:</strong> {w.information.other_ways_to_say.join(", ")}</p>
                )}
                {w.information?.additional_explanation && (
                  <p className="text-sm mt-1 text-slate-700">{w.information.additional_explanation}</p>
                )}
              </div>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    );
  };

  const leftOverlayRef = useRef(null);
  const rightOverlayRef = useRef(null);
  const handleLeftScroll = (e) => {
    if (leftOverlayRef.current) {
      leftOverlayRef.current.scrollTop = e.target.scrollTop;
      leftOverlayRef.current.scrollLeft = e.target.scrollLeft;
    }
  };

  return (
    <div
      className={`card-container flex flex-col items-center relative ${
        side === 'left'
          ? 'card-container-left bg-gradient-to-b from-white to-white/10 bg-bottom bg-no-repeat bg-contain bg-white shadow-[0px_0_70px_rgba(0,0,0,0.50)] z-[1] animate-[card-slide-in-left_1.5s_cubic-bezier(0.390,0.575,0.565,1.000)_0.1s_both]'
          : 'bg-gradient-to-b from-[rgb(10,141,222,1)] to-[rgba(10,141,222,0.1)] bg-bottom bg-no-repeat bg-contain z-0 animate-[fade-in_1.2s_cubic-bezier(0.390,0.575,0.565,1.000)_1.5s_both]'
      }`}
      style={side === 'left' ? { backgroundImage: `url('/images/${VARIANT_LANG}-white.png')` } : { backgroundImage: `url('/images/${VARIANT_LANG}-2-blue.png')` }}
    >
      <div className={`flex h-[70px] w-[calc(100%-80px)] z-[1] animate-[fade-in_1.2s_cubic-bezier(0.390,0.575,0.565,1.000)_1.5s_both] ${
        side === 'left' ? 'max-[850px]:h-[25px]' : 'w-full max-[850px]:h-[12px]'
      }`}>
        {side === 'left' ?
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

      {side === 'left' ?
        <>
          <div className="flex flex-row w-[calc(100%-80px)] h-[calc(60%-80px)] mt-[15px] relative">
            <div className="relative flex-1 h-full min-w-0">
              <div
                ref={leftOverlayRef}
                className="absolute inset-0 pointer-events-none z-10 px-[14px] py-[8px] border border-transparent text-[1.125rem] leading-[1.75rem] font-light font-sans tracking-normal break-words whitespace-pre-wrap overflow-y-auto scrollbar-hide"
              >
                {renderHighlightedText(srcText, "text-transparent")}
                {srcText?.endsWith('\n') ? <br /> : null}
              </div>
              <Textarea
                onScroll={handleLeftScroll}
                value={srcText}
                placeholder={lang.code === "rap_Latn" ? "Ka pāpaꞌi ꞌa ruŋa nei te vānaŋa mo huri" : 'Escriba aquí el texto a traducir'}
                onChange={e => handleSrcText(e.target.value)}
                spellCheck={false}
                autoCorrect="off"
                autoCapitalize="off"
                autoComplete="off"
                data-gramm="false"
                style={{ color: '#000000', caretColor: '#000000', padding: '8px 14px' }}
                className={`absolute inset-0 z-20 w-full h-full border ${showTextMessage ? 'border-red-500 focus-visible:ring-red-500' : 'border-transparent focus-visible:ring-0'} resize-none bg-transparent outline-none text-[1.125rem] leading-[1.75rem] font-light font-sans tracking-normal break-words whitespace-pre-wrap overflow-y-auto scrollbar-hide animate-[fade-in_1.2s_cubic-bezier(0.390,0.575,0.565,1.000)_1.5s_both]`}
              />
            </div>

            {(showSpeaker || showClearLeft || wordInfo.length > 0) && (
              <div className="ml-2 flex flex-col items-center justify-start gap-2 pt-[10px] w-9 shrink-0" ref={containerRef}>
                {renderInfoPopover()}

                {showSpeaker && (
                  showGenderOptions && !isSpeaking && !isLoadingAudio ? (
                    <div className="flex flex-col items-center gap-1 rounded-full bg-black/10 py-1">
                      <Tooltip delayDuration={1000}>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => { setShowGenderOptions(false); onSpeak('male'); }}
                            aria-label="Voz masculina"
                            title="Voz masculina"
                            className="transition-transform duration-200 transform hover:scale-125 h-7 w-7"
                          >
                            <FontAwesomeIcon icon={faMars} color={speakerColor} />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent className="rounded-full">
                          <p>Voz masculina</p>
                        </TooltipContent>
                      </Tooltip>

                      <Tooltip delayDuration={1000}>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => { setShowGenderOptions(false); onSpeak('female'); }}
                            aria-label="Voz femenina"
                            title="Voz femenina"
                            className="transition-transform duration-200 transform hover:scale-125 h-7 w-7"
                          >
                            <FontAwesomeIcon icon={faVenus} color={speakerColor} />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent className="rounded-full">
                          <p>Voz femenina</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  ) : (
                    <Tooltip delayDuration={1000}>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => {
                            if (isSpeaking) {
                              onStop();
                            } else {
                              setShowGenderOptions(true);
                            }
                          }}
                          aria-label={isSpeaking ? "Detener lectura" : "Seleccionar voz"}
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
                  )
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
        </>
        :
        <>
          <div className="flex flex-row w-[calc(100%-80px)] h-[calc(60%-80px)] mt-[15px] scrollbar-theme scrollbar-outer-border-white relative">
            <div
              ref={rightOverlayRef}
              className="flex-1 h-full min-w-0 overflow-y-auto scrollbar-hide scrollbar-white-thumb px-3 py-2 text-[1.125rem] leading-[1.75rem] font-light font-sans tracking-normal break-words whitespace-pre-wrap"
            >
              {renderHighlightedText(dstText, "text-white")}
              {dstText?.endsWith('\n') ? <br /> : null}
            </div>

            {((dstText && dstText.length > 0) || wordInfo.length > 0) && (
              <div className="ml-2 flex flex-col items-center justify-start gap-2 pt-[10px] w-9 shrink-0" ref={containerRef}>
                {renderInfoPopover()}

                {showSpeaker && (
                  showGenderOptions && !isSpeaking && !isLoadingAudio ? (
                    <div className="flex flex-col items-center gap-1 rounded-full bg-white/10 py-1">
                      <Tooltip delayDuration={1000}>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => { setShowGenderOptions(false); onSpeak('male'); }}
                            aria-label="Voz masculina"
                            title="Voz masculina"
                            className="transition-transform duration-200 transform hover:scale-125 h-7 w-7"
                          >
                            <FontAwesomeIcon icon={faMars} color={speakerColor} />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent className="bg-default border-white text-white rounded-full border-2">
                          <p>Voz masculina</p>
                        </TooltipContent>
                      </Tooltip>

                      <Tooltip delayDuration={1000}>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => { setShowGenderOptions(false); onSpeak('female'); }}
                            aria-label="Voz femenina"
                            title="Voz femenina"
                            className="transition-transform duration-200 transform hover:scale-125 h-7 w-7"
                          >
                            <FontAwesomeIcon icon={faVenus} color={speakerColor} />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent className="bg-default border-white text-white rounded-full border-2">
                          <p>Voz femenina</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  ) : (
                    <Tooltip delayDuration={1000}>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => {
                            if (isSpeaking) {
                              onStop();
                            } else {
                              setShowGenderOptions(true);
                            }
                          }}
                          aria-label={isSpeaking ? "Detener lectura" : "Seleccionar voz"}
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
                      <TooltipContent className="bg-default border-white text-white rounded-full border-2">
                        <p>{isSpeaking ? "Detener" : "Reproducir audio"}</p>
                      </TooltipContent>
                    </Tooltip>
                  )
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
