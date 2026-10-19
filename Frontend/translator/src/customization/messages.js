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

// Fixed texts of the translator app (menu, translator, feedback, voice), in
// the languages every deployment shares. The texts of the translator's own
// language (mapuzungun, rapa nui, ...) belong to the customization document:
// its `ui` map has the same keys and is laid over these, so a deployment can
// translate or reword any of them without touching code. A text missing in
// the visitor's language falls back to the site's default language (Spanish).
//
// `{name}` placeholders are filled by t(key, { name: value }).

const MESSAGES = {
  // ------------------------------------------------------------- common
  "common.close": { es: "Cerrar", en: "Close" },
  "common.cancel": { es: "Cancelar", en: "Cancel" },
  "common.send": { es: "Enviar", en: "Send" },
  "common.error": { es: "Error", en: "Error" },
  "common.loginRequired": {
    es: "Debe ingresar su usuario para ocupar todas las funcionalidades de la aplicación",
    en: "Please log in to use every feature of the application",
  },

  // --------------------------------------------------------------- menu
  "menu.toggle": { es: "Abrir o cerrar el menú", en: "Open or close the menu" },
  "menu.home": { es: "Inicio", en: "Home" },
  "menu.translator": { es: "Traductor", en: "Translator" },
  "menu.profile": { es: "Perfil", en: "Profile" },
  "menu.manageAccess": { es: "Administrar accesos", en: "Manage access" },
  "menu.exploreData": { es: "Explorar datos", en: "Explore data" },
  "menu.manageWords": { es: "Administrar palabras", en: "Manage words" },
  "menu.manageTranslator": { es: "Administrar Traductor", en: "Manage translator" },
  "menu.logout": { es: "Cerrar sesión", en: "Log out" },
  "menu.login": { es: "Iniciar sesión", en: "Log in" },

  // ---------------------------------------------------- language names
  // Shown instead of the catalog name in that language only (no fallback).
  "lang.spa_Latn": { en: "Spanish" },
  "lang.eng_Latn": { en: "English" },
  "langs.search": { es: "Buscar idioma", en: "Search for a language" },

  // --------------------------------------------------------- translator
  "translator.source": { es: "Fuente", en: "Source" },
  "translator.target": { es: "Destino", en: "Target" },
  "translator.slow": {
    es: "La traducción está tardando más tiempo de lo esperado...",
    en: "The translation is taking longer than expected...",
  },
  "translator.noBackend": { es: "No hay conexión con el backend", en: "No connection to the server" },
  "translator.noBackendBody": { es: "Verifique la URL del servidor.", en: "Check the server URL." },
  "translator.retry": { es: "Por favor reintente la traducción", en: "Please try the translation again" },
  "translator.positiveSent": { es: "Sugerencia enviada con éxito", en: "Feedback sent" },
  "translator.feedbackThanks": { es: "Gracias por su retroalimentación", en: "Thank you for your feedback" },
  "translator.copyError": { es: "Error al copiar", en: "Copy failed" },
  "translator.copyErrorBody": {
    es: "No se pudo copiar el texto al portapapeles",
    en: "The text could not be copied to the clipboard",
  },

  // --------------------------------------------------------------- card
  "card.maxWords": {
    es: "El texto no puede tener más de {max} palabras",
    en: "The text cannot be longer than {max} words",
  },
  "card.wordInfo": { es: "Información de palabras", en: "Word information" },
  "card.moreInfo": { es: "Información adicional", en: "Additional information" },
  "card.synonyms": { es: "Sinónimos:", en: "Synonyms:" },
  "card.noInfo": {
    es: "No hay información disponible para esta traducción.",
    en: "No information is available for this translation.",
  },
  "card.maleVoice": { es: "Voz masculina", en: "Male voice" },
  "card.femaleVoice": { es: "Voz femenina", en: "Female voice" },
  "card.chooseVoice": { es: "Seleccionar voz", en: "Choose a voice" },
  "card.stopReading": { es: "Detener lectura", en: "Stop reading" },
  "card.stop": { es: "Detener", en: "Stop" },
  "card.listen": { es: "Escuchar", en: "Listen" },
  "card.play": { es: "Reproducir audio", en: "Play audio" },
  "card.clearText": { es: "Borrar texto", en: "Clear text" },
  "card.clear": { es: "Limpiar", en: "Clear" },
  "card.copy": { es: "Copiar traducción", en: "Copy translation" },

  // ----------------------------------------------------------- feedback
  "feedback.title": { es: "Enviar retroalimentación", en: "Send feedback" },
  "feedback.question": {
    es: "¿Quieres sugerir una traducción alternativa?",
    en: "Would you like to suggest an alternative translation?",
  },
  "feedback.suggestionsTitle": { es: "Sugerencias o comentarios", en: "Suggestions or comments" },
  "feedback.suggestionsPrompt": {
    es: "Comparte tus comentarios o sugerencias sobre la plataforma",
    en: "Share your comments or suggestions about the platform",
  },
  "feedback.enteredBy": { es: "Retroalimentación ingresada por: {user}", en: "Feedback submitted by: {user}" },
  "feedback.anonymous": { es: "Anónimo", en: "Anonymous" },
  "feedback.writeHere": { es: "Escribe aquí", en: "Write here" },
  "feedback.source": { es: "Fuente", en: "Source" },
  "feedback.translation": { es: "Traducción", en: "Translation" },
  "feedback.uncertain": {
    es: "Sé que está mal pero no sé cómo corregirlo",
    en: "I know it is wrong but I don't know how to fix it",
  },
  "feedback.sent": { es: "Retroalimentación enviada con éxito", en: "Feedback sent" },
  "feedback.emptyTitle": { es: "Campo vacío", en: "Empty field" },
  "feedback.emptyBody": {
    es: "Deberías incluir una sugerencia antes de enviar.",
    en: "Please include a suggestion before sending.",
  },
  "feedback.updated": { es: "Retroalimentación actualizada", en: "Feedback updated" },
  "feedback.updatedBody": {
    es: "La retroalimentación ha sido actualizada correctamente",
    en: "The feedback was updated",
  },
  "feedback.accepted": { es: "Retroalimentación actualizada y aceptada", en: "Feedback updated and accepted" },
  "feedback.acceptedBody": {
    es: "La retroalimentación ha sido actualizada y aceptada correctamente",
    en: "The feedback was updated and accepted",
  },

  // -------------------------------------------------------- voice (TTS)
  "tts.loginRequired": {
    es: "Debe iniciar sesión para usar la síntesis de voz",
    en: "Please log in to use speech synthesis",
  },
  "tts.loading": { es: "El modelo de voz se está cargando...", en: "The voice model is loading..." },
  "tts.error": { es: "Error al sintetizar", en: "Speech synthesis failed" },

  // ------------------------------------------------- dictation (ASR)
  "asr.record": { es: "Grabar audio", en: "Record audio" },
  "asr.upload": { es: "Subir audio", en: "Upload audio" },
  "asr.start": { es: "Iniciar grabación", en: "Start recording" },
  "asr.micReminder": {
    es: "Recuerda activar el micrófono en tu dispositivo.",
    en: "Remember to enable the microphone on your device.",
  },
  // Label before the language buttons. A deployment can instead give a whole
  // sentence per language prefix as "asr.speaking.<prefix>" in its `ui` map
  // (languages where "speaking X" is one inflected word).
  "asr.speakingIn": { es: "Estás hablando en", en: "You are speaking" },
  "asr.connecting": { es: "Conectando micrófono...", en: "Connecting the microphone..." },
  "asr.wait": {
    es: "Por favor, espera un momento antes de hablar",
    en: "Please wait a moment before speaking",
  },
  "asr.stop": { es: "Detener grabación", en: "Stop recording" },
  "asr.transcribing": { es: "Transcribiendo…", en: "Transcribing…" },
  "asr.transcription": { es: "Transcripción", en: "Transcription" },
  "asr.reviewPlaceholder": { es: "Revisa o edita la transcripción…", en: "Review or edit the transcription…" },
  "asr.recordAgain": { es: "Volver a grabar", en: "Record again" },
  "asr.translate": { es: "Comenzar traducción", en: "Start translation" },
  "asr.noText": { es: "No hay texto para traducir.", en: "There is no text to translate." },
  "asr.validationFailed": { es: "No se pudo guardar la validación", en: "The review could not be saved" },
  "asr.validationFailedBody": {
    es: "La transcripción se usará de todas formas.",
    en: "The transcription will be used anyway.",
  },
  "asr.unsupportedFormat": { es: "Formato no soportado.", en: "Unsupported format." },
  "asr.unsupportedFormatBody": {
    es: "El formato '{type}' no es compatible. Intente con webm, ogg, mp3, o wav.",
    en: "The '{type}' format is not supported. Try webm, ogg, mp3 or wav.",
  },
  "asr.tooLong": {
    es: "El audio no debe superar los 30 segundos.",
    en: "The audio must not be longer than 30 seconds.",
  },
  "asr.detectedDuration": { es: "Duración detectada: {seconds}s", en: "Detected length: {seconds}s" },
  "asr.fileFailed": { es: "No se pudo procesar el archivo.", en: "The file could not be processed." },
  "asr.readError": { es: "Error al leer el archivo de audio.", en: "The audio file could not be read." },
  "asr.readErrorBody": {
    es: "El archivo podría estar dañado o en un formato no soportado.",
    en: "The file may be damaged or in an unsupported format.",
  },
  "asr.error": { es: "Error al transcribir.", en: "Transcription failed." },
  "asr.retryFile": { es: "Reintenta con otro archivo.", en: "Try another file." },
  "asr.pleaseWait": { es: "Por favor, espere un momento", en: "Please wait a moment" },
  "asr.slow": {
    es: "La transcripción está tardando más tiempo de lo esperado...",
    en: "The transcription is taking longer than expected...",
  },
  "asr.ready": { es: "Transcripción lista.", en: "Transcription ready." },
  "asr.cancelled": { es: "Transcripción cancelada.", en: "Transcription cancelled." },
  "asr.unsupportedBrowser": {
    es: "Tu navegador no soporta grabación de audio.",
    en: "Your browser does not support audio recording.",
  },
  "asr.empty": { es: "No se grabó audio. Intente nuevamente.", en: "No audio was recorded. Please try again." },
  "asr.truncated": { es: "El audio fue truncado a 30 segundos.", en: "The audio was cut to 30 seconds." },
  "asr.recordingFailed": { es: "No se pudo procesar la grabación.", en: "The recording could not be processed." },
  "asr.started": { es: "Grabación iniciada", en: "Recording started" },
  "asr.startFailed": { es: "Error al iniciar grabación: {error}", en: "The recording could not start: {error}" },
  "asr.recordingCancelled": { es: "Grabación cancelada.", en: "Recording cancelled." },

  // ------------------------------------------------- access ("Visibilidad")
  "access.noRole": {
    es: "Tu cuenta no tiene acceso a esta función.",
    en: "Your account doesn't have access to this feature.",
  },
  "access.pageNoRole": {
    es: "Tu cuenta no tiene acceso al traductor. Si crees que es un error, contacta a las personas que administran el sitio.",
    en: "Your account doesn't have access to the translator. If you think this is a mistake, contact the site's administrators.",
  },

  // ------------------------------------- "Ayúdame a decidir" (territory)
  // The territories' own texts (what each name means, where it lies) are in
  // territoryHelper.js, with the comunas.
  "territoryHelp.open": { es: "Ayúdame a decidir", en: "Help me decide" },
  "territoryHelp.title": { es: "¿De qué territorio eres?", en: "Which territory are you from?" },
  "territoryHelp.intro": {
    es: "El mapuzungun se habla distinto en cada territorio. Selecciona el territorio donde vives o de donde viene tu familia.",
    en: "Mapuzungun is spoken differently in each territory. Select the territory where you live or where your family comes from.",
  },
  "territoryHelp.search": { es: "¿De qué comuna provienes?", en: "Which comuna are you from?" },
  "territoryHelp.searchHint": { es: "Por ejemplo: Carahue, Temuco, Osorno…", en: "For example: Carahue, Temuco, Osorno…" },
  "territoryHelp.notFound": {
    es: "No encontramos esa comuna. Elige abajo el territorio más cercano.",
    en: "We couldn't find that comuna. Pick the closest territory below.",
  },
  "territoryHelp.belongs": {
    es: "{place} es parte del territorio {territory}",
    en: "{place} is in the {territory} territory",
  },
  "territoryHelp.use": { es: "Usar {territory}", en: "Use {territory}" },
  "territoryHelp.pick": { es: "Elige un territorio", en: "Pick a territory" },
}

export default MESSAGES
