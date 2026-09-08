package com.aliyun.autowonder.access.dto;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class PlatformAdminVO {
    private Long userId;
    private String username;
    private String nickname;
    private String email;
    /** True when the row is a deactivated account that still holds {@code is_admin = 1}. */
    private boolean active;
    /** True when this row is the caller, who may never remove themselves. */
    private boolean self;
    private boolean removable;
    /** Non-null exactly when {@code removable} is false, so the UI can explain a disabled button. */
    private String removeDisabledReason;
}
