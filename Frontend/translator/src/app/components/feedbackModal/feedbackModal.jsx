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
import './feedbackModal.css'
import api from '@/app/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { API_ENDPOINTS } from '@/app/constants';  
import ActionButton from '../actionButton/actionButton';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useAnalytics } from '@/hooks/useAnalytics';
import { Checkbox } from '@/components/ui/checkbox'; // Add this import

export default function FeedbackModal(props){

  const modelData = props.modelData
  const editingTranslation = props.editingTranslation
  const validatedSuggestion = props.validatedSuggestion
  const suggestionId = props.suggestionId
  const setEditingTranslation = props.setEditingTranslation
  const isSuggestionOnly = props.isSuggestionOnly;
  const { trackEvent } = useAnalytics();

  const uploadSuggestion = async (suggestion) => {
    try {
      if (suggestionId === null){
        const url = isSuggestionOnly
          ? API_ENDPOINTS.SUGGESTIONS + 'add_suggestion/'
          : API_ENDPOINTS.SUGGESTIONS + 'reject_translation/';
        await api.post(
          url,
          {
            ...suggestion,
            model_name: modelData.modelName,
            model_version: modelData.modelVersion,
            is_uncertain: suggestion.is_uncertain || false,
          }
        );

        setEditingTranslation(null);

        toast("Retroalimentación enviada con éxito",{
          description: "Gracias por su retroalimentación",
        });

        trackEvent(isSuggestionOnly ? 'suggestion_only_submit_success' : 'negative_feedback_submit_success', {
          page: 'translator',
          is_uncertain: suggestion.is_uncertain || false // Track uncertainty
        });

      }
    } 
    catch (error) {
      if (error.response.status === 401){
        toast("Error",{
          description: "Debe ingresar su usuario para ocupar todas las funcionalidades de la aplicación",
        })
      }
      console.log(error.response.data)
      trackEvent(isSuggestionOnly ? 'suggestion_only_submit_error' : 'negative_feedback_submit_error', {
        page: 'translator',
        error: error.response.status
      });
    }
  } 

  const editSuggestion = async (suggestion) => {
    try {
      if(suggestion.validated){
        await api.patch(
          API_ENDPOINTS.SUGGESTIONS+suggestionId+'/',
          {
            src_text: suggestion.src_text,
            dst_text: suggestion.dst_text
          }
        )

        toast("Retroalimentación actualizada",{
          description: "La retroalimentación ha sido actualizada correctamente",
          cancel: {
            label: 'Cerrar',
            onClick: () => console.log('Pop up cerrado'),
          },
        })
      }
      else {
        await api.patch(
          API_ENDPOINTS.SUGGESTIONS+suggestionId+'/accept_suggestion/',
          {
            src_text: suggestion.src_text,
            updated_suggestion: suggestion.suggestion
          }
        )

        toast("Retroalimentación actualizada y aceptada",{
          description: "La retroalimentación ha sido actualizada y aceptada correctamente",
          cancel: {
            label: 'Cerrar',
            onClick: () => console.log('Pop up cerrado'),
          },
        }) 

      }

      props.updateTable();
      setEditingTranslation(null);

    } 
    catch (error) {
      if (error.response.status === 401){
        toast("Error",{
          description: "Debe ingresar su usuario para ocupar todas las funcionalidades de la aplicación",
          cancel: {
            label: 'Cerrar',
            onClick: () => console.log('Pop up cerrado'),
          },
        })
      }
      console.log(error.response.data)
    }
  }

  const handleSaveEdit = async () => {
    try {
      if(suggestionId === null){
        await uploadSuggestion(editingTranslation);
      }
      else{
        await editSuggestion(editingTranslation);
    }
    } 
    catch (error) {
      console.log(error.response.data)
    }
  }

  return (
    <Dialog open={!!editingTranslation} onOpenChange={() => setEditingTranslation(null)}>
    <DialogContent className={isSuggestionOnly ? 'h-fit w-3/4 gap-y-4 max-w-2xl' : 'h-3/4 w-3/4 gap-y-4'}>
      <DialogHeader>
        <DialogTitle>{isSuggestionOnly ? 'Sugerencias o comentarios' : 'Enviar retroalimentación'}</DialogTitle>
        <DialogDescription>
          <span>{isSuggestionOnly ? 'Comparte tus comentarios o sugerencias sobre la plataforma' : '¿Quieres sugerir una traducción alternativa?'}</span>
          <br />
          {editingTranslation && suggestionId && (
            <span>
              Retroalimentación ingresada por: {editingTranslation.user ? editingTranslation.user.email : 'Anónimo'}
            </span>
          )}
        </DialogDescription>
      </DialogHeader>
      
      {isSuggestionOnly ? (
        // NEW SIMPLE LAYOUT: Just one comment box
        <div className="flex flex-col gap-4 py-5">
          <div className="flex flex-col gap-2">
  
            <Textarea
              id="suggestion"
              value={editingTranslation?.suggestion || ''}
              onChange={(e) => setEditingTranslation({...editingTranslation, suggestion: e.target.value})}
              className="min-h-[200px] border shadow-sm resize-none"
              placeholder="Escribe aquí..."
            />
          </div>
        </div>
      ) : (
        // ORIGINAL LAYOUT: 2 boxes side by side (for negative feedback)
        <>
          <div className="flex flex-row max-[850px]:flex-col items-start gap-4 h-3/4 pt-5">
            <div className="flex flex-col items-center max-[850px]:w-full gap-4 w-1/2 h-full">
              <label htmlFor="source" className="text-right font-semibold">Fuente {editingTranslation?.src_lang.code !== 'spa_Latn' ? (
                <Badge variant="secondary" className='bg-default hover:bg-defaultHover text-white min-w-fit'>{editingTranslation?.src_lang.name}</Badge>
              ) : (
                <Badge variant="secondary" className='bg-red-500 hover:bg-red-600 text-white min-w-fit'>{editingTranslation?.src_lang.name}</Badge>
              )}
              </label>
              <Textarea
                id="source"
                value={editingTranslation?.src_text || ''}
                onChange={(e) => setEditingTranslation({...editingTranslation, src_text: e.target.value})}
                className="col-span-3 h-3/4 border shadow-sm"
              />
            </div>
            <div className="flex flex-col items-center max-[850px]:w-full gap-4 w-1/2 h-full">
              <label htmlFor="translation" className="text-right font-semibold">Traducción {editingTranslation?.dst_lang.code !== 'spa_Latn' ? (
                <Badge variant="secondary" className='bg-default hover:bg-defaultHover text-white min-w-fit'>{editingTranslation?.dst_lang.name}</Badge>
              ) : (
                <Badge variant="secondary" className='bg-red-500 hover:bg-red-600 text-white min-w-fit'>{editingTranslation?.dst_lang.name}</Badge>
              )}
              </label>
              {validatedSuggestion?
                <Textarea
                  id="translation"
                  value={editingTranslation?.dst_text || ''}
                  onChange={(e) => setEditingTranslation({...editingTranslation, dst_text: e.target.value})}
                  className="col-span-3 h-3/4 border shadow-sm"
                />
                :
                <Textarea
                  id="translation"
                  value={editingTranslation?.suggestion || ''}
                  onChange={(e) => setEditingTranslation({...editingTranslation, suggestion: e.target.value})}
                  className="col-span-3 h-3/4 border shadow-sm"
                />
              }
            </div>
          </div>
          
          <DialogFooter className="pt-5 flex flex-row items-center">
  <div className="flex items-center gap-2 mr-auto">
    <Checkbox
      id="uncertain"
      checked={editingTranslation?.is_uncertain || false}
      onCheckedChange={(checked) => 
        setEditingTranslation({...editingTranslation, is_uncertain: checked})
      }
    />
    <label 
      htmlFor="uncertain" 
      className="text-sm font-medium leading-none cursor-pointer"
    >
      No estoy seguro/a de cuál es la traducción correcta
    </label>
  </div>
  <ActionButton
    clickCallback={() => handleSaveEdit()} 
  >
    Enviar
  </ActionButton>
</DialogFooter>
        </>
      )}

      </DialogContent>
    </Dialog>
  )
}