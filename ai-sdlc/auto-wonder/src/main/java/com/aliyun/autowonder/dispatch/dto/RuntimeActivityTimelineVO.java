package com.aliyun.autowonder.dispatch.dto;

import lombok.Getter;
import lombok.Setter;

import java.util.ArrayList;
import java.util.List;

@Getter
@Setter
public class RuntimeActivityTimelineVO {
    private Long dispatchId;
    private List<Activity> activities = new ArrayList<>();

    @Getter
    @Setter
    public static class Activity {
        private String eventId;
        private Long seq;
        private String eventTime;
        private String eventType;
        private String level;
        private String content;
    }
}
