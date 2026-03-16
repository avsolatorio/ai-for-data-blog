/**
 * React adapter for SearchClient.
 *
 * Wraps SearchClient in useState/useEffect so React components re-render
 * when search state changes.
 *
 * @example
 * ```ts
 * import { useSearch } from '@ai-for-data-blog/search/react'
 *
 * function MyComponent() {
 *   const { isIndexReady, results, search } = useSearch(MANIFEST_URL)
 *
 *   return (
 *     <>
 *       <input
 *         disabled={!isIndexReady}
 *         onKeyDown={(e) => e.key === 'Enter' && search(e.currentTarget.value)}
 *       />
 *       <ul>{results.map(r => <li key={String(r.id)}>{r.title}</li>)}</ul>
 *     </>
 *   )
 * }
 * ```
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { SearchClient } from '../src/client/SearchClient'
import type { SearchClientOptions, SearchMode } from '../src/client/SearchClient'
import type { SearchResult, SearchOptions } from '../src/types/search'
import type { CollectionManifest } from '../src/types/manifest'

export type { SearchMode, SearchClientOptions }

export interface UseSearchReturn {
  isIndexReady: boolean
  isModelReady: boolean
  loadingMessage: string
  activeFallback: boolean
  manifest: CollectionManifest | null
  results: SearchResult[]
  search(text: string, opts?: SearchOptions & { mode?: SearchMode }): void
  getRecent(limit?: number): void
  /** The underlying SearchClient instance, for advanced use. */
  client: SearchClient | null
}

/**
 * React hook that creates a SearchClient, wires up state updates, and
 * cleans up the worker on component unmount.
 *
 * The `manifestUrl` and `opts` references are only read on first mount;
 * changing them after mount has no effect (create a new component instance
 * with a new key to reinitialise).
 *
 * @param manifestUrl - URL to `manifest.json`
 * @param opts        - SearchClient options (modelId, workerFactory)
 */
export function useSearch(manifestUrl: string, opts: SearchClientOptions = {}): UseSearchReturn {
  const [isIndexReady, setIsIndexReady] = useState(false)
  const [isModelReady, setIsModelReady] = useState(false)
  const [loadingMessage, setLoadingMessage] = useState('Initializing…')
  const [activeFallback, setActiveFallback] = useState(false)
  const [manifest, setManifest] = useState<CollectionManifest | null>(null)
  const [results, setResults] = useState<SearchResult[]>([])

  // Stable ref to the client so search/getRecent callbacks don't re-create on every render
  const clientRef = useRef<SearchClient | null>(null)

  useEffect(() => {
    const client = new SearchClient(manifestUrl, opts)
    clientRef.current = client

    client.on('progress', (msg) => setLoadingMessage(msg.message))
    client.on('index_ready', () => setIsIndexReady(true))
    client.on('ready', (msg) => { setIsModelReady(true); setManifest(msg.config) })
    client.on('results', (msg) => { setActiveFallback(msg.fallback ?? false); setResults(msg.data) })
    client.on('error', (msg) => { setIsIndexReady(true); setLoadingMessage(`Error: ${msg.message}`) })

    return () => {
      client.destroy()
      clientRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // intentionally stable — reinit by changing the component key

  const search = useCallback(
    (text: string, searchOpts?: SearchOptions & { mode?: SearchMode }) => {
      clientRef.current?.search(text, searchOpts)
    },
    [],
  )

  const getRecent = useCallback((limit?: number) => {
    clientRef.current?.getRecent(limit)
  }, [])

  return {
    isIndexReady,
    isModelReady,
    loadingMessage,
    activeFallback,
    manifest,
    results,
    search,
    getRecent,
    client: clientRef.current,
  }
}
