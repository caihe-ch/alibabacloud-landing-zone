package com.aliyun.autowonder.conversation;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Collections;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class ConversationTurnEventServiceTest {

    private final AgentConversationTurnEventDao eventDao = mock(AgentConversationTurnEventDao.class);
    private final AgentConversationDao convDao = mock(AgentConversationDao.class);
    private final AgentConversationTurnDao turnDao = mock(AgentConversationTurnDao.class);
    private final ConversationBrowserEventPublisher publisher = mock(ConversationBrowserEventPublisher.class);
    private final ConversationElicitationService elicitationService =
            mock(ConversationElicitationService.class);

    private ConversationTurnEventService service;

    @BeforeEach
    void setUp() {
        service = new ConversationTurnEventService(eventDao, convDao, turnDao);
        service.setBrowserEventPublisher(publisher);
        service.setConversationElicitationService(elicitationService);
    }

    @Test
    void rejectsEventWhenExecutorMismatch() {
        AgentConversationDO conv = new AgentConversationDO();
        conv.setExecutorId(99L);
        when(convDao.findById(1L, 10L)).thenReturn(conv);

        service.persistEvent(1L, 50L, 10L, 20L, 1, 1L, 0, 1, "text", "{}");

        verify(eventDao, never()).insertChunkIfAbsent(any());
    }

    @Test
    void rejectsEventWhenConversationNotFound() {
        when(convDao.findById(1L, 10L)).thenReturn(null);

        service.persistEvent(1L, 50L, 10L, 20L, 1, 1L, 0, 1, "text", "{}");

        verify(eventDao, never()).insertChunkIfAbsent(any());
    }

    @Test
    void rejectsEventWhenNoActiveTurn() {
        AgentConversationDO conv = new AgentConversationDO();
        conv.setExecutorId(50L);
        when(convDao.findById(1L, 10L)).thenReturn(conv);
        when(turnDao.findProcessingInbound(1L, 10L)).thenReturn(null);

        service.persistEvent(1L, 50L, 10L, 20L, 1, 1L, 0, 1, "text", "{}");

        verify(eventDao, never()).insertChunkIfAbsent(any());
    }

    @Test
    void rejectsEventWhenTurnIdMismatch() {
        AgentConversationDO conv = new AgentConversationDO();
        conv.setExecutorId(50L);
        when(convDao.findById(1L, 10L)).thenReturn(conv);
        AgentConversationTurnDO turn = new AgentConversationTurnDO();
        turn.setId(99L);
        when(turnDao.findProcessingInbound(1L, 10L)).thenReturn(turn);

        service.persistEvent(1L, 50L, 10L, 20L, 1, 1L, 0, 1, "text", "{}");

        verify(eventDao, never()).insertChunkIfAbsent(any());
    }

    @Test
    void persistsSingleChunkEventAndPublishes() {
        AgentConversationDO conv = new AgentConversationDO();
        conv.setExecutorId(50L);
        when(convDao.findById(1L, 10L)).thenReturn(conv);
        AgentConversationTurnDO turn = new AgentConversationTurnDO();
        turn.setId(20L);
        when(turnDao.findProcessingInbound(1L, 10L)).thenReturn(turn);

        String payload = "{\"content\":\"hello\"}";
        service.persistEvent(1L, 50L, 10L, 20L, 1, 1L, 0, 1, "text", payload);

        verify(eventDao).insertChunkIfAbsent(any());
        verify(publisher).publish(anyLong(), eq(10L), anyLong(), anyLong(), anyString(), anyString());
    }

    @Test
    void publishesOnlyAfterAllChunksPresent() {
        AgentConversationDO conv = new AgentConversationDO();
        conv.setExecutorId(50L);
        when(convDao.findById(1L, 10L)).thenReturn(conv);
        AgentConversationTurnDO turn = new AgentConversationTurnDO();
        turn.setId(20L);
        when(turnDao.findProcessingInbound(1L, 10L)).thenReturn(turn);

        AgentConversationTurnEventDO chunk0 = new AgentConversationTurnEventDO();
        chunk0.setPayloadFragment("{\"con");
        AgentConversationTurnEventDO chunk1 = new AgentConversationTurnEventDO();
        chunk1.setPayloadFragment("tent\":\"hi\"}");

        when(eventDao.listLogicalEventChunks(1L, 20L, 1, 1L))
                .thenReturn(List.of(chunk0))
                .thenReturn(List.of(chunk0, chunk1));

        service.persistEvent(1L, 50L, 10L, 20L, 1, 1L, 0, 2, "text", "{\"con");
        verify(publisher, never()).publish(anyLong(), anyLong(), anyLong(), anyLong(), anyString(), anyString());

        service.persistEvent(1L, 50L, 10L, 20L, 1, 1L, 1, 2, "text", "tent\":\"hi\"}");
        verify(publisher).publish(anyLong(), eq(10L), anyLong(), anyLong(), anyString(), anyString());
    }

    @Test
    void updatesCliSessionRefOnStatusEvent() {
        AgentConversationDO conv = new AgentConversationDO();
        conv.setExecutorId(50L);
        when(convDao.findById(1L, 10L)).thenReturn(conv);
        AgentConversationTurnDO turn = new AgentConversationTurnDO();
        turn.setId(20L);
        when(turnDao.findProcessingInbound(1L, 10L)).thenReturn(turn);

        String payload = "{\"sessionId\":\"sess-abc\"}";
        service.persistEvent(1L, 50L, 10L, 20L, 1, 1L, 0, 1, "status", payload);

        verify(convDao).updateCliSessionRef(1L, 10L, "sess-abc");
    }

    @Test
    void doesNotUpdateCliSessionRefWhenSessionIdBlank() {
        AgentConversationDO conv = new AgentConversationDO();
        conv.setExecutorId(50L);
        when(convDao.findById(1L, 10L)).thenReturn(conv);
        AgentConversationTurnDO turn = new AgentConversationTurnDO();
        turn.setId(20L);
        when(turnDao.findProcessingInbound(1L, 10L)).thenReturn(turn);

        String payload = "{\"status\":\"running\"}";
        service.persistEvent(1L, 50L, 10L, 20L, 1, 1L, 0, 1, "status", payload);

        verify(convDao, never()).updateCliSessionRef(anyLong(), anyLong(), anyString());
    }

    @Test
    void listEventsAfterDelegates() {
        when(eventDao.listCompletedAfter(1L, 10L, 5L, 200)).thenReturn(Collections.emptyList());
        List<AgentConversationTurnEventDO> result = service.listEventsAfter(1L, 10L, 5L, 200);
        assertTrue(result.isEmpty());
        verify(eventDao).listCompletedAfter(1L, 10L, 5L, 200);
    }

    /**
     * S15：历史轮次「查看执行详情」按需拉取。执行器无合并节流，一个 token 级
     * chunk 就是一行记录，所以查询必须带上限而不是裸 SELECT 全表分区。
     */
    @Test
    void listEventsByTurnDelegatesWithBoundedLimit() {
        when(eventDao.listByTurn(eq(1L), eq(10L), eq(20L), anyInt()))
                .thenReturn(Collections.emptyList());

        assertTrue(service.listEventsByTurn(1L, 10L, 20L).isEmpty());

        verify(eventDao).listByTurn(1L, 10L, 20L,
                ConversationTurnEventService.MAX_TURN_EVENTS);
        assertTrue(ConversationTurnEventService.MAX_TURN_EVENTS > 0);
    }

    /** S17：新增的 acp_* 事件走既有分片管道落库并推浏览器，传输层无需特殊处理。 */
    @Test
    void persistsAndPublishesAcpEventTypes() {
        activeTurn();

        for (String eventType : List.of("acp_plan", "acp_commands", "acp_elicitation",
                "acp_elicitation_resolved")) {
            service.persistEvent(1L, 50L, 10L, 20L, 1, 1L, 0, 1, eventType, "{\"data\":{}}");
        }

        verify(eventDao, times(4)).insertChunkIfAbsent(any());
        verify(publisher, times(4)).publish(anyLong(), eq(10L), anyLong(), anyLong(), anyString(), anyString());
    }

    /** event_type 是 VARCHAR(32)，超长会在插入时被静默截断或直接报错。 */
    @Test
    void everyNewEventTypeFitsTheEventTypeColumn() {
        for (String eventType : List.of("acp_plan", "acp_commands", "acp_elicitation",
                "acp_elicitation_resolved")) {
            assertTrue(eventType.length() <= 32, eventType + " 超出 event_type VARCHAR(32)");
        }
    }

    @Test
    void dispatchesElicitationEventsToElicitationService() {
        activeTurn();
        String payload = "{\"type\":\"acp_elicitation\",\"data\":{\"requestId\":\"req-1\"}}";

        service.persistEvent(1L, 50L, 10L, 20L, 1, 7L, 0, 1, "acp_elicitation", payload);

        verify(elicitationService).onEvent(1L, 10L, 20L, "acp_elicitation", payload);
    }

    @Test
    void dispatchesElicitationResolvedEventsToElicitationService() {
        activeTurn();
        String payload = "{\"data\":{\"requestId\":\"req-1\",\"action\":\"accept\"}}";

        service.persistEvent(1L, 50L, 10L, 20L, 1, 8L, 0, 1, "acp_elicitation_resolved", payload);

        verify(elicitationService).onEvent(1L, 10L, 20L, "acp_elicitation_resolved", payload);
    }

    /**
     * 只拦 acp_elicitation* 前缀：plan 与 commands 是纯展示数据，事件表本身就是
     * 它们的持久化载体，落挂起表毫无意义。既有 7 类事件同样不能被拦（回归保护）。
     */
    @Test
    void doesNotDispatchNonElicitationEventsToElicitationService() {
        activeTurn();

        for (String eventType : List.of("text", "thinking", "tool_use", "tool_result", "status",
                "error", "log", "acp_plan", "acp_commands")) {
            service.persistEvent(1L, 50L, 10L, 20L, 1, 1L, 0, 1, eventType, "{\"data\":{}}");
        }

        verify(elicitationService, never()).onEvent(anyLong(), anyLong(), anyLong(), anyString(),
                anyString());
    }

    /** 分片事件必须重组完整后才分派一次，否则卡片 service 会拿到半截 JSON。 */
    @Test
    void dispatchesChunkedElicitationEventOnlyOnceAfterReassembly() {
        activeTurn();
        AgentConversationTurnEventDO chunk0 = new AgentConversationTurnEventDO();
        chunk0.setPayloadFragment("{\"data\":{\"requestId\":");
        AgentConversationTurnEventDO chunk1 = new AgentConversationTurnEventDO();
        chunk1.setPayloadFragment("\"req-1\"}}");
        when(eventDao.listLogicalEventChunks(1L, 20L, 1, 9L))
                .thenReturn(List.of(chunk0))
                .thenReturn(List.of(chunk0, chunk1));

        service.persistEvent(1L, 50L, 10L, 20L, 1, 9L, 0, 2, "acp_elicitation",
                "{\"data\":{\"requestId\":");
        verify(elicitationService, never()).onEvent(anyLong(), anyLong(), anyLong(), anyString(),
                anyString());

        service.persistEvent(1L, 50L, 10L, 20L, 1, 9L, 1, 2, "acp_elicitation", "\"req-1\"}}");
        verify(elicitationService).onEvent(1L, 10L, 20L, "acp_elicitation",
                "{\"data\":{\"requestId\":\"req-1\"}}");
    }

    /** 守卫剩余的两个分支：类型缺失会 NPE，载荷缺失会让卡片 service 拿到空内容。 */
    @Test
    void doesNotDispatchWhenEventTypeOrPayloadIsNull() {
        activeTurn();

        service.persistEvent(1L, 50L, 10L, 20L, 1, 1L, 0, 1, null, "{\"data\":{}}");
        service.persistEvent(1L, 50L, 10L, 20L, 1, 2L, 0, 1, "acp_elicitation", null);

        verify(elicitationService, never()).onEvent(anyLong(), anyLong(), anyLong(), any(), any());
    }

    /** 卡片落库失败不该拖累事件流：浏览器仍要看到这条事件。 */
    @Test
    void keepsPublishingWhenElicitationServiceThrows() {
        activeTurn();
        doThrow(new IllegalStateException("db down")).when(elicitationService)
                .onEvent(anyLong(), anyLong(), anyLong(), anyString(), anyString());

        service.persistEvent(1L, 50L, 10L, 20L, 1, 1L, 0, 1, "acp_elicitation",
                "{\"data\":{\"requestId\":\"req-1\"}}");

        verify(publisher).publish(anyLong(), eq(10L), anyLong(), anyLong(), anyString(), anyString());
    }

    /** 卡片 service 缺失（老部署 / 精简上下文）时事件流照常，沿用既有的空值容忍。 */
    @Test
    void toleratesMissingElicitationService() {
        ConversationTurnEventService bare = new ConversationTurnEventService(eventDao, convDao, turnDao);
        bare.setBrowserEventPublisher(publisher);
        activeTurn();

        bare.persistEvent(1L, 50L, 10L, 20L, 1, 1L, 0, 1, "acp_elicitation",
                "{\"data\":{\"requestId\":\"req-1\"}}");

        verify(publisher).publish(anyLong(), eq(10L), anyLong(), anyLong(), anyString(), anyString());
    }

    private void activeTurn() {
        AgentConversationDO conv = new AgentConversationDO();
        conv.setExecutorId(50L);
        when(convDao.findById(1L, 10L)).thenReturn(conv);
        AgentConversationTurnDO turn = new AgentConversationTurnDO();
        turn.setId(20L);
        when(turnDao.findProcessingInbound(1L, 10L)).thenReturn(turn);
    }
}
