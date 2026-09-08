package com.aliyun.autowonder.skill;

import com.aliyun.autowonder.access.WorkspaceAccessLevel;
import com.aliyun.autowonder.access.RequireWorkspaceAccess;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;

import java.lang.reflect.Method;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;

class SkillControllerPermissionTest {

    @Test
    void connectionTestRequiresReadWriteAccess() throws NoSuchMethodException {
        RequireWorkspaceAccess access = SkillController.class
                .getMethod("testConnection", Long.class, Long.class)
                .getAnnotation(RequireWorkspaceAccess.class);

        assertNotNull(access);
        assertEquals(WorkspaceAccessLevel.READ_WRITE, access.value());
        assertEquals("测试技能连接", access.action());
    }

    @Test
    void packageContentEndpointsInheritReadOnlyVisibilityOfSkillDetail() throws NoSuchMethodException {
        RequireWorkspaceAccess classLevel = SkillController.class.getAnnotation(RequireWorkspaceAccess.class);
        assertNotNull(classLevel);
        assertEquals(WorkspaceAccessLevel.READ_ONLY, classLevel.value());
        assertEquals("查看技能", classLevel.action());

        // WorkspaceAccessAspect 先取方法级注解，取不到才回落到类级；
        // 三个包内容端点与技能详情端点都不声明方法级注解，可见性因此完全一致（AC-6）。
        List<Method> readEndpoints = List.of(
                SkillController.class.getMethod("get", Long.class),
                SkillController.class.getMethod("packageFiles", Long.class),
                SkillController.class.getMethod("packageFile", Long.class, String.class),
                SkillController.class.getMethod("downloadPackage", Long.class));

        for (Method endpoint : readEndpoints) {
            assertNull(endpoint.getAnnotation(RequireWorkspaceAccess.class),
                    endpoint.getName() + " 不应声明方法级权限注解，须继承类级 READ_ONLY");
        }

        assertEquals(ResponseEntity.class, SkillController.class.getMethod("downloadPackage", Long.class).getReturnType());
    }
}
