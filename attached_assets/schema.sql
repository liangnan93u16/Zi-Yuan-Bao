-- 创建资源分类表
CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL COMMENT '分类名称',
    icon VARCHAR(100) COMMENT '分类图标',
    parent_id INTEGER COMMENT '父分类ID',
    sort_order INTEGER DEFAULT 0 COMMENT '排序顺序',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间'
);

-- 创建资源表
CREATE TABLE resources (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL COMMENT '资源标题',
    subtitle VARCHAR(255) COMMENT '副标题',
    cover_image VARCHAR(255) COMMENT '封面图片URL',
    category_id INTEGER COMMENT '分类ID',
    price DECIMAL(10,2) DEFAULT 0.00 COMMENT '资源价格',
    video_url VARCHAR(255) COMMENT '视频URL',
    video_duration INTEGER COMMENT '视频总时长(分钟)',
    video_size DECIMAL(10,2) COMMENT '视频大小(GB)',
    language VARCHAR(50) COMMENT '资源语言',
    subtitle_languages VARCHAR(255) COMMENT '字幕语言',
    resolution VARCHAR(20) COMMENT '视频分辨率',
    source_type VARCHAR(50) COMMENT '来源类型(如Udemy/Coursera等)',
    status TINYINT DEFAULT 1 COMMENT '状态:0-下架,1-上架',
    is_free BOOLEAN DEFAULT false COMMENT '是否免费',
    description TEXT COMMENT '资源描述',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间'
);

-- 创建用户表
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL COMMENT '用户名',
    password VARCHAR(255) NOT NULL COMMENT '密码',
    email VARCHAR(100) COMMENT '邮箱',
    avatar VARCHAR(255) COMMENT '头像URL',
    membership_type VARCHAR(50) COMMENT '会员类型',
    membership_expire_time TIMESTAMP COMMENT '会员过期时间',
    coins INTEGER DEFAULT 0 COMMENT '积分数量',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间'
);

-- 添加外键约束
ALTER TABLE resources ADD FOREIGN KEY (category_id) REFERENCES categories(id); 