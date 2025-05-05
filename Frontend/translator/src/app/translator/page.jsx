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

import { useState , useEffect} from 'react'
import "./translator.css"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faThumbsDown , faThumbsUp , faArrowsRotate, faArrowRightArrowLeft, faArrowRight } from "@fortawesome/free-solid-svg-icons";
import Card from "../components/card/card.jsx"
import FeedbackModal from '../components/feedbackModal/feedbackModal.jsx'
import { Button } from "@/components/ui/button";
import api from '../api';
import LangsModal from '../components/langsModal/langsModal.jsx'
import { API_ENDPOINTS } from '../constants';
import { VARIANT_LANG,  } from "@/app/constants";
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function Translator() {

  const [srcText, setSrcText] = useState('');
  const [dstText, setDstText] = useState('');
  const [srcLang, setSrcLang] = useState({
    "name": "Español",
    "writing": "Latn",
    "code": "spa_Latn",
    "dialect": null
  });
  const [dstLang, setDstLang] = useState(VARIANT_LANG === 'arn'? {
    "name": "Huilliche Azümchefe",
    "writing": "a0",
    "code": 'arn_a0_h',
    "dialect": "n"
  } : {
    "name": "Rapa Nui",
    "writing": "Latn",
    "code": "rap_Latn",
    "dialect": null
  });
  
  const [langModalMode, setLangModalMode] = useState(false);
  const [modalBtnSide, setModalBtnSide] = useState('');

  const [feedbackData, setFeedbackData] = useState(null);
  const [modelData, setModelData] = useState(null);

  const [loadingState, setLoadingState] = useState(false);

  const [showDevModal, setShowDevModal] = useState(true);

  const [isMobile, setIsMobile] = useState(false);

  const getLangs = async (code, script, dialect) => {
    let params = {};

    if (code !== null) {
      params.code = code;
    }
    if (script !== null) {
        params.script = script;
    }
    if (dialect !== null) {
      params.dialect = dialect;
    }
    try {
      const res = await api.get(API_ENDPOINTS.LANGUAGES,
        {
          params: params
        }
      );
      console.log(res.data);
      return res.data;
    } catch (error) {
      console.log('Error getting languages');
    }
  }  

  const handleSrcLang = lang =>{
    setSrcLang(lang);
  };

  const handleDstLang = lang => {
    setDstLang(lang);
  };

  const handleLangModalBtnLeft = () => {
    setModalBtnSide('left');
    setLangModalMode(true);
  };

  const handleLangModalBtnRight = () => {
    setModalBtnSide('right');
    setLangModalMode(true);
  };

  const handleCrossLang = async () => {

    if(loadingState === false){

      setLoadingState(true);
      setSrcText(dstText);
      setSrcLang(dstLang);
      setDstLang(srcLang);
      await new Promise(resolve => setTimeout(resolve, 1000));
      setDstText(srcText);
      setLoadingState(false);
    }
  };
 
  const handleSelectedLangModal = (lang) => {
    if (modalBtnSide === 'left'){
      setSrcLang(lang);
    }
    else{
      setDstLang(lang);
    }
    setModalBtnSide('');
    setLangModalMode(false);
  };

  const handleNegativeFeedback = () => {
    if (dstText.length != 0 && !loadingState){
      setFeedbackData({
        'src_text': srcText,
        'dst_text': dstText,
        'src_lang': srcLang,
        'dst_lang': dstLang,
        'suggestion': dstText
      });
    }
  };

  const handlePositiveFeedback = async () => {
    if (dstText.length != 0 && !loadingState){

      try {

        await api.post(
          API_ENDPOINTS.SUGGESTIONS+'accept_translation/',
          {
            src_text: srcText,
            dst_text: dstText,
            src_lang: srcLang,
            dst_lang: dstLang,
            model_name: modelData.modelName,
            model_version: modelData.modelVersion
          },
        );

        toast("Sugerencia enviada con éxito",{
          description: "Gracias por su retroalimentación",
          cancel: {
            label: 'Cerrar',
            onClick: () => console.log('Pop up cerrado'),
    },
        });
        
      } catch(error) {
          if (error.response.status === 401){
            toast("Error",{
              description: "Debe ingresar su usuario para ocupar todas las funcionalidades de la aplicación",
              cancel: {
                label: 'Cerrar',
                onClick: () => console.log('Pop up cerrado'),
              },
            })
          }
          console.log(error) 
      }
    }
  };

  const handleSrcText = (text) => {
    setSrcText(text);
  }

  const translate = async () => {
    if(!loadingState){
      if(srcText.length === 0){
        setDstText('');
      }
      else{
        setLoadingState(true);
        
        try {
          // Add timer for long-running request
          let timeoutId = setTimeout(() => {
            toast("La traducción está tardando más tiempo de lo esperado...", {
              description: "Por favor, espere un momento mientras el modelo se carga",
              duration: 20000,
              cancel: {
                label: 'Cerrar',
                onClick: () => console.log('Pop up cerrado'),
              },
            });
          }, 5000);
          const res = await api.post(
            API_ENDPOINTS.TRANSLATION,
            {
              src_text: srcText,
              src_lang: srcLang,
              dst_lang: dstLang,
            },
          );
          
          setDstText(res.data.dst_text);
          setModelData({
            modelName: res.data.model_name,
            modelVersion: res.data.model_version
          });
          clearTimeout(timeoutId);

        } 
        catch (error) {
          console.log(error)
          if (error.response.status === 400){
            toast("Error",{
              description: "Por favor reintente la traducción",
              cancel: {
                label: 'Cerrar',
                onClick: () => console.log('Pop up cerrado'),
              },
            })
          }
          console.log('Error in translation')
        } 
        finally {
          setLoadingState(false);
        }
        
      }
    }
    else{
      setLoadingState(false);
    }

  }

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      translate();
    }, 1500);

    return () => clearTimeout(timeoutId);
  }, [srcText, srcLang, dstLang]);

  return (
    <div className="translator-container">

      <Dialog open={showDevModal} onOpenChange={setShowDevModal}>
      <DialogContent className='h-fit w-1/2 gap-y-4 py-5 max-[850px]:w-3/4'>
        <DialogHeader>
          <DialogTitle>Modelo en fase de desarrollo</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <p>
          El traductor se encuentra en desarrollo y esta es su <strong>primera versión operativa</strong>.
            Se encuentra en un proceso de <strong>mejora continua</strong>, por lo que puede cometer errores o
            producir resultados inesperados. Agradecemos su comprensión y su retroalimentación,
            que nos ayuda a mejorar su precisión y utilidad.
          </p>
        </div>
        </DialogContent>
      </Dialog>
      <Card
        side={"left"}
        srcText={srcText}
        lang={srcLang}
        handleSrcText={handleSrcText}
        handleSrcLang={handleSrcLang}
        handleLangModalBtn={handleLangModalBtnLeft}
      />

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
        className={`delayed-fade-in w-[50px] h-[50px] rounded-full flex justify-center items-center bg-white absolute left-1/2 top-1/2 z-[2] cursor-pointer shadow-[0px_0px_hsla(0,100%,100%,0.333)] transform transition-all duration-300 hover:scale-110 hover:shadow-[8px_8px_#0005]`}
        onClick={() => translate()}
        style={{ pointerEvents: loadingState ? 'none' : 'auto' }}
      >
        <FontAwesomeIcon
          icon={loadingState ? faArrowsRotate : faArrowRight}
          className={`fa-2xl transform transition-all duration-300 hover:scale-110 max-[850px]:rotate-90`}
          color="#0a8cde"
          style={loadingState ? { animation: 'spin 1s linear infinite' } : {}}
        />
      </div>

      <Card
        side={"right"}
        dstText={dstText}
        lang={dstLang}
        handleDstLang={handleDstLang}
        handleLangModalBtn={handleLangModalBtnRight}
      />

      <div className="translator-footer">

        <strong>¿Qué te ha parecido esta traducción?</strong>

        <FontAwesomeIcon
          icon={faThumbsUp}
          size="lg"
          onClick={() => handlePositiveFeedback()}
        />

        <FontAwesomeIcon
          icon={faThumbsDown}
          size="lg"
          onClick={() => handleNegativeFeedback()}
        />

      </div>

      <LangsModal
        isOpen={langModalMode}
        langModalSelected={modalBtnSide === 'right'? dstLang : srcLang}
        handleCloseModal={setLangModalMode}
        handleSelectedLanguage={handleSelectedLangModal}
      />

      <FeedbackModal
        editingTranslation={feedbackData}
        setEditingTranslation={setFeedbackData}
        modelData={modelData}
        suggestionId={null}
      />
      
    </div>
  );
}