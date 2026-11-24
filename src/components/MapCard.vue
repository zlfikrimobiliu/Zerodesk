<script setup>
import { computed, watch, ref } from 'vue'
import { gmapsLink } from '../utils/format'
import { openExternal } from '../utils/openExternal'

const props = defineProps({
  lat: { type: [Number, String], required: true },
  lng: { type: [Number, String], required: true },
  zoom: { type: Number, default: 16 },
})

const z = ref(props.zoom)
const tileHost = ref(0)

watch(
  () => [props.lat, props.lng, props.zoom],
  () => {
    z.value = props.zoom
    tileHost.value = 0
  },
)

watch(z, () => {
  tileHost.value = 0
})

const href = computed(() => gmapsLink(props.lat, props.lng, z.value))

function lon2tile(lon, zoom) {
  return Math.floor(((Number(lon) + 180) / 360) * 2 ** zoom)
}

function lat2tile(lat, zoom) {
  const rad = (Number(lat) * Math.PI) / 180
  return Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * 2 ** zoom)
}

const preview = computed(() => {
  const zoom = Math.min(18, Math.max(4, z.value))
  const x = lon2tile(props.lng, zoom)
  const y = lat2tile(props.lat, zoom)
  const hosts = [
    `https://basemaps.cartocdn.com/rastertiles/voyager/${zoom}/${x}/${y}.png`,
    `https://tile.openstreetmap.org/${zoom}/${x}/${y}.png`,
  ]
  return hosts[Math.min(tileHost.value, hosts.length - 1)]
})

const embed = computed(() => {
  const lat = Number(props.lat)
  const lng = Number(props.lng)
  const zoom = Math.min(18, Math.max(4, z.value))
  const pad = 0.02 * 2 ** (14 - zoom)
  const bbox = `${lng - pad},${lat - pad},${lng + pad},${lat + pad}`
  return `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${lat},${lng}`
})

const useEmbed = computed(() => tileHost.value >= 2)

function clamp(n) {
  return Math.min(18, Math.max(4, n))
}

function zoomBy(delta, event) {
  event?.stopPropagation()
  event?.preventDefault()
  z.value = clamp(z.value + delta)
}

function onTileError() {
  if (tileHost.value < 2) tileHost.value += 1
}

async function openMaps() {
  await openExternal(href.value)
}
</script>

<template>
  <div class="gmap">
    <div class="gmap__stage">
      <iframe
        v-if="useEmbed"
        class="gmap__embed"
        :src="embed"
        title="Peta lokasi"
        loading="lazy"
        referrerpolicy="no-referrer-when-downgrade"
      ></iframe>
      <img
        v-else
        class="gmap__img"
        :src="preview"
        alt=""
        draggable="false"
        @error="onTileError"
      />
      <i v-if="!useEmbed" class="gmap__pin" aria-hidden="true"></i>
      <button class="gmap__hit" type="button" aria-label="Buka Google Maps" @click="openMaps"></button>
      <div class="gmap__zoom">
        <button type="button" aria-label="Perbesar" @click="zoomBy(1, $event)">+</button>
        <button type="button" aria-label="Perkecil" @click="zoomBy(-1, $event)">−</button>
      </div>
    </div>
    <button class="map-link" type="button" @click="openMaps">Buka di Google Maps</button>
  </div>
</template>
