<script setup lang="ts">
  import { useRoute } from 'vue-router';
  import Toast from 'primevue/toast';
  import Badge from 'primevue/badge';

  import { useSavedFiltersStore } from '@/stores/saved-filters-store';

  const route = useRoute();
  const savedFiltersStore = useSavedFiltersStore();
</script>

<template>
  <div class="min-h-screen bg-slate-50">
    <header class="border-b border-slate-200 bg-white shadow-sm">
      <div class="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <div class="flex items-center gap-3">
          <RouterLink to="/" class="flex items-center gap-2 transition-opacity hover:opacity-80">
            <i class="pi pi-search text-2xl text-primary-600" />
            <h1 class="text-xl font-bold text-slate-800">OpenSearch Tool</h1>
          </RouterLink>
          <span class="hidden text-sm text-slate-400 sm:inline">Busca de logs inteligente</span>
        </div>

        <nav class="flex items-center gap-1">
          <RouterLink
            to="/"
            class="flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors"
            :class="
              route.name === 'home'
                ? 'bg-primary-50 text-primary-700'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'
            "
          >
            <i class="pi pi-search text-xs" />
            Buscar
          </RouterLink>

          <RouterLink
            to="/filtros-salvos"
            class="flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors"
            :class="
              route.name === 'saved-filters'
                ? 'bg-primary-50 text-primary-700'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'
            "
          >
            <i class="pi pi-bookmark text-xs" />
            Filtros Salvos
            <Badge
              v-if="savedFiltersStore.count > 0"
              :value="savedFiltersStore.count"
              severity="secondary"
            />
          </RouterLink>
        </nav>
      </div>
    </header>

    <main class="mx-auto max-w-7xl px-6 py-6">
      <slot />
    </main>

    <Toast position="top-right" />
  </div>
</template>
