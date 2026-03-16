<script setup lang="ts">
import { ref, watch } from 'vue'
import { useVoiceSearch } from '../composables/useVoiceSearch'

interface Props {
  modelValue: string
  disabled?: boolean
}
interface Emits {
  (e: 'update:modelValue', val: string): void
  (e: 'submit', query: string): void
  (e: 'clear'): void
}

const props = withDefaults(defineProps<Props>(), { disabled: false })
const emit = defineEmits<Emits>()

const isActive = ref(false)
const growWrap = ref<HTMLElement | null>(null)
const voice = useVoiceSearch()

// When voice transcript changes, populate the query
watch(voice.transcript, (t) => {
  if (t) emit('update:modelValue', t)
})

function handleKeyDown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    if (props.modelValue.trim()) emit('submit', props.modelValue)
  }
}

function updateReplicatedValue(e: Event) {
  const textarea = e.target as HTMLTextAreaElement
  if (growWrap.value) {
    growWrap.value.dataset.replicatedValue = textarea.value
  }
}

function clearSearch() {
  emit('update:modelValue', '')
  emit('clear')
}
</script>

<template>
  <div
    class="position-relative search-bar-area search-bar"
    @click="isActive = true"
    v-click-outside="() => (isActive = false)"
  >
    <div class="custom-search-bar-filter">
      <div class="custom-search-bar-filter__content">
        <div
          class="grow-wrap"
          ref="growWrap"
          :class="{ active: isActive }"
        >
          <textarea
            :value="modelValue"
            @input="(e) => { emit('update:modelValue', (e.target as HTMLTextAreaElement).value); updateReplicatedValue(e) }"
            name="text"
            :maxlength="5000"
            rows="1"
            placeholder="What are you looking for?"
            :disabled="disabled"
            @keydown="handleKeyDown"
          />
        </div>
      </div>
      <div class="custom-search-bar-filter__append">
        <div class="right-icons-container">
          <!-- Voice icon when query is empty -->
          <div
            v-if="(!modelValue && !voice.isListening.value) || voice.isListening.value"
            class="w-[30px] h-[30px] custom-search-bar-filter__icon d-flex justify-center align-center"
          >
            <v-icon
              class="cursor-pointer search-buttons"
              size="24"
              :color="voice.isListening.value ? 'error' : undefined"
              @click="voice.isListening.value ? voice.stop() : voice.start()"
              :aria-label="voice.isListening.value ? 'Stop voice input' : 'Start voice input'"
            >
              {{ voice.isListening.value ? 'mdi-microphone' : 'mdi-microphone-outline' }}
            </v-icon>
          </div>
          <!-- Clear + submit when query is present -->
          <div v-else class="d-flex right-icons-container__append">
            <v-icon
              class="v-icon--clickable v-btn--close custom-search-bar-filter__icon cursor-pointer"
              size="24"
              aria-label="Clear"
              @click="clearSearch"
            >mdi-close-circle-outline</v-icon>
            <v-btn
              aria-label="Search"
              class="h-[30px]"
              size="small"
              :disabled="disabled"
              @click="emit('submit', modelValue)"
            >
              <v-icon>mdi-arrow-right</v-icon>
            </v-btn>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
