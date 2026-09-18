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
import { useContext, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AuthContext } from "./contexts";
import { isAdminUser } from "./constants";
import Loading from "./loading";

// Client-side guard for the admin pages. The menu already hides them from
// non-admins; this keeps someone who types the URL from seeing the page.
// The backend still enforces the permissions on every request.
export default function AdminRoute({ children }) {
  const currentUser = useContext(AuthContext);
  const router = useRouter();
  const isAdmin = isAdminUser(currentUser);

  useEffect(() => {
    // If auth state isn't provided yet, do nothing (ProtectedRoute handles loading)
    if (!currentUser) return;

    // Only admins are allowed here, send everyone else to the translator
    if (!isAdmin) {
      router.replace('/translator');
    }
  }, [currentUser, isAdmin, router]);

  if (!isAdmin) return <Loading />;

  return children;
}
