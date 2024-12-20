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
import './bootModelModal.css'
import { useEffect } from 'react';
import { Button } from "@/components/ui/button"
import ActionButton from "../actionButton/actionButton"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Loader2 } from 'lucide-react'

export default function BootModelModal(props){

  const modelStatus = props.modelStatus;  
  const checkModelState = props.checkModelState;
  const onClose = props.onClose;

  useEffect(() => {

    const timer = setInterval(() => {
      if (modelStatus === 'booting') {
        checkModelState();
      }
    }, 15000); // 15000 ms = 15 seconds

    return () => clearInterval(timer);
  }, [modelStatus, checkModelState]);
  
  return (
    <Dialog open={props.isOpen}>
      <DialogContent className="flex flex-col justify-center max-[850px]:w-4/5 w-2/5 h-2/5" PreventClose>
        <DialogHeader>
          <DialogTitle>Activar modelo</DialogTitle>
          <DialogDescription>
            El modelo de traducción se encuentra actualemente inactivo. Presione el botón "Activar modelo" para iniciar el proceso de carga del modelo.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center justify-center py-4">
          {modelStatus === 'down' && (
            <ActionButton
              tooltipText="Activar modelo"
              clickCallback={() => props.onTurnModelOn()}
            >
              Activar modelo
            </ActionButton>
          )}
          {modelStatus === 'booting' && (
            <div className="flex flex-col items-center">
              <Loader2 className="h-10 w-10 animate-spin text-default" />
              <p className="mt-2 text-sm text-muted-foreground">Inicializando modelo...</p>
              <p className="mt-1 text-xs text-muted-foreground">Esto suele demorarse entre 5 y 10 minutos.</p>
            </div>
          )}  
          {modelStatus === 'up' && (
            <div className="flex flex-col items-center">
              <div className="h-8 w-8 rounded-full bg-default flex items-center justify-center">
                <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">¡Modelo activado con éxito!</p>
            </div>
          )}
        </div>
        <DialogFooter>
          {modelStatus === 'up' && (
            <Button onClick={onClose} className="bg-default">
              Cerrar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )

}