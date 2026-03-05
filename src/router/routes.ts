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
];
