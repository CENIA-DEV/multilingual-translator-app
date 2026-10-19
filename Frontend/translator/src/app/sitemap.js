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

import { ALLOW_INDEXING, BASE_URL } from "./constants";

export default function sitemap() {
  if (!ALLOW_INDEXING) {
    return [];
  }

  const baseUrl = BASE_URL.replace(/\/+$/, "");
  // Public pages only ("/" redirects to "/about")
  const paths = ["/about", "/translator"];

  return paths.map((path) => ({
    url: `${baseUrl}${path}`,
    lastModified: new Date(),
    changeFrequency: "monthly",
    priority: path === "/about" ? 1 : 0.8,
  }));
}
