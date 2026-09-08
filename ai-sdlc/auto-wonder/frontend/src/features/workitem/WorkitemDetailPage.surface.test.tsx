import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { WorkitemDetailPage } from './WorkitemDetailPage';
import { useAuthStore } from '@/shared/auth/store';

/** 为什么单独开一个文件而不是加进 WorkitemDetailPage.test.tsx：
 *  那个文件 57 个用例共用一套 msw handler 与轮询，跑同一提交会随机红 2~21 条
 *  （master 上同样如此），把「右栏白底」这条唯一的守卫放进去等于让它随机失效。
 *  这里只留一个用例、只发一轮静态请求、不进 clarify 模式，因此是确定性的。 */

const mockWorkitem = {
  id: '1', workType: 'REQ', title: '跨境支付重构', contentMd: '# 背景',
  templateId: null, statusNodeId: null, statusName: '开发中', sdlcId: '10',
  sdlcName: '标准流程', assigneeType: 'AGENT', assigneeRef: '100',
  assigneeName: 'Coder-01', priority: 1, version: 3,
  gmtCreate: '2026-07-01T10:00:00Z', gmtModified: '2026-07-09T12:00:00Z',
};

function ok<T>(data: T) {
  return HttpResponse.json({ success: true, code: '0', message: '', traceId: null, data });
}

/** 只覆盖详情页首屏发起的请求；返回空集合让轮询条件不成立，避免二轮请求带来时序抖动。 */
function surfaceHandlers() {
  return [
    http.get('/api/workitems/1', () => ok(mockWorkitem)),
    http.get('/api/workitems/1/unified-timeline', () => ok([])),
    http.get('/api/workitems/1/participants', () => ok([])),
    http.get('/api/workitems/1/mention-candidates', () => ok([])),
    http.get('/api/workitems/1/delivery-progress', () => ok({ steps: [] })),
    http.get('/api/workitems/1/clarification', () => ok(null)),
    http.get('/api/workitems/1/artifacts', () => ok([])),
    http.get('/api/workitems/1/requirement-documents', () => ok([])),
  ];
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/workitems/1']}>
        <Routes>
          <Route path="/workitems/:id" element={<WorkitemDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('WorkitemDetailPage right panel surface', () => {
  beforeEach(() => {
    useAuthStore.getState().clear();
    useAuthStore.getState().setCurrentWorkspace({ id: 1, name: 'O', description: '' }, 'READ_WRITE');
  });

  it('renders the right panel on the white surface with a hairline left border', async () => {
    server.use(...surfaceHandlers());
    renderPage();

    expect(await screen.findByRole('heading', { name: '跨境支付重构' })).toBeInTheDocument();

    // 「灰色底、死气沉沉」是本次改造的首要诉求，而右栏容器的白底此前无人守卫：
    // 把 background 改回 #fafafa、borderLeft 改回 #e5e7eb，全套测试仍旧全绿。
    // 刻意写字面值而不是引用 CLARIFICATION_THEME：只拿常量和自己比，
    // 令牌本身被改回灰色时这里还是绿的（同 theme.test.ts 的取舍）。
    const panel = screen.getByTestId('workitem-right-panel');
    expect(panel).toHaveStyle({ background: '#ffffff' });
    // jsdom 不会规范化 rgba() 里的空格，toHaveStyle 的简写比对会因此失配，直接比字面串。
    expect(panel.style.borderLeft).toBe('1px solid rgba(0,0,0,0.06)');
  });
});
