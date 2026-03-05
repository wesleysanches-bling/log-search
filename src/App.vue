<script setup lang="ts">
  import { VueQueryDevtools } from '@tanstack/vue-query-devtools';
  import BaseLayout from '@/components/layouts/BaseLayout.vue';
</script>

<template>
  <BaseLayout>
    <RouterView />
  </BaseLayout>

  <VueQueryDevtools />
</template>
