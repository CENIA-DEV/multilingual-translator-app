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
import { BASE_URL } from "./constants";
import Script from "next/script";
import PageViewTracker from "@/components/analytics/PageViewTracker";
import { ConfigProvider } from "@/customization/ConfigProvider";
import { resolveConfig } from "@/customization/presets";
import { landingFontsHref } from "@/customization/fonts";
import { resolveMedia } from "@/customization/media";
import { loadPublishedConfig } from "@/customization/server";
config.autoAddCss = false;

const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

// Every page is rendered per request so it carries the customization that is
// published right now (server.js caches it); a build-time snapshot would show
// the preset until the next deploy.
export const dynamic = "force-dynamic";

// Shares server.js's in-process cache with the layout below.
export async function generateMetadata() {
  const { stored } = await loadPublishedConfig();
  const { identity } = resolveConfig(stored);
  const favicon = resolveMedia(identity.favicon);
  return {
    metadataBase: new URL(BASE_URL),
    title: identity.siteTitle,
    description: identity.siteDescription,
    keywords: identity.keywords,
    ...(favicon ? { icons: { icon: favicon } } : {}),
    openGraph: {
      title: identity.siteTitle,
      description: identity.siteDescription,
      siteName: identity.siteTitle,
      locale: "es_CL",
      type: "website",
      url: BASE_URL,
    },
  };
}

export default async function Layout({ children }) {
  const { stored, version, source } = await loadPublishedConfig();
  const config = resolveConfig(stored);
  const landingFonts = landingFontsHref(config.theme.fonts);

  return (
    <html lang="es" suppressHydrationWarning={true}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* This rule targets pages/_document; in the App Router root layout
            these fonts already load on every page. */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link href="https://fonts.googleapis.com/css2?family=Roboto+Condensed:ital,wght@0,100..900;1,100..900&family=Roboto:ital,wght@0,100;0,300;0,400;0,500;0,700;0,900;1,100;1,300;1,400;1,500;1,700;1,900&display=swap" rel="stylesheet" />
        {/* Landing typefaces chosen in "Administrar Traductor" */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        {landingFonts && <link href={landingFonts} rel="stylesheet" />}
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
        <ConfigProvider initial={{ config, version, source }}>
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
        </ConfigProvider>
      </body>
    </html>
  );
}
