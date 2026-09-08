package com.aliyun.autowonder.skill.dto;

import lombok.Getter;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
public class SkillPackageFilesVO {
    private List<SkillPackageFileVO> files;
    private String format;

    public SkillPackageFilesVO() {
    }

    public SkillPackageFilesVO(List<SkillPackageFileVO> files, String format) {
        this.files = files;
        this.format = format;
    }
}
