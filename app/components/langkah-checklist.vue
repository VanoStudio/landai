<script setup lang="ts">
const isi = defineModel<IsiChecklist>({ required: true })

const skor = computed(() => pratinjauSkor(isi.value))
const jumlahAda = computed(() => ITEM_CHECKLIST.filter(i => isi.value[i.kunci]).length)
</script>

<template>
  <div>
    <div class="flex items-end justify-between gap-4 border-b border-gray-200 pb-4">
      <div>
        <p class="text-sm text-gray-600">Skor sementara</p>
        <p class="mt-1 flex items-baseline gap-1 leading-none">
          <span class="text-5xl font-bold tabular-nums" :style="{ color: warnaSkor(skor) }">{{ skor }}</span>
          <span class="text-sm text-gray-500">/100</span>
        </p>
      </div>
      <p class="pb-1 text-sm text-gray-600 tabular-nums">{{ jumlahAda }} dari 8 terpenuhi</p>
    </div>

    <ul class="divide-y divide-gray-200">
      <li v-for="item in ITEM_CHECKLIST" :key="item.kunci">
        <label class="flex cursor-pointer items-start gap-3 py-3.5">
          <input
            v-model="isi[item.kunci]" type="checkbox"
            class="mt-0.5 h-5 w-5 shrink-0 accent-[#0F6E56]"
          >
          <span class="min-w-0">
            <span class="block text-sm font-medium">{{ item.label }}</span>
            <span class="mt-0.5 block text-sm text-gray-600">{{ item.bantuan }}</span>
          </span>
        </label>
      </li>
    </ul>
  </div>
</template>
