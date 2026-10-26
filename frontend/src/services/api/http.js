
export function getApiBaseUrl() {
  return import.meta.env.VITE_API_BASE_URL || '/api'
}

const TOKEN_STORAGE_KEY = 'cotizaciones_auth_token'

function getAuthHeaders(headers = {}, { skipAuth = false } = {}) {
  if (skipAuth) return headers

  const token = localStorage.getItem(TOKEN_STORAGE_KEY)
  if (!token) return headers

  return {
    ...headers,
    Authorization: `Bearer ${token}`,
  }
}


function getBackoffDelay(attempt) {
  return Math.min(1000 * Math.pow(2, attempt), 10000)
}


function mergeSignals(...signals) {
  const validSignals = signals.filter(Boolean)
  if (validSignals.length === 0) return undefined
  if (validSignals.length === 1) return validSignals[0]

  const controller = new AbortController()

  for (const signal of validSignals) {
    if (signal.aborted) {
      controller.abort(signal.reason)
      break
    }
    signal.addEventListener('abort', () => controller.abort(signal.reason), { once: true })
  }

  return controller.signal
}


async function fetchWithRetry(url, options = {}, { maxRetries = 3, timeout = 30000 } = {}) {
  const { signal: externalSignal, ...restOptions } = options
  let lastError

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const timeoutController = new AbortController()
    const timeoutId = setTimeout(() => timeoutController.abort(), timeout)

    try {
      const mergedSignal = mergeSignals(externalSignal, timeoutController.signal)

      const res = await fetch(url, {
        ...restOptions,
        signal: mergedSignal,
      })

      clearTimeout(timeoutId)
      return res
    } catch (err) {
      clearTimeout(timeoutId)
      lastError = err

      // Si el usuario canceló manualmente, no reintentar
      if (externalSignal?.aborted) throw err

      // Si fue AbortError por timeout u otro motivo, no reintentar
      if (err.name === 'AbortError') throw err

      // Solo reintentar en errores de red
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, getBackoffDelay(attempt)))
      }
    }
  }

  throw lastError
}

/**
 * Parsea el cuerpo del error HTTP (JSON o texto plano)
 */
async function handleErrorResponse(res, { skipAuth = false } = {}) {
  const contentType = res.headers.get('content-type') || ''
  let errorMessage = `HTTP ${res.status}`

  try {
    if (contentType.includes('application/json')) {
      const data = await res.json()
      errorMessage = data.message || data.error || errorMessage
    } else {
      const text = await res.text()
      if (text) errorMessage = text
    }
  } catch {
    // Ignorar error al parsear — el mensaje base es suficiente
  }

  const error = new Error(errorMessage)
  error.status = res.status
  const retryAfter = Number(res.headers.get('Retry-After'))
  if (Number.isFinite(retryAfter) && retryAfter > 0) {
    error.retryAfter = retryAfter
  }

  if (res.status === 401 && !skipAuth) {
    localStorage.removeItem(TOKEN_STORAGE_KEY)
    localStorage.removeItem('cotizaciones_auth_user')
    window.dispatchEvent(new Event('auth-change'))
  }

  return error
}

/**
 * Parsea la respuesta según el tipo esperado
 */
async function parseResponse(res, responseType) {
  if (res.status === 204 || res.status === 205) return null

  if (responseType === 'blob') return res.blob()

  const contentType = res.headers.get('content-type') || ''
  if (contentType.includes('application/pdf')) return res.arrayBuffer()
  if (!contentType) return null

  return res.json()
}

export function unwrapData(response) {
  if (response && typeof response === 'object' && 'data' in response) {
    return response.data
  }
  return response
}

export async function apiGet(path, { signal, responseType = 'json', headers, skipAuth = false } = {}) {
  const url = `${getApiBaseUrl()}${path}`

  const res = await fetchWithRetry(url, {
    method: 'GET',
    headers: getAuthHeaders(headers || {}, { skipAuth }),
    signal,
  })

  if (!res.ok) throw await handleErrorResponse(res, { skipAuth })

  return parseResponse(res, responseType)
}

export async function apiPost(path, body, { signal, headers, responseType = 'json', skipAuth = false } = {}) {
  const url = `${getApiBaseUrl()}${path}`
  const isFormData = body instanceof FormData

  const requestOptions = {
    method: 'POST',
    signal,
    headers: isFormData
      ? getAuthHeaders(headers || {}, { skipAuth })
      : getAuthHeaders({ 'Content-Type': 'application/json', ...(headers || {}) }, { skipAuth }),
    body: isFormData ? body : JSON.stringify(body ?? {}),
  }

  const res = await fetchWithRetry(url, requestOptions)

  if (!res.ok) throw await handleErrorResponse(res, { skipAuth })

  return parseResponse(res, responseType)
}

export async function apiPut(path, body, { signal, headers, responseType = 'json', skipAuth = false } = {}) {
  const url = `${getApiBaseUrl()}${path}`
  const isFormData = body instanceof FormData

  const requestOptions = {
    method: 'PUT',
    signal,
    headers: isFormData
      ? getAuthHeaders(headers || {}, { skipAuth })
      : getAuthHeaders({ 'Content-Type': 'application/json', ...(headers || {}) }, { skipAuth }),
    body: isFormData ? body : JSON.stringify(body ?? {}),
  }

  const res = await fetchWithRetry(url, requestOptions)

  if (!res.ok) throw await handleErrorResponse(res, { skipAuth })

  return parseResponse(res, responseType)
}

export async function apiPatch(path, body, { signal, headers, responseType = 'json', skipAuth = false } = {}) {
  const url = `${getApiBaseUrl()}${path}`

  const res = await fetchWithRetry(url, {
    method: 'PATCH',
    headers: getAuthHeaders({ 'Content-Type': 'application/json', ...(headers || {}) }, { skipAuth }),
    body: JSON.stringify(body ?? {}),
    signal,
  })

  if (!res.ok) throw await handleErrorResponse(res, { skipAuth })

  return parseResponse(res, responseType)
}

export async function apiDelete(path, { signal, headers, responseType = 'json', skipAuth = false } = {}) {
  const url = `${getApiBaseUrl()}${path}`

  const res = await fetchWithRetry(url, {
    method: 'DELETE',
    headers: getAuthHeaders(headers || {}, { skipAuth }),
    signal,
  })

  if (!res.ok) throw await handleErrorResponse(res, { skipAuth })

  return parseResponse(res, responseType)
}
