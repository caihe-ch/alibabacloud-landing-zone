package com.aliyun.autowonder.redis;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import redis.clients.jedis.Jedis;
import redis.clients.jedis.JedisPool;

import java.nio.charset.StandardCharsets;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.*;

class RedisManagerLockTest {

    @Test
    void releasesLockOnlyWhenOwnerTokenMatches() {
        JedisPool pool = mock(JedisPool.class);
        Jedis jedis = mock(Jedis.class);
        when(pool.getResource()).thenReturn(jedis);
        when(jedis.eval(anyString(), eq(List.of("dispatch:lock:1")), eq(List.of("owner-1"))))
                .thenReturn(1L);
        RedisManager redis = new RedisManager(pool, false);

        assertTrue(redis.releaseLock("dispatch:lock:1", "owner-1"));
        verify(jedis, never()).del("dispatch:lock:1");
    }

    @Test
    void reportsFalseWhenLockIsOwnedByAnotherWorker() {
        JedisPool pool = mock(JedisPool.class);
        Jedis jedis = mock(Jedis.class);
        when(pool.getResource()).thenReturn(jedis);
        when(jedis.eval(anyString(), anyList(), anyList())).thenReturn(0L);
        RedisManager redis = new RedisManager(pool, false);

        assertFalse(redis.releaseLock("dispatch:lock:1", "stale-owner"));
    }

    @Test
    void getAndDeleteAtomicallyConsumesSerializedValue() {
        JedisPool pool = mock(JedisPool.class);
        Jedis jedis = mock(Jedis.class);
        when(pool.getResource()).thenReturn(jedis);
        when(jedis.eval(any(byte[].class), anyList(), anyList()))
                .thenReturn(AbstractRedisManager.serialize(List.of("result")));
        RedisManager redis = new RedisManager(pool, false);

        assertEquals(List.of("result"), redis.getAndDelete("ticket:catalog-1"));

        ArgumentCaptor<byte[]> script = ArgumentCaptor.forClass(byte[].class);
        ArgumentCaptor<List<byte[]>> keys = ArgumentCaptor.forClass(List.class);
        ArgumentCaptor<List<byte[]>> args = ArgumentCaptor.forClass(List.class);
        verify(jedis).eval(script.capture(), keys.capture(), args.capture());
        String scriptText = new String(script.getValue(), StandardCharsets.UTF_8);
        int getIndex = scriptText.indexOf("redis.call('get', KEYS[1])");
        int delIndex = scriptText.indexOf("redis.call('del', KEYS[1])");
        assertTrue(getIndex >= 0);
        assertTrue(delIndex > getIndex);
        assertEquals(1, keys.getValue().size());
        assertArrayEquals("ticket:catalog-1".getBytes(StandardCharsets.UTF_8), keys.getValue().get(0));
        assertTrue(args.getValue().isEmpty());
        verify(jedis, never()).get(any(byte[].class));
        verify(jedis, never()).del(any(byte[].class));
    }

    @Test
    void setStringStoresSnapshotWithPlainSetAndNoExpiry() {
        JedisPool pool = mock(JedisPool.class);
        Jedis jedis = mock(Jedis.class);
        when(pool.getResource()).thenReturn(jedis);
        RedisManager redis = new RedisManager(pool, false);

        redis.setString("model-catalog:snapshot:qoder", "{\"provider\":\"qoder\"}");

        verify(jedis).set("model-catalog:snapshot:qoder", "{\"provider\":\"qoder\"}");
        verify(jedis, never()).expire(anyString(), anyLong());
    }
}
