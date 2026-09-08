import { describe, it, expect } from 'vitest';
import { buildStartupCommand, buildStartupDebugCommand, debugLogFileName } from './startupCommand';

function decodePowerShellCommand(command: string): string {
  const encoded = command.replace(/^powershell -NoProfile -EncodedCommand /, '');
  const binary = atob(encoded);
  let decoded = '';
  for (let index = 0; index < binary.length; index += 2) {
    decoded += String.fromCharCode(binary.charCodeAt(index) | (binary.charCodeAt(index + 1) << 8));
  }
  return decoded;
}

describe('debugLogFileName', () => {
  it.each([
    ['QODER_CLI', 'qoder'],
    ['QODER_CN_CLI', 'qodercn'],
    ['CLAUDE_CODE', 'claude'],
    ['CODEX_CLI', 'codex'],
    ['CURSOR_CLI', 'cursor'],
  ])('maps %s to provider %s', (clientKind, provider) => {
    expect(debugLogFileName(clientKind, 10000, new Date(2026, 7, 24, 15, 30, 42)))
      .toBe(`aw-${provider}-10000-260824-15-30-42.log`);
  });

  it('falls back to claude for an unknown client kind', () => {
    expect(debugLogFileName('SOMETHING_NEW', 7, new Date(2026, 7, 24, 15, 30, 42)))
      .toBe('aw-claude-7-260824-15-30-42.log');
  });

  it('zero-pads every timestamp component including a single-digit year', () => {
    expect(debugLogFileName('CLAUDE_CODE', 1, new Date(2006, 0, 5, 9, 8, 7)))
      .toBe('aw-claude-1-060105-09-08-07.log');
  });
});

describe('buildStartupDebugCommand', () => {
  const NOW = new Date(2026, 7, 24, 15, 30, 42);
  it('appends --debug and a bash tee redirect', () => {
    expect(buildStartupDebugCommand(
      'exec_test_token', 10000, 'CLAUDE_CODE', 'platform',
      'https://daily.auto-wonder.example.com/api/mcp', '0.2.138', undefined,
      'bash', NOW,
    )).toBe(
      'npx -y autowonder@0.2.138 connect --ws-url wss://daily.auto-wonder.example.com/ws/executor'
      + ' --token exec_test_token --executor-id 10000 --provider claude --memory-mode platform'
      + ' --debug 2>&1 | tee ~/aw-claude-10000-260824-15-30-42.log',
    );
  });

  it('builds an encoded PowerShell debug command', () => {
    const command = buildStartupDebugCommand(
      'exec_test_token', 10000, 'CLAUDE_CODE', 'platform',
      'https://daily.auto-wonder.example.com/api/mcp', '0.2.138', undefined,
      'powershell', NOW,
    );

    expect(command).toMatch(/^powershell -NoProfile -EncodedCommand [A-Za-z0-9+/=]+$/);
    expect(decodePowerShellCommand(command)).toContain(
      'npx -y autowonder@0.2.138 connect --ws-url wss://daily.auto-wonder.example.com/ws/executor'
      + ' --token exec_test_token --executor-id 10000 --provider claude --memory-mode platform'
      + ' --debug 2>&1 | Tee-Object -FilePath "$HOME/aw-claude-10000-260824-15-30-42.log"',
    );
  });

  it('keeps every Qoder flag ahead of the debug suffix', () => {
    expect(buildStartupDebugCommand(
      'exec_test_token', 10000, 'QODER_CLI', 'platform',
      'https://daily.auto-wonder.example.com/api/mcp', '0.2.138',
      { model: 'ultimate', reasoningEffort: 'high', contextWindow: '1000000' },
      'bash', NOW,
    )).toBe(
      'npx -y autowonder@0.2.138 connect --ws-url wss://daily.auto-wonder.example.com/ws/executor'
      + ' --token exec_test_token --executor-id 10000 --provider qoder --memory-mode platform'
      + ' --model ultimate --reasoning-effort high --context-window 1000000'
      + ' --token-aware-enable'
      + ' --debug 2>&1 | tee ~/aw-qoder-10000-260824-15-30-42.log',
    );
  });

  it('encodes PowerShell debug commands that contain dynamic Qoder model IDs', () => {
    const command = buildStartupDebugCommand(
      'exec_test_token', 10000, 'QODER_CLI', 'platform',
      'https://daily.auto-wonder.example.com/api/mcp', '0.2.138',
      { model: `new model'; Start-Process calc`, reasoningEffort: 'high', contextWindow: '1000000' },
      'powershell', NOW,
    );

    expect(command).toMatch(/^powershell -NoProfile -EncodedCommand [A-Za-z0-9+/=]+$/);
    expect(command).not.toContain('Start-Process calc');
    expect(decodePowerShellCommand(command)).toContain(`--model 'new model''; Start-Process calc' --reasoning-effort high --context-window 1000000 --token-aware-enable --debug 2>&1 | Tee-Object`);
  });

  it('places --debug after all flags and before the redirect operator', () => {
    const cmd = buildStartupDebugCommand(
      'exec_test_token', 10000, 'CLAUDE_CODE', 'platform',
      'https://daily.auto-wonder.example.com/api/mcp', '0.2.138', undefined,
      'bash', NOW,
    );
    expect(cmd.indexOf('--memory-mode')).toBeLessThan(cmd.indexOf('--debug'));
    expect(cmd.indexOf('--debug')).toBeLessThan(cmd.indexOf('2>&1'));
    expect(cmd.indexOf('2>&1')).toBeLessThan(cmd.indexOf('| tee'));
  });

  it('uses the same log file name that debugLogFileName produces', () => {
    expect(buildStartupDebugCommand(
      'exec_test_token', 10000, 'CLAUDE_CODE', 'platform',
      'https://daily.auto-wonder.example.com/api/mcp', '0.2.138', undefined,
      'bash', NOW,
    )).toContain(debugLogFileName('CLAUDE_CODE', 10000, NOW));
  });
});

describe('buildStartupCommand shell quoting', () => {
  it('quotes dynamic Qoder model IDs safely for POSIX shells', () => {
    expect(buildStartupCommand(
      'exec_test_token',
      10000,
      'QODER_CLI',
      'platform',
      'http://daily.auto-wonder.example.com/api/mcp',
      '0.2.130',
      {
        model: `new model'; touch /tmp/pwned`,
        reasoningEffort: 'high',
        contextWindow: '1000000',
      },
    )).toContain(`--model 'new model'\\''; touch /tmp/pwned' --reasoning-effort high`);
  });

  it('encodes PowerShell startup commands that contain dynamic Qoder model IDs', () => {
    const command = buildStartupCommand(
      'exec_test_token',
      10000,
      'QODER_CLI',
      'platform',
      'http://daily.auto-wonder.example.com/api/mcp',
      '0.2.130',
      {
        model: `new model'; Start-Process calc`,
        reasoningEffort: 'high',
        contextWindow: '1000000',
      },
      'windows',
    );

    expect(command).toMatch(/^powershell -NoProfile -EncodedCommand [A-Za-z0-9+/=]+$/);
    expect(command).not.toContain('Start-Process calc');
    expect(decodePowerShellCommand(command)).toContain(`--model 'new model''; Start-Process calc' --reasoning-effort high`);
  });

  it('keeps double quotes inside the encoded PowerShell startup command', () => {
    const command = buildStartupCommand(
      'exec_test_token',
      10000,
      'QODER_CLI',
      'platform',
      'http://daily.auto-wonder.example.com/api/mcp',
      '0.2.130',
      {
        model: `model"; Start-Process calc; "tail`,
        reasoningEffort: 'high',
        contextWindow: '1000000',
      },
      'windows',
    );

    expect(command).toMatch(/^powershell -NoProfile -EncodedCommand [A-Za-z0-9+/=]+$/);
    expect(command).not.toContain('Start-Process calc');
    expect(decodePowerShellCommand(command)).toContain(`--model 'model"; Start-Process calc; "tail' --reasoning-effort high`);
  });
});
