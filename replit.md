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

- June 25, 2025: 修复支付接口问题
  - 优化支付结果页面重试逻辑，避免"获取订单状态失败"提示
  - 支付成功后自动重试获取订单状态（最多10次，每3秒一次）
  - 改进用户界面提示信息，显示"正在验证支付结果"
  - 添加支付成功的toast提示和更友好的操作按钮
  - 修正return_url参数，确保订单号正确传递

- June 25, 2025: 添加会员删除功能
  - 后端添加 DELETE /api/admin/users/:id API路由
  - 实现级联删除用户相关数据（购买记录、收藏、评论等）
  - 前端会员管理页面添加删除按钮（文字样式）
  - 安全验证：防止删除管理员和自己账户

## Changelog

Changelog:
- June 25, 2025. Initial setup