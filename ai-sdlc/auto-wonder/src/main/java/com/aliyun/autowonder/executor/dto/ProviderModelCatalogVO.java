package com.aliyun.autowonder.executor.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Date;
import java.util.List;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class ProviderModelCatalogVO {
    private String provider;
    private List<ProviderModelCatalogItemVO> models;
    private Date lastSuccessfulAt;
}
