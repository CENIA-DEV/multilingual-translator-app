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
import { ACCESS_TOKEN, PUBLIC_PATHS } from "./constants";
import Loading from "./loading";
import { redirect, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AuthContext } from "./contexts";
import { API_ENDPOINTS } from "./constants";
import api from "./api";

export default function ProtectedRoute({ children }) {
  
  const path = usePathname();

  const [currentUser, setCurrentUser] = useState(null);
  
  useEffect(() => {
    // get user from token
    const auth = async() => {
      if(typeof window !== 'undefined'){
        const token = localStorage.getItem(ACCESS_TOKEN);
        if (!token) {
          if (PUBLIC_PATHS.some(route => path.startsWith(route))) {
            setCurrentUser(false);
          } 
          else {
            // Redirect to about path is root
            if(path === '/'){
              window.location.href = '/about';
            }
            else{ // Redirect to login if token is missing
              window.location.href = '/login';
            }
          }
        } 
        else {
          try {
            const res = await api.get(
              API_ENDPOINTS.USERS+'get_by_token'
            )
              setCurrentUser(res.data)

              /* if (PUBLIC_PATHS.some(route => path.startsWith(route))){
                if (path !== '/about'){
                  window.location.href = '/about';
                }
              } */

            return
          } 
          catch (error) {
            console.log(error.response.data)
            // Invalid token, delete and redirect to login
            console.error(`Invalid token`);
            localStorage.removeItem(ACCESS_TOKEN);
            //setCurrentUser(false);
            window.location.href = '/login';
          }
        }
      }
    }
    if (!currentUser) {
      auth().catch(() => setCurrentUser(false));
    }
  }, [currentUser, path])
  
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

