import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

const STORAGE_KEY_TIMEOUT = 'playbackFailoverTimeoutSec'
const STORAGE_KEY_FORCE_PROXY = 'forceProxyPlayback'

const DEFAULT_TIMEOUT_SEC = 3
const MIN_TIMEOUT_SEC = 1
const MAX_TIMEOUT_SEC = 15

function clampTimeout(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_TIMEOUT_SEC
  return Math.min(MAX_TIMEOUT_SEC, Math.max(MIN_TIMEOUT_SEC, Math.round(value)))
}

function loadTimeoutFromStorage(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_TIMEOUT)
    if (raw === null) return DEFAULT_TIMEOUT_SEC
    return clampTimeout(parseFloat(raw))
  } catch {
    return DEFAULT_TIMEOUT_SEC
  }
}

function loadForceProxyFromStorage(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY_FORCE_PROXY) === 'true'
  } catch {
    return false
  }
}

export const usePlaybackSettingsStore = defineStore('playbackSettings', () => {
  const failoverTimeoutSec = ref<number>(loadTimeoutFromStorage())
  const forceProxy = ref<boolean>(loadForceProxyFromStorage())

  // Persist whenever values change so the next playback (and the next app
  // launch) sees the new values without a reload.
  watch(failoverTimeoutSec, (value) => {
    const safe = clampTimeout(value)
    if (safe !== value) {
      failoverTimeoutSec.value = safe
      return
    }
    try {
      localStorage.setItem(STORAGE_KEY_TIMEOUT, String(safe))
    } catch {
      // ignore storage failures (private mode, quota exceeded)
    }
  })

  watch(forceProxy, (value) => {
    try {
      localStorage.setItem(STORAGE_KEY_FORCE_PROXY, value ? 'true' : 'false')
    } catch {
      // ignore
    }
  })

  function setFailoverTimeoutSec(value: number) {
    failoverTimeoutSec.value = clampTimeout(value)
  }

  function setForceProxy(value: boolean) {
    forceProxy.value = !!value
  }

  function toggleForceProxy() {
    forceProxy.value = !forceProxy.value
  }

  return {
    failoverTimeoutSec,
    forceProxy,
    setFailoverTimeoutSec,
    setForceProxy,
    toggleForceProxy,
    DEFAULT_TIMEOUT_SEC,
    MIN_TIMEOUT_SEC,
    MAX_TIMEOUT_SEC
  }
})
