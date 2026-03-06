import type { RouteRecordRaw } from 'vue-router';
import { ROUTES, PATHS } from '@/constants/routes';

export const routes: RouteRecordRaw[] = [
  {
    path: PATHS.HOME,
    name: ROUTES.HOME,
    component: () => import('@/views/HomeView.vue'),
    meta: {
      title: 'OpenSearch Tool - Busca de Logs',
    },
  },
  {
    path: PATHS.SAVED_FILTERS,
    name: ROUTES.SAVED_FILTERS,
    component: () => import('@/views/SavedFiltersView.vue'),
    meta: {
      title: 'OpenSearch Tool - Filtros Salvos',
    },
  },
  {
    path: PATHS.LIBRARIES,
    name: ROUTES.LIBRARIES,
    component: () => import('@/views/LibrariesView.vue'),
    meta: {
      title: 'OpenSearch Tool - Biblioteca',
    },
  },
];
