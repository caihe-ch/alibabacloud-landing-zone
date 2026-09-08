package com.aliyun.autowonder.executor.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * One selectable value assembled by the server, so MCP callers never hardcode option lists.
 */
@Data
@AllArgsConstructor
@NoArgsConstructor
public class SelectOptionVO {
    private String value;
    private String label;
    private String description;

    public static SelectOptionVO of(String value, String label) {
        return new SelectOptionVO(value, label, null);
    }
}
