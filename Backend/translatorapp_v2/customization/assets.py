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
"""Validation of files uploaded from the customization editor.

The type is decided from the bytes, never from the file name or the
Content-Type the browser sent: raster images must open with Pillow, SVGs must
not carry scripts and map files must be GeoJSON (or the "rings" format the
landing map ships with).
"""
import io
import json
import re

from PIL import Image, UnidentifiedImageError

from .models import CustomizationAsset

MAX_IMAGE_BYTES = 8 * 1024 * 1024
MAX_GEOJSON_BYTES = 4 * 1024 * 1024
MAX_PIXELS = 50_000_000

RASTER_TYPES = {
    "PNG": "image/png",
    "JPEG": "image/jpeg",
    "WEBP": "image/webp",
    "GIF": "image/gif",
    "ICO": "image/x-icon",
}

GEOJSON_TYPES = {
    "Polygon",
    "MultiPolygon",
    "Feature",
    "FeatureCollection",
    "GeometryCollection",
}

# Anything that could run code or pull in other documents when an SVG is opened
# on its own. Used as <img> it could not run, but the file is also reachable
# directly at its URL.
_SVG_FORBIDDEN = re.compile(
    rb"<\s*script|<\s*foreignObject|<\s*iframe|<\s*embed|<\s*object|<!ENTITY"
    rb"|\son[a-z]+\s*=|javascript:|data:text/html",
    re.IGNORECASE,
)


class AssetError(ValueError):
    pass


def _looks_like_svg(raw):
    head = raw[:2048].lstrip().lower()
    return head.startswith(b"<?xml") or head.startswith(b"<svg") or b"<svg" in head


def _looks_like_json(raw):
    return raw[:64].lstrip()[:1] in (b"{", b"[")


def inspect_upload(raw):
    """Return ``(kind, content_type, width, height)`` or raise AssetError."""
    if not raw:
        raise AssetError("El archivo está vacío.")

    if _looks_like_json(raw):
        if len(raw) > MAX_GEOJSON_BYTES:
            raise AssetError("El mapa no puede superar los 4 MB.")
        try:
            data = json.loads(raw.decode("utf-8"))
        except (UnicodeDecodeError, ValueError):
            raise AssetError("El archivo no es un JSON válido.") from None
        if not isinstance(data, dict) or not (
            data.get("type") in GEOJSON_TYPES or isinstance(data.get("rings"), list)
        ):
            raise AssetError(
                "El mapa debe ser GeoJSON con polígonos (Polygon, MultiPolygon, "
                "Feature o FeatureCollection)."
            )
        return CustomizationAsset.GEOJSON, "application/geo+json", None, None

    if len(raw) > MAX_IMAGE_BYTES:
        raise AssetError("La imagen no puede superar los 8 MB.")

    if _looks_like_svg(raw):
        if b"<svg" not in raw.lower():
            raise AssetError("El archivo SVG no es válido.")
        if _SVG_FORBIDDEN.search(raw):
            raise AssetError(
                "El SVG contiene scripts o contenido incrustado; expórtalo como "
                "SVG simple o PNG."
            )
        return CustomizationAsset.IMAGE, "image/svg+xml", None, None

    try:
        with Image.open(io.BytesIO(raw)) as image:
            image_format = image.format
            width, height = image.size
            if width * height > MAX_PIXELS:
                raise AssetError(
                    "La imagen es demasiado grande (máximo 50 megapíxeles)."
                )
            image.verify()
    except AssetError:
        raise
    except (UnidentifiedImageError, OSError, SyntaxError, ValueError):
        raise AssetError("El archivo no es una imagen válida.") from None
    except Image.DecompressionBombError:
        raise AssetError("La imagen es demasiado grande.") from None

    content_type = RASTER_TYPES.get(image_format)
    if not content_type:
        raise AssetError("Formato no permitido. Usa PNG, JPG, WebP, GIF, ICO o SVG.")
    return CustomizationAsset.IMAGE, content_type, width, height
