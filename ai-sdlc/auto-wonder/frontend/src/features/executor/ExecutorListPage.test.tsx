import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { ExecutorListPage, isQoderClientKind, CREATABLE_CLIENT_KINDS, readQoderStartupPreference, writeQoderStartupPreference, resolveQoderLaunch } from './ExecutorListPage';
import { buildStartupCommand, detectStartupOs } from './startupCommand';
import { QODER_MODELS, qoderOptionsForModel } from './qoderOptions';
import { DEFAULT_BRANDING } from '@/features/platform/brandingApi';
import { useAuthStore } from '@/shared/auth/store';

const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
const originalExecCommand = Object.getOwnPropertyDescriptor(document, 'execCommand');

const PREFS_KEY_PREFIX = 'autowonder.executor.qoderStartupOptions';

function decodePowerShellCommand(command: string): string {
  const encoded = command.replace(/^powershell -NoProfile -EncodedCommand /, '');
  const binary = atob(encoded);
  let decoded = '';
  for (let index = 0; index < binary.length; index += 2) {
    decoded += String.fromCharCode(binary.charCodeAt(index) | (binary.charCodeAt(index + 1) << 8));
  }
  return decoded;
}

function clearQoderPrefs() {
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(PREFS_KEY_PREFIX)) {
      localStorage.removeItem(key);
      i--;
    }
  }
}

function renderPage(queryRetry: boolean | number = false) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: queryRetry, retryDelay: 0 } } });
  return {
    queryClient,
    ...render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter><ExecutorListPage /></MemoryRouter>
      </QueryClientProvider>,
    ),
  };
}

describe('ExecutorListPage', () => {
  beforeEach(() => {
    localStorage.setItem('aw-auth', JSON.stringify({
      state: {
        accessToken: null,
        refreshToken: null,
        user: null,
        currentWorkspace: { id: 1, name: 'O', description: '' },
        accessLevel: 'ADMIN',
      },
      version: 2,
    }));
    useAuthStore.getState().clear();
    useAuthStore.getState().setCurrentWorkspace({ id: 1, name: 'O', description: '' }, 'ADMIN');
    clearQoderPrefs();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    if (originalClipboard) {
      Object.defineProperty(navigator, 'clipboard', originalClipboard);
    } else {
      Reflect.deleteProperty(navigator, 'clipboard');
    }
    if (originalExecCommand) {
      Object.defineProperty(document, 'execCommand', originalExecCommand);
    } else {
      Reflect.deleteProperty(document, 'execCommand');
    }
  });

  it('renders agent selector and create button', async () => {
    server.use(
      http.get('/api/agents', () => HttpResponse.json({
        success: true, code: '0', message: '', traceId: null,
        data: [{ id: 1, name: 'Alpha', avatarUrl: null, status: 'ONLINE', onlineVersionId: null, editingVersionId: null, latestVersionNo: 1, version: 1, gmtCreate: '2026-07-01' }],
      })),
      http.get('/api/executors', () => HttpResponse.json({
        success: true, code: '0', message: '', traceId: null,
        data: [],
      })),
    );
    renderPage();
    expect(await screen.findByText('执行器管理')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /新建执行器/ })).toBeInTheDocument();
  });

  it('shows every executor under its owning agent group once the group is expanded', async () => {
    const user = userEvent.setup();
    server.use(
      http.get('/api/agents', () => HttpResponse.json({
        success: true, code: '0', message: '', traceId: null,
        data: [{ id: 1, name: 'Alpha', avatarUrl: null, status: 'ONLINE', onlineVersionId: null, editingVersionId: null, latestVersionNo: 1, version: 1, gmtCreate: '2026-07-01' }],
      })),
      http.get('/api/executors', () => HttpResponse.json({
        success: true, code: '0', message: '', traceId: null,
        data: [{ id: 10, agentId: 1, agentName: 'Alpha', name: 'runner-01', status: 'OFFLINE', clientKind: 'QODER_CLI', lastHeartbeat: null, gmtCreate: '2026-07-01' }],
      })),
    );
    renderPage();

    await expandAgentGroup(user, 'Alpha（未编队）');

    expect(screen.getByText('runner-01')).toBeInTheDocument();
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.queryByText(/请在右上角选择一个 Agent/)).not.toBeInTheDocument();
  });

  it('renders lastConnectIp column with IP or dash fallback', async () => {
    const user = userEvent.setup();
    server.use(
      http.get('/api/agents', () => HttpResponse.json({
        success: true, code: '0', message: '', traceId: null,
        data: [{ id: 1, name: 'Alpha', avatarUrl: null, status: 'ONLINE', onlineVersionId: null, editingVersionId: null, latestVersionNo: 1, version: 1, gmtCreate: '2026-07-01' }],
      })),
      http.get('/api/executors', () => HttpResponse.json({
        success: true, code: '0', message: '', traceId: null,
        data: [
          { id: 10, agentId: 1, agentName: 'Alpha', name: 'runner-ip', status: 'ONLINE', clientKind: 'QODER_CLI', lastConnectIp: '203.0.113.50', lastHeartbeat: null, gmtCreate: '2026-07-01' },
          { id: 11, agentId: 1, agentName: 'Alpha', name: 'runner-noip', status: 'OFFLINE', clientKind: 'CLAUDE_CODE', lastConnectIp: null, lastHeartbeat: null, gmtCreate: '2026-07-01' },
        ],
      })),
    );
    renderPage();

    await expandAgentGroup(user, 'Alpha（未编队）');

    expect(screen.getByText('203.0.113.50')).toBeInTheDocument();
    expect(screen.getAllByText('接入 IP').length).toBeGreaterThanOrEqual(1);
    const dashCells = await screen.findAllByText('-');
    expect(dashCells.length).toBeGreaterThanOrEqual(1);
  });

  it('configures Qoder runtime options before copying an existing executor command', async () => {
    const user = userEvent.setup();
    server.use(
      http.get('/api/agents', () => HttpResponse.json({
        success: true, code: '0', message: '', traceId: null,
        data: [{ id: 1, name: 'Alpha', avatarUrl: null, status: 'ONLINE', onlineVersionId: null, editingVersionId: null, latestVersionNo: 1, version: 1, gmtCreate: '2026-07-01' }],
      })),
      http.get('/api/executors', () => HttpResponse.json({
        success: true, code: '0', message: '', traceId: null,
        data: [{ id: 10, agentId: 1, agentName: 'Alpha', name: 'qoder-runner', status: 'OFFLINE', clientKind: 'QODER_CLI', lastHeartbeat: null, gmtCreate: '2026-07-01' }],
      })),
      http.get('/api/executors/10/token', () => HttpResponse.json({
        success: true, code: '0', message: '', traceId: null,
        data: 'exec_test_token',
      })),
    );
    renderPage();

    await expandAgentGroup(user, 'Alpha（未编队）');
    await user.click(screen.getByRole('button', { name: /启动命令/ }));

    expect(await screen.findByRole('dialog', { name: '启动命令 · qoder-runner' })).toBeInTheDocument();
    expect(screen.getByText('Qoder 模型')).toBeInTheDocument();
    expect(screen.getByText('Reasoning Effort')).toBeInTheDocument();
    expect(screen.getByText('Context Window')).toBeInTheDocument();
  });

  it('copies an existing executor command when the Clipboard API is unavailable', async () => {
    const user = userEvent.setup();
    const execCommand = vi.fn(() => true);
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: execCommand,
    });
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: undefined,
    });
    server.use(
      http.get('/api/agents', () => HttpResponse.json({
        success: true, code: '0', message: '', traceId: null,
        data: [{ id: 1, name: 'Alpha', avatarUrl: null, status: 'ONLINE', onlineVersionId: null, editingVersionId: null, latestVersionNo: 1, version: 1, gmtCreate: '2026-07-01' }],
      })),
      http.get('/api/executors', () => HttpResponse.json({
        success: true, code: '0', message: '', traceId: null,
        data: [{ id: 10, agentId: 1, agentName: 'Alpha', name: 'qoder-runner', status: 'OFFLINE', clientKind: 'QODER_CLI', lastHeartbeat: null, gmtCreate: '2026-07-01' }],
      })),
      http.get('/api/executors/10/token', () => HttpResponse.json({
        success: true, code: '0', message: '', traceId: null,
        data: 'exec_test_token',
      })),
    );
    renderPage();

    await expandAgentGroup(user, 'Alpha（未编队）');
    await user.click(screen.getByRole('button', { name: /启动命令/ }));
    const dialog = await screen.findByRole('dialog', { name: '启动命令 · qoder-runner' });
    await user.click(within(dialog).getByRole('button', { name: '复制启动命令' }));

    expect(execCommand).toHaveBeenCalledWith('copy');
  });

  it('selects target agent in create modal', async () => {
    const user = userEvent.setup();
    server.use(
      http.get('/api/agents', () => HttpResponse.json({
        success: true, code: '0', message: '', traceId: null,
        data: [{ id: 1, name: 'Alpha', avatarUrl: null, status: 'ONLINE', onlineVersionId: null, editingVersionId: null, latestVersionNo: 1, version: 1, gmtCreate: '2026-07-01' }],
      })),
      http.get('/api/executors', () => HttpResponse.json({
        success: true, code: '0', message: '', traceId: null,
        data: [],
      })),
    );
    renderPage();

    await user.click(await screen.findByRole('button', { name: /新建执行器/ }));

    expect(screen.getAllByText('归属 Agent').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('选择 Agent').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Qoder CLI')).toBeInTheDocument();
    expect(screen.getByText('Qoder CLI CN')).toBeInTheDocument();
    expect(screen.queryByText('Claude Code')).not.toBeInTheDocument();
    expect(screen.queryByText('Codex CLI')).not.toBeInTheDocument();
    expect(screen.queryByText('Cursor CLI')).not.toBeInTheDocument();
    expect(screen.getByText('记忆模式')).toBeInTheDocument();
    expect(screen.getByText('Qoder 模型')).toBeInTheDocument();
    expect(screen.getByText('Reasoning Effort')).toBeInTheDocument();
    expect(screen.getByText('Context Window')).toBeInTheDocument();
  });

  function mockAgent(id: number, name: string) {
    return {
      id, name, avatarUrl: null, status: 'ONLINE', onlineVersionId: null,
      editingVersionId: null, latestVersionNo: 1, version: 1, gmtCreate: '2026-07-01',
    };
  }

  // GET /api/squads returns memberAgentIds as null, so membership comes from the detail endpoint.
  function mockSquadApis() {
    const squad = (id: number, name: string, memberAgentIds: number[] | null) => ({
      id, name, description: '', ownerId: 1, version: 0,
      gmtCreate: '2026-07-11T08:45:10.909+00:00',
      memberAgentIds, memberCount: memberAgentIds?.length ?? 0,
    });
    return [
      http.get('/api/squads', () => HttpResponse.json({
        success: true, code: '0', message: '', traceId: null,
        data: [
          squad(40131, '独立开发者小队', null),
          squad(40132, '开发+评审双人组', null),
          squad(40133, '质量保障小队', null),
        ],
      })),
      http.get('/api/squads/40131', () => HttpResponse.json({
        success: true, code: '0', message: '', traceId: null,
        data: squad(40131, '独立开发者小队', [40169]),
      })),
      http.get('/api/squads/40132', () => HttpResponse.json({
        success: true, code: '0', message: '', traceId: null,
        data: squad(40132, '开发+评审双人组', [40170, 40171]),
      })),
      http.get('/api/squads/40133', () => HttpResponse.json({
        success: true, code: '0', message: '', traceId: null,
        data: squad(40133, '质量保障小队', [40171]),
      })),
    ];
  }

  function mockSameNameAgents() {
    return http.get('/api/agents', () => HttpResponse.json({
      success: true, code: '0', message: '', traceId: null,
      data: [
        mockAgent(40169, '全栈开发'),
        mockAgent(40170, '全栈开发'),
        mockAgent(40171, '代码评审'),
        mockAgent(40172, '测试工程师'),
      ],
    }));
  }

  function mockEmptyExecutors() {
    return http.get('/api/executors', () => HttpResponse.json({
      success: true, code: '0', message: '', traceId: null, data: [],
    }));
  }

  async function openAgentDropdownInCreateModal(user: ReturnType<typeof userEvent.setup>) {
    await user.click(await screen.findByRole('button', { name: /新建执行器/ }));
    const createDialog = await screen.findByRole('dialog', { name: '新建执行器' });
    const agentSelect = within(createDialog).getAllByRole('combobox')[0];
    await user.click(agentSelect);
    return { createDialog, agentSelect };
  }

  it('distinguishes same-named agents by squad suffix in the create modal dropdown', async () => {
    const user = userEvent.setup();
    server.use(mockSameNameAgents(), ...mockSquadApis(), mockEmptyExecutors());
    renderPage();

    await openAgentDropdownInCreateModal(user);

    expect(await screen.findByText('全栈开发（独立开发者小队）')).toBeInTheDocument();
    expect(screen.getByText('全栈开发（开发+评审双人组）')).toBeInTheDocument();
    expect(screen.getByText('代码评审（开发+评审双人组，质量保障小队）')).toBeInTheDocument();
    expect(screen.getByText('测试工程师（未编队）')).toBeInTheDocument();
  });

  it('filters the agent dropdown by squad name', async () => {
    const user = userEvent.setup();
    server.use(mockSameNameAgents(), ...mockSquadApis(), mockEmptyExecutors());
    renderPage();

    const { agentSelect } = await openAgentDropdownInCreateModal(user);
    expect(await screen.findByText('代码评审（开发+评审双人组，质量保障小队）')).toBeInTheDocument();

    await user.type(agentSelect, '质量保障');

    expect(screen.getByText('代码评审（开发+评审双人组，质量保障小队）')).toBeInTheDocument();
    expect(screen.queryByText('全栈开发（独立开发者小队）')).not.toBeInTheDocument();
    expect(screen.queryByText('全栈开发（开发+评审双人组）')).not.toBeInTheDocument();
    expect(screen.queryByText('测试工程师（未编队）')).not.toBeInTheDocument();
  });

  it('still submits the selected agent id after the label gains a squad suffix', async () => {
    const user = userEvent.setup();
    let createdPathname: string | null = null;
    let createBody: Record<string, unknown> | null = null;
    server.use(
      mockSameNameAgents(),
      ...mockSquadApis(),
      mockEmptyExecutors(),
      http.post('/api/agents/40170/executors', async ({ request }) => {
        createdPathname = new URL(request.url).pathname;
        createBody = await request.json() as Record<string, unknown>;
        return HttpResponse.json({
          success: true, code: '0', message: '', traceId: null,
          data: { id: 20, agentId: 40170, name: 'runner-01', token: 'exec_squad_token' },
        });
      }),
    );
    renderPage();

    await openAgentDropdownInCreateModal(user);
    await user.click(await screen.findByText('全栈开发（开发+评审双人组）'));

    await user.type(screen.getByPlaceholderText('如: dev-machine-01'), 'runner-01');
    await user.click(screen.getByRole('dialog', { name: '新建执行器' }).querySelector('.ant-modal-footer button.ant-btn-primary')!);

    await screen.findByText('执行器创建成功');
    expect(createdPathname).toBe('/api/agents/40170/executors');
    expect(createBody).toMatchObject({ name: 'runner-01', clientKind: 'QODER_CLI' });
  });

  it('keeps plain agent names when squad membership cannot be loaded', async () => {
    const user = userEvent.setup();
    server.use(
      mockSameNameAgents(),
      mockEmptyExecutors(),
      http.get('/api/squads', () => new HttpResponse(null, { status: 500 })),
    );
    renderPage();

    await openAgentDropdownInCreateModal(user);

    expect(await screen.findAllByText('全栈开发')).toHaveLength(2);
    expect(screen.getByText('代码评审')).toBeInTheDocument();
    expect(screen.queryByText(/未编队/)).not.toBeInTheDocument();
  });

  it('loads separate dynamic catalogs for Qoder and QoderCN in the create modal', async () => {
    const user = userEvent.setup();
    const catalogRequests: string[] = [];
    server.use(
      http.get('/api/executor-model-catalogs/qoder', () => {
        catalogRequests.push('qoder');
        return HttpResponse.json({
          success: true, code: '0', message: '', traceId: null,
          data: {
            provider: 'qoder',
            models: [{ id: 'qoder-model-id', name: 'Qoder dynamic model' }],
            lastSuccessfulAt: '2026-09-01T00:00:00Z',
          },
        });
      }),
      http.get('/api/executor-model-catalogs/qodercn', () => {
        catalogRequests.push('qodercn');
        return HttpResponse.json({
          success: true, code: '0', message: '', traceId: null,
          data: {
            provider: 'qodercn',
            models: [{ id: 'qodercn-model-id', name: 'QoderCN dynamic model' }],
            lastSuccessfulAt: '2026-09-01T00:00:00Z',
          },
        });
      }),
    );
    renderPage();

    expect(catalogRequests).toEqual([]);
    await user.click(await screen.findByRole('button', { name: /新建执行器/ }));
    const dialog = screen.getByRole('dialog', { name: '新建执行器' });
    expect(await within(dialog).findByText('Qoder dynamic model')).toBeInTheDocument();
    expect(catalogRequests).toEqual(['qoder']);

    await user.click(within(dialog).getByText('Qoder CLI CN'));
    expect(await within(dialog).findByText('QoderCN dynamic model')).toBeInTheDocument();
    expect(catalogRequests).toEqual(['qoder', 'qodercn']);
    expect(within(dialog).queryByText('Qoder dynamic model')).not.toBeInTheDocument();
  });

  it.each([
    ['empty catalog', () => HttpResponse.json({
      success: true, code: '0', message: '', traceId: null,
      data: { provider: 'qoder', models: [], lastSuccessfulAt: null },
    }), 'success'],
    ['catalog 404', () => HttpResponse.json({ success: false, code: '404', message: 'not found', traceId: null }, { status: 404 }), 'error'],
    ['catalog server error', () => HttpResponse.json({ success: false, code: '500', message: 'unavailable', traceId: null }, { status: 500 }), 'error'],
  ])('falls back to static Qoder models after the %s query settles', async (_scenario, response, queryStatus) => {
    const user = userEvent.setup();
    const catalogRequestStarted = vi.fn();
    let resolveCatalogResponse!: (value: HttpResponse) => void;
    const catalogResponse = new Promise<HttpResponse>((resolve) => {
      resolveCatalogResponse = resolve;
    });
    server.use(http.get('/api/executor-model-catalogs/qoder', async () => {
      catalogRequestStarted();
      return catalogResponse;
    }));
    const { queryClient } = renderPage(3);

    await user.click(await screen.findByRole('button', { name: /新建执行器/ }));
    const dialog = screen.getByRole('dialog', { name: '新建执行器' });
    await waitFor(() => expect(catalogRequestStarted).toHaveBeenCalledTimes(1));
    await act(async () => {
      resolveCatalogResponse(response());
      await catalogResponse;
    });
    await waitFor(() => {
      const query = queryClient.getQueryState(['executor-model-catalog', 'qoder']);
      expect(query?.fetchStatus).toBe('idle');
      expect(query?.status).toBe(queryStatus);
      expect(catalogRequestStarted).toHaveBeenCalledTimes(1);
    });

    await user.click(within(dialog).getByRole('combobox', { name: 'Qoder 模型' }));
    expect(await screen.findByText('Qwen3.7-Plus')).toBeInTheDocument();
  });

  it('keeps create visible but blocks non-admin users before opening the modal', async () => {
    const user = userEvent.setup();
    useAuthStore.getState().setCurrentWorkspace({ id: 1, name: 'O', description: '' }, 'READ_WRITE');
    server.use(
      http.get('/api/agents', () => HttpResponse.json({
        success: true, code: '0', message: '', traceId: null, data: [],
      })),
      http.get('/api/executors', () => HttpResponse.json({
        success: true, code: '0', message: '', traceId: null, data: [],
      })),
    );
    renderPage();

    const createButton = await screen.findByRole('button', { name: /新建执行器/ });
    expect(createButton).toBeEnabled();
    await user.click(createButton);

    expect(screen.queryByRole('dialog', { name: '新建执行器' })).not.toBeInTheDocument();
    expect(await screen.findByText('当前为读写权限，新建执行器需要管理员权限')).toBeInTheDocument();
  });

  it.each([
    ['QODER_CN_CLI', 'qodercn'],
    ['QODER_CLI', 'qoder'],
    ['CLAUDE_CODE', 'claude'],
    ['CODEX_CLI', 'codex'],
    ['CURSOR_CLI', 'cursor'],
  ])('builds a complete npm command for %s', (clientKind, provider) => {
    expect(buildStartupCommand(
      'exec_test_token',
      10000,
      clientKind,
      'provider-local',
      'https://daily.auto-wonder.example.com/api/mcp',
      '0.2.130',
    )).toBe(
      `npx -y autowonder@0.2.130 connect --ws-url wss://daily.auto-wonder.example.com/ws/executor --token exec_test_token --executor-id 10000 --provider ${provider} --memory-mode provider-local${provider === 'qoder' || provider === 'qodercn' ? ' --token-aware-enable' : ''}`,
    );
  });

  it('uses provider model IDs and fixed Qoder runtime choices', () => {
    expect(QODER_MODELS.map((model) => model.value)).toEqual([
      'auto', 'ultimate', 'performance', 'efficient', 'lite',
      'qmodel_38max', 'qfmodel', 'qmodel_latest', 'qmodel',
      'kmodel_latest', 'kmodel', 'gmodel', 'gfmodel',
      'dmodel', 'dfmodel', 'mmodel',
    ]);
    expect(QODER_MODELS).toContainEqual({ value: 'qmodel_38max', label: 'Qwen3.8-Max' });
    expect(QODER_MODELS).toContainEqual({ value: 'auto', label: 'Auto (default)' });
    expect(QODER_MODELS).toContainEqual({ value: 'qfmodel', label: 'Qwen3.8-Flash' });
    expect(QODER_MODELS).toContainEqual({ value: 'gmodel', label: 'GLM-5.3' });
    expect(QODER_MODELS).toContainEqual({ value: 'gfmodel', label: 'GLM-5.3-Flash' });
    expect(QODER_MODELS.some((model) => model.value === 'cmodel' || model.value === 'gm51model')).toBe(false);
    expect(qoderOptionsForModel('ultimate').contextWindows).toEqual([
      { value: '1000000', label: '1M' },
      { value: '400000', label: '400K' },
      { value: '260000', label: '260K' },
    ]);
    expect(qoderOptionsForModel('ultimate').reasoningEfforts.map((option) => option.value)).toEqual([
      'max', 'xhigh', 'high', 'medium', 'low', 'none',
    ]);
    expect(qoderOptionsForModel('qfmodel').defaultReasoningEffort).toBe('medium');
    expect(qoderOptionsForModel('gmodel').defaultContextWindow).toBe('260000');
  });

  it('builds a Qoder command with the selected fixed runtime options', () => {
    expect(buildStartupCommand(
      'exec_test_token',
      10000,
      'QODER_CLI',
      'platform',
      'http://daily.auto-wonder.example.com/api/mcp',
      '0.2.130',
      {
        model: 'ultimate',
        reasoningEffort: 'high',
        contextWindow: '1000000',
      },
    )).toBe(
      'npx -y autowonder@0.2.130 connect --ws-url ws://daily.auto-wonder.example.com/ws/executor --token exec_test_token --executor-id 10000 --provider qoder --memory-mode platform --model ultimate --reasoning-effort high --context-window 1000000 --token-aware-enable',
    );
  });

  it('rejects malformed MCP endpoint when building startup commands', () => {
    expect(() => buildStartupCommand(
      'exec_test_token',
      10000,
      'QODER_CLI',
      'platform',
      'not a url',
      '0.2.130',
    )).toThrow('MCP 地址格式不合法');
  });

  it('wraps the Windows startup command with session-level UTF-8 console settings', () => {
    const cmd = buildStartupCommand(
      'exec_test_token',
      10000,
      'QODER_CLI',
      'platform',
      'http://daily.auto-wonder.example.com/api/mcp',
      '0.2.130',
      undefined,
      'windows',
    );
    expect(cmd).toMatch(/^powershell -NoProfile -EncodedCommand [A-Za-z0-9+/=]+$/);
    const decoded = decodePowerShellCommand(cmd);
    expect(decoded).toContain('[Console]::OutputEncoding = [System.Text.Encoding]::UTF8');
    expect(decoded).toContain('$OutputEncoding = [System.Text.Encoding]::UTF8');
    expect(decoded).toContain('npx -y autowonder@0.2.130 connect --ws-url ws://daily.auto-wonder.example.com/ws/executor --token exec_test_token --executor-id 10000 --provider qoder --memory-mode platform');
  });

  it('keeps the posix startup command unwrapped when the os is explicit', () => {
    expect(buildStartupCommand(
      'exec_test_token',
      10000,
      'CLAUDE_CODE',
      'platform',
      'http://daily.auto-wonder.example.com/api/mcp',
      '0.2.130',
      undefined,
      'posix',
    )).toBe(
      'npx -y autowonder@0.2.130 connect --ws-url ws://daily.auto-wonder.example.com/ws/executor --token exec_test_token --executor-id 10000 --provider claude --memory-mode platform',
    );
  });

  it('detects Windows from the browser platform and defaults to posix elsewhere', () => {
    const originalPlatform = Object.getOwnPropertyDescriptor(navigator, 'platform');
    try {
      Object.defineProperty(navigator, 'platform', { configurable: true, value: 'Win32' });
      expect(detectStartupOs()).toBe('windows');
      Object.defineProperty(navigator, 'platform', { configurable: true, value: 'MacIntel' });
      expect(detectStartupOs()).toBe('posix');
    } finally {
      if (originalPlatform) {
        Object.defineProperty(navigator, 'platform', originalPlatform);
      } else {
        Reflect.deleteProperty(navigator, 'platform');
      }
    }
  });

  it('builds a Qoder CLI CN command with the selected fixed runtime options', () => {
    expect(buildStartupCommand(
      'exec_test_token',
      10000,
      'QODER_CN_CLI',
      'platform',
      'http://daily.auto-wonder.example.com/api/mcp',
      '0.2.130',
      {
        model: 'ultimate',
        reasoningEffort: 'high',
        contextWindow: '1000000',
      },
    )).toBe(
      'npx -y autowonder@0.2.130 connect --ws-url ws://daily.auto-wonder.example.com/ws/executor --token exec_test_token --executor-id 10000 --provider qodercn --memory-mode platform --model ultimate --reasoning-effort high --context-window 1000000 --token-aware-enable',
    );
  });

  it('treats both Qoder client kinds as Qoder without normalizing them', () => {
    expect(isQoderClientKind('QODER_CLI')).toBe(true);
    expect(isQoderClientKind('QODER_CN_CLI')).toBe(true);
    expect(isQoderClientKind('CLAUDE_CODE')).toBe(false);
    expect(isQoderClientKind('CODEX_CLI')).toBe(false);
    expect(isQoderClientKind('CURSOR_CLI')).toBe(false);
    expect(isQoderClientKind(undefined)).toBe(false);
  });

  it('restricts creatable client kinds to the two Qoder CLIs', () => {
    expect(CREATABLE_CLIENT_KINDS.map((kind) => kind.value)).toEqual(['QODER_CN_CLI', 'QODER_CLI']);
  });

  it('offers only Qoder kinds in the create modal while the list keeps rendering legacy kinds', async () => {
    const user = userEvent.setup();
    server.use(
      http.get('/api/agents', () => HttpResponse.json({
        success: true, code: '0', message: '', traceId: null,
        data: [{ id: 1, name: 'Alpha', avatarUrl: null, status: 'ONLINE', onlineVersionId: null, editingVersionId: null, latestVersionNo: 1, version: 1, gmtCreate: '2026-07-01' }],
      })),
      http.get('/api/executors', () => HttpResponse.json({
        success: true, code: '0', message: '', traceId: null,
        data: [{ id: 11, agentId: 1, agentName: 'Alpha', name: 'legacy-runner', status: 'OFFLINE', clientKind: 'CLAUDE_CODE', lastConnectIp: null, lastHeartbeat: null, gmtCreate: '2026-07-01' }],
      })),
    );
    renderPage();
    await expandAgentGroup(user, 'Alpha（未编队）');

    expect(screen.getByText('legacy-runner')).toBeInTheDocument();
    expect(screen.getByText('Claude Code')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /新建执行器/ }));
    const createDialog = screen.getByRole('dialog', { name: '新建执行器' });
    expect(within(createDialog).getByText('Qoder CLI')).toBeInTheDocument();
    expect(within(createDialog).getByText('Qoder CLI CN')).toBeInTheDocument();
    expect(within(createDialog).queryByText('Claude Code')).not.toBeInTheDocument();
    expect(within(createDialog).queryByText('Codex CLI')).not.toBeInTheDocument();
    expect(within(createDialog).queryByText('Cursor CLI')).not.toBeInTheDocument();
  });

  it('builds a qodercn startup command for QODER_CN_CLI executors', () => {
    expect(buildStartupCommand(
      'exec_cn_token',
      20,
      'QODER_CN_CLI',
      'platform',
      'https://community.example/api/mcp',
      '0.2.152',
      { model: 'auto', reasoningEffort: 'medium', contextWindow: '260000' },
    )).toContain('--provider qodercn');
  });

  it('copies the startup command with the pinned default runtime version', () => {
    expect(DEFAULT_BRANDING.recommendedRuntimeVersion).toBe('0.2.152');
    expect(buildStartupCommand(
      'exec_test_token',
      10000,
      'QODER_CLI',
      'platform',
      'https://community.example/api/mcp',
      DEFAULT_BRANDING.recommendedRuntimeVersion,
    )).toContain('npx -y autowonder@0.2.152 connect');
  });

  it('returns null from readQoderStartupPreference when no preference is stored', () => {
    expect(readQoderStartupPreference(99)).toBeNull();
  });

  it('retains a startup preference stored with a dynamic model ID', () => {
    const pref = { memoryMode: 'platform', model: 'dynamic_model_id', reasoningEffort: 'medium', contextWindow: '260000' };
    localStorage.setItem(`${PREFS_KEY_PREFIX}.99`, JSON.stringify(pref));

    expect(readQoderStartupPreference(99)).toEqual(pref);
  });

  it('round-trips a valid preference through write and read', () => {
    const pref = { memoryMode: 'platform', model: 'qmodel_38max', reasoningEffort: 'medium', contextWindow: '260000' };
    writeQoderStartupPreference(42, pref);
    expect(readQoderStartupPreference(42)).toEqual(pref);
  });

  it('isolates preferences between different executor IDs', () => {
    writeQoderStartupPreference(1, { memoryMode: 'platform', model: 'qmodel_38max', reasoningEffort: 'medium', contextWindow: '260000' });
    expect(readQoderStartupPreference(2)).toBeNull();
    expect(readQoderStartupPreference(1)?.model).toBe('qmodel_38max');
  });

  it('restores saved model when reopening the Qoder startup dialog', async () => {
    const user = userEvent.setup();
    writeQoderStartupPreference(10, {
      memoryMode: 'platform',
      model: 'qmodel_38max',
      reasoningEffort: 'medium',
      contextWindow: '260000',
    });
    server.use(
      http.get('/api/agents', () => HttpResponse.json({
        success: true, code: '0', message: '', traceId: null,
        data: [{ id: 1, name: 'Alpha', avatarUrl: null, status: 'ONLINE', onlineVersionId: null, editingVersionId: null, latestVersionNo: 1, version: 1, gmtCreate: '2026-07-01' }],
      })),
      http.get('/api/executors', () => HttpResponse.json({
        success: true, code: '0', message: '', traceId: null,
        data: [{ id: 10, agentId: 1, agentName: 'Alpha', name: 'qoder-runner', status: 'OFFLINE', clientKind: 'QODER_CLI', lastHeartbeat: null, gmtCreate: '2026-07-01' }],
      })),
      http.get('/api/executors/10/token', () => HttpResponse.json({
        success: true, code: '0', message: '', traceId: null,
        data: 'exec_test_token',
      })),
    );
    renderPage();

    await expandAgentGroup(user, 'Alpha（未编队）');
    await user.click(screen.getByRole('button', { name: /启动命令/ }));

    const dialog = await screen.findByRole('dialog', { name: '启动命令 · qoder-runner' });
    expect(dialog).toBeInTheDocument();
    const modelItems = await screen.findAllByText('Qwen3.8-Max');
    expect(modelItems.length).toBeGreaterThanOrEqual(1);
  });

  function mockExecutor(overrides: Record<string, unknown> = {}) {
    return {
      id: 10000, agentId: 1, name: 'dev-machine-01', agentName: 'A', clientKind: 'CLAUDE_CODE',
      status: 'OFFLINE', lastConnectIp: null, lastHeartbeat: null,
      gmtCreate: '2026-08-24T10:00:00Z', ...overrides,
    };
  }

  function serveExecutor(overrides: Record<string, unknown> = {}) {
    server.use(
      http.get('/api/agents', () => HttpResponse.json({
        success: true, code: '0', message: '', traceId: null, data: [],
      })),
      http.get('/api/executors', () => HttpResponse.json({
        success: true, code: '0', message: '', traceId: null, data: [mockExecutor(overrides)],
      })),
      http.get('/api/executors/10000/token', () => HttpResponse.json({
        success: true, code: '0', message: '', traceId: null, data: 'exec_test_token',
      })),
    );
  }

  it('opens a startup command modal with a preview for non-Qoder executors', async () => {
    const user = userEvent.setup();
    serveExecutor({ clientKind: 'CLAUDE_CODE' });
    renderPage();

    await expandAgentGroup(user, 'A（未编队）');
    await user.click(await screen.findByRole('button', { name: /启动命令/ }));

    expect(await screen.findByText(/启动命令 · dev-machine-01/)).toBeInTheDocument();
    expect(await screen.findByText(/--provider claude/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '复制启动命令' })).toBeInTheDocument();
  });

  it('opens the same modal with Qoder fields for Qoder executors', async () => {
    const user = userEvent.setup();
    serveExecutor({ clientKind: 'QODER_CLI' });
    renderPage();

    await expandAgentGroup(user, 'A（未编队）');
    await user.click(await screen.findByRole('button', { name: /启动命令/ }));

    expect(await screen.findByText(/启动命令 · dev-machine-01/)).toBeInTheDocument();
    expect(screen.getByText('Qoder 模型')).toBeInTheDocument();
    expect(screen.getByText('Context Window')).toBeInTheDocument();
  });

  it('uses the dynamic model ID in an existing Qoder startup command', async () => {
    const user = userEvent.setup();
    writeQoderStartupPreference(10000, {
      memoryMode: 'platform',
      model: 'removed-model',
      reasoningEffort: 'high',
      contextWindow: '1000000',
    });
    server.use(
      http.get('/api/executor-model-catalogs/qoder', () => HttpResponse.json({
        success: true, code: '0', message: '', traceId: null,
        data: {
          provider: 'qoder',
          models: [{ id: 'qoder-model-id', name: 'Qoder dynamic model' }],
          lastSuccessfulAt: '2026-09-01T00:00:00Z',
        },
      })),
    );
    serveExecutor({ clientKind: 'QODER_CLI' });
    renderPage();

    await expandAgentGroup(user, 'A（未编队）');
    await user.click(await screen.findByRole('button', { name: /启动命令/ }));

    expect(await screen.findByText('Qoder dynamic model')).toBeInTheDocument();
    expect(await screen.findByText(/--model qoder-model-id/)).toBeInTheDocument();
    expect(screen.queryByText(/--model Qoder dynamic model/)).not.toBeInTheDocument();
  });

  it('preserves a saved dynamic startup model while a fresh Qoder catalog becomes enabled', async () => {
    const user = userEvent.setup();
    const catalogRequestStarted = vi.fn();
    const finalCatalog = {
      provider: 'qoder',
      models: [
        { id: 'first-dynamic-model', name: 'First dynamic model' },
        { id: 'saved-dynamic-model', name: 'Saved dynamic model' },
      ],
      lastSuccessfulAt: '2026-09-01T00:00:00Z',
    };
    let resolveCatalogResponse!: (value: HttpResponse) => void;
    const catalogResponse = new Promise<HttpResponse>((resolve) => {
      resolveCatalogResponse = resolve;
    });
    writeQoderStartupPreference(10000, {
      memoryMode: 'platform',
      model: 'saved-dynamic-model',
      reasoningEffort: 'medium',
      contextWindow: '260000',
    });
    server.use(http.get('/api/executor-model-catalogs/qoder', async () => {
      catalogRequestStarted();
      return catalogResponse;
    }));
    serveExecutor({ clientKind: 'QODER_CLI' });
    const { queryClient } = renderPage();

    await expandAgentGroup(user, 'A（未编队）');
    await user.click(await screen.findByRole('button', { name: /启动命令/ }));
    const dialog = await screen.findByRole('dialog', { name: '启动命令 · dev-machine-01' });
    const modelSelect = within(dialog).getByRole('combobox', { name: 'Qoder 模型' });
    const modelControl = modelSelect.closest('.ant-select') as HTMLElement | null;
    expect(modelControl).not.toBeNull();
    await waitFor(() => {
      const query = queryClient.getQueryState(['executor-model-catalog', 'qoder']);
      expect(query).toMatchObject({ fetchStatus: 'fetching', status: 'pending' });
      expect(catalogRequestStarted).toHaveBeenCalledTimes(1);
    });
    expect(within(modelControl!).getByText('saved-dynamic-model')).toBeInTheDocument();

    await act(async () => {
      resolveCatalogResponse(HttpResponse.json({
        success: true, code: '0', message: '', traceId: null, data: finalCatalog,
      }));
      await catalogResponse;
    });
    await waitFor(() => {
      const query = queryClient.getQueryState(['executor-model-catalog', 'qoder']);
      expect(query).toMatchObject({ fetchStatus: 'idle', status: 'success' });
      expect(within(modelControl!).getByText('Saved dynamic model')).toBeInTheDocument();
    });
    expect(within(modelControl!).queryByText('First dynamic model')).not.toBeInTheDocument();
  });

  it('preserves a saved dynamic startup model when opening the modal refetches an old Qoder catalog', async () => {
    const user = userEvent.setup();
    const catalogRequestStarted = vi.fn();
    const finalCatalog = {
      provider: 'qoder' as const,
      models: [
        { id: 'first-dynamic-model', name: 'First dynamic model' },
        { id: 'saved-dynamic-model', name: 'Saved dynamic model' },
      ],
      lastSuccessfulAt: '2026-09-01T00:00:00Z',
    };
    let resolveCatalogResponse!: (value: HttpResponse) => void;
    const catalogResponse = new Promise<HttpResponse>((resolve) => {
      resolveCatalogResponse = resolve;
    });
    writeQoderStartupPreference(10000, {
      memoryMode: 'platform',
      model: 'saved-dynamic-model',
      reasoningEffort: 'medium',
      contextWindow: '260000',
    });
    server.use(http.get('/api/executor-model-catalogs/qoder', async () => {
      catalogRequestStarted();
      return catalogResponse;
    }));
    serveExecutor({ clientKind: 'QODER_CLI' });
    const { queryClient } = renderPage();

    await act(async () => {
      queryClient.setQueryData(['executor-model-catalog', 'qoder'], {
        provider: 'qoder',
        models: [{ id: 'old-dynamic-model', name: 'Old dynamic model' }],
        lastSuccessfulAt: '2026-08-31T00:00:00Z',
      });
    });

    await expandAgentGroup(user, 'A（未编队）');
    await user.click(await screen.findByRole('button', { name: /启动命令/ }));
    const dialog = await screen.findByRole('dialog', { name: '启动命令 · dev-machine-01' });
    const modelSelect = within(dialog).getByRole('combobox', { name: 'Qoder 模型' });
    const modelControl = modelSelect.closest('.ant-select') as HTMLElement | null;
    expect(modelControl).not.toBeNull();
    await waitFor(() => {
      const query = queryClient.getQueryState(['executor-model-catalog', 'qoder']);
      expect(query).toMatchObject({ fetchStatus: 'fetching', status: 'success' });
      expect(query?.data).toMatchObject({ models: [{ id: 'old-dynamic-model' }] });
      expect(catalogRequestStarted).toHaveBeenCalledTimes(1);
    });
    expect(within(modelControl!).getByText('saved-dynamic-model')).toBeInTheDocument();

    await act(async () => {
      resolveCatalogResponse(HttpResponse.json({
        success: true, code: '0', message: '', traceId: null, data: finalCatalog,
      }));
      await catalogResponse;
    });
    await waitFor(() => {
      const query = queryClient.getQueryState(['executor-model-catalog', 'qoder']);
      expect(query).toMatchObject({ fetchStatus: 'idle', status: 'success' });
      expect(within(modelControl!).getByText('Saved dynamic model')).toBeInTheDocument();
    });
    expect(within(modelControl!).queryByText('First dynamic model')).not.toBeInTheDocument();
  });

  it('repairs an omitted saved model only after the startup modal refetch settles', async () => {
    const user = userEvent.setup();
    const catalogRequestStarted = vi.fn();
    const finalCatalog = {
      provider: 'qoder' as const,
      models: [{ id: 'first-dynamic-model', name: 'First dynamic model' }],
      lastSuccessfulAt: '2026-09-01T00:00:00Z',
    };
    let resolveCatalogResponse!: (value: HttpResponse) => void;
    const catalogResponse = new Promise<HttpResponse>((resolve) => {
      resolveCatalogResponse = resolve;
    });
    writeQoderStartupPreference(10000, {
      memoryMode: 'platform',
      model: 'stale-dynamic-model',
      reasoningEffort: 'medium',
      contextWindow: '260000',
    });
    server.use(http.get('/api/executor-model-catalogs/qoder', async () => {
      catalogRequestStarted();
      return catalogResponse;
    }));
    serveExecutor({ clientKind: 'QODER_CLI' });
    const { queryClient } = renderPage();

    await act(async () => {
      queryClient.setQueryData(['executor-model-catalog', 'qoder'], {
        provider: 'qoder',
        models: [{ id: 'old-dynamic-model', name: 'Old dynamic model' }],
        lastSuccessfulAt: '2026-08-31T00:00:00Z',
      });
    });

    await expandAgentGroup(user, 'A（未编队）');
    await user.click(await screen.findByRole('button', { name: /启动命令/ }));
    const dialog = await screen.findByRole('dialog', { name: '启动命令 · dev-machine-01' });
    const modelSelect = within(dialog).getByRole('combobox', { name: 'Qoder 模型' });
    const modelControl = modelSelect.closest('.ant-select') as HTMLElement | null;
    expect(modelControl).not.toBeNull();
    await waitFor(() => {
      const query = queryClient.getQueryState(['executor-model-catalog', 'qoder']);
      expect(query).toMatchObject({ fetchStatus: 'fetching', status: 'success' });
      expect(query?.data).toMatchObject({ models: [{ id: 'old-dynamic-model' }] });
      expect(catalogRequestStarted).toHaveBeenCalledTimes(1);
    });
    expect(within(modelControl!).getByText('stale-dynamic-model')).toBeInTheDocument();

    await act(async () => {
      resolveCatalogResponse(HttpResponse.json({
        success: true, code: '0', message: '', traceId: null, data: finalCatalog,
      }));
      await catalogResponse;
    });
    await waitFor(() => {
      const query = queryClient.getQueryState(['executor-model-catalog', 'qoder']);
      expect(query).toMatchObject({ fetchStatus: 'idle', status: 'success' });
      expect(within(modelControl!).getByText('First dynamic model')).toBeInTheDocument();
    });
    expect(within(modelControl!).queryByText('stale-dynamic-model')).not.toBeInTheDocument();
  });

  it('hides Qoder fields in the modal for non-Qoder executors', async () => {
    const user = userEvent.setup();
    serveExecutor({ clientKind: 'CODEX_CLI' });
    renderPage();

    await expandAgentGroup(user, 'A（未编队）');
    await user.click(await screen.findByRole('button', { name: /启动命令/ }));

    expect(await screen.findByText(/启动命令 · dev-machine-01/)).toBeInTheDocument();
    expect(screen.queryByText('Qoder 模型')).not.toBeInTheDocument();
  });

  function mockClipboardWrite() {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    return writeText;
  }

  it('copies a bash debug command from the startup modal and warns about disk usage', async () => {
    const user = userEvent.setup();
    const writeText = mockClipboardWrite();
    serveExecutor({ clientKind: 'CLAUDE_CODE' });
    renderPage();

    await expandAgentGroup(user, 'A（未编队）');
    await user.click(await screen.findByRole('button', { name: /启动命令/ }));
    await user.click(await screen.findByRole('button', { name: /复制 debug 模式命令/ }));
    await user.click(await screen.findByText('Mac / Linux (bash)'));

    expect(writeText).toHaveBeenCalledTimes(1);
    const cmd = writeText.mock.calls[0][0];
    expect(cmd).toContain('--debug 2>&1 | tee ~/aw-claude-10000-');
    expect(cmd).toMatch(/\.log$/);
    expect(await screen.findByText(/避免日志写满磁盘/)).toBeInTheDocument();
  });

  it('copies a PowerShell debug command from the startup modal', async () => {
    const user = userEvent.setup();
    const writeText = mockClipboardWrite();
    serveExecutor({ clientKind: 'CLAUDE_CODE' });
    renderPage();

    await expandAgentGroup(user, 'A（未编队）');
    await user.click(await screen.findByRole('button', { name: /启动命令/ }));
    await user.click(await screen.findByRole('button', { name: /复制 debug 模式命令/ }));
    await user.click(await screen.findByText('Windows (PowerShell 7+)'));

    expect(writeText).toHaveBeenCalledTimes(1);
    const cmd = writeText.mock.calls[0][0];
    expect(cmd).toMatch(/^powershell -NoProfile -EncodedCommand [A-Za-z0-9+/=]+$/);
    const decoded = decodePowerShellCommand(cmd);
    expect(decoded).toContain('--debug 2>&1 | Tee-Object -FilePath "$HOME/aw-claude-10000-');
    expect(decoded).toMatch(/\.log"$/);
  });

  it('copies a plain startup command without the debug suffix', async () => {
    const user = userEvent.setup();
    const writeText = mockClipboardWrite();
    serveExecutor({ clientKind: 'CLAUDE_CODE' });
    renderPage();

    await expandAgentGroup(user, 'A（未编队）');
    await user.click(await screen.findByRole('button', { name: /启动命令/ }));
    await user.click(await screen.findByRole('button', { name: '复制启动命令' }));

    expect(writeText).toHaveBeenCalledTimes(1);
    const cmd = writeText.mock.calls[0][0];
    expect(cmd).not.toContain('--debug');
    expect(cmd).toContain('--provider claude');
    expect(await screen.findByText('启动命令已复制')).toBeInTheDocument();
  });

  const AGENT_ALPHA = {
    id: 1, name: 'Alpha', avatarUrl: null, status: 'ONLINE', onlineVersionId: null,
    editingVersionId: null, latestVersionNo: 1, version: 1, gmtCreate: '2026-07-01',
  };

  // 列表在创建成功前不包含该执行器，复现“创建后从列表首次打开启动命令弹窗”的真实链路
  function serveCreateFlow(specs: { name: string; clientKind: string }[]) {
    const idByName = new Map<string, number>(specs.map((spec, index) => [spec.name, 71 + index] as [string, number]));
    const createdNames = new Set<string>();
    server.use(
      http.get('/api/agents', () => HttpResponse.json({
        success: true, code: '0', message: '', traceId: null, data: [AGENT_ALPHA],
      })),
      http.get('/api/executors', () => HttpResponse.json({
        success: true, code: '0', message: '', traceId: null,
        data: specs.filter((spec) => createdNames.has(spec.name)).map((spec) => ({
          id: idByName.get(spec.name) as number, agentId: 1, agentName: null, name: spec.name,
          status: 'OFFLINE', clientKind: spec.clientKind,
          lastConnectIp: null, lastHeartbeat: null, gmtCreate: '2026-09-03T10:00:00Z',
        })),
      })),
      http.post('/api/agents/1/executors', async ({ request }) => {
        const body = await request.json() as { name: string; clientKind: string };
        createdNames.add(body.name);
        return HttpResponse.json({
          success: true, code: '0', message: '', traceId: null,
          data: { id: idByName.get(body.name) as number, agentId: 1, name: body.name, token: `exec_token_${body.name}` },
        });
      }),
      ...specs.map((spec) => http.get(`/api/executors/${idByName.get(spec.name)}/token`, () => HttpResponse.json({
        success: true, code: '0', message: '', traceId: null, data: `exec_token_${spec.name}`,
      }))),
    );
    return idByName;
  }

  // rc-util 在 NODE_ENV=test 下把所有弹层 id 固定成 test-id，多个弹窗同时挂载时 aria-labelledby
  // 全部指向 DOM 中第一个标题，按 accessible name 查弹窗会拿到错误节点，只能按标题文本定位。
  async function findModalByTitle(title: string): Promise<HTMLElement> {
    const titleNode = await screen.findByText(title, { selector: '.ant-modal-title' });
    const modal = titleNode.closest('[role="dialog"]');
    expect(modal).not.toBeNull();
    const wrap = (modal as HTMLElement).closest('.ant-modal-wrap') as HTMLElement;
    // 关闭后的弹窗仍留在 DOM 中，必须等到本次真正打开再返回，否则会读到上一次的内容
    await waitFor(() => {
      expect(wrap.style.display).not.toBe('none');
    });
    return modal as HTMLElement;
  }

  // Windows 下预览区渲染的是 base64 编码的 PowerShell 命令，断言前先解码
  function previewedCommand(container: HTMLElement): string {
    const text = container.textContent ?? '';
    const encoded = text.match(/powershell -NoProfile -EncodedCommand [A-Za-z0-9+/=]+/);
    return encoded ? decodePowerShellCommand(encoded[0]) : text;
  }

  // 第二份表单挂载后字段 id 与第一份重复（同为 test-id_xxx），label.control 只指向前者，
  // 后挂载的控件失去 accessible name，只能顺着 label -> .ant-form-item -> .ant-select-selector 定位。
  function formItemSelect(dialog: HTMLElement, label: string): HTMLElement {
    const labelNode = within(dialog).getByText(label, { selector: 'label' });
    const item = labelNode.closest('.ant-form-item') as HTMLElement | null;
    expect(item).not.toBeNull();
    const selector = (item as HTMLElement).querySelector('.ant-select-selector') as HTMLElement | null;
    expect(selector).not.toBeNull();
    return selector as HTMLElement;
  }

  function selectedValue(selector: HTMLElement): string | null {
    return selector.querySelector('.ant-select-selection-item')?.textContent ?? null;
  }

  // 创建链路要跑完「表单交互 -> 创建请求 -> 两个弹窗断言」，并行跑全量或开启覆盖率插桩时
  // jsdom 明显变慢，vitest 默认的 5s 会误判超时
  const CREATE_FLOW_TIMEOUT = 20000;

  async function submitCreateForm(
    user: ReturnType<typeof userEvent.setup>,
    options: { name: string; contextWindowLabel: string; clientKindLabel?: string },
  ) {
    await user.click(await screen.findByRole('button', { name: /新建执行器/ }));
    const dialog = await findModalByTitle('新建执行器');
    if (options.clientKindLabel) {
      // ClientKindSelect 是自定义的卡片式单选，不是 antd Select
      await user.click(within(dialog).getByText(options.clientKindLabel));
    }
    await user.click(formItemSelect(dialog, '归属 Agent'));
    // 归属 Agent 选项带小队后缀（默认 /api/squads 返回空数组即「未编队」）；创建成功后分组面板头
    // 会出现同样文本，故必须限定到下拉选项节点，否则连续创建第二个执行器时会多元素匹配。
    await user.click(await screen.findByText('Alpha（未编队）', { selector: '.ant-select-item-option-content' }));
    await user.click(formItemSelect(dialog, 'Context Window'));
    await user.click(await screen.findByText(options.contextWindowLabel));
    await user.type(within(dialog).getByRole('textbox', { name: '执行器名称' }), options.name);
    await user.click(within(dialog).getByRole('button', { name: 'OK' }));
    return findModalByTitle('执行器创建成功');
  }

  // 缺陷复现的关键步骤：关闭创建成功弹窗且不点击任何复制按钮
  async function closeIssuedDialogWithoutCopying(
    user: ReturnType<typeof userEvent.setup>,
    issuedDialog: HTMLElement,
  ) {
    await user.click(within(issuedDialog).getByRole('button', { name: 'OK' }));
    const wrap = issuedDialog.closest('.ant-modal-wrap') as HTMLElement;
    await waitFor(() => {
      expect(wrap.style.display).toBe('none');
    });
  }

  async function expectContextWindowSelected(dialog: HTMLElement, label: string, value: string) {
    const selector = formItemSelect(dialog, 'Context Window');
    await waitFor(() => {
      expect(selectedValue(selector)).toBe(label);
    });
    expect(previewedCommand(dialog)).toContain(`--context-window ${value}`);
  }

  it.each([
    ['1M', '1000000'],
    ['400K', '400000'],
  ])('keeps the %s Context Window chosen at creation when the startup dialog is first opened from the list', async (label, value) => {
    const user = userEvent.setup();
    const idByName = serveCreateFlow([{ name: 'dev-machine-01', clientKind: 'QODER_CLI' }]);
    renderPage();

    const issuedDialog = await submitCreateForm(user, { name: 'dev-machine-01', contextWindowLabel: label });
    expect(previewedCommand(issuedDialog)).toContain(`--context-window ${value}`);
    await closeIssuedDialogWithoutCopying(user, issuedDialog);

    const executorId = idByName.get('dev-machine-01') as number;
    expect(readQoderStartupPreference(executorId)).toEqual({
      memoryMode: 'platform', model: 'auto', reasoningEffort: 'medium', contextWindow: value,
    });

    await user.click(await screen.findByRole('button', { name: /启动命令/ }));
    const startupDialog = await findModalByTitle('启动命令 · dev-machine-01');
    await expectContextWindowSelected(startupDialog, label, value);
  }, CREATE_FLOW_TIMEOUT);

  it('restores the creation-time Context Window after the page reloads', async () => {
    const user = userEvent.setup();
    serveCreateFlow([{ name: 'dev-machine-01', clientKind: 'QODER_CLI' }]);
    const firstRender = renderPage();

    const issuedDialog = await submitCreateForm(user, { name: 'dev-machine-01', contextWindowLabel: '1M' });
    await closeIssuedDialogWithoutCopying(user, issuedDialog);
    firstRender.unmount();

    renderPage();
    await user.click(await screen.findByRole('button', { name: /启动命令/ }));
    const startupDialog = await findModalByTitle('启动命令 · dev-machine-01');
    await expectContextWindowSelected(startupDialog, '1M', '1000000');
  }, CREATE_FLOW_TIMEOUT);

  it('does not let a second created executor overwrite the first executor Context Window', async () => {
    const user = userEvent.setup();
    const idByName = serveCreateFlow([
      { name: 'runner-a', clientKind: 'QODER_CLI' },
      { name: 'runner-b', clientKind: 'QODER_CLI' },
    ]);
    renderPage();

    const firstIssued = await submitCreateForm(user, { name: 'runner-a', contextWindowLabel: '1M' });
    await closeIssuedDialogWithoutCopying(user, firstIssued);
    const secondIssued = await submitCreateForm(user, { name: 'runner-b', contextWindowLabel: '400K' });
    expect(within(secondIssued).getByText('runner-b')).toBeInTheDocument();
    expect(previewedCommand(secondIssued)).toContain('--context-window 400000');
    await closeIssuedDialogWithoutCopying(user, secondIssued);

    expect(readQoderStartupPreference(idByName.get('runner-a') as number)?.contextWindow).toBe('1000000');
    expect(readQoderStartupPreference(idByName.get('runner-b') as number)?.contextWindow).toBe('400000');

    const rowA = screen.getByText('runner-a').closest('tr') as HTMLElement;
    await user.click(within(rowA).getByRole('button', { name: /启动命令/ }));
    const startupDialog = await findModalByTitle('启动命令 · runner-a');
    await expectContextWindowSelected(startupDialog, '1M', '1000000');
  }, CREATE_FLOW_TIMEOUT);

  it('persists the Context Window chosen at creation for Qoder CLI CN', async () => {
    const user = userEvent.setup();
    const idByName = serveCreateFlow([{ name: 'cn-runner', clientKind: 'QODER_CN_CLI' }]);
    renderPage();

    const issuedDialog = await submitCreateForm(user, {
      name: 'cn-runner', contextWindowLabel: '1M', clientKindLabel: 'Qoder CLI CN',
    });
    expect(previewedCommand(issuedDialog)).toContain('--context-window 1000000');
    expect(previewedCommand(issuedDialog)).toContain('--provider qodercn');
    await closeIssuedDialogWithoutCopying(user, issuedDialog);

    expect(readQoderStartupPreference(idByName.get('cn-runner') as number)).toEqual({
      memoryMode: 'platform', model: 'auto', reasoningEffort: 'medium', contextWindow: '1000000',
    });

    await user.click(await screen.findByRole('button', { name: /启动命令/ }));
    const startupDialog = await findModalByTitle('启动命令 · cn-runner');
    await expectContextWindowSelected(startupDialog, '1M', '1000000');
  }, CREATE_FLOW_TIMEOUT);

  it('stores no Qoder startup preference for a non-Qoder executor', async () => {
    const user = userEvent.setup();
    const writeText = mockClipboardWrite();
    serveExecutor({ clientKind: 'CLAUDE_CODE' });
    renderPage();

    await user.click(await screen.findByRole('button', { name: /启动命令/ }));
    const startupDialog = await screen.findByRole('dialog', { name: '启动命令 · dev-machine-01' });
    await user.click(within(startupDialog).getByRole('button', { name: '复制启动命令' }));

    expect(readQoderStartupPreference(10000)).toBeNull();
    expect(writeText).toHaveBeenCalledTimes(1);
    const cmd = writeText.mock.calls[0][0];
    expect(cmd).not.toContain('--context-window');
    expect(cmd).not.toContain('--model');
  });

  it('fills Qoder launch fallbacks so a persisted preference is never incomplete', () => {
    expect(resolveQoderLaunch()).toEqual({ model: 'auto', reasoningEffort: 'medium', contextWindow: '260000' });
    expect(resolveQoderLaunch('ultimate')).toEqual({ model: 'ultimate', reasoningEffort: 'high', contextWindow: '260000' });
    expect(resolveQoderLaunch('qmodel_38max', 'low', '1000000'))
      .toEqual({ model: 'qmodel_38max', reasoningEffort: 'low', contextWindow: '1000000' });

    // 缺字段的偏好会被 readQoderStartupPreference 判为无效，等价于没有保存
    writeQoderStartupPreference(55, { memoryMode: 'none', ...resolveQoderLaunch() });
    expect(readQoderStartupPreference(55)).toEqual({
      memoryMode: 'none', model: 'auto', reasoningEffort: 'medium', contextWindow: '260000',
    });
  });

  function mockGroupedExecutor(overrides: Record<string, unknown> = {}) {
    return {
      id: 10, agentId: 1, agentName: 'Alpha', name: 'runner-01', status: 'OFFLINE',
      clientKind: 'QODER_CLI', lastConnectIp: null, lastHeartbeat: null,
      gmtCreate: '2026-07-01T00:00:00Z', ...overrides,
    };
  }

  // 默认 /api/squads 返回空数组（真值），所以分组标签会带「（未编队）」后缀，与新建弹窗下拉一致。
  function mockGroupedExecutorApis(
    executors: Record<string, unknown>[],
    agents: Record<string, unknown>[] = [],
  ) {
    server.use(
      http.get('/api/agents', () => HttpResponse.json({
        success: true, code: '0', message: '', traceId: null, data: agents,
      })),
      http.get('/api/executors', () => HttpResponse.json({
        success: true, code: '0', message: '', traceId: null, data: executors,
      })),
    );
  }

  function collapseItemOf(label: string | RegExp): HTMLElement {
    const item = screen.getByText(label).closest('.ant-collapse-item');
    if (!item) throw new Error(`找不到分组 ${String(label)} 对应的折叠面板`);
    return item as HTMLElement;
  }

  function expectExpanded(item: HTMLElement, expanded: boolean) {
    if (expanded) {
      expect(item).toHaveClass('ant-collapse-item-active');
    } else {
      expect(item).not.toHaveClass('ant-collapse-item-active');
    }
  }

  async function toggleGroup(
    user: ReturnType<typeof userEvent.setup>,
    label: string | RegExp,
  ): Promise<HTMLElement> {
    const item = collapseItemOf(label);
    const header = item.querySelector('.ant-collapse-header');
    if (!header) throw new Error(`找不到分组 ${String(label)} 的折叠头`);
    await user.click(header as HTMLElement);
    return item;
  }

  // 分组默认折叠，需要行内内容的用例先展开对应分组。
  async function expandAgentGroup(
    user: ReturnType<typeof userEvent.setup>,
    label: string,
  ): Promise<HTMLElement> {
    await screen.findByText(label);
    const item = await toggleGroup(user, label);
    expectExpanded(item, true);
    return item;
  }

  it('renders one panel per owning agent collapsed by default with count and status summary', async () => {
    const user = userEvent.setup();
    mockGroupedExecutorApis([
      mockGroupedExecutor({ id: 10, agentId: 1, agentName: '全栈开发数字人', name: 'dev-machine-01', status: 'ONLINE' }),
      mockGroupedExecutor({ id: 11, agentId: 1, agentName: '全栈开发数字人', name: 'dev-machine-02', status: 'OFFLINE' }),
      mockGroupedExecutor({ id: 12, agentId: 2, agentName: 'CR数字人', name: 'cr-machine-01', status: 'BUSY', clientKind: 'QODER_CN_CLI' }),
    ]);
    renderPage();

    await screen.findByText('全栈开发数字人（未编队）');
    const devGroup = collapseItemOf('全栈开发数字人（未编队）');
    const crGroup = collapseItemOf('CR数字人（未编队）');

    expectExpanded(devGroup, false);
    expectExpanded(crGroup, false);

    // 折叠态下组头的数量与状态汇总仍然可见，组内执行器行不渲染
    expect(within(devGroup).getByText('2 个执行器')).toBeInTheDocument();
    expect(within(devGroup).getByText('在线 1')).toBeInTheDocument();
    expect(within(devGroup).getByText('忙碌 0')).toBeInTheDocument();
    expect(within(devGroup).getByText('离线 1')).toBeInTheDocument();
    expect(within(crGroup).getByText('1 个执行器')).toBeInTheDocument();
    expect(within(crGroup).getByText('忙碌 1')).toBeInTheDocument();
    expect(screen.queryByText('dev-machine-01')).not.toBeInTheDocument();
    expect(screen.queryByText('cr-machine-01')).not.toBeInTheDocument();

    await toggleGroup(user, '全栈开发数字人（未编队）');

    const openedDev = collapseItemOf('全栈开发数字人（未编队）');
    expectExpanded(openedDev, true);
    expectExpanded(collapseItemOf('CR数字人（未编队）'), false);
    expect(within(openedDev).getByText('dev-machine-01')).toBeInTheDocument();
    expect(within(openedDev).getByText('dev-machine-02')).toBeInTheDocument();
    expect(within(openedDev).queryByText('cr-machine-01')).not.toBeInTheDocument();
    expect(screen.queryByText('cr-machine-01')).not.toBeInTheDocument();
  });

  it('expands one agent group without touching the others and collapses it again', async () => {
    const user = userEvent.setup();
    mockGroupedExecutorApis([
      mockGroupedExecutor({ id: 10, agentId: 1, agentName: '全栈开发数字人', name: 'dev-machine-01' }),
      mockGroupedExecutor({ id: 12, agentId: 2, agentName: 'CR数字人', name: 'cr-machine-01' }),
    ]);
    renderPage();

    await screen.findByText('全栈开发数字人（未编队）');
    expectExpanded(collapseItemOf('全栈开发数字人（未编队）'), false);
    expectExpanded(collapseItemOf('CR数字人（未编队）'), false);

    await toggleGroup(user, '全栈开发数字人（未编队）');
    const opened = collapseItemOf('全栈开发数字人（未编队）');
    expectExpanded(opened, true);
    expectExpanded(collapseItemOf('CR数字人（未编队）'), false);
    expect(within(opened).getByText('dev-machine-01')).toBeInTheDocument();
    expect(screen.queryByText('cr-machine-01')).not.toBeInTheDocument();

    await toggleGroup(user, '全栈开发数字人（未编队）');
    expectExpanded(collapseItemOf('全栈开发数字人（未编队）'), false);

    await toggleGroup(user, '全栈开发数字人（未编队）');
    const reopened = collapseItemOf('全栈开发数字人（未编队）');
    expectExpanded(reopened, true);
    expect(within(reopened).getByText('dev-machine-01')).toBeInTheDocument();
  });

  it('separates same-named agents into different groups using the squad suffix', async () => {
    const user = userEvent.setup();
    server.use(
      http.get('/api/agents', () => HttpResponse.json({
        success: true, code: '0', message: '', traceId: null,
        data: [mockAgent(40169, '全栈开发'), mockAgent(40170, '全栈开发')],
      })),
      ...mockSquadApis(),
      http.get('/api/executors', () => HttpResponse.json({
        success: true, code: '0', message: '', traceId: null,
        data: [
          mockGroupedExecutor({ id: 10, agentId: 40169, agentName: '全栈开发', name: 'solo-runner' }),
          mockGroupedExecutor({ id: 11, agentId: 40170, agentName: '全栈开发', name: 'duo-runner' }),
        ],
      })),
    );
    renderPage();

    await screen.findByText('全栈开发（独立开发者小队）');
    expectExpanded(collapseItemOf('全栈开发（独立开发者小队）'), false);
    expectExpanded(collapseItemOf('全栈开发（开发+评审双人组）'), false);

    const soloGroup = await expandAgentGroup(user, '全栈开发（独立开发者小队）');
    const duoGroup = await expandAgentGroup(user, '全栈开发（开发+评审双人组）');

    expect(soloGroup).not.toBe(duoGroup);
    expect(within(soloGroup).getByText('solo-runner')).toBeInTheDocument();
    expect(within(soloGroup).queryByText('duo-runner')).not.toBeInTheDocument();
    expect(within(duoGroup).getByText('duo-runner')).toBeInTheDocument();
    expect(within(duoGroup).queryByText('solo-runner')).not.toBeInTheDocument();
  });

  it('puts executors without a resolvable agent name into 未知 Agent and sorts it last', async () => {
    const user = userEvent.setup();
    mockGroupedExecutorApis([
      mockGroupedExecutor({ id: 10, agentId: 1, agentName: null, name: 'orphan-runner' }),
      mockGroupedExecutor({ id: 11, agentId: 2, agentName: 'Beta数字人', name: 'beta-runner' }),
    ]);
    renderPage();

    await screen.findByText('未知 Agent');
    const unknownGroup = collapseItemOf('未知 Agent');
    expectExpanded(unknownGroup, false);
    expectExpanded(collapseItemOf('Beta数字人（未编队）'), false);
    const items = Array.from(document.querySelectorAll('.ant-collapse-item'));
    expect(items[items.length - 1]).toBe(unknownGroup);

    await expandAgentGroup(user, '未知 Agent');
    expect(within(collapseItemOf('未知 Agent')).getByText('orphan-runner')).toBeInTheDocument();

    await expandAgentGroup(user, 'Beta数字人（未编队）');
    expect(within(collapseItemOf('Beta数字人（未编队）')).getByText('beta-runner')).toBeInTheDocument();
    expect(within(collapseItemOf('未知 Agent')).queryByText('beta-runner')).not.toBeInTheDocument();
  });

  it('keeps a newly appearing agent group collapsed after another one was expanded', async () => {
    const user = userEvent.setup();
    mockGroupedExecutorApis([
      mockGroupedExecutor({ id: 10, agentId: 1, agentName: '全栈开发数字人', name: 'dev-machine-01' }),
    ]);
    const { queryClient } = renderPage();
    await screen.findByText('全栈开发数字人（未编队）');

    await toggleGroup(user, '全栈开发数字人（未编队）');
    expectExpanded(collapseItemOf('全栈开发数字人（未编队）'), true);

    await act(async () => {
      queryClient.setQueryData(['executors', undefined], [
        mockGroupedExecutor({ id: 10, agentId: 1, agentName: '全栈开发数字人', name: 'dev-machine-01' }),
        mockGroupedExecutor({ id: 12, agentId: 2, agentName: 'CR数字人', name: 'cr-machine-01' }),
      ]);
    });

    await screen.findByText('CR数字人（未编队）');
    expectExpanded(collapseItemOf('CR数字人（未编队）'), false);
    expectExpanded(collapseItemOf('全栈开发数字人（未编队）'), true);
    expect(screen.queryByText('cr-machine-01')).not.toBeInTheDocument();
  });

  it('narrows the groups to the selected agent through the top filter', async () => {
    const user = userEvent.setup();
    const alphaRunner = mockGroupedExecutor({ id: 10, agentId: 1, agentName: 'Alpha数字人', name: 'alpha-runner' });
    server.use(
      http.get('/api/agents', () => HttpResponse.json({
        success: true, code: '0', message: '', traceId: null,
        data: [mockAgent(1, 'Alpha数字人'), mockAgent(2, 'Beta数字人')],
      })),
      http.get('/api/executors', () => HttpResponse.json({
        success: true, code: '0', message: '', traceId: null,
        data: [alphaRunner, mockGroupedExecutor({ id: 11, agentId: 2, agentName: 'Beta数字人', name: 'beta-runner' })],
      })),
      http.get('/api/agents/1/executors', () => HttpResponse.json({
        success: true, code: '0', message: '', traceId: null, data: [alphaRunner],
      })),
    );
    renderPage();

    await screen.findByText('Beta数字人（未编队）');
    expect(document.querySelectorAll('.ant-collapse-item')).toHaveLength(2);

    await user.click(screen.getByRole('combobox'));
    await user.click(await screen.findByText('Alpha数字人', { selector: '.ant-select-item-option-content' }));

    await waitFor(() => {
      expect(document.querySelectorAll('.ant-collapse-item')).toHaveLength(1);
    });
    expectExpanded(collapseItemOf('Alpha数字人（未编队）'), false);
    expect(screen.queryByText('Beta数字人（未编队）')).not.toBeInTheDocument();

    const alphaGroup = await expandAgentGroup(user, 'Alpha数字人（未编队）');
    expect(within(alphaGroup).getByText('alpha-runner')).toBeInTheDocument();
    expect(screen.queryByText('beta-runner')).not.toBeInTheDocument();
  });

  it('still opens the startup command modal for a row inside its agent group', async () => {
    const user = userEvent.setup();
    server.use(
      http.get('/api/agents', () => HttpResponse.json({
        success: true, code: '0', message: '', traceId: null, data: [],
      })),
      http.get('/api/executors', () => HttpResponse.json({
        success: true, code: '0', message: '', traceId: null,
        data: [
          mockGroupedExecutor({ id: 10, agentId: 1, agentName: 'Alpha数字人', name: 'alpha-runner' }),
          mockGroupedExecutor({ id: 11, agentId: 2, agentName: 'Beta数字人', name: 'beta-runner' }),
        ],
      })),
      http.get('/api/executors/11/token', () => HttpResponse.json({
        success: true, code: '0', message: '', traceId: null, data: 'exec_beta_token',
      })),
    );
    renderPage();

    const betaGroup = await expandAgentGroup(user, 'Beta数字人（未编队）');
    expect(within(betaGroup).getByText('beta-runner')).toBeInTheDocument();
    await user.click(within(betaGroup).getByRole('button', { name: /启动命令/ }));

    expect(await screen.findByRole('dialog', { name: '启动命令 · beta-runner' })).toBeInTheDocument();
  });

  it('keeps the flat empty table when there is no executor at all', async () => {
    mockGroupedExecutorApis([]);
    renderPage();

    expect(await screen.findByText('执行器管理')).toBeInTheDocument();
    expect(document.querySelector('.ant-collapse')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /新建执行器/ })).toBeInTheDocument();
  });
});
