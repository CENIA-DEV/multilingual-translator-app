import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function WarningModals({
  showDevModal,
  setShowDevModal,
  translationRestrictedDialogOpen,
  setTranslationRestrictedDialogOpen,
  handleLogin
}) {
  return (
    <>
      <Dialog open={showDevModal} onOpenChange={setShowDevModal}>
        <DialogContent className='h-fit w-1/2 gap-y-4 py-5 max-[850px]:w-5/6'>
          <DialogHeader>
            <DialogTitle>Modelo en desarrollo</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p>
            El traductor se encuentra en desarrollo y esta es una <strong>versión operativa de prueba</strong>.
              Se encuentra en un proceso de <strong>mejora continua</strong>, por lo que puede cometer errores o
              producir resultados inesperados. Los <strong>resultados siempre deben ser verificados por hablantes</strong>. Agradecemos su comprensión y su retroalimentación,
              que nos ayuda a mejorar su precisión y utilidad.
            </p>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={translationRestrictedDialogOpen} onOpenChange={setTranslationRestrictedDialogOpen}>
        <DialogContent className='h-fit w-1/2 gap-y-4 py-5 max-[850px]:w-3/4'>
          <DialogHeader>
            <DialogTitle>Acceso restringido</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p>
              El traductor se encuentra en una fase preliminar de prueba por lo que 
              debe <strong>iniciar sesión</strong> para usar el traductor en esta versión.
            </p>
          </div>
          <div className="flex justify-center">
            <Button 
              className='bg-[#068cdc1a] text-default text-xs font-bold hover:bg-default hover:text-white' 
              onClick={() => handleLogin()}
            >
              Iniciar sesión
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
