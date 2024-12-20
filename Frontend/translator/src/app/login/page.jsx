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
import "./login.css"
import api from "../api";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import ActionButton from "../components/actionButton/actionButton";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff } from "lucide-react"
import { API_ENDPOINTS , ACCESS_TOKEN } from '../constants';
import { toast } from "sonner";
import { VARIANT_LANG } from "../constants";
import Image from "next/image";
export default function Login(){

  const router = useRouter()
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [disableSubmit, setDisableSubmit] = useState(false);

  const checkFormStatus = () => {
    if(!validateEmail(email) || !password){
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

  const handleForgotPass = () => {
    router.push('/reset-password-request');
  };

  const handleSignUp = () => {
    router.push('/request-access');
  };
  
  const handleSubmit = async () => {
    try {
      const res = await api.post(
        API_ENDPOINTS.USERS + 'token/',
        {
          username: email,
          password: password,
        })
      const token = res.data.token;
      console.log(`Got token ${token}`)
      localStorage.setItem(ACCESS_TOKEN, token);
      window.location.href = '/translator';
    } 
    catch(error) {
      if (error.response) {
        console.log(error.response.data);
        if (error.response.status == 400) {
          if(error.response.data.email){
            toast("Inicio de sesión fallido", {
              description: "El correo ingresado no se encuentra registrado en la plaforma",
            });
          }
          else if(error.response.data.password){
            toast("Inicio de sesión fallido", {
              description: "El contraseña ingresada no corresponde es incorrecta",
            });
          }
          setErrorMessage("Correo y/o contraseña incorrecto/s. Inténtalo nuevamente.");
        };
      }
      else {
        console.log('Error', error.message);
      }
    }
  };
  
  useEffect(() => {
    checkFormStatus();
  }, [email, password, checkFormStatus])
	
  return (
    <div className="bg-default w-full h-[100dvh] relative">
      <Image
        src={`/images/${VARIANT_LANG}-blue.png`}
        alt="Background decoration"
        fill
        className="
          animate-fade animate-once animate-duration-[1200ms] animate-delay-[700ms] animate-ease-in-out 
          object-contain object-left-bottom -scale-x-100
          max-[850px]:object-left-top
        "
        priority
      />
      
      <div className="
        absolute
        h-[95dvh] w-[51.1dvw] py-10
        max-[850px]:h-fit max-[850px]:min-h-[75dvh] max-[850px]:w-[97dvw] max-[850px]:top-[22dvh] max-[850px]:left-[1.5dvw]
        bg-white/[0.2]
        rounded-r-[30px] max-[850px]:rounded-t-[30px] max-[850px]:rounded-br-none
        login-back-card
        "
      />
      <div className="
        absolute
        h-full w-1/2 py-10
        max-[850px]:h-fit max-[850px]:min-h-[75dvh] max-[850px]:w-full
        flex flex-col justify-center items-center
        bg-white
        rounded-r-[30px] max-[850px]:rounded-t-[30px] max-[850px]:rounded-br-none
        login-card
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
          <b className="text-xs"> ¿No tienes cuenta? </b>

          <Button 
            className="
              h-7 
              bg-[#068cdc1a] 
              text-default text-xs font-bold 
              hover:bg-default hover:text-white
              "
            onClick={handleSignUp}
            >
            Solicitar acceso
          </Button>
        </div>

        <div className="flex flex-col w-[70%] mb-[50px] gap-[10px] max-[850px]:w-[90%]">
          <h2>
            Te damos la bienvenida nuevamente
          </h2>
          <span>Ingresa tu información de acceso</span>
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
            Iniciar sesión
          </ActionButton>

        </form>

        <b className="mt-10 text-xs hover:text-default cursor-pointer" onClick={handleForgotPass}>
          ¿Olvidaste tu contraseña?
        </b>
      </div>
    </div>
  );
}