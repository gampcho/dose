export function speakVietnamese(text: string): boolean {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return false

  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = "vi-VN"
  utterance.rate = 0.92
  utterance.pitch = 1
  utterance.volume = 1

  const voice = pickVietnameseVoice(window.speechSynthesis.getVoices())
  if (voice) utterance.voice = voice

  window.speechSynthesis.cancel()
  window.speechSynthesis.speak(utterance)
  return true
}

function pickVietnameseVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | undefined {
  return voices.find((voice) => voice.lang.toLowerCase().startsWith("vi"))
    ?? voices.find((voice) => /viet|việt|vietnam/i.test(voice.name))
}
