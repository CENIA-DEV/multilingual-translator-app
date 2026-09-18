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
import { ACCESS_TOKEN, AUTH_EXPIRED_EVENT, PUBLIC_PATHS } from "./constants";
import Loading from "./loading";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AuthContext } from "./contexts";
import { API_ENDPOINTS } from "./constants";
import api from "./api";
import axios from "axios";

const isPublicPath = (path) => PUBLIC_PATHS.some(route => path?.startsWith(route));

export default function ProtectedRoute({ children }) {
  
  const path = usePathname();
  const router = useRouter();

  const [currentUser, setCurrentUser] = useState(null);

  // The API client clears the token when the backend rejects it (401). Drop the
  // cached user so the check below runs again: protected pages go to login,
  // public pages keep working for an anonymous visitor.
  useEffect(() => {
    const handleAuthExpired = () => setCurrentUser(null);
    window.addEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired);
  }, []);
  
  useEffect(() => {
    let isMounted = true; // Cleanup flag to prevent race conditions

    // get user from token
    const auth = async() => {
      if (typeof window === 'undefined') return;
      const token = localStorage.getItem(ACCESS_TOKEN);
      if (!token) {
        if (isPublicPath(path)) {
          if (isMounted) setCurrentUser(false);
        } 
        else if (path === '/') {
          // Redirect root to the about page
          router.replace('/about');
        }
        else { // Redirect to login if token is missing
          router.replace('/login');
        }
        return;
      } 

      try {
        const res = await api.get(
          API_ENDPOINTS.USERS+'get_by_token/'
        )
        if (isMounted) setCurrentUser(res.data);
      } 
      catch (error) {
        if (!isMounted) return; // Prevent state updates on unmounted component

        if (axios.isCancel(error)) {
          return;
        }

        // Invalid token, delete it and redirect to login unless the page is public
        console.error('Invalid token');
        localStorage.removeItem(ACCESS_TOKEN);
        if (isPublicPath(path)) {
          setCurrentUser(false);
        } else {
          router.replace('/login');
        }
      }
    }

    if (!currentUser) auth();

    // Cleanup function that runs if the component unmounts or path changes
    return () => {
      isMounted = false;
    };
  }, [currentUser, path, router])
  
  if (currentUser === null) {
    return <Loading/>;
  }
  if (currentUser) {
    return  (
      <AuthContext.Provider value={currentUser}>
        {children}  
      </AuthContext.Provider>
    ) 
  } 
  else { 
    return (
      <>
        {children}
      </>
    )
  };
}
