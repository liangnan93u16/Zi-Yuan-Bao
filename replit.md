# 在线资源分享平台

## 项目概述
一个功能完整的在线资源分享平台，包含市场功能、资源管理和用户管理系统。支持用户注册登录、资源上传下载、会员系统、管理后台等功能。

## 技术架构
- **前端**: React + TypeScript + Vite + Tailwind CSS + shadcn/ui
- **后端**: Express.js + TypeScript
- **数据库**: PostgreSQL + Drizzle ORM
- **身份验证**: bcryptjs (密码哈希) + express-session (会话管理)
- **文件处理**: multer (文件上传)
- **状态管理**: TanStack Query (React Query)

## 最近更改
- ✅ 2025-07-19: 将 bcrypt 库替换为 bcryptjs，提高兼容性
  - 更新 server/auth.ts 中的导入语句
  - 更新 server/routes.ts 中所有密码哈希相关的动态导入
  - 卸载 bcrypt 和 @types/bcrypt
  - 安装 bcryptjs 和 @types/bcryptjs

## 用户偏好
- 使用中文进行沟通
- 注重系统稳定性和兼容性

## 项目状态
✅ 应用程序正在运行中，端口 5000
✅ 数据库连接正常
✅ bcrypt 到 bcryptjs 迁移完成