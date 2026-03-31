import React, { useEffect, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faVolumeHigh } from '@fortawesome/free-solid-svg-icons';

export default function Dictionary({ word, lang }) {
  const [definition, setDefinition] = useState(null);

  useEffect(() => {
    if (!word) {
      setDefinition(null);
      return;
    }
    
    // MOCK DATA: Here you would normally fetch from your dictionary API:
    // fetch(`/api/dictionary?word=${word}&lang=${lang.code}`).then(...)
    
    // Mock response based on the word selected to visualize the design similar to DeepL
    setDefinition({
      term: word.toLowerCase(),
      type: "interjección",
      translations: [
        { 
          term: "hello", 
          type: "interj", 
          examples: ["Hola, ¿cómo estás?", "Hello, how are you?"] 
        },
        { 
          term: "hi", 
          type: "interj", 
          informal: true 
        }
      ]
    });
  }, [word, lang]);

  return (
    <div className="w-full text-left relative z-[2] flex flex-col items-center pt-2">
      <div className="w-[calc(100%-80px)] max-[850px]:w-[calc(100%-40px)] flex flex-col justify-start">
        <div className="flex items-center border-[0px] border-b-[3px] border-b-[#c8d1e1] pb-[5px] pt-[15px] mb-6 w-full">
          <strong className="font-['Roboto_Condensed',sans-serif] text-[18px] text-[#0a8cde] mr-[10px] cursor-default">
            Diccionario
          </strong>
        </div>
        
        {!word ? (
          <div className="flex items-center gap-2 text-slate-400 italic text-sm mb-4">
            <span>Haz clic en una palabra para ver su definición.</span>
          </div>
        ) : definition ? (
          <div className="space-y-4 w-full">
            <div className="flex items-center gap-3">
              <span className="text-2xl font-medium text-slate-800">{definition.term}</span>
              {definition.type && <span className="text-sm text-slate-500">{definition.type}</span>}
              <button className="text-[#0a8cde] hover:text-[#067ac1] transition">
                <FontAwesomeIcon icon={faVolumeHigh} className="text-lg" />
              </button>
            </div>
            
            <ul className="space-y-6 mt-4">
              {definition.translations.map((tr, idx) => (
                <li key={idx} className="pl-6 border-l-2 border-[#0a8cde]">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg font-medium text-[#0a8cde]">{tr.term}</span>
                    <span className="text-sm text-slate-500">{tr.type}</span>
                    {tr.informal && <span className="text-sm text-slate-400 italic">[coloq.]</span>}
                    <button className="text-[#0a8cde] hover:text-[#067ac1] transition ml-1">
                      <FontAwesomeIcon icon={faVolumeHigh} className="text-sm" />
                    </button>
                  </div>
                  
                  {tr.examples && tr.examples.length > 0 && (
                    <div className="mt-2 text-slate-600 text-sm grid grid-cols-2 gap-4">
                      <div className="text-slate-500">{tr.examples[0]}</div>
                      <div className="text-[#0a8cde]">{tr.examples[1]}</div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-slate-500">
            <span className="animate-pulse">Buscando "{word}"...</span>
          </div>
        )}
      </div>
    </div>
  );
}
