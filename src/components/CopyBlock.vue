<script setup>
import { ref } from 'vue'

const props = defineProps({
  label: { type: String, default: 'Perintah' },
  text: { type: String, required: true },
})

const copied = ref(false)
let timer = 0

async function copy() {
  const value = String(props.text || '').replace(/\n$/, '')
  try {
    await navigator.clipboard.writeText(value)
  } catch {
    const ta = document.createElement('textarea')
    ta.value = value
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.left = '-9999px'
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    ta.remove()
  }
  copied.value = true
  window.clearTimeout(timer)
  timer = window.setTimeout(() => {
    copied.value = false
  }, 1600)
}
</script>

<template>
  <div class="copy-block">
    <div class="copy-block__bar">
      <span>{{ label }}</span>
      <button class="btn btn--sm btn--yellow" type="button" @click="copy">
        {{ copied ? 'Tersalin' : 'Salin' }}
      </button>
    </div>
    <pre><code>{{ text }}</code></pre>
  </div>
</template>
