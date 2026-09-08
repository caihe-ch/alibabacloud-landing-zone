package com.aliyun.autowonder.mcp.dto;

import lombok.Getter;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
public class WorkitemCliDownloadTokenVO {
    private String token;
    private String tokenType;
    private long expiresInSeconds;
    private String expiresAt;
    private String serverUrl;
    private String runtimeVersion;
    private String tokenEnvName;
    private String command;
    private String powershellCommand;
    private List<String> supportedExtensions;
}
