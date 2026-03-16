<script setup lang="ts">
interface Props {
  visible: boolean
  message?: string
  /** true = index ready but model still loading (BM25 fallback active) */
  modelLoading?: boolean
}
withDefaults(defineProps<Props>(), {
  message: 'Initializing…',
  modelLoading: false,
})
</script>

<template>
  <div v-if="visible" class="full-page-loading">
    <div class="d-flex flex-column align-center ga-4">
      <v-progress-circular indeterminate color="primary" size="48" />
      <span class="text-body-2 text-medium-emphasis">{{ message }}</span>
    </div>
  </div>
  <!-- Non-blocking banner shown when BM25 fallback is active -->
  <v-banner
    v-else-if="modelLoading"
    color="info"
    icon="mdi-information-outline"
    class="mb-2"
    density="compact"
  >
    <v-banner-text>
      Lexical search active — loading semantic model…
    </v-banner-text>
  </v-banner>
</template>
