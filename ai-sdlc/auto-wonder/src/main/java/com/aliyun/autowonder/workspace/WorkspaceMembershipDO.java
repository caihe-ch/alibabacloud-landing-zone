package com.aliyun.autowonder.workspace;

import lombok.Getter;
import lombok.Setter;

/** An workspace the user belongs to, joined with that user's membership access level. */
@Getter
@Setter
public class WorkspaceMembershipDO {
    private Long id;
    private String name;
    private String description;
    /** org.owner_id (D8): there is no OWNER access level, so ownership is read off the workspace. */
    private Long ownerId;
    private String accessLevel;
}
