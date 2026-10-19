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

import React, { useContext, useState } from 'react';
import { usePathname } from 'next/navigation';
import { faUsersGear, faDatabase, faHouse, faLanguage, faUser, faBars, faXmark, faArrowRightFromBracket, faPalette } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Button } from "@/components/ui/button";
import { AuthContext } from '@/app/contexts';
import { PATHS, NO_USER_PATHS, ACCESS_TOKEN, isAdminUser, canManageTranslator, TRANSLATOR_ADMIN_PATH } from '@/app/constants';
import ActionButton from '../actionButton/actionButton';
import LocaleSwitcher from '@/components/LocaleSwitcher';
import { useT } from '@/customization/useT';
import { useAccess } from '@/customization/access';
import './menu.css'

const iconMap = {
  'menu': faBars,
  'users': faUsersGear,
  'language': faLanguage,
  'user': faUser,
  'database': faDatabase,
  'home': faHouse,
  'palette': faPalette
}


export default function Menu(){
  
  const path = usePathname();
  const currentUser = useContext(AuthContext);
  // set paths to public (no user), else check if admin or not
  const access = useAccess(currentUser || null);
  const baseOptions = currentUser ? (isAdminUser(currentUser) ? PATHS.ADMIN : PATHS.USER) : NO_USER_PATHS;
  // the translator's link only if this person may open it, or could by logging in
  const showTranslator = access.can('translatorPage') || access.needsLogin('translatorPage');
  const visibleOptions = baseOptions.filter((option) => option.route !== '/translator' || showTranslator);
  const menuOptions = canManageTranslator(currentUser) ? [...visibleOptions, TRANSLATOR_ADMIN_PATH] : visibleOptions;
  
  const [isOpen, setIsOpen] = useState(false);
  const t = useT();

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
          `fixed top-4 left-4 max-[850px]:left-0 z-50 
          animate-fade animate-once animate-duration-[1200ms] ${path !== '/translator'? 'animate-delay-[100ms]' : 'animate-delay-[1500ms]'} animate-ease-in-out 
          ${path === '/about' || path?.startsWith('/manage-translator') ? 'hidden':''}
          `  
        }>
          <Button 
            onClick={toggleMenu}
            variant="ghost"
            className={`rounded-md ${path === '/profile'? 'hover:text-white' : 'hover:text-default'} hover:bg-transparent`}
            aria-label={t('menu.toggle')}
          >
            <FontAwesomeIcon icon={faBars} className="h-6 w-6"/>
          </Button>
        </div>

        {/* Overlay */}
        <div
          className={`fixed z-50 h-full bg-gradient-to-r from-black/80 to-transparent transition-all ${isOpen? 'w-full' : 'w-0'}`}
          onClick={closeMenu}
        />

        {/* Slide-in-out menu */}
        <div
          className={`fixed top-0 left-0 bottom-0 w-64 flex flex-col bg-background shadow-lg rounded-r-xl z-50 transform transition-transform duration-300 ease-in-out ${
            isOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="flex justify-end p-4">
            <Button 
              onClick={toggleMenu}
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-md hover:bg-gray-100 hover:text-default focus:outline-none focus:ring-2 focus:ring-default"
              aria-label={t('menu.toggle')}
            >
              <FontAwesomeIcon icon={faXmark} className="h-6 w-6" />
            </Button> 
          </div>

          <div className="px-4 pb-2">
            <LocaleSwitcher page="menu" className="shadow-none" />
          </div>

          {/* Takes the height left under the header; the list scrolls if it must so the
              session button always stays at the bottom of the screen */}
          <nav
            className="px-4 pt-2 flex-1 min-h-0 flex flex-col"
            style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
          >

                <ul className="flex flex-col space-y-2 flex-1 min-h-0 overflow-y-auto">
                {menuOptions.map((option) => {         
                return (
                  <li key={option.route}>
                    <a
                      href={option.route}
                      className="flex items-center p-2 rounded-md hover:bg-gray-100 text-foreground"
                      onClick={closeMenu}
                    >
                      <FontAwesomeIcon icon={iconMap[option.icon]} className="h-5 w-5 mr-3" />
                      {t(option.key)}
                    </a>
                  </li>
                );
                })}
              </ul>
              {currentUser ? (
              <>
              <ActionButton
              className={"w-full mt-4 shrink-0"}
              clickCallback={() => handleLogout()}
              icon={faArrowRightFromBracket}
            >
                  {t('menu.logout')}
                </ActionButton>
                </>
            ) : (
            <>
              <ActionButton
             className={"w-full mt-4 shrink-0"}
             clickCallback={() => handleLogin()}
              icon={faArrowRightFromBracket}
            >
              {t('menu.login')}
            </ActionButton>
            </>
            )}
          
          </nav>
        </div>
      </>
    )
}
