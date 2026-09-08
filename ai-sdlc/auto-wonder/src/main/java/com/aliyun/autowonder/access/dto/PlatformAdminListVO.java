package com.aliyun.autowonder.access.dto;

import lombok.Getter;
import lombok.Setter;

import java.util.ArrayList;
import java.util.List;

@Getter
@Setter
public class PlatformAdminListVO {
    private List<PlatformAdminVO> admins = new ArrayList<>();
    /** Whether the caller may add or remove platform admins. */
    private boolean canManage;
}
