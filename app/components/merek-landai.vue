<script setup lang="ts">
// Kunci merek: tanda dan tulisan selalu satu kesatuan.
import { NuxtLink } from '#components'

withDefaults(defineProps<{
  ukuran?: number
  tagline?: boolean
  ke?: string | null
  tulisan?: string
}>(), { ukuran: 26, tagline: false, ke: null, tulisan: 'text-lg' })
</script>

<template>
  <component
    :is="ke ? NuxtLink : 'div'"
    :to="ke ?? undefined"
    class="flex shrink-0 items-center gap-2"
    :class="ke ? '-my-2.5 py-2.5' : ''"
  >
    <TandaLandai :ukuran="ukuran" />
    <span class="block leading-none">
      <span class="block font-bold leading-none text-brand" :class="tulisan">landai</span>
      <span
        v-if="tagline"
        class="mt-1 hidden text-[11px] leading-none text-gray-500 sm:block"
      >Peta aksesibilitas difabel</span>
    </span>
  </component>
</template>
