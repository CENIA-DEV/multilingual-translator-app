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
import { Toaster as UIToaster } from "@/components/ui/toaster";
import { VARIANT_LANG, LANG_TITLE, BASE_URL } from "./constants";
import Script from "next/script";
import PageViewTracker from "@/components/analytics/PageViewTracker";
config.autoAddCss = false;

const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

const TITLE = `Traductor ${LANG_TITLE}`;
const DESCRIPTION = `Proyecto que busca revitalizar la lengua ${LANG_TITLE} mediante un traductor.`;

export const metadata = {
  metadataBase: new URL(BASE_URL),
  title: TITLE,
  description: DESCRIPTION,
  keywords: [
    TITLE,
    LANG_TITLE,
    ...(VARIANT_LANG === "rap" ? ["Isla de Pascua", "Rapa Nui a español"] : ["Mapudungun", "mapuche"]),
    "traductor",
    "traducción",
    "español",
    "lenguas indígenas",
    "pueblos originarios",
    "revitalización lingüística",
  ],
  icons: {
    icon: `/logo-${VARIANT_LANG}.ico`,
  },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    siteName: TITLE,
    locale: "es_CL",
    type: "website",
    url: BASE_URL,
  },
};

export default function Layout({ children }) {
  
  return (
    <html lang="es" suppressHydrationWarning={true}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* This rule targets pages/_document; in the App Router root layout
            these fonts already load on every page. */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700&family=Newsreader:ital,opsz,wght@0,6..72,400..700;1,6..72,400..600&family=Roboto+Condensed:ital,wght@0,100..900;1,100..900&family=Roboto:ital,wght@0,100;0,300;0,400;0,500;0,700;0,900;1,100;1,300;1,400;1,500;1,700;1,900&display=swap" rel="stylesheet" />
        {/* {process.env.NEXT_PUBLIC_GOOGLE_SEARCH_ID && (
          <meta name="google-site-verification" content={process.env.NEXT_PUBLIC_GOOGLE_SEARCH_ID} />
        )} */}
        {/* Google Analytics */}
        {GA_MEASUREMENT_ID && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
              strategy="afterInteractive"
            />
            <Script id="google-analytics" strategy="afterInteractive">
              {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GA_MEASUREMENT_ID}');
          `}
            </Script>
          </>
        )}
      </head>
      <body>
        <ProtectedRoute>
          <Suspense fallback={<Loading />}>
            {/* useSearchParams would otherwise turn every static page into a
                client-only render of the Loading fallback */}
            <Suspense fallback={null}>
              <PageViewTracker />
            </Suspense>
            <Menu />
            {children}
            <Toaster />
            {/* Renders toasts from @/hooks/use-toast (admin pages, about page) */}
            <UIToaster />
          </Suspense>
        </ProtectedRoute>
      </body>
    </html>
  );
}
