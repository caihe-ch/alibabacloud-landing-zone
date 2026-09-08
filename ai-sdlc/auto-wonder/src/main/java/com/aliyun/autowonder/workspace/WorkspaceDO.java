package com.aliyun.autowonder.workspace;

import lombok.Getter;
import lombok.Setter;
import java.util.Date;

@Getter
@Setter
public class WorkspaceDO {
    private Long id;
    private String name;
    /**
     * Name-uniqueness key (D2): equals {@link #name} while the workspace is in use and is
     * set to NULL on logical delete, which releases the name for a new workspace. NULL is
     * never part of {@code uk_active_name} in MySQL, so any number of deleted rows can share it.
     */
    private String activeNameKey;
    private String slug;
    private String description;
    private String background;
    private Long ownerId;
    private Integer status;
    private Date gmtCreate;
    private Date gmtModified;
    private Long creatorId;
    private Long modifierId;
    private Integer isDeleted;
    private Date deletedAt;
    private Long deletedBy;
    private Integer version;
}
