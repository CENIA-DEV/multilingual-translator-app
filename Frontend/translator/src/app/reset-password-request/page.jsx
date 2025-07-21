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
import "./resetpasswordrequest.css"
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import ActionButton from "../components/actionButton/actionButton";
import { API_ENDPOINTS, VARIANT_LANG } from "../constants";
import api from "../api";
import { toast } from "sonner";

export default function Resetpasswordrequest(){

  const router = useRouter();

  const [email, setEmail] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [submitStatus, setSubmitStatus] = useState(false);

  const [disableSubmit, setDisableSubmit] = useState(false);

  const checkFormStatus = () => {
    if(!validateEmail(email)){
      setDisableSubmit(true);
    }
    else{
      setDisableSubmit(false);
    }
  }

  const validateEmail = (email) => {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
  };

  const handleSubmit = async () => {
    
    try {
      await api.post(
        API_ENDPOINTS.PASSWORD_RECOVERY+'recover_password/',
        {email: email}
      );
      setSubmitStatus(true);

      toast("Solicitud enviada",{
        description: "La solicitud de recuperación de contraseña ha sido enviada con éxito",
      });
    } 
    catch (error) {
      console.log('Error sending recovery token')
      
      toast("Error al enviar solicitud",{
        description: "El correo ingresado no se encuentra registrado en la plataforma",
      });
      
      //setErrorMessage("El correo ingresado no tiene una cuenta existente en la plataforma.")
      // TO DO: SET FORM ERROR TEXT MESSAGE
    }
  }

  useEffect(() => {
    checkFormStatus();
  }, [email, checkFormStatus])
	
  return (
    <div className="bg-default w-full h-[100dvh] relative">
      <div 
        className="
          animate-fade animate-once animate-duration-[1200ms] animate-delay-[700ms] animate-ease-in-out 
          bg-[url('/images/${VARIANT_LANG}-2-blue.png')] w-full h-full absolute bg-left-bottom bg-no-repeat bg-contain -scale-x-100
          max-[850px]:bg-left-top
        "
      />
      
      <div className="
        absolute
        h-[95dvh] w-[51.1dvw] py-10
        max-[850px]:h-fit max-[850px]:min-h-[75dvh] max-[850px]:w-[97dvw] max-[850px]:top-[22dvh] max-[850px]:left-[1.5dvw]
        bg-white/[0.2]
        rounded-r-[30px] max-[850px]:rounded-t-[30px] max-[850px]:rounded-br-none
        resetPasswordRequest-back-card
        "
      />
      <div className="
        absolute
        h-full w-1/2 py-10
        max-[850px]:h-fit max-[850px]:min-h-[75dvh] max-[850px]:w-full
        flex flex-col justify-center items-center
        bg-white
        rounded-r-[30px] max-[850px]:rounded-t-[30px] max-[850px]:rounded-br-none
        resetPasswordRequest-card
        "
      >
        {submitStatus?
          <>
          <div className="flex flex-col w-[70%] mb-[50px] gap-[10px] max-[850px]:w-[90%]">
            <h2>
              Solicitud enviada con éxito
            </h2>
            <span>
              En unos instantes llegará a tu correo los pasos a seguir para restablecer tu constraseña.
            </span>
          </div>
          </>
          :
          <>
          <div className="flex flex-col w-[70%] mb-[50px] gap-[10px] max-[850px]:w-[90%]">
            <h2>
              Recuperar contraseña
            </h2>
            <span>
              ¿Olvidaste tu contraseña? No te preocupes, estamos aquí para ayudarte. Introduce tu correo electrónico a continuación y te enviaremos un enlace con las instrucciones para que puedas recuperar tu acceso.
            </span>
          </div>

          <form className="w-[70%] flex flex-col items-center gap-[20px] max-[850px]:w-[90%]" onSubmit={handleSubmit}>

            <div className="relative w-full h-[50px]">
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="block px-2.5 pb-2.5 pt-4 w-full text-sm text-gray-900 bg-transparent rounded-lg border border-gray-300 appearance-none focus:outline-none focus:ring-0 focus:border-default peer"
                placeholder=" "
              />
              <label
                htmlFor="email"
                className="absolute text-sm rounded-full text-gray-500 duration-300 transform -translate-y-4 scale-75 top-2 z-10 origin-[0] bg-white px-2 peer-focus:px-2 peer-focus:text-blue-600 peer-placeholder-shown:scale-100 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:top-1/2 peer-focus:top-2 peer-focus:scale-75 peer-focus:-translate-y-4 left-1"
              >
                Email
              </label>
            </div>
            

            {errorMessage && (
              <div className="error-message">{errorMessage}</div>
            )}

            <ActionButton
              disabled={disableSubmit}
              clickCallback={handleSubmit}
              className="w-full h-[50px] text-md border-hidden"
            >
              Recuperar contraseña
            </ActionButton>

          </form>
          </>
        }
      </div>
    </div>
  )
}