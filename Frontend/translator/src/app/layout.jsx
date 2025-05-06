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

import { Suspense } from "react";
import "./globals.css";
import Loading from "./loading.jsx";
import { config } from "@fortawesome/fontawesome-svg-core";
import "@fortawesome/fontawesome-svg-core/styles.css";
import Menu from "./components/menu/menu";
import ProtectedRoute from "./protected-route";
import { Toaster } from "@/components/ui/sonner";
import { VARIANT_LANG, LANG_TITLE } from "./constants";
import Script from "next/script";
import PageViewTracker from "@/components/analytics/PageViewTracker";
config.autoAddCss = false;

export const metadata = {
  title: `Traductor ${LANG_TITLE}`,
  icons: {
    icon: `/logo-${VARIANT_LANG}.ico`,
  },
};

export default function Layout({ children }) {
  
  return (
    <html lang="es" suppressHydrationWarning={true}>
      <head>
        <title>{metadata.title}</title>
        <meta name="description" content={`Proyecto que busca revitalizar la lengua ${LANG_TITLE} mediante un traductor.`} />
        {/* {process.env.NEXT_PUBLIC_GOOGLE_SEARCH_ID && (
          <meta name="google-site-verification" content={process.env.NEXT_PUBLIC_GOOGLE_SEARCH_ID} />
        )} */}
        {/* Google Analytics */}
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID}`}
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID}');
          `}
        </Script>
      </head>
      <body>
        <ProtectedRoute>
          <Suspense fallback={<Loading />}>
            <PageViewTracker />
            <Menu />
            {children}
            <Toaster />
          </Suspense>
        </ProtectedRoute>
      </body>
    </html>
  );
}
