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
import "./invitation.css"
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useEffect } from "react";
import ActionButton from "../../components/actionButton/actionButton";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff , ChevronDown } from "lucide-react"
import api from "@/app/api";
import { API_ENDPOINTS, LANG_TITLE, VARIANT_LANG } from "@/app/constants";
import DatePicker from "../../components/datePicker/datePicker"
import { toast } from "sonner";
export default function Invitation({params}){

  const router = useRouter();
  const invitationtoken = params.token;
  
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState(null);
  const [languageProficiency, setLanguageProficiency] = useState('Non-Speaker');
  const [organization, setOrganization] = useState('');

  const proficiencyLevels = [
    {value: 'Non-Speaker', label: 'No hablante'},
    {value: 'Beginner', label: 'Principiante'},
    {value: 'Fluent', label: 'Avanzado'}
  ]

  const [disableSubmit, setDisableSubmit] = useState(false);

  const checkFormStatus = () => {
    if(!firstName || !lastName || !dateOfBirth || !password){
      setDisableSubmit(true);
    }
    else{
      setDisableSubmit(false);
    }
  }

  const handleDateUpdate = (date) => {
    setDateOfBirth(date);
  }

  const handleSubmit = async () => {
    try {
      const profileData = {
        date_of_birth: dateOfBirth.toISOString().split("T")[0],
        proficiency: languageProficiency
      };

      if(organization){
        profileData.organization = organization;
      }

      await api.post(API_ENDPOINTS.USERS + "create_by_invitation/", {
        username: email,
        email: email,
        first_name: firstName,
        last_name: lastName,
        password: password,
        profile: profileData,
        token: invitationtoken,
      });

      toast("Cuenta creada con éxito",{
        description: "Ahora puedes iniciar sesión",
        cancel: {
          label: 'Cerrar',
          onClick: () => console.log('Cerrado')
        },
      });
      
      router.push('/login');

    } 
    catch (error) {
      if (error.status === 404){
        toast("Su token de invitación ha expirado",{
          description: "Por favor, solicite una nueva invitación",
          cancel: {
            label: 'Cerrar',
            onClick: () => router.push('/request-access')
          },
        });
      }
      else {
        toast("Error al crear cuenta",{
          description: "Por favor, intente nuevamente",
          cancel: {
            label: 'Cerrar',
            onClick: () => router.push('/request-access')
          },
        });
      }
    }
  }
  
  useEffect(() => {
    const verifyToken = async () => {
      try {
        const res = await api.get(
          API_ENDPOINTS.INVITATIONS+'check_invitation_token/',
          { params: {token: invitationtoken} }
        )

        if (!res.data.is_active) {
          router.push('/login')
        } 
        else {
          console.log('Token verified')
          setEmail(res.data.email);
          setFirstName(res.data.first_name);
          setLastName(res.data.last_name);
          if(res.data.organization){
            setOrganization(res.data.organization);
          }
          else{
            setOrganization(null);
          }
          
        }
      } 
      catch (error) {
        if (error.status === 404) {
          toast("Su token de invitación ha expirado",{
            description: "Por favor, solicite una nueva invitación",
            cancel: {
              label: 'Cerrar',
              onClick: () => router.push('/request-access')
            },
          });
          console.log('Token not found')
        } 
        else if (error.status === 400) {
          toast("Token inválido",{
            description: "Por favor, solicite una nueva invitación",
            cancel: {
              label: 'Cerrar',
              onClick: () => router.push('/request-access')
            },
          });
          console.log('Token expired')
        }
      }
    }
    verifyToken();
  }, [invitationtoken, router])

  useEffect(() => {
    checkFormStatus();
  }, [firstName, lastName, organization, dateOfBirth, languageProficiency, password, checkFormStatus])
	
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
        invitation-back-card
        "
      />
      <div className="
        absolute
        h-full w-1/2 py-10
        max-[850px]:h-fit max-[850px]:min-h-[75dvh] max-[850px]:w-full
        flex flex-col justify-center items-center
        bg-white
        rounded-r-[30px] max-[850px]:rounded-t-[30px] max-[850px]:rounded-br-none
        invitation-card
        "
      >

        <div className="flex flex-col w-[70%] mb-[50px] gap-[10px] max-[850px]:w-[90%]">
          <h2>
            Crea tu cuenta
          </h2>
          <span>
              ¡Felicidades! Has recibido una invitación para acceder al sistema de traducción {LANG_TITLE}
          </span>
        </div>

        <form className="w-[70%] flex flex-col gap-[20px] max-[850px]:w-[90%]" onSubmit={handleSubmit}>
          <div className="flex gap-5">
            <div className="relative w-full h-[50px]">
              <input
                id="firstName"
                type="firstName"
                value={firstName}
                required
                onChange={(e) => setFirstName(e.target.value)}
                className="block px-2.5 pb-2.5 pt-4 w-full h-full text-sm text-gray-900 bg-transparent rounded-lg border border-gray-300 appearance-none disabled:text-gray-400 disabled:border-gray-200 disabled:cursor-not-allowed focus:outline-none focus:ring-0 focus:border-default peer "
                placeholder=" "
              />
              <label
                htmlFor="firstName"
                className="absolute text-sm rounded-full text-gray-500 duration-300 transform -translate-y-4 scale-75 top-2 z-10 origin-[0] bg-white px-2 peer-focus:px-2 peer-focus:text-blue-600 peer-placeholder-shown:scale-100 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:top-1/2 peer-focus:top-2 peer-focus:scale-75 peer-focus:-translate-y-4 left-1"
              >
                Nombre
              </label>
            </div>
            <div className="relative w-full h-[50px]">
              <input
                id="lastName"
                type="lasstName"
                value={lastName}
                required
                onChange={(e) => setLastName(e.target.value)}
                className="block px-2.5 pb-2.5 pt-4 w-full h-full text-sm text-gray-900 bg-transparent rounded-lg border border-gray-300 disabled:text-gray-400 disabled:border-gray-200 disabled:cursor-not-allowed appearance-none focus:outline-none focus:ring-0 focus:border-default peer"
                placeholder=" "
              />
              <label
                htmlFor="lastName"
                className="absolute text-sm rounded-full text-gray-500 duration-300 transform -translate-y-4 scale-75 top-2 z-10 origin-[0] bg-white px-2 peer-focus:px-2 peer-focus:text-blue-600 peer-placeholder-shown:scale-100 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:top-1/2 peer-focus:top-2 peer-focus:scale-75 peer-focus:-translate-y-4 left-1"
              >
                Apellido
              </label>
            </div>
          </div>
          <div className="flex gap-5">
            <div className="relative w-full h-[50px]">
              <input
                id="email"
                type="email"
                value={email}
                required
                onChange={(e) => setEmail(e.target.value)}
                className="block px-2.5 pb-2.5 pt-4 w-full h-full text-sm text-gray-900 bg-transparent rounded-lg border border-gray-300 disabled:text-gray-400 disabled:border-gray-200 disabled:cursor-not-allowed appearance-none focus:outline-none focus:ring-0 focus:border-default peer"
                placeholder=" "
                disabled
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
                id="organization"
                type="text"
                value={organization ? organization : 'Ninguna'}
                disabled={!organization}
                onChange={(e) => setOrganization(e.target.value)}
                className="block h-full px-2.5 pb-2.5 pt-4 w-full text-sm text-gray-900 bg-transparent rounded-lg border border-gray-300 disabled:text-gray-400 disabled:border-gray-200 disabled:cursor-not-allowed appearance-none focus:outline-none focus:ring-0 focus:border-default peer"
                placeholder=" "
              />
              <label
                htmlFor="organization"
                className="absolute text-sm rounded-full text-gray-500 duration-300 transform -translate-y-4 scale-75 top-2 z-10 origin-[0] bg-white px-2 peer-focus:px-2 peer-focus:text-default peer-placeholder-shown:scale-100 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:top-1/2 peer-focus:top-2 peer-focus:scale-75 peer-focus:-translate-y-4 left-1"
              >
                Organización (opcional)
              </label>
            </div>
            
          </div>

          <div className="relative w-full h-[50px]">
            <select
              id="languageProficiency"
              value={languageProficiency}
              onChange={(e) => setLanguageProficiency(e.target.value)}
              required
              className="block cursor-pointer h-full px-2.5 pb-2.5 pt-4 w-full text-sm text-gray-900 bg-transparent rounded-lg border border-gray-300 disabled:text-gray-400 disabled:border-gray-200 disabled:cursor-not-allowed appearance-none focus:outline-none focus:ring-0 focus:border-default peer"
            >
              {proficiencyLevels.map((proficiency) => (
                <option key={proficiency.value} value={proficiency.value}>
                  {proficiency.label}
                </option>
              ))}
            </select>
            <label
              htmlFor="reason"
              className="absolute text-sm rounded-full text-gray-500 duration-300 transform -translate-y-4 scale-75 top-2 z-10 origin-[0] bg-white px-2 peer-focus:px-2 peer-focus:text-default peer-placeholder-shown:scale-100 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:top-1/2 peer-focus:top-2 peer-focus:scale-75 peer-focus:-translate-y-4 left-1"
            >
              ¿Cuál es tu nivel de manejo de la lengua {LANG_TITLE}?
            </label>

            <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
          </div>

          <DatePicker
            label={'Fecha de nacimiento'}
            handleDateUpdate={handleDateUpdate}
            selectedDate={dateOfBirth}
            align="center"
          />

          
          <div className="relative w-full h-[50px]">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="block h-[50px] px-2.5 pb-2.5 pt-4 w-full text-sm text-gray-900 bg-transparent rounded-lg border border-gray-300 appearance-none focus:outline-none focus:ring-0 focus:border-default peer"
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
            Crear cuenta
          </ActionButton>

        </form>
      </div>
    </div>

  )
}