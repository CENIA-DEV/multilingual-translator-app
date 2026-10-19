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

"use client";
import { useState, useEffect, useRef } from "react";
import api from "@/app/api";
import { API_ENDPOINTS } from "@/app/constants";
import LangSelector from "../langSelector/langSelector.jsx";
import LangExtraSelector from "../langExtraSelector/langExtraSelector.jsx";
import { useConfig } from "@/customization/ConfigProvider";
import { matchesPrefix } from "@/customization/languages";
import { useT } from "@/customization/useT";
import { MediaImage } from "@/customization/media";
import Backdrop from "@/customization/Backdrop";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  faCheck,
  faCopy,
  faSpinner,
  faStop,
  faTrash,
  faVolumeHigh,
  faInfoCircle,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Textarea } from "@/components/ui/textarea.jsx";

export default function Card(props) {
  const { identity, translator, features, landing, access } = useConfig();
  const t = useT();
const [showGenderOptions, setShowGenderOptions] = useState(false);
  const [isLeftFocused, setIsLeftFocused] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const typingTimeoutRef = useRef(null);
  const containerRef = useRef(null);

  const side = props.side;
  const lang = props.lang;
  const handleLangChange =
    side === "left" ? props.handleSrcLang : props.handleDstLang;
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
  const wordInformationEnabled = !!props.wordInformationEnabled;
  // Word information exists for the languages listed in the customization
  const hasWordInformation =
    features.wordInformation.enabled &&
    matchesPrefix(lang, features.wordInformation.languages);
  const isWordInformationActive = wordInformationEnabled && hasWordInformation;
  const separateGendersAllowed = props.separateGendersAllowed !== false;
  const onSpeak = props.onSpeak;
  const onStop = props.onStop;
  const speakerColor = side === "left" ? "rgb(var(--brand))" : "#ffffff";
  const showSpeaker = ttsEnabled && !!ttsText?.trim();
  const showClearLeft = side === "left" && !!srcText?.trim();
  const [wordInfo, setWordInfo] = useState([]);

  useEffect(() => {
    if (!isWordInformationActive) {
      setWordInfo([]);
      return;
    }

    const textToAnalyze = side === "left" ? srcText : dstText;
    if (!textToAnalyze) {
      setWordInfo([]);
      return;
    }

    const timeoutId = setTimeout(async () => {
      try {
        const res = await api.post(API_ENDPOINTS.WORDS_ANALYZE, {
          sentence: textToAnalyze,
          // only the explanations of this card's variant (territory, alphabet)
          lang: lang?.code,
        });
        if (res.data && res.data.results) {
          setWordInfo(res.data.results.filter((w) => w.information));
        }
      } catch (e) {
        console.error("Failed to analyze sentence for word information", e);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [srcText, dstText, side, isWordInformationActive, lang?.code]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target)
      ) {
        setShowGenderOptions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    setShowGenderOptions(false);
  }, [srcText, dstText]);

  // Clean up typing timeout on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, []);

  const handleLeftFocus = () => {
    setIsLeftFocused(true);
    setIsTyping(true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => setIsTyping(false), 1000);
  };

  const handleLeftBlur = () => {
    setIsLeftFocused(false);
    setIsTyping(false);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
  };

  const handleLeftTextChange = (e) => {
    handleSrcText(e.target.value);
    setIsTyping(true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => setIsTyping(false), 1000);
  };

  // The overlay shows if word info is active
  const showLeftOverlay = isWordInformationActive;

  const renderHighlightedText = (text, textColorClass, isOverlay = false) => {
    if (!text) return null;

    if (!isWordInformationActive) {
      return <span className={isOverlay ? "invisible" : textColorClass}>{text}</span>;
    }

    const wordsWithInfo = wordInfo
      .filter(
        (w) =>
          w.information?.other_ways_to_say?.length > 0 ||
          w.information?.additional_explanation,
      )
      .map((w) => w.text.toLowerCase())
      .sort((a, b) => b.length - a.length);

    if (wordsWithInfo.length === 0) {
      return <span className={isOverlay ? "invisible" : textColorClass}>{text}</span>;
    }

    const dotColor = side === "left" ? "#000000" : "#ffffff";
    const highlightBg = side === "left" ? "rgb(var(--brand) / 0.15)" : "rgba(255, 255, 255, 0.2)";
    const highlightTextColor = side === "left" ? "inherit" : "#ffffff";
    const regularTextColor = side === "left" ? "inherit" : "#ffffff";

    // Escape special regex characters in words
    const escapedWords = wordsWithInfo.map((w) =>
      w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
    );
    const regex = new RegExp(`(${escapedWords.join("|")})`, "gi");

    const parts = text.split(regex);

    return (
      <>
        {parts.map((part, idx) => {
          if (!part) return null;
          const isMatch = wordsWithInfo.includes(part.toLowerCase());

          if (isMatch) {
            return (
              <span
                key={idx}
                className={isOverlay ? "" : textColorClass}
                style={{
                  backgroundColor: highlightBg,
                  borderRadius: "4px",
                  padding: "2px 4px",
                  margin: "0 1px",
                  color: isOverlay ? "transparent" : highlightTextColor,
                  WebkitTextFillColor: isOverlay ? "transparent" : highlightTextColor,
                }}
              >
                {part}
              </span>
            );
          }
          return (
            <span 
              key={idx} 
              className={isOverlay ? "" : textColorClass}
              style={{
                color: isOverlay ? "transparent" : regularTextColor,
                WebkitTextFillColor: isOverlay ? "transparent" : regularTextColor,
              }}
            >
              {part}
            </span>
          );
        })}
      </>
    );
  };

  const renderInfoPopover = () => {
    if (!isWordInformationActive || wordInfo.length === 0) return null;
    const infoTooltipClassName =
      side === "left"
        ? "rounded-full"
        : "bg-default border-white text-white rounded-full border-2";

    return (
      <Popover>
        <Tooltip delayDuration={1000}>
          <PopoverTrigger asChild>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="transition-transform duration-200 transform hover:scale-150 h-9 w-9 disabled:opacity-50"
                aria-label={t("card.moreInfo")}
              >
                <FontAwesomeIcon
                  icon={faInfoCircle}
                  className={`h-6 w-6 ${speakerColor === "#ffffff" ? "text-white" : "text-default"}`}
                />
              </button>
            </TooltipTrigger>
          </PopoverTrigger>
          <TooltipContent className={infoTooltipClassName}>
            <p>{t("card.wordInfo")}</p>
          </TooltipContent>
        </Tooltip>
        <PopoverContent
          side="bottom"
          align="end"
          className="w-80 p-4 bg-white/95 backdrop-blur-md border shadow-2xl rounded-xl z-50 text-black"
        >
          <h4 className="font-bold mb-3 border-b pb-2">
            {t("card.moreInfo")}
          </h4>
          <div className="max-h-[300px] overflow-y-auto">
            {wordInfo.length > 0 ? (
              wordInfo.map((w) => (
                <div key={w.id} className="mb-4 last:mb-0">
                  <strong className="text-lg text-blue-500 capitalize">
                    {w.text}
                  </strong>
                  {w.information?.other_ways_to_say?.length > 0 && (
                    <p className="text-sm mt-1">
                      <strong>{t("card.synonyms")}</strong>{" "}
                      {w.information.other_ways_to_say.join(", ")}
                    </p>
                  )}
                  {w.information?.additional_explanation && (
                    <p className="text-sm mt-1 text-slate-700">
                      {w.information.additional_explanation}
                    </p>
                  )}
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-600">
                {t("card.noInfo")}
              </p>
            )}
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
        side === "left"
          ? "card-container-left bg-gradient-to-b from-white to-white/10 bg-bottom bg-no-repeat bg-contain bg-white shadow-[0px_0_70px_rgba(0,0,0,0.50)] z-[1] animate-[card-slide-in-left_1.5s_cubic-bezier(0.390,0.575,0.565,1.000)_0.1s_both]"
          : "bg-gradient-to-b from-default to-default/10 bg-bottom bg-no-repeat bg-contain z-0 animate-[fade-in_1.2s_cubic-bezier(0.390,0.575,0.565,1.000)_1.5s_both]"
      }`}
      // The right card sits on the brand colour; painting it too gives a tinted
      // backdrop something to blend with.
      style={side === "left" ? undefined : { backgroundColor: "rgb(var(--brand))" }}
    >
      <Backdrop backdrop={side === "left" ? translator.leftCard : translator.rightCard} />
      {/* Top band: the same height on both cards, so their language rows
          (and the line under them) stay level whether or not the territory /
          alphabet selectors are showing. The selectors sit at its bottom so
          the space above them roughly matches the space down to the language
          row; 80px is also the logo's height with its margins. */}
      <div
        className={`flex items-end max-[850px]:items-center justify-between gap-4 h-[80px] w-[calc(100%-80px)] z-[1] animate-[fade-in_1.2s_cubic-bezier(0.390,0.575,0.565,1.000)_1.5s_both] ${
          side === "left"
            ? landing.header.platformName
              ? "max-[850px]:h-[44px]" // the title next to the logo needs the room
              : "max-[850px]:h-[25px]"
            : "max-[850px]:h-auto max-[850px]:min-h-[12px] max-[850px]:pt-3"
        }`}
      >
        {side === "left" && (
          <div className="flex items-center gap-3 m-[15px_30px] max-[850px]:absolute max-[850px]:left-[60px] max-[850px]:top-[14px] max-[850px]:m-0 max-[850px]:gap-2">
            <MediaImage
              src={identity.logo}
              alt={`logo-${identity.languageName}`}
              priority={false}
              width={100}
              height={100}
              className="h-[50px] w-auto object-contain max-[850px]:h-[40px]"
            />
            {/* The platform's name over the translated title, as in the about
                page's header; only sites with a platform name show it */}
            {landing.header.platformName && (
              <div className="flex flex-col gap-[3px] leading-[1.1]">
                <span
                  className="text-[20px] font-semibold tracking-[0.01em] text-default max-[850px]:text-[16px]"
                  style={{ fontFamily: "var(--lp-font-display)" }}
                >
                  {landing.header.platformName}
                </span>
                <span className="text-[11.5px] font-medium uppercase tracking-[0.08em] text-gray-500 max-[850px]:text-[10px] max-[850px]:tracking-[0.06em]">
                  {t.tr(landing.header.brandTitle)}
                </span>
              </div>
            )}
          </div>
        )}
        <LangExtraSelector
          side={side}
          lang={lang}
          handleLangChange={handleLangChange}
          commune={props.commune}
          onCommuneChange={props.onCommuneChange}
          autoOpenHelp={props.autoOpenHelp}
          onHelpClosed={props.onHelpClosed}
        />
      </div>

      <LangSelector
        side={side}
        lang={lang}
        handleLangChange={handleLangChange}
        handleLangModalBtn={props.handleLangModalBtn}
      />

      {side === "left" ? (
        <>
          <div data-swap className="flex flex-row w-[calc(100%-80px)] h-[calc(60%-80px)] mt-[15px] relative animate-[fade-in_1.2s_cubic-bezier(0.390,0.575,0.565,1.000)_1.5s_both]">
            <div className="relative flex-1 h-full min-w-0">
              {showLeftOverlay && (
                <div
                  ref={leftOverlayRef}
                  className="absolute inset-0 pointer-events-none z-10 px-[14px] py-[8px] border border-transparent text-[1.125rem] leading-[1.75rem] font-light font-roboto tracking-normal break-words whitespace-pre-wrap overflow-y-auto scrollbar-hide text-black m-0"
                  style={{ 
                    boxSizing: "border-box",
                    fontFamily: "inherit",
                    lineHeight: "1.75rem",
                    letterSpacing: "normal",
                    wordBreak: "break-word"
                  }}
                >
                  {renderHighlightedText(srcText, "text-black", true)}
                  {srcText?.endsWith("\n") ? <br /> : null}
                </div>
              )}

              <textarea
                onFocus={handleLeftFocus}
                onBlur={handleLeftBlur}
                onScroll={handleLeftScroll}
                value={srcText}
                placeholder={
                  translator.placeholders[lang?.code] || t.tr(translator.placeholder)
                }
                onChange={handleLeftTextChange}
                spellCheck={false}
                autoCorrect="off"
                autoCapitalize="off"
                autoComplete="off"
                data-gramm="false"
                style={{
                  color: "#000000",
                  caretColor: "#000000",
                  boxSizing: "border-box",
                  fontFamily: "inherit",
                  lineHeight: "1.75rem",
                  letterSpacing: "normal",
                  wordBreak: "break-word"
                }}
                className={`absolute inset-0 z-20 w-full h-full border ${showTextMessage ? "border-red-500 focus:ring-red-500" : "border-transparent focus:ring-0"} resize-none bg-transparent outline-none px-[14px] py-[8px] text-[1.125rem] leading-[1.75rem] font-light font-roboto tracking-normal break-words whitespace-pre-wrap placeholder:text-black overflow-y-auto scrollbar-hide m-0`}
              />
            </div>

            {(showSpeaker || showClearLeft || isWordInformationActive) && (
              <div
                className="ml-2 flex flex-col items-center justify-start gap-2 pt-[10px] w-9 shrink-0"
                ref={containerRef}
              >
                {renderInfoPopover()}

                {showSpeaker &&
                  (separateGendersAllowed &&
                  showGenderOptions &&
                  !isSpeaking &&
                  !isLoadingAudio ? (
                    <div className="flex flex-col items-center gap-1 rounded-full bg-black/10 py-1">
                      <Tooltip delayDuration={1000}>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => {
                              setShowGenderOptions(false);
                              onSpeak("male");
                            }}
                            aria-label={t("card.maleVoice")}
                            title={t("card.maleVoice")}
                            className="transition-transform duration-200 transform hover:scale-125 h-7 w-7"
                          >
                            <span className="text-2xl">👨🏻</span>
                          </button>
                        </TooltipTrigger>
                        <TooltipContent className="rounded-full">
                          <p>{t("card.maleVoice")}</p>
                        </TooltipContent>
                      </Tooltip>

                      <Tooltip delayDuration={1000}>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => {
                              setShowGenderOptions(false);
                              onSpeak("female");
                            }}
                            aria-label={t("card.femaleVoice")}
                            title={t("card.femaleVoice")}
                            className="transition-transform duration-200 transform hover:scale-125 h-7 w-7"
                          >
                            <span className="text-2xl">👩🏻</span>
                          </button>
                        </TooltipTrigger>
                        <TooltipContent className="rounded-full">
                          <p>{t("card.femaleVoice")}</p>
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
                            } else if (separateGendersAllowed) {
                              setShowGenderOptions(true);
                            } else {
                              onSpeak("female");
                            }
                          }}
                          aria-label={
                            isSpeaking ? t("card.stopReading") : t("card.chooseVoice")
                          }
                          title={isSpeaking ? t("card.stop") : t("card.listen")}
                          className="transition-transform duration-200 transform hover:scale-150 h-9 w-9 disabled:opacity-50"
                          disabled={isLoadingAudio}
                        >
                          <FontAwesomeIcon
                            icon={
                              isSpeaking
                                ? faStop
                                : isLoadingAudio
                                  ? faSpinner
                                  : faVolumeHigh
                            }
                            className={isLoadingAudio ? "fa-spin" : ""}
                            style={{ color: speakerColor }}
                          />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent className="rounded-full">
                        <p>{isSpeaking ? t("card.stop") : t("card.play")}</p>
                      </TooltipContent>
                    </Tooltip>
                  ))}

                {showClearLeft && (
                  <Tooltip delayDuration={1000}>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => {
                          if (isSpeaking) onStop?.();
                          props.onClearTexts?.();
                        }}
                        aria-label={t("card.clearText")}
                        title={t("card.clearText")}
                        className="transition-transform duration-200 transform hover:scale-150 h-9 w-9"
                      >
                        <FontAwesomeIcon icon={faTrash} style={{ color: speakerColor }} />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="rounded-full">
                      <p>{t("card.clear")}</p>
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
            )}
          </div>

          {showTextMessage && (
            <p className="text-red-500 text-sm">
              {t("card.maxWords", { max: access?.maxWordsTranslation || 150 })}
            </p>
          )}
        </>
      ) : (
        <>
          <div data-swap className="flex flex-row w-[calc(100%-80px)] h-[calc(60%-80px)] mt-[15px] scrollbar-theme scrollbar-outer-border-white relative">
            <div
              ref={rightOverlayRef}
              className="flex-1 h-full min-w-0 overflow-y-auto scrollbar-hide scrollbar-white-thumb px-[14px] py-[8px] text-[1.125rem] leading-[1.75rem] font-light font-roboto tracking-normal break-words whitespace-pre-wrap"
              style={{ 
                boxSizing: "border-box",
                fontFamily: "inherit",
                lineHeight: "1.75rem",
                letterSpacing: "normal",
                wordBreak: "break-word"
              }}
            >
              {renderHighlightedText(dstText, "text-white")}
              {dstText?.endsWith("\n") ? <br /> : null}
            </div>

            {((dstText && dstText.length > 0) || isWordInformationActive) && (
              <div
                className="ml-2 flex flex-col items-center justify-start gap-2 pt-[10px] w-9 shrink-0"
                ref={containerRef}
              >
                {renderInfoPopover()}

                {showSpeaker &&
                  (separateGendersAllowed &&
                  showGenderOptions &&
                  !isSpeaking &&
                  !isLoadingAudio ? (
                    <div className="flex flex-col items-center gap-1 rounded-full bg-white/10 py-1">
                      <Tooltip delayDuration={1000}>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => {
                              setShowGenderOptions(false);
                              onSpeak("male");
                            }}
                            aria-label={t("card.maleVoice")}
                            title={t("card.maleVoice")}
                            className="transition-transform duration-200 transform hover:scale-125 h-7 w-7"
                          >
                            <span className="text-2xl">👨🏻</span>
                          </button>
                        </TooltipTrigger>
                        <TooltipContent className="bg-default border-white text-white rounded-full border-2">
                          <p>{t("card.maleVoice")}</p>
                        </TooltipContent>
                      </Tooltip>

                      <Tooltip delayDuration={1000}>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => {
                              setShowGenderOptions(false);
                              onSpeak("female");
                            }}
                            aria-label={t("card.femaleVoice")}
                            title={t("card.femaleVoice")}
                            className="transition-transform duration-200 transform hover:scale-125 h-7 w-7"
                          >
                            <span className="text-2xl">👩🏻</span>
                          </button>
                        </TooltipTrigger>
                        <TooltipContent className="bg-default border-white text-white rounded-full border-2">
                          <p>{t("card.femaleVoice")}</p>
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
                            } else if (separateGendersAllowed) {
                              setShowGenderOptions(true);
                            } else {
                              onSpeak("female");
                            }
                          }}
                          aria-label={
                            isSpeaking ? t("card.stopReading") : t("card.chooseVoice")
                          }
                          title={isSpeaking ? t("card.stop") : t("card.listen")}
                          className="transition-transform duration-200 transform hover:scale-150 h-9 w-9 disabled:opacity-50"
                          disabled={isLoadingAudio}
                        >
                          <FontAwesomeIcon
                            icon={
                              isSpeaking
                                ? faStop
                                : isLoadingAudio
                                  ? faSpinner
                                  : faVolumeHigh
                            }
                            className={isLoadingAudio ? "fa-spin" : ""}
                            style={{ color: speakerColor }}
                          />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent className="bg-default border-white text-white rounded-full border-2">
                        <p>{isSpeaking ? t("card.stop") : t("card.play")}</p>
                      </TooltipContent>
                    </Tooltip>
                  ))}

                <Tooltip delayDuration={1000}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={handleCopyText}
                      aria-label={t("card.copy")}
                      title={t("card.copy")}
                      className="transition-transform duration-200 transform hover:scale-150 h-9 w-9"
                    >
                      <FontAwesomeIcon
                        icon={copyReady ? faCheck : faCopy}
                        className="copy-icon"
                        color="#ffffff"
                      />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="bg-default border-white text-white rounded-full border-2">
                    <p>{t("card.copy")}</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
