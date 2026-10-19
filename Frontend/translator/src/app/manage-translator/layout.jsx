/* Copyright 2026 Centro Nacional de Inteligencia Artificial (CENIA, Chile). All rights reserved.

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

import { useContext, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AuthContext } from "../contexts";
import { canManageTranslator } from "../constants";
import Loading from "../loading";

// "Administrar Traductor" is for the technical team only (the backend enforces
// it too). Everyone else is sent back to the translator.
export default function TranslatorAdminLayout({ children }) {
  const currentUser = useContext(AuthContext);
  const router = useRouter();
  const allowed = canManageTranslator(currentUser);

  useEffect(() => {
    if (currentUser && !allowed) {
      router.replace('/translator');
    }
  }, [currentUser, allowed, router]);

  if (!allowed) return <Loading />;

  return children;
}
