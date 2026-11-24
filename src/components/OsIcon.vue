<script setup>
defineProps({
  os: { type: String, required: true },
  size: { type: Number, default: 18 },
})
</script>

<template>
  <span class="os-ico" :class="'os-ico--' + os" :title="os" :style="{ width: size + 'px', height: size + 'px' }">
    <!-- Windows -->
    <svg v-if="os === 'windows'" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M1 4.5 10.2 3.2v8.2H1zm11.1-1.5L23 1.5v9.9H12.1zM1 13.1h9.2v8.3L1 20.1zm11.1.1H23V22.5L12.1 21z" />
    </svg>
    <!-- macOS -->
    <svg v-else-if="os === 'macos'" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M16.7 12.3c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.2-2.8.9-3.5.9s-1.8-.8-3-.8c-1.5 0-3 .9-3.7 2.3-1.6 2.8-.4 6.9 1.1 9.2.8 1.1 1.7 2.3 2.9 2.3 1.1 0 1.6-.7 3-.7s1.8.7 3 .7 2-.1 2.9-2.3c1.1-1.5 1.5-3 1.5-3.1-.1 0-2.8-1.1-2.8-4.2zM14.8 5.6c.6-.8 1.1-1.8.9-2.9-1 .1-2.1.7-2.7 1.5-.6.7-1.1 1.8-.9 2.8 1.1.1 2.1-.6 2.7-1.4z"
      />
    </svg>
    <!-- Linux / Tux -->
    <svg v-else viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 2.5c-1.7 0-3 1.6-3 3.4 0 1.1.4 2.1 1.1 2.8L8.4 12.4C7.4 14 6.8 15.2 6.8 17c0 2.6 2.3 4.5 5.2 4.5h.1c2.9 0 5.2-1.9 5.2-4.5 0-1.8-.6-3-1.6-4.6l-1.7-3.7c.7-.7 1.1-1.7 1.1-2.8 0-1.8-1.3-3.4-3-3.4z"
      />
      <circle cx="10.3" cy="6.8" r=".85" fill="#0a0a0a" />
      <circle cx="13.7" cy="6.8" r=".85" fill="#0a0a0a" />
      <path fill="#0a0a0a" d="M10.6 9.1c.4.5 1 .8 1.4.8s1-.3 1.4-.8" />
    </svg>
  </span>
</template>
