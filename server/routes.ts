import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage, ResourceFilters } from "./storage";
import session from "express-session";
import { z } from "zod";
import { 
  insertCategorySchema, 
  insertResourceSchema, 
  insertResourceRequestSchema,
  insertReviewSchema,
  insertAuthorSchema,
  loginSchema, 
  registerSchema,
  type Review,
  type Author,
  type Resource,
  type Category
} from "@shared/schema";

// 扩展Resource类型的接口，允许添加category和author属性
interface EnrichedResource extends Resource {
  category?: Category;
  author?: Author;
}
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
      

      // Enrich resources with category and author data
      const enrichedResources = await Promise.all(result.resources.map(async (resource) => {
        const enrichedResource: EnrichedResource = { ...resource };
        
        // 获取分类信息
        if (resource.category_id) {
          const category = await storage.getCategory(resource.category_id);
          if (category) {
            enrichedResource.category = category;
          }
        }
        
        // 获取作者信息
        if (resource.author_id) {
          const author = await storage.getAuthor(resource.author_id);
          if (author) {
            enrichedResource.author = author;
          }
        }
        
        return enrichedResource;
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

      // Include category and author data if available
      const result: EnrichedResource = { ...resource };
      
      // 获取分类信息
      if (resource.category_id) {
        const category = await storage.getCategory(resource.category_id);
        if (category) {
          result.category = category;
        }
      }
      
      // 获取作者信息
      if (resource.author_id) {
        const author = await storage.getAuthor(resource.author_id);
        if (author) {
          result.author = author;
        }
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
      
      if (req.query.search) {
        filters.search = req.query.search as string;
      }

      if (req.query.page) {
        filters.page = parseInt(req.query.page as string);
        filters.limit = parseInt(req.query.limit as string) || 10;
      }

      const result = await storage.getAllResources(filters);
      
      // Enrich resources with category and author data
      const enrichedResources = await Promise.all(result.resources.map(async (resource) => {
        const enrichedResource: EnrichedResource = { ...resource };
        
        // 获取分类信息
        if (resource.category_id) {
          const category = await storage.getCategory(resource.category_id);
          if (category) {
            enrichedResource.category = category;
          }
        }
        
        // 获取作者信息
        if (resource.author_id) {
          const author = await storage.getAuthor(resource.author_id);
          if (author) {
            enrichedResource.author = author;
          }
        }
        
        return enrichedResource;
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

  // Admin user creation endpoint
  app.post('/api/admin/users', authenticateUser as any, authorizeAdmin as any, async (req, res) => {
    try {
      // Create schema for new user creation
      const createUserSchema = z.object({
        email: z.string().email("邮箱格式不正确"),
        password: z.string().min(6, "密码长度至少6位"),
        membership_type: z.string().default("regular"),
        coins: z.number().default(0),
        avatar: z.string().optional()
      });

      const validationResult = createUserSchema.safeParse(req.body);
      if (!validationResult.success) {
        res.status(400).json({ message: '用户数据无效', errors: validationResult.error.format() });
        return;
      }

      // Check if email already exists
      const existingUser = await storage.getUserByEmail(validationResult.data.email);
      if (existingUser) {
        res.status(400).json({ message: '该邮箱已被注册' });
        return;
      }

      // Hash password
      const bcrypt = await import('bcrypt');
      const hashedPassword = await bcrypt.hash(validationResult.data.password, 10);

      // Create user with hashed password
      const userData = {
        ...validationResult.data,
        password: hashedPassword
      };

      const newUser = await storage.createUser(userData);

      // Remove password from response
      const { password, ...userWithoutPassword } = newUser;
      res.status(201).json(userWithoutPassword);
    } catch (error) {
      console.error('Error creating user:', error);
      res.status(500).json({ message: '创建用户失败' });
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

  // Resource Request routes - Publicly accessible for submission
  app.post('/api/resource-requests', async (req, res) => {
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

  // 更新用户个人资料
  app.patch('/api/users/:id', authenticateUser as any, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = parseInt(req.params.id);
      
      // 检查权限：只能修改自己的资料，或者管理员可以修改任何人的资料
      if (req.user?.id !== userId && req.user?.membership_type !== 'admin') {
        return res.status(403).json({ message: '您没有权限修改此用户资料' });
      }
      
      // 创建Schema验证请求数据
      const updateProfileSchema = z.object({
        email: z.string().email("邮箱格式不正确").optional(),
        avatar: z.string().optional(),
      });
      
      const validationResult = updateProfileSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ message: '数据格式错误', errors: validationResult.error.format() });
      }
      
      // 从验证结果中获取更新数据
      const updateData = validationResult.data;
      
      // 更新用户资料
      const updatedUser = await storage.updateUser(userId, updateData);
      
      if (!updatedUser) {
        return res.status(404).json({ message: '用户不存在' });
      }
      
      // 返回更新后的用户资料（不包含密码）
      const { password, ...userWithoutPassword } = updatedUser;
      res.json({
        ...userWithoutPassword,
        role: req.user?.membership_type === 'admin' ? 'admin' : 'user'
      });
      
    } catch (error) {
      console.error('Error updating user profile:', error);
      res.status(500).json({ message: '更新资料失败，请稍后再试' });
    }
  });
  
  // 修改用户密码
  app.patch('/api/users/:id/password', authenticateUser as any, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = parseInt(req.params.id);
      
      // 检查权限：只能修改自己的密码，管理员也不能修改他人密码
      if (req.user?.id !== userId) {
        return res.status(403).json({ message: '您没有权限修改此用户密码' });
      }
      
      // 创建Schema验证请求数据
      const changePasswordSchema = z.object({
        currentPassword: z.string().min(6, "当前密码长度至少6位"),
        newPassword: z.string().min(6, "新密码长度至少6位"),
      });
      
      const validationResult = changePasswordSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ message: '数据格式错误', errors: validationResult.error.format() });
      }
      
      // 获取用户信息
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: '用户不存在' });
      }
      
      // 验证当前密码
      const bcrypt = await import('bcrypt');
      const isPasswordValid = await bcrypt.compare(validationResult.data.currentPassword, user.password);
      if (!isPasswordValid) {
        return res.status(400).json({ message: '当前密码不正确' });
      }
      
      // 哈希新密码
      const hashedPassword = await bcrypt.hash(validationResult.data.newPassword, 10);
      
      // 更新密码
      const updatedUser = await storage.updateUser(userId, { password: hashedPassword });
      
      if (!updatedUser) {
        return res.status(500).json({ message: '密码更新失败' });
      }
      
      res.json({ message: '密码修改成功' });
      
    } catch (error) {
      console.error('Error changing password:', error);
      res.status(500).json({ message: '修改密码失败，请稍后再试' });
    }
  });

  // Review routes
  app.get('/api/resources/:resourceId/reviews', async (req, res) => {
    try {
      const resourceId = parseInt(req.params.resourceId);
      if (isNaN(resourceId)) {
        res.status(400).json({ message: '无效的资源ID' });
        return;
      }
      
      // 获取当前用户ID（如果已登录）
      const userId = (req as any).session?.userId;
      const isAdmin = (req as any).user?.membership_type === 'admin';
      
      // 获取全部评论
      const reviews = await storage.getReviewsByResource(resourceId);
      
      // 根据用户权限过滤评论
      const filteredReviews = reviews.filter(review => {
        // 管理员可以看到所有评论
        if (isAdmin) return true;
        
        // 自己的评论自己可以看到
        if (userId && review.user_id === userId) return true;
        
        // 其他用户只能看到已审核通过的评论
        return review.status === 1;
      });
      
      // Enrich reviews with user data (excluding password)
      const enrichedReviews = await Promise.all(filteredReviews.map(async (review) => {
        const user = await storage.getUser(review.user_id);
        if (user) {
          const { password, ...userWithoutPassword } = user;
          return { ...review, user: userWithoutPassword };
        }
        return review;
      }));
      
      res.json(enrichedReviews);
    } catch (error) {
      console.error('Error fetching reviews:', error);
      res.status(500).json({ message: '获取评价列表失败' });
    }
  });

  app.get('/api/resources/:resourceId/rating', async (req, res) => {
    try {
      const resourceId = parseInt(req.params.resourceId);
      if (isNaN(resourceId)) {
        res.status(400).json({ message: '无效的资源ID' });
        return;
      }

      const average = await storage.getResourceAverageRating(resourceId);
      const count = await storage.getResourceReviewCount(resourceId);
      
      res.json({ average, count });
    } catch (error) {
      console.error('Error fetching rating:', error);
      res.status(500).json({ message: '获取评分失败' });
    }
  });

  app.post('/api/resources/:resourceId/reviews', authenticateUser as any, async (req: AuthenticatedRequest, res) => {
    try {
      const resourceId = parseInt(req.params.resourceId);
      if (isNaN(resourceId)) {
        res.status(400).json({ message: '无效的资源ID' });
        return;
      }

      // Check if the resource exists
      const resource = await storage.getResource(resourceId);
      if (!resource) {
        res.status(404).json({ message: '资源不存在' });
        return;
      }

      // 确保用户已登录
      if (!req.user) {
        res.status(401).json({ message: '必须登录才能提交评价' });
        return;
      }

      // Add user_id to the review data
      const reviewData = {
        ...req.body,
        user_id: req.user.id,
        resource_id: resourceId
      };

      const validationResult = insertReviewSchema.safeParse(reviewData);
      if (!validationResult.success) {
        res.status(400).json({ 
          message: '评价数据无效', 
          errors: validationResult.error.format() 
        });
        return;
      }

      // Check if the user already reviewed this resource
      const userReviews = await storage.getReviewsByUser(req.user.id);
      const existingReview = userReviews.find(review => review.resource_id === resourceId);
      
      if (existingReview) {
        // Update existing review
        const updatedReview = await storage.updateReview(existingReview.id, validationResult.data);
        res.json(updatedReview);
      } else {
        // Create new review
        const review = await storage.createReview(validationResult.data);
        res.status(201).json(review);
      }
    } catch (error) {
      console.error('Error submitting review:', error);
      res.status(500).json({ message: '提交评价失败' });
    }
  });

  app.delete('/api/reviews/:id', authenticateUser as any, async (req: AuthenticatedRequest, res) => {
    try {
      const reviewId = parseInt(req.params.id);
      if (isNaN(reviewId)) {
        res.status(400).json({ message: '无效的评价ID' });
        return;
      }

      const review = await storage.getReview(reviewId);
      if (!review) {
        res.status(404).json({ message: '评价不存在' });
        return;
      }

      // 检查是否是评价的作者或管理员
      if (req.user?.id !== review.user_id && req.user?.membership_type !== 'admin') {
        res.status(403).json({ message: '无权删除该评价' });
        return;
      }

      const deleted = await storage.deleteReview(reviewId);
      if (!deleted) {
        res.status(404).json({ message: '评价不存在' });
        return;
      }

      res.status(204).end();
    } catch (error) {
      console.error('Error deleting review:', error);
      res.status(500).json({ message: '删除评价失败' });
    }
  });
  
  // 获取所有待审核的评论（管理员专用）
  app.get('/api/admin/reviews', authenticateUser as any, authorizeAdmin as any, async (req: AuthenticatedRequest, res) => {
    try {
      // 获取所有评论
      const allReviews = await storage.getAllReviews();
      
      // 丰富评论数据，添加用户信息和资源信息
      const enrichedReviews = await Promise.all(allReviews.map(async (review: Review) => {
        // 添加用户信息
        const user = await storage.getUser(review.user_id);
        let userInfo = null;
        if (user) {
          const { password, ...userWithoutPassword } = user;
          userInfo = userWithoutPassword;
        }
        
        // 添加资源信息
        const resource = await storage.getResource(review.resource_id);
        
        return { 
          ...review, 
          user: userInfo,
          resource: resource || null
        };
      }));
      
      res.json(enrichedReviews);
    } catch (error) {
      console.error('Error fetching reviews for admin:', error);
      res.status(500).json({ message: '获取评论列表失败' });
    }
  });
  
  // 获取管理员登录日志
  app.get('/api/admin/login-logs', authenticateUser as any, authorizeAdmin as any, async (req: AuthenticatedRequest, res) => {
    try {
      // 验证请求用户是否为指定管理员
      if (req.user?.email !== '1034936667@qq.com') {
        return res.status(403).json({ message: '只有特定管理员可以查看登录日志' });
      }
      
      // 获取管理员邮箱和限制参数
      const { email, limit } = req.query;
      const adminEmail = email as string || '1034936667@qq.com';
      const logLimit = limit ? parseInt(limit as string) : undefined;
      
      // 获取登录日志
      const logs = await storage.getAdminLoginLogs(adminEmail, logLimit);
      
      res.json(logs);
    } catch (error) {
      console.error('Error fetching admin login logs:', error);
      res.status(500).json({ message: '获取管理员登录日志失败' });
    }
  });
  
  // 审核评论
  app.patch('/api/admin/reviews/:id', authenticateUser as any, authorizeAdmin as any, async (req: AuthenticatedRequest, res) => {
    try {
      const reviewId = parseInt(req.params.id);
      if (isNaN(reviewId)) {
        res.status(400).json({ message: '无效的评论ID' });
        return;
      }
      
      const review = await storage.getReview(reviewId);
      if (!review) {
        res.status(404).json({ message: '评论不存在' });
        return;
      }
      
      // 验证请求数据
      const reviewUpdateSchema = z.object({
        status: z.number().min(0).max(2),
        admin_notes: z.string().optional()
      });
      
      const validationResult = reviewUpdateSchema.safeParse(req.body);
      if (!validationResult.success) {
        res.status(400).json({ 
          message: '数据格式错误', 
          errors: validationResult.error.format() 
        });
        return;
      }
      
      // 更新评论状态
      const updatedReview = await storage.updateReview(reviewId, validationResult.data);
      if (!updatedReview) {
        res.status(404).json({ message: '评论不存在' });
        return;
      }
      
      res.json(updatedReview);
    } catch (error) {
      console.error('Error reviewing comment:', error);
      res.status(500).json({ message: '审核评论失败' });
    }
  });

  // 作者管理路由
  // 获取所有作者
  app.get('/api/authors', async (req, res) => {
    try {
      const authors = await storage.getAllAuthors();
      res.json(authors);
    } catch (error) {
      console.error('Error fetching authors:', error);
      res.status(500).json({ message: '获取作者列表失败' });
    }
  });

  // 获取单个作者信息
  app.get('/api/authors/:id', async (req, res) => {
    try {
      const authorId = parseInt(req.params.id);
      if (isNaN(authorId)) {
        res.status(400).json({ message: '无效的作者ID' });
        return;
      }

      const author = await storage.getAuthor(authorId);
      if (!author) {
        res.status(404).json({ message: '作者不存在' });
        return;
      }

      res.json(author);
    } catch (error) {
      console.error('Error fetching author:', error);
      res.status(500).json({ message: '获取作者详情失败' });
    }
  });

  // 创建作者（仅管理员）
  app.post('/api/authors', authenticateUser as any, authorizeAdmin as any, async (req, res) => {
    try {
      const validationResult = insertAuthorSchema.safeParse(req.body);
      if (!validationResult.success) {
        res.status(400).json({ message: '作者数据无效', errors: validationResult.error.format() });
        return;
      }

      const author = await storage.createAuthor(validationResult.data);
      res.status(201).json(author);
    } catch (error) {
      console.error('Error creating author:', error);
      res.status(500).json({ message: '创建作者失败' });
    }
  });

  // 更新作者信息（仅管理员）
  app.patch('/api/authors/:id', authenticateUser as any, authorizeAdmin as any, async (req, res) => {
    try {
      const authorId = parseInt(req.params.id);
      if (isNaN(authorId)) {
        res.status(400).json({ message: '无效的作者ID' });
        return;
      }

      const validationResult = insertAuthorSchema.partial().safeParse(req.body);
      if (!validationResult.success) {
        res.status(400).json({ message: '作者数据无效', errors: validationResult.error.format() });
        return;
      }

      const updatedAuthor = await storage.updateAuthor(authorId, validationResult.data);
      if (!updatedAuthor) {
        res.status(404).json({ message: '作者不存在' });
        return;
      }

      res.json(updatedAuthor);
    } catch (error) {
      console.error('Error updating author:', error);
      res.status(500).json({ message: '更新作者失败' });
    }
  });

  // 删除作者（仅管理员）
  app.delete('/api/authors/:id', authenticateUser as any, authorizeAdmin as any, async (req, res) => {
    try {
      const authorId = parseInt(req.params.id);
      if (isNaN(authorId)) {
        res.status(400).json({ message: '无效的作者ID' });
        return;
      }

      const deleted = await storage.deleteAuthor(authorId);
      if (!deleted) {
        res.status(404).json({ message: '作者不存在' });
        return;
      }

      res.status(204).end();
    } catch (error) {
      console.error('Error deleting author:', error);
      res.status(500).json({ message: '删除作者失败' });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
