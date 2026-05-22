import { useState, useEffect, useRef } from 'react'

/**
 * Hook that opens a Server-Sent Events connection.
 * Automatically re-connects on disconnect.
 */
export default function useSSE(url, { enabled = true } = {}) {
  const [data, setData] = useState(null)
  const [connected, setConnected] = useState(false)
  const esRef = useRef(null)

  useEffect(() => {
    if (!enabled || !url) return

    const token = localStorage.getItem('access_token')
    const fullUrl = `${url}${url.includes('?') ? '&' : '?'}token=${token}`

    const connect = () => {
      const es = new EventSource(fullUrl)
      esRef.current = es

      es.onopen = () => setConnected(true)
      es.onmessage = (e) => {
        try { setData(JSON.parse(e.data)) } catch {}
      }
      es.onerror = () => {
        setConnected(false)
        es.close()
        // Reconnect after 5 seconds
        setTimeout(connect, 5000)
      }
    }

    connect()
    return () => {
      esRef.current?.close()
      setConnected(false)
    }
  }, [url, enabled])

  return { data, connected }
}
