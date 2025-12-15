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
import { faBookOpen, faLockOpen, faUsers, faSpinner, faChevronDown, faChevronLeft, faChevronRight } from '@fortawesome/free-solid-svg-icons'
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
  const parallaxRef = useRef(null);
  const [language, setLanguage] = useState(`spa-${VARIANT_LANG}`);
  const [isLoading, setIsLoading] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [slideDirection, setSlideDirection] = useState('next'); // 'next' or 'prev'
  const [showStickyHeader, setShowStickyHeader] = useState(false);
  const { toast } = useToast();
  const [isParticipateModalOpen, setIsParticipateModalOpen] = useState(false);
  const [newParticipate, setNewParticipate] = useState({
    email: "",
    reason: "",
    organization: "",
    first_name: "",
    last_name: ""
  });
  const { trackEvent } = useAnalytics();
  
  useEffect(() => {
    const handleScroll = () => {
      const scrolled = window.scrollY
      
      // parallax logic
      if (parallaxRef.current) {
        parallaxRef.current.style.transform = `translateY(${scrolled * 0.5}px)`
      }

      // Toggle sticky header when scrolling down
      // 600px is roughly when the initial top header disappears
      if (scrolled > 600) {
        setShowStickyHeader(true);
      } else {
        setShowStickyHeader(false);
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
    trackEvent(eventName, {
        page: 'about'
    });
  }
  
  // Testimonial carousel
  const testimonials = [
    { name: "Jackeline Rapu", quote: "This tool speaks our true voices. It respects our nuances.", img: "/images/testimonials/jackeline.png" },
    { name: "Mama Ana", quote: "Our community's heart and soul are in this translator.", img: "/images/testimonials/jackeline.png" },
    { name: "Papa Hete", quote: "We validated every word, it's accurate and ours.", img: "/images/testimonials/jackeline.png" },
    { name: "Tiare Paoa", quote: "Finally technology that understands our heritage.", img: "/images/testimonials/jackeline.png" },
  ];
  
	
  
  const teamMembers = [
	  // Academia Rapa Nui
	  { name: "Jackeline Rapu Tuki", img: "/images/team/jackeline_rapu.png" },
	  { name: "Carolina Tuki Pakarati", img: "/images/team/carolina_tuki.jpeg" },
	  { name: "María Eugenia Tuki Pakarati", img: "/images/team/mariaeugenia_tuki.png" },
	  { name: "Annette Rapu Zamora", img: "/images/team/annette_rapu.jpeg" },
	  { name: "Juan Manutomatoma", img: "/images/team/juan_manutomatoma.png" },
	  { name: "Nelly Manutomatoma", img: "/images/team/nelly_manutomatoma.png" },
      { name: "Merina Manutomatoma", img: "/images/team/merina_manutomatoma.png" },
      { name: "Viki Haoa Cardinali", img: "/images/team/viki_haoa.png" },
      { name: "Rafael Tuki Tepano", img: "/images/team/rafael_tuki.png" },
      { name: "Virginia Atan", img: "/images/team/virginia_atan.png" },
      { name: "Christian Madariaga Paoa", img: "/images/team/christian_madariaga.png" },
      { name: "Ariki Rapu Merino", img: "/images/team/ariki_rapu.png" },
      { name: "Hitu Tuki Rapu", img: "/images/team/hitu_tuki.png" },
      { name: "Tu'u Kura Tuki Aránguiz", img: "/images/team/tuukura_tuki.png" },
      { name: "Mahai Soler Hotu", img: "/images/team/mahai_soler.png" },
      { name: "Merahi Edmunds Hernández", img: "/images/team/merahi_edmunds.png" },
      { name: "Dora Tuki Beri-beri", img: "/images/team/dora_tuki.png" },
      { name: "Alberto Pacomio Hotus", img: "/images/team/alberto_pacomio.png" },
      { name: "Johnny Tucki Hucke", img: "/images/team/johnny_tucki.png" },
      { name: "Blanca Hucke Atam", img: "/images/team/blanca_hucke.png" },
      { name: "David Teao", img: "/images/team/david_teao.png" },
      { name: "Mario Tuki Hey", img: "/images/team/mario_tuki.png" },
      { name: "Ana Iris Chavez Ika", img: "/images/team/anairis_chavez.png" },
      { name: "Elena Tuki Hotus", img: "/images/team/elena_tuki.png" },
	  { name: "Rachel Riroroko Calderón", img: "/images/team/rachel_riroroko.png" },
	  
	  // Instituto Galvarino
	  //{ name: "Manuel Santander", img: "/images/team/manuel_santander.png" },
	  //{ name: "Flor Caniupil", img: "/images/team/flor_caniupil.png" },
	  //{ name: "Rosa Caniupil", img: "/images/team/rosa_caniupil.png" },
  
	  // Cenia
	  { name: "Carlos Aspillaga", img: "/images/team/carlos.jpg" },
	  { name: "Sebastián Ricke", img: "/images/team/sebastian.png" },
	  { name: "Martín Pizarro", img: "/images/team/martin.jpg" },
	  { name: "Guillermo Figueroa", img: "/images/team/guillermo.jpg" },
	  { name: "Hugo Zeballos", img: "/images/team/hugo.jpg" },
	  { name: "Canela Orellana", img: "/images/team/canela.jpg" },
	  { name: "Estefanía Pakarati", img: "/images/team/estefania.jpg" },
	  { name: "Agustín Ghent", img: "/images/team/agustin.png" },
	  { name: "César Rivera", img: "/images/team/cesar.png" },
	  //{ name: "Guillaume Chapuis", img: "/images/team/guillaume.png" },
	  
	  // EAA UC
	  { name: "Jaime Coquelet", img: "/images/team/jaime.png" },
	  { name: "Loreto Ulloa", img: "/images/team/loreto.png" },
	  { name: "Francisca del Valle", img: "/images/team/francisca.jpg" },
	  { name: "Tomás Pesce", img: "/images/team/tomas.png" },
	  
  ];
  
  const validationPartners = [
	  { name: "Municipalidad de Rapa Nui", img: "/images/municipalidad.png" },
	  { name: "CONADI", img: "/images/conadi.png" },
	  { name: "Educación Intercultural", img: "/images/educacion_intercultural.png" },
	  { name: "Hospital Hanga Roa", img: "/images/Hospital_Hanga_Roa.png" },
	  { name: "UCAI", img: "/images/ucai.png" },
	  { name: "Hōnui", img: "/images/honui.png" },
	  { name: "Colegio Lorenzo Baeza Vega", img: "/images/colegio_lorenzo.png" },
	  { name: "Liceo Aldea Educativa", img: "/images/liceo_aldea.png" },
	  { name: "Mana", img: "/images/mana.png" }
  ];
  
  const specialThanks = [
	  ["Fátima Hotus Hey", "Cristian Vasquez", "Josefina Irribarra", "Daniela Contreras", "Constanza Cruz"],
	  ["Pia Cassone", "Irma Palominos", "Marcos Lores", "Javiera Acevedo", "Waldo Gutiérrez"],
	  ["Álvaro Soto", "Gianyser González", "Romina Hidalgo", "Andrés Carvallo"]
	  //Participantes Txawun de validación
  ];
  
  
  
  const nextSlide = () => {
    setSlideDirection('next');
    setCurrentSlide((prev) => (prev + 1) % testimonials.length);
  };

  const prevSlide = () => {
    setSlideDirection('prev');
    setCurrentSlide((prev) => (prev - 1 + testimonials.length) % testimonials.length);
  };
  
  // Logic to get an array of 3 items starting from currentSlide (Circular)
  const getVisibleTestimonials = () => {
    const visible = [];
    for (let i = 0; i < 3; i++) {
      const index = (currentSlide + i) % testimonials.length;
      visible.push(testimonials[index]);
    }
    return visible;
  };
  
  const visibleTestimonials = getVisibleTestimonials();

  return (
    <div className="flex flex-col min-h-screen min-w-full bg-gray-100 items-center">
	  <main className="flex flex-col min-w-full h-100 w-100">
	  
	    {/* --- STICKY HEADER --- */}
		<div 
		  className={`fixed top-0 left-0 w-full z-[100] transition-all duration-500 transform ${
			showStickyHeader ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0'
		  } bg-white/95 backdrop-blur-md shadow-md py-3 px-6 md:px-12 flex justify-between items-center`}
		>
			{/* Left: Small Logo */}
			<div 
				className="cursor-pointer h-10 w-10 relative"
				onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
			>
				 <Image 
					src="/images/academia_bg.png" 
					alt="Logo" 
					fill 
					className="object-contain"
				 />
			</div>

			{/* Center/Right: Menu & Lang & CTA */}
			<div className="flex items-center gap-6">
				{/* Dark Text Menu */}
				<nav className="hidden lg:flex flex-row gap-6">
					<a href="#team" className="text-gray-700 font-medium hover:text-[#FFA500] transition-colors">Equipo</a>
					<a href="#cocreation" className="text-gray-700 font-medium hover:text-[#FFA500] transition-colors">El Proceso</a>
					<a href="#about" className="text-gray-700 font-medium hover:text-[#FFA500] transition-colors">Objetivo</a>
					<a href="#focus" className="text-gray-700 font-medium hover:text-[#FFA500] transition-colors">Enfoque</a>
					<a href="#contact" className="text-gray-700 font-medium hover:text-[#FFA500] transition-colors">Contacto</a>
				</nav>

				<Link 
					href="/translator" 
					onClick={() => trackClick('try_translator_sticky_button_click')}
				>
					<button className="bg-[#FFA500] hover:bg-[#FFB700] text-black font-bold py-2 px-5 rounded-full shadow-md transition-transform transform hover:scale-105 border border-[#E59400] text-sm">
						Usar el Traductor
					</button>
				</Link>
			</div>
		</div>
	
		<div className="relative min-h-screen w-full overflow-hidden flex flex-col justify-between">
		  
		  {/* Background Image */}
		  <div ref={parallaxRef} className="absolute inset-0 z-0">
			 <Image
				  src={`/images/landing-${VARIANT_LANG}.png`}
				  alt="Landing background"
				  fill
				  className="object-cover"
				  priority
			  />
		  </div>
		  <div className="absolute inset-0 z-0 mix-blend-multiply bg-[rgb(31,202,253)]/70"></div>
		  <div className="absolute inset-0 bg-gradient-to-b from-blue-800/50 to-blue-900/90 z-0"></div>
		
		  {/* Content Container */}
		  <div className="relative z-10 w-full min-h-screen flex flex-col justify-between">
    
			  {/* TOP SECTION: Header, Title, Logos (Needs Padding) */}
			  <div className="flex flex-col flex-grow justify-between px-6 pt-6 md:px-12 md:pt-12">
				
				  {/* Top Bar: Logo Left, Language Right */}
				  <div className="flex justify-between items-start w-full">
					  {/* Top Left Logo (Umaŋa Hatu Re'o) */}
					  <div className="w-20 md:w-28 aspect-square relative">
						  <Image 
							  src="/images/academia_bg.png" 
							  alt="Umaŋa Hatu Re'o Logo" 
							  width={200} 
							  height={200}
							  className="object-contain drop-shadow-[0_0_40px_rgba(255,255,255,1.0)]"
						  />
				      </div>

					  {/* Top Right Section: Menu + Language Selector */}
					  <div className="flex flex-col items-end gap-3 z-50">
						  
						  {/* NEW: Navigation Menu */}
						  <nav className="hidden lg:flex flex-row gap-6 mb-1">
							<a href="#team" className="text-white text-base font-medium hover:text-[#FFA500] transition-colors drop-shadow-md">
							  Equipo
							</a>
							<a href="#cocreation" className="text-white text-base font-medium hover:text-[#FFA500] transition-colors drop-shadow-md">
							  El Proceso
							</a>
							<a href="#about" className="text-white text-base font-medium hover:text-[#FFA500] transition-colors drop-shadow-md">
							  Objetivo
							</a>
							<a href="#focus" className="text-white text-base font-medium hover:text-[#FFA500] transition-colors drop-shadow-md">
							  Enfoque
							</a>
							<a href="#contact" className="text-white text-base font-medium hover:text-[#FFA500] transition-colors drop-shadow-md">
							  Contacto
							</a>
						  </nav>

						  {/* Existing Language Selector Row */}
						  <div className="flex flex-row items-center gap-4">
							<Label className="text-white items-center flex gap-2 drop-shadow-md">Selecciona tu idioma</Label>
							<Select onValueChange={handleLanguageChange} defaultValue={language}>
								<SelectTrigger className="w-[120px] bg-transparent border border-white text-white focus:ring-0 focus:ring-offset-0">
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
					  </div>
				  </div>

				  {/* Center Content: Title & CTA */}
				  <div className="text-center text-white max-w-4xl mx-auto flex flex-col items-center gap-6">
					<h1 className="text-4xl md:text-[2.75rem] leading-none font-bold tracking-tight drop-shadow-md">
						{text.Title[language]}
					</h1>
					<p className="text-xl md:text-2xl font-light max-w-2xl mx-auto opacity-95">
						{text.Subtitle[language]}
					</p>
					
					{/* Yellow Action Button */}
					<Link 
						href="/translator" 
						onClick={() => trackClick('try_translator_button_click')} 
						className="mt-4 relative group"
					>
						<div className="absolute inset-0 bg-amber-600 rounded-full blur opacity-50 group-hover:opacity-75 transition-opacity"></div>
						<button className="relative bg-[#FFA500] hover:bg-[#FFB700] text-black font-extrabold text-lg py-3 px-8 rounded-full shadow-[0_4px_14px_0_rgba(0,0,0,0.3)] transition-transform transform group-hover:scale-105 border-2 border-[#E59400]">
							Usar el Traductor
						</button>
					</Link>
				  </div>
				  
				  {/* --- 1. LOGOS SECTION --- */}
				  <div className="w-full flex flex-col md:flex-row justify-between items-end gap-6 mt-auto mb-[20px]">
					<div className="flex gap-9 items-center opacity-90">
						 <div className="h-10 md:h-12 relative w-32 brightness-0 invert">
							<Image src="/images/cenia_bg.png" alt="Cenia" fill className="object-contain object-left" />
						 </div>
						 <div className="h-16 md:h-18 relative w-32 brightness-0 invert">
							<Image src="/images/eaa_bg.png" alt="EAA UC" fill className="object-contain object-left" />
						 </div>
					</div>
					
					<div className="h-10 md:h-12 relative w-32 opacity-90 brightness-0 invert">
						<Image src="/images/voces_bg.png" alt="Voces" fill className="object-contain object-right" />
					</div>
				  </div>
			  </div>

              {/* --- 2. TESTIMONIAL CAROUSEL --- */}
			  <div className="w-full bg-[#F2E8D5] py-7 shadow-2xl z-20"> 
				<div className="container mx-auto px-10 md:px-10">
					
					{/* Carousel Row */}
					<div className="flex items-center justify-between relative">
						
						{/* Left Arrow */}
						<button 
							onClick={prevSlide}
							className="text-[#A07E5E] hover:text-[#5C3A21] transition-all active:scale-95 p-8"
							aria-label="Previous testimonial"
						>
							<FontAwesomeIcon icon={faChevronLeft} className="h-6 w-6 md:h-8 md:w-8" />
						</button>

						{/* Cards Container */}
						<div className="flex-1 overflow-hidden w-full flex justify-center">
							<div 
								key={currentSlide}
								className={`flex flex-row justify-center items-center w-full gap-4 md:gap-12 animate-in fade-in duration-500 ${
									slideDirection === 'next' ? 'slide-in-from-right-12' : 'slide-in-from-left-12'
								}`}
							>
								{visibleTestimonials.map((person, idx) => (
									<div 
										key={`${person.name}-${idx}`} 
										className={`flex flex-row items-center gap-3 flex-1 max-w-lg ${idx !== 1 ? 'hidden lg:flex' : 'flex'}`}
									>
										{/* Person Image */}
										<div className="relative w-28 h-28 md:w-28 md:h-28 flex-shrink-0">
											<Image 
												src={person.img} 
												alt={person.name} 
												fill 
												className="rounded-full object-cover shadow-md border-2 border-[#DCCbb0]"
											/>
										</div>

										{/* Text Content */}
										<div className="flex flex-col w-full gap-1">
											
											{/* Top Pattern */}
											<div className="w-full h-5 relative">
												<Image 
												src="/images/pattern_line.png" 
												alt="pattern" 
												fill 
												className="object-contain object-left"
												/>
											</div>

											{/* Quote */}
											<div className="py-0.5">
												<p className="text-gray-900 font-serif font-bold text-xs md:text-sm leading-tight">
													"{person.quote}"
												</p>
												<span className="font-extrabold text-gray-800 text-[10px] md:text-[11px] block uppercase tracking-wide mt-1">
													- {person.name}
												</span>
											</div>

											{/* Bottom Pattern */}
											<div className="w-full h-5 relative">
												<Image 
												src="/images/pattern_line.png" 
												alt="pattern" 
												fill 
												className="object-contain object-left"
												/>
											</div>
										</div>
									</div>
								))}
							</div>
						</div>

						{/* Right Arrow */}
						<button 
							onClick={nextSlide}
							className="text-[#A07E5E] hover:text-[#5C3A21] transition-all active:scale-95 p-8"
							aria-label="Next testimonial"
						>
							<FontAwesomeIcon icon={faChevronRight} className="h-6 w-6 md:h-8 md:w-8" />
						</button>
					</div>

					{/* Pagination Dots */}
					<div className="flex justify-center gap-2 mt-2">
						{testimonials.map((_, index) => (
							<button
								key={index}
								onClick={() => setCurrentSlide(index)}
								className={`h-1.5 w-1.5 rounded-full transition-all ${
									currentSlide === index ? 'bg-[#5C3A21] w-3' : 'bg-[#C4A484]'
								}`}
								aria-label={`Go to slide ${index + 1}`}
							/>
						))}
					</div>

				</div>
			  </div>

          </div>
	    </div>
		
		{/* --- Collaborative Effort --- */}
        <section className="w-full py-10 bg-white flex flex-col items-center justify-center gap-6">
            <h2 className="text-2xl font-bold text-black tracking-tight">Un Esfuerzo Colaborativo</h2>
            <div className="flex items-center gap-5">
                 {/* Academy Logo (Colored or Dark) */}
                 <div className="h-20 w-20 relative">
                     <Image src="/images/academia_bg.png" alt="Academia" fill className="object-contain" />
                 </div>
                 
                 {/* VOCES Logo (Black text version) */}
                 <div className="h-10 w-32 relative brightness-0">
                     <Image src="/images/voces_bg.png" alt="Voces" fill className="object-contain" />
                 </div>
            </div>
        </section>
		
		{/* --- TEAM, VALIDATION & SPECIAL THANKS SECTION --- */}
        <section id="team" className="w-full py-16 bg-[#F2E8D5] flex flex-col items-center">
            
            {/* 1. TEAM HEADER */}
            <div className="flex items-center gap-4 mb-2 justify-center w-full">
                <div className="hidden md:block relative h-8 w-32 md:w-48 opacity-60">
                     <Image src="/images/pattern_line.png" alt="pattern" fill className="object-contain scale-x-[-1]" />
                </div>
                <h2 className="text-4xl md:text-5xl font-extrabold text-[#5C3A21] uppercase tracking-wide">EQUIPO</h2>
                <div className="hidden md:block relative h-8 w-32 md:w-48 opacity-60">
                     <Image src="/images/pattern_line.png" alt="pattern" fill className="object-contain" />
                </div>
            </div>

            {/* Subheader: Equipo de Desarrollo */}
            <div className="flex items-center w-full max-w-7xl gap-6 mb-8 px-12 md:px-32">
                <div className="h-[2px] bg-[#A07E5E] flex-grow rounded-full"></div>
                <h3 className="text-lg md:text-xl font-bold text-[#5C3A21] uppercase tracking-widest text-center whitespace-nowrap">
                    EQUIPO DE DESARROLLO
                </h3>
                <div className="h-[2px] bg-[#A07E5E] flex-grow rounded-full"></div>
            </div>

            {/* Team Grid */}
            <div className="container mx-auto px-12 md:px-32 mb-16">
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-y-6 gap-x-6 justify-items-center">
                    {teamMembers.map((member, index) => (
                        <div key={index} className="flex flex-col items-center gap-2 group">
                            <div className="relative w-20 h-20 md:w-24 md:h-24 rounded-full overflow-hidden border-4 border-[#e6d8c0] shadow-md transition-transform transform group-hover:scale-105 bg-gray-200">
                                <Image 
                                    src={member.img} 
                                    alt={member.name} 
                                    fill 
                                    className="object-cover"
                                />
                            </div>
                            <p className="text-xs md:text-sm font-bold text-[#4a3b2a] text-center leading-tight max-w-[120px]">
                                {member.name}
                            </p>
                        </div>
                    ))}
                </div>
            </div>

            {/* 2. VALIDATION PARTICIPANTS HEADER */}
            <div className="flex items-center w-full max-w-7xl gap-6 mb-8 px-12 md:px-32">
                <div className="h-[2px] bg-[#A07E5E] flex-grow rounded-full"></div>
                <h3 className="text-lg md:text-xl font-bold text-[#5C3A21] uppercase tracking-widest text-center whitespace-nowrap">
                    PARTICIPANTES VALIDACIÓN
                </h3>
                <div className="h-[2px] bg-[#A07E5E] flex-grow rounded-full"></div>
            </div>

            {/* Validation Grid */}
            <div className="container mx-auto px-12 md:px-32 mb-16">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-y-8 gap-x-8 justify-items-center items-start">
                    {validationPartners.map((partner, index) => (
                        <div key={index} className="flex flex-col items-center gap-3 w-full max-w-[140px]">
                            <div className="relative h-20 w-full hover:scale-105 transition-transform duration-300">
                                <Image 
                                    src={partner.img} 
                                    alt={partner.name} 
                                    fill 
                                    className="object-contain"
                                />
                            </div>
                            <span className="text-xs font-semibold text-[#5C3A21] text-center leading-tight">
                                {partner.name}
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            {/* 3. SPECIAL THANKS HEADER */}
            <div className="flex items-center w-full max-w-7xl gap-6 mb-8 px-12 md:px-32">
                <div className="h-[2px] bg-[#A07E5E] flex-grow rounded-full"></div>
                <h3 className="text-lg md:text-xl font-bold text-[#5C3A21] uppercase tracking-widest text-center whitespace-nowrap">
                    AGRADECIMIENTOS ESPECIALES
                </h3>
                <div className="h-[2px] bg-[#A07E5E] flex-grow rounded-full"></div>
            </div>

            {/* Special Thanks List */}
            <div className="container mx-auto px-4 md:px-32">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
                    {specialThanks.map((column, colIndex) => (
                        <div key={colIndex} className="flex flex-col gap-1">
                            {column.map((name, nameIndex) => (
                                <p key={nameIndex} className="text-[#5C3A21] text-lg font-medium leading-relaxed">
                                    {name}
                                </p>
                            ))}
                        </div>
                    ))}
                </div>
            </div>
        </section>

        {/* --- NEW SECTION: PROCESO DE CO-CREACIÓN --- */}
        <section id="co-creation" className="w-full py-16 bg-white flex flex-col items-center">
             {/* Main Title with Patterns */}
            <div className="flex items-center gap-4 mb-12 justify-center w-full px-4">
                <div className="hidden md:block relative h-12 w-32 md:w-64 opacity-80">
                     <Image src="/images/pattern_line.png" alt="pattern" fill className="object-contain scale-x-[-1]" />
                </div>
                <h2 className="text-3xl md:text-5xl font-extrabold text-[#4a4a4a] uppercase tracking-tight text-center">
                    PROCESO DE CO-CREACIÓN
                </h2>
                <div className="hidden md:block relative h-12 w-32 md:w-64 opacity-80">
                     <Image src="/images/pattern_line.png" alt="pattern" fill className="object-contain" />
                </div>
            </div>

            {/* Timeline Diagram */}
            {/* Using an image for the complex timeline diagram as per the 'depicted image' request */}
            <div className="container mx-auto px-4 md:px-12 w-full flex justify-center">
                <div className="relative w-full max-w-6xl aspect-[2/1] md:aspect-[3/1]">
                    <Image 
                        src="/images/co_creation_timeline.png" 
                        alt="Proceso de Co-Creación Timeline" 
                        fill 
                        className="object-contain"
                    />
                </div>
            </div>
        </section>
		
		{/* --- NEW SECTION: COMMUNITY JOURNEY & PARTICIPATION --- */}
        <section id="community-participation" className="w-full py-16 bg-[#E3F2FD] flex flex-col items-center">
            <div className="container mx-auto px-6 md:px-16">
                
                {/* Header Text */}
                <div className="text-center mb-10 max-w-5xl mx-auto">
                    <h2 className="text-3xl md:text-4xl font-extrabold text-[#1a202c] mb-6 tracking-tight">
                        Our Co-Creation Journey & Community Participation
                    </h2>
                    <p className="text-[#2d3748] text-lg md:text-xl leading-relaxed">
                        Our participation design strategies create reconstruction frameworks from delineating urban oxidation
                        needed for dependent transmission. By establishing clear engagement frameworks we ensure that every
                        community member's voice is heard, respected, and incorporated into the final outcome.
                    </p>
                </div>

                {/* Photo Grid (Bento / Masonry Style) */}
                <div className="flex flex-col gap-4 w-full">
                    
                    {/* Row 1: Split Left (Large) and Right (2 Stacked) */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-auto md:h-[500px]">
                        
                        {/* Left Main Image */}
                        <div className="md:col-span-2 relative h-64 md:h-full rounded-3xl overflow-hidden shadow-lg border-4 border-white">
                            <Image 
                                src="/images/community_journey_1.png" 
                                alt="Community Workshop Table" 
                                fill 
                                className="object-cover hover:scale-105 transition-transform duration-700 ease-in-out"
                            />
                        </div>
                        
                        {/* Right Stack */}
                        <div className="flex flex-col gap-4 h-full">
                            <div className="relative flex-1 h-64 md:h-full rounded-3xl overflow-hidden shadow-lg border-4 border-white">
                                <Image 
                                    src="/images/community_journey_2.png" 
                                    alt="Small Group Discussion" 
                                    fill 
                                    className="object-cover hover:scale-105 transition-transform duration-700 ease-in-out"
                                />
                            </div>
                            <div className="relative flex-1 h-64 md:h-full rounded-3xl overflow-hidden shadow-lg border-4 border-white">
                                <Image 
                                    src="/images/community_journey_3.png" 
                                    alt="Intimate Circle" 
                                    fill 
                                    className="object-cover hover:scale-105 transition-transform duration-700 ease-in-out"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Row 2: Full Width Panorama */}
                    <div className="relative w-full h-64 md:h-[450px] rounded-3xl overflow-hidden shadow-lg border-4 border-white">
                        <Image 
                            src="/images/community_journey_4.png" 
                            alt="Large Community Assembly" 
                            fill 
                            className="object-cover hover:scale-105 transition-transform duration-700 ease-in-out"
                        />
                    </div>

                    {/* Row 3: Two Columns */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-64 md:h-[350px]">
                        <div className="relative w-full h-full rounded-3xl overflow-hidden shadow-lg border-4 border-white">
                            <Image 
                                src="/images/community_journey_5.png" 
                                alt="Workshop Presentation" 
                                fill 
                                className="object-cover hover:scale-105 transition-transform duration-700 ease-in-out"
                            />
                        </div>
                        <div className="relative w-full h-full rounded-3xl overflow-hidden shadow-lg border-4 border-white">
                             <Image 
                                src="/images/community_journey_6.png" 
                                alt="Classroom Engagement" 
                                fill 
                                className="object-cover hover:scale-105 transition-transform duration-700 ease-in-out"
                            />
                        </div>
                    </div>

                </div>
            </div>
        </section>
		
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
		
		{/* --- FINAL SECTION: CONTACT & FOOTER --- */}
        <section id="contact" className="w-full pt-16 pb-12 bg-[#F2E8D5] flex flex-col items-center relative">
            
            {/* 1. Header: CONTACTO */}
            <div className="flex items-center w-full max-w-lg gap-4 mb-10 px-6">
                <div className="h-[1px] bg-[#8B6E4E] flex-grow"></div>
                <h2 className="text-3xl md:text-4xl font-extrabold text-[#1a1a1a] uppercase tracking-tighter">
                    CONTACTO
                </h2>
                <div className="h-[1px] bg-[#8B6E4E] flex-grow"></div>
            </div>

            {/* 2. Inline Form */}
            <div className="w-full max-w-md px-6 flex flex-col gap-5 z-10">
                
                {/* Name Input */}
                <div className="relative group">
                    <Input
                        type="text"
                        placeholder="Nombre"
                        value={newParticipate.first_name}
                        onChange={(e) =>
                            setNewParticipate({
                              ...newParticipate,
                              first_name: e.target.value,
                            })
                        }
                        className="w-full h-12 rounded-full border-2 border-[#93C5FD] bg-white px-6 text-gray-700 placeholder:text-gray-500 shadow-[0_0_15px_rgba(59,130,246,0.15)] focus-visible:ring-0 focus-visible:border-[#3B82F6] transition-all"
                    />
                </div>

                {/* Email Input */}
                <div className="relative group">
                    <Input
                        type="email"
                        placeholder="Correo"
                        value={newParticipate.email}
                        onChange={(e) =>
                            setNewParticipate({
                              ...newParticipate,
                              email: e.target.value,
                            })
                        }
                        className="w-full h-12 rounded-full border-2 border-[#93C5FD] bg-white px-6 text-gray-700 placeholder:text-gray-500 shadow-[0_0_15px_rgba(59,130,246,0.15)] focus-visible:ring-0 focus-visible:border-[#3B82F6] transition-all"
                    />
                </div>

                {/* Message Input */}
                <div className="relative group">
                    <Textarea
                        placeholder="Mensaje"
                        value={newParticipate.reason}
                        onChange={(e) =>
                            setNewParticipate({
                              ...newParticipate,
                              reason: e.target.value,
                            })
                        }
                        className="w-full h-40 rounded-3xl border-2 border-[#93C5FD] bg-white px-6 py-4 text-gray-700 placeholder:text-gray-500 shadow-[0_0_15px_rgba(59,130,246,0.15)] focus-visible:ring-0 focus-visible:border-[#3B82F6] resize-none transition-all"
                    />
                </div>

                {/* Submit Button */}
                <div className="flex justify-center mt-2">
                    <Button 
                        onClick={handleSubmitForm} 
                        disabled={isLoading}
                        className="bg-[#0070C0] hover:bg-[#005a9e] text-white font-bold text-lg py-6 px-16 rounded-full shadow-lg transition-transform transform hover:scale-105"
                    >
                        {isLoading ? <FontAwesomeIcon icon={faSpinner} className="h-5 w-5 animate-spin" /> : "ENVIAR"}
                    </Button>
                </div>
            </div>

            {/* 3. Decorative Divider Pattern */}
            <div className="w-full h-16 relative mt-16 mb-8 opacity-80">
                {/* Assuming a rapa nui pattern strip image exists. Reusing pattern_line or a specific footer pattern */}
                <Image 
                    src="/images/pattern_line.png" // Replace with specific footer pattern if available
                    alt="Decorative Pattern" 
                    fill 
                    className="object-cover md:object-contain"
                />
            </div>

            {/* 4. Financing Footer */}
            <div className="flex flex-col items-center gap-8 pb-16 w-full">
                <p className="text-[#1a1a1a] font-bold text-xl uppercase tracking-wide">
                    Financiado con el apoyo de:
                </p>
                
                <div className="flex flex-wrap justify-center items-end gap-x-12 gap-y-10 px-6 w-full max-w-6xl">
                    
                    {/* Lacuna Fund */}
                    <div className="flex flex-col items-center gap-3">
                        <div className="relative h-20 w-48 hover:scale-105 transition-transform duration-300">
                            <Image src="/images/lacuna.png" alt="Lacuna Fund" fill className="object-contain" />
                        </div>
                        <span className="text-[#4a4a4a] font-semibold text-sm">Lacuna Fund</span>
                    </div>

                    {/* ANID */}
                    <div className="flex flex-col items-center gap-3">
                        <div className="relative h-24 w-24 hover:scale-105 transition-transform duration-300">
                            <Image src="/images/anid.png" alt="ANID" fill className="object-contain" />
                        </div>
                        <span className="text-[#4a4a4a] font-semibold text-sm">ANID (IT24I0155)</span>
                    </div>

                    {/* Internet Society */}
                    <div className="flex flex-col items-center gap-3">
                        <div className="relative h-20 w-48 hover:scale-105 transition-transform duration-300">
                            <Image src="/images/isoc.png" alt="Internet Society" fill className="object-contain" />
                        </div>
                        <span className="text-[#4a4a4a] font-semibold text-sm">Internet Society</span>
                    </div>

                    {/* CONADI */}
                    <div className="flex flex-col items-center gap-3">
                        <div className="relative h-20 w-40 hover:scale-105 transition-transform duration-300">
                            <Image src="/images/conadi.png" alt="CONADI" fill className="object-contain" />
                        </div>
                        <span className="text-[#4a4a4a] font-semibold text-sm">CONADI</span>
                    </div>

                    {/* Hare Tāvana */}
                    <div className="flex flex-col items-center gap-3">
                        <div className="relative h-24 w-24 hover:scale-105 transition-transform duration-300">
                            <Image src="/images/municipalidad.png" alt="Hare Tāvana" fill className="object-contain" />
                        </div>
                        <span className="text-[#4a4a4a] font-semibold text-sm">Hare Tāvana</span>
                    </div>

                </div>
            </div>
        </section>		
		
        <Toaster />
      </main>
    </div>
  )
}