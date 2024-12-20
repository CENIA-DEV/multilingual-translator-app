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
import { ACCESS_TOKEN } from "./constants";

const api = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_URL
})

api.interceptors.request.use(
    (config) => {
      console.log(`API call to: ${config.baseURL}${config.url}`)
      const token = localStorage.getItem(ACCESS_TOKEN);
      if (token) {
        config.headers.Authorization = `Token ${token}`;
      }
      return config;
    },
    (error) => {
      return Promise.reject(error);
    }
  );

api.interceptors.response.use(
  (response) => {
    // Any status code that lie within the range of 2xx 
    console.log(`API call success ${response.status}`)
    console.log(response.data)
    return response;
  },
  (error) => {
    // Any status codes that falls outside the range of 2xx cause this function to trigger

    if (error.response) {
      console.error(`API responded with error status: ${error.response.status}`);
    } else if (error.request) {
      // The request was made but no response was received
      console.error('Request error:', error.request);
    } else {
      // Something happened in setting up the request that triggered an Error
      console.error('Error', error.message);  

    }
    
    if (error.response.status === 400) { // Bad request
      // Log api response data for debug
      console.log(error.response.data)
    } else if (error.response.status === 401) {
      console.log("Unauthorized")
      // redirect("/login")
      window.location.href = "/login"
    }
    return Promise.reject(error)
  }
);
  

export default api;