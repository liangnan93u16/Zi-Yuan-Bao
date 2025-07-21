# 在线资源分享平台

## 项目概述
一个功能完整的在线资源分享平台，包含市场功能、资源管理和用户管理系统。支持用户注册登录、资源上传下载、会员系统、管理后台等功能。

## 技术架构
- **前端**: React + TypeScript + Vite + Tailwind CSS + shadcn/ui
- **后端**: Express.js + TypeScript
- **数据库**: PostgreSQL + Drizzle ORM
- **身份验证**: bcryptjs (密码哈希) + express-session (会话管理)
- **文件处理**: multer (文件上传) + 腾讯云COS (对象存储)
- **状态管理**: TanStack Query (React Query)

## 最近更改
- ✅ 2025-07-20: 【解析所有菲菲资源】功能优化
  - 解除只处理第一个分类的限制，现在可以处理所有分类
  - 优化日志输出，增加分类和全局进度显示
  - 调整暂停时间：资源间暂停1秒，分类间暂停2秒
  - 增加详细的统计信息和耗时分析
- ✅ 2025-07-20: feifei管理系统图片抓取功能增强
  - 修改"解析页面"功能，现在可以自动抓取页面图片并保存到腾讯云COS
  - 图片下载逻辑从本地文件系统迁移到COS存储
  - 使用预签名URL解决图片访问权限问题，图片正常显示
  - 保留本地备份机制，当COS配置不可用时自动降级到本地存储
  - 图片文件名使用资源ID和时间戳确保唯一性，存储在feifei目录下
  - 清理了旧的本地图片文件，优化存储使用
- ✅ 2025-07-20: 数据库迁移完成
  - 创建了新的PostgreSQL数据库实例
  - 从外部数据库成功迁移了所有核心数据
  - 导入373个资源、166个分类、3个用户、3个作者等核心数据
  - 验证数据完整性，主要业务数据迁移成功
- ✅ 2025-07-20: 集成腾讯云COS对象存储
  - 添加 cos-nodejs-sdk-v5 依赖
  - 创建 server/cos.ts 文件，包含COS配置和工具函数
  - 修改图片上传逻辑，从本地文件系统迁移到COS
  - 更新multer配置使用内存存储而非磁盘存储
  - 增加图片删除API，支持删除COS上的文件
  - 修改资源删除逻辑，同时删除关联的COS图片文件
- ✅ 2025-07-19: 将 bcrypt 库替换为 bcryptjs，提高兼容性
  - 更新 server/auth.ts 中的导入语句
  - 更新 server/routes.ts 中所有密码哈希相关的动态导入
  - 卸载 bcrypt 和 @types/bcrypt
  - 安装 bcryptjs 和 @types/bcryptjs

## 用户偏好
- 使用中文进行沟通
- 注重系统稳定性和兼容性

## 环境变量配置
### 腾讯云COS配置（必须）
```
COS_SECRET_ID=你的腾讯云SecretId
COS_SECRET_KEY=你的腾讯云SecretKey
COS_BUCKET=你的COS存储桶名称
COS_REGION=地域（可选，默认ap-beijing）
COS_DOMAIN=自定义域名（可选）
```

### 其他配置
```
SESSION_SECRET=会话密钥
DATABASE_URL=数据库连接URL
```

## 项目状态
✅ 应用程序正在运行中，端口 5000
✅ 数据库连接正常
✅ bcrypt 到 bcryptjs 迁移完成
✅ COS配置已完成，图片存储正常
✅ 数据库迁移完成，包含373个资源和完整业务数据
✅ feifei管理系统"解析页面"功能已集成COS图片存储
✅ 前端界面能正确显示COS存储的图片并标识存储类型