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
import "./requestaccess.css"
import api from "../api";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import ActionButton from "../components/actionButton/actionButton";
import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react"
import { API_ENDPOINTS, REQUEST_ACCESS_REASONS, LANG_TITLE, VARIANT_LANG } from '../constants';
import { toast } from "sonner";

export default function RequestAccess(){

  const router = useRouter();
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [accessReason, setAccessReason] = useState('Curiosity');
  const [errorMessage, setErrorMessage] = useState('');
  const [submitStatus, setSubmitStatus] = useState(false);
  const [organization, setOrganization] = useState('');

  const [disableSubmit, setDisableSubmit] = useState(false);

  const validateEmail = (email) => {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
  };

  const checkFormStatus = () => {
    if(!firstName || !lastName || !validateEmail(email)){
      setDisableSubmit(true);
    }
    else{

      if(accessReason === 'Work' && organization.length === 0){
        setDisableSubmit(true);
      }
      else{
        setDisableSubmit(false);
      } 
    }
  }

  const handleLogin = () => {
    router.push('/login')
  };
  
  const handleSubmit = async () => {
    try {
      if(accessReason !== 'Work'){
        await api.post(
          API_ENDPOINTS.REQUESTS, 
          {
            email: email,
            first_name: firstName,
            last_name: lastName,
            reason: accessReason,
          }
        )
      }
      else{
        await api.post(
          API_ENDPOINTS.REQUESTS, 
          {
            email: email,
            first_name: firstName,
            last_name: lastName,
            reason: accessReason,
            organization: organization
          }
        )
      }
      
      setSubmitStatus(true);
    } 
    catch (error) {
      console.log('Error sending register request')
      if (error.response.status == 400) {
        console.log(error.response.data)
        if (error.response.data.email) {
          toast("Error al enviar solicitud",{
            description: "El correo ingresado ya tiene una solicitud activa"
          });
        }
        //setErrorMessage("El correo ingresado ya tiene una solicitud activa");
      }
    }
  }
  
  const reasonOptions = REQUEST_ACCESS_REASONS;


  useEffect(() => {
    checkFormStatus();
  }, [firstName, lastName, organization, checkFormStatus])

  return (
    <div className="bg-default w-full h-[100dvh] relative">
      <div 
        className="
          animate-fade animate-once animate-duration-[1200ms] animate-delay-[700ms] animate-ease-in-out 
          bg-[url('/images/${VARIANT_LANG}-2-blue.png')] w-full h-full absolute bg-left-bottom bg-no-repeat bg-contain max-[850px]:scale-y-90 -scale-x-100
          max-[850px]:bg-left-top
        "
      />
      
      <div className="
        absolute
        h-[95dvh] w-[51.1dvw] py-10
        max-[850px]:h-fit max-[850px]:min-h-[75dvh] max-[850px]:w-[97dvw] max-[850px]:top-[22dvh] max-[850px]:left-[1.5dvw]
        bg-white/[0.2]
        rounded-r-[30px] max-[850px]:rounded-t-[30px] max-[850px]:rounded-br-none
        requestAccess-back-card
        "
      />
      <div className="
        absolute
        h-full w-1/2 py-10
        max-[850px]:h-fit max-[850px]:min-h-[75dvh] max-[850px]:w-full
        flex flex-col justify-center items-center
        bg-white
        rounded-r-[30px] max-[850px]:rounded-t-[30px] max-[850px]:rounded-br-none
        requestAccess-card
        "
      >
        
        <div 
          className="
            flex 
            items-center 
            mb-[25px] w-[70%] gap-[10px] 
            justify-end
            max-[850px]:w-[90%]
            "
        >
          <b className="text-xs"> ¿Ya tienes una cuenta? </b>

          <Button 
            className="
              h-7 
              bg-[#068cdc1a] 
              text-default text-xs font-bold 
              hover:bg-default hover:text-white
              "
              onClick={handleLogin}
            >
            Iniciar sesión
          </Button>
        </div>
        
        {submitStatus?
          <>
            <div className="flex flex-col w-[70%] mb-[20px] gap-[10px] max-[850px]:w-[90%]">
              <h2>
                Solicitud enviada
              </h2>
              <span className="text-sm ">
              Gracias por enviar tu solicitud. Tu solicitud será revisada por personal del la <strong>Academia de la Lengua {LANG_TITLE}</strong>. 
              Una vez aceptada tu solicitud se te enviará un <strong>correo electrónico</strong> confirmando aquello junto a un enlace para que puedas registrar tu cuenta.
              </span>
            </div>
          </>
          :
          <>

            <div className="flex flex-col w-[70%] mb-[20px] gap-[10px] max-[850px]:w-[90%]">
              <h2>
                Solicitud de acceso
              </h2>
              <span className="text-sm ">
              El traductor se encuentra en desarrollo y esta es su <strong>primera versión operativa</strong>.
                Se encuentra en un proceso de <strong>mejora continua</strong>, por lo que puede cometer errores o
                producir resultados inesperados. Agradecemos su comprensión y su retroalimentación,
                que nos ayuda a mejorar su precisión y utilidad.
              </span>
            </div>

            <form className="w-[70%] flex flex-col items-center gap-[20px] max-[850px]:w-[90%] max-[850px]:mb-[10px]" onSubmit={handleSubmit}>

              <div className="relative w-full h-[50px]">
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="block h-full px-2.5 pb-2.5 pt-4 w-full text-sm text-gray-900 bg-transparent rounded-lg border border-gray-300 appearance-none focus:outline-none focus:ring-0 focus:border-default peer"
                  placeholder=" "
                />
                <label
                  htmlFor="email"
                  className="absolute text-sm rounded-full text-gray-500 duration-300 transform -translate-y-4 scale-75 top-2 z-10 origin-[0] bg-white px-2 peer-focus:px-2 peer-focus:text-blue-600 peer-placeholder-shown:scale-100 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:top-1/2 peer-focus:top-2 peer-focus:scale-75 peer-focus:-translate-y-4 left-1"
                >
                  Email
                </label>
              </div>
              <div className="relative w-full h-[50px]">
                <input
                  id="first-name"
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  className="block h-full px-2.5 pb-2.5 pt-4 w-full text-sm text-gray-900 bg-transparent rounded-lg border border-gray-300 appearance-none focus:outline-none focus:ring-0 focus:border-default peer"
                  placeholder=" "
                />
                <label
                  htmlFor="first-name"
                  className="absolute text-sm rounded-full text-gray-500 duration-300 transform -translate-y-4 scale-75 top-2 z-10 origin-[0] bg-white px-2 peer-focus:px-2 peer-focus:text-default peer-placeholder-shown:scale-100 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:top-1/2 peer-focus:top-2 peer-focus:scale-75 peer-focus:-translate-y-4 left-1"
                >
                  Nombre
                </label>
              </div>

              <div className="relative w-full h-[50px]">
                <input
                  id="last-name"
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                  className="block h-full px-2.5 pb-2.5 pt-4 w-full text-sm text-gray-900 bg-transparent rounded-lg border border-gray-300 appearance-none focus:outline-none focus:ring-0 focus:border-default peer"
                  placeholder=" "
                />
                <label
                  htmlFor="last-name"
                  className="absolute text-sm rounded-full text-gray-500 duration-300 transform -translate-y-4 scale-75 top-2 z-10 origin-[0] bg-white px-2 peer-focus:px-2 peer-focus:text-default peer-placeholder-shown:scale-100 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:top-1/2 peer-focus:top-2 peer-focus:scale-75 peer-focus:-translate-y-4 left-1"
                >
                  Apellido
                </label>
              </div>

              <div className="relative w-full h-[50px]">
                <select
                  id="reason"
                  value={accessReason}
                  onChange={(e) => setAccessReason(e.target.value)}
                  required
                  className="block h-full px-2.5 pb-2.5 pt-4 w-full text-sm text-gray-900 bg-transparent rounded-lg border border-gray-300 appearance-none focus:outline-none focus:ring-0 focus:border-default peer"
                >
                  {reasonOptions.map((reason) => (
                    <option key={reason.value} value={reason.value}>
                      {reason.name}
                    </option>
                  ))}
                </select>
                <label
                  htmlFor="reason"
                  className="absolute text-sm rounded-full text-gray-500 duration-300 transform -translate-y-4 scale-75 top-2 z-10 origin-[0] bg-white px-2 peer-focus:px-2 peer-focus:text-default peer-placeholder-shown:scale-100 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:top-1/2 peer-focus:top-2 peer-focus:scale-75 peer-focus:-translate-y-4 left-1"
                >
                  Cuéntanos por qué necesitas acceso temprano
                </label>

                <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
              </div>
              
              {accessReason === 'Work' &&
                <div className="relative w-full h-[50px]">
                  <input
                    id="organization"
                    type="text"
                    value={organization}
                    onChange={(e) => setOrganization(e.target.value)}
                    required
                    className="block h-full px-2.5 pb-2.5 pt-4 w-full text-sm text-gray-900 bg-transparent rounded-lg border border-gray-300 appearance-none focus:outline-none focus:ring-0 focus:border-default peer"
                    placeholder=" "
                  />
                  <label
                    htmlFor="organization"
                    className="absolute text-sm rounded-full text-gray-500 duration-300 transform -translate-y-4 scale-75 top-2 z-10 origin-[0] bg-white px-2 peer-focus:px-2 peer-focus:text-default peer-placeholder-shown:scale-100 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:top-1/2 peer-focus:top-2 peer-focus:scale-75 peer-focus:-translate-y-4 left-1"
                  >
                    Organización
                  </label>
                </div>
              }

              {errorMessage && (
                <div className="error-message">{errorMessage}</div>
              )}

              <ActionButton
                disabled={disableSubmit}
                clickCallback={handleSubmit}
                className="w-full h-[50px] text-md border-hidden"
              >
                Solicitar acceso
              </ActionButton>

            </form>
          </>
        }
      </div>  
    </div>
  )
}