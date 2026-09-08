package com.aliyun.autowonder.aiusage.dto;

import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.util.List;

/** 工单级 credits 汇总：总计 + 按数字人执行轮次拆分的明细。 */
@Getter
@Setter
public class WorkitemUsageSummaryVO {
    private BigDecimal credits;
    private List<WorkitemUsageRunVO> runs;
}
