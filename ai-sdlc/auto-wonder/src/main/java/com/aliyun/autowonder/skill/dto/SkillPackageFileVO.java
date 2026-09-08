package com.aliyun.autowonder.skill.dto;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class SkillPackageFileVO {
    private String path;
    private String name;
    private Boolean dir;
    private Long size;
    private String kind;

    public SkillPackageFileVO() {
    }

    public SkillPackageFileVO(String path, String name, boolean dir, Long size, String kind) {
        this.path = path;
        this.name = name;
        this.dir = dir;
        this.size = size;
        this.kind = kind;
    }
}
