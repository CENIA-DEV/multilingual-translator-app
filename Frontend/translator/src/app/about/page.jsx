// Copyright 2024 Centro Nacional de Inteligencia Artificial (CENIA, Chile). All rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import parse from "html-react-parser"
import { faChevronDown, faSpinner } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"

import api from "../api"
import { text } from "./text"
import { t, SPANISH, LANGUAGE_OPTIONS } from "./i18n"
import {
  ACADEMY_BOARD,
  AI_VOICES,
  AUKIN_MAPU_TEAM,
  CENIA_TEAM,
  EAAUC_TEAM,
  INSTITUTIONS,
  REVIEWERS,
  THANKS_ARN,
  THANKS_RAP,
  TRANSCRIBERS,
  TRANSLATORS,
  VALIDATION_PLACES,
} from "./credits"
import RapaMap from "@/components/RapaMap"
import { VARIANT_LANG, LANG_TITLE } from "../constants"
import { useAnalytics } from "@/hooks/useAnalytics"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Toaster } from "@/components/ui/toaster"
import { useToast } from "@/hooks/use-toast"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

const IS_RAP = VARIANT_LANG === "rap"

const SERIF = "'Newsreader', Georgia, serif"
const SANS = "'Archivo', system-ui, sans-serif"

// Project photography from Rapa Nui, one per paragraph of "Acerca del proyecto"
// (see text.AboutProject.AboutProjectText) in the same order.
const ABOUT_PHOTOS = [
  {
    src: "/images/landing/community-gathering.jpg",
    alt: "Encuentro comunitario en Rapa Nui",
    fit: "cover",
  },
  {
    src: "/images/landing/translator-in-use.jpg",
    alt: "Traductor rapa nui - español en uso",
    fit: "cover",
  },
  {
    src: "/images/landing/academy-book-launch.jpg",
    alt: "Integrantes de la Academia de la Lengua Rapa Nui ꞌUmaŋa Hatu Reꞌo",
    fit: "cover",
  },
  {
    src: "/images/landing/speaker-interview.jpg",
    alt: "Sesión de trabajo con un hablante de rapa nui",
    fit: "cover",
  },
]

const FUNDERS = [
  { src: "/images/anid.png", alt: "ANID", caption: "ANID\nFondef IT24I0155" },
  { src: "/images/lacuna-fund.png", alt: "Lacuna Fund", caption: "Lacuna Fund" },
  { src: "/images/isoc.png", alt: "ISOC", caption: "ISOC" },
  { src: "/images/conadi.png", alt: "Conadi", caption: "Conadi" },
]

// Official VOCES wordmark. The source file is the blue logo on transparency;
// on the dark sections it is reversed to white with a filter instead of
// shipping a second asset.
function VocesLogo({ height, variant = "blue" }) {
  return (
    <Image
      src="/images/voces-logo.png"
      alt="VOCES"
      width={1109}
      height={225}
      style={{
        height: `${height}px`,
        width: "auto",
        objectFit: "contain",
        filter: variant === "white" ? "brightness(0) invert(1)" : undefined,
      }}
    />
  )
}

function CreditColumn({ title, names }) {
  return (
    <div className="reveal" style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      <h4 style={{ margin: "0 0 4px", fontSize: "15px", fontWeight: 700, color: "#17517e" }}>
        {title}
      </h4>
      {names.map((name) => (
        <span key={name} style={{ fontSize: "14.5px", color: "#44566a" }}>
          {name}
        </span>
      ))}
    </div>
  )
}

function AboutRow({ paragraph, photo, reverse }) {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        flexDirection: reverse ? "row-reverse" : "row",
        alignItems: "center",
        gap: "48px",
      }}
    >
      <div
        className={`reveal ${reverse ? "reveal-right" : "reveal-left"}`}
        style={{ flex: "1 1 320px", display: "flex", flexDirection: "column", gap: "14px" }}
      >
        <p
          className="landing-prose"
          style={{ margin: 0, fontSize: "17px", lineHeight: 1.75, color: "#33454f" }}
        >
          {parse(paragraph)}
        </p>
      </div>
      <div
        className={`reveal reveal-d1 ${reverse ? "reveal-left" : "reveal-right"}`}
        style={{
          position: "relative",
          flex: "1 1 320px",
          height: "320px",
          minWidth: 0,
          borderRadius: "6px",
          overflow: "hidden",
          background: photo.fit === "contain" ? "#ffffff" : "#dbe6ee",
        }}
      >
        <Image
          src={photo.src}
          alt={photo.alt}
          fill
          sizes="(max-width: 900px) 100vw, 480px"
          style={{ objectFit: photo.fit, padding: photo.fit === "contain" ? "28px" : 0 }}
        />
      </div>
    </div>
  )
}

export default function LandingPage() {
  const [language, setLanguage] = useState(SPANISH)
  const [isLoading, setIsLoading] = useState(false)
  const [isParticipateModalOpen, setIsParticipateModalOpen] = useState(false)
  const [newParticipate, setNewParticipate] = useState({
    email: "",
    reason: "",
    organization: "",
    first_name: "",
    last_name: "",
  })
  const { toast } = useToast()
  const { trackEvent } = useAnalytics()

  // Reveal every element marked .reveal the first time it scrolls into view.
  // The sections are plain markup rather than a component tree, so the class is
  // the contract and one observer drives all of them; each node is unobserved
  // after firing so the reveal never replays.
  //
  // .is-visible is set imperatively, so it lives on the DOM node rather than in
  // React state: any node React remounts comes back bare, at opacity 0. A
  // one-shot scan at mount would leave those stranded invisible forever, so the
  // pending set is rescanned whenever the DOM changes.
  useEffect(() => {
    const pending = () => document.querySelectorAll(".reveal:not(.is-visible)")

    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    if (reduced || typeof IntersectionObserver === "undefined") {
      const showAll = () => pending().forEach((node) => node.classList.add("is-visible"))
      showAll()
      const mutations = new MutationObserver(showAll)
      mutations.observe(document.body, { childList: true, subtree: true })
      return () => mutations.disconnect()
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return
          entry.target.classList.add("is-visible")
          observer.unobserve(entry.target)
        })
      },
      // Fire a little before the element is fully on screen, so the motion is
      // already settling by the time the reader reaches it.
      { threshold: 0.08, rootMargin: "0px 0px -10% 0px" }
    )

    // Re-observing a node the observer already watches is a no-op, so this is
    // safe to run on every mutation. Only childList is watched -- observing
    // attributes would re-trigger on the .is-visible writes above.
    const scan = () => pending().forEach((node) => observer.observe(node))
    scan()

    const mutations = new MutationObserver(scan)
    mutations.observe(document.body, { childList: true, subtree: true })

    return () => {
      mutations.disconnect()
      observer.disconnect()
    }
  }, [])

  const tr = (node) => t(node, language)

  const handleLanguageChange = (value) => {
    setLanguage(value)
    trackEvent("language_change", { language: value, page: "about" })
  }

  const handleSubmitForm = async () => {
    setIsLoading(true)
    try {
      await api.post("/api/participate-request/", newParticipate)
      toast({
        title: "Gracias por tu interés en colaborar con nosotros",
        description: "Te contactaremos a la brevedad",
      })
      trackEvent("participate_form_submit_success", {
        page: "about",
        email: newParticipate.email,
      })
      setIsParticipateModalOpen(false)
    } catch (error) {
      toast({
        title: "Hubo un error al enviar tu solicitud",
        description: "Por favor corrobore los datos y vuelva a intentarlo",
      })
      trackEvent("participate_form_submit_error", {
        page: "about",
        email: newParticipate.email,
      })
    } finally {
      setIsLoading(false)
    }
  }

  const paragraphs = text.AboutProject.AboutProjectText
  const thanks = IS_RAP ? THANKS_RAP : THANKS_ARN

  return (
    <div style={{ width: "100%", overflowX: "hidden", background: "#f4f7f9", fontFamily: SANS }}>
      {/*
        Scoped styles: the language switcher swaps between pills and a <select>
        purely in CSS so the markup is identical on server and client, the
        <strong> tags inside translated copy pick up the design's accent colour,
        and the motion classes below drive the entrance and scroll reveals.
      */}
      <style>{`
        .landing-prose strong { color: #17517e; font-weight: 700; }
        .lang-pills { display: flex; }
        .lang-select-wrap { display: none; }
        @media (max-width: 640px) {
          .lang-pills { display: none; }
          .lang-select-wrap { display: flex; }
        }
        /* Scroll reveal: elements start dimmed and offset, and the observer
           below adds .is-visible the first time they enter the viewport. The
           motion runs as an animation rather than a transition so the stagger
           delays never interfere with the hover transition on .lift. */
        .reveal { opacity: 0; transform: translateY(28px); }
        .reveal-left { transform: translateX(-36px); }
        .reveal-right { transform: translateX(36px); }
        .reveal-zoom { transform: scale(0.96); }
        .reveal.is-visible {
          opacity: 1;
          transform: none;
          animation: reveal-up 0.75s cubic-bezier(0.22,0.61,0.36,1) backwards;
        }
        .reveal-left.is-visible { animation-name: reveal-left; }
        .reveal-right.is-visible { animation-name: reveal-right; }
        .reveal-zoom.is-visible { animation-name: reveal-zoom; }
        .reveal.reveal-d1 { animation-delay: 0.08s; }
        .reveal.reveal-d2 { animation-delay: 0.16s; }
        .reveal.reveal-d3 { animation-delay: 0.24s; }
        .reveal.reveal-d4 { animation-delay: 0.32s; }
        .reveal.reveal-d5 { animation-delay: 0.40s; }
        @keyframes reveal-up {
          from { opacity: 0; transform: translateY(28px); }
          to { opacity: 1; transform: none; }
        }
        @keyframes reveal-left {
          from { opacity: 0; transform: translateX(-36px); }
          to { opacity: 1; transform: none; }
        }
        @keyframes reveal-right {
          from { opacity: 0; transform: translateX(36px); }
          to { opacity: 1; transform: none; }
        }
        @keyframes reveal-zoom {
          from { opacity: 0; transform: scale(0.96); }
          to { opacity: 1; transform: none; }
        }

        /* Hero copy rises once on load rather than on scroll -- it is already
           in view when the page opens. */
        @keyframes hero-rise {
          from { opacity: 0; transform: translateY(22px); }
          to { opacity: 1; transform: none; }
        }
        .hero-in { animation: hero-rise 0.9s cubic-bezier(0.22,0.61,0.36,1) both; }
        .hero-in.hero-d1 { animation-delay: 0.10s; }
        .hero-in.hero-d2 { animation-delay: 0.22s; }
        @keyframes hero-zoom {
          from { transform: scale(1.07); }
          to { transform: scale(1); }
        }
        .hero-photo { animation: hero-zoom 14s ease-out both; }

        /* Logos, cards and buttons lift slightly under the cursor. */
        .lift { transition: transform 0.35s cubic-bezier(0.22,0.61,0.36,1); }
        .lift:hover { transform: translateY(-6px); }

        @media (prefers-reduced-motion: reduce) {
          .reveal, .reveal.is-visible, .hero-in, .hero-photo, .lift, .lift:hover {
            opacity: 1;
            transform: none;
            transition: none;
            animation: none;
          }
        }
        @keyframes scroll-cue-bounce {
          0%, 100% { transform: translate(-50%, 0); }
          50% { transform: translate(-50%, -25%); }
        }
        .scroll-cue { animation: scroll-cue-bounce 1s infinite; }
        @media (prefers-reduced-motion: reduce) {
          .scroll-cue { animation: none; }
        }
      `}</style>
      <noscript>
        <style>{`.reveal { opacity: 1 !important; transform: none !important; }`}</style>
      </noscript>

      {/* ---------------------------------------------------------- Portada */}
      <section
        style={{
          position: "relative",
          minHeight: "92vh",
          display: "flex",
          flexDirection: "column",
          background: "#0b1d2c",
          // clips the slow zoom on the background photo
          overflow: "hidden",
        }}
      >
        <Image
          src={`/images/landing-${VARIANT_LANG}.png`}
          alt={LANG_TITLE}
          fill
          priority
          sizes="100vw"
          className="hero-photo"
          style={{ objectFit: "cover" }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(180deg,rgba(6,18,30,0.72) 0%,rgba(6,18,30,0.45) 45%,rgba(6,18,30,0.78) 100%)",
          }}
        />

        <nav
          style={{
            position: "relative",
            zIndex: 2,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "24px",
            // extra left padding clears the site-wide hamburger menu button
            padding: "22px clamp(24px,5vw,56px) 22px clamp(76px,9vw,104px)",
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <span
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "#ffffff",
                borderRadius: "8px",
                padding: "4px 8px",
              }}
            >
              <Image
                src={`/images/${VARIANT_LANG}-language-academy.png`}
                alt={tr(text.Owners.Academy)}
                width={120}
                height={52}
                style={{ height: "52px", width: "auto", objectFit: "contain" }}
              />
            </span>
            <span
              style={{
                color: "#ffffff",
                fontWeight: 600,
                fontSize: "17px",
                letterSpacing: "0.02em",
              }}
            >
              {tr(text.BrandTitle)}
            </span>
          </div>

          {/* Desktop: pills */}
          <div
            className="lang-pills"
            style={{
              alignItems: "center",
              gap: "6px",
              background: "rgba(255,255,255,0.12)",
              border: "1px solid rgba(255,255,255,0.25)",
              borderRadius: "999px",
              padding: "4px",
              backdropFilter: "blur(6px)",
            }}
          >
            {LANGUAGE_OPTIONS.map((option) => {
              const active = option.value === language
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleLanguageChange(option.value)}
                  aria-pressed={active}
                  style={{
                    border: "none",
                    cursor: "pointer",
                    borderRadius: "999px",
                    padding: "7px 16px",
                    whiteSpace: "nowrap",
                    fontFamily: SANS,
                    fontSize: "13.5px",
                    fontWeight: 600,
                    background: active ? "#ffffff" : "transparent",
                    color: active ? "#0e2a40" : "rgba(255,255,255,0.85)",
                  }}
                >
                  {option.label}
                </button>
              )
            })}
          </div>

          {/* Mobile: native select */}
          <label
            className="lang-select-wrap"
            style={{
              alignItems: "center",
              gap: "10px",
              color: "rgba(255,255,255,0.85)",
              fontSize: "13px",
              fontWeight: 500,
            }}
          >
            {tr(text.Nav.SelectLanguage)}
            <select
              value={language}
              onChange={(event) => handleLanguageChange(event.target.value)}
              style={{
                background: "rgba(255,255,255,0.12)",
                border: "1px solid rgba(255,255,255,0.4)",
                borderRadius: "10px",
                color: "#ffffff",
                fontFamily: SANS,
                fontSize: "14px",
                fontWeight: 600,
                padding: "8px 12px",
                backdropFilter: "blur(6px)",
              }}
            >
              {LANGUAGE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value} style={{ color: "#12283a" }}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </nav>

        <div
          style={{
            position: "relative",
            zIndex: 2,
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            padding: "48px clamp(24px,6vw,72px) 96px",
            gap: "24px",
          }}
        >
          <h1
            className="hero-in"
            style={{
              margin: 0,
              maxWidth: "900px",
              fontFamily: SERIF,
              fontWeight: 500,
              fontSize: "clamp(40px,5.4vw,72px)",
              lineHeight: 1.08,
              color: "#ffffff",
            }}
          >
            {tr(text.Title)}
          </h1>
          <p
            className="hero-in hero-d1"
            style={{
              margin: 0,
              maxWidth: "660px",
              fontSize: "clamp(17px,1.5vw,20px)",
              lineHeight: 1.6,
              color: "rgba(255,255,255,0.85)",
            }}
          >
            {tr(text.Subtitle)}
          </p>
          <div
            className="hero-in hero-d2"
            style={{
              display: "flex",
              gap: "16px",
              flexWrap: "wrap",
              justifyContent: "center",
              marginTop: "16px",
            }}
          >
            <Link
              href="/translator"
              onClick={() => trackEvent("cta_try_translator", { page: "about" })}
              style={{
                display: "inline-block",
                background: "#2b7fc4",
                color: "#ffffff",
                fontWeight: 600,
                fontSize: "17px",
                padding: "15px 38px",
                borderRadius: "999px",
                boxShadow: "0 8px 24px rgba(10,40,70,0.35)",
              }}
            >
              {tr(text.TryTranslator)}
            </Link>
            <a
              href="#about"
              style={{
                display: "inline-block",
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.65)",
                color: "#ffffff",
                fontWeight: 600,
                fontSize: "17px",
                padding: "14px 38px",
                borderRadius: "999px",
                backdropFilter: "blur(4px)",
              }}
            >
              {tr(text.JoinProject)}
            </a>
          </div>
        </div>

        {/* Hints that the page continues past the fold. */}
        <a
          href="#about"
          aria-label={tr(text.JoinProject)}
          className="scroll-cue"
          style={{
            position: "absolute",
            zIndex: 2,
            left: "50%",
            bottom: "26px",
            // keyframes re-apply this centering; the inline copy keeps the
            // chevron centred when reduced motion turns the animation off
            transform: "translateX(-50%)",
            color: "rgba(255,255,255,0.85)",
            fontSize: "18px",
          }}
        >
          <FontAwesomeIcon icon={faChevronDown} />
        </a>

        <a
          href="https://tecnologiavoces.com"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            position: "absolute",
            zIndex: 2,
            right: "clamp(24px,5vw,56px)",
            bottom: "24px",
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <span
            style={{
              fontSize: "12px",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.7)",
            }}
          >
            {tr(text.Owners.DevelopedBy)}
          </span>
          <VocesLogo height={22} variant="white" />
        </a>
      </section>

      {/* --------------------------------------------- Acerca del proyecto */}
      <section id="about" style={{ background: "#e9f0f5", padding: "clamp(72px,9vw,120px) 24px" }}>
        <div
          style={{
            maxWidth: "1020px",
            margin: "0 auto",
            display: "flex",
            flexDirection: "column",
            gap: "clamp(56px,7vw,88px)",
          }}
        >
          <h2
            className="reveal"
            style={{
              margin: 0,
              fontSize: "15px",
              fontWeight: 700,
              letterSpacing: "0.18em",
              color: "#1e6fb8",
              textAlign: "center",
            }}
          >
            {tr(text.AboutProject.Title)}
          </h2>
          {paragraphs.map((paragraph, index) => (
            <AboutRow
              key={index}
              paragraph={tr(paragraph)}
              photo={ABOUT_PHOTOS[index] ?? ABOUT_PHOTOS[0]}
              reverse={index % 2 === 0}
            />
          ))}
        </div>
      </section>

      {/* ---------------------------------------------------------- Validación */}
      {IS_RAP && (
        <section id="validation" style={{ background: "#fdfdfc", padding: "clamp(64px,8vw,96px) 24px" }}>
          <div
            style={{
              maxWidth: "1060px",
              margin: "0 auto",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "40px",
            }}
          >
            <h2
              className="reveal"
              style={{
                margin: 0,
                fontFamily: SERIF,
                fontWeight: 500,
                fontSize: "clamp(28px,3vw,38px)",
                color: "#12283a",
                textAlign: "center",
                maxWidth: "760px",
              }}
            >
              {tr(text.Validation.Title)}
            </h2>
            <div className="reveal reveal-zoom reveal-d1" style={{ width: "100%" }}>
              <RapaMap pins={VALIDATION_PLACES} label={tr(text.Validation.Title)} />
            </div>
          </div>
        </section>
      )}

      {/* ---------------------------------------------------- Nuestro enfoque */}
      <section id="focus" style={{ background: "#0e2a40", padding: "clamp(72px,9vw,110px) 24px" }}>
        <div style={{ maxWidth: "1080px", margin: "0 auto" }}>
          <h2
            className="reveal"
            style={{
              margin: "0 0 56px",
              fontFamily: SERIF,
              fontWeight: 500,
              fontSize: "clamp(30px,3.4vw,42px)",
              color: "#ffffff",
              textAlign: "center",
            }}
          >
            {tr(text.Focus.Title)}
          </h2>
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "48px" }}>
            {[
              {
                node: text.Focus.Collaboration,
                icon: (
                  <>
                    <circle cx="15" cy="14" r="5" />
                    <path d="M6 32c0-5 4-8 9-8s9 3 9 8" />
                    <circle cx="27" cy="15" r="4" />
                    <path d="M28 24c4 0.5 7 3.5 7 8" />
                  </>
                ),
              },
              {
                node: text.Focus.IA,
                icon: (
                  <>
                    <circle cx="10" cy="12" r="3" />
                    <circle cx="30" cy="10" r="3" />
                    <circle cx="20" cy="22" r="3.5" />
                    <circle cx="12" cy="32" r="3" />
                    <circle cx="30" cy="30" r="3" />
                    <path d="M12.5 14.2l5 5.5" />
                    <path d="M27.8 12l-5.5 7.5" />
                    <path d="M18 24.8l-4 4.5" />
                    <path d="M23 24.5l4.5 3.5" />
                  </>
                ),
              },
              {
                node: text.Focus.Free,
                icon: (
                  <>
                    <rect x="9" y="18" width="18" height="14" rx="2" />
                    <path d="M14 18v-5a6 6 0 0 1 12 0" />
                    <circle cx="18" cy="25" r="2" />
                  </>
                ),
              },
            ].map((pillar, index) => (
              <div
                key={index}
                className={`reveal reveal-d${index + 1}`}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                  flex: "1 1 260px",
                  maxWidth: "340px",
                }}
              >
                <svg
                  width="40"
                  height="40"
                  viewBox="0 0 40 40"
                  fill="none"
                  stroke="#7db4e0"
                  strokeWidth="2"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  {pillar.icon}
                </svg>
                <h3 style={{ margin: 0, fontSize: "20px", fontWeight: 600, color: "#ffffff" }}>
                  {tr(pillar.node.Title)}
                </h3>
                <p
                  style={{
                    margin: 0,
                    fontSize: "16px",
                    lineHeight: 1.65,
                    color: "rgba(255,255,255,0.72)",
                  }}
                >
                  {tr(pillar.node.Text)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------- Proyecto de */}
      <section id="owners" style={{ background: "#fdfdfc", padding: "clamp(72px,9vw,110px) 24px" }}>
        <div
          style={{
            maxWidth: "960px",
            margin: "0 auto",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "20px",
            textAlign: "center",
          }}
        >
          <h2
            className="reveal"
            style={{
              margin: 0,
              fontFamily: SERIF,
              fontWeight: 500,
              fontSize: "clamp(28px,3vw,38px)",
              color: "#12283a",
            }}
          >
            {tr(text.Owners.CollaborativeProject)}
          </h2>
          <h3
            className="reveal reveal-d1"
            style={{
              margin: "20px 0 0",
              fontSize: "14px",
              fontWeight: 700,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "#5a6e7c",
            }}
          >
            {tr(text.Owners.DevelopedBy)}
          </h3>
          <a
            href="https://tecnologiavoces.com"
            target="_blank"
            rel="noopener noreferrer"
            className="reveal reveal-d2 lift"
            style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}
          >
            <VocesLogo height={46} />
            <span style={{ fontSize: "14px", color: "#1e6fb8" }}>www.tecnologiavoces.com</span>
          </a>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "center",
              gap: "40px",
              width: "100%",
              alignItems: "flex-end",
              marginTop: "32px",
            }}
          >
            {[
              {
                src: `/images/${VARIANT_LANG}-language-academy.png`,
                alt: tr(text.Owners.Academy),
                height: 88,
                caption: tr(text.Owners.Academy),
                href: IS_RAP ? "https://www.academialenguarapanui.cl" : null,
                hrefLabel: "www.academialenguarapanui.cl",
              },
              {
                src: "/images/eaauc.png",
                alt: tr(text.Owners.Eaauc),
                height: 72,
                caption: tr(text.Owners.Eaauc),
                href: "https://www.estudiosaplicados.cl",
                hrefLabel: "www.estudiosaplicados.cl",
              },
              {
                src: "/images/cenia.png",
                alt: tr(text.Owners.Cenia),
                height: 72,
                caption: tr(text.Owners.Cenia),
                href: "https://www.cenia.cl",
                hrefLabel: "www.cenia.cl",
              },
            ].map((partner, index) => (
              <div
                key={partner.src}
                className={`reveal lift reveal-d${index + 1}`}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "14px",
                  flex: "1 1 220px",
                  maxWidth: "320px",
                }}
              >
                <div style={{ position: "relative", height: partner.height, width: "100%" }}>
                  <Image
                    src={partner.src}
                    alt={partner.alt}
                    fill
                    sizes="220px"
                    style={{ objectFit: "contain" }}
                  />
                </div>
                <span style={{ fontSize: "14px", color: "#44566a" }}>{partner.caption}</span>
                {partner.href && (
                  <a
                    href={partner.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: "13px", color: "#1e6fb8" }}
                  >
                    {partner.hrefLabel}
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------ Colaboradores */}
      <section id="collaborators" style={{ background: "#e9f0f5", padding: "clamp(64px,8vw,96px) 24px" }}>
        <div style={{ maxWidth: "1120px", margin: "0 auto" }}>
          <h2
            className="reveal"
            style={{
              margin: "0 0 48px",
              fontFamily: SERIF,
              fontWeight: 500,
              fontSize: "clamp(28px,3vw,38px)",
              color: "#12283a",
              textAlign: "center",
            }}
          >
            {tr(text.Collaborators.Title)}
          </h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))",
              gap: "40px 48px",
            }}
          >
            {IS_RAP ? (
              <>
                <CreditColumn title={tr(text.Institutions.Title)} names={INSTITUTIONS} />
                <CreditColumn
                  title={tr(text.Institutions.Directory.Title)}
                  names={ACADEMY_BOARD}
                />
                <CreditColumn
                  title={tr(text.Institutions.Translators.Title)}
                  names={TRANSLATORS}
                />
                <CreditColumn
                  title={tr(text.Institutions.Transcribers.Title)}
                  names={TRANSCRIBERS}
                />
                <CreditColumn title={tr(text.Institutions.Reviewers.Title)} names={REVIEWERS} />
                <CreditColumn title={tr(text.AiVoice.Title)} names={AI_VOICES} />
              </>
            ) : (
              <CreditColumn
                title="Instituto de la Lengua y Cultura Mapuche Aukiñ Mapu"
                names={AUKIN_MAPU_TEAM}
              />
            )}
            <CreditColumn title={tr(text.Owners.Cenia)} names={CENIA_TEAM} />
            <CreditColumn title={tr(text.Owners.Eaauc)} names={EAAUC_TEAM} />
            <CreditColumn title={tr(text.ThanksTo.Title)} names={thanks} />
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------ Financiamiento */}
      <section
        id="financers"
        style={{ background: "#fdfdfc", padding: "clamp(64px,8vw,96px) 24px" }}
      >
        <div
          style={{
            maxWidth: "1120px",
            margin: "0 auto",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "48px",
          }}
        >
          <h2
            className="reveal"
            style={{
              margin: 0,
              fontFamily: SERIF,
              fontWeight: 500,
              fontSize: "clamp(28px,3vw,38px)",
              color: "#12283a",
              textAlign: "center",
            }}
          >
            {tr(text.Financing.Title)}
          </h2>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "center",
              alignItems: "flex-end",
              gap: "48px 44px",
            }}
          >
            {[
              ...FUNDERS,
              {
                src: "/images/municipalidad.png",
                alt: tr(text.Financing.Municipality),
                caption: tr(text.Financing.Municipality),
              },
            ].map((funder, index) => (
              <div
                key={funder.src}
                className={`reveal lift reveal-d${Math.min(index + 1, 5)}`}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "12px",
                  maxWidth: "180px",
                }}
              >
                <div style={{ position: "relative", height: "64px", width: "150px" }}>
                  <Image
                    src={funder.src}
                    alt={funder.alt}
                    fill
                    sizes="180px"
                    style={{ objectFit: "contain" }}
                  />
                </div>
                <span
                  style={{
                    fontSize: "13px",
                    color: "#5a6e7c",
                    textAlign: "center",
                    whiteSpace: "pre-line",
                  }}
                >
                  {funder.caption}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------------- Contacto */}
      <section
        id="contact"
        style={{ background: "#0e2a40", padding: "clamp(72px,9vw,110px) 24px", textAlign: "center" }}
      >
        <div
          style={{
            maxWidth: "640px",
            margin: "0 auto",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "18px",
          }}
        >
          <h2
            className="reveal"
            style={{
              margin: 0,
              fontFamily: SERIF,
              fontWeight: 500,
              fontSize: "clamp(30px,3.4vw,42px)",
              color: "#ffffff",
            }}
          >
            {tr(text.Contact.Title)}
          </h2>
          <p
            className="reveal reveal-d1"
            style={{ margin: 0, fontSize: "17px", lineHeight: 1.6, color: "rgba(255,255,255,0.78)" }}
          >
            {tr(text.Contact.Subtitle)}
          </p>

          <Dialog open={isParticipateModalOpen} onOpenChange={setIsParticipateModalOpen}>
            <DialogTrigger asChild>
              <button
                type="button"
                className="reveal reveal-d2 lift"
                style={{
                  marginTop: "12px",
                  background: "#ffffff",
                  color: "#0e2a40",
                  fontFamily: SANS,
                  fontWeight: 600,
                  fontSize: "17px",
                  padding: "14px 40px",
                  borderRadius: "999px",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                {tr(text.Contact.Button)}
              </button>
            </DialogTrigger>
            <DialogContent className="w-1/2 max-[850px]:w-[90%] max-[850px]:h-fit gap-y-4">
              <DialogHeader>
                <DialogTitle>{tr(text.Contact.Title)}</DialogTitle>
                <DialogDescription>
                  Llena los siguientes campos para contactarnos.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4 w-full">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="firstName" className="text-right">
                    Nombre
                  </Label>
                  <Input
                    id="firstName"
                    value={newParticipate.first_name}
                    onChange={(e) =>
                      setNewParticipate({ ...newParticipate, first_name: e.target.value })
                    }
                    className="col-span-3 focus-visible:ring-0 focus-visible:ring-offset-0"
                  />
                  <Label htmlFor="lastName" className="text-right">
                    Apellido
                  </Label>
                  <Input
                    id="lastName"
                    value={newParticipate.last_name}
                    onChange={(e) =>
                      setNewParticipate({ ...newParticipate, last_name: e.target.value })
                    }
                    className="col-span-3 focus-visible:ring-0 focus-visible:ring-offset-0"
                  />
                  <Label htmlFor="email" className="text-right">
                    Correo
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={newParticipate.email}
                    onChange={(e) =>
                      setNewParticipate({ ...newParticipate, email: e.target.value })
                    }
                    className="col-span-3 focus-visible:ring-0 focus-visible:ring-offset-0"
                  />
                  <Label htmlFor="organization" className="text-right">
                    Organización
                  </Label>
                  <Input
                    id="organization"
                    required={false}
                    type="text"
                    placeholder="Opcional"
                    value={newParticipate.organization}
                    onChange={(e) =>
                      setNewParticipate({ ...newParticipate, organization: e.target.value })
                    }
                    className="col-span-3 focus-visible:ring-0 focus-visible:ring-offset-0"
                  />
                  <Label htmlFor="reason" className="text-right">
                    Mensaje
                  </Label>
                  <Textarea
                    className="col-span-3 h-40 rounded-md border shadow-sm hover:border-default hover:rounded-lg focus-visible:ring-0 focus-visible:ring-offset-0"
                    id="reason"
                    name="reason"
                    value={newParticipate.reason}
                    onChange={(e) =>
                      setNewParticipate({ ...newParticipate, reason: e.target.value })
                    }
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="submit"
                  onClick={handleSubmitForm}
                  className="bg-gradient-to-r from-default to-[#0a7cde] hover:from-[#0a7cde] hover:to-[#0a4cde] text-white font-semibold py-3 px-8 w-70 h-15 rounded-full shadow-lg transition-all duration-300 transform hover:scale-105 text-lg"
                >
                  {isLoading ? (
                    <FontAwesomeIcon icon={faSpinner} className="h-4 w-4 animate-spin" />
                  ) : (
                    "Enviar"
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </section>

      {/* --------------------------------------------------------- Pie de página */}
      <footer
        style={{
          background: "#081a29",
          padding: "56px 24px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "22px",
          textAlign: "center",
        }}
      >
        <span
          className="reveal"
          style={{
            fontSize: "12px",
            fontWeight: 700,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "rgba(255,255,255,0.5)",
          }}
        >
          {tr(text.Owners.Title)}
        </span>
        <a
          href="https://tecnologiavoces.com"
          target="_blank"
          rel="noopener noreferrer"
          className="reveal reveal-d1 lift"
        >
          <VocesLogo height={30} variant="white" />
        </a>
        <span
          className="reveal reveal-d2"
          style={{
            fontSize: "13px",
            lineHeight: 1.8,
            color: "rgba(255,255,255,0.6)",
            maxWidth: "720px",
          }}
        >
          {[tr(text.Owners.Academy), tr(text.Owners.Eaauc), tr(text.Owners.Cenia)].join(" · ")}
        </span>
        <a
          href="https://tecnologiavoces.com"
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontSize: "13px", color: "#7db4e0" }}
        >
          www.tecnologiavoces.com
        </a>
      </footer>

      <Toaster />
    </div>
  )
}
