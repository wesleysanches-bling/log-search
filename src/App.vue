<script setup lang="ts">
  import { onMounted } from 'vue';
  import { VueQueryDevtools } from '@tanstack/vue-query-devtools';
  import BaseLayout from '@/components/layouts/BaseLayout.vue';
  import { useSavedFiltersStore } from '@/stores/saved-filters-store';

  const savedFiltersStore = useSavedFiltersStore();

  onMounted(() => {
    savedFiltersStore.loadFromDisk();
  });
</script>

<template>
  <BaseLayout>
    <RouterView />
  </BaseLayout>

  <VueQueryDevtools />
</template>
