<script setup lang="ts">
const props = defineProps<{
  jenis: Kebutuhan
  aktif: boolean
  jumlah: number
}>()

const emit = defineEmits<{ ubah: [Kebutuhan] }>()
</script>

<template>
  <button
    type="button"
    :aria-pressed="props.aktif"
    class="flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-3 text-[13px] font-medium transition-colors sm:px-4 sm:text-sm"
    :class="props.aktif
      ? 'border-brand bg-brand text-white'
      : 'border-gray-300 bg-white text-gray-800 hover:border-gray-500'"
    @click="emit('ubah', props.jenis)"
  >
    <IkonAksesibilitas :jenis="props.jenis" class="h-5 w-5" />
    <span>{{ LABEL_KEBUTUHAN[props.jenis] }}</span>
    <span
      class="tabular-nums text-xs"
      :class="props.aktif ? 'text-white/80' : 'text-gray-500'"
    >{{ props.jumlah }}</span>
  </button>
</template>
