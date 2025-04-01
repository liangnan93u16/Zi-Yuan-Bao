import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage, ResourceFilters } from "./storage";
import session from "express-session";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import { getRateLimitConfig, rateLimitConfig } from "./config";
import { 
  insertCategorySchema, 
  insertResourceSchema, 
  insertResourceRequestSchema,
  loginSchema, 
  registerSchema 
} from "@shared/schema";
import { 
  login, 
  register, 
  logout, 
  authenticateUser, 
  authorizeAdmin, 
  getCurrentUser,
  AuthenticatedRequest
} from "./auth";

export async function registerRoutes(app: Express): Promise<Server> {
  // 获取当前环境的速率限制配置
  const config = getRateLimitConfig();
  console.log('当前速率限制配置:', JSON.stringify(config, null, 2));
  
  // 资源请求速率限制 - 全局IP限制
  const globalLimiter = rateLimit({
    windowMs: config.global.windowMs,
    max: config.global.max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: '请求过于频繁，请稍后再试' }
  });

  // 资源请求速率限制 - 资源请求专用限制
  const resourceRequestLimiter = rateLimit({
    windowMs: config.resourceRequest.windowMs,
    max: config.resourceRequest.max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: `您提交的资源请求过多，请${Math.round(config.resourceRequest.windowMs / (60 * 60 * 1000))}小时后再试` }
  });

  // 应用全局限制器
  app.use(globalLimiter);

  // Session middleware with memorystore
  // Dynamically import memorystore and create store
  const memorystore = await import('memorystore');
  const MemoryStore = memorystore.default(session);
  
  app.use(
    session({
      cookie: { maxAge: 86400000 }, // 1 day
      store: new MemoryStore({
        checkPeriod: 86400000 // prune expired entries every 24h
      }),
      resave: false,
      saveUninitialized: false,
      secret: process.env.SESSION_SECRET || 'resource-sharing-secret'
    })
  );

  // Authentication routes
  app.post('/api/auth/login', login);
  app.post('/api/auth/register', register);
  app.post('/api/auth/logout', logout);
  app.get('/api/auth/me', getCurrentUser);
  
  // 特殊用户权限升级路由
  app.post('/api/auth/elevate', authenticateUser as any, async (req: AuthenticatedRequest, res) => {
    try {
      console.log('Elevate route called, checking user:', req.user?.email);
      if (!req.user) {
        console.log('No user in request');
        res.status(401).json({ message: '未登录或会话已过期' });
        return;
      }
      
      // 如果用户邮箱是特定邮箱，则将其升级为管理员
      console.log('Checking if user can be elevated:', req.user.email, 'membership_type:', req.user.membership_type);
      if (req.user.email === '1034936667@qq.com' && req.user.membership_type !== 'admin') {
        console.log('User qualifies for elevation to admin');
        const updatedUser = await storage.updateUser(req.user.id, { 
          membership_type: 'admin' 
        });
        
        if (!updatedUser) {
          console.log('Updated user not found');
          res.status(404).json({ message: '用户不存在' });
          return;
        }
        
        // 返回用户信息（不包含密码）
        const { password, ...userWithoutPassword } = updatedUser;
        console.log('User elevated to admin successfully:', userWithoutPassword);
        
        // 确保响应中包含正确的role属性
        res.status(200).json({
          ...userWithoutPassword,
          role: 'admin',
          message: '您的账号已升级为管理员'
        });
      } else {
        console.log('User does not qualify for elevation:', req.user.email, 'membership_type:', req.user.membership_type);
        res.status(403).json({ message: '您的账号不符合升级条件' });
      }
    } catch (error) {
      console.error('Error elevating user:', error);
      res.status(500).json({ message: '升级账号权限时发生错误' });
    }
  });

  // Category routes
  app.get('/api/categories', async (req, res) => {
    try {
      const categories = await storage.getAllCategories();
      res.json(categories);
    } catch (error) {
      console.error('Error fetching categories:', error);
      res.status(500).json({ message: '获取分类列表失败' });
    }
  });

  app.get('/api/categories/:id', async (req, res) => {
    try {
      const categoryId = parseInt(req.params.id);
      if (isNaN(categoryId)) {
        res.status(400).json({ message: '无效的分类ID' });
        return;
      }

      const category = await storage.getCategory(categoryId);
      if (!category) {
        res.status(404).json({ message: '分类不存在' });
        return;
      }

      res.json(category);
    } catch (error) {
      console.error('Error fetching category:', error);
      res.status(500).json({ message: '获取分类详情失败' });
    }
  });

  app.post('/api/categories', authenticateUser as any, authorizeAdmin as any, async (req, res) => {
    try {
      const validationResult = insertCategorySchema.safeParse(req.body);
      if (!validationResult.success) {
        res.status(400).json({ message: '分类数据无效', errors: validationResult.error.format() });
        return;
      }

      const category = await storage.createCategory(validationResult.data);
      res.status(201).json(category);
    } catch (error) {
      console.error('Error creating category:', error);
      res.status(500).json({ message: '创建分类失败' });
    }
  });

  app.put('/api/categories/:id', authenticateUser as any, authorizeAdmin as any, async (req, res) => {
    try {
      const categoryId = parseInt(req.params.id);
      if (isNaN(categoryId)) {
        res.status(400).json({ message: '无效的分类ID' });
        return;
      }

      const validationResult = insertCategorySchema.partial().safeParse(req.body);
      if (!validationResult.success) {
        res.status(400).json({ message: '分类数据无效', errors: validationResult.error.format() });
        return;
      }

      const updatedCategory = await storage.updateCategory(categoryId, validationResult.data);
      if (!updatedCategory) {
        res.status(404).json({ message: '分类不存在' });
        return;
      }

      res.json(updatedCategory);
    } catch (error) {
      console.error('Error updating category:', error);
      res.status(500).json({ message: '更新分类失败' });
    }
  });

  app.delete('/api/categories/:id', authenticateUser as any, authorizeAdmin as any, async (req, res) => {
    try {
      const categoryId = parseInt(req.params.id);
      if (isNaN(categoryId)) {
        res.status(400).json({ message: '无效的分类ID' });
        return;
      }

      const deleted = await storage.deleteCategory(categoryId);
      if (!deleted) {
        res.status(404).json({ message: '分类不存在' });
        return;
      }

      res.status(204).end();
    } catch (error) {
      console.error('Error deleting category:', error);
      res.status(500).json({ message: '删除分类失败' });
    }
  });

  // Resource routes
  app.get('/api/resources', async (req, res) => {
    try {
      const filters: ResourceFilters = {};

      // Parse query parameters
      if (req.query.category_id) {
        filters.category_id = parseInt(req.query.category_id as string);
      }

      if (req.query.status) {
        filters.status = parseInt(req.query.status as string);
      }

      if (req.query.is_free) {
        filters.is_free = req.query.is_free === 'true';
      }

      if (req.query.search) {
        filters.search = req.query.search as string;
      }

      if (req.query.page) {
        filters.page = parseInt(req.query.page as string);
        filters.limit = parseInt(req.query.limit as string) || 10;
      }

      const result = await storage.getAllResources(filters);
      
      // Enrich resources with category data
      const enrichedResources = await Promise.all(result.resources.map(async (resource) => {
        if (resource.category_id) {
          const category = await storage.getCategory(resource.category_id);
          return { ...resource, category };
        }
        return resource;
      }));

      res.json({ ...result, resources: enrichedResources });
    } catch (error) {
      console.error('Error fetching resources:', error);
      res.status(500).json({ message: '获取资源列表失败' });
    }
  });

  app.get('/api/resources/:id', async (req, res) => {
    try {
      const resourceId = parseInt(req.params.id);
      if (isNaN(resourceId)) {
        res.status(400).json({ message: '无效的资源ID' });
        return;
      }

      const resource = await storage.getResource(resourceId);
      if (!resource) {
        res.status(404).json({ message: '资源不存在' });
        return;
      }

      // Include category data if available
      let result: any = resource;
      if (resource.category_id) {
        const category = await storage.getCategory(resource.category_id);
        result = { ...resource, category };
      }

      res.json(result);
    } catch (error) {
      console.error('Error fetching resource:', error);
      res.status(500).json({ message: '获取资源详情失败' });
    }
  });

  app.post('/api/resources', authenticateUser as any, authorizeAdmin as any, async (req, res) => {
    try {
      const validationResult = insertResourceSchema.safeParse(req.body);
      if (!validationResult.success) {
        res.status(400).json({ message: '资源数据无效', errors: validationResult.error.format() });
        return;
      }

      // Check if category exists if category_id is provided
      if (validationResult.data.category_id) {
        const category = await storage.getCategory(validationResult.data.category_id);
        if (!category) {
          res.status(400).json({ message: '所选分类不存在' });
          return;
        }
      }

      const resource = await storage.createResource(validationResult.data);
      res.status(201).json(resource);
    } catch (error) {
      console.error('Error creating resource:', error);
      res.status(500).json({ message: '创建资源失败' });
    }
  });

  app.patch('/api/resources/:id', authenticateUser as any, authorizeAdmin as any, async (req, res) => {
    try {
      const resourceId = parseInt(req.params.id);
      if (isNaN(resourceId)) {
        res.status(400).json({ message: '无效的资源ID' });
        return;
      }

      const validationResult = insertResourceSchema.partial().safeParse(req.body);
      if (!validationResult.success) {
        res.status(400).json({ message: '资源数据无效', errors: validationResult.error.format() });
        return;
      }

      // Check if category exists if category_id is provided
      if (validationResult.data.category_id) {
        const category = await storage.getCategory(validationResult.data.category_id);
        if (!category) {
          res.status(400).json({ message: '所选分类不存在' });
          return;
        }
      }

      const updatedResource = await storage.updateResource(resourceId, validationResult.data);
      if (!updatedResource) {
        res.status(404).json({ message: '资源不存在' });
        return;
      }

      res.json(updatedResource);
    } catch (error) {
      console.error('Error updating resource:', error);
      res.status(500).json({ message: '更新资源失败' });
    }
  });

  app.delete('/api/resources/:id', authenticateUser as any, authorizeAdmin as any, async (req, res) => {
    try {
      const resourceId = parseInt(req.params.id);
      if (isNaN(resourceId)) {
        res.status(400).json({ message: '无效的资源ID' });
        return;
      }

      const deleted = await storage.deleteResource(resourceId);
      if (!deleted) {
        res.status(404).json({ message: '资源不存在' });
        return;
      }

      res.status(204).end();
    } catch (error) {
      console.error('Error deleting resource:', error);
      res.status(500).json({ message: '删除资源失败' });
    }
  });

  // Admin resource routes
  app.get('/api/admin/resources', authenticateUser as any, authorizeAdmin as any, async (req, res) => {
    try {
      const filters: ResourceFilters = {};

      // Parse query parameters
      if (req.query.category_id) {
        filters.category_id = parseInt(req.query.category_id as string);
      }

      if (req.query.status) {
        filters.status = parseInt(req.query.status as string);
      }

      if (req.query.is_free !== undefined) {
        filters.is_free = req.query.is_free === 'true';
      }

      if (req.query.search) {
        filters.search = req.query.search as string;
      }

      if (req.query.page) {
        filters.page = parseInt(req.query.page as string);
        filters.limit = parseInt(req.query.limit as string) || 10;
      }

      const result = await storage.getAllResources(filters);
      
      // Enrich resources with category data
      const enrichedResources = await Promise.all(result.resources.map(async (resource) => {
        if (resource.category_id) {
          const category = await storage.getCategory(resource.category_id);
          return { ...resource, category };
        }
        return resource;
      }));

      res.json({ ...result, resources: enrichedResources });
    } catch (error) {
      console.error('Error fetching admin resources:', error);
      res.status(500).json({ message: '获取资源列表失败' });
    }
  });

  app.patch('/api/admin/resources/:id', authenticateUser as any, authorizeAdmin as any, async (req, res) => {
    try {
      const resourceId = parseInt(req.params.id);
      if (isNaN(resourceId)) {
        res.status(400).json({ message: '无效的资源ID' });
        return;
      }

      const validationResult = insertResourceSchema.partial().safeParse(req.body);
      if (!validationResult.success) {
        res.status(400).json({ message: '资源数据无效', errors: validationResult.error.format() });
        return;
      }

      const updatedResource = await storage.updateResource(resourceId, validationResult.data);
      if (!updatedResource) {
        res.status(404).json({ message: '资源不存在' });
        return;
      }

      res.json(updatedResource);
    } catch (error) {
      console.error('Error updating admin resource:', error);
      res.status(500).json({ message: '更新资源失败' });
    }
  });

  // User management routes
  app.get('/api/admin/users', authenticateUser as any, authorizeAdmin as any, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      
      // Remove passwords from response
      const safeUsers = users.map(user => {
        const { password, ...userWithoutPassword } = user;
        return userWithoutPassword;
      });
      
      res.json(safeUsers);
    } catch (error) {
      console.error('Error fetching users:', error);
      res.status(500).json({ message: '获取用户列表失败' });
    }
  });

  app.patch('/api/admin/users/:id', authenticateUser as any, authorizeAdmin as any, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      if (isNaN(userId)) {
        res.status(400).json({ message: '无效的用户ID' });
        return;
      }

      // Create schema for updatable user fields
      const updateUserSchema = z.object({
        membership_type: z.string().optional(),
        membership_expire_time: z.string().nullable().optional(),
        coins: z.number().optional(),
        email: z.string().email().optional(),
        avatar: z.string().optional(),
      });

      const validationResult = updateUserSchema.safeParse(req.body);
      if (!validationResult.success) {
        res.status(400).json({ message: '用户数据无效', errors: validationResult.error.format() });
        return;
      }

      // For TypeScript type compatibility, convert userData to any to handle date conversion
      const updatedUserData: any = { ...validationResult.data };
      
      // 处理会员到期时间
      if (updatedUserData.membership_expire_time === null || updatedUserData.membership_expire_time === undefined) {
        // 如果是null或undefined，保持为null（表示没有到期时间）
        updatedUserData.membership_expire_time = null;
      } else if (updatedUserData.membership_expire_time !== "") {
        // 如果是非空字符串，转换为日期对象
        try {
          updatedUserData.membership_expire_time = new Date(updatedUserData.membership_expire_time);
          // 检查是否为有效日期
          if (isNaN(updatedUserData.membership_expire_time.getTime())) {
            throw new Error("Invalid date");
          }
        } catch (e) {
          console.error("Invalid date format:", updatedUserData.membership_expire_time);
          res.status(400).json({ message: '无效的日期格式' });
          return;
        }
      } else {
        // 空字符串也设为null
        updatedUserData.membership_expire_time = null;
      }

      const updatedUser = await storage.updateUser(userId, updatedUserData);
      if (!updatedUser) {
        res.status(404).json({ message: '用户不存在' });
        return;
      }

      // Remove password from response
      const { password, ...userWithoutPassword } = updatedUser;
      res.json(userWithoutPassword);
    } catch (error) {
      console.error('Error updating user:', error);
      res.status(500).json({ message: '更新用户失败' });
    }
  });

  // Resource Request routes - Publicly accessible for submission (with rate limiting)
  app.post('/api/resource-requests', resourceRequestLimiter, async (req, res) => {
    try {
      const validationResult = insertResourceRequestSchema.safeParse(req.body);
      if (!validationResult.success) {
        res.status(400).json({ message: '资源请求数据无效', errors: validationResult.error.format() });
        return;
      }

      const resourceRequest = await storage.createResourceRequest(validationResult.data);
      res.status(201).json(resourceRequest);
    } catch (error) {
      console.error('Error creating resource request:', error);
      res.status(500).json({ message: '提交资源请求失败' });
    }
  });

  // Admin Resource Request routes
  app.get('/api/admin/resource-requests', authenticateUser as any, authorizeAdmin as any, async (req, res) => {
    try {
      const requests = await storage.getAllResourceRequests();
      res.json(requests);
    } catch (error) {
      console.error('Error fetching resource requests:', error);
      res.status(500).json({ message: '获取资源请求列表失败' });
    }
  });

  // 速率限制配置相关API
  app.get('/api/admin/rate-limit-config', authenticateUser as any, authorizeAdmin as any, async (req, res) => {
    try {
      // 返回当前配置
      res.json(rateLimitConfig);
    } catch (error) {
      console.error('Error fetching rate limit config:', error);
      res.status(500).json({ message: '获取速率限制配置失败' });
    }
  });
  
  app.post('/api/admin/rate-limit-config', authenticateUser as any, authorizeAdmin as any, async (req, res) => {
    try {
      // 更新配置
      const newConfig = req.body;
      
      // 验证配置
      if (!newConfig || 
          !newConfig.global || 
          !newConfig.resourceRequest || 
          !newConfig.development) {
        res.status(400).json({ message: '无效的配置数据' });
        return;
      }
      
      // 更新配置
      rateLimitConfig.global = newConfig.global;
      rateLimitConfig.resourceRequest = newConfig.resourceRequest;
      rateLimitConfig.development = newConfig.development;
      
      // 重新配置限制器
      // 由于限制器已经创建，我们需要重启服务器才能应用新的配置
      // 这里我们只是保存配置并返回成功消息
      
      console.log('速率限制配置已更新:', JSON.stringify(rateLimitConfig, null, 2));
      
      res.json({ 
        message: '速率限制配置已更新，重启服务器后生效',
        config: rateLimitConfig
      });
    } catch (error) {
      console.error('Error updating rate limit config:', error);
      res.status(500).json({ message: '更新速率限制配置失败' });
    }
  });

  app.get('/api/admin/resource-requests/:id', authenticateUser as any, authorizeAdmin as any, async (req, res) => {
    try {
      const requestId = parseInt(req.params.id);
      if (isNaN(requestId)) {
        res.status(400).json({ message: '无效的资源请求ID' });
        return;
      }

      const request = await storage.getResourceRequest(requestId);
      if (!request) {
        res.status(404).json({ message: '资源请求不存在' });
        return;
      }

      res.json(request);
    } catch (error) {
      console.error('Error fetching resource request:', error);
      res.status(500).json({ message: '获取资源请求详情失败' });
    }
  });

  app.patch('/api/admin/resource-requests/:id/status', authenticateUser as any, authorizeAdmin as any, async (req, res) => {
    try {
      const requestId = parseInt(req.params.id);
      if (isNaN(requestId)) {
        res.status(400).json({ message: '无效的资源请求ID' });
        return;
      }

      // Create schema for status update
      const updateSchema = z.object({
        status: z.number().min(0).max(3).int(),
        notes: z.string().optional()
      });

      const validationResult = updateSchema.safeParse(req.body);
      if (!validationResult.success) {
        res.status(400).json({ message: '状态数据无效', errors: validationResult.error.format() });
        return;
      }

      const { status, notes } = validationResult.data;
      const updatedRequest = await storage.updateResourceRequestStatus(requestId, status, notes);
      
      if (!updatedRequest) {
        res.status(404).json({ message: '资源请求不存在' });
        return;
      }

      res.json(updatedRequest);
    } catch (error) {
      console.error('Error updating resource request status:', error);
      res.status(500).json({ message: '更新资源请求状态失败' });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
