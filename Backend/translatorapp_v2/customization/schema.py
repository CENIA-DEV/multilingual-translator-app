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
"""Schema of the translator customization document.

The frontend owns the defaults (Frontend/translator/src/customization/presets)
and edits the whole document; this module is the gatekeeper that decides what
may be stored. Every model forbids unknown keys, so a typo or a field the
backend does not know about is reported instead of silently dropped. When a
field is added, add it both here and to the presets -- ``test_presets``
checks that the presets still validate.

Field names are camelCase on purpose: they are the JSON keys the frontend uses.
"""
import re
from typing import Annotated, Dict, List, Literal, Optional, Union

from pydantic import (
    AfterValidator,
    BaseModel,
    ConfigDict,
    Field,
    StringConstraints,
    ValidationError,
    model_validator,
)

from .sanitize import is_safe_link, is_safe_media_ref, sanitize_rich_text

SCHEMA_VERSION = 1

SECTION_IDS = (
    "about",
    "validation",
    "focus",
    "owners",
    "collaborators",
    "funding",
    "contact",
)

_HEX = re.compile(r"^#[0-9a-fA-F]{6}$")


def _color(value: str) -> str:
    if not _HEX.match(value):
        raise ValueError("Debe ser un color hexadecimal de 6 dígitos, como #0a8cde")
    return value.lower()


def _link(value: str) -> str:
    if not is_safe_link(value):
        raise ValueError(
            "El enlace debe comenzar con https://, http://, mailto:, / o #"
        )
    return value


def _media(value: str) -> str:
    if not is_safe_media_ref(value):
        raise ValueError(
            "La imagen debe ser un archivo subido, una ruta del sitio (/images/...) "
            "o una dirección https://"
        )
    return value


def _rich(value: Dict[str, str]) -> Dict[str, str]:
    return {locale: sanitize_rich_text(text) for locale, text in value.items()}


Color = Annotated[str, AfterValidator(_color)]
Link = Annotated[str, StringConstraints(max_length=500), AfterValidator(_link)]
Media = Annotated[str, StringConstraints(max_length=500), AfterValidator(_media)]
Short = Annotated[str, StringConstraints(max_length=200)]
Medium = Annotated[str, StringConstraints(max_length=1000)]
Long = Annotated[str, StringConstraints(max_length=6000)]
Locale = Annotated[str, StringConstraints(pattern=r"^[a-z]{2,3}(-[A-Za-z0-9]{2,8})?$")]
# A code part: letters and digits, with inner hyphens ("cacicado-huilliche")
_CODE_PART = r"[A-Za-z0-9](?:[A-Za-z0-9-]{0,22}[A-Za-z0-9])?"
LangCode = Annotated[
    str, StringConstraints(pattern=rf"^[a-z]{{2,3}}(_{_CODE_PART}){{0,2}}$")
]
LangPrefix = Annotated[str, StringConstraints(pattern=r"^[a-z]{2,3}$")]
FontName = Annotated[str, StringConstraints(pattern=r"^[A-Za-z0-9 ]{2,40}$")]
IconName = Annotated[str, StringConstraints(pattern=r"^[a-z][a-z0-9-]{1,30}$")]
Percent = Annotated[int, Field(ge=0, le=100)]

# Translations keyed by site locale ({"es": "...", "rap": "...", "en": "..."}).
I18n = Annotated[Dict[Locale, Long], Field(max_length=12)]
RichI18n = Annotated[Dict[Locale, Long], Field(max_length=12), AfterValidator(_rich)]
# Texts of the translator page were plain strings before the site became
# multilingual; documents saved then still validate.
ShortText = Union[Short, I18n]
LongText = Union[Long, I18n]


def _sanitize_text(value):
    if isinstance(value, dict):
        return _rich(value)
    return sanitize_rich_text(value)


# Key of a fixed app text (customization/messages.js in the frontend)
UiKey = Annotated[str, StringConstraints(pattern=r"^[a-z][A-Za-z0-9_.]{1,80}$")]


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Point(Strict):
    x: Percent = 50
    y: Percent = 50


# ------------------------------------------------------------------ identity
class Identity(Strict):
    languageName: Short
    organizationName: Short
    siteTitle: Short
    siteDescription: Medium
    keywords: Annotated[List[Short], Field(max_length=40)]
    logo: Media
    favicon: Media


# --------------------------------------------------------------------- theme
class LandingPalette(Strict):
    page: Color
    paper: Color
    tint: Color
    night: Color
    deepNight: Color
    heroBase: Color
    heroOverlay: Color
    heading: Color
    body: Color
    subtle: Color
    muted: Color
    accent: Color
    link: Color
    highlight: Color
    onDarkAccent: Color
    mapDots: Color
    mapSurface: Color
    # The about page's "try the translator" button; without it, the accent
    cta: Optional[Color] = None


class Fonts(Strict):
    display: FontName
    text: FontName


class Theme(Strict):
    primary: Color
    primaryHover: Color
    primaryStrong: Color
    onPrimary: Color
    line: Color
    landing: LandingPalette
    fonts: Fonts


# ---------------------------------------------------------------- translator
class Backdrop(Strict):
    image: Media
    fit: Literal["contain", "cover"] = "contain"
    position: Literal["top", "center", "bottom"] = "bottom"
    opacity: Percent = 100
    tint: bool = False


class Notice(Strict):
    enabled: bool = True
    title: ShortText
    body: LongText

    @model_validator(mode="after")
    def _clean(self):
        self.body = _sanitize_text(self.body)
        return self


class Dialog(Strict):
    title: ShortText
    body: LongText
    button: ShortText

    @model_validator(mode="after")
    def _clean(self):
        self.body = _sanitize_text(self.body)
        return self


class Translator(Strict):
    defaultSource: LangCode
    defaultTarget: LangCode
    leftCard: Backdrop
    rightCard: Backdrop
    placeholder: ShortText
    placeholders: Annotated[Dict[LangCode, Short], Field(max_length=100)]
    notice: Notice
    restricted: Dialog
    maintenance: Dialog
    feedbackPrompt: ShortText


# ----------------------------------------------------------------- languages
class CustomLanguage(Strict):
    code: LangCode
    name: Short
    writing: Annotated[str, StringConstraints(max_length=20)] = ""
    dialect: Annotated[str, StringConstraints(max_length=20)] | None = None


VariantCode = Annotated[str, StringConstraints(pattern=rf"^{_CODE_PART}$")]


class VariantOption(Strict):
    code: VariantCode
    label: ShortText


class VariantDialect(Strict):
    """A territory: <prefix>_<alphabet>_<code>, in the alphabets it lists."""

    code: VariantCode
    label: ShortText
    writings: Annotated[List[VariantCode], Field(max_length=20)] = []


class VariantSelector(Strict):
    enabled: bool = False
    prefix: Annotated[str, StringConstraints(pattern=r"^([a-z]{2,3})?$")] = ""
    # Code of the language without variants, offered on the source side (the
    # target side picks a territory and an alphabet). Empty: both sides pick.
    sourceCode: Union[Literal[""], LangCode] = ""
    label: ShortText = "Grafemario"
    options: Annotated[List[VariantOption], Field(max_length=20)] = []
    dialectLabel: ShortText = "Variante territorial"
    dialects: Annotated[List[VariantDialect], Field(max_length=20)] = []

    @model_validator(mode="after")
    def _consistent(self):
        known = {option.code for option in self.options}
        for dialect in self.dialects:
            unknown = [code for code in dialect.writings if code not in known]
            if unknown:
                raise ValueError(
                    f"La variante {dialect.code} usa grafemarios que no están en la "
                    f"lista: {', '.join(unknown)}"
                )
        return self


class Languages(Strict):
    hidden: Annotated[List[LangCode], Field(max_length=1000)]
    renamed: Annotated[Dict[LangCode, Short], Field(max_length=1000)]
    custom: Annotated[List[CustomLanguage], Field(max_length=200)]
    nativeCodes: Annotated[List[LangCode], Field(max_length=50)]
    variantSelector: VariantSelector


# ------------------------------------------------------------------ features
class PrefixFeature(Strict):
    enabled: bool
    languages: Annotated[List[LangPrefix], Field(max_length=50)]


class AsrFeature(Strict):
    enabled: bool
    languages: Annotated[List[LangCode], Field(max_length=50)]
    uploadLanguages: Annotated[List[LangPrefix], Field(max_length=50)]


class Features(Strict):
    tts: PrefixFeature
    asr: AsrFeature
    wordInformation: PrefixFeature


class AuthPages(Strict):
    loginImage: Media
    formsImage: Media
    profileImage: Media
    # blend the two illustrations into the brand colour (like Backdrop.tint)
    tint: bool = False


# ------------------------------------------------------------------- landing
class LandingLocale(Strict):
    code: Locale
    label: Short


class Section(Strict):
    id: Literal[SECTION_IDS]
    visible: bool = True
    tone: Literal["paper", "tint", "dark"] = "paper"


class Header(Strict):
    logo: Media
    logoAlt: I18n
    # The platform's name, the same in every language, shown above brandTitle
    platformName: Short = ""
    brandTitle: I18n
    selectLanguageLabel: I18n


class Hero(Strict):
    image: Media
    imageAlt: I18n
    focalPoint: Point
    overlayOpacity: Annotated[int, Field(ge=0, le=150)] = 100
    title: I18n
    subtitle: I18n
    primaryCta: I18n
    secondaryCta: I18n
    showDeveloperBadge: bool = True


class AboutItem(Strict):
    text: RichI18n
    image: Media
    imageAlt: I18n
    imageFit: Literal["cover", "contain"] = "cover"
    focalPoint: Point


class About(Strict):
    title: I18n
    items: Annotated[List[AboutItem], Field(max_length=12)]


class Pin(Strict):
    name: Short
    lat: Annotated[float, Field(ge=-90, le=90)]
    lon: Annotated[float, Field(ge=-180, le=180)]


class Validation(Strict):
    title: I18n
    mapLabel: I18n
    geojson: Media
    # False draws only the whole territory, without the circular close-up on the pins
    closeUp: bool = True
    # Outline drawn in light gray around the region (only without the close-up)
    contextGeojson: Media = ""
    pins: Annotated[List[Pin], Field(max_length=300)]


class FocusItem(Strict):
    icon: IconName
    title: I18n
    text: I18n


class Focus(Strict):
    title: I18n
    items: Annotated[List[FocusItem], Field(max_length=8)]


class Partner(Strict):
    logo: Media
    name: I18n
    url: Link
    urlLabel: Short
    logoHeight: Annotated[int, Field(ge=24, le=200)] = 72


class Owners(Strict):
    title: I18n
    developedByLabel: I18n
    partners: Annotated[List[Partner], Field(max_length=20)]


class Developer(Strict):
    enabled: bool = True
    name: Short
    logo: Media
    url: Link
    urlLabel: Short


class CreditGroup(Strict):
    title: I18n
    names: Annotated[List[Short], Field(max_length=300)]
    # kept in the document, not shown on the page
    hidden: bool = False


class Collaborators(Strict):
    title: I18n
    groups: Annotated[List[CreditGroup], Field(max_length=40)]


class Funder(Strict):
    logo: Media
    caption: I18n
    url: Link


class Funding(Strict):
    title: I18n
    items: Annotated[List[Funder], Field(max_length=40)]


class ContactForm(Strict):
    description: I18n
    firstName: I18n
    lastName: I18n
    email: I18n
    organization: I18n
    optional: I18n
    message: I18n
    submit: I18n
    successTitle: I18n
    successBody: I18n
    errorTitle: I18n
    errorBody: I18n


class Contact(Strict):
    title: I18n
    subtitle: I18n
    button: I18n
    form: ContactForm


class Footer(Strict):
    label: I18n
    showPartnerNames: bool = True


class Landing(Strict):
    locales: Annotated[List[LandingLocale], Field(min_length=1, max_length=6)]
    defaultLocale: Locale
    sections: Annotated[List[Section], Field(max_length=len(SECTION_IDS))]
    header: Header
    hero: Hero
    about: About
    validation: Validation
    focus: Focus
    owners: Owners
    developer: Developer
    collaborators: Collaborators
    funding: Funding
    contact: Contact
    footer: Footer

    @model_validator(mode="after")
    def _consistent(self):
        codes = [locale.code for locale in self.locales]
        if len(set(codes)) != len(codes):
            raise ValueError("Hay idiomas de la página repetidos")
        if self.defaultLocale not in codes:
            raise ValueError("El idioma por defecto debe estar entre los idiomas")
        ids = [section.id for section in self.sections]
        if len(set(ids)) != len(ids):
            raise ValueError("Hay secciones repetidas")
        return self


class TranslatorConfig(Strict):
    schemaVersion: Literal[SCHEMA_VERSION]
    identity: Identity
    theme: Theme
    translator: Translator
    languages: Languages
    features: Features
    authPages: AuthPages
    # Translations of the app's fixed texts, over the frontend's defaults
    ui: Annotated[Dict[UiKey, I18n], Field(max_length=500)] = {}
    landing: Landing


# ------------------------------------------------------------------- errors
_MESSAGES = {
    "missing": "Campo requerido",
    "extra_forbidden": "Campo desconocido",
    "string_type": "Debe ser un texto",
    "bool_type": "Debe ser verdadero o falso",
    "int_type": "Debe ser un número entero",
    "int_parsing": "Debe ser un número entero",
    "float_type": "Debe ser un número",
    "float_parsing": "Debe ser un número",
    "list_type": "Debe ser una lista",
    "dict_type": "Debe ser un objeto",
    "model_type": "Debe ser un objeto",
    "literal_error": "Valor no permitido",
    "string_pattern_mismatch": "Formato no válido",
}


def _message(error):
    kind = error["type"]
    ctx = error.get("ctx") or {}
    if kind == "string_too_long":
        return f"Texto demasiado largo (máximo {ctx.get('max_length')} caracteres)"
    if kind == "too_long":
        return f"Demasiados elementos (máximo {ctx.get('max_length')})"
    if kind == "too_short":
        return f"Se necesita al menos {ctx.get('min_length')} elemento"
    if kind in ("less_than_equal", "greater_than_equal"):
        return "Valor fuera del rango permitido"
    if kind == "value_error":
        return str(ctx.get("error") or error["msg"])
    return _MESSAGES.get(kind, error["msg"])


class ConfigValidationError(Exception):
    def __init__(self, errors):
        super().__init__("La configuración no es válida")
        self.errors = errors


def validate_config(data):
    """Validate and normalise a customization document.

    Returns the cleaned document (colours lower-cased, rich text sanitised)
    or raises ConfigValidationError with a list of ``{"path", "message"}``
    whose paths use the frontend's dotted notation (``landing.about.items.0``).
    """
    try:
        model = TranslatorConfig.model_validate(data)
    except ValidationError as exc:
        errors = [
            {
                "path": ".".join(str(part) for part in error["loc"]),
                "message": _message(error),
            }
            for error in exc.errors()
        ]
        raise ConfigValidationError(errors[:100]) from None
    return model.model_dump(mode="json")
