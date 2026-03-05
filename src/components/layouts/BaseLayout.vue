<script setup lang="ts">
  import Toast from 'primevue/toast';
</script>

<template>
  <div class="min-h-screen bg-slate-50">
    <header class="border-b border-slate-200 bg-white shadow-sm">
      <div class="mx-auto flex max-w-7xl items-center gap-3 px-6 py-4">
        <div class="flex items-center gap-2">
          <i class="pi pi-search text-2xl text-primary-600" />
          <h1 class="text-xl font-bold text-slate-800">OpenSearch Tool</h1>
        </div>
        <span class="text-sm text-slate-400">Busca de logs inteligente</span>
      </div>
    </header>

    <main class="mx-auto max-w-7xl px-6 py-6">
      <slot />
    </main>

    <Toast position="top-right" />
  </div>
</template>
