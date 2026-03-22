import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  {
    path: '',
    renderMode: RenderMode.Server,
  },
  {
    path: 'landing',
    renderMode: RenderMode.Server,
  },
  {
    path: 'login',
    renderMode: RenderMode.Server,
  },
  {
    path: 'register',
    renderMode: RenderMode.Server,
  },
  {
    path: 'leaderboard',
    renderMode: RenderMode.Server,
  },
  {
    path: 'app',
    renderMode: RenderMode.Server,
  },
  {
    path: 'data',
    renderMode: RenderMode.Server,
  },
  {
    path: 'analysis',
    renderMode: RenderMode.Server,
  },
  {
    path: '**',
    renderMode: RenderMode.Client,
  },
];
