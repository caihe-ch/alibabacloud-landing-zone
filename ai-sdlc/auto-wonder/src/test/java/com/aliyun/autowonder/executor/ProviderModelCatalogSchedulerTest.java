package com.aliyun.autowonder.executor;

import org.junit.jupiter.api.Test;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

class ProviderModelCatalogSchedulerTest {

    @Test
    void dailyRefreshRequestsBothQoderProviders() {
        ProviderModelCatalogService service = mock(ProviderModelCatalogService.class);
        ProviderModelCatalogScheduler scheduler = new ProviderModelCatalogScheduler(service);

        scheduler.refreshDueCatalogs();

        verify(service).requestRefreshIfDue("qoder");
        verify(service).requestRefreshIfDue("qodercn");
    }
}
