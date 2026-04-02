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

import React, { useContext, useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { faUsersGear, faDatabase, faHouse, faLanguage, faUser, faBars, faX, faArrowRightFromBracket } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Button } from "@/components/ui/button";
import { AuthContext } from '@/app/contexts';
import { PATHS, NATIVE_ADMIN, ADMIN, NO_USER_PATHS, ACCESS_TOKEN, DICTIONARY_ENABLED} from '@/app/constants';
import ActionButton from '../actionButton/actionButton';
import './menu.css'

const iconMap = {
  'menu': faBars,
  'users': faUsersGear,
  'language': faLanguage,
  'user': faUser,
  'database': faDatabase,
  'home': faHouse
}


export default function Menu(){
  
  const path = usePathname();
  const currentUser = useContext(AuthContext);
  // set paths to public (no user), else check if admin or not
  const menuOptions = currentUser ? ((currentUser.profile.role == NATIVE_ADMIN || currentUser.profile.role == ADMIN) ? PATHS.ADMIN : PATHS.USER) : NO_USER_PATHS;
  
  const [isOpen, setIsOpen] = useState(false);

  const toggleMenu = () => {
    setIsOpen(!isOpen);
  }

  const closeMenu = () => {
    setIsOpen(false);
  }

  const handleLogout = () => {
    localStorage.removeItem(ACCESS_TOKEN);
    window.location.href = '/login';
    closeMenu()
  }

  const handleLogin = () => {
    window.location.href = '/login';
    closeMenu()
  }
  
  return (
      <>
        <div className={
          `absolute left-0 w-full z-50 pointer-events-none
          ${DICTIONARY_ENABLED ? 'top-12 max-[850px]:top-9 max-[850px]:mt-2' : 'top-4 max-[850px]:top-4 max-[850px]:mt-1'}
          animate-fade animate-once animate-duration-[1200ms] ${path !== '/translator'? 'animate-delay-[100ms]' : 'animate-delay-[1500ms]'} animate-ease-in-out 
          ${path === '/about'? 'hidden':''}
          `  
        }>
          <div className={`${DICTIONARY_ENABLED ? 'w-[96vw] max-w-[1600px] pl-2 max-[850px]:pl-1' : 'w-full pl-0 max-[850px]:pl-0'} mx-auto flex`}>
            <Button 
              onClick={toggleMenu}
              variant="ghost"
              className={`rounded-md pointer-events-auto ${path === '/profile'? 'hover:text-white' : 'hover:text-default'} hover:bg-transparent`}
              aria-label="Toggle menu"
            >
              <FontAwesomeIcon icon={faBars} className="h-6 w-6"/>
            </Button>
          </div>
        </div>

        {/* Overlay */}
        <div
          className={`fixed z-50 h-full bg-gradient-to-r from-black/80 to-transparent transition-all ${isOpen? 'w-full' : 'w-0'}`}
          onClick={closeMenu}
        />

        {/* Slide-in-out menu */}
        <div
          className={`fixed top-0 left-0 bottom-0 w-64 bg-background shadow-lg rounded-r-xl z-50 transform transition-transform duration-300 ease-in-out ${
            isOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="flex justify-end p-4">
            <Button 
              onClick={toggleMenu}
              variant="ghost"
              className="p-2 rounded-md hover:bg-gray-100 hover:text-default focus:outline-none focus:ring-2 focus:ring-default" 
              aria-label="Toggle menu"
            >
              <FontAwesomeIcon icon={faX} className="h-6 w-6" />
            </Button> 
          </div>

          <nav className="px-4 py-2 h-full flex flex-col">
    
                <ul className="flex flex-col space-y-2">
                {menuOptions.map((option) => {         
                return (
                  <li key={option.route}>
                    <a
                      href={option.route}
                      className="flex items-center p-2 rounded-md hover:bg-gray-100 text-foreground"
                      onClick={closeMenu}
                    >
                      <FontAwesomeIcon icon={iconMap[option.icon]} className="h-5 w-5 mr-3" />
                      {option.name}
                    </a>
                  </li>
                );
                })}
              </ul>
              {currentUser ? (
              <>
              <ActionButton
              className={"w-full mt-auto mb-20"}
              clickCallback={() => handleLogout()}
              icon={faArrowRightFromBracket}
            >
                  Cerrar sesión
                </ActionButton>
                </>
            ) : (
            <>
              <ActionButton
             className={"w-full mt-auto mb-20"}
             clickCallback={() => handleLogin()}
              icon={faArrowRightFromBracket}
            >
              Iniciar sesión
            </ActionButton>
            </>
            )}
          
          </nav>
        </div>
      </>
    )
}
