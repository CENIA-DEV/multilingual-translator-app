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
import "./profile.css"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useContext, useEffect, useState } from "react";
import { AuthContext } from "../contexts"
import { API_ENDPOINTS } from "../constants";
import { Eye, EyeOff , ChevronDown } from "lucide-react"
import api from "../api"
import ActionButton from "../components/actionButton/actionButton"
import DatePicker from "../components/datePicker/datePicker"
import { toast } from "sonner";
import Image from "next/image";
import { VARIANT_LANG, LANG_TITLE } from "../constants";

export default function Profile(){

  const [isEditing, setIsEditing] = useState(false);
  const currentUser = useContext(AuthContext);
  const [email, setEmail]= useState(currentUser.email);
  const [firstName, setFirstName]= useState(currentUser.first_name);
  const [lastName, setLastName]= useState(currentUser.last_name);
	const [phone, setPhone]= useState(currentUser.profile.phone);
  const [languageProficiency, setLanguageProficiency] = useState(currentUser.profile.proficiency);
  const [organization, setOrganization] = useState(currentUser.profile.organization? currentUser.profile.organization : '');
  const [passwords, setPasswords] = useState({
    current: '',
    new: '',
  });

  const [dateOfBirth, setDateOfBirth] = useState(
    new Date(
      currentUser.profile.date_of_birth.split('-').reverse().slice(0, 2).reverse().join('-') + '-' + currentUser.profile.date_of_birth.split('-')[0]
    )
  );

  const proficiencyLevels = [
    {value: 'Non-Speaker', label: 'No hablante'},
    {value: 'Beginner', label: 'Principiante'},
    {value: 'Fluent', label: 'Avanzado'}
  ]

  const [disableSubmit, setDisableSubmit] = useState(false);

  const checkFormStatus = () => {
    if(!firstName || !lastName || !dateOfBirth){
      setDisableSubmit(true);
    }
    else{
      setDisableSubmit(false);
    }

    if(
      currentUser.first_name === firstName &&
      currentUser.last_name === lastName &&
      currentUser.profile.organization === (organization? organization : null) &&
      currentUser.profile.proficiency === languageProficiency &&
      new Date(currentUser.profile.date_of_birth.split('-').reverse().slice(0, 2).reverse().join('-') + '-' + currentUser.profile.date_of_birth.split('-')[0]).getDate() === dateOfBirth.getDate() &&
      passwords.current === '' &&
      passwords.new == ''
    ){
      setDisableSubmit(true);
    }

  }

  const handleDateUpdate = (date) => {
    setDateOfBirth(date);
  }

  const handleInputChange = (e) => {

    const { name, value } = e.target;

    if (name in passwords) {
      setPasswords(prev => ({ ...prev, [name]: value }));
    }

  }

  const handleSubmit = async () => {
    
    if(!(
      currentUser.first_name === firstName &&
      currentUser.last_name === lastName &&
      currentUser.profile.organization === (organization? organization : null) &&
      currentUser.profile.proficiency === languageProficiency &&
      new Date(currentUser.profile.date_of_birth.split('-').reverse().slice(0, 2).reverse().join('-') + '-' + currentUser.profile.date_of_birth.split('-')[0]).getDate() === dateOfBirth.getDate()
    )){
    
      try {
        await api.patch(
          API_ENDPOINTS.USERS+'update_user_profile/',
          {
            email: email,
            first_name: firstName,
            last_name: lastName,
            profile: {
              date_of_birth: dateOfBirth.toISOString().split('T')[0],
              proficiency: languageProficiency,
              organization: organization? organization : null
            }
          }
        )

        toast("Actualización",{
          description: "Datos actualizados con éxito",
        });

      } 
      catch (error) {
        console.log(error)
      }

    }

    if(passwords.current || passwords.new){
      
      if(!passwords.current){
        toast("Error al actualizar contraseña", {
          description: "No se ha ingresado la contraseña actual del usuario",
        });
      }
      
      if(!passwords.new){
        toast("Error al actualizar contraseña", {
          description: "No se ha ingresado la nueva contraseña del usuario",
        });
      }

      if (passwords.current && passwords.new){
        try {
          await api.patch(API_ENDPOINTS.USERS + "update_password/", {
            old_password: passwords.current,
            new_password: passwords.new,
          });

          toast("Actualización de contraseña", {
            description: "Contraseña actualizada con éxito",
          });
        } 
        catch (error) {
          console.log(error);

          toast("Error al actualizar contraseña", {
            description:
              "La contraseña ingresada no corresponde a la contraseña actual de su usuario",
          });

          setPasswords({
            current: "",
            new: "",
          });
        }
      }
    }

    setPasswords({
      current: "",
      new: "",
    });

    setIsEditing(false);

  }

  useEffect(() => {
    checkFormStatus();
  }, [firstName, lastName, dateOfBirth, organization, languageProficiency, checkFormStatus])

  useEffect(() => {
    checkFormStatus();
  }, [checkFormStatus])

  return (
    <div className="relative w-full min-h-screen flex items-center justify-center animate-fade animate-once animate-duration-[1200ms]">
      <Image
        src={`/images/${VARIANT_LANG}-profile.png`}
        alt="Profile Background"
        fill
        className="object-cover -z-10"
        priority
      />
      <Card className="w-2/6 h-fit w-max-[500px] max-[850px]:w-[95%]">
        <CardHeader className="flex flex-col items-center">
          <Avatar className="w-20 h-20 mb-4">
            <AvatarFallback>{firstName[0]}{lastName[0]}</AvatarFallback>
          </Avatar>
        </CardHeader>
        <CardContent>
          <div className="grid w-full items-center gap-4">
            <div className="flex gap-5">
              <div className="relative w-full h-[50px]">
                <input
                  id="firstName"
                  type="firstName"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="block px-2.5 pb-2.5 pt-4 w-full disabled:text-gray-400 disabled:border-gray-200 disabled:cursor-not-allowed h-full text-sm text-gray-900 bg-transparent rounded-lg border border-gray-300 appearance-none focus:outline-none focus:ring-0 focus:border-default peer"
                  placeholder=" "
                  disabled={!isEditing}
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
                  onChange={(e) => setLastName(e.target.value)}
                  className="block px-2.5 pb-2.5 pt-4 w-full disabled:text-gray-400 disabled:border-gray-200 disabled:cursor-not-allowed h-full text-sm text-gray-900 bg-transparent rounded-lg border border-gray-300 appearance-none focus:outline-none focus:ring-0 focus:border-default peer"
                  placeholder=" "
                  disabled={!isEditing}
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
                  onChange={(e) => setEmail(e.target.value)}
                  className="block px-2.5 pb-2.5 pt-4 w-full disabled:text-gray-400 disabled:border-gray-200 disabled:cursor-not-allowed h-full text-sm text-gray-900 bg-transparent rounded-lg border border-gray-300 appearance-none focus:outline-none focus:ring-0 focus:border-default peer"
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

              <DatePicker
                label={'Fecha de nacimiento'}
                handleDateUpdate={handleDateUpdate}
                selectedDate={dateOfBirth}
                disabled={!isEditing}
              />
            </div>

            <div className="flex gap-5">
              <div className="relative w-full h-[50px]">
                <input
                  id="organization"
                  type="text"
                  value={organization}
                  onChange={(e) => setOrganization(e.target.value)}
                  required
                  disabled={!isEditing}
                  className="block h-full px-2.5 pb-2.5 pt-4 w-full disabled:text-gray-400 disabled:border-gray-200 disabled:cursor-not-allowed text-sm text-gray-900 bg-transparent rounded-lg border border-gray-300 appearance-none focus:outline-none focus:ring-0 focus:border-default peer"
                  placeholder=" "
                />
                <label
                  htmlFor="organization"
                  className="absolute text-sm rounded-full text-gray-500 duration-300 transform -translate-y-4 scale-75 top-2 z-10 origin-[0] bg-white px-2 peer-focus:px-2 peer-focus:text-default peer-placeholder-shown:scale-100 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:top-1/2 peer-focus:top-2 peer-focus:scale-75 peer-focus:-translate-y-4 left-1"
                >
                  Organización
                </label>
              </div>

              <div className="relative w-full h-[50px]">
                <select
                  id="languageProficiency"
                  value={languageProficiency}
                  onChange={(e) => setLanguageProficiency(e.target.value)}
                  required
                  disabled={!isEditing}
                  className="block cursor-pointer h-full disabled:text-gray-400 disabled:border-gray-200 disabled:cursor-not-allowed px-2.5 pb-2.5 pt-4 w-full text-sm text-gray-900 bg-transparent rounded-lg border border-gray-300 appearance-none focus:outline-none focus:ring-0 focus:border-default peer"
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
                  Nivel de {LANG_TITLE}
                </label>

                <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
              </div>

            </div>
            
          </div>
          <div className={`pt-5 overflow-hidden transition-all duration-300 ease-in-out ${isEditing ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}>
            <form onSubmit={handleSubmit}>
              <div className="grid w-full items-center gap-4">

                <div className="relative w-full h-[50px]">
                  <input
                    id="current"
                    name="current"
                    type="password"
                    value={passwords.current}
                    onChange={handleInputChange}
                    required
                    className="block px-2.5 pb-2.5 pt-4 w-full text-sm text-gray-900 bg-transparent rounded-lg border border-gray-300 appearance-none focus:outline-none focus:ring-0 focus:border-default peer"
                    placeholder=" "
                  />
                  <label
                    htmlFor="current"
                    className="absolute text-sm rounded-full text-gray-500 duration-300 transform -translate-y-4 scale-75 top-2 z-10 origin-[0] bg-white px-2 peer-focus:px-2 peer-focus:text-blue-600 peer-placeholder-shown:scale-100 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:top-1/2 peer-focus:top-2 peer-focus:scale-75 peer-focus:-translate-y-4 left-1"
                  >
                    Contraseña actual
                  </label>
                </div>

                <div className="relative w-full h-[50px]">
                  <input
                    id="new"
                    name="new"
                    type="password"
                    value={passwords.new}
                    onChange={handleInputChange}
                    required
                    className="block px-2.5 pb-2.5 pt-4 w-full text-sm text-gray-900 bg-transparent rounded-lg border border-gray-300 appearance-none focus:outline-none focus:ring-0 focus:border-default peer"
                    placeholder=" "
                  />
                  <label
                    htmlFor="new"
                    className="absolute text-sm rounded-full text-gray-500 duration-300 transform -translate-y-4 scale-75 top-2 z-10 origin-[0] bg-white px-2 peer-focus:px-2 peer-focus:text-blue-600 peer-placeholder-shown:scale-100 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:top-1/2 peer-focus:top-2 peer-focus:scale-75 peer-focus:-translate-y-4 left-1"
                  >
                    Nueva contraseña
                  </label>
                </div>
              </div>
            </form>
          </div>
        </CardContent>
        <CardFooter className="flex justify-between gap-5">
          <Button 
            onClick={() => {
              setIsEditing(!isEditing);
              if (isEditing) {
                setPasswords({ current: '', new: '', confirm: '' })
                setFirstName(currentUser.first_name);
                setLastName(currentUser.last_name);
                setLanguageProficiency(currentUser.profile.proficiency);
                setOrganization(currentUser.profile.organization? currentUser.profile.organization: '');
                setDateOfBirth(new Date(
                  currentUser.profile.date_of_birth.split('-').reverse().slice(0, 2).reverse().join('-') + '-' + currentUser.profile.date_of_birth.split('-')[0]
                ))
              };
              checkFormStatus();
            }}
            className="w-full transition-all duration-1000 ease-in-out flex items-center justify-center bg-default hover:bg-defaultHover"
          >
            {isEditing ? 'Cancelar' : 'Editar perfil'}
          </Button>
          {isEditing && (
            <ActionButton
              disabled={disableSubmit}
              clickCallback={handleSubmit}
            >
              Guardar cambios
            </ActionButton>
          )}
        </CardFooter>
      </Card>
    </div>
  )
  
}