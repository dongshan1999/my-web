import { createRouter, createWebHashHistory } from 'vue-router'

// hash 路由：URL 形如 /#/docs/xxx，GitHub Pages 上刷新深链接不会 404
const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('../pages/HomePage.vue'),
    },
    {
      path: '/works',
      name: 'works',
      component: () => import('../pages/WorksPage.vue'),
    },
    {
      path: '/works/:slug',
      name: 'work-detail',
      component: () => import('../pages/WorkDetailPage.vue'),
    },
    {
      path: '/docs',
      name: 'docs',
      component: () => import('../pages/DocsPage.vue'),
    },
    {
      path: '/docs/:slug',
      name: 'doc-detail',
      component: () => import('../pages/DocDetailPage.vue'),
    },
    {
      path: '/games/jump',
      name: 'game-jump',
      component: () => import('../pages/games/JumpPage.vue'),
    },
    {
      path: '/games/racer',
      name: 'game-racer',
      component: () => import('../pages/games/RacerPage.vue'),
    },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
  scrollBehavior(_to, _from, savedPosition) {
    return savedPosition ?? { top: 0 }
  },
})

export default router
