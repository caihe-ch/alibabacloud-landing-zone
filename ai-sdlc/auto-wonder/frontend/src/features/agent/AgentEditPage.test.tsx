import { beforeEach, describe, it, expect } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { AgentEditPage } from './AgentEditPage';
import { useAuthStore } from '@/shared/auth/store';

function renderPage(id = '1') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/agents/${id}/edit`]}>
        <Routes>
          <Route path="/agents/:id/edit" element={<AgentEditPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const agentData = {
  id: 1, name: 'Alpha', avatarUrl: null, status: 'DRAFT',
  onlineVersionId: null, editingVersionId: 10, latestVersionNo: 1,
  version: 1, gmtCreate: '2026-07-01',
};

const versionData = {
  id: 10, agentId: 1, versionNo: 1, status: 'DRAFT',
  roleName: '前端开发', roleCode: 'FE_DEV',
  businessBackground: '负责前端业务', responsibilities: '编写React代码',
  sdlcId: null, identityJson: null, reviewerId: null,
  reviewComment: null, reviewedAt: null, version: 1, gmtCreate: '2026-07-01',
};

const ok = (data: unknown) =>
  HttpResponse.json({ success: true, code: '0', message: '', traceId: null, data });

const okPage = (list: unknown[]) =>
  HttpResponse.json({
    success: true, code: '0', message: '', traceId: null,
    data: { list, total: list.length, pageNum: 1, pageSize: 100 },
  });

function mockMemoryApis({ memories = [], memoryRefs = [] }: {
  memories?: unknown[];
  memoryRefs?: Array<{ memoryId: number; source: string }>;
} = {}) {
  server.use(
    http.get('/api/agents/1', () => ok(agentData)),
    http.get('/api/agents/1/versions/1', () => ok({ ...versionData, memoryRefs })),
    http.get('/api/repos', () => okPage([])),
    http.get('/api/skills', () => okPage([])),
    http.get('/api/memories', () => okPage(memories)),
    http.get('/api/sdlcs', () => okPage([])),
  );
}

async function findMemoryCard() {
  return (await screen.findByText('记忆导入')).closest('.ant-card') as HTMLElement;
}

async function openMemoryImportDialog() {
  await userEvent.click(screen.getByRole('button', { name: /导入记忆/ }));
  const dialog = await screen.findByRole('dialog', { name: /导入记忆/ });
  await userEvent.click(within(dialog).getAllByRole('combobox')[0]);
  return dialog;
}

describe('AgentEditPage', () => {
  beforeEach(() => {
    useAuthStore.getState().clear();
    useAuthStore.getState().setCurrentWorkspace({ id: 1, name: 'O', description: '' }, 'READ_WRITE');
  });

  it('renders config form with version data', async () => {
    server.use(
      http.get('/api/agents/1', () => HttpResponse.json({ success: true, code: '0', message: '', traceId: null, data: agentData })),
      http.get('/api/agents/1/versions/1', () => HttpResponse.json({ success: true, code: '0', message: '', traceId: null, data: versionData })),
      http.get('/api/repos', () => HttpResponse.json({ success: true, code: '0', message: '', traceId: null, data: { list: [], total: 0, pageNum: 1, pageSize: 100 } })),
      http.get('/api/skills', () => HttpResponse.json({ success: true, code: '0', message: '', traceId: null, data: { list: [], total: 0, pageNum: 1, pageSize: 100 } })),
      http.get('/api/memories', () => HttpResponse.json({ success: true, code: '0', message: '', traceId: null, data: { list: [], total: 0, pageNum: 1, pageSize: 100 } })),
      http.get('/api/sdlcs', () => HttpResponse.json({ success: true, code: '0', message: '', traceId: null, data: { list: [], total: 0, pageNum: 1, pageSize: 100 } })),
    );

    renderPage();
    expect(await screen.findByText(/编辑配置/)).toBeInTheDocument();
    expect(await screen.findByDisplayValue('前端开发')).toBeInTheDocument();
    expect(screen.getByDisplayValue('FE_DEV')).toBeInTheDocument();
  });

  it('renders save and submit buttons', async () => {
    server.use(
      http.get('/api/agents/1', () => HttpResponse.json({ success: true, code: '0', message: '', traceId: null, data: agentData })),
      http.get('/api/agents/1/versions/1', () => HttpResponse.json({ success: true, code: '0', message: '', traceId: null, data: versionData })),
      http.get('/api/repos', () => HttpResponse.json({ success: true, code: '0', message: '', traceId: null, data: { list: [], total: 0, pageNum: 1, pageSize: 100 } })),
      http.get('/api/skills', () => HttpResponse.json({ success: true, code: '0', message: '', traceId: null, data: { list: [], total: 0, pageNum: 1, pageSize: 100 } })),
      http.get('/api/memories', () => HttpResponse.json({ success: true, code: '0', message: '', traceId: null, data: { list: [], total: 0, pageNum: 1, pageSize: 100 } })),
      http.get('/api/sdlcs', () => HttpResponse.json({ success: true, code: '0', message: '', traceId: null, data: { list: [], total: 0, pageNum: 1, pageSize: 100 } })),
    );

    renderPage();
    expect(await screen.findByRole('button', { name: /保存草稿/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /提交审核/ })).toBeInTheDocument();
  });

  it('renders relation sections', async () => {
    server.use(
      http.get('/api/agents/1', () => HttpResponse.json({ success: true, code: '0', message: '', traceId: null, data: agentData })),
      http.get('/api/agents/1/versions/1', () => HttpResponse.json({ success: true, code: '0', message: '', traceId: null, data: versionData })),
      http.get('/api/repos', () => HttpResponse.json({ success: true, code: '0', message: '', traceId: null, data: { list: [], total: 0, pageNum: 1, pageSize: 100 } })),
      http.get('/api/skills', () => HttpResponse.json({ success: true, code: '0', message: '', traceId: null, data: { list: [], total: 0, pageNum: 1, pageSize: 100 } })),
      http.get('/api/memories', () => HttpResponse.json({ success: true, code: '0', message: '', traceId: null, data: { list: [], total: 0, pageNum: 1, pageSize: 100 } })),
      http.get('/api/sdlcs', () => HttpResponse.json({ success: true, code: '0', message: '', traceId: null, data: { list: [], total: 0, pageNum: 1, pageSize: 100 } })),
    );

    renderPage();
    expect(await screen.findByText('仓库权限')).toBeInTheDocument();
    expect(screen.getByText('能力配置')).toBeInTheDocument();
    expect(screen.getByText('AutoWonder MCP 已内置')).toBeInTheDocument();
    expect(screen.getByText('记忆导入')).toBeInTheDocument();
  });

  it('prefills repo skill and memory relations from version detail', async () => {
    server.use(
      http.get('/api/agents/1', () => HttpResponse.json({ success: true, code: '0', message: '', traceId: null, data: agentData })),
      http.get('/api/agents/1/versions/1', () => HttpResponse.json({
        success: true, code: '0', message: '', traceId: null,
        data: {
          ...versionData,
          repoPerms: [{ repoId: 11, permLevel: 'WRITE' }, { repoId: 11, permLevel: 'WRITE' }],
          skills: [{ skillId: 22 }, { skillId: 22 }],
          memoryRefs: [{ memoryId: 33, source: 'ORG' }, { memoryId: 33, source: 'ORG' }],
        },
      })),
      http.get('/api/repos', () => HttpResponse.json({ success: true, code: '0', message: '', traceId: null, data: { list: [{ id: 11, name: 'web-repo' }], total: 1, pageNum: 1, pageSize: 100 } })),
      http.get('/api/skills', () => HttpResponse.json({ success: true, code: '0', message: '', traceId: null, data: { list: [{ id: 22, name: 'Code Review', code: 'CR' }], total: 1, pageNum: 1, pageSize: 100 } })),
      http.get('/api/memories', () => HttpResponse.json({ success: true, code: '0', message: '', traceId: null, data: { list: [{ id: 33, title: 'React 规范', contentMd: '第一行正文\n第二行正文', status: 'ADOPTED' }], total: 1, pageNum: 1, pageSize: 100 } })),
      http.get('/api/sdlcs', () => HttpResponse.json({ success: true, code: '0', message: '', traceId: null, data: { list: [], total: 0, pageNum: 1, pageSize: 100 } })),
    );

    renderPage();
    expect(await screen.findByText('web-repo')).toBeInTheDocument();
    expect(screen.getAllByText('web-repo')).toHaveLength(1);
    expect(screen.getByText('WRITE')).toBeInTheDocument();
    expect(screen.getByText('Code Review')).toBeInTheDocument();
    expect(screen.getByText('React 规范')).toBeInTheDocument();
    expect(screen.getAllByText('Code Review')).toHaveLength(1);
    expect(screen.getAllByText('React 规范')).toHaveLength(1);
    expect(screen.queryByText(/第一行正文/)).not.toBeInTheDocument();
    expect(screen.queryByText(/第二行正文/)).not.toBeInTheDocument();
  });

  it('uses multi-select controls for repositories, capabilities, and memories', async () => {
    server.use(
      http.get('/api/agents/1', () => HttpResponse.json({ success: true, code: '0', message: '', traceId: null, data: agentData })),
      http.get('/api/agents/1/versions/1', () => HttpResponse.json({ success: true, code: '0', message: '', traceId: null, data: versionData })),
      http.get('/api/repos', () => HttpResponse.json({ success: true, code: '0', message: '', traceId: null, data: { list: [{ id: '11', name: 'web-repo' }], total: 1 } })),
      http.get('/api/skills', () => HttpResponse.json({ success: true, code: '0', message: '', traceId: null, data: { list: [{ id: 22, name: 'Code Review', type: 'SKILL' }], total: 1 } })),
      http.get('/api/memories', () => HttpResponse.json({ success: true, code: '0', message: '', traceId: null, data: { list: [{ id: 33, contentMd: 'React rules' }], total: 1 } })),
      http.get('/api/sdlcs', () => HttpResponse.json({ success: true, code: '0', message: '', traceId: null, data: { list: [], total: 0 } })),
    );

    renderPage();
    await screen.findByText(/编辑配置/);
    await userEvent.click(screen.getByRole('button', { name: /添加仓库/ }));
    const repoPlaceholder = await screen.findByText('选择仓库（可多选）');
    expect(repoPlaceholder.closest('.ant-select')).toHaveClass('ant-select-multiple');
    await userEvent.click(within(repoPlaceholder.closest('.ant-modal') as HTMLElement).getByRole('button', { name: /Cancel/ }));

    await userEvent.click(screen.getByRole('button', { name: /添加能力/ }));
    const skillPlaceholder = await screen.findByText('选择 Skill、MCP 或 Plugin（可多选）');
    expect(skillPlaceholder.closest('.ant-select')).toHaveClass('ant-select-multiple');
    await userEvent.click(within(skillPlaceholder.closest('.ant-modal') as HTMLElement).getByRole('button', { name: /Cancel/ }));

    await userEvent.click(screen.getByRole('button', { name: /导入记忆/ }));
    const memoryPlaceholder = await screen.findByText('选择记忆（可多选）');
    expect(memoryPlaceholder.closest('.ant-select')).toHaveClass('ant-select-multiple');
  });

  it('shows persistent draft feedback after saving config', async () => {
    server.use(
      http.get('/api/agents/1', () => HttpResponse.json({ success: true, code: '0', message: '', traceId: null, data: agentData })),
      http.get('/api/agents/1/versions/1', () => HttpResponse.json({ success: true, code: '0', message: '', traceId: null, data: versionData })),
      http.get('/api/repos', () => HttpResponse.json({ success: true, code: '0', message: '', traceId: null, data: { list: [], total: 0, pageNum: 1, pageSize: 100 } })),
      http.get('/api/skills', () => HttpResponse.json({ success: true, code: '0', message: '', traceId: null, data: { list: [], total: 0, pageNum: 1, pageSize: 100 } })),
      http.get('/api/memories', () => HttpResponse.json({ success: true, code: '0', message: '', traceId: null, data: { list: [], total: 0, pageNum: 1, pageSize: 100 } })),
      http.get('/api/sdlcs', () => HttpResponse.json({ success: true, code: '0', message: '', traceId: null, data: { list: [], total: 0, pageNum: 1, pageSize: 100 } })),
      http.put('/api/agents/1/config', () => HttpResponse.json({ success: true, code: '0', message: '', traceId: null, data: versionData })),
    );

    renderPage();
    await screen.findByText(/编辑配置/);

    await userEvent.click(screen.getByRole('button', { name: /保存草稿/ }));

    expect(await screen.findByText(/草稿已保存/)).toBeInTheDocument();
    expect(screen.getByText(/可继续编辑或提交审核/)).toBeInTheDocument();
  });

  it('lets users choose manual evolution mode when saving config', async () => {
    let savedBody: unknown = null;
    server.use(
      http.get('/api/agents/1', () => HttpResponse.json({ success: true, code: '0', message: '', traceId: null, data: agentData })),
      http.get('/api/agents/1/versions/1', () => HttpResponse.json({
        success: true, code: '0', message: '', traceId: null,
        data: { ...versionData, identityJson: '{"evolutionMode":"ASSISTED"}' },
      })),
      http.get('/api/repos', () => HttpResponse.json({ success: true, code: '0', message: '', traceId: null, data: { list: [], total: 0, pageNum: 1, pageSize: 100 } })),
      http.get('/api/skills', () => HttpResponse.json({ success: true, code: '0', message: '', traceId: null, data: { list: [], total: 0, pageNum: 1, pageSize: 100 } })),
      http.get('/api/memories', () => HttpResponse.json({ success: true, code: '0', message: '', traceId: null, data: { list: [], total: 0, pageNum: 1, pageSize: 100 } })),
      http.get('/api/sdlcs', () => HttpResponse.json({ success: true, code: '0', message: '', traceId: null, data: { list: [], total: 0, pageNum: 1, pageSize: 100 } })),
      http.put('/api/agents/1/config', async ({ request }) => {
        savedBody = await request.json();
        return HttpResponse.json({ success: true, code: '0', message: '', traceId: null, data: versionData });
      }),
    );

    renderPage();
    expect(await screen.findByText(/自进化模式/)).toBeInTheDocument();

    await userEvent.click(screen.getAllByLabelText('自进化模式')[0]);
    await userEvent.click(await screen.findByText('纯手动'));
    await userEvent.click(screen.getByRole('button', { name: /保存草稿/ }));

    expect(savedBody).toMatchObject({ evolutionMode: 'MANUAL' });
  });

  it('shows backend error when adding repo permission fails', async () => {
    const onlineAgent = {
      ...agentData,
      status: 'ONLINE',
      onlineVersionId: 10,
      editingVersionId: null,
    };
    server.use(
      http.get('/api/agents/1', () => HttpResponse.json({ success: true, code: '0', message: '', traceId: null, data: onlineAgent })),
      http.get('/api/agents/1/versions/1', () => HttpResponse.json({ success: true, code: '0', message: '', traceId: null, data: versionData })),
      http.get('/api/repos', () => HttpResponse.json({ success: true, code: '0', message: '', traceId: null, data: { list: [{ id: '11', name: 'web-repo' }], total: 1, pageNum: 1, pageSize: 100 } })),
      http.get('/api/skills', () => HttpResponse.json({ success: true, code: '0', message: '', traceId: null, data: { list: [], total: 0, pageNum: 1, pageSize: 100 } })),
      http.get('/api/memories', () => HttpResponse.json({ success: true, code: '0', message: '', traceId: null, data: { list: [], total: 0, pageNum: 1, pageSize: 100 } })),
      http.get('/api/sdlcs', () => HttpResponse.json({ success: true, code: '0', message: '', traceId: null, data: { list: [], total: 0, pageNum: 1, pageSize: 100 } })),
      http.post('/api/agents/1/repos', () => HttpResponse.json({
        success: false,
        code: '14004',
        message: '当前版本不是草稿,无法编辑',
        data: null,
        traceId: 'trace-agent-repo',
      })),
    );

    renderPage();
    await screen.findByText(/编辑配置/);
    await userEvent.click(screen.getByRole('button', { name: /添加仓库/ }));
    const dialog = await screen.findByRole('dialog', { name: /添加仓库权限/ });
    await userEvent.click(within(dialog).getAllByRole('combobox')[0]);
    await userEvent.click(await screen.findByText('web-repo'));
    await userEvent.click(within(dialog).getByRole('button', { name: /OK/ }));

    expect(await screen.findByText('当前版本不是草稿,无法编辑')).toBeInTheDocument();
  });

  it('lists only adopted memories by title in the import dialog', async () => {
    const imported: Array<{ memoryId: number; source: string }> = [];
    mockMemoryApis({
      memories: [
        { id: 41, title: '待审核记忆', contentMd: '待审核正文', status: 'PENDING' },
        { id: 42, title: '已采纳记忆', contentMd: '已采纳正文首行', status: 'ADOPTED' },
        { id: 43, title: '已驳回记忆', contentMd: '已驳回正文', status: 'REJECTED' },
      ],
    });
    server.use(
      http.post('/api/agents/1/memories', async ({ request }) => {
        imported.push(await request.json() as { memoryId: number; source: string });
        return ok(null);
      }),
    );

    renderPage();
    expect(await screen.findByText(/编辑配置/)).toBeInTheDocument();

    const dialog = await openMemoryImportDialog();

    const option = await screen.findByText('已采纳记忆');
    const dropdown = option.closest('.ant-select-dropdown') as HTMLElement;
    expect(within(dropdown).queryByText('待审核记忆')).not.toBeInTheDocument();
    expect(within(dropdown).queryByText('已驳回记忆')).not.toBeInTheDocument();
    expect(within(dropdown).queryByText(/已采纳正文首行/)).not.toBeInTheDocument();

    await userEvent.click(option);
    await userEvent.click(within(dialog).getByRole('button', { name: /OK/ }));

    await waitFor(() => expect(imported).toEqual([{ memoryId: 42, source: 'ORG' }]));
    expect(await within(await findMemoryCard()).findByText('已采纳记忆')).toBeInTheDocument();
  });

  it('falls back to #id for adopted memories without a usable title', async () => {
    mockMemoryApis({
      memories: [
        { id: 51, title: '   ', contentMd: '空白标题正文', status: 'ADOPTED' },
        { id: 52, title: null, contentMd: null, status: 'ADOPTED' },
      ],
    });

    renderPage();
    expect(await screen.findByText(/编辑配置/)).toBeInTheDocument();

    await openMemoryImportDialog();

    // Regression guard: null/blank title or contentMd must not throw while building options.
    expect(await screen.findByText('#51')).toBeInTheDocument();
    expect(screen.getByText('#52')).toBeInTheDocument();
    expect(screen.queryByText(/空白标题正文/)).not.toBeInTheDocument();
  });

  it('falls back to #id when a bound memory is missing from the memory list', async () => {
    mockMemoryApis({ memoryRefs: [{ memoryId: 77, source: 'ORG' }] });

    renderPage();
    expect(await screen.findByText(/编辑配置/)).toBeInTheDocument();

    expect(await within(await findMemoryCard()).findByText('#77')).toBeInTheDocument();
  });

  it('keeps titles of bound unreviewed memories and hides them from the import dialog', async () => {
    mockMemoryApis({
      memoryRefs: [{ memoryId: 61, source: 'ORG' }],
      memories: [
        { id: 61, title: '历史待审核记忆', contentMd: '历史正文', status: 'PENDING' },
        { id: 62, title: '可导入记忆', contentMd: '可导入正文', status: 'ADOPTED' },
      ],
    });

    renderPage();
    expect(await screen.findByText(/编辑配置/)).toBeInTheDocument();

    // 已绑定的历史未审核记忆仍按标题展示，不退化为 #id。
    expect(await within(await findMemoryCard()).findByText('历史待审核记忆')).toBeInTheDocument();

    await openMemoryImportDialog();

    const option = await screen.findByText('可导入记忆');
    const dropdown = option.closest('.ant-select-dropdown') as HTMLElement;
    expect(within(dropdown).queryByText('历史待审核记忆')).not.toBeInTheDocument();
  });
});
