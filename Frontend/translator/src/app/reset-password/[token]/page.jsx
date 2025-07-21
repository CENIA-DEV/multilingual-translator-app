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
import "./resetpassword.css"
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useEffect } from "react";
import ActionButton from "../../components/actionButton/actionButton";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff } from "lucide-react"
import { API_ENDPOINTS, VARIANT_LANG } from "@/app/constants";
import api from "@/app/api";
import { toast } from "sonner";


export default function Resetpassword({params}){

  const router = useRouter();
  const resetPasswordToken = params.token;
  
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitStatus, setSubmitStatus] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  
  const [disableSubmit, setDisableSubmit] = useState(false);
  
  const checkFormStatus = () => {
    if(!password){
      setDisableSubmit(true);
    }
    else{
      setDisableSubmit(false);
    }
  }

  const handleSubmit = async () => {

    try {
      await api.patch(
        API_ENDPOINTS.USERS+'update_password_token/', 
        {
          token: resetPasswordToken,
          password: password
        }
      )
      setSubmitStatus(true);

      toast("Contraseña restablecida",{
        description: "La contraseña ha sido restablecida con éxito",
      });
    }
    catch (error) {
      // TO DO: SET FORM ERROR TEXT MESSAGE
      console.log('Error updating password')
      if (error.response.status == 404) {
        console.log('Token not found')
      } else if (error.response.status == 400) {
        console.log('Token expired')
      } else {
        console.log('Error updating user password')
      }
    }
  }
  
  useEffect(() => {
    // TO DO: SET LOADING STATE
    const validateToken = async () => {
      try {
        await api.get(
          API_ENDPOINTS.PASSWORD_RECOVERY+'check_reset_token/', 
          {params: {token: resetPasswordToken}}
        )
        console.log('Valid reset token')
      } 
      catch (error) {
        console.log('Error validating token')
        router.replace('/login')
      }
    }
    validateToken()
  }, [resetPasswordToken, router])
	
  useEffect(() => {
    checkFormStatus();
  }, [password, checkFormStatus])

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
        resetPassword-back-card
        "
      />
      <div className="
        absolute
        h-full w-1/2 py-10
        max-[850px]:h-fit max-[850px]:min-h-[75dvh] max-[850px]:w-full
        flex flex-col justify-center items-center
        bg-white
        rounded-r-[30px] max-[850px]:rounded-t-[30px] max-[850px]:rounded-br-none
        resetPassword-card
        "
      >
        {submitStatus?
          <>
          <div className="flex flex-col w-[70%] mb-[50px] gap-[10px] max-[850px]:w-[90%]">
            <h2>
              Contraseña restablecida con éxito
            </h2>
            <span>
              Tu contraseña ha sido actualizada correctamente. Ahora puedes iniciar sesión con tu nueva contraseña de manera segura. Haz clic en el botón a continuación para volver a la página de inicio de sesión.
            </span>
          </div>

          <Button
            onClick={() => router.push('/login')}
            className="w-[70%] h-[50px] text-md border-hidden bg-default hover:bg-defaultHover"
          >
            Iniciar sesión
          </Button>

          </>
          :
          <>
          <div className="flex flex-col w-[70%] mb-[50px] gap-[10px] max-[850px]:w-[90%]">
            <h2>
              Restablecer contraseña
            </h2>
            <span>
              Es momento de restablecer tu contraseña. Elige una nueva contraseña segura para proteger tu cuenta y seguir utilizando nuestra plataforma.
            </span>
          </div>

          <form className="w-[70%] flex flex-col items-center gap-[20px] max-[850px]:w-[90%]" onSubmit={handleSubmit}>

            <div className="relative w-full h-[50px]">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="block px-2.5 pb-2.5 pt-4 w-full text-sm text-gray-900 bg-transparent rounded-lg border border-gray-300 appearance-none focus:outline-none focus:ring-0 focus:border-default peer"
                placeholder=" "
              />
              <label
                htmlFor="password"
                className="absolute text-sm rounded-full text-gray-500 duration-300 transform -translate-y-4 scale-75 top-2 z-10 origin-[0] bg-white px-2 peer-focus:px-2 peer-focus:text-default peer-placeholder-shown:scale-100 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:top-1/2 peer-focus:top-2 peer-focus:scale-75 peer-focus:-translate-y-4 left-1"
              >
                Contraseña
              </label>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full w-15 px-3 py-2 hover:bg-transparent "
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <Eye className="h-5 w-5 text-gray-500" />
                ) : (
                  <EyeOff className="h-5 w-5 text-gray-500" />
                )}
              </Button>
            </div>
            

            {errorMessage && (
              <div className="error-message">{errorMessage}</div>
            )}

            <ActionButton
              disabled={disableSubmit}
              clickCallback={handleSubmit}
              className="w-full h-[50px] text-md border-hidden"
            >
              Restrablecer contraseña
            </ActionButton>

          </form>
          </>
        }
      </div>
    </div>
  )
}