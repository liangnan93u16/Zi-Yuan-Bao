# Resource Treasure - Educational Resource Sharing Platform

## Overview

Resource Treasure is a full-stack educational resource sharing platform built with React, TypeScript, and Node.js. The platform allows users to browse, purchase, and share educational resources like video tutorials, e-books, and learning materials. It includes comprehensive user management, resource management, and payment processing capabilities.

## System Architecture

The application follows a modern full-stack architecture with:

- **Frontend**: React 18 with TypeScript, using Vite for development and bundling
- **Backend**: Node.js with Express.js serving both API endpoints and static assets
- **Database**: PostgreSQL with Drizzle ORM for type-safe database operations
- **Authentication**: Session-based authentication with bcrypt password hashing
- **UI Framework**: Tailwind CSS with shadcn/ui components for consistent design
- **State Management**: TanStack Query for server state management

## Key Components

### Frontend Architecture
- **Component Structure**: Organized into pages, components, and UI components
- **Routing**: Uses Wouter for client-side routing
- **State Management**: TanStack Query for API state, React Context for authentication
- **UI Components**: Built with Radix UI primitives and styled with Tailwind CSS
- **Form Handling**: React Hook Form with Zod validation

### Backend Architecture
- **Express Server**: Handles both API routes and serves static assets
- **Database Layer**: Drizzle ORM with PostgreSQL for data persistence
- **Authentication**: Session-based auth with role-based access control
- **File Handling**: Multer for image uploads and file management
- **Email System**: Nodemailer integration for notifications

### Database Schema
Key database tables include:
- `users`: User accounts with authentication and profile data
- `resources`: Educational resources with metadata and pricing
- `categories`: Hierarchical categorization system
- `authors`: Content creator profiles
- `reviews`: User reviews with moderation system
- `orders`: Payment and purchase tracking
- `feifei_*`: Legacy data import tables

## Data Flow

1. **User Authentication**: Session-based authentication with role-based access
2. **Resource Discovery**: Paginated browsing with filtering and search capabilities
3. **Purchase Flow**: Order creation → Payment processing → Access granting
4. **Content Management**: Admin panel for resource and user management
5. **Review System**: User reviews with admin moderation workflow

## External Dependencies

- **Database**: PostgreSQL (configured for Neon serverless)
- **Payment Processing**: Integrated payment system with callback verification
- **Email Service**: Configurable SMTP for notifications
- **File Storage**: Local file system for images and resources
- **Web Scraping**: Cheerio for content extraction and processing

## Deployment Strategy

The application is configured for deployment on Replit with:
- **Development**: `npm run dev` for local development with hot reload
- **Build Process**: Vite builds frontend, esbuild bundles backend
- **Production**: `npm run start` serves built application
- **Database**: Automatic migrations with Drizzle Kit
- **Environment**: Configured for Replit's autoscale deployment

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes

- June 26, 2025: 修复资源图片显示问题，添加统一默认图片处理
  - 使用官方提供的美观默认资源图片 `/images/default-resource.webp`
  - 统一了所有页面的图片错误处理逻辑：本地图片 → 远程图片 → 默认图片
  - 更新了以下组件和页面的图片处理：
    - ResourceCard 组件（首页资源卡片）
    - Membership 页面（会员专享资源）
    - ResourceDetail 页面（资源详情）
    - ResourceManagement 页面（后台资源管理）
    - FeifeiManagement 页面（菲菲资源管理）
  - 解决了部分资源图片无法正确展示的问题，确保用户始终能看到美观的默认图片

- June 26, 2025: 安装和配置官方 Google Gemini CLI 工具
  - 卸载第三方工具，安装官方 @google/gemini-cli (v0.1.3)
  - 配置 GEMINI_API_KEY 环境变量
  - 验证工具安装成功，支持多种模型和参数配置
  - 遇到 API 配额限制（429错误），这是免费 API 密钥的正常限制
  - 支持沙盒模式、调试模式、检查点等高级功能
  - 创建并测试自定义 Gemini CLI 模块，基本功能验证成功
  - 测试包括文本生成、总结、情感分析、翻译等功能
  - 卸载官方 @google/gemini-cli，保留自定义模块
  - 完成综合测试，验证所有核心功能正常工作
  - API连接稳定，响应时间约5秒，功能完整可用

- June 25, 2025: 修改积分系统支持小数，完善支付流程
  - 积分字段类型从integer改为decimal(10,2)，支持小数积分
  - 积分系统按1元=1积分的比例，0.01元=0.01积分
  - 修复支付回调中积分处理逻辑，支持小数金额
  - 支付成功后自动创建购买记录，避免重复购买
  - 修复return_url动态域名获取，移除数据库配置依赖
  - 支付流程：支付成功→增加积分→自动购买资源→扣除积分→创建购买记录

- June 25, 2025: 修复支付URL硬编码域名问题，支持动态域名
  - 修复return_url和notify_url中的硬编码域名问题
  - 支付接口现在动态获取当前请求的域名
  - 兼容开发环境的动态域名和生产环境的固定域名
  - 修复ES模块中__dirname未定义问题
  - 完整支持ZPAY支付成功后的参数跳转功能

- June 25, 2025: 完善支付接口安全性和规范性，彻底解决支付结果页面401错误
  - 添加订单金额校验，防止假通知攻击
  - 支持GET和POST两种回调方式，符合ZPAY接口规范
  - 增强回调参数验证，确保必要参数完整性
  - 创建PaymentResultSimple组件，移除身份验证依赖
  - 支付成功后自动关闭弹出窗口，优化用户体验
  - 完整的支付流程：异步回调处理业务逻辑，同步跳转显示结果
  - 资源价格支持小数输入，前端表单step设为0.01，数据库使用numeric(10,2)类型

- June 25, 2025: 修复支付接口重大逻辑问题
  - 修复支付回调逻辑：支付成功后自动扣除积分完成购买
  - 之前的问题：用户支付后获得积分但积分未被扣除，导致既有积分又有资源
  - 现在的逻辑：支付成功 → 增加积分 → 自动购买资源 → 扣除积分
  - 添加重复购买检查，避免重复处理同一订单
  - 优化支付结果页面重试逻辑和用户界面提示

- June 25, 2025: 优化资源价格显示格式
  - 创建通用价格格式化函数 formatPrice
  - 支持小数价格显示（如0.01积分）
  - 整数价格省略小数点（如1.0显示为1）
  - 在ResourceCard和ResourceDetail中统一使用

- June 25, 2025: 添加会员删除功能
  - 后端添加 DELETE /api/admin/users/:id API路由
  - 实现级联删除用户相关数据（购买记录、收藏、评论等）
  - 前端会员管理页面添加删除按钮（文字样式）
  - 安全验证：防止删除管理员和自己账户

## Changelog

Changelog:
- June 25, 2025. Initial setup