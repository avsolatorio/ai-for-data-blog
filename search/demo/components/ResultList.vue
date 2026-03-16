<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import type { SearchResult } from '../../src/types/search'
import ResultCard from './ResultCard.vue'

interface Props {
  results: SearchResult[]
  loading?: boolean
  activeId?: string | number | null
  batchSize?: number
}
interface Emits {
  (e: 'select', result: SearchResult): void
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  activeId: null,
  batchSize: 10,
})
const emit = defineEmits<Emits>()

const displayCount = ref(props.batchSize)

// Reset display count when results change
watch(() => props.results, () => { displayCount.value = props.batchSize })

const displayed = computed(() => props.results.slice(0, displayCount.value))

function loadMore(opts: { done: (status: 'ok' | 'empty') => void }) {
  if (displayCount.value >= props.results.length) {
    opts.done('empty')
    return
  }
  displayCount.value = Math.min(displayCount.value + props.batchSize, props.results.length)
  opts.done('ok')
}

function isActive(result: SearchResult): boolean {
  if (props.activeId == null) return false
  return String(result.idno ?? result.id) === String(props.activeId)
}
</script>

<template>
  <!-- Skeleton loading state -->
  <template v-if="loading">
    <v-skeleton-loader
      v-for="n in 3"
      :key="n"
      class="w-100 border mb-4"
      type="list-item-two-line, list-item-three-line"
    />
  </template>

  <!-- Results -->
  <div v-else-if="results.length > 0" class="scroll-area">
    <v-infinite-scroll
      :items="displayed"
      @load="loadMore"
      class="scroll-panel"
      color="primary"
    >
      <ResultCard
        v-for="(result, idx) in displayed"
        :key="String(result.idno ?? result.id)"
        :result="result"
        :index="idx"
        :active="isActive(result)"
        @select="emit('select', result)"
      />
    </v-infinite-scroll>
  </div>

  <!-- Empty state -->
  <div v-else class="text-center text-medium-emphasis py-8">
    <v-icon size="48" class="mb-2">mdi-magnify-remove-outline</v-icon>
    <p>No results found.</p>
  </div>
</template>
