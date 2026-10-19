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

import axios from "axios";
import { ACCESS_TOKEN, AUTH_EXPIRED_EVENT } from "./constants";

const api = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_URL
})

api.interceptors.request.use(
    (config) => {
      const token = localStorage.getItem(ACCESS_TOKEN);
      if (token) {
        config.headers.Authorization = `Token ${token}`;
      }
      
      // Only set Content-Type if not FormData
      if (!(config.data instanceof FormData)) {
        config.headers['Content-Type'] = 'application/json';
      }
      
      config.headers['Accept'] = 'application/json';
      return config;
    },
    (error) => {
      return Promise.reject(error);
    }
  );

api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // 1. Silently ignore aborted requests so they don't clog the console
    if (axios.isCancel(error)) {
      return Promise.reject(error);
    }

    if (error.response) {
      console.error(`API responded with error status: ${error.response.status}`);
    } else if (error.request) {
      console.error('Request error:', error.message);
    } else {
      console.error('Error', error.message);
    }

    if (error.response?.status === 401) {
      // 2. No window.location.href redirect: public pages (translator, about...)
      // must keep working for anonymous visitors. Just clear the stale token and
      // let ProtectedRoute decide, using Next.js's router.replace(), whether the
      // current page needs a login.
      if (localStorage.getItem(ACCESS_TOKEN)) {
        localStorage.removeItem(ACCESS_TOKEN);
        window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
      }
    }

    return Promise.reject(error);
  }
);

export default api;
