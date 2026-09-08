import { http, HttpResponse } from 'msw';

export const handlers = [
  // 多个页面（技能、执行器等）会无条件拉取执行器列表；全局兜底为空列表，
  // 避免个别用例未 mock 时请求落入 unhandled → 拦截器 401 处理清空 auth store。
  http.get('/api/executors', () => {
    return HttpResponse.json({
      success: true,
      code: '0',
      message: '',
      data: [],
      traceId: null,
    });
  }),
  http.get('/api/executor-model-catalogs/qoder', () => HttpResponse.json({
    success: true,
    code: '0',
    message: '',
    data: { provider: 'qoder', models: [], lastSuccessfulAt: null },
    traceId: null,
  })),
  http.get('/api/executor-model-catalogs/qodercn', () => HttpResponse.json({
    success: true,
    code: '0',
    message: '',
    data: { provider: 'qodercn', models: [], lastSuccessfulAt: null },
    traceId: null,
  })),
  http.get('/api/capabilities/scheduled-task', () => {
    return HttpResponse.json({
      success: true,
      code: '0',
      message: '',
      data: {
        available: true,
        mode: 'V037_READY',
        clusterReady: true,
        reason: null,
      },
      traceId: 'trace-scheduled-task-capability',
    });
  }),
  http.get('/api/platform/branding/public', () => {
    return HttpResponse.json({
      success: true,
      code: '0',
      message: '',
      data: {
        platformName: 'AutoWonder',
        logoUrl: '/logo.png',
        themeKey: 'aliyun-orange',
        primaryColor: '#f97316',
        domain: 'https://community.example',
        mcpBaseUrl: 'https://community.example/api/mcp',
        recommendedRuntimeVersion: '0.2.125',
        deploymentVersion: 'x.x.x',
        communityEdition: false,
        canManage: false,
      },
      traceId: 'trace-branding',
    });
  }),
  http.get('/api/platform/branding', () => {
    return HttpResponse.json({
      success: true,
      code: '0',
      message: '',
      data: {
        platformName: 'AutoWonder',
        logoUrl: '/logo.png',
        themeKey: 'aliyun-orange',
        primaryColor: '#f97316',
        domain: 'https://community.example',
        mcpBaseUrl: 'https://community.example/api/mcp',
        communityEdition: false,
        canManage: false,
      },
      traceId: 'trace-branding-admin',
    });
  }),
  http.get('/api/platform/branding/capability', () => {
    return HttpResponse.json({
      success: true,
      code: '0',
      message: '',
      data: { canManage: false },
      traceId: 'trace-branding-capability',
    });
  }),
  http.get('/api/agents/reviews/count', () => HttpResponse.json({
    success: true, code: '0', message: '', data: 0, traceId: 'trace-agent-review-count',
  })),
  http.get('/api/memories/reviews/count', () => HttpResponse.json({
    success: true, code: '0', message: '', data: 0, traceId: 'trace-memory-review-count',
  })),
  // 品牌配置页的「平台管理员」Tab 会拉取管理员名册与候选人；全局兜底为"无管理员且无权管理"，
  // 避免个别用例未 mock 时请求落入 unhandled → 拦截器 401 处理清空 auth store。
  http.get('/api/platform/admins', () => {
    return HttpResponse.json({
      success: true,
      code: '0',
      message: '',
      data: { admins: [], canManage: false },
      traceId: 'trace-platform-admins',
    });
  }),
  http.get('/api/platform/admins/candidates', () => {
    return HttpResponse.json({
      success: true,
      code: '0',
      message: '',
      data: [],
      traceId: 'trace-platform-admin-candidates',
    });
  }),
  http.post('/api/auth/login', () => {
    return HttpResponse.json({
      success: true,
      code: '0',
      message: '',
      data: {
        userId: 1,
        accessToken: 'test-access',
        refreshToken: 'test-refresh',
        user: {
          id: 1,
          username: 'test-user',
          nickname: '测试用户',
          email: 'test@example.com',
        },
      },
      traceId: 'trace-1',
    });
  }),
  http.get('/api/workspaces/mine', () => {
    return HttpResponse.json({
      success: true,
      code: '0',
      message: '',
      data: [],
      traceId: 'trace-workspaces-mine',
    });
  }),
  http.get('/api/agents', () => {
    return HttpResponse.json({
      success: true,
      code: '0',
      message: '',
      data: [],
      traceId: 'trace-agents-list',
    });
  }),
  http.get('/api/squads', () => {
    return HttpResponse.json({
      success: true,
      code: '0',
      message: '',
      data: [],
      traceId: 'trace-squads-list',
    });
  }),
  http.get('/api/agents/reviews/count', () => {
    return HttpResponse.json({
      success: true,
      code: '0',
      message: '',
      data: 0,
      traceId: 'trace-agents-reviews-count',
    });
  }),
  http.get('/api/memories/reviews/count', () => {
    return HttpResponse.json({
      success: true,
      code: '0',
      message: '',
      data: 0,
      traceId: 'trace-memories-reviews-count',
    });
  }),
];
