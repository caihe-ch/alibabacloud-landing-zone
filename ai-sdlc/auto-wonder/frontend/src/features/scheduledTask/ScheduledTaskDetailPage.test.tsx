import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { message } from 'antd';
import { server } from '@/test/mocks/server';
import { useAuthStore } from '@/shared/auth/store';
import { ScheduledTaskDetailPage } from './ScheduledTaskDetailPage';

describe('ScheduledTaskDetailPage', () => {
  it('shows task policy and paged run history', async () => {
    server.use(
      http.get('/api/scheduled-tasks/901', () => HttpResponse.json({ success: true, code: '0', message: '', data: { id: 901, name: '主干夜间回归', instructionMd: '执行回归', squadId: 2, initialAgentId: 5, status: 'ACTIVE', scheduleType: 'CRON', cronExpression: '0 0 2 * * *', timezone: 'Asia/Shanghai', overlapPolicy: 'SKIP', misfirePolicy: 'FIRE_LATEST', sessionMode: 'ISOLATED', nextFireAt: '2026-08-12T18:00:00Z', version: 1 } })),
      http.get('/api/scheduled-tasks/901/runs', () => HttpResponse.json({ success: true, code: '0', message: '', data: [{ id: 10482, scheduledTaskId: 901, status: 'SUCCEEDED', triggerType: 'SCHEDULED' }] })),
      http.get('/api/scheduled-tasks/901/documents', () => HttpResponse.json({ success: true, code: '0', message: '', data: [] })),
      http.get('/api/scheduled-tasks/901/health', () => HttpResponse.json({ success: true, code: '0', message: '', data: { success30d: 8, completed30d: 10 } })),
      http.get('/api/squads', () => HttpResponse.json({ success: true, code: '0', message: '', data: { list: [{ id: 2, name: '功能增量分析小队' }], total: 1, pageNum: 1, pageSize: 100 } })),
      http.get('/api/agents', () => HttpResponse.json({ success: true, code: '0', message: '', data: [{ id: 5, name: '功能增量分析员' }] })),
    );
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/scheduled-tasks/901']}><Routes><Route path="/scheduled-tasks/:id" element={<ScheduledTaskDetailPage />} /></Routes></MemoryRouter></QueryClientProvider>);
    expect(await screen.findByText('主干夜间回归')).toBeInTheDocument();
    expect(screen.getByText('运行历史')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Run #10482' })).toHaveAttribute('href', '/scheduled-task-runs/10482');
    expect(await screen.findByText('功能增量分析小队 (2) / 功能增量分析员 (5)')).toBeInTheDocument();
    expect(screen.getByText('← 返回定时任务')).toBeInTheDocument();
    expect(screen.getByText('成功')).toBeInTheDocument();
  });

  it('falls back to raw ids when squad or agent names are unavailable', async () => {
    server.use(
      http.get('/api/scheduled-tasks/901', () => HttpResponse.json({ success: true, code: '0', message: '', data: { id: 901, name: '主干夜间回归', instructionMd: '执行回归', squadId: 2, initialAgentId: 5, status: 'ACTIVE', scheduleType: 'CRON', cronExpression: '0 0 2 * * *', timezone: 'Asia/Shanghai', overlapPolicy: 'SKIP', misfirePolicy: 'FIRE_LATEST', sessionMode: 'ISOLATED', nextFireAt: '2026-08-12T18:00:00Z', version: 1 } })),
      http.get('/api/scheduled-tasks/901/runs', () => HttpResponse.json({ success: true, code: '0', message: '', data: [] })),
      http.get('/api/scheduled-tasks/901/documents', () => HttpResponse.json({ success: true, code: '0', message: '', data: [] })),
      http.get('/api/scheduled-tasks/901/health', () => HttpResponse.json({ success: true, code: '0', message: '', data: { success30d: 0, completed30d: 0 } })),
      http.get('/api/squads', () => HttpResponse.json({ success: true, code: '0', message: '', data: { list: [], total: 0, pageNum: 1, pageSize: 100 } })),
      http.get('/api/agents', () => HttpResponse.json({ success: true, code: '0', message: '', data: [] })),
    );
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/scheduled-tasks/901']}><Routes><Route path="/scheduled-tasks/:id" element={<ScheduledTaskDetailPage />} /></Routes></MemoryRouter></QueryClientProvider>);
    expect(await screen.findByText('小队 #2 / 数字人 #5')).toBeInTheDocument();
  });

  it('deletes the task after confirmation and returns to the list', async () => {
    useAuthStore.setState({ accessLevel: 'READ_WRITE' });
    const user = userEvent.setup();
    let deletedUrl: string | null = null;
    const successSpy = vi.spyOn(message, 'success').mockImplementation(() => undefined as never);
    server.use(
      http.get('/api/scheduled-tasks/901', () => HttpResponse.json({ success: true, code: '0', message: '', data: { id: 901, name: '主干夜间回归', instructionMd: '执行回归', squadId: 2, initialAgentId: 5, status: 'PAUSED', scheduleType: 'CRON', cronExpression: '0 0 2 * * *', timezone: 'Asia/Shanghai', overlapPolicy: 'SKIP', misfirePolicy: 'FIRE_LATEST', sessionMode: 'ISOLATED', nextFireAt: '2026-08-12T18:00:00Z', version: 1 } })),
      http.get('/api/scheduled-tasks/901/runs', () => HttpResponse.json({ success: true, code: '0', message: '', data: [] })),
      http.get('/api/scheduled-tasks/901/documents', () => HttpResponse.json({ success: true, code: '0', message: '', data: [] })),
      http.get('/api/scheduled-tasks/901/health', () => HttpResponse.json({ success: true, code: '0', message: '', data: { success30d: 0, completed30d: 0 } })),
      http.get('/api/squads', () => HttpResponse.json({ success: true, code: '0', message: '', data: { list: [], total: 0, pageNum: 1, pageSize: 100 } })),
      http.get('/api/agents', () => HttpResponse.json({ success: true, code: '0', message: '', data: [] })),
      http.delete('/api/scheduled-tasks/901', ({ request }) => {
        deletedUrl = request.url;
        return HttpResponse.json({ success: true, code: '0', message: '', data: null });
      }),
    );
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/scheduled-tasks/901']}><Routes><Route path="/scheduled-tasks/:id" element={<ScheduledTaskDetailPage />} /><Route path="/scheduled-tasks" element={<div>定时任务列表</div>} /></Routes></MemoryRouter></QueryClientProvider>);

    await user.click(await screen.findByRole('button', { name: '删除' }));
    const titles = await screen.findAllByText('删除后不再调度，且不可恢复');
    const popup = titles[titles.length - 1].closest('.ant-popconfirm') ?? document;
    const buttons = popup.querySelectorAll('.ant-popconfirm-buttons button');
    expect(buttons.length).toBeGreaterThan(0);
    await user.click(buttons[buttons.length - 1] as HTMLButtonElement);

    await waitFor(() => expect(deletedUrl).toContain('version=1'));
    expect(successSpy).toHaveBeenCalledWith('定时任务已删除');
    expect(await screen.findByText('定时任务列表')).toBeInTheDocument();
    successSpy.mockRestore();
  });
});
