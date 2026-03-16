/**
 * Vue 3 adapter for SearchClient.
 *
 * Wraps SearchClient in reactive refs so Vue templates update automatically.
 *
 * @example
 * ```ts
 * import { useSearch } from '@ai-for-data-blog/search/vue'
 *
 * const {
 *   isIndexReady,   // Ref<boolean> — BM25 ready
 *   isModelReady,   // Ref<boolean> — semantic model ready
 *   loadingMessage, // Ref<string>
 *   activeFallback, // Ref<boolean> — true when last search used BM25 fallback
 *   manifest,       // Ref<CollectionManifest | null>
 *   results,        // Ref<SearchResult[]>
 *   search,         // (text, opts?) => void
 *   getRecent,      // (limit?) => void
 *   on,             // typed event bus passthrough
 * } = useSearch('https://example.com/data/prwp/manifest.json')
 * ```
 */

import { ref, onUnmounted } from 'vue'
import type { Ref } from 'vue'
import { SearchClient } from '../src/client/SearchClient'
import type { SearchClientOptions, SearchMode } from '../src/client/SearchClient'
import type { SearchResult, SearchOptions } from '../src/types/search'
import type { CollectionManifest } from '../src/types/manifest'
import type { WorkerOutboundMessage } from '../src/types/worker'

export type { SearchMode, SearchClientOptions }

export interface UseSearchReturn {
  /** True once the index + BM25 are loaded. Lexical search available. */
  isIndexReady: Ref<boolean>
  /** True once the ONNX model is ready. Semantic + hybrid search available. */
  isModelReady: Ref<boolean>
  /** Latest status/progress message. */
  loadingMessage: Ref<string>
  /** True when the last search result used BM25 fallback (model not ready). */
  activeFallback: Ref<boolean>
  /** Parsed collection manifest (available after index_ready). */
  manifest: Ref<CollectionManifest | null>
  /** Last search results. Updated on every 'results' message. */
  results: Ref<SearchResult[]>
  /** Submit a search query. */
  search(text: string, opts?: SearchOptions & { mode?: SearchMode }): void
  /** Load recent items (pre-search state). */
  getRecent(limit?: number): void
  /**
   * Subscribe to a specific worker message type.
   * The subscription is automatically cleaned up on component unmount.
   */
  on<T extends WorkerOutboundMessage['type']>(
    type: T,
    handler: (msg: Extract<WorkerOutboundMessage, { type: T }>) => void,
  ): () => void
  /** The underlying SearchClient instance, for advanced use. */
  client: SearchClient
}

/**
 * Create a reactive search client bound to the current Vue component lifecycle.
 * The worker is automatically terminated when the component unmounts.
 *
 * @param manifestUrl - URL to `manifest.json`
 * @param opts        - SearchClient options (modelId, workerFactory)
 */
export function useSearch(manifestUrl: string, opts: SearchClientOptions = {}): UseSearchReturn {
  const isIndexReady = ref(false)
  const isModelReady = ref(false)
  const loadingMessage = ref('Initializing…')
  const activeFallback = ref(false)
  const manifest = ref<CollectionManifest | null>(null)
  const results = ref<SearchResult[]>([])

  const client = new SearchClient(manifestUrl, opts)

  // Sync client state into reactive refs
  client.on('progress', (msg) => { loadingMessage.value = msg.message })
  client.on('index_ready', () => { isIndexReady.value = true })
  client.on('ready', (msg) => { isModelReady.value = true; manifest.value = msg.config })
  client.on('results', (msg) => { activeFallback.value = msg.fallback ?? false; results.value = msg.data })
  client.on('error', (msg) => { isIndexReady.value = true; loadingMessage.value = `Error: ${msg.message}` })

  onUnmounted(() => client.destroy())

  function on<T extends WorkerOutboundMessage['type']>(
    type: T,
    handler: (msg: Extract<WorkerOutboundMessage, { type: T }>) => void,
  ): () => void {
    const off = client.on(type, handler)
    onUnmounted(off)
    return off
  }

  return {
    isIndexReady,
    isModelReady,
    loadingMessage,
    activeFallback,
    manifest,
    results,
    search: (text, opts2) => client.search(text, opts2),
    getRecent: (limit) => client.getRecent(limit),
    on,
    client,
  }
}
