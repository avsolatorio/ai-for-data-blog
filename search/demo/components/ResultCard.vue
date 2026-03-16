<script setup lang="ts">
import type { SearchResult, GeographicCoverage } from '../../src/types/search'
import { formatGeo } from '../utils/format'

interface Props {
  result: SearchResult
  active?: boolean
  index?: number
}
interface Emits {
  (e: 'select', result: SearchResult): void
}

withDefaults(defineProps<Props>(), { active: false, index: 0 })
const emit = defineEmits<Emits>()

const icons: Record<string, { name: string }> = {
  document: { name: 'mdi-file-document-outline' },
  indicator: { name: 'mdi-chart-line' },
  microdata: { name: 'mdi-database-outline' },
  geospatial: { name: 'mdi-map-outline' },
}

function geoItems(geo: GeographicCoverage[] | undefined): string[] {
  if (!geo) return []
  return geo.map(formatGeo).filter(Boolean)
}
</script>

<template>
  <v-card
    flat
    class="card-result relative"
    :class="{ active, 'mt-3': index !== 0 }"
    :link="false"
    @click="emit('select', result)"
  >
    <!-- Type indicator -->
    <div class="d-flex align-center mb-1 type-info">
      <v-icon size="15" class="mr-1" :icon="icons[result.type ?? 'document']?.name ?? 'mdi-dots-horizontal'" />
      <span class="text-xs text-capitalize">{{ result.type }}</span>
      <span v-if="result.type_extra" class="text-xs text-capitalize ml-1">[{{ result.type_extra }}]</span>
    </div>

    <!-- Title -->
    <v-card-title class="text-wrap pa-0 mb-1" style="font-size: 0.9rem; line-height: 1.4">
      {{ result.title }}
    </v-card-title>

    <!-- Subtitle -->
    <v-card-subtitle v-if="result.sub_title" class="pa-0 mb-2">
      {{ result.sub_title }}
    </v-card-subtitle>

    <!-- Abstract snippet -->
    <v-card-text v-if="result.text" class="pa-0 mb-2 text-body-2">
      {{ result.text }}
    </v-card-text>

    <!-- Categories (geo, time, source) -->
    <div class="categories d-flex flex-wrap align-center">
      <!-- Geographic coverage -->
      <template v-if="geoItems(result.geographic_coverage as any).length">
        <div v-if="geoItems(result.geographic_coverage as any).length === 1" class="category-item d-flex align-center">
          <v-icon size="14" class="mr-1">mdi-map-marker-outline</v-icon>
          {{ geoItems(result.geographic_coverage as any)[0] }}
        </div>
        <v-menu v-else open-on-hover>
          <template #activator="{ props: menuProps }">
            <div v-bind="menuProps" class="category-item d-flex align-center cursor-pointer">
              <v-icon size="14" class="mr-1">mdi-map-marker-outline</v-icon>
              {{ geoItems(result.geographic_coverage as any).length }} countries
            </div>
          </template>
          <v-list density="compact" max-height="200">
            <v-list-item v-for="g in geoItems(result.geographic_coverage as any)" :key="g" :title="g" />
          </v-list>
        </v-menu>
      </template>

      <!-- Time coverage -->
      <div v-if="result.time_coverage" class="category-item d-flex align-center">
        <v-icon size="14" class="mr-1">mdi-calendar-outline</v-icon>
        {{ result.time_coverage }}
      </div>

      <!-- Source (first item only) -->
      <div v-if="result.source?.length" class="category-item d-flex align-center">
        <v-icon size="14" class="mr-1">mdi-office-building-outline</v-icon>
        {{ Array.isArray(result.source) ? result.source[0] : result.source }}
      </div>
    </div>
  </v-card>
</template>
