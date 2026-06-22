package com.webgis.config;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.webgis.system.entity.User;
import com.webgis.system.mapper.UserMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

@Component
public class DataInitializer implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(DataInitializer.class);

    private final UserMapper userMapper;
    private final PasswordEncoder passwordEncoder;

    public DataInitializer(UserMapper userMapper, PasswordEncoder passwordEncoder) {
        this.userMapper = userMapper;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    public void run(String... args) {
        boolean exists = userMapper.exists(
                new LambdaQueryWrapper<User>().eq(User::getUsername, "admin"));
        if (!exists) {
            User admin = new User();
            admin.setUsername("admin");
            admin.setPassword(passwordEncoder.encode("admin123"));
            admin.setDisplayName("系统管理员");
            admin.setRole("admin");
            admin.setStatus(1);
            userMapper.insert(admin);
            log.info("默认管理员账号已创建: admin / admin123");
        }
    }
}
