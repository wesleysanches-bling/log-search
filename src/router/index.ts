import { createRouter, createWebHistory } from 'vue-router';
import { routes } from './routes';

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
});

router.beforeEach((to, _from, next) => {
  const title = (to.meta?.title as string) || 'OpenSearch Tool';
  document.title = title;
  next();
});

export default router;
