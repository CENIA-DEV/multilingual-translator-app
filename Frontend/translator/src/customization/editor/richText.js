// Copyright 2026 Centro Nacional de Inteligencia Artificial (CENIA, Chile). All rights reserved.
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

// Normalises the HTML a contentEditable produces (browser-specific <b>, <div>,
// <span style>, pasted markup...) into the small rich-text dialect the site
// renders: <strong>, <em>, <u>, <a href> and <br>. Runs in the browser only.

const RENAME = { b: "strong", i: "em" }
const KEEP = new Set(["strong", "em", "u", "a", "br"])
const BLOCK = new Set(["div", "p", "li", "h1", "h2", "h3", "h4", "h5", "h6"])
const SAFE_HREF = /^(https?:\/\/|mailto:|\/(?!\/)|#)/i

const escapeText = (text) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/ /g, " ")

function serialize(node) {
  let out = ""
  node.childNodes.forEach((child, index) => {
    if (child.nodeType === Node.TEXT_NODE) {
      out += escapeText(child.textContent)
      return
    }
    if (child.nodeType !== Node.ELEMENT_NODE) return
    const tag = child.tagName.toLowerCase()
    const name = RENAME[tag] || tag
    const inner = serialize(child)
    if (name === "br") {
      out += "<br>"
    } else if (BLOCK.has(name)) {
      // blocks become line breaks between them
      out += (index > 0 && out && !out.endsWith("<br>") ? "<br>" : "") + inner
    } else if (name === "a") {
      const href = child.getAttribute("href") || ""
      out += SAFE_HREF.test(href) ? `<a href="${href.replace(/"/g, "&quot;")}">${inner}</a>` : inner
    } else if (KEEP.has(name)) {
      out += inner ? `<${name}>${inner}</${name}>` : ""
    } else if (name === "span") {
      // Chrome wraps bold in <span style="font-weight:700"> on some pastes
      const style = child.getAttribute("style") || ""
      const bold = /font-weight:\s*(bold|[6-9]00)/.test(style)
      const italic = /font-style:\s*italic/.test(style)
      let wrapped = inner
      if (italic && inner) wrapped = `<em>${wrapped}</em>`
      if (bold && inner) wrapped = `<strong>${wrapped}</strong>`
      out += wrapped
    } else if (name !== "script" && name !== "style") {
      out += inner
    }
  })
  return out
}

export function cleanRichText(html) {
  if (!html) return ""
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html")
  return serialize(doc.body)
    .replace(/(<br>)+$/, "")
    .replace(/<(strong|em|u)><\/\1>/g, "")
    .trim()
}

/** Plain text of a rich-text value, for summaries and search. */
export function richTextToPlain(html) {
  if (!html) return ""
  return String(html)
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim()
}
