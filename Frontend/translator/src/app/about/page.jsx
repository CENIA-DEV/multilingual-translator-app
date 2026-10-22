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

// Landing page. Every text, image, colour, list and the order of the sections
// come from the customization document (landing.* and theme.landing); edit
// them in Administrar Traductor -> Página de inicio.

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { faChevronDown, faSpinner } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"

import api from "../api"
import DotMap from "@/components/DotMap"
import { useAnalytics } from "@/hooks/useAnalytics"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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
import { useConfig, useLocale } from "@/customization/ConfigProvider"
import { makeTr, placedLabel } from "@/customization/i18n"
import { MediaImage, resolveMedia } from "@/customization/media"
import RichText from "@/customization/RichText"
import FocusIcon from "@/customization/icons"
import { hexToRgb } from "@/customization/theme"

const SERIF = "var(--lp-font-display)"
const SANS = "var(--lp-font-text)"

// Anchor of each section (#financers predates the editor and may be linked).
const ANCHORS = {
  about: "about",
  validation: "validation",
  focus: "focus",
  owners: "owners",
  collaborators: "collaborators",
  funding: "financers",
  contact: "contact",
}

// Colours of a section by its tone ("Orden de secciones" in the editor). The
// light tones differ only in background, the dark tone flips text to white.
const TONES = {
  paper: {
    bg: "var(--lp-paper)",
    heading: "var(--lp-heading)",
    body: "var(--lp-body)",
    lead: "var(--lp-body)",
    subtle: "var(--lp-subtle)",
    muted: "var(--lp-muted)",
    link: "var(--lp-link)",
    highlight: "var(--lp-highlight)",
    icon: "var(--lp-accent)",
    dark: false,
  },
  dark: {
    bg: "var(--lp-night)",
    heading: "#ffffff",
    body: "rgba(255,255,255,0.72)",
    lead: "rgba(255,255,255,0.78)",
    subtle: "rgba(255,255,255,0.72)",
    muted: "rgba(255,255,255,0.6)",
    link: "var(--lp-onDarkAccent)",
    highlight: "#ffffff",
    icon: "var(--lp-onDarkAccent)",
    dark: true,
  },
}
TONES.tint = { ...TONES.paper, bg: "var(--lp-tint)" }
const toneOf = (name) => TONES[name] || TONES.paper

const sectionTitle = (tone, extra = {}) => ({
  margin: 0,
  fontFamily: SERIF,
  fontWeight: 500,
  fontSize: "clamp(28px,3vw,38px)",
  color: tone.heading,
  textAlign: "center",
  ...extra,
})

const focal = (point) => `${point?.x ?? 50}% ${point?.y ?? 50}%`

// Developer wordmark (VOCES by default). On dark backgrounds it is reversed to
// white with a filter instead of needing a second file.
function DeveloperLogo({ developer, height, onDark }) {
  if (!developer.logo) {
    return (
      <span style={{ fontWeight: 700, fontSize: `${Math.round(height * 0.8)}px`, color: onDark ? "#fff" : "var(--lp-link)" }}>
        {developer.name}
      </span>
    )
  }
  // width/height only give next/image a ratio hint (the VOCES wordmark's);
  // CSS sets the real size and the browser keeps each logo's own proportions.
  return (
    <MediaImage
      src={developer.logo}
      alt={developer.name}
      width={1109}
      height={225}
      style={{
        height: `${height}px`,
        width: "auto",
        objectFit: "contain",
        filter: onDark ? "brightness(0) invert(1)" : undefined,
      }}
    />
  )
}

// A group longer than this no longer fits a column: the groups then take the
// full width one under another, their names flowing into columns.
const CREDIT_COLUMN_MAX = 24

function CreditColumn({ title, names, tone, wide = false }) {
  const name = (text, index) => (
    <span
      key={`${text}-${index}`}
      style={{ display: "block", fontSize: "14.5px", color: tone.subtle, breakInside: "avoid", marginBottom: "10px" }}
    >
      {text}
    </span>
  )
  return (
    <div
      className="reveal"
      style={wide ? { gridColumn: "1 / -1" } : { display: "flex", flexDirection: "column" }}
    >
      {/* a group without a title lists its names alone */}
      {title && (
        <h4 style={{ margin: "0 0 14px", fontSize: "15px", fontWeight: 700, color: tone.highlight }}>
          {title}
        </h4>
      )}
      {wide ? <div style={{ columnWidth: "230px", columnGap: "48px" }}>{names.map(name)}</div> : names.map(name)}
    </div>
  )
}

function AboutRow({ html, image, alt, fit, focalPoint, reverse, tone }) {
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
          style={{ margin: 0, fontSize: "17px", lineHeight: 1.75, color: tone.body }}
        >
          <RichText html={html} />
        </p>
      </div>
      {image && (
        <div
          className={`reveal reveal-d1 ${reverse ? "reveal-left" : "reveal-right"}`}
          style={{
            position: "relative",
            flex: "1 1 320px",
            height: "320px",
            minWidth: 0,
            borderRadius: "6px",
            overflow: "hidden",
            background: fit === "contain" ? "#ffffff" : "#dbe6ee",
          }}
        >
          <MediaImage
            src={image}
            alt={alt}
            fill
            sizes="(max-width: 900px) 100vw, 480px"
            style={{
              objectFit: fit,
              objectPosition: focal(focalPoint),
              padding: fit === "contain" ? "28px" : 0,
            }}
          />
        </div>
      )}
    </div>
  )
}

export default function LandingPage() {
  const config = useConfig()
  const landing = config.landing
  const developer = landing.developer
  const { locale, locales, setLocale } = useLocale()
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

  // The site language (shared with the translator; a locale removed in the
  // editor falls back to the default one)
  const tr = makeTr(locale, landing.defaultLocale)
  const developedBy = placedLabel(tr(landing.owners.developedByLabel))
  const footerLabel = placedLabel(tr(landing.footer.label))

  // The map rebuilds when its pins change; key them by content so a draft
  // edit elsewhere on the page does not redraw it.
  const pinsKey = JSON.stringify(landing.validation.pins)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const pins = useMemo(() => landing.validation.pins, [pinsKey])

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

  const handleLanguageChange = (value) => {
    setLocale(value)
    trackEvent("language_change", { language: value, page: "about" })
  }

  const form = landing.contact.form

  const handleSubmitForm = async () => {
    setIsLoading(true)
    try {
      await api.post("/api/participate-request/", newParticipate)
      toast({ title: tr(form.successTitle), description: tr(form.successBody) })
      trackEvent("participate_form_submit_success", {
        page: "about",
        email: newParticipate.email,
      })
      setIsParticipateModalOpen(false)
    } catch (error) {
      toast({ title: tr(form.errorTitle), description: tr(form.errorBody) })
      trackEvent("participate_form_submit_error", {
        page: "about",
        email: newParticipate.email,
      })
    } finally {
      setIsLoading(false)
    }
  }

  const visibleSections = landing.sections.filter((section) => section.visible)
  const firstAnchor = visibleSections.length ? `#${ANCHORS[visibleSections[0].id]}` : "#"
  const partnerNames = landing.owners.partners.map((partner) => tr(partner.name)).filter(Boolean)
  const overlay = Math.min(1.5, (landing.hero.overlayOpacity ?? 100) / 100)
  const [or, og, ob] = hexToRgb(config.theme.landing.heroOverlay) || [6, 18, 30]
  const overlayColor = (alpha) => `rgba(${or},${og},${ob},${Math.min(1, alpha * overlay).toFixed(3)})`

  const renderers = {
    about: (tone) => (
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
            color: tone.link,
            textAlign: "center",
          }}
        >
          {tr(landing.about.title)}
        </h2>
        {landing.about.items.map((item, index) => (
          <AboutRow
            key={index}
            html={tr(item.text)}
            image={item.image}
            alt={tr(item.imageAlt)}
            fit={item.imageFit}
            focalPoint={item.focalPoint}
            reverse={index % 2 === 0}
            tone={tone}
          />
        ))}
      </div>
    ),

    validation: (tone) => (
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
        <h2 className="reveal" style={sectionTitle(tone, { maxWidth: "760px" })}>
          {tr(landing.validation.title)}
        </h2>
        {landing.validation.geojson && (
          <div className="reveal reveal-zoom reveal-d1" style={{ width: "100%" }}>
            <DotMap
              pins={pins}
              geoJsonUrl={resolveMedia(landing.validation.geojson)}
              contextUrl={landing.validation.contextGeojson ? resolveMedia(landing.validation.contextGeojson) : ""}
              label={tr(landing.validation.mapLabel) || tr(landing.validation.title)}
              closeUp={landing.validation.closeUp !== false}
              colors={{
                dots: config.theme.landing.mapDots,
                accent: config.theme.landing.accent,
                surface: config.theme.landing.mapSurface,
              }}
            />
          </div>
        )}
      </div>
    ),

    focus: (tone) => (
      <div style={{ maxWidth: "1080px", margin: "0 auto" }}>
        <h2
          className="reveal"
          style={sectionTitle(tone, { margin: "0 0 56px", fontSize: "clamp(30px,3.4vw,42px)" })}
        >
          {tr(landing.focus.title)}
        </h2>
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "48px" }}>
          {landing.focus.items.map((pillar, index) => (
            <div
              key={index}
              className={`reveal reveal-d${Math.min(index + 1, 5)}`}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "12px",
                flex: "1 1 260px",
                maxWidth: "340px",
              }}
            >
              <FocusIcon name={pillar.icon} color={tone.icon} />
              <h3 style={{ margin: 0, fontSize: "20px", fontWeight: 600, color: tone.heading }}>
                {tr(pillar.title)}
              </h3>
              <p style={{ margin: 0, fontSize: "16px", lineHeight: 1.65, color: tone.body }}>
                {tr(pillar.text)}
              </p>
            </div>
          ))}
        </div>
      </div>
    ),

    owners: (tone) => (
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
        <h2 className="reveal" style={sectionTitle(tone)}>
          {tr(landing.owners.title)}
        </h2>
        {developer.enabled && (
          <>
            <h3
              className="reveal reveal-d1"
              style={{
                margin: "20px 0 0",
                fontSize: "14px",
                fontWeight: 700,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: tone.muted,
              }}
            >
              {developedBy.text}
            </h3>
            <a
              href={developer.url || undefined}
              target="_blank"
              rel="noopener noreferrer"
              className="reveal reveal-d2 lift"
              style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}
            >
              <DeveloperLogo developer={developer} height={46} onDark={tone.dark} />
              {developer.urlLabel && (
                <span style={{ fontSize: "14px", color: tone.link }}>{developer.urlLabel}</span>
              )}
            </a>
          </>
        )}

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
          {landing.owners.partners.map((partner, index) => (
            <div
              key={`${partner.logo}-${index}`}
              className={`reveal lift reveal-d${Math.min(index + 1, 5)}`}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "14px",
                flex: "1 1 220px",
                maxWidth: "320px",
              }}
            >
              {partner.logo && (
                <div style={{ position: "relative", height: partner.logoHeight, width: "100%" }}>
                  <MediaImage
                    src={partner.logo}
                    alt={tr(partner.name)}
                    fill
                    sizes="220px"
                    style={{ objectFit: "contain" }}
                  />
                </div>
              )}
              <span style={{ fontSize: "14px", color: tone.subtle }}>{tr(partner.name)}</span>
              {partner.url && (
                <a
                  href={partner.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: "13px", color: tone.link }}
                >
                  {partner.urlLabel || partner.url}
                </a>
              )}
            </div>
          ))}
        </div>
      </div>
    ),

    collaborators: (tone) => (
      <div style={{ maxWidth: "1120px", margin: "0 auto" }}>
        <h2 className="reveal" style={sectionTitle(tone, { margin: "0 0 48px" })}>
          {tr(landing.collaborators.title)}
        </h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))",
            gap: "40px 48px",
          }}
        >
          {landing.collaborators.groups.filter((group) => !group.hidden).map((group, index, groups) => (
            <CreditColumn
              key={index}
              title={tr(group.title)}
              names={group.names}
              tone={tone}
              wide={groups.some((g) => g.names.length > CREDIT_COLUMN_MAX)}
            />
          ))}
        </div>
      </div>
    ),

    funding: (tone) => (
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
        <h2 className="reveal" style={sectionTitle(tone)}>
          {tr(landing.funding.title)}
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
          {landing.funding.items.map((funder, index) => {
            const caption = tr(funder.caption)
            const content = (
              <>
                <div style={{ position: "relative", height: "64px", width: "150px" }}>
                  <MediaImage
                    src={funder.logo}
                    alt={caption.split("\n")[0]}
                    fill
                    sizes="180px"
                    style={{ objectFit: "contain" }}
                  />
                </div>
                <span
                  style={{
                    fontSize: "13px",
                    color: tone.muted,
                    textAlign: "center",
                    whiteSpace: "pre-line",
                  }}
                >
                  {caption}
                </span>
              </>
            )
            const style = {
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "12px",
              maxWidth: "180px",
            }
            const className = `reveal lift reveal-d${Math.min(index + 1, 5)}`
            return funder.url ? (
              <a
                key={`${funder.logo}-${index}`}
                href={funder.url}
                target="_blank"
                rel="noopener noreferrer"
                className={className}
                style={style}
              >
                {content}
              </a>
            ) : (
              <div key={`${funder.logo}-${index}`} className={className} style={style}>
                {content}
              </div>
            )
          })}
        </div>
      </div>
    ),

    contact: (tone) => (
      <div
        style={{
          maxWidth: "640px",
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "18px",
          textAlign: "center",
        }}
      >
        <h2
          className="reveal"
          style={sectionTitle(tone, { fontSize: "clamp(30px,3.4vw,42px)" })}
        >
          {tr(landing.contact.title)}
        </h2>
        <p
          className="reveal reveal-d1"
          style={{ margin: 0, fontSize: "17px", lineHeight: 1.6, color: tone.lead }}
        >
          {tr(landing.contact.subtitle)}
        </p>

        <Dialog open={isParticipateModalOpen} onOpenChange={setIsParticipateModalOpen}>
          <DialogTrigger asChild>
            <button
              type="button"
              className="reveal reveal-d2 lift"
              style={{
                marginTop: "12px",
                background: tone.dark ? "#ffffff" : "var(--lp-accent)",
                color: tone.dark ? "var(--lp-night)" : "#ffffff",
                fontFamily: SANS,
                fontWeight: 600,
                fontSize: "17px",
                padding: "14px 40px",
                borderRadius: "999px",
                border: "none",
                cursor: "pointer",
              }}
            >
              {tr(landing.contact.button)}
            </button>
          </DialogTrigger>
          <DialogContent className="w-1/2 max-[850px]:w-[90%] max-[850px]:h-fit gap-y-4">
            <DialogHeader>
              <DialogTitle>{tr(landing.contact.title)}</DialogTitle>
              <DialogDescription>{tr(form.description)}</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4 w-full">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="firstName" className="text-right">
                  {tr(form.firstName)}
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
                  {tr(form.lastName)}
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
                  {tr(form.email)}
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={newParticipate.email}
                  onChange={(e) => setNewParticipate({ ...newParticipate, email: e.target.value })}
                  className="col-span-3 focus-visible:ring-0 focus-visible:ring-offset-0"
                />
                <Label htmlFor="organization" className="text-right">
                  {tr(form.organization)}
                </Label>
                <Input
                  id="organization"
                  required={false}
                  type="text"
                  placeholder={tr(form.optional)}
                  value={newParticipate.organization}
                  onChange={(e) =>
                    setNewParticipate({ ...newParticipate, organization: e.target.value })
                  }
                  className="col-span-3 focus-visible:ring-0 focus-visible:ring-offset-0"
                />
                <Label htmlFor="reason" className="text-right">
                  {tr(form.message)}
                </Label>
                <Textarea
                  className="col-span-3 h-40 rounded-md border shadow-sm hover:border-default hover:rounded-lg focus-visible:ring-0 focus-visible:ring-offset-0"
                  id="reason"
                  name="reason"
                  value={newParticipate.reason}
                  onChange={(e) => setNewParticipate({ ...newParticipate, reason: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="submit"
                onClick={handleSubmitForm}
                className="bg-gradient-to-r from-default to-defaultStrong hover:from-defaultStrong hover:to-defaultStrong text-white font-semibold py-3 px-8 w-70 h-15 rounded-full shadow-lg transition-all duration-300 transform hover:scale-105 text-lg"
              >
                {isLoading ? (
                  <FontAwesomeIcon icon={faSpinner} className="h-4 w-4 animate-spin" />
                ) : (
                  tr(form.submit)
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    ),
  }

  // Vertical padding of each section, as designed for its default place.
  const PADDING = {
    about: "clamp(72px,9vw,120px) 24px",
    validation: "clamp(64px,8vw,96px) 24px",
    focus: "clamp(72px,9vw,110px) 24px",
    owners: "clamp(72px,9vw,110px) 24px",
    collaborators: "clamp(64px,8vw,96px) 24px",
    funding: "clamp(64px,8vw,96px) 24px",
    contact: "clamp(72px,9vw,110px) 24px",
  }

  return (
    <div style={{ width: "100%", overflowX: "hidden", background: "var(--lp-page)", fontFamily: SANS }}>
      {/*
        Scoped styles: the language switcher swaps between pills and a <select>
        purely in CSS so the markup is identical on server and client, the
        <strong> tags inside translated copy pick up the design's accent colour,
        and the motion classes below drive the entrance and scroll reveals.
      */}
      <style>{`
        .landing-prose strong { color: var(--section-highlight, var(--lp-highlight)); font-weight: 700; }
        .landing-prose a { color: var(--section-link, var(--lp-link)); text-decoration: underline; }
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
        id="hero"
        style={{
          position: "relative",
          minHeight: "92vh",
          display: "flex",
          flexDirection: "column",
          background: "var(--lp-heroBase)",
          // clips the slow zoom on the background photo
          overflow: "hidden",
        }}
      >
        <MediaImage
          src={landing.hero.image}
          alt={tr(landing.hero.imageAlt)}
          fill
          priority
          sizes="100vw"
          className="hero-photo"
          style={{ objectFit: "cover", objectPosition: focal(landing.hero.focalPoint) }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `linear-gradient(180deg,${overlayColor(0.72)} 0%,${overlayColor(0.45)} 45%,${overlayColor(0.78)} 100%)`,
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
            {landing.header.logo && (
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
                <MediaImage
                  src={landing.header.logo}
                  alt={tr(landing.header.logoAlt)}
                  width={120}
                  height={52}
                  style={{ height: "52px", width: "auto", objectFit: "contain" }}
                />
              </span>
            )}
            {landing.header.platformName ? (
              // The platform's name (not translated) over the translated title
              <span style={{ display: "flex", flexDirection: "column", gap: "3px", lineHeight: 1.1 }}>
                <span
                  style={{
                    color: "#ffffff",
                    fontFamily: SERIF,
                    fontWeight: 600,
                    fontSize: "20px",
                    letterSpacing: "0.01em",
                  }}
                >
                  {landing.header.platformName}
                </span>
                <span
                  style={{
                    color: "rgba(255,255,255,0.82)",
                    fontWeight: 500,
                    fontSize: "12.5px",
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                  }}
                >
                  {tr(landing.header.brandTitle)}
                </span>
              </span>
            ) : (
              <span
                style={{
                  color: "#ffffff",
                  fontWeight: 600,
                  fontSize: "17px",
                  letterSpacing: "0.02em",
                }}
              >
                {tr(landing.header.brandTitle)}
              </span>
            )}
          </div>

          {locales.length > 1 && (
            <>
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
                {locales.map((option) => {
                  const active = option.code === locale
                  return (
                    <button
                      key={option.code}
                      type="button"
                      onClick={() => handleLanguageChange(option.code)}
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
                        color: active ? "var(--lp-night)" : "rgba(255,255,255,0.85)",
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
                {tr(landing.header.selectLanguageLabel)}
                <select
                  value={locale}
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
                  {locales.map((option) => (
                    <option key={option.code} value={option.code} style={{ color: "var(--lp-heading)" }}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}
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
            {tr(landing.hero.title)}
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
            {tr(landing.hero.subtitle)}
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
                // its own colour (Mapuzugun: the translator's blue), else the accent
                background: "var(--lp-cta, var(--lp-accent))",
                color: "#ffffff",
                fontWeight: 600,
                fontSize: "17px",
                padding: "15px 38px",
                borderRadius: "999px",
                boxShadow: "0 8px 24px rgba(10,40,70,0.35)",
              }}
            >
              {tr(landing.hero.primaryCta)}
            </Link>
            {tr(landing.hero.secondaryCta) && (
              <a
                href={firstAnchor}
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
                {tr(landing.hero.secondaryCta)}
              </a>
            )}
          </div>
        </div>

        {/* Hints that the page continues past the fold. */}
        <a
          href={firstAnchor}
          aria-label={tr(landing.hero.secondaryCta)}
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

        {developer.enabled && landing.hero.showDeveloperBadge && (
          <a
            href={developer.url || undefined}
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
                order: developedBy.after ? 1 : 0,
              }}
            >
              {developedBy.text}
            </span>
            <DeveloperLogo developer={developer} height={22} onDark />
          </a>
        )}
      </section>

      {visibleSections.map((section) => {
        const tone = toneOf(section.tone)
        return (
          <section
            key={section.id}
            id={ANCHORS[section.id]}
            style={{
              background: tone.bg,
              padding: PADDING[section.id],
              "--section-highlight": tone.highlight,
              "--section-link": tone.link,
            }}
          >
            {renderers[section.id](tone)}
          </section>
        )
      })}

      {/* --------------------------------------------------------- Pie de página */}
      <footer
        style={{
          background: "var(--lp-deepNight)",
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
            // a label that follows the names goes right after them
            order: footerLabel.after ? 1 : 0,
          }}
        >
          {footerLabel.text}
        </span>
        {developer.enabled && (
          <a
            href={developer.url || undefined}
            target="_blank"
            rel="noopener noreferrer"
            className="reveal reveal-d1 lift"
          >
            <DeveloperLogo developer={developer} height={30} onDark />
          </a>
        )}
        {landing.footer.showPartnerNames && partnerNames.length > 0 && (
          <span
            className="reveal reveal-d2"
            style={{
              fontSize: "13px",
              lineHeight: 1.8,
              color: "rgba(255,255,255,0.6)",
              maxWidth: "720px",
            }}
          >
            {partnerNames.join(" · ")}
          </span>
        )}
        {developer.enabled && developer.url && (
          <a
            href={developer.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: "13px", color: "var(--lp-onDarkAccent)", order: 2 }}
          >
            {developer.urlLabel || developer.url}
          </a>
        )}
      </footer>
    </div>
  )
}
