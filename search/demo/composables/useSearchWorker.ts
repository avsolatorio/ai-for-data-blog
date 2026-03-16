/**
 * useSearchWorker.ts
 *
 * Vue composable — thin re-export of the Vue adapter from adapters/vue.ts.
 * Kept for backward compat with internal component imports.
 */
export { useSearch as useSearchWorker } from '../../adapters/vue'
export type { UseSearchReturn as UseSearchWorkerReturn } from '../../adapters/vue'
