import {
  detectShellLanguage,
  getShellLanguageOptions,
  getShellMessages,
  saveShellLanguage
} from './i18n.js'

const STORAGE_KEY = 'global-radio-backend-url'

const form = document.getElementById('connect-form')
const input = document.getElementById('server-url')
const errorEl = document.getElementById('error')
const clearBtn = document.getElementById('clear-btn')
const languageSelect = document.getElementById('language-select')

let currentLanguage = detectShellLanguage()

function showError(message) {
  errorEl.textContent = message
  errorEl.hidden = !message
}

function normalizeServerUrl(raw) {
  const trimmed = raw.trim()
  if (!trimmed) {
    return null
  }

  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`

  try {
    const url = new URL(withScheme)
    if (!['http:', 'https:'].includes(url.protocol)) {
      return null
    }

    return `${url.protocol}//${url.host}${url.pathname}`.replace(/\/$/, '') || `${url.protocol}//${url.host}`
  } catch {
    return null
  }
}

function loadSavedUrl() {
  return localStorage.getItem(STORAGE_KEY) || ''
}

function saveUrl(url) {
  localStorage.setItem(STORAGE_KEY, url)
}

function clearSavedUrl() {
  localStorage.removeItem(STORAGE_KEY)
  input.value = ''
  showError('')
  input.focus()
}

function connect(url) {
  saveUrl(url)
  window.location.replace(url)
}

function applyTranslations() {
  const messages = getShellMessages(currentLanguage)

  document.documentElement.lang = currentLanguage === 'zh' ? 'zh-CN' : currentLanguage
  document.title = messages.pageTitle
  document.getElementById('app-title').textContent = messages.appTitle
  document.getElementById('subtitle').textContent = messages.subtitle
  document.getElementById('server-url-label').textContent = messages.serverUrlLabel
  input.placeholder = messages.serverUrlPlaceholder
  document.getElementById('hint').textContent = messages.hint
  document.getElementById('connect-btn').textContent = messages.connect
  clearBtn.textContent = messages.clearSaved
  document.getElementById('language-label').textContent = messages.languageLabel

  if (languageSelect) {
    languageSelect.innerHTML = ''
    for (const option of getShellLanguageOptions(currentLanguage)) {
      const element = document.createElement('option')
      element.value = option.code
      element.textContent = option.label
      element.selected = option.selected
      languageSelect.appendChild(element)
    }
  }
}

input.value = loadSavedUrl()
applyTranslations()

languageSelect?.addEventListener('change', (event) => {
  currentLanguage = event.target.value
  saveShellLanguage(currentLanguage)
  applyTranslations()
})

form.addEventListener('submit', (event) => {
  event.preventDefault()
  showError('')

  const normalized = normalizeServerUrl(input.value)
  if (!normalized) {
    showError(getShellMessages(currentLanguage).invalidUrlError)
    return
  }

  connect(normalized)
})

clearBtn.addEventListener('click', clearSavedUrl)

input.focus()
