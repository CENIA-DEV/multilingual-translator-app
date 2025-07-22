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
"use client"

import Link from "next/link"
import { useRef, useEffect, useState } from 'react'
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { faBookOpen, faLockOpen, faUsers, faSpinner, faChevronDown } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import api from "../api"
import Image from 'next/image'
import parse from 'html-react-parser';
import { Toaster } from "@/components/ui/toaster"
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { text } from "./text"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { VARIANT_LANG } from "../constants" 
import { useAnalytics } from '@/hooks/useAnalytics';

export default function LandingPage() {
  const parallaxRef = useRef(null)
  const [language, setLanguage] = useState(`spa-${VARIANT_LANG}`)
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()
  const [isParticipateModalOpen, setIsParticipateModalOpen] = useState(false)
  const [newParticipate, setNewParticipate] = useState({
    email: "",
    reason: "",
    organization: "",
    first_name: "",
    last_name: ""
  })
  const { trackEvent } = useAnalytics();
  useEffect(() => {
    const handleScroll = () => {
      const scrolled = window.scrollY
      if (parallaxRef.current) {
        parallaxRef.current.style.transform = `translateY(${scrolled * 0.5}px)`
      }
    }

    window.addEventListener('scroll', handleScroll)

    return () => {
      window.removeEventListener('scroll', handleScroll)
    }
  }, [])

  const handleSubmitForm = async () => {
    setIsLoading(true)
    
    try {
      const response = await api.post("/api/participate-request/", newParticipate)
      console.log(response)
      toast({
        title: "Gracias por tu interés en colaborar con nosotros",
        description: "Te contactaremos a la brevedad"
      })
      trackEvent('participate_form_submit_success', {
        page: 'about',
        email: newParticipate.email,
      })
    }
    catch (error) {
      console.log(error)
      toast({
        title: "Hubo un error al enviar tu solicitud",
        description: "Por favor corrabore los datos y vuelva a intentarlo"
      })
      trackEvent('participate_form_submit_error', {
        page: 'about',
        email: newParticipate.email,
      })
    }
    finally {
      setIsParticipateModalOpen(false)
      setIsLoading(false)
    }
  }

  const handleLanguageChange = (value) => {
    setLanguage(value)
    trackEvent('language_change', {
      language: value,
      page: 'about'
    })
  }

  const trackClick = (eventName) => {
    trackEvent(eventName, 
      {
        page: 'about'
      }
    );
  }

  return (
    <div className="flex flex-col min-h-screen min-w-full bg-gray-100 items-center">
      <main className="flex flex-col min-w-full h-100 w-100">
      
      <div className="relative h-screen overflow-hidden"> 
     
      <div ref={parallaxRef} className="absolute inset-0">
        <Image
            src={`/images/landing-${VARIANT_LANG}.png`}
            alt="Landing background"
            fill
            className="object-cover grayscale-100"
            priority
          />
        </div>
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
        <div className="absolute top-4 right-4 flex flex-row gap-4">
          <Label className="text-white items-center flex gap-2">Selecciona tu idioma</Label>
          <Select onValueChange={handleLanguageChange} defaultValue={language}>
            
          <SelectTrigger className="w-[120px] bg-gray border-solid border-1 hover:border-2 hover:border-default focus:ring-2 focus:ring-default  border-default text-white">

            <SelectValue placeholder="Language" />
          </SelectTrigger>
          {VARIANT_LANG === 'rap' ? (
          <SelectContent>
            <SelectItem value="spa-rap">Español</SelectItem>
            <SelectItem value="rap">Rapa Nui</SelectItem>
            <SelectItem value="eng-rap">English</SelectItem>
            </SelectContent>
            ) : (
              <SelectContent>
                <SelectItem value="spa-arn">Español</SelectItem>
                <SelectItem value="eng-arn">English</SelectItem>
              </SelectContent>
            )}
          </Select>
        </div>
            <div className="text-center text-white p-8 rounded-lg">
              <h1 className="text-6xl font-bold mb-4 max-[850px]:text-5xl">{text.Title[language]}</h1>
              <p className="mb-8 max-w-2xl mx-auto text-xl">
                {text.Subtitle[language]}
              </p>
              <div className="flex gap-4 max-[850px]:flex-col items-center justify-center">
                <Link href="/translator" onClick={() => trackClick('try_translator_button_click')} className="inline-block bg-gradient-to-r from-default to-[#0a7cde] hover:from-[#0a7cde] hover:to-[#0a4cde] text-white font-semibold py-3 px-8 w-80 h-15 rounded-full shadow-lg transition-all duration-300 transform hover:scale-105 text-lg">
                  {text.TryTranslator[language]}
                </Link>
                <Link href="#about" onClick={() => trackClick('about_project_button_click')} className="inline-block border-white bg-white text-default backdrop-blur-md font-semibold py-3 hover:bg-[#0a7cde] hover:to-[#0a4cde] hover:text-white px-8 w-80 h-15 rounded-full shadow-lg transition-all duration-300 transform hover:scale-105 text-lg">
                  {text.JoinProject[language]}
                </Link>
              </div>
            </div>
          </div>
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-white animate-bounce">
              <FontAwesomeIcon icon={faChevronDown} />
          </div>
        </div>
        
        <section id="about" className="w-full py-12 px-5 md:py-24 lg:py-32 flex items-center justify-center">
          <div className="flex flex-col container px-4 md:px-6">
            <h2 className="text-4xl tracking-tighter sm:text-4xl md:text-4xl text-center mb-8 ">{text.AboutProject.Title[language]}</h2>
            
              <div className="space-y-6">
                {text.AboutProject.AboutProjectText.map((text, index) => (
                  <p key={index} className="text-justify text-xl text-gray-600 dark:text-gray-400">
                    {parse(text[language])}
                  </p>
                ))}
              </div>
      
          </div>
        </section>
        {/* <section id="research" className="w-full py-24 bg-cover bg-center bg-fixed flex items-center justify-center" style={{backgroundImage: 'url(https://hebbkx1anhila5yf.public.blob.vercel-storage.com/moais-NTbFMHVNoFi9vQ7UshERuq1q0ijOt4.jpg)'}}> */}
        <section 
            id="focus" 
            className="w-full py-24 bg-cover bg-center bg-fixed flex items-center justify-center" 
            style={{backgroundImage: `url(/images/${VARIANT_LANG}-blue.png)`}}>
          <div className="container px-4 md:px-6">
          <div className="bg-white bg-opacity-90 p-8 rounded-lg backdrop-blur-md">
            <h2 className="text-4xl font-bold tracking-tighter sm:text-4xl md:text-4xl text-center mb-8">{text.Focus.Title[language]}</h2>
            <div className="grid gap-10 sm:grid-cols-2 md:grid-cols-3">
              <div className="flex flex-col items-center space-y-2 p-4 rounded-lg">
                <FontAwesomeIcon icon={faUsers} size="3x" className="text-default" />
                <h3 className="text-center">{text.Focus.Collaboration.Title[language]}</h3>
                <p className="text-xl text-center text-gray-600 dark:text-gray-400">
                {text.Focus.Collaboration.Text[language]}
                </p>
              </div>
              <div className="flex flex-col items-center space-y-2 p-4 rounded-lg">
                <FontAwesomeIcon icon={faBookOpen} size="3x" className="text-default" />
                <h3 className="text-center">{text.Focus.IA.Title[language]}</h3>
                <p className="text-xl text-center text-gray-600 dark:text-gray-400">
                {text.Focus.IA.Text[language]}
                </p>
              </div>
              <div className="flex flex-col items-center space-y-2 p-4 rounded-lg">
                <FontAwesomeIcon icon={faLockOpen} size="3x" className="text-default" />
                <h3 className="text-center">{text.Focus.Free.Title[language]}</h3>
                <p className="text-xl text-center text-gray-600 dark:text-gray-400">
                {text.Focus.Free.Text[language]}
                </p>
              </div>
            </div>
          </div>
          </div>
        </section>
        <section id="owners" className="w-full py-12 md:py-12 lg:py-12 flex items-center justify-center">
          <div className="container px-4 md:px-6">
		    {VARIANT_LANG === 'rap' && (
            <h3 className="text-4xl tracking-tighter sm:text-4xl md:text-4xl text-center mb-8 ">{text.Owners.Title[language]}</h3>
        )}
        
        <div className="w-full grid place-items-center text-center">
          <div className="space-y-2">
            <h2 className="text-center text-xl">{text.Owners.Academy[language]}</h2>
            <div 
              className="h-32 relative max-[850px]:h-20">
              <Image
                src={`/images/${VARIANT_LANG}-language-academy.png`}
                alt="Academia de Lengua logo"
                fill
                priority={false}
                className="object-contain"
              />
            </div>
          </div>
        </div>
        
        {VARIANT_LANG === 'rap' && (
            <h3 className="text-4xl tracking-tighter sm:text-4xl md:text-4xl text-center my-8">{text.Owners.Subtitle[language]}</h3>
        )}
            <div className="grid gap-10 grid-cols-2 max-[850px]:grid-cols-1">
              <div className="space-y-4 ">
                <h2 className="text-center text-xl">Estudios Aplicados Antropología UC </h2>
                <div 
                  className="h-32 relative max-[850px]:h-20">
                  <Image
                    src="/images/eaauc.png"
                    alt="EAAUC logo"
                    fill
                    priority={false}
                    className="object-contain"
                  />
                </div>
              </div>
              <div className="space-y-4 ">
                <h3 className="text-center text-xl">Centro Nacional de Inteligencia Artificial</h3>
                <div className="h-32 relative max-[850px]:h-20">
                  <Image
                    src="/images/cenia.png"
                    alt="Cenia logo"
                    fill
                    priority={false}
                    className="object-contain"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>
        <section id="colaborators" className="w-full py-12 md:py-12 lg:py-12 bg-default/5 flex items-center justify-center">
          <div className="container px-6 md:px-6">
            <h3 className="text-4xl font-bold text-center mb-8 text-defult">{text.Collaborators.Title[language]}</h3>
            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            {VARIANT_LANG === 'rap' ? (
              <>
              <div>
                <h4 className="text-xl font-semibold mb-4 text-defult">{text.Institutions.Title[language]}</h4>
                <ul className="list-disc list-inside text-gray-700">
                  <li>Municipalidad de Rapa Nui</li>
                  <li>Hōnui</li>
                  <li>Fondo de Cultura y Educación CONADI Rapa Nui</li>
                  <li>Pontificia Universidad Católica de Chile </li>
                </ul>
      
              </div>

              <div>
                <h4 className="text-xl font-semibold mb-4 text-defult">{text.Institutions.Directory.Title[language]}</h4>
                <ul className="list-disc list-inside text-gray-700">
                  <li>Jackeline Rapu Tuki</li>
                  <li>Carolina Tuki Pakarati</li>
                  <li>María Eugenia Tuki Pakarati</li>
                  <li>Annette Rapu Zamora</li>
                  <li>Juan Manutomatoma</li>
                  <li>Nelly Manutomatoma</li>
                </ul>
              </div>

              <div>
                <h4 className="text-xl font-semibold mb-4 text-defult">{text.Institutions.Translators.Title[language]}</h4>
                <ul className="list-disc list-inside text-gray-700">
                  <li>Jackeline Rapu Tuki</li>
                  <li>Merina Manutomatoma</li>
                  <li>Viki Haoa Cardinali</li>
                  <li>Rafael Tuki Tepano</li>
                  <li>Virginia Atan</li>
                  <li>Christian Madariaga Paoa</li>
                  <li>Ariki Rapu Merino</li>
                  <li>Hitu Tuki Rapu</li>
                </ul>
              </div>
              <div>
                <h4 className="text-xl font-semibold mb-4 text-defult">{text.Institutions.Transcribers.Title[language]}</h4>
                <ul className="list-disc list-inside text-gray-700">
                  <li>Tu'u Kura Tuki Aránguiz</li>
                  <li>Mahai Soler Hotu</li>
                  <li>Merahi Edmunds Hernández</li>
                </ul>
              </div>
              <div>
                
                <h4 className="text-xl font-semibold mb-4 text-defult">{text.Institutions.Reviewers.Title[language]}</h4>
                <ul className="list-disc list-inside text-gray-700">
                  <li>Dora Tuki Beri-beri</li>
                  <li>Alberto Pacomio Hotus</li>
                  <li>Johnny Tucki Hucke</li>
                  <li>Blanca Hucke Atam</li>
                  <li>David Teao</li>
                  <li>Mario Tuki Hey</li>
                  <li>Ana Iris Chavez Ika</li>
                  <li>Elena Tuki Hotus</li>
                  <li>Juan Manutomatoma</li>
                </ul>
              </div>
              </>
              ) : (
                <>
                <div>
                <h4 className="text-xl font-semibold mb-4 text-defult">Instituto de la Lengua y Cultura Mapuche Aukiñ Mapu</h4>
                  <ul className="list-disc list-inside text-gray-700">
                    <li>Manuel Santander</li>
                    <li>Flor Caniupil</li>
                    <li>Rosa Caniupil</li>
                  </ul>
                </div>
                </>
              )}
              <div>
                <h4 className="text-xl font-semibold mb-4 text-defult">Centro Nacional de Inteligencia Artificial</h4>
                <ul className="list-disc list-inside text-gray-700">
                  <li>Carlos Aspillaga</li>
                  <li>Sebastián Ricke</li>
                  <li>César Rivera</li>
                  <li>Martín Pizarro</li>
                  <li>Guillermo Figueroa</li>
                  <li>Hugo Zeballos</li>
                  <li>Canela Orellana</li>
                  <li>Estefanía Pakarati</li>
                  <li>Andrés Carvallo</li>
                  <li>Álvaro Soto</li>
                  <li>Agustín Ghent</li>
                </ul>
              </div>

              <div>
                <h4 className="text-xl font-semibold mb-4 text-defult">Estudios Aplicados Antropología UC</h4>
                <ul className="list-disc list-inside text-gray-700">
                  <li>Jaime Coquelet</li>
                  <li>Loreto Ulloa</li>
                  <li>Francisca del Valle</li>
				  <li>Tomás Pesce</li>
				  <li>Belen Villena</li>
                </ul>
              </div>

              <div>
                <h4 className="text-xl font-semibold mb-4 text-defult">{text.ThanksTo.Title[language]}</h4>
                <ul className="list-disc list-inside text-gray-700">
                  {VARIANT_LANG === 'rap' ? (
                    <li>Fátima Hotus Hey</li> 
                  ) :
                  (
                    <li>Participantes Txawun de validación</li> 
                  )}
                  <li>Cristian Vasquez</li>
                  <li>Josefina Irribarra</li>
                  <li>Daniela Contreras</li>
                  <li>Constanza Cruz</li>
                  <li>Gianyser González</li>
                  <li>Pia Cassone</li>
                  <li>Irma Palominos</li>
                </ul>
              </div>
            
            </div>
          </div>
        </section>

        <section id='financers' className="w-full py-12 md:py-12 lg:py-12 flex items-center justify-center">
          <div className="container px-4 md:px-6">
            <h3 className="text-4xl font-bold text-center mb-8 text-defult">{text.Financing.Title[language]}</h3>
            <div className="grid gap-10 grid-cols-[repeat(auto-fit,minmax(200px,1fr))] max-[850px]:grid-cols-2">
                <div className="space-y-4 ">
                  
                  <h3 className="text-center"> ISOC </h3>
                  <div className="h-32 relative">
                    <Image
                      src="/images/isoc.png"
                      alt="ISOC logo"
                      fill
                      priority={false}
                      className="object-contain"
                    />
                  </div>
                </div>
                <div className="space-y-4 ">
                  
                  <h3 className="text-center">ANID</h3>
                  <div className="h-32 relative">
                    <Image
                      src="/images/anid.png"
                      alt="ANID logo"
                      fill
                      priority={false}
                      className="object-contain"
                    />
                  </div>
                </div>
                {VARIANT_LANG === 'rap' ? (
                <>
                <div className="space-y-4 ">
                  
                  <h3 className="text-center">Conadi</h3>
                  <div className="h-32 relative">
                    <Image
                      src="/images/conadi.png"
                      alt="Conadi logo"
                      fill
                      priority={false}
                      className="object-contain"
                    />
                  </div>
                </div>

                <div className="space-y-4 ">
                  
                  <h3 className="text-center">{text.Financing.Municipality[language]}</h3>
                  <div className="h-32 relative">
                    <Image
                      src="/images/municipalidad.png"
                      alt="Municipalidad logo"
                      fill
                      priority={false}
                      className="object-contain"
                    />
                  </div>
                </div>
                </>
                ) : (
                  <></>
                )}
            </div>
          </div>
        </section>
        <section id="contact" className="w-full py-12 md:py-24 lg:py-32 bg-default/5 flex items-center justify-center">
          <div className="container px-4 md:px-6">
            <div className="flex flex-col items-center justify-center space-y-4 text-center">
              {/* <div className="space-y-2">
                <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl">{text.Contact.Title[language]}</h2>
                <p className="max-w-[600px] text-gray-600 md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed dark:text-gray-400">
                  {text.Contact.Subtitle[language]}
                </p>
              </div> */}
              
              <Dialog
                  open={isParticipateModalOpen}
                  onOpenChange={setIsParticipateModalOpen}
                >
                  <DialogTrigger asChild>
                  <Button type="submit" className="bg-gradient-to-r from-defaultHover to-default hover:from-[#0a7cde] hover:to-[#0a4cde] text-white font-semibold py-3 px-8 w-70 h-15 rounded-full shadow-lg transition-all duration-300 transform hover:scale-105 text-lg">
                    {text.Contact.Button[language]}
                  </Button>
                  </DialogTrigger>
                  <DialogContent className="w-1/2 max-[850px]:w-[90%] max-[850px]:h-fit gap-y-4">
                    <DialogHeader>
                      <DialogTitle>Contáctanos</DialogTitle>
                      <DialogDescription>
                        Llena los siguientes campos para contactarnos.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4 w-full">
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="firstName" className="text-right">
                          Nombre
                        </Label>
                        <Input
                          id="firstName"
                          value={newParticipate.first_name}
                          onChange={(e) =>
                            setNewParticipate({
                              ...newParticipate,
                              first_name: e.target.value,
                            })
                          }
                          className="col-span-3 focus-visible:ring-0 focus-visible:ring-offset-0"
                        />
                        <Label htmlFor="lastName" className="text-right">
                          Apellido
                        </Label>
                        <Input
                          id="lastName"
                          value={newParticipate.last_name}
                          onChange={(e) =>
                            setNewParticipate({
                              ...newParticipate,
                              last_name: e.target.value,
                            })
                          }
                          className="col-span-3 focus-visible:ring-0 focus-visible:ring-offset-0"
                        />
                        <Label htmlFor="email" className="text-right">
                          Correo
                        </Label>
                        <Input
                          id="email"
                          type="email"
                          value={newParticipate.email}
                          onChange={(e) =>
                            setNewParticipate({
                              ...newParticipate,
                              email: e.target.value,
                            })
                          }
                          className="col-span-3 focus-visible:ring-0 focus-visible:ring-offset-0"
                        />
                        <Label htmlFor="organization" className="text-right">
                          Organización
                        </Label>
                        <Input
                          id="organization"
                          required={false}
                          type="text"
                          placeholder="Opcional"
                          value={newParticipate.organization}
                          onChange={(e) =>
                            setNewParticipate({
                              ...newParticipate,
                              organization: e.target.value,
                            })
                          }
                          className="col-span-3 focus-visible:ring-0 focus-visible:ring-offset-0"
                        />
                        <Label htmlFor="reason" className="text-right">
                          Mensaje
                        </Label>
                        <Textarea 
                          className="col-span-3 h-40 rounded-md hover:border-default hover:rounded-lg focus-visible:ring-0 focus-visible:ring-offset-0" 
                          id="reason" 
                          name="reason" 
                          value={newParticipate.reason}
                          onChange={(e) =>
                            setNewParticipate({
                              ...newParticipate,
                              reason: e.target.value,
                            })
                          }
              
              
                        />
                      </div>
                    </div>
                    <DialogFooter>
                    <Button type="submit" onClick={(handleSubmitForm)} className="bg-gradient-to-r from-default to-[#0a7cde] hover:from-[#0a7cde] hover:to-[#0a4cde] text-white font-semibold py-3 px-8 w-70 h-15 rounded-full shadow-lg transition-all duration-300 transform hover:scale-105 text-lg">
                      {isLoading ? <FontAwesomeIcon icon={faSpinner} className="h-4 w-4 animate-spin" /> : "Enviar"}
                    </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
            </div>
          </div>
        </section>
        <Toaster />
      </main>
    </div>
  )
}