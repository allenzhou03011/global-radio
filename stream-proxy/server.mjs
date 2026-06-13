import http from 'node:http'
import { URL } from 'node:url'

const PORT = Number(process.env.STREAM_PROXY_PORT || 3001)
const PROXY_PREFIX = '/stream-proxy/'

const M3U8_TYPES = new Set([
  'application/vnd.apple.mpegurl',
  'application/x-mpegurl',
  'audio/mpegurl',
  'audio/x-mpegurl'
])

function isPrivateHost(hostname) {
  const host = hostname.toLowerCase()
  if (host === 'localhost' || host.endsWith('.local')) return true
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    const [a, b] = host.split('.').map(Number)
    if (a === 10) return true
    if (a === 127) return true
    if (a === 169 && b === 254) return true
    if (a === 192 && b === 168) return true
    if (a === 172 && b >= 16 && b <= 31) return true
  }
  return false
}

function isAllowedUrl(targetUrl) {
  try {
    const parsed = new URL(targetUrl)
    if (!['http:', 'https:'].includes(parsed.protocol)) return false
    return !isPrivateHost(parsed.hostname)
  } catch {
    return false
  }
}

function normalizeTargetUrl(targetUrl) {
  const parsed = new URL(targetUrl)
  const path = decodeURIComponent(parsed.pathname)
  return `${parsed.protocol}//${parsed.host}${path}${parsed.search}`
}

function toProxyUrl(targetUrl) {
  return `${PROXY_PREFIX}?url=${encodeURIComponent(normalizeTargetUrl(targetUrl))}`
}

function rewritePlaylist(body, baseUrl) {
  const base = new URL(baseUrl)

  return body.split('\n').map((line) => {
    const trimmed = line.trim()
    if (!trimmed) return line

    if (trimmed.startsWith('#')) {
      return trimmed.replace(/URI="([^"]+)"/g, (_match, uri) => {
        const absolute = new URL(uri, base).href
        return `URI="${toProxyUrl(absolute)}"`
      })
    }

    const absolute = new URL(trimmed, base).href
    return toProxyUrl(absolute)
  }).join('\n')
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    'Access-Control-Allow-Headers': '*'
  })
  res.end(JSON.stringify(payload))
}

async function proxyRequest(targetUrl, req, res) {
  const upstream = await fetch(targetUrl, {
    method: req.method,
    headers: {
      'User-Agent': req.headers['user-agent'] || 'GlobalRadio-Stream-Proxy/1.0',
      Accept: req.headers.accept || '*/*'
    },
    redirect: 'follow'
  })

  const contentType = (upstream.headers.get('content-type') || '').split(';')[0].trim().toLowerCase()
  const isPlaylist = M3U8_TYPES.has(contentType) || targetUrl.toLowerCase().includes('.m3u8')

  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    'Access-Control-Allow-Headers': '*',
    'Cache-Control': 'no-store'
  }

  if (contentType) {
    headers['Content-Type'] = upstream.headers.get('content-type')
  }

  if (req.method === 'HEAD') {
    res.writeHead(upstream.status, headers)
    res.end()
    return
  }

  if (!upstream.ok) {
    sendJson(res, upstream.status, { error: `Upstream request failed: ${upstream.status}` })
    return
  }

  if (isPlaylist) {
    const text = await upstream.text()
    const rewritten = rewritePlaylist(text, targetUrl)
    headers['Content-Type'] = contentType || 'application/vnd.apple.mpegurl'
    res.writeHead(200, headers)
    res.end(rewritten)
    return
  }

  const buffer = Buffer.from(await upstream.arrayBuffer())
  res.writeHead(200, headers)
  res.end(buffer)
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': '*'
    })
    res.end()
    return
  }

  if (!req.url?.startsWith(PROXY_PREFIX)) {
    sendJson(res, 404, { error: 'Not found' })
    return
  }

  const requestUrl = new URL(req.url, 'http://stream-proxy.local')
  const target = requestUrl.searchParams.get('url')

  if (!target || !isAllowedUrl(target)) {
    sendJson(res, 400, { error: 'Invalid or disallowed stream URL' })
    return
  }

  try {
    await proxyRequest(target, req, res)
  } catch (error) {
    sendJson(res, 502, {
      error: 'Stream proxy failed',
      detail: error instanceof Error ? error.message : String(error)
    })
  }
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Stream proxy listening on 127.0.0.1:${PORT}`)
})
