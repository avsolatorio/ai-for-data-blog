<script setup lang="ts">
import { computed } from 'vue'
import { formatMetadataKey, isPlainObject, isNonEmptyArray } from '../utils/format'

interface Props {
  value: unknown
  keyName?: string
  depth?: number
}

const props = withDefaults(defineProps<Props>(), { depth: 0 })

const isObj = computed(() => isPlainObject(props.value))
const isArr = computed(() => isNonEmptyArray(props.value))
</script>

<template>
  <!-- Object: render key-value pairs recursively -->
  <dl v-if="isObj" class="metadata-document__nested">
    <template v-for="(v, k) in (value as Record<string, unknown>)" :key="String(k)">
      <dt>{{ formatMetadataKey(String(k)) }}</dt>
      <dd><MetadataValue :value="v" :depth="depth + 1" /></dd>
    </template>
  </dl>

  <!-- Array: render each item -->
  <ul v-else-if="isArr" class="metadata-document__nested pl-0" style="list-style: none">
    <li v-for="(item, i) in (value as unknown[])" :key="i">
      <MetadataValue :value="item" :depth="depth + 1" />
    </li>
  </ul>

  <!-- Scalar -->
  <span v-else class="metadata-document__value">{{ value ?? '—' }}</span>
</template>
