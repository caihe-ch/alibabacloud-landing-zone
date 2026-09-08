import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { SkillListPage } from './SkillListPage';
import { useAuthStore } from '@/shared/auth/store';
import { message } from 'antd';
import type { ExecutorVO } from '@/features/executor/api';
import type { SkillPackageFileContent } from './api';

function renderPage(accessLevel: 'READ_ONLY' | 'READ_WRITE' = 'READ_WRITE') {
  useAuthStore.setState({ accessLevel });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <SkillListPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const onlineExecutor: ExecutorVO = {
  id: 7,
  agentId: 11,
  agentName: '回归工程师',
  name: '本机 Runtime',
  status: 'ONLINE',
  clientKind: 'qoder-cli',
  lastConnectIp: null,
  lastHeartbeat: null,
  gmtCreate: '2026-07-01T10:00:00Z',
};

// 自「MCP 在所选 Runtime 本机执行」起，测试连接要先弹窗选中在线 Runtime，确认后才发请求。
// Runtime 列表是异步查询，这里直接等下拉项出现，不依赖打开弹窗时的预选中值。
async function pickRuntimeAndConfirm() {
  await userEvent.click(screen.getByRole('button', { name: /测试连接/ }));
  const dialog = await screen.findByRole('dialog');
  expect(dialog).toHaveTextContent('选择测试 Runtime');

  await userEvent.click(dialog.querySelector('.ant-select-selector') as HTMLElement);
  const option = await screen.findByText(
    `${onlineExecutor.name}（${onlineExecutor.agentName} · #${onlineExecutor.id}）`,
    { selector: '.ant-select-item-option-content' },
    { timeout: 3000 },
  );
  await userEvent.click(option);

  await userEvent.click(within(dialog).getByRole('button', { name: 'OK' }));
}

describe('SkillListPage', () => {
  it('renders consistent Chinese copy for skill management', async () => {
    server.use(
      http.get('/api/skills', () => {
        return HttpResponse.json({
          success: true, code: '0', message: '', traceId: null,
          data: [
            { id: 1, name: 'GitHub MCP', type: 'MCP', installSpec: 'npx @anthropic/mcp-server-github', description: 'GitHub integration', version: 1, gmtCreate: '2026-07-01' },
            { id: 2, name: 'Code Review', type: 'SKILL', installSpec: 'built-in', description: '自动代码审查', version: 1, gmtCreate: '2026-07-01' },
          ],
        });
      }),
    );
    renderPage();
    expect(await screen.findByText('GitHub MCP')).toBeInTheDocument();
    expect(screen.getByText('Code Review')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /新增能力/ }).closest('.ant-card') ?? document.body).toHaveTextContent('能力库');
    expect(screen.getByRole('button', { name: /新增能力/ })).toBeInTheDocument();
    expect(screen.getByText('全部')).toBeInTheDocument();
    expect(screen.getAllByText('MCP 服务').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('技能').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('接入方式').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('更新时间').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('更新人').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('命令行接入')).toBeInTheDocument();
    expect(screen.getAllByText('详情').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('删除')[0].closest('td')).toHaveClass('ant-table-cell-fix-right');
    expect(screen.queryByText('npx @anthropic/mcp-server-github')).not.toBeInTheDocument();
    expect(screen.queryByText('built-in')).not.toBeInTheDocument();
  });

  it('opens a detail modal with description and install spec', async () => {
    server.use(
      http.get('/api/skills', () => {
        return HttpResponse.json({
          success: true, code: '0', message: '', traceId: null,
          data: [
            {
              id: 1,
              name: 'GitHub MCP',
              type: 'MCP',
              installSpec: 'npx @anthropic/mcp-server-github',
              description: 'GitHub integration',
              sourceType: 'INSTALL_SPEC',
              version: 1,
              gmtCreate: '2026-07-01T10:00:00Z',
              gmtModified: '2026-07-12T12:30:00Z',
              modifierName: '蔡何',
            },
          ],
        });
      }),
    );

    renderPage();
    await screen.findByText('GitHub MCP');
    await userEvent.click(screen.getByRole('button', { name: /详情/ }));

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('能力详情');
    expect(dialog).toHaveTextContent('GitHub integration');
    expect(dialog).toHaveTextContent('npx @anthropic/mcp-server-github');
    expect(dialog).toHaveTextContent('蔡何');
    expect(dialog).not.toHaveTextContent('包内容');
    expect(dialog).not.toHaveTextContent('下载技能包');
  });

  it('tests MCP connection and renders success feedback with latency', async () => {
    server.use(
      http.get('/api/skills', () => {
        return HttpResponse.json({
          success: true, code: '0', message: '', traceId: null,
          data: [
            { id: 1, name: 'GitHub MCP', type: 'MCP', installSpec: '{"transport":"http","url":"https://example.com/mcp"}', description: 'GitHub integration', version: 1, gmtCreate: '2026-07-01' },
            { id: 2, name: 'Code Review', type: 'SKILL', installSpec: 'built-in', description: '自动代码审查', version: 1, gmtCreate: '2026-07-01' },
          ],
        });
      }),
      http.get('/api/executors', () => {
        return HttpResponse.json({
          success: true, code: '0', message: '', traceId: null,
          data: [onlineExecutor],
        });
      }),
      http.post('/api/skills/1/connection-test', ({ request }) => {
        // MCP 连接测试必须带上所选 Runtime
        expect(new URL(request.url).searchParams.get('executorId')).toBe(String(onlineExecutor.id));
        return HttpResponse.json({
          success: true, code: '0', message: '', traceId: null,
          data: { success: true, message: '连接成功', durationMs: 42 },
        });
      }),
    );

    renderPage();
    await screen.findByText('GitHub MCP');
    expect(screen.getAllByRole('button', { name: /测试连接/ })).toHaveLength(1);

    await pickRuntimeAndConfirm();

    // 同一文案既出现在行内 Tag 也出现在 antd message 浮层，只断言行内结果
    expect(await screen.findByText('连接成功（42ms）', { selector: '.ant-tag' })).toBeInTheDocument();
  });

  it('tests MCP connection and renders backend failure reason', async () => {
    server.use(
      http.get('/api/skills', () => {
        return HttpResponse.json({
          success: true, code: '0', message: '', traceId: null,
          data: [
            { id: 1, name: 'Broken MCP', type: 'MCP', installSpec: '{"transport":"http","url":"https://example.com/mcp"}', description: 'Broken integration', version: 1, gmtCreate: '2026-07-01' },
          ],
        });
      }),
      http.get('/api/executors', () => {
        return HttpResponse.json({
          success: true, code: '0', message: '', traceId: null,
          data: [onlineExecutor],
        });
      }),
      http.post('/api/skills/1/connection-test', () => {
        return HttpResponse.json({
          success: true, code: '0', message: '', traceId: null,
          data: { success: false, message: 'HTTP 401 Unauthorized', durationMs: 18 },
        });
      }),
    );

    renderPage();
    await screen.findByText('Broken MCP');

    await pickRuntimeAndConfirm();

    expect(await screen.findByText('连接失败：HTTP 401 Unauthorized', { selector: '.ant-tag' })).toBeInTheDocument();
  });

  it('does not warn when the create modal form is closed', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    server.use(
      http.get('/api/skills', () => {
        return HttpResponse.json({
          success: true, code: '0', message: '', traceId: null,
          data: [],
        });
      }),
    );

    renderPage();
    expect(await screen.findByRole('button', { name: /新增能力/ })).toBeInTheDocument();
    expect(errorSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('Instance created by `useForm` is not connected to any Form element'),
    );
    errorSpy.mockRestore();
  });

  it('keeps create visible but denies opening it for read-only members', async () => {
    const errorSpy = vi.spyOn(message, 'error').mockImplementation(() => undefined as never);
    server.use(
      http.get('/api/skills', () => HttpResponse.json({
        success: true, code: '0', message: '', traceId: null, data: [],
      })),
    );

    renderPage('READ_ONLY');
    const createButton = await screen.findByRole('button', { name: /新增能力/ });
    await userEvent.click(createButton);

    expect(errorSpy).toHaveBeenCalledWith('当前为只读权限，新增能力需要读写权限');
    expect(screen.queryByRole('dialog', { name: /新增能力/ })).not.toBeInTheDocument();
    errorSpy.mockRestore();
  });

  it('filter tab does not show PLUGIN option', async () => {
    server.use(
      http.get('/api/skills', () => HttpResponse.json({
        success: true, code: '0', message: '', traceId: null, data: [],
      })),
      http.get('/api/executors', () => HttpResponse.json({
        success: true, code: '0', message: '', traceId: null, data: [],
      })),
    );

    renderPage();
    await screen.findByText('全部');
    expect(screen.getByText('全部')).toBeInTheDocument();
    expect(screen.getAllByText('技能').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('MCP 服务').length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText('插件')).not.toBeInTheDocument();
  });

  it('create modal type dropdown does not show PLUGIN option', async () => {
    server.use(
      http.get('/api/skills', () => HttpResponse.json({
        success: true, code: '0', message: '', traceId: null, data: [],
      })),
      http.get('/api/executors', () => HttpResponse.json({
        success: true, code: '0', message: '', traceId: null, data: [],
      })),
    );

    renderPage();
    const createButton = await screen.findByRole('button', { name: /新增能力/ });
    await userEvent.click(createButton);

    const dialog = await screen.findByRole('dialog', { name: /新增能力/ });
    expect(dialog).toBeInTheDocument();

    const typeSelect = dialog.querySelector('.ant-select-selector') as HTMLElement;
    await userEvent.click(typeSelect);

    await vi.waitFor(() => {
      const options = document.querySelectorAll('.ant-select-item-option-content');
      expect(options.length).toBeGreaterThan(0);
    });

    const dropdownOptions = document.querySelectorAll('.ant-select-item-option-content');
    const optionTexts = Array.from(dropdownOptions).map((el) => el.textContent);
    expect(optionTexts).toContain('技能');
    expect(optionTexts).toContain('MCP 服务');
    expect(optionTexts).not.toContain('插件');
  });
});

const PACKAGE_SKILL = {
  id: 1,
  name: 'custom-skill',
  type: 'SKILL',
  installSpec: '{"source":"OSS_ZIP"}',
  description: '上传的技能包',
  sourceType: 'OSS_ZIP',
  packageOssRef: 'skills/10002/custom-skill.zip',
  packageFileName: 'custom-skill.zip',
  packageSize: 2048,
  version: 1,
  gmtCreate: '2026-07-01T10:00:00Z',
};

// scripts 目录故意不给显式 DIR 记录，用来验证前端能从扁平路径补出层级。
const PACKAGE_FILES = [
  { path: 'references', name: 'references', dir: true, size: 0, kind: 'DIR' },
  { path: 'assets', name: 'assets', dir: true, size: 0, kind: 'DIR' },
  { path: 'bin', name: 'bin', dir: true, size: 0, kind: 'DIR' },
  { path: 'SKILL.md', name: 'SKILL.md', dir: false, size: 2048, kind: 'TEXT' },
  { path: 'references/guide.md', name: 'guide.md', dir: false, size: 2048, kind: 'TEXT' },
  { path: 'scripts/run.sh', name: 'run.sh', dir: false, size: 1024, kind: 'TEXT' },
  { path: 'assets/logo.png', name: 'logo.png', dir: false, size: 2048, kind: 'IMAGE' },
  { path: 'bin/tool', name: 'tool', dir: false, size: 1024, kind: 'BINARY' },
];

const FILE_CONTENTS: Record<string, SkillPackageFileContent> = {
  'SKILL.md': {
    path: 'SKILL.md',
    fileName: 'SKILL.md',
    content: '# 技能说明\n\n这是包内的 Markdown 文件。',
    binary: false,
  },
  'references/guide.md': {
    path: 'references/guide.md',
    fileName: 'guide.md',
    content: '# 参考文档',
    binary: false,
  },
  'scripts/run.sh': {
    path: 'scripts/run.sh',
    fileName: 'run.sh',
    content: '#!/bin/sh\necho run',
    binary: false,
  },
};

interface PackageHandlerOptions {
  skill?: Record<string, unknown>;
  filesBody?: Record<string, unknown>;
  onFileRequest?: (path: string | null) => void;
}

function packageHandlers(options: PackageHandlerOptions = {}) {
  return [
    http.get('/api/skills', () => HttpResponse.json({
      success: true, code: '0', message: '', traceId: null,
      data: [options.skill ?? PACKAGE_SKILL],
    })),
    http.get('/api/skills/1/package/files', () => HttpResponse.json(options.filesBody ?? {
      success: true, code: '0', message: '', traceId: null,
      data: { files: PACKAGE_FILES, format: 'zip' },
    })),
    http.get('/api/skills/1/package/file', ({ request }) => {
      const path = new URL(request.url).searchParams.get('path');
      options.onFileRequest?.(path);
      const content = FILE_CONTENTS[path ?? ''];
      return HttpResponse.json(content
        ? { success: true, code: '0', message: '', traceId: null, data: content }
        : { success: false, code: '10404', message: '包内不存在该文件', traceId: null });
    }),
  ];
}

function packageTreeTitles(): string[] {
  const tree = screen.getByTestId('skill-package-tree');
  return Array.from(tree.querySelectorAll<HTMLElement>('.ant-tree-title'))
    .map((node) => node.textContent ?? '');
}

async function clickPackageNode(label: RegExp) {
  const tree = screen.getByTestId('skill-package-tree');
  const target = Array.from(tree.querySelectorAll<HTMLElement>('.ant-tree-title'))
    .find((node) => label.test(node.textContent ?? ''));
  if (!target) {
    throw new Error(`技能包树中找不到节点: ${label}`);
  }
  await userEvent.click(target);
}

function packagePreview(): HTMLElement {
  return screen.getByTestId('skill-package-preview');
}

// click 被替换成空实现时链接仍挂在 body 上（remove 在 click 之后），从 DOM 取回即可断言。
// 不用 spy.mock.instances —— vitest 0.34 把它按返回值类型标注，click 返回 void 会编译不过。
function spyAnchorClick() {
  let captured: HTMLAnchorElement | null = null;
  const spy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {
    captured = document.querySelector<HTMLAnchorElement>('a[download]');
  });
  return { spy, anchor: () => captured };
}

describe('SkillListPage package content', () => {
  beforeEach(() => {
    Object.defineProperty(URL, 'createObjectURL', {
      value: vi.fn(() => 'blob:skill-package'), configurable: true,
    });
    Object.defineProperty(URL, 'revokeObjectURL', { value: vi.fn(), configurable: true });
  });

  afterEach(() => {
    useAuthStore.getState().clear();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  async function openPackageDetail() {
    renderPage();
    await screen.findByText('custom-skill');
    await userEvent.click(screen.getByRole('button', { name: /详情/ }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('能力详情');
    await screen.findByTestId('skill-package-tree');
    await waitFor(() => expect(packageTreeTitles().length).toBeGreaterThan(0));
    return dialog;
  }

  async function openPackageDetailWithListingFailure(failureMessage: string) {
    renderPage();
    await screen.findByText('custom-skill');
    await userEvent.click(screen.getByRole('button', { name: /详情/ }));
    const dialog = await screen.findByRole('dialog');
    await waitFor(() => expect(dialog).toHaveTextContent(failureMessage));
    return dialog;
  }

  it('lists the package tree with implicit directories and a download button', async () => {
    server.use(...packageHandlers());

    const dialog = await openPackageDetail();

    expect(dialog).toHaveTextContent('包内容');
    expect(dialog).toHaveTextContent('下载技能包');
    // 目录优先且按名排序、其后是根文件；嵌套节点全部出现说明默认展开生效
    expect(packageTreeTitles()).toEqual([
      'assets',
      'logo.png  2.0 KB',
      'bin',
      'tool  1.0 KB',
      'references',
      'guide.md  2.0 KB',
      'scripts',
      'run.sh  1.0 KB',
      'SKILL.md  2.0 KB',
    ]);
    expect(packagePreview()).toHaveTextContent('选择左侧文件查看内容');
  });

  it('previews a markdown entry through the shared markdown renderer', async () => {
    server.use(...packageHandlers());
    await openPackageDetail();

    await clickPackageNode(/SKILL\.md/);

    await waitFor(() => expect(packagePreview().querySelector('h1')).not.toBeNull());
    expect(packagePreview().querySelector('h1') as HTMLElement).toHaveTextContent('技能说明');
    expect(packagePreview()).toHaveTextContent('这是包内的 Markdown 文件。');
    expect(packagePreview().querySelector('pre')).toBeNull();
  });

  it('previews a non-markdown text entry as wrapped plain text', async () => {
    server.use(...packageHandlers());
    await openPackageDetail();

    await clickPackageNode(/run\.sh/);

    await waitFor(() => expect(packagePreview().querySelector('pre')).not.toBeNull());
    const pre = packagePreview().querySelector('pre') as HTMLElement;
    expect(pre).toHaveTextContent('#!/bin/sh');
    expect(pre).toHaveTextContent('echo run');
    expect(pre.style.whiteSpace).toBe('pre-wrap');
    expect(packagePreview().querySelector('h1')).toBeNull();
  });

  it('shows metadata only for image and binary entries without fetching content', async () => {
    const onFileRequest = vi.fn();
    server.use(...packageHandlers({ onFileRequest }));
    await openPackageDetail();

    await clickPackageNode(/logo\.png/);
    await waitFor(() => expect(packagePreview()).toHaveTextContent('该文件不支持在线预览'));
    expect(packagePreview()).toHaveTextContent('图片');
    expect(packagePreview()).toHaveTextContent('2.0 KB');

    await clickPackageNode(/tool/);
    await waitFor(() => expect(packagePreview()).toHaveTextContent('二进制'));

    expect(onFileRequest).not.toHaveBeenCalled();
  });

  it('shows directory metadata without fetching content', async () => {
    const onFileRequest = vi.fn();
    server.use(...packageHandlers({ onFileRequest }));
    await openPackageDetail();

    await clickPackageNode(/^references$/);

    await waitFor(() => expect(packagePreview()).toHaveTextContent('目录 · 1 项'));
    expect(packagePreview()).toHaveTextContent('references');
    expect(onFileRequest).not.toHaveBeenCalled();
  });

  it('downloads the original package with the bearer token and stored file name', async () => {
    useAuthStore.getState().setTokens('access-token', 'refresh-token');
    vi.stubGlobal('fetch', vi.fn(async () => new Response(new Uint8Array([0x50, 0x4b, 0x03, 0x04]), {
      status: 200,
      headers: { 'Content-Type': 'application/zip' },
    })));
    const anchorClick = spyAnchorClick();
    server.use(...packageHandlers());
    await openPackageDetail();

    await userEvent.click(screen.getByRole('button', { name: /下载技能包/ }));

    await waitFor(() => expect(fetch).toHaveBeenCalled());
    const [input, init] = vi.mocked(fetch).mock.calls[0];
    expect(input).toBe('/api/skills/1/package/download');
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer access-token');
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);

    await waitFor(() => expect(anchorClick.spy).toHaveBeenCalledTimes(1));
    const link = anchorClick.anchor();
    if (!link) {
      throw new Error('未捕获到下载链接');
    }
    expect(link.getAttribute('href')).toBe('blob:skill-package');
    expect(link.download).toBe('custom-skill.zip');
    // revoke 被推迟到下一个宏任务，等它落地再断言，也避免定时器泄漏到后续用例
    await waitFor(() => expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:skill-package'));
  });

  it('falls back to a generated file name when the package file name is missing', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(new Uint8Array([0x50, 0x4b]), { status: 200 })));
    const anchorClick = spyAnchorClick();
    server.use(...packageHandlers({ skill: { ...PACKAGE_SKILL, packageFileName: undefined } }));
    await openPackageDetail();

    await userEvent.click(screen.getByRole('button', { name: /下载技能包/ }));

    await waitFor(() => expect(anchorClick.spy).toHaveBeenCalledTimes(1));
    expect(anchorClick.anchor()?.download).toBe('skill-package-1');
    await waitFor(() => expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1));
  });

  it('surfaces the backend message when the download fails', async () => {
    const errorSpy = vi.spyOn(message, 'error').mockImplementation(() => undefined as never);
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ success: false, code: '10404', message: '该技能无上传包' }),
      { status: 404, headers: { 'Content-Type': 'application/json' } },
    )));
    const anchorClickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    server.use(...packageHandlers());
    await openPackageDetail();

    await userEvent.click(screen.getByRole('button', { name: /下载技能包/ }));

    await waitFor(() => expect(errorSpy).toHaveBeenCalledWith('该技能无上传包'));
    expect(anchorClickSpy).not.toHaveBeenCalled();
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
  });

  it('falls back to a status message when the download error body is not JSON', async () => {
    const errorSpy = vi.spyOn(message, 'error').mockImplementation(() => undefined as never);
    vi.stubGlobal('fetch', vi.fn(async () => new Response('gateway boom', { status: 502 })));
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    server.use(...packageHandlers());
    await openPackageDetail();

    await userEvent.click(screen.getByRole('button', { name: /下载技能包/ }));

    await waitFor(() => expect(errorSpy).toHaveBeenCalledWith('下载失败（HTTP 502）'));
  });

  it('surfaces a listing failure as an alert and keeps the download button usable', async () => {
    server.use(...packageHandlers({
      filesBody: { success: false, code: '10404', message: '技能不存在', traceId: null },
    }));

    const dialog = await openPackageDetailWithListingFailure('技能不存在');

    expect(dialog.querySelector('.ant-alert-error')).not.toBeNull();
    expect(screen.getByRole('button', { name: /下载技能包/ })).toBeEnabled();
    // 报错时不再叠加空态：否则会被误读成"包本身没内容"。先等清单请求的 spinner 停下再断言。
    await waitFor(() => expect(dialog.querySelectorAll('.ant-spin-spinning')).toHaveLength(0));
    expect(screen.getByTestId('skill-package-tree')).not.toHaveTextContent('技能包为空');
    expect(packagePreview()).toHaveTextContent('选择左侧文件查看内容');
  });

  it('shows an empty state only when the listing succeeds with no entries', async () => {
    server.use(...packageHandlers({
      filesBody: {
        success: true, code: '0', message: '', traceId: null,
        data: { files: [], format: 'zip' },
      },
    }));

    // 不用 openPackageDetail：它等的是"至少一个树节点"，空清单永远等不到
    renderPage();
    await screen.findByText('custom-skill');
    await userEvent.click(screen.getByRole('button', { name: /详情/ }));
    await screen.findByRole('dialog');

    await waitFor(() => expect(screen.getByTestId('skill-package-tree')).toHaveTextContent('技能包为空'));
    expect(packagePreview()).toHaveTextContent('选择左侧文件查看内容');
  });

  it('surfaces a single-file load failure without leaving the spinner running', async () => {
    const errorSpy = vi.spyOn(message, 'error').mockImplementation(() => undefined as never);
    const files = [...PACKAGE_FILES, {
      path: 'notes.txt', name: 'notes.txt', dir: false, size: 10, kind: 'TEXT',
    }];
    server.use(...packageHandlers({
      filesBody: {
        success: true, code: '0', message: '', traceId: null,
        data: { files, format: 'zip' },
      },
    }));
    await openPackageDetail();

    // notes.txt 不在 FILE_CONTENTS 里，后端返回 success=false
    await clickPackageNode(/notes\.txt/);

    await waitFor(() => expect(errorSpy).toHaveBeenCalledWith('包内不存在该文件'));
    await waitFor(() => expect(packagePreview()).toHaveTextContent('内容加载失败'));
    expect(packagePreview().querySelector('.ant-spin')).toBeNull();
  });

  it('clears the package panel state when the detail modal is closed', async () => {
    server.use(...packageHandlers());
    await openPackageDetail();
    await clickPackageNode(/SKILL\.md/);
    await waitFor(() => expect(packagePreview().querySelector('h1')).not.toBeNull());

    // antd 默认 autoInsertSpace 会在两个中文字符之间插空格，可访问名实际是 "关 闭"
    await userEvent.click(screen.getByRole('button', { name: /关\s*闭/ }));

    // destroyOnClose 默认 false：关闭后弹窗内容会原样留在 DOM 里，断言节点卸载必然失败。
    // 容器被置为 display:none 后 dialog 不再可访问，用它判定 open 已复位。
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    // 重新打开：预览必须回到占位文案，而不是残留上一次的文件正文
    await userEvent.click(screen.getByRole('button', { name: /详情/ }));
    await screen.findByRole('dialog');
    await waitFor(() => expect(packageTreeTitles().length).toBeGreaterThan(0));
    await waitFor(() => expect(packagePreview()).toHaveTextContent('选择左侧文件查看内容'));
    expect(packagePreview().querySelector('h1')).toBeNull();
  });

  it('clears the preview and skips the request when the selected entry is deselected', async () => {
    const requested: Array<string | null> = [];
    server.use(...packageHandlers({ onFileRequest: (path) => { requested.push(path); } }));
    await openPackageDetail();
    await clickPackageNode(/SKILL\.md/);
    await waitFor(() => expect(packagePreview().querySelector('h1')).not.toBeNull());
    expect(requested).toEqual(['SKILL.md']);

    // 单选 Tree 再次点击已选中节点即取消选中，onSelect 收到空 keys
    await clickPackageNode(/SKILL\.md/);

    await waitFor(() => expect(packagePreview()).toHaveTextContent('选择左侧文件查看内容'));
    expect(packagePreview().querySelector('h1')).toBeNull();
    // 取消选中不得再发单文件请求：否则会把刚清空的面板重新填回内容
    expect(requested).toEqual(['SKILL.md']);
  });

  it('keeps the newer selection when an older single-file response arrives late', async () => {
    let releaseStale: () => void = () => undefined;
    const staleGate = new Promise<void>((resolve) => {
      releaseStale = () => resolve(undefined);
    });
    let completed = 0;
    server.use(
      http.get('/api/skills', () => HttpResponse.json({
        success: true, code: '0', message: '', traceId: null, data: [PACKAGE_SKILL],
      })),
      http.get('/api/skills/1/package/files', () => HttpResponse.json({
        success: true, code: '0', message: '', traceId: null,
        data: { files: PACKAGE_FILES, format: 'zip' },
      })),
      http.get('/api/skills/1/package/file', async ({ request }) => {
        const path = new URL(request.url).searchParams.get('path');
        // SKILL.md 先发出但后返回：模拟慢响应在新选择之后才落地
        if (path === 'SKILL.md') {
          await staleGate;
        }
        completed += 1;
        const content = FILE_CONTENTS[path ?? ''];
        return HttpResponse.json(content
          ? { success: true, code: '0', message: '', traceId: null, data: content }
          : { success: false, code: '10404', message: '包内不存在该文件', traceId: null });
      }),
    );
    await openPackageDetail();

    await clickPackageNode(/SKILL\.md/);
    await clickPackageNode(/guide\.md/);
    await waitFor(() => expect(packagePreview()).toHaveTextContent('参考文档'));

    releaseStale();
    await waitFor(() => expect(completed).toBe(2));
    // 给旧响应一次落地机会：序号守卫生效时预览不得被改写
    await new Promise((resolve) => { setTimeout(resolve, 0); });
    expect(packagePreview()).toHaveTextContent('参考文档');
    expect(packagePreview()).not.toHaveTextContent('这是包内的 Markdown 文件。');
  });
});
