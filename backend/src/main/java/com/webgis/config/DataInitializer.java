package com.webgis.config;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.webgis.system.entity.User;
import com.webgis.system.mapper.UserMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

/**
 * 数据初始化组件
 * 在 Spring Boot 应用启动后执行，用于初始化必要的默认数据（如管理员账号）
 *
 * 实现 CommandLineRunner 接口，重写 run() 方法，在 Spring 容器加载完成后执行
 */
@Component
public class DataInitializer implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(DataInitializer.class);

    private final UserMapper userMapper;
    private final PasswordEncoder passwordEncoder;

    /**
     * 构造器注入（推荐方式）
     * @param userMapper MyBatis-Plus 的用户数据访问层
     * @param passwordEncoder Spring Security 提供的密码编码器（如 BCryptPasswordEncoder）
     */
    public DataInitializer(UserMapper userMapper, PasswordEncoder passwordEncoder) {
        this.userMapper = userMapper;
        this.passwordEncoder = passwordEncoder;
    }

    /**
     * 应用启动后执行的逻辑
     * 检查数据库中是否已存在用户名为 "admin" 的用户，如果没有则创建一个默认管理员
     *
     * @param args 启动参数（此处未使用）
     */
    @Override
    public void run(String... args) {
        // 1. 使用 MyBatis-Plus 的条件构造器查询是否存在 username = 'admin' 的用户
        boolean exists = userMapper.exists(
                new LambdaQueryWrapper<User>().eq(User::getUsername, "admin"));

        // 2. 如果不存在，则创建默认管理员
        if (!exists) {
            User admin = new User();
            admin.setUsername("admin");
            // 使用 PasswordEncoder 对明文密码 "admin123" 进行加密（BCrypt 哈希）
            admin.setPassword(passwordEncoder.encode("admin123"));
            admin.setDisplayName("系统管理员");
            admin.setRole("admin");     // 角色标识，可对应权限逻辑
            admin.setStatus(1);         // 状态：1 表示启用
            // 插入数据库
            userMapper.insert(admin);
            // 打印日志，便于开发/运维人员知晓
            log.info("默认管理员账号已创建: admin / admin123");
        }
        // 如果已存在，则什么都不做（不会覆盖或修改密码）
    }
}