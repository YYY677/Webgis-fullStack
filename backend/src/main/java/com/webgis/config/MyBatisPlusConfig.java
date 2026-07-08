package com.webgis.config;

import com.baomidou.mybatisplus.annotation.DbType;
import com.baomidou.mybatisplus.core.handlers.MetaObjectHandler;
import com.baomidou.mybatisplus.extension.plugins.MybatisPlusInterceptor;
import com.baomidou.mybatisplus.extension.plugins.inner.PaginationInnerInterceptor;
import org.apache.ibatis.reflection.MetaObject;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.LocalDateTime;

/**
 * MyBatis-Plus 配置类
 * 提供分页插件和字段自动填充功能
 */
@Configuration
public class MyBatisPlusConfig {

    // ==========================================================
    // 第一部分：分页插件
    // ==========================================================

    /**
     * 配置 MyBatis-Plus 拦截器（插件体系的核心入口）
     *
     * 作用：将 MyBatis-Plus 的扩展功能（如分页、乐观锁、多租户等）注入到 SQL 执行链中。
     */
    @Bean
    public MybatisPlusInterceptor mybatisPlusInterceptor() {
        // 1. 创建 MyBatis-Plus 的全局拦截器容器
        MybatisPlusInterceptor interceptor = new MybatisPlusInterceptor();

        // 2. 添加具体的分页拦截器（InnerInterceptor）
        //    指定数据库类型为 PostgreSQL，这样 MP 就会自动将 "LIMIT ? OFFSET ?"
        //    翻译成 PostgreSQL 方言的 "LIMIT ? OFFSET ?"（两者语法恰好相同，但指定类型更规范）
        interceptor.addInnerInterceptor(new PaginationInnerInterceptor(DbType.POSTGRE_SQL));

        return interceptor;
        // 底层原理：MP 拦截器会拦截所有带 Page 参数的 Select 语句，
        // 在 SQL 执行前，自动拼接 COUNT 查询和分页 LIMIT 子句。
    }

    // ==========================================================
    // 第二部分：字段自动填充（MetaObjectHandler）
    // ==========================================================

    /**
     * 元数据对象处理器：用于自动填充实体类的通用字段
     *
     * 解决痛点：每次新增或修改时，都要手动 setCreateTime/UpdateTime，非常繁琐且容易遗漏。
     * 配置后，只要你的实体类字段上有 @TableField(fill = ...) 注解，就会自动触发这里的填充逻辑。
     */
    @Bean
    public MetaObjectHandler metaObjectHandler() {
        // 这里返回的是一个匿名内部类（也可以单独提取成一个类，如 MyMetaObjectHandler）
        return new MetaObjectHandler() {

            /**
             * 执行插入（INSERT）操作时的填充逻辑
             *
             * @param metaObject MyBatis 传递过来的元数据对象，包含了当前实体类的所有字段信息
             */
            @Override
            public void insertFill(MetaObject metaObject) {
                // strictInsertFill 是 MP 提供的“严格填充”方法：
                // 如果实体类中不存在该字段，或者字段已经被手动赋值，则不会覆盖（避免业务手动设置被覆盖）
                // 参数含义：元数据对象, 字段名, 字段类型, 要填充的值
                this.strictInsertFill(metaObject, "createdAt", LocalDateTime.class, LocalDateTime.now());
                this.strictInsertFill(metaObject, "updatedAt", LocalDateTime.class, LocalDateTime.now());

                // 注意：实体类中的字段必须叫 "createdAt" 和 "updatedAt"，
                // 并且类型必须是 LocalDateTime，才会触发填充。
            }

            /**
             * 执行更新（UPDATE）操作时的填充逻辑
             */
            @Override
            public void updateFill(MetaObject metaObject) {
                // 更新时，只自动更新 "updatedAt" 字段，记录最后修改时间
                this.strictUpdateFill(metaObject, "updatedAt", LocalDateTime.class, LocalDateTime.now());
            }
        };
    }
}