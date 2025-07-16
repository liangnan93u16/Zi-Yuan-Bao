# Overview

This is a full-stack web application for learning resource sharing called "资源宝" (Resource Treasure). It's built as a marketplace where users can discover, purchase, and download educational content like video tutorials, ebooks, and learning materials. The platform includes both user-facing features and administrative tools for content management.

# User Preferences

Preferred communication style: Simple, everyday language.
Node.js version preference: 18.15

# System Architecture

## Frontend Architecture
- **React 18** with TypeScript as the main frontend framework
- **Vite** as the build tool and development server
- **Tailwind CSS** for styling with shadcn/ui component library
- **Wouter** for client-side routing (lightweight React router alternative)
- **React Query (TanStack Query)** for server state management and API calls
- **React Hook Form** with Zod validation for form handling

## Backend Architecture
- **Express.js** server with TypeScript
- **Node.js** runtime environment
- **Session-based authentication** using express-session
- **RESTful API** design pattern
- **PostgreSQL** database with Drizzle ORM
- **Neon Database** as the PostgreSQL provider

## Key Components

### Database Layer
- **Drizzle ORM** for type-safe database operations
- **PostgreSQL** as the primary database
- Database schema includes:
  - Users with role-based access (user/admin)
  - Categories for organizing resources
  - Resources (educational content) with metadata
  - Reviews and ratings system
  - Purchase tracking and user favorites
  - Administrative logging

### Authentication System
- **Bcrypt** for password hashing
- **Session-based authentication** with role differentiation
- Account lockout mechanism for security
- Admin elevation capabilities

### File Management
- **Multer** for file uploads
- Local file storage for images and resources
- Image processing and optimization

### Payment Integration
- **ZPAY** payment gateway integration
- Order management system
- Payment verification and callbacks

### Email System
- **Nodemailer** for email functionality
- Configurable email providers through system parameters
- Email notifications for various events

## Data Flow

1. **User Registration/Login**: Users authenticate through the session-based system
2. **Resource Discovery**: Users browse categories and search for educational content
3. **Purchase Flow**: Users can purchase premium content through the integrated payment system
4. **Content Access**: Purchased resources become available for download
5. **Administrative Management**: Admins can manage users, resources, and system settings

## External Dependencies

### Database
- **@neondatabase/serverless**: Neon PostgreSQL connection
- **drizzle-orm**: Type-safe ORM for database operations

### Frontend Libraries
- **@radix-ui/**: Comprehensive UI component primitives
- **@tanstack/react-query**: Server state management
- **react-helmet-async**: SEO meta tag management
- **lucide-react**: Icon library

### Backend Services
- **nodemailer**: Email service integration
- **axios**: HTTP client for external API calls
- **cheerio**: HTML parsing for web scraping features

### Development Tools
- **tsx**: TypeScript execution for Node.js
- **esbuild**: Fast JavaScript bundler for production builds

## Deployment Strategy

The application is configured for deployment on Replit with:
- **Development**: Uses tsx for hot reloading during development
- **Production**: Builds with Vite for frontend and esbuild for backend
- **Database**: Connects to Neon PostgreSQL instance
- **Static Assets**: Served through Express with proper caching headers
- **Environment Variables**: Database URL and other sensitive configs managed through environment variables

The architecture emphasizes type safety throughout the stack with TypeScript, efficient development workflows with hot reloading, and a scalable database design that can handle both free and premium content distribution.