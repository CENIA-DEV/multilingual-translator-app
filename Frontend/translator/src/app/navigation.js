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

let router = null;

export const setRouter = (nextRouter) => {
  router = nextRouter;
};

export const navigate = (path) => {
  if (router) {
    router.push(path);
  } else {
    // Fallback to window.location if router isn't initialized
    window.location.href = path;
  }
};