package com.aliyun.autowonder.audit;

import com.aliyun.autowonder.context.AutoWonderContext;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Component
public class WebAuditInterceptor implements HandlerInterceptor {

    private static final Pattern FIRST_ID = Pattern.compile("/(\\d+)(?:/|$)");
    private static final String API_PREFIX = "/api/";
    private static final String ID_TOKEN = "ID";
    // audit_log.action is VARCHAR(64); a longer value makes MySQL reject the whole audit row.
    private static final int MAX_ACTION_CHARS = 64;
    // Shorter segments are words (reply, content), not opaque identifiers.
    private static final int MIN_OPAQUE_ID_CHARS = 16;

    private final AuditLogService auditLogService;

    public WebAuditInterceptor(AuditLogService auditLogService) {
        this.auditLogService = auditLogService;
    }

    @Override
    public void afterCompletion(HttpServletRequest request, HttpServletResponse response,
            Object handler, Exception ex) {
        if (!shouldAudit(request)) {
            return;
        }
        AutoWonderContext ctx = AutoWonderContext.get();
        Long tenantId = ctx.getCurrentWorkspaceId();
        Long userId = ctx.getUserId();
        if (tenantId == null || userId == null) {
            return;
        }
        String path = request.getRequestURI();
        AuditLogRecord record = new AuditLogRecord();
        record.setTenantId(tenantId);
        record.setActorId(userId);
        record.setActorType("HUMAN");
        record.setModule(moduleOf(path));
        record.setAction(actionOf(request.getMethod(), path));
        record.setTargetType(targetTypeOf(path));
        record.setTargetId(firstId(path));
        record.setTriggerType("ACTIVE");
        record.setTriggerSource("USER_CLICK");
        record.setEventType("http." + request.getMethod().toLowerCase(Locale.ROOT));
        record.detail("path", path)
                .detail("method", request.getMethod())
                .detail("status", response.getStatus())
                .detail("success", response.getStatus() < 400)
                .detail("query", request.getQueryString())
                .detail("error", ex != null ? ex.getClass().getSimpleName() : null);
        auditLogService.record(record);
    }

    private boolean shouldAudit(HttpServletRequest request) {
        String method = request.getMethod();
        String path = request.getRequestURI();
        if ("GET".equalsIgnoreCase(method) || "HEAD".equalsIgnoreCase(method)
                || "OPTIONS".equalsIgnoreCase(method)) {
            return false;
        }
        return path != null && path.startsWith("/api/")
                && !path.startsWith("/api/auth/")
                && !path.startsWith("/api/audit-logs")
                && !path.startsWith("/api/daemon/");
    }

    private String moduleOf(String path) {
        String type = targetTypeOf(path);
        return type == null ? "API" : type.toUpperCase(Locale.ROOT).replace('-', '_');
    }

    private String targetTypeOf(String path) {
        if (path == null || !path.startsWith("/api/")) {
            return null;
        }
        String rest = path.substring("/api/".length());
        int slash = rest.indexOf('/');
        String segment = slash >= 0 ? rest.substring(0, slash) : rest;
        return switch (segment) {
            case "workitems" -> "workitem";
            case "agents" -> "agent";
            case "skills" -> "skill";
            case "status-templates" -> "status-template";
            default -> segment;
        };
    }

    private Long firstId(String path) {
        Matcher matcher = FIRST_ID.matcher(path);
        if (!matcher.find()) {
            return null;
        }
        try {
            return Long.valueOf(matcher.group(1));
        } catch (NumberFormatException ignored) {
            return null;
        }
    }

    private String actionOf(String method, String path) {
        String prefix = switch (method.toUpperCase(Locale.ROOT)) {
            case "POST" -> "CREATE";
            case "PUT", "PATCH" -> "UPDATE";
            case "DELETE" -> "DELETE";
            default -> method.toUpperCase(Locale.ROOT);
        };
        List<String> tokens = pathTokens(path);
        String action = joinAction(prefix, tokens);
        if (action.length() <= MAX_ACTION_CHARS) {
            return action;
        }
        return collapseAction(prefix, tokens);
    }

    private List<String> pathTokens(String path) {
        List<String> tokens = new ArrayList<>();
        for (String segment : path.substring(API_PREFIX.length()).split("/")) {
            if (segment.isEmpty()) {
                continue;
            }
            if (isIdentifier(segment)) {
                tokens.add(ID_TOKEN);
                continue;
            }
            for (String piece : segment.toUpperCase(Locale.ROOT).split("[^A-Z0-9]+")) {
                if (!piece.isEmpty()) {
                    tokens.add(piece);
                }
            }
        }
        return tokens;
    }

    private boolean isIdentifier(String segment) {
        boolean numeric = true;
        boolean hexShaped = segment.length() >= MIN_OPAQUE_ID_CHARS;
        boolean digitSeen = false;
        for (int i = 0; i < segment.length(); i++) {
            char c = segment.charAt(i);
            boolean digit = c >= '0' && c <= '9';
            boolean hexLetter = (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F');
            numeric &= digit;
            digitSeen |= digit;
            hexShaped &= digit || hexLetter || c == '-';
        }
        return numeric || (hexShaped && digitSeen);
    }

    private String collapseAction(String prefix, List<String> tokens) {
        List<String> collapsed = new ArrayList<>();
        if (!tokens.isEmpty()) {
            collapsed.add(tokens.get(0));
            String last = tokens.get(tokens.size() - 1);
            if (!last.equals(collapsed.get(0))) {
                collapsed.add(last);
            }
        }
        String action = joinAction(prefix, collapsed);
        if (action.length() <= MAX_ACTION_CHARS) {
            return action;
        }
        String cut = action.substring(0, MAX_ACTION_CHARS);
        int end = cut.length();
        while (end > 0 && cut.charAt(end - 1) == '_') {
            end--;
        }
        return cut.substring(0, end);
    }

    private String joinAction(String prefix, List<String> tokens) {
        return tokens.isEmpty() ? prefix : prefix + "_" + String.join("_", tokens);
    }
}
