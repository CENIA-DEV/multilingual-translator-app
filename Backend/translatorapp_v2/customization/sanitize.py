# Copyright 2026 Centro Nacional de Inteligencia Artificial (CENIA, Chile).
# All rights reserved.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
"""Allow-list sanitizers for the values admins type into the customization.

The landing page renders rich text as HTML, links become ``href`` attributes and
images become ``src`` attributes, so every one of them is checked here before
it is stored. The frontend repeats the rich-text allow-list when rendering.
"""
import re
from html import escape
from html.parser import HTMLParser

# Tags an admin can use in rich text (bold, italics, links and line breaks).
RICH_TEXT_TAGS = {"strong", "b", "em", "i", "u", "a", "br"}
VOID_TAGS = {"br"}

_SAFE_LINK = re.compile(
    r"^(https?://[^\s<>\"']+|mailto:[^\s<>\"']+|/[^\s<>\"']*|#[\w-]*)$"
)
_STATIC_PATH = re.compile(r"^/[A-Za-z0-9_\-./]+$")
_ASSET_REF = re.compile(
    r"^asset:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"
)
_HTTPS_URL = re.compile(r"^https://[^\s<>\"']+$")


def is_safe_link(value: str) -> bool:
    return value == "" or (bool(_SAFE_LINK.match(value)) and not value.startswith("//"))


def is_safe_media_ref(value: str) -> bool:
    """Media may be a bundled static file, an uploaded asset or an https URL."""
    if value == "":
        return True
    if _ASSET_REF.match(value) or _HTTPS_URL.match(value):
        return True
    return (
        bool(_STATIC_PATH.match(value))
        and ".." not in value
        and not value.startswith("//")
    )


class _RichTextSanitizer(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.out = []
        self.open = []

    def handle_starttag(self, tag, attrs):
        if tag not in RICH_TEXT_TAGS:
            return
        if tag in VOID_TAGS:
            self.out.append(f"<{tag}>")
            return
        if tag == "a":
            href = dict(attrs).get("href") or ""
            if not href or not is_safe_link(href):
                # keep the text, drop the unsafe link
                self.open.append(None)
                return
            self.out.append(f'<a href="{escape(href, quote=True)}">')
        else:
            self.out.append(f"<{tag}>")
        self.open.append(tag)

    def handle_startendtag(self, tag, attrs):
        if tag in VOID_TAGS:
            self.out.append(f"<{tag}>")

    def handle_endtag(self, tag):
        if tag not in RICH_TEXT_TAGS or tag in VOID_TAGS:
            return
        # close only tags that are actually open, innermost first
        for index in range(len(self.open) - 1, -1, -1):
            name = self.open[index]
            if name == tag or (name is None and tag == "a"):
                for pending in reversed(self.open[index:]):
                    if pending:
                        self.out.append(f"</{pending}>")
                del self.open[index:]
                return

    def handle_data(self, data):
        self.out.append(escape(data, quote=False))

    def result(self):
        for pending in reversed(self.open):
            if pending:
                self.out.append(f"</{pending}>")
        self.open = []
        return "".join(self.out)


def sanitize_rich_text(value: str) -> str:
    parser = _RichTextSanitizer()
    parser.feed(value)
    parser.close()
    return parser.result()
