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
"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { setIn } from "../config"
import { resolveConfig } from "../presets"
import {
  discardDraft,
  fetchDraft,
  publishDraft,
  refreshSiteCache,
  restoreRevision,
  saveDraft,
} from "./api"

// One working copy, one save model:
//   * every edit changes the in-memory document (undo/redo keep 100 steps);
//   * the draft is autosaved to the backend 1.2 s after the last edit, so
//     nothing is lost and another admin can pick it up;
//   * visitors see nothing until "Publicar", which also snapshots a revision;
//   * each write carries the version it was based on, so if two admins edit
//     at once the second one gets a conflict to resolve instead of silently
//     overwriting the first.

const AUTOSAVE_MS = 1200
const HISTORY_LIMIT = 100
const COALESCE_MS = 900

export const STATUS = {
  LOADING: "loading",
  SAVED: "saved",
  DIRTY: "dirty",
  SAVING: "saving",
  PUBLISHING: "publishing",
  INVALID: "invalid",
  CONFLICT: "conflict",
  ERROR: "error",
}

const json = (value) => JSON.stringify(value)

export function useEditorState() {
  const [doc, setDocState] = useState(null)
  const [server, setServer] = useState(null)
  const [status, setStatus] = useState(STATUS.LOADING)
  const [errors, setErrors] = useState([])
  const [conflict, setConflict] = useState(null)
  const [loadError, setLoadError] = useState(null)
  const [historyInfo, setHistoryInfo] = useState({ canUndo: false, canRedo: false })

  const docRef = useRef(null)
  const serverRef = useRef(null)
  const savedJson = useRef(null)
  // A document the server rejected (or failed to take) is not retried until it
  // changes; "Guardar" retries it on demand.
  const failedJson = useRef(null)
  const timer = useRef(null)
  const saving = useRef(false)
  const history = useRef({ past: [], future: [], lastPath: null, lastAt: 0 })

  const syncHistoryInfo = useCallback(
    () =>
      setHistoryInfo({
        canUndo: history.current.past.length > 0,
        canRedo: history.current.future.length > 0,
      }),
    []
  )

  const setDoc = (next) => {
    docRef.current = next
    setDocState(next)
  }

  const adoptServer = useCallback((state, { resetDoc } = { resetDoc: false }) => {
    serverRef.current = state
    setServer(state)
    if (resetDoc) {
      const resolved = resolveConfig(state.config)
      setDoc(resolved)
      savedJson.current = json(resolved)
    }
  }, [])

  // ---------------------------------------------------------------- loading
  const load = useCallback(async () => {
    setStatus(STATUS.LOADING)
    setLoadError(null)
    try {
      const state = await fetchDraft()
      adoptServer(state, { resetDoc: true })
      history.current = { past: [], future: [], lastPath: null, lastAt: 0 }
      syncHistoryInfo()
      setStatus(STATUS.SAVED)
    } catch (error) {
      setLoadError(error)
    }
  }, [adoptServer, syncHistoryInfo])

  useEffect(() => {
    load()
  }, [load])

  // ---------------------------------------------------------------- editing
  const record = useCallback((previous, path) => {
    const h = history.current
    const now = Date.now()
    // Typing into one field is one undo step, not one per keystroke
    if (!(path && h.lastPath === path && now - h.lastAt < COALESCE_MS)) {
      h.past.push(previous)
      if (h.past.length > HISTORY_LIMIT) h.past.shift()
    }
    h.future = []
    h.lastPath = path
    h.lastAt = now
    syncHistoryInfo()
  }, [syncHistoryInfo])

  const update = useCallback((path, value) => {
    const previous = docRef.current
    if (!previous) return
    record(previous, path)
    setDoc(setIn(previous, path, value))
  }, [record])

  /** Replace the whole document (template, import, restore) as one undo step. */
  const replace = useCallback((next) => {
    record(docRef.current, null)
    setDoc(next)
  }, [record])

  const undo = useCallback(() => {
    const h = history.current
    if (!h.past.length) return
    h.future.push(docRef.current)
    setDoc(h.past.pop())
    h.lastPath = null
    syncHistoryInfo()
  }, [syncHistoryInfo])

  const redo = useCallback(() => {
    const h = history.current
    if (!h.future.length) return
    h.past.push(docRef.current)
    setDoc(h.future.pop())
    h.lastPath = null
    syncHistoryInfo()
  }, [syncHistoryInfo])

  // ---------------------------------------------------------------- saving
  const handleWriteError = useCallback((error, attempted) => {
    failedJson.current = attempted ?? null
    const data = error?.response?.data
    if (error?.response?.status === 409 && data?.state) {
      setConflict(data.state)
      setStatus(STATUS.CONFLICT)
    } else if (error?.response?.status === 400 && Array.isArray(data?.errors)) {
      setErrors(data.errors)
      setStatus(STATUS.INVALID)
    } else {
      setStatus(STATUS.ERROR)
    }
  }, [])

  const save = useCallback(async () => {
    clearTimeout(timer.current)
    const current = docRef.current
    if (!current || saving.current) return
    const body = json(current)
    if (body === savedJson.current) {
      setStatus(STATUS.SAVED)
      return
    }
    saving.current = true
    setStatus(STATUS.SAVING)
    try {
      const state = await saveDraft(current, serverRef.current.version)
      adoptServer(state)
      savedJson.current = body
      failedJson.current = null
      setErrors([])
      setStatus(json(docRef.current) === body ? STATUS.SAVED : STATUS.DIRTY)
    } catch (error) {
      handleWriteError(error, body)
    } finally {
      saving.current = false
    }
  }, [adoptServer, handleWriteError])

  // Autosave after a pause in editing
  useEffect(() => {
    if (!doc || status === STATUS.LOADING || status === STATUS.CONFLICT) return
    if (status === STATUS.PUBLISHING || status === STATUS.SAVING) return
    const current = json(doc)
    if (current === savedJson.current) {
      // Back to what the server already has (e.g. an invalid value was
      // corrected to the saved one): nothing to save, nothing wrong.
      if (status === STATUS.DIRTY || status === STATUS.INVALID || status === STATUS.ERROR) {
        setErrors([])
        setStatus(STATUS.SAVED)
      }
      return
    }
    if (current === failedJson.current) return
    if (status === STATUS.SAVED || status === STATUS.ERROR || status === STATUS.INVALID) {
      setStatus(STATUS.DIRTY)
    }
    clearTimeout(timer.current)
    timer.current = setTimeout(save, AUTOSAVE_MS)
    return () => clearTimeout(timer.current)
  }, [doc, status, save])

  const publish = useCallback(
    async (note) => {
      clearTimeout(timer.current)
      setStatus(STATUS.PUBLISHING)
      try {
        const state = await publishDraft(docRef.current, serverRef.current.version, note)
        adoptServer(state, { resetDoc: true })
        setErrors([])
        setStatus(STATUS.SAVED)
        refreshSiteCache()
        return true
      } catch (error) {
        handleWriteError(error)
        return false
      }
    },
    [adoptServer, handleWriteError]
  )

  const discard = useCallback(async () => {
    clearTimeout(timer.current)
    try {
      const state = await discardDraft(serverRef.current.version)
      record(docRef.current, null)
      adoptServer(state, { resetDoc: true })
      setErrors([])
      setStatus(STATUS.SAVED)
      return true
    } catch (error) {
      handleWriteError(error)
      return false
    }
  }, [adoptServer, handleWriteError, record])

  const restore = useCallback(
    async (revisionId) => {
      clearTimeout(timer.current)
      try {
        const state = await restoreRevision(revisionId, serverRef.current.version)
        record(docRef.current, null)
        adoptServer(state, { resetDoc: true })
        setErrors([])
        setStatus(STATUS.SAVED)
        return true
      } catch (error) {
        handleWriteError(error)
        return false
      }
    },
    [adoptServer, handleWriteError, record]
  )

  /** After a conflict: keep the other admin's version, or overwrite it with ours. */
  const resolveConflict = useCallback(
    (choice) => {
      const theirs = conflict
      if (!theirs) return
      setConflict(null)
      if (choice === "theirs") {
        record(docRef.current, null)
        adoptServer(theirs, { resetDoc: true })
        setStatus(STATUS.SAVED)
      } else {
        adoptServer(theirs)
        savedJson.current = null
        setStatus(STATUS.DIRTY)
      }
    },
    [conflict, adoptServer, record]
  )

  const isDirty = [STATUS.DIRTY, STATUS.SAVING, STATUS.INVALID, STATUS.ERROR, STATUS.CONFLICT].includes(
    status
  )

  // Warn before leaving with changes that have not reached the server
  useEffect(() => {
    if (!isDirty) return undefined
    const warn = (event) => {
      event.preventDefault()
      event.returnValue = ""
    }
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [isDirty])

  return {
    doc,
    server,
    status,
    errors,
    conflict,
    loadError,
    isDirty,
    ...historyInfo,
    load,
    update,
    replace,
    undo,
    redo,
    save,
    publish,
    discard,
    restore,
    resolveConflict,
  }
}
