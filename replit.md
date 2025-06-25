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

- June 25, 2025: 简化支付流程，移除订单查找依赖
  - 支付回调不再查找订单记录，直接处理支付成功逻辑
  - 前端支付结果页面简化，不再显示购买资源相关内容
  - 支付成功后仅显示充值成功提示，自动关闭弹窗
  - 支持GET和POST两种回调方式，符合ZPAY接口规范
  - 完全移除身份验证依赖，解决401错误问题

- June 25, 2025: 修复支付接口重大逻辑问题
  - 修复支付回调逻辑：支付成功后自动扣除积分完成购买
  - 之前的问题：用户支付后获得积分但积分未被扣除，导致既有积分又有资源
  - 现在的逻辑：支付成功 → 增加积分 → 自动购买资源 → 扣除积分
  - 添加重复购买检查，避免重复处理同一订单
  - 优化支付结果页面重试逻辑和用户界面提示

- June 25, 2025: 添加会员删除功能
  - 后端添加 DELETE /api/admin/users/:id API路由
  - 实现级联删除用户相关数据（购买记录、收藏、评论等）
  - 前端会员管理页面添加删除按钮（文字样式）
  - 安全验证：防止删除管理员和自己账户

## Changelog

Changelog:
- June 25, 2025. Initial setup