package com.aliyun.autowonder.skill.dto;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class SkillPackageFileContentVO {
    private String path;
    private String fileName;
    private String content;
    private Boolean binary;

    public SkillPackageFileContentVO() {
    }

    public SkillPackageFileContentVO(String path, String fileName, String content) {
        this.path = path;
        this.fileName = fileName;
        this.content = content;
        this.binary = false;
    }
}
