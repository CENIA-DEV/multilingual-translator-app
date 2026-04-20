import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowRightArrowLeft, faArrowsRotate, faArrowRight, faLock } from '@fortawesome/free-solid-svg-icons';

export function TranslatorControls({
  handleCrossLang,
  handleTranslate,
  loadingState,
  translationRestricted
}) {
  return (
    <>
      <div
        className="delayed-fade-in w-[40px] h-[40px] rounded-full flex justify-center items-center bg-white absolute max-[850px]:top-1/2 max-[850px]:left-[45px] left-1/2 top-[100px] z-[2] cursor-pointer shadow-[0px_0px_hsla(0,100%,100%,0.333)] transform transition-all duration-300 hover:scale-110 hover:shadow-[8px_8px_#0005]"
        onClick={() => handleCrossLang()}
      >
        <FontAwesomeIcon
          icon={faArrowRightArrowLeft }
          className={`fa-xl max-[850px]:rotate-90 transform transition-all duration-300 hover:scale-110`}
          color="#0a8cde"
        />
      </div>

      <div
        className={`delayed-fade-in w-[50px] h-[50px] rounded-full flex justify-center items-center bg-white absolute left-1/2 top-1/2 z-[2] cursor-pointer shadow-[0px_0px_hsla(0,100%,100%,0.333)] transform transition-all duration-300 hover:scale-110 hover:shadow-[8px_8px_#0005] ${translationRestricted ? 'opacity-50' : ''}`}
        onClick={() => handleTranslate()}
        style={{ pointerEvents: loadingState ? 'none' : 'auto' }}
      >
        <FontAwesomeIcon
          icon={loadingState ? faArrowsRotate : (translationRestricted ? faLock : faArrowRight)}
          className={`fa-2xl transform transition-all duration-300 hover:scale-110 max-[850px]:rotate-90 ${translationRestricted ? 'opacity-50' : ''}`}
          color={translationRestricted ? "#666" : "#0a8cde"}
          style={loadingState ? { animation: 'spin 1s linear infinite' } : {}}
        />
      </div>
    </>
  );
}
