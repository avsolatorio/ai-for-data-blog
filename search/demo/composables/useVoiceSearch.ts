/**
 * useVoiceSearch.ts
 *
 * Vue composable wrapping the Web Speech API's SpeechRecognition interface.
 * Falls back gracefully on platforms that do not support speech recognition.
 */

import { ref } from 'vue'
import type { Ref } from 'vue'

export interface UseVoiceSearchReturn {
  isListening: Ref<boolean>
  transcript: Ref<string>
  supported: Ref<boolean>
  start(): void
  stop(): void
}

export function useVoiceSearch(): UseVoiceSearchReturn {
  const isListening = ref(false)
  const transcript = ref('')
  const supported = ref(
    typeof window !== 'undefined' &&
      ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window),
  )

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let recognition: any = null

  function start(): void {
    if (!supported.value) return
    const SpeechRecognitionApi =
      (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition
    recognition = new SpeechRecognitionApi()
    recognition!.lang = 'en-US'
    recognition!.interimResults = false
    recognition!.maxAlternatives = 1

    recognition!.onstart = () => {
      isListening.value = true
    }
    recognition!.onend = () => {
      isListening.value = false
    }
    recognition!.onerror = () => {
      isListening.value = false
    }
    recognition!.onresult = (e: any) => {
      transcript.value = e.results[0][0].transcript
    }

    recognition!.start()
  }

  function stop(): void {
    recognition?.stop()
    isListening.value = false
  }

  return { isListening, transcript, supported, start, stop }
}
