package com.aliyun.autowonder.conversation;

import org.apache.ibatis.io.Resources;
import org.apache.ibatis.session.SqlSessionFactory;
import org.apache.ibatis.session.SqlSessionFactoryBuilder;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mybatis.spring.SqlSessionTemplate;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.Statement;
import java.util.Date;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 基于 H2 的挂起卡片 DAO 回归测试。三条断言对应三个真实故障模式：
 * 事件分片重投导致重复插入、回答与过期竞争同一次状态转移、过期扫描误伤终态记录。
 */
class AgentConversationElicitationDaoTest {

    static final long TENANT = 1L;
    static final long CONVERSATION = 10L;
    static final long TURN = 100L;
    static final String JDBC_URL =
            "jdbc:h2:mem:conversation_elicitation_test;MODE=MySQL;DB_CLOSE_DELAY=-1";

    static AgentConversationElicitationDao dao;

    @BeforeAll
    static void initDb() throws Exception {
        try (InputStream in = Resources.getResourceAsStream("mybatis-elicitation-test-config.xml")) {
            SqlSessionFactory factory = new SqlSessionFactoryBuilder().build(in);
            dao = new SqlSessionTemplate(factory).getMapper(AgentConversationElicitationDao.class);
        }
        execScript("conversation-elicitation-schema-h2.sql");
    }

    @BeforeEach
    void cleanTable() throws Exception {
        try (Connection c = DriverManager.getConnection(JDBC_URL, "sa", "");
             Statement st = c.createStatement()) {
            st.execute("DELETE FROM agent_conversation_elicitation");
        }
    }

    private static void execScript(String resource) throws Exception {
        String sql;
        try (InputStream in = Resources.getResourceAsStream(resource)) {
            sql = new String(in.readAllBytes(), StandardCharsets.UTF_8);
        }
        try (Connection c = DriverManager.getConnection(JDBC_URL, "sa", "");
             Statement st = c.createStatement()) {
            for (String stmt : sql.split(";")) {
                if (!stmt.isBlank()) {
                    st.execute(stmt);
                }
            }
        }
    }

    private AgentConversationElicitationDO pending(String requestId) {
        AgentConversationElicitationDO record = new AgentConversationElicitationDO();
        record.setTenantId(TENANT);
        record.setConversationId(CONVERSATION);
        record.setTurnId(TURN);
        record.setRequestId(requestId);
        record.setMode("form");
        record.setMessage("Answer Questions");
        record.setSchemaJson("{\"type\":\"object\"}");
        record.setStatus("PENDING");
        return record;
    }

    private void backdate(String requestId, long millisAgo) throws Exception {
        try (Connection c = DriverManager.getConnection(JDBC_URL, "sa", "");
             Statement st = c.createStatement()) {
            st.execute("UPDATE agent_conversation_elicitation SET gmt_create = TIMESTAMP '"
                    + new java.sql.Timestamp(System.currentTimeMillis() - millisAgo)
                    + "' WHERE request_id = '" + requestId + "'");
        }
    }

    /** 分片重投会让同一个 acp_elicitation 事件到达多次，唯一键必须把重复插入吞掉。 */
    @Test
    void insertIfAbsentKeepsSingleRowPerRequestId() {
        assertEquals(1, dao.insertIfAbsent(pending("req-1")));
        assertEquals(0, dao.insertIfAbsent(pending("req-1")));

        List<AgentConversationElicitationDO> rows =
                dao.listPendingByConversation(TENANT, CONVERSATION);
        assertEquals(1, rows.size());
        assertEquals("req-1", rows.get(0).getRequestId());
        assertEquals("form", rows.get(0).getMode());
        assertEquals("Answer Questions", rows.get(0).getMessage());
        assertTrue(rows.get(0).getSchemaJson().contains("\"type\":\"object\""));
        assertNotNull(rows.get(0).getGmtCreate());
    }

    /** 回答、取消、过期三条路径竞争同一次状态转移，只能有一个赢家。 */
    @Test
    void settleIfPendingWinsOnlyOnce() {
        dao.insertIfAbsent(pending("req-1"));

        assertEquals(1, dao.settleIfPending(TENANT, CONVERSATION, "req-1", "ANSWERED",
                "{\"q0\":\"A\"}"));
        assertEquals(0, dao.settleIfPending(TENANT, CONVERSATION, "req-1", "EXPIRED", null));

        AgentConversationElicitationDO settled =
                dao.findByRequestId(TENANT, CONVERSATION, "req-1");
        assertEquals("ANSWERED", settled.getStatus());
        assertEquals("{\"q0\":\"A\"}", settled.getAnswerJson());
    }

    @Test
    void findByRequestIdIsScopedToConversation() {
        dao.insertIfAbsent(pending("req-1"));

        assertNotNull(dao.findByRequestId(TENANT, CONVERSATION, "req-1"));
        // 跨会话猜 requestId 不应命中，否则回答端点的归属校验形同虚设。
        assertNull(dao.findByRequestId(TENANT, CONVERSATION + 1, "req-1"));
        assertNull(dao.findByRequestId(TENANT + 1, CONVERSATION, "req-1"));
    }

    /** 投递失败的补偿：卡片必须重新可答，且上一次的答案不能残留。 */
    @Test
    void restorePendingIfStatusReopensTheCardAndClearsTheAnswer() {
        dao.insertIfAbsent(pending("req-1"));
        dao.settleIfPending(TENANT, CONVERSATION, "req-1", "ANSWERED", "{\"q0\":\"A\"}");

        assertEquals(1, dao.restorePendingIfStatus(TENANT, CONVERSATION, "req-1", "ANSWERED"));

        AgentConversationElicitationDO restored =
                dao.findByRequestId(TENANT, CONVERSATION, "req-1");
        assertEquals("PENDING", restored.getStatus());
        assertNull(restored.getAnswerJson());
        assertEquals(1, dao.listPendingByTurn(TENANT, TURN).size());
    }

    /** 并发赢家（过期 / 取消）已改过状态时，补偿必须原地不动。 */
    @Test
    void restorePendingIfStatusDoesNotOverwriteAConcurrentWinner() {
        dao.insertIfAbsent(pending("req-1"));
        dao.settleIfPending(TENANT, CONVERSATION, "req-1", "EXPIRED", null);

        assertEquals(0, dao.restorePendingIfStatus(TENANT, CONVERSATION, "req-1", "ANSWERED"));
        assertEquals("EXPIRED", dao.findByRequestId(TENANT, CONVERSATION, "req-1").getStatus());
    }

    @Test
    void listPendingByTurnReturnsOnlyPendingRowsOfThatTurn() {
        dao.insertIfAbsent(pending("req-1"));
        dao.insertIfAbsent(pending("req-2"));
        AgentConversationElicitationDO otherTurn = pending("req-3");
        otherTurn.setTurnId(TURN + 1);
        dao.insertIfAbsent(otherTurn);
        dao.settleIfPending(TENANT, CONVERSATION, "req-2", "ANSWERED", "{}");

        List<AgentConversationElicitationDO> rows = dao.listPendingByTurn(TENANT, TURN);

        assertEquals(1, rows.size());
        assertEquals("req-1", rows.get(0).getRequestId());
    }

    /** 过期扫描必须只捞 PENDING 且早于 cutoff 的，否则会把已回答的卡片改成 EXPIRED。 */
    @Test
    void listPendingOlderThanSkipsFreshAndSettledRows() throws Exception {
        dao.insertIfAbsent(pending("stale-pending"));
        dao.insertIfAbsent(pending("stale-answered"));
        dao.insertIfAbsent(pending("fresh-pending"));
        backdate("stale-pending", 40 * 60 * 1000L);
        backdate("stale-answered", 40 * 60 * 1000L);
        dao.settleIfPending(TENANT, CONVERSATION, "stale-answered", "ANSWERED", "{}");

        List<AgentConversationElicitationDO> rows =
                dao.listPendingOlderThan(new Date(System.currentTimeMillis() - 30 * 60 * 1000L), 50);

        assertEquals(1, rows.size());
        assertEquals("stale-pending", rows.get(0).getRequestId());
        assertEquals(TURN, rows.get(0).getTurnId());
        assertEquals(CONVERSATION, rows.get(0).getConversationId());
    }

    @Test
    void listPendingOlderThanRespectsLimit() throws Exception {
        dao.insertIfAbsent(pending("req-1"));
        dao.insertIfAbsent(pending("req-2"));
        backdate("req-1", 40 * 60 * 1000L);
        backdate("req-2", 40 * 60 * 1000L);

        assertEquals(1, dao.listPendingOlderThan(
                new Date(System.currentTimeMillis() - 30 * 60 * 1000L), 1).size());
    }
}
