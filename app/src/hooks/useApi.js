import { useState, useEffect, useCallback, useRef } from 'react'

/**
 * Generic data-fetching hook.
 * @param {Function} fetcher  - async function that returns data
 * @param {any[]}    deps     - dependency array that re-triggers the fetch
 * @param {object}   options  - { immediate: bool, onSuccess, onError }
 */
export default function useApi(fetcher, deps = [], options = {}) {
  const { immediate = true, onSuccess, onError } = options
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(immediate)
  const [error, setError] = useState(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  const execute = useCallback(async (...args) => {
    setLoading(true)
    setError(null)
    try {
      const result = await fetcher(...args)
      const responseData = result?.data ?? result
      if (mountedRef.current) {
        setData(responseData)
        onSuccess?.(responseData)
      }
      return responseData
    } catch (err) {
      if (mountedRef.current) {
        setError(err)
        onError?.(err)
      }
      throw err
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }, deps) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (immediate) execute()
  }, [execute]) // eslint-disable-line react-hooks/exhaustive-deps

  return { data, loading, error, refetch: execute }
}
