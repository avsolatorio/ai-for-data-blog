<script setup lang="ts">
import { ref, computed } from 'vue'
import { useSearchWorker } from './composables/useSearchWorker'
import SearchBar from './components/SearchBar.vue'
import ResultList from './components/ResultList.vue'
import DetailPane from './components/DetailPane.vue'
import SearchStatus from './components/SearchStatus.vue'
import type { SearchResult } from '../src/types/search'

// ── Configuration from URL params ──────────────────────────────────────────
const params = new URLSearchParams(window.location.search)
// Base path for GitHub Pages (e.g. /ai-for-data-blog); empty when served from repo root
const basePathMatch = typeof location !== 'undefined' && location.pathname.match(/^\/([^/]+)\/search\//)
const basePath = basePathMatch ? '/' + basePathMatch[1] : ''
const manifestParam = params.get('manifest') ?? (basePath + '/data/prwp/manifest.json')
// Dev default: basePath is '' so manifest is /data/prwp/manifest.json (Vite proxy serves it)
const modelParam = params.get('model') ?? undefined

// ── Search worker ───────────────────────────────────────────────────────────
const worker = useSearchWorker(manifestParam, modelParam ? { modelId: modelParam } : {})
const { isIndexReady, isModelReady, loadingMessage, results: workerResults } = worker

// ── UI state ────────────────────────────────────────────────────────────────
const query = ref('')
const fullResults = ref<SearchResult[]>([])
const viewItem = ref<SearchResult | null>(null)
const itemMetadata = ref<Record<string, unknown> | null>(null)
const detailExpanded = ref(false)
const reranking = ref(false)
const searchMode = ref<'semantic' | 'lexical' | 'hybrid'>('hybrid')

// Simple reactive window width without @vueuse/core
const windowWidth = ref(window.innerWidth)
window.addEventListener('resize', () => { windowWidth.value = window.innerWidth })

// Show loading overlay until index is ready (BM25 phase)
const showLoadingOverlay = computed(() => !isIndexReady.value)
// Show the fallback banner once index is ready but model is still loading
const showFallbackBanner = computed(() => isIndexReady.value && !isModelReady.value)

// ── Worker event subscriptions ───────────────────────────────────────────────
worker.on('results', () => {
  fullResults.value = workerResults.value
  reranking.value = false
})

worker.on('recent', (msg) => {
  if (fullResults.value.length === 0) {
    fullResults.value = msg.data ?? []
  }
})

worker.on('ready', () => {
  if (query.value) submitSearch()
  else worker.getRecent(10)
})

worker.on('index_ready', () => {
  if (query.value) submitSearch()
  else worker.getRecent(10)
})

// ── Search actions ──────────────────────────────────────────────────────────
function submitSearch() {
  if (!query.value.trim()) return
  reranking.value = false
  fullResults.value = []
  worker.search(query.value, {
    topK: 20,
    ef: 50,
    mode: searchMode.value,
  })
}

function clearSearch() {
  query.value = ''
  fullResults.value = []
  viewItem.value = null
  itemMetadata.value = null
  worker.getRecent(10)
}

function selectResult(result: SearchResult) {
  viewItem.value = result
  itemMetadata.value = null
  // On mobile, scroll to top of detail pane
  if (windowWidth.value < 960) {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
}
</script>

<template>
  <v-app>
    <main class="v-main">
      <v-container
        fluid
        class="v-container--search"
        :class="{ 'v-container--detail-expanded': detailExpanded }"
      >
        <SearchStatus
          :visible="showLoadingOverlay"
          :message="loadingMessage"
          :model-loading="showFallbackBanner"
        />

        <template v-if="!showLoadingOverlay">
          <div class="search-content-root">
            <!-- Normal layout (mobile + non-expanded desktop) -->
            <template v-if="!detailExpanded || windowWidth < 960">
              <div class="px-4 px-md-0 mt-md-9 search-bar-wrapper">
                <SearchBar
                  v-model="query"
                  :disabled="!isIndexReady"
                  @submit="submitSearch"
                  @clear="clearSearch"
                />
                <!-- BM25 fallback banner -->
                <v-banner
                  v-if="showFallbackBanner"
                  color="info"
                  density="compact"
                  class="mt-2 rounded"
                >
                  <v-banner-text>
                    <v-icon size="16" class="mr-1">mdi-information-outline</v-icon>
                    Lexical search active — loading semantic model…
                  </v-banner-text>
                </v-banner>
              </div>

              <v-row class="d-flex ga-md-5 mx-0 search-content mt-md-2">
                <!-- Results column -->
                <v-col
                  cols="12"
                  md="4"
                  class="search-content__result px-4 px-md-0"
                  v-show="!detailExpanded || windowWidth < 960"
                >
                  <div class="d-flex flex-column search-content__result__area">
                    <ResultList
                      :results="fullResults"
                      :loading="reranking"
                      :active-id="viewItem?.idno ?? viewItem?.id"
                      @select="selectResult"
                    />
                  </div>
                </v-col>

                <!-- Detail column -->
                <v-col cols="12" md="8" class="search-content__detail pa-4 bg-secondary-100 rounded">
                  <DetailPane
                    :item="viewItem"
                    :metadata="itemMetadata"
                    :expanded="detailExpanded"
                    @toggle-expand="detailExpanded = !detailExpanded"
                    @back="viewItem = null"
                    @download="() => { /* download handled inside DetailPane */ }"
                  />
                </v-col>
              </v-row>
            </template>

            <!-- Expanded detail layout (desktop only, detail fills full width) -->
            <template v-else>
              <div class="px-4 px-md-0 mt-md-9 search-bar-wrapper">
                <SearchBar
                  v-model="query"
                  :disabled="!isIndexReady"
                  @submit="submitSearch"
                  @clear="clearSearch"
                />
              </div>

              <v-row class="d-flex mx-0 search-content mt-md-2">
                <v-col cols="12" class="search-content__detail pa-4 bg-secondary-100 rounded">
                  <DetailPane
                    :item="viewItem"
                    :metadata="itemMetadata"
                    :expanded="detailExpanded"
                    @toggle-expand="detailExpanded = !detailExpanded"
                    @back="viewItem = null; detailExpanded = false"
                    @download="() => { /* download handled inside DetailPane */ }"
                  />
                </v-col>
              </v-row>
            </template>
          </div>
        </template>
      </v-container>
    </main>
  </v-app>
</template>
