import type { QoderLaunchOptions } from './qoderOptions';

export type DebugShell = 'bash' | 'powershell';

const PROVIDER_MAP: Record<string, string> = {
  QODER_CN_CLI: 'qodercn',
  QODER_CLI: 'qoder',
  CLAUDE_CODE: 'claude',
  CODEX_CLI: 'codex',
  CURSOR_CLI: 'cursor',
};

export function resolveProvider(clientKind: string): string {
  return PROVIDER_MAP[clientKind] ?? 'claude';
}

export function buildWsUrl(mcpBaseUrl: string): string {
  let url: URL;
  try {
    url = new URL(mcpBaseUrl);
  } catch {
    throw new Error('MCP 地址格式不合法');
  }
  const proto = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${url.host}/ws/executor`;
}

export type StartupOs = 'windows' | 'posix';

export function detectStartupOs(): StartupOs {
  try {
    const platform = (navigator.platform ?? '').toLowerCase();
    const hint = platform || (navigator.userAgent ?? '').toLowerCase();
    if (hint.includes('win')) {
      return 'windows';
    }
  } catch {
    // navigator unavailable — fall through to the default command
  }
  return 'posix';
}

const SAFE_SHELL_ARG = /^[A-Za-z0-9_@%+=:,./-]+$/;

function quotePosixArg(value: string): string {
  if (SAFE_SHELL_ARG.test(value)) return value;
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function quotePowerShellArg(value: string): string {
  if (SAFE_SHELL_ARG.test(value)) return value;
  return `'${value.replace(/'/g, `''`)}'`;
}

function encodePowerShellCommand(command: string): string {
  const bytes: number[] = [];
  for (let index = 0; index < command.length; index += 1) {
    const code = command.charCodeAt(index);
    bytes.push(code & 0xff, code >> 8);
  }
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function buildStartupArgv(
  token: string,
  executorId: number,
  clientKind: string,
  memoryMode: string,
  mcpBaseUrl: string,
  runtimeVersion: string,
  qoder?: QoderLaunchOptions,
): string[] {
  const provider = resolveProvider(clientKind);
  const isQoderFamily = provider === 'qoder' || provider === 'qodercn';
  const argv = [
    'npx', '-y', `autowonder@${runtimeVersion}`, 'connect',
    '--ws-url', buildWsUrl(mcpBaseUrl),
    '--token', token,
    '--executor-id', String(executorId),
    '--provider', provider,
    '--memory-mode', memoryMode,
  ];
  if (isQoderFamily && qoder) {
    argv.push('--model', qoder.model, '--reasoning-effort', qoder.reasoningEffort, '--context-window', qoder.contextWindow);
  }
  if (isQoderFamily) {
    argv.push('--token-aware-enable');
  }
  return argv;
}

export function buildStartupCommand(
  token: string,
  executorId: number,
  clientKind: string,
  memoryMode: string,
  mcpBaseUrl: string,
  runtimeVersion: string,
  qoder?: QoderLaunchOptions,
  os: StartupOs = 'posix',
): string {
  const argv = buildStartupArgv(token, executorId, clientKind, memoryMode, mcpBaseUrl, runtimeVersion, qoder);
  if (os === 'windows') {
    // Session-level UTF-8 console so Chinese progress output is not mangled on CP936 systems;
    // affects only the launched process session, never the user's system configuration.
    const command = argv.map(quotePowerShellArg).join(' ');
    const script = `[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; $OutputEncoding = [System.Text.Encoding]::UTF8; ${command}`;
    return `powershell -NoProfile -EncodedCommand ${encodePowerShellCommand(script)}`;
  }
  return argv.map(quotePosixArg).join(' ');
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

export function debugLogFileName(clientKind: string, executorId: number, now: Date): string {
  const date = `${pad(now.getFullYear() % 100)}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
  const time = `${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
  return `aw-${resolveProvider(clientKind)}-${executorId}-${date}-${time}.log`;
}

export function buildStartupDebugCommand(
  token: string,
  executorId: number,
  clientKind: string,
  memoryMode: string,
  mcpBaseUrl: string,
  runtimeVersion: string,
  qoder: QoderLaunchOptions | undefined,
  shell: DebugShell,
  now: Date,
): string {
  const logFile = debugLogFileName(clientKind, executorId, now);
  const argv = [...buildStartupArgv(token, executorId, clientKind, memoryMode, mcpBaseUrl, runtimeVersion, qoder), '--debug'];
  if (shell === 'powershell') {
    const command = `${argv.map(quotePowerShellArg).join(' ')} 2>&1 | Tee-Object -FilePath "$HOME/${logFile}"`;
    const script = `[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; $OutputEncoding = [System.Text.Encoding]::UTF8; ${command}`;
    return `powershell -NoProfile -EncodedCommand ${encodePowerShellCommand(script)}`;
  }
  return `${argv.map(quotePosixArg).join(' ')} 2>&1 | tee ~/${logFile}`;
}
