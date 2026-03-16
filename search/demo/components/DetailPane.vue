<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { SearchResult } from '../../src/types/search'
import { doiUrl } from '../utils/format'
import MetadataValue from './MetadataValue.vue'

interface Props {
  item: SearchResult | null
  metadata: Record<string, unknown> | null
  expanded?: boolean
}
interface Emits {
  (e: 'toggleExpand'): void
  (e: 'back'): void
  (e: 'download', idno: string, meta: unknown): void
}

const props = withDefaults(defineProps<Props>(), { metadata: null, expanded: false })
const emit = defineEmits<Emits>()

const activeTab = ref<'abstract' | 'view' | 'metadata'>('abstract')
const pdfLoading = ref(false)
const pdfError = ref(false)

watch(() => props.item, () => {
  activeTab.value = 'abstract'
  pdfLoading.value = false
  pdfError.value = false
})

const docUrl = computed(() => {
  if (!props.item?.url) return null
  return props.item.url
})

const isExternalPdf = computed(() => {
  if (!docUrl.value) return false
  const url = docUrl.value.toLowerCase()
  return !url.startsWith(window.location.origin)
})

const doi = computed(() => props.item?.doi ? doiUrl(String(props.item.doi)) : null)

function downloadMeta() {
  if (!props.item?.idno) return
  const blob = new Blob([JSON.stringify(props.metadata ?? props.item, null, 2)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${props.item.idno}-metadata.json`
  a.click()
  URL.revokeObjectURL(a.href)
}
</script>

<template>
  <v-card v-if="item" flat class="search-content__detail h-100 pa-4">
    <!-- Header row: back (mobile) + expand toggle -->
    <div class="d-flex align-center mb-2">
      <v-btn
        icon
        variant="text"
        size="small"
        class="d-md-none mr-1"
        aria-label="Back to results"
        @click="emit('back')"
      >
        <v-icon>mdi-arrow-left</v-icon>
      </v-btn>
      <v-spacer />
      <v-btn icon variant="text" size="small" @click="emit('toggleExpand')" class="d-none d-md-flex">
        <v-icon>{{ expanded ? 'mdi-arrow-collapse' : 'mdi-arrow-expand' }}</v-icon>
      </v-btn>
    </div>

    <!-- Document info -->
    <div class="search-content__detail__info mb-3">
      <div class="search-content__detail__info__content">
        <div v-if="item.type" class="text-caption text-capitalize text-medium-emphasis mb-1">
          {{ item.type }}
        </div>
        <div class="text-subtitle-1 font-weight-bold mb-1" style="color: var(--primary-dark)">
          {{ item.title }}
        </div>
        <div v-if="item.sub_title" class="text-body-2 text-medium-emphasis mb-1">
          {{ item.sub_title }}
        </div>
        <div v-if="item.idno" class="text-caption text-medium-emphasis mb-1">
          ID: {{ item.idno }}
        </div>
        <a v-if="doi" :href="doi" target="_blank" rel="noopener" class="doi-link text-caption">
          {{ doi }}
        </a>
      </div>
    </div>

    <!-- Action buttons -->
    <div class="d-flex ga-2 mb-3 flex-wrap">
      <v-btn
        v-if="docUrl"
        :href="docUrl"
        target="_blank"
        rel="noopener"
        size="small"
        prepend-icon="mdi-open-in-new"
        variant="outlined"
      >Open</v-btn>
      <v-btn
        size="small"
        prepend-icon="mdi-download-outline"
        variant="outlined"
        @click="downloadMeta"
      >Metadata</v-btn>
    </div>

    <!-- Tabs -->
    <v-tabs v-model="activeTab" density="compact" class="mb-3">
      <v-tab value="abstract">Abstract</v-tab>
      <v-tab v-if="docUrl" value="view">View</v-tab>
      <v-tab v-if="metadata" value="metadata">Metadata</v-tab>
    </v-tabs>

    <v-tabs-window v-model="activeTab">
      <!-- Abstract tab -->
      <v-tabs-window-item value="abstract">
        <div class="search-content__detail__description">
          <p v-if="item.abstract || item.text" class="text-body-2" style="line-height: 1.6">
            {{ item.abstract ?? item.text }}
          </p>
          <p v-else class="text-medium-emphasis text-body-2">No abstract available.</p>
        </div>
      </v-tabs-window-item>

      <!-- View (PDF) tab -->
      <v-tabs-window-item v-if="docUrl" value="view">
        <div class="pdf-viewer-wrap" :class="{ 'pdf-viewer-external': isExternalPdf }">
          <template v-if="isExternalPdf">
            <div class="pdf-viewer-external-card">
              <p class="pdf-viewer-external-msg">
                This document is hosted externally and cannot be embedded here.
              </p>
              <v-btn :href="docUrl" target="_blank" size="small" prepend-icon="mdi-open-in-new" class="mt-3">
                Open document
              </v-btn>
            </div>
          </template>
          <template v-else>
            <v-progress-linear v-if="pdfLoading" indeterminate color="primary" class="mb-2" />
            <iframe
              :src="docUrl"
              style="flex:1; border: none; min-height: 400px"
              @load="pdfLoading = false"
              @error="pdfError = true; pdfLoading = false"
            />
            <p v-if="pdfError" class="text-caption text-error mt-1">Failed to load document.</p>
          </template>
        </div>
      </v-tabs-window-item>

      <!-- Metadata tab -->
      <v-tabs-window-item v-if="metadata" value="metadata">
        <div class="metadata-document">
          <MetadataValue :value="metadata" />
        </div>
      </v-tabs-window-item>
    </v-tabs-window>
  </v-card>

  <!-- Empty state -->
  <div v-else class="d-flex align-center justify-center h-100 text-medium-emphasis">
    <div class="text-center">
      <v-icon size="64" class="mb-3 opacity-30">mdi-file-search-outline</v-icon>
      <p>Select a result to view details</p>
    </div>
  </div>
</template>
