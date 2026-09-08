import { http, HttpResponse } from 'msw';

export const handlers = [
  http.get('/api/auth/context', () => {
    return HttpResponse.json({
      userId: 'test-user-id',
      projectId: 'test-project-id',
      email: 'test@example.com',
      fullName: 'Test User',
      roles: ['admin'],
    });
  }),

  http.get('/api/data-marts', () => {
    return HttpResponse.json({
      items: [
        { id: 'dm-1', title: 'Test Data Mart 1', status: 'active' },
        { id: 'dm-2', title: 'Test Data Mart 2', status: 'draft' },
      ],
      total: 2,
    });
  }),

  http.get('/api/connectors', () => {
    return HttpResponse.json([{ name: 'google-analytics', displayName: 'Google Analytics' }]);
  }),

  http.get('/api/data-storages', () => {
    return HttpResponse.json([]);
  }),

  http.get('/api/data-destinations', () => {
    return HttpResponse.json([]);
  }),

  http.get('/api/plugins/gallery', () => {
    return HttpResponse.json({ items: [], total: 0 });
  }),

  http.get('/api/search', () => {
    return HttpResponse.json({ results: [], total: 0 });
  }),
];
