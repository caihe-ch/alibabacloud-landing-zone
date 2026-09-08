package com.aliyun.autowonder.access;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

/**
 * Startup self-heal for the platform-admin flag (D3).
 *
 * <p>The upgrade migration marks the first active user as admin, but a database that was
 * created before the flag existed, or restored without running migrations, would otherwise
 * have no platform admin at all — and then nobody could open the workspace recycle bin.
 * Re-running the promotion on boot is idempotent, so this costs one count query.
 */
@Component
public class SystemAdminBootstrap implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(SystemAdminBootstrap.class);

    private final SystemAdminService systemAdminService;

    public SystemAdminBootstrap(SystemAdminService systemAdminService) {
        this.systemAdminService = systemAdminService;
    }

    @Override
    public void run(ApplicationArguments args) {
        try {
            if (systemAdminService.ensureSystemAdmin()) {
                log.info("Marked the first active user as platform admin");
            }
        } catch (RuntimeException exception) {
            // Never block boot on a self-heal: isSystemAdmin still falls back to the
            // first-active-user rule, so the platform stays manageable until this succeeds.
            log.warn("Platform admin self-heal skipped", exception);
        }
    }
}
