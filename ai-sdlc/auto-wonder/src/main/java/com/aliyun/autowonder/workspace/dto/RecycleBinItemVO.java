package com.aliyun.autowonder.workspace.dto;

import lombok.Getter;
import lombok.Setter;

import java.util.Date;

/**
 * One recycle-bin row (F4). Carries only what the page renders — no members, no business data —
 * and never exposes another tenant's rows, since identity filtering happens in SQL.
 */
@Getter
@Setter
public class RecycleBinItemVO {
    private Long id;
    private String name;
    private String description;
    private Long ownerId;
    private String ownerName;
    private Date deletedAt;
    private Long deletedBy;
    private String deletedByName;
    /** False when an in-use workspace already holds this name, so restore needs a rename. */
    private Boolean restorable;
}
