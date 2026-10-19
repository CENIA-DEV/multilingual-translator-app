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

import parse, { domToReact } from "html-react-parser"

// Rich text in the document may only use these tags; the backend strips
// everything else before saving and this renderer drops it again, so neither
// side has to trust the other.
export const RICH_TEXT_TAGS = new Set(["strong", "b", "em", "i", "u", "a", "br"])

const SAFE_HREF = /^(https?:\/\/|mailto:|\/(?!\/)|#)/i

function replace(node) {
  if (node.type === "script" || node.type === "style") return <></>
  if (node.type !== "tag") return undefined
  const children = domToReact(node.children || [], { replace })
  if (!RICH_TEXT_TAGS.has(node.name)) return <>{children}</>
  if (node.name === "br") return <br />
  if (node.name === "a") {
    const href = node.attribs?.href || ""
    if (!SAFE_HREF.test(href)) return <>{children}</>
    const external = /^https?:\/\//i.test(href)
    return (
      <a
        href={href}
        {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      >
        {children}
      </a>
    )
  }
  const Tag = node.name
  return <Tag>{children}</Tag>
}

export default function RichText({ html }) {
  if (!html) return null
  return <>{parse(String(html), { replace })}</>
}
