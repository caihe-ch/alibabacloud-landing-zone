import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { message } from 'antd';
import { server } from '@/test/mocks/server';
import { useAuthStore } from '@/shared/auth/store';
import { ScheduledTaskListPage } from './ScheduledTaskListPage';

const TASK = { id: 7, name: '凌晨回归', squadId: 1, initialAgentId: 11, status: 'ACTIVE', scheduleType: 'CRON', cronExpression: '0 0 2 * * *', timezone: 'Asia/Shanghai', nextFireAt: '2026-08-12T18:00:00Z', version: 3 };

function readHandlers() {
  return [
    http.get('/api/scheduled-tasks', () => HttpResponse.json({ success: true, code: '0', message: '', data: { list: [TASK], total: 1, pageNum: 0, pageSize: 20 } })),
    http.get('/api/squads', () => HttpResponse.json({ success: true, code: '0', message: '', data: { list: [], total: 0, pageNum: 1, pageSize: 100 } })),
    http.get('/api/agents', () => HttpResponse.json({ success: true, code: '0', message: '', data: [] })),
    http.get('/api/scheduled-tasks/7/runs', () => HttpResponse.json({ success: true, code: '0', message: '', data: [] })),
    http.get('/api/scheduled-tasks/summary', () => HttpResponse.json({ success: true, code: '0', message: '', data: { running: 0, today: 0, success30d: 0, completed30d: 0, attention: 0 } })),
  ];
}

function renderList(accessLevel: 'READ_ONLY' | 'READ_WRITE') {
  useAuthStore.setState({ accessLevel });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}><MemoryRouter><ScheduledTaskListPage /></MemoryRouter></QueryClientProvider>);
}

async function confirmPopconfirm(user: ReturnType<typeof userEvent.setup>) {
  const titles = await screen.findAllByText('删除后不再调度，且不可恢复');
  const popup = titles[titles.length - 1].closest('.ant-popconfirm') ?? document;
  const buttons = popup.querySelectorAll('.ant-popconfirm-buttons button');
  expect(buttons.length).toBeGreaterThan(0);
  await user.click(buttons[buttons.length - 1] as HTMLButtonElement);
}

describe('ScheduledTaskListPage', () => {
  it('renders task status, next execution and run-now action', async () => {
    server.use(
      http.get('/api/scheduled-tasks', () => HttpResponse.json({ success: true, code: '0', message: '', data: { list: [{ id: 7, name: '凌晨回归', squadId: 1, initialAgentId: 11, status: 'ACTIVE', scheduleType: 'CRON', cronExpression: '0 0 2 * * *', timezone: 'Asia/Shanghai', nextFireAt: '2026-08-12T18:00:00Z', version: 3 }], total: 41, pageNum: 0, pageSize: 20 } })),
      http.get('/api/squads', () => HttpResponse.json({ success: true, code: '0', message: '', data: [] })),
      http.get('/api/agents', () => HttpResponse.json({ success: true, code: '0', message: '', data: [] })),
      http.get('/api/scheduled-tasks/7/runs', () => HttpResponse.json({ success: true, code: '0', message: '', data: [{ id: 80, scheduledTaskId: 7, status: 'SUCCEEDED' }] })),
      http.get('/api/scheduled-tasks/summary', () => HttpResponse.json({ success: true, code: '0', message: '', data: { running: 2, today: 3, success30d: 8, attention: 1 } })),
    );
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={queryClient}><MemoryRouter><ScheduledTaskListPage /></MemoryRouter></QueryClientProvider>);

    expect(await screen.findByText('凌晨回归')).toBeInTheDocument();
    expect(screen.getByText('启用中')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '立即运行' })).toBeInTheDocument();
    expect(await screen.findByText('成功')).toBeInTheDocument();
    expect(screen.getByText(/共 41 个/)).toBeInTheDocument();
    expect(await screen.findByText(/运行中 2/)).toBeInTheDocument();
  });

  it('deletes a task after confirmation and sends the optimistic version', async () => {
    const user = userEvent.setup();
    let deletedUrl: string | null = null;
    const successSpy = vi.spyOn(message, 'success').mockImplementation(() => undefined as never);
    server.use(
      ...readHandlers(),
      http.delete('/api/scheduled-tasks/7', ({ request }) => {
        deletedUrl = request.url;
        return HttpResponse.json({ success: true, code: '0', message: '', data: null });
      }),
    );

    renderList('READ_WRITE');
    await user.click(await screen.findByRole('button', { name: '删除' }));
    await confirmPopconfirm(user);

    await waitFor(() => expect(deletedUrl).toContain('version=3'));
    expect(successSpy).toHaveBeenCalledWith('定时任务已删除');
    successSpy.mockRestore();
  });

  it('refuses to delete for read-only members without calling the api', async () => {
    const user = userEvent.setup();
    let deleteRequests = 0;
    const errorSpy = vi.spyOn(message, 'error').mockImplementation(() => undefined as never);
    server.use(
      ...readHandlers(),
      http.delete('/api/scheduled-tasks/7', () => {
        deleteRequests += 1;
        return HttpResponse.json({ success: true, code: '0', message: '', data: null });
      }),
    );

    renderList('READ_ONLY');
    await user.click(await screen.findByRole('button', { name: '删除' }));
    await confirmPopconfirm(user);

    expect(errorSpy).toHaveBeenCalledWith('当前为只读权限，删除定时任务需要读写权限');
    expect(deleteRequests).toBe(0);
    errorSpy.mockRestore();
  });
});
