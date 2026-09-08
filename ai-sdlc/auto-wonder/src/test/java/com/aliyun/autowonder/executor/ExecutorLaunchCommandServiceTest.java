package com.aliyun.autowonder.executor;

import com.aliyun.autowonder.branding.PlatformBrandingService;
import com.aliyun.autowonder.common.error.BizException;
import com.aliyun.autowonder.executor.dto.ExecutorLaunchCommandVO;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.Base64;
import java.util.Date;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/**
 * Locks the server-side launch command to frontend/src/features/executor/startupCommand.ts: the page
 * and the MCP tool must hand an operator the same bytes for the same inputs.
 */
class ExecutorLaunchCommandServiceTest {

    private static final String BASE_URL = "https://auto-wonder.example.com";
    private static final String RUNTIME_VERSION = "0.2.152";
    private static final String WS_URL = "wss://auto-wonder.example.com/ws/executor";
    private static final String PREAMBLE =
            "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; "
                    + "$OutputEncoding = [System.Text.Encoding]::UTF8; ";

    PlatformBrandingService brandingService;
    ExecutorLaunchCommandService service;
    Date now;

    @BeforeEach
    void setUp() {
        brandingService = mock(PlatformBrandingService.class);
        when(brandingService.trustedPublicBaseUrl()).thenReturn(BASE_URL);
        when(brandingService.recommendedRuntimeVersion()).thenReturn(RUNTIME_VERSION);
        service = new ExecutorLaunchCommandService(brandingService);
        now = Date.from(ZonedDateTime.of(2026, 9, 4, 13, 45, 0, 0, ZoneId.systemDefault()).toInstant());
    }

    @Test
    void posixCommandMatchesThePageArgv() {
        ExecutorLaunchCommandVO vo = build("awexec_plain", "QODER_CLI", "platform", "qmodel_latest",
                "medium", "260000", "posix", false, null);

        assertEquals("npx -y autowonder@" + RUNTIME_VERSION + " connect"
                + " --ws-url " + WS_URL
                + " --token awexec_plain"
                + " --executor-id 9"
                + " --provider qoder"
                + " --memory-mode platform"
                + " --model qmodel_latest"
                + " --reasoning-effort medium"
                + " --context-window 260000"
                + " --token-aware-enable", vo.getCommand());
        assertEquals(WS_URL, vo.getWsUrl());
        assertEquals(RUNTIME_VERSION, vo.getRuntimeVersion());
        assertEquals("qoder", vo.getProvider());
        assertEquals("posix", vo.getOs());
        assertFalse(vo.isDebug());
        assertNull(vo.getShell());
        assertNull(vo.getLogFileName());
    }

    @Test
    void qoderCnCliUsesTheCnProvider() {
        ExecutorLaunchCommandVO vo = build("awexec_plain", "QODER_CN_CLI", "none", "auto",
                "high", "1000000", "posix", false, null);

        assertEquals("qodercn", vo.getProvider());
        assertTrue(vo.getCommand().contains("--provider qodercn"));
        assertTrue(vo.getCommand().contains("--memory-mode none"));
        assertTrue(vo.getCommand().contains("--model auto --reasoning-effort high --context-window 1000000"));
    }

    @Test
    void windowsCommandIsAnEncodedPowerShellScript() {
        ExecutorLaunchCommandVO vo = build("awexec_plain", "QODER_CLI", "platform", "qmodel_latest",
                "medium", "260000", "windows", false, null);

        assertEquals("windows", vo.getOs());
        assertNull(vo.getShell());
        assertTrue(vo.getCommand().startsWith("powershell -NoProfile -EncodedCommand "));
        assertEquals(PREAMBLE + "npx -y autowonder@" + RUNTIME_VERSION + " connect"
                        + " --ws-url " + WS_URL
                        + " --token awexec_plain"
                        + " --executor-id 9"
                        + " --provider qoder"
                        + " --memory-mode platform"
                        + " --model qmodel_latest"
                        + " --reasoning-effort medium"
                        + " --context-window 260000"
                        + " --token-aware-enable",
                decode(vo.getCommand()));
    }

    @Test
    void debugBashCommandTeesToThePageLogFileName() {
        ExecutorLaunchCommandVO vo = buildAt("awexec_plain", "QODER_CLI", "platform", "qmodel_latest",
                "medium", "260000", "posix", true, null, now);

        assertEquals("bash", vo.getShell());
        assertEquals("aw-qoder-9-260904-13-45-00.log", vo.getLogFileName());
        assertTrue(vo.getCommand().endsWith(" --token-aware-enable --debug"
                + " 2>&1 | tee ~/aw-qoder-9-260904-13-45-00.log"));
    }

    @Test
    void debugOnWindowsDefaultsToPowerShellAndTeeObject() {
        ExecutorLaunchCommandVO vo = buildAt("awexec_plain", "QODER_CLI", "platform", "qmodel_latest",
                "medium", "260000", "windows", true, null, now);

        assertEquals("powershell", vo.getShell());
        assertEquals("aw-qoder-9-260904-13-45-00.log", vo.getLogFileName());
        assertTrue(decode(vo.getCommand()).endsWith(" --token-aware-enable --debug"
                + " 2>&1 | Tee-Object -FilePath \"$HOME/aw-qoder-9-260904-13-45-00.log\""));
    }

    @Test
    void debugShellCanBeOverriddenOnWindows() {
        ExecutorLaunchCommandVO vo = buildAt("awexec_plain", "QODER_CLI", "platform", "qmodel_latest",
                "medium", "260000", "windows", true, "bash", now);

        assertEquals("bash", vo.getShell());
        assertTrue(vo.getCommand().endsWith(" 2>&1 | tee ~/aw-qoder-9-260904-13-45-00.log"));
    }

    @Test
    void nonDebugIgnoresTheShellArgument() {
        ExecutorLaunchCommandVO vo = build("awexec_plain", "QODER_CLI", "platform", "qmodel_latest",
                "medium", "260000", "posix", false, "zsh");

        assertNull(vo.getShell());
        assertFalse(vo.getCommand().contains("--debug"));
    }

    @Test
    void qoderExecutorWithoutAModelStillEnablesTokenAwareness() {
        ExecutorLaunchCommandVO vo = build("awexec_plain", "QODER_CLI", "platform", null,
                null, null, "posix", false, null);

        assertEquals("qoder", vo.getProvider());
        assertEquals("npx -y autowonder@" + RUNTIME_VERSION + " connect"
                + " --ws-url " + WS_URL
                + " --token awexec_plain"
                + " --executor-id 9"
                + " --provider qoder"
                + " --memory-mode platform"
                + " --token-aware-enable", vo.getCommand());
        assertNull(vo.getModel());
        assertNull(vo.getReasoningEffort());
        assertNull(vo.getContextWindow());
    }

    @Test
    void legacyClientKindDropsQoderOnlyFlagsAndModelValues() {
        ExecutorLaunchCommandVO vo = build("awexec_plain", "CLAUDE_CODE", "provider-local", "qmodel_latest",
                "medium", "260000", "posix", false, null);

        assertEquals("claude", vo.getProvider());
        assertEquals("npx -y autowonder@" + RUNTIME_VERSION + " connect"
                + " --ws-url " + WS_URL
                + " --token awexec_plain"
                + " --executor-id 9"
                + " --provider claude"
                + " --memory-mode provider-local", vo.getCommand());
        assertNull(vo.getModel());
        assertNull(vo.getReasoningEffort());
        assertNull(vo.getContextWindow());
    }

    @Test
    void unknownClientKindFallsBackToTheClaudeProviderLikeThePage() {
        ExecutorLaunchCommandVO vo = build("awexec_plain", "MYSTERY_CLI", "platform", null,
                null, null, "posix", false, null);

        assertEquals("claude", vo.getProvider());
        assertTrue(vo.getCommand().contains("--provider claude"));
    }

    @Test
    void missingOsDefaultsToPosix() {
        assertEquals("posix", build("awexec_plain", "QODER_CLI", "platform", "auto", "medium",
                "260000", null, false, null).getOs());
        assertEquals("posix", build("awexec_plain", "QODER_CLI", "platform", "auto", "medium",
                "260000", "  ", false, null).getOs());
        assertEquals("windows", build("awexec_plain", "QODER_CLI", "platform", "auto", "medium",
                "260000", " Windows ", false, null).getOs());
    }

    @Test
    void unsafeArgumentsAreQuotedPerShell() {
        ExecutorLaunchCommandVO posix = build("aw exec'token", "QODER_CLI", "platform", "auto",
                "medium", "260000", "posix", false, null);
        assertTrue(posix.getCommand().contains("--token 'aw exec'\\''token'"), posix.getCommand());

        ExecutorLaunchCommandVO windows = build("aw exec'token", "QODER_CLI", "platform", "auto",
                "medium", "260000", "windows", false, null);
        assertTrue(decode(windows.getCommand()).contains("--token 'aw exec''token'"));
    }

    @Test
    void blankTokenIsRejected() {
        BizException ex = assertThrows(BizException.class, () -> build("  ", "QODER_CLI", "platform",
                "auto", "medium", "260000", "posix", false, null));
        assertEquals("27003", ex.getCode());
    }

    @Test
    void invalidOsIsRejected() {
        BizException ex = assertThrows(BizException.class, () -> build("awexec_plain", "QODER_CLI",
                "platform", "auto", "medium", "260000", "macos", false, null));
        assertEquals("27003", ex.getCode());
        assertTrue(ex.getMessage().contains("os 仅支持 posix/windows"));
    }

    @Test
    void invalidDebugShellIsRejected() {
        BizException ex = assertThrows(BizException.class, () -> build("awexec_plain", "QODER_CLI",
                "platform", "auto", "medium", "260000", "posix", true, "zsh"));
        assertEquals("27003", ex.getCode());
        assertTrue(ex.getMessage().contains("shell 仅支持 bash/powershell"));
    }

    @Test
    void missingPlatformBaseUrlIsRejected() {
        when(brandingService.trustedPublicBaseUrl()).thenReturn(null);

        BizException ex = assertThrows(BizException.class, () -> build("awexec_plain", "QODER_CLI",
                "platform", "auto", "medium", "260000", "posix", false, null));

        assertEquals("10000", ex.getCode());
    }

    @Test
    void publicBuildUsesTheCurrentTimeForTheDebugLogName() {
        ExecutorLaunchCommandVO vo = service.build("awexec_plain", 9L, "QODER_CLI", "platform",
                "auto", "medium", "260000", "posix", true, "bash");

        assertTrue(vo.getLogFileName().matches("aw-qoder-9-\\d{6}-\\d{2}-\\d{2}-\\d{2}\\.log"),
                vo.getLogFileName());
        assertTrue(vo.getCommand().endsWith("| tee ~/" + vo.getLogFileName()));
    }

    @Test
    void buildWsUrlMirrorsThePageDerivation() {
        assertEquals("wss://auto-wonder.example.com/ws/executor",
                ExecutorLaunchCommandService.buildWsUrl("https://auto-wonder.example.com/api/mcp"));
        assertEquals("ws://localhost:8080/ws/executor",
                ExecutorLaunchCommandService.buildWsUrl("http://localhost:8080"));
        assertEquals("wss://auto-wonder.example.com/ws/executor",
                ExecutorLaunchCommandService.buildWsUrl("  HTTPS://Auto-Wonder.Example.COM:443/api/mcp  "));
        assertEquals("ws://auto-wonder.example.com/ws/executor",
                ExecutorLaunchCommandService.buildWsUrl("http://auto-wonder.example.com:80/api/mcp"));
    }

    @Test
    void buildWsUrlRejectsUnusableAddresses() {
        for (String url : new String[]{"ftp://auto-wonder.example.com", "not a url", "//example.com", "http://"}) {
            BizException ex = assertThrows(BizException.class,
                    () -> ExecutorLaunchCommandService.buildWsUrl(url), url);
            assertEquals("10001", ex.getCode(), url);
        }
    }

    @Test
    void debugLogFileNameUsesTheProviderAndPaddedTimestamp() {
        assertEquals("aw-qodercn-12-260904-13-45-00.log",
                ExecutorLaunchCommandService.debugLogFileName("QODER_CN_CLI", 12L, now));
        assertEquals("aw-claude-3-260904-13-45-00.log",
                ExecutorLaunchCommandService.debugLogFileName("CLAUDE_CODE", 3L, now));
    }

    private ExecutorLaunchCommandVO build(String token, String clientKind, String memoryMode, String model,
            String reasoningEffort, String contextWindow, String os, boolean debug, String shell) {
        return buildAt(token, clientKind, memoryMode, model, reasoningEffort, contextWindow, os, debug, shell, now);
    }

    private ExecutorLaunchCommandVO buildAt(String token, String clientKind, String memoryMode, String model,
            String reasoningEffort, String contextWindow, String os, boolean debug, String shell, Date at) {
        return service.buildAt(token, 9L, clientKind, memoryMode, model, reasoningEffort, contextWindow,
                os, debug, shell, at);
    }

    private static String decode(String command) {
        String encoded = command.substring("powershell -NoProfile -EncodedCommand ".length());
        return new String(Base64.getDecoder().decode(encoded), StandardCharsets.UTF_16LE);
    }
}
