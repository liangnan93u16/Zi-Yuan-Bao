import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage, ResourceFilters } from "./storage";
import session from "express-session";
import { z } from "zod";
import axios from 'axios';
import * as cheerio from 'cheerio';
import { 
  insertCategorySchema, 
  insertResourceSchema, 
  insertResourceRequestSchema,
  insertReviewSchema,
  insertAuthorSchema,
  insertFeifeiCategorySchema,
  loginSchema, 
  registerSchema,
  type Review,
  type FeifeiResource
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
  
  // 获取用户购买记录
  app.get('/api/user/purchases', authenticateUser as any, async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user) {
        res.status(401).json({ message: '未登录或会话已过期' });
        return;
      }
      
      // 获取用户的购买记录
      const purchases = await storage.getUserPurchases(req.user.id);
      
      // 丰富购买记录数据，添加资源信息
      const enrichedPurchases = await Promise.all(purchases.map(async (purchase) => {
        const resource = await storage.getResource(purchase.resource_id);
        return {
          ...purchase,
          resource: resource || { chinese_title: '未知资源', english_title: null, subtitle: '' }
        };
      }));
      
      res.json(enrichedPurchases);
    } catch (error) {
      console.error('Error fetching user purchases:', error);
      res.status(500).json({ message: '获取购买记录失败' });
    }
  });

  // 资源购买接口
  app.post('/api/resources/:id/purchase', authenticateUser as any, async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user) {
        res.status(401).json({ message: '未登录或会话已过期' });
        return;
      }
      
      const resourceId = parseInt(req.params.id);
      if (isNaN(resourceId)) {
        res.status(400).json({ message: '无效的资源ID' });
        return;
      }
      
      // 获取资源信息
      const resource = await storage.getResource(resourceId);
      if (!resource) {
        res.status(404).json({ message: '资源不存在' });
        return;
      }
      
      // 检查用户是否已经购买过该资源
      const existingPurchase = await storage.getUserPurchase(req.user.id, resourceId);
      if (existingPurchase) {
        // 已购买过，不再扣除积分
        res.json({
          success: true,
          message: '您已购买过此资源',
          resource_url: resource.resource_url,
          remaining_coins: req.user.coins
        });
        return;
      }
      
      // 如果资源是免费的，直接返回成功并记录
      if (resource.is_free) {
        // 记录购买信息（免费购买）
        await storage.createUserPurchase(req.user.id, resourceId, 0);
        
        res.json({ 
          success: true, 
          message: '免费资源获取成功',
          resource_url: resource.resource_url
        });
        return;
      }
      
      // 如果是会员且会员没有过期，可以免费获取资源
      if (req.user.membership_type) {
        // 检查会员是否有效（没有到期时间或当前时间小于到期时间）
        const membershipValid = !req.user.membership_expire_time || 
                               new Date(req.user.membership_expire_time) > new Date();
                               
        if (membershipValid) {
          // 记录购买信息（会员免费获取）
          await storage.createUserPurchase(req.user.id, resourceId, 0);
          
          res.json({ 
            success: true, 
            message: '会员资源获取成功',
            resource_url: resource.resource_url
          });
          return;
        }
      }
      
      // 计算资源价格（确保是数字）
      const price = typeof resource.price === 'string' ? parseFloat(resource.price) : (resource.price || 0);
      
      // 检查用户积分是否足够
      if ((req.user.coins || 0) < price) {
        res.status(400).json({ 
          success: false, 
          message: '积分不足',
          required: price,
          available: req.user.coins || 0
        });
        return;
      }
      
      // 扣除积分
      const updatedUser = await storage.updateUser(req.user.id, {
        coins: (req.user.coins || 0) - price
      });
      
      if (!updatedUser) {
        res.status(500).json({ message: '购买失败，请稍后再试' });
        return;
      }
      
      // 记录购买记录
      await storage.createUserPurchase(req.user.id, resourceId, price);
      
      // 返回成功信息和资源链接
      res.json({
        success: true,
        message: '购买成功，已扣除' + price + '积分',
        resource_url: resource.resource_url,
        remaining_coins: updatedUser.coins
      });
      
    } catch (error) {
      console.error('Error purchasing resource:', error);
      res.status(500).json({ message: '购买资源时发生错误' });
    }
  });

  // Author routes
  app.get('/api/authors', async (req, res) => {
    try {
      const authors = await storage.getAllAuthors();
      res.json(authors);
    } catch (error) {
      console.error('Error fetching authors:', error);
      res.status(500).json({ message: '获取作者列表失败' });
    }
  });

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

  app.post('/api/authors', authenticateUser as any, authorizeAdmin as any, async (req, res) => {
    try {
      const validationResult = insertAuthorSchema.safeParse(req.body);
      if (!validationResult.success) {
        res.status(400).json({ message: '作者数据无效', errors: validationResult.error.format() });
        return;
      }

      const newAuthor = await storage.createAuthor(validationResult.data);
      res.status(201).json(newAuthor);
    } catch (error) {
      console.error('Error creating author:', error);
      res.status(500).json({ message: '创建作者失败' });
    }
  });

  app.patch('/api/authors/:id', authenticateUser as any, authorizeAdmin as any, async (req, res) => {
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

      const validationResult = insertAuthorSchema.partial().safeParse(req.body);
      if (!validationResult.success) {
        res.status(400).json({ message: '作者数据无效', errors: validationResult.error.format() });
        return;
      }

      const updatedAuthor = await storage.updateAuthor(authorId, validationResult.data);
      res.json(updatedAuthor);
    } catch (error) {
      console.error('Error updating author:', error);
      res.status(500).json({ message: '更新作者失败' });
    }
  });

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
        const enrichedResource = { ...resource };
        
        // 添加分类信息
        if (resource.category_id) {
          const category = await storage.getCategory(resource.category_id);
          enrichedResource.category = category;
        }
        
        // 添加作者信息
        if (resource.author_id) {
          const author = await storage.getAuthor(resource.author_id);
          enrichedResource.author = author;
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

      // 准备结果对象
      let result: any = { ...resource };
      
      // 包含分类数据
      if (resource.category_id) {
        const category = await storage.getCategory(resource.category_id);
        result.category = category;
      }
      
      // 包含作者数据
      if (resource.author_id) {
        const author = await storage.getAuthor(resource.author_id);
        result.author = author;
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
      
      // Enrich resources with category and author data
      const enrichedResources = await Promise.all(result.resources.map(async (resource) => {
        const enrichedResource = { ...resource };
        
        // 添加分类信息
        if (resource.category_id) {
          const category = await storage.getCategory(resource.category_id);
          enrichedResource.category = category;
        }
        
        // 添加作者信息
        if (resource.author_id) {
          const author = await storage.getAuthor(resource.author_id);
          enrichedResource.author = author;
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

  // Resource Request routes
  app.post('/api/resource-requests', authenticateUser as any, async (req, res) => {
    try {
      if (!req.user) {
        res.status(401).json({ message: '未登录或会话已过期' });
        return;
      }

      const validationResult = insertResourceRequestSchema.safeParse({
        ...req.body,
        user_id: req.user.id,
        status: 0 // 默认为待审核状态
      });

      if (!validationResult.success) {
        res.status(400).json({ message: '请求数据无效', errors: validationResult.error.format() });
        return;
      }

      const request = await storage.createResourceRequest(validationResult.data);
      res.status(201).json(request);
    } catch (error) {
      console.error('Error creating resource request:', error);
      res.status(500).json({ message: '提交资源请求失败' });
    }
  });

  app.get('/api/resource-requests', authenticateUser as any, authorizeAdmin as any, async (req, res) => {
    try {
      const requests = await storage.getAllResourceRequests();
      res.json(requests);
    } catch (error) {
      console.error('Error fetching resource requests:', error);
      res.status(500).json({ message: '获取资源请求列表失败' });
    }
  });

  app.patch('/api/resource-requests/:id', authenticateUser as any, authorizeAdmin as any, async (req, res) => {
    try {
      const requestId = parseInt(req.params.id);
      if (isNaN(requestId)) {
        res.status(400).json({ message: '无效的请求ID' });
        return;
      }

      const { status, admin_notes } = req.body;
      if (status === undefined) {
        res.status(400).json({ message: '状态不能为空' });
        return;
      }

      const updatedRequest = await storage.updateResourceRequestStatus(requestId, status, admin_notes);
      if (!updatedRequest) {
        res.status(404).json({ message: '资源请求不存在' });
        return;
      }

      res.json(updatedRequest);
    } catch (error) {
      console.error('Error updating resource request:', error);
      res.status(500).json({ message: '更新资源请求状态失败' });
    }
  });

  // User routes
  app.get('/api/users', authenticateUser as any, authorizeAdmin as any, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      // 移除敏感信息
      const sanitizedUsers = users.map(user => {
        const { password, ...userWithoutPassword } = user;
        return userWithoutPassword;
      });
      
      res.json(sanitizedUsers);
    } catch (error) {
      console.error('Error fetching users:', error);
      res.status(500).json({ message: '获取用户列表失败' });
    }
  });
  
  // Admin user routes
  app.get('/api/admin/users', authenticateUser as any, authorizeAdmin as any, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      // 移除敏感信息
      const sanitizedUsers = users.map(user => {
        const { password, ...userWithoutPassword } = user;
        return userWithoutPassword;
      });
      
      res.json(sanitizedUsers);
    } catch (error) {
      console.error('Error fetching admin users:', error);
      res.status(500).json({ message: '获取用户列表失败' });
    }
  });
  
  app.post('/api/admin/users', authenticateUser as any, authorizeAdmin as any, async (req: AuthenticatedRequest, res) => {
    try {
      const { email, password, membership_type, coins } = req.body;
      
      if (!email || !password) {
        res.status(400).json({ message: '邮箱和密码不能为空' });
        return;
      }
      
      // 检查邮箱是否已存在
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        res.status(400).json({ message: '该邮箱已被注册' });
        return;
      }
      
      // 对密码进行哈希处理
      const bcrypt = await import('bcrypt');
      const hashedPassword = await bcrypt.hash(password, 10);
      
      // 创建用户
      const userData = {
        email,
        password: hashedPassword,
        membership_type: membership_type || 'regular',
        coins: coins || 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      const newUser = await storage.createUser(userData);
      
      // 移除密码后返回用户信息
      const { password: _, ...userWithoutPassword } = newUser;
      res.status(201).json(userWithoutPassword);
    } catch (error) {
      console.error('Error creating user:', error);
      res.status(500).json({ message: '创建用户失败' });
    }
  });
  
  // 管理员修改用户信息
  app.patch('/api/admin/users/:id', authenticateUser as any, authorizeAdmin as any, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = parseInt(req.params.id);
      if (isNaN(userId)) {
        res.status(400).json({ message: '无效的用户ID' });
        return;
      }
      
      // 查询用户是否存在
      const user = await storage.getUser(userId);
      if (!user) {
        res.status(404).json({ message: '用户不存在' });
        return;
      }
      
      // 如果是管理员用户，不允许修改
      if (user.membership_type === 'admin') {
        res.status(403).json({ message: '管理员用户不可被修改' });
        return;
      }
      
      // 允许管理员更新的字段
      const allowedFields = ['membership_type', 'coins', 'email', 'avatar'];
      const updateData: any = {};
      
      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          updateData[field] = req.body[field];
        }
      }
      
      // 特殊处理会员过期时间字段
      if (req.body.membership_expire_time !== undefined) {
        // 如果是空字符串或null，设置为null表示永不过期
        if (req.body.membership_expire_time === '' || req.body.membership_expire_time === null) {
          updateData.membership_expire_time = null;
        } else {
          // 尝试创建一个有效的Date对象
          try {
            const expireDate = new Date(req.body.membership_expire_time);
            if (!isNaN(expireDate.getTime())) { // 检查日期是否有效
              updateData.membership_expire_time = expireDate;
            } else {
              throw new Error('无效的日期格式');
            }
          } catch (err) {
            console.error('Invalid date format:', req.body.membership_expire_time);
            return res.status(400).json({ message: '会员过期日期格式无效' });
          }
        }
      }
      
      // 如果有更新数据，则更新updated_at字段
      if (Object.keys(updateData).length > 0) {
        updateData.updated_at = new Date();
      }
      
      const updatedUser = await storage.updateUser(userId, updateData);
      if (!updatedUser) {
        res.status(404).json({ message: '用户不存在' });
        return;
      }
      
      // 返回成功消息
      res.status(200).json({ message: '用户更新成功' });
    } catch (error) {
      console.error('Error updating user by admin:', error);
      res.status(500).json({ message: '更新用户失败' });
    }
  });

  app.patch('/api/users/:id', authenticateUser as any, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = parseInt(req.params.id);
      if (isNaN(userId)) {
        res.status(400).json({ message: '无效的用户ID' });
        return;
      }

      // 只允许用户修改自己的资料，或者管理员可以修改任何用户
      if (req.user?.id !== userId && req.user?.membership_type !== 'admin') {
        res.status(403).json({ message: '权限不足' });
        return;
      }

      // 只允许更新特定字段
      const allowedFields = ['avatar', 'nickname', 'gender', 'biography', 'location'];
      const updateData: any = {};
      
      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          updateData[field] = req.body[field];
        }
      }

      const updatedUser = await storage.updateUser(userId, updateData);
      if (!updatedUser) {
        res.status(404).json({ message: '用户不存在' });
        return;
      }

      // 返回用户信息（不包含密码）
      const { password, ...userWithoutPassword } = updatedUser;
      res.json(userWithoutPassword);
    } catch (error) {
      console.error('Error updating user:', error);
      res.status(500).json({ message: '更新用户信息失败' });
    }
  });

  app.patch('/api/users/:id/password', authenticateUser as any, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = parseInt(req.params.id);
      if (isNaN(userId)) {
        res.status(400).json({ message: '无效的用户ID' });
        return;
      }

      // 只允许用户修改自己的密码，或者管理员可以修改任何用户的密码
      if (req.user?.id !== userId && req.user?.membership_type !== 'admin') {
        res.status(403).json({ message: '权限不足' });
        return;
      }

      const { oldPassword, newPassword } = req.body;
      if (!oldPassword || !newPassword) {
        res.status(400).json({ message: '旧密码和新密码不能为空' });
        return;
      }

      // 判断旧密码是否正确
      const user = await storage.getUser(userId);
      if (!user) {
        res.status(404).json({ message: '用户不存在' });
        return;
      }

      // 管理员可以直接修改密码而无需验证旧密码
      if (req.user?.membership_type !== 'admin') {
        const bcrypt = await import('bcrypt');
        const isPasswordValid = await bcrypt.compare(oldPassword, user.password);
        if (!isPasswordValid) {
          res.status(400).json({ message: '旧密码不正确' });
          return;
        }
      }

      // 对新密码进行哈希处理
      const bcrypt = await import('bcrypt');
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // 更新用户密码
      const updatedUser = await storage.updateUser(userId, { password: hashedPassword });
      if (!updatedUser) {
        res.status(404).json({ message: '用户不存在' });
        return;
      }

      res.json({ message: '密码修改成功' });
    } catch (error) {
      console.error('Error updating user password:', error);
      res.status(500).json({ message: '修改密码失败' });
    }
  });

  // Review routes
  app.post('/api/resources/:resourceId/reviews', authenticateUser as any, async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user) {
        res.status(401).json({ message: '未登录或会话已过期' });
        return;
      }

      const resourceId = parseInt(req.params.resourceId);
      if (isNaN(resourceId)) {
        res.status(400).json({ message: '无效的资源ID' });
        return;
      }

      // 检查资源是否存在
      const resource = await storage.getResource(resourceId);
      if (!resource) {
        res.status(404).json({ message: '资源不存在' });
        return;
      }

      // 构建评价数据
      const reviewData = {
        ...req.body,
        user_id: req.user.id,
        resource_id: resourceId,
        status: 0 // 默认为待审核状态
        // created_at 和 updated_at 会自动生成
      };

      // 验证评价数据
      const validationResult = insertReviewSchema.safeParse(reviewData);
      if (!validationResult.success) {
        res.status(400).json({ message: '评价数据无效', errors: validationResult.error.format() });
        return;
      }

      // 创建评价
      const review = await storage.createReview(validationResult.data);
      res.status(201).json(review);
    } catch (error) {
      console.error('Error creating review:', error);
      res.status(500).json({ message: '提交评价失败' });
    }
  });

  app.get('/api/resources/:resourceId/reviews', async (req, res) => {
    try {
      const resourceId = parseInt(req.params.resourceId);
      if (isNaN(resourceId)) {
        res.status(400).json({ message: '无效的资源ID' });
        return;
      }

      // 获取通过审核的评价
      const reviews = await storage.getReviewsByResource(resourceId);
      const approvedReviews = reviews.filter(review => review.status === 1);

      // 获取资源的平均评分和评价数量
      const averageRating = await storage.getResourceAverageRating(resourceId);
      const reviewCount = await storage.getResourceReviewCount(resourceId);

      // 查询评价作者信息
      const enrichedReviews = await Promise.all(approvedReviews.map(async (review) => {
        const user = await storage.getUser(review.user_id);
        if (user) {
          // 移除敏感用户信息
          const { password, ...safeUserData } = user;
          return { ...review, user: safeUserData };
        }
        return review;
      }));

      res.json({
        reviews: enrichedReviews,
        meta: {
          average_rating: averageRating,
          review_count: reviewCount
        }
      });
    } catch (error) {
      console.error('Error fetching resource reviews:', error);
      res.status(500).json({ message: '获取评价列表失败' });
    }
  });

  app.delete('/api/reviews/:id', authenticateUser as any, async (req: AuthenticatedRequest, res) => {
    try {
      const reviewId = parseInt(req.params.id);
      if (isNaN(reviewId)) {
        res.status(400).json({ message: '无效的评价ID' });
        return;
      }

      // 获取评价信息
      const review = await storage.getReview(reviewId);
      if (!review) {
        res.status(404).json({ message: '评价不存在' });
        return;
      }

      // 只允许评价作者或管理员删除评价
      if (req.user?.id !== review.user_id && req.user?.membership_type !== 'admin') {
        res.status(403).json({ message: '权限不足' });
        return;
      }

      // 删除评价
      const deleted = await storage.deleteReview(reviewId);
      if (!deleted) {
        res.status(404).json({ message: '评价不存在或已被删除' });
        return;
      }

      res.status(204).end();
    } catch (error) {
      console.error('Error deleting review:', error);
      res.status(500).json({ message: '删除评价失败' });
    }
  });

  // Admin review management routes
  app.get('/api/admin/reviews', authenticateUser as any, authorizeAdmin as any, async (req: AuthenticatedRequest, res) => {
    try {
      const allReviews = await storage.getAllReviews();
      
      // 查询评价作者和资源信息
      const enrichedReviews = await Promise.all(allReviews.map(async (review: Review) => {
        const user = await storage.getUser(review.user_id);
        const resource = await storage.getResource(review.resource_id);
        
        let enhancedReview: any = { ...review };
        
        if (user) {
          // 移除敏感用户信息
          const { password, ...safeUserData } = user;
          enhancedReview.user = safeUserData;
        }
        
        if (resource) {
          enhancedReview.resource = resource;
        }
        
        return enhancedReview;
      }));
      
      res.json(enrichedReviews);
    } catch (error) {
      console.error('Error fetching admin reviews:', error);
      res.status(500).json({ message: '获取评价列表失败' });
    }
  });

  app.patch('/api/admin/reviews/:id', authenticateUser as any, authorizeAdmin as any, async (req: AuthenticatedRequest, res) => {
    try {
      const reviewId = parseInt(req.params.id);
      if (isNaN(reviewId)) {
        res.status(400).json({ message: '无效的评价ID' });
        return;
      }

      const { status, admin_notes } = req.body;
      if (status === undefined) {
        res.status(400).json({ message: '状态不能为空' });
        return;
      }

      // 更新评价状态
      const updatedReview = await storage.updateReview(reviewId, { 
        status, 
        admin_notes
        // 不需要设置updated_at，storage.updateReview中会自动设置
      });
      
      if (!updatedReview) {
        res.status(404).json({ message: '评价不存在' });
        return;
      }

      res.json(updatedReview);
    } catch (error) {
      console.error('Error updating review status:', error);
      res.status(500).json({ message: '更新评价状态失败' });
    }
  });

  // Admin Login Log routes
  app.get('/api/admin/login-logs', authenticateUser as any, authorizeAdmin as any, async (req: AuthenticatedRequest, res) => {
    try {
      const adminEmail = req.query.email as string | undefined;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
      
      const logs = await storage.getAdminLoginLogs(adminEmail, limit);
      res.json(logs);
    } catch (error) {
      console.error('Error fetching admin login logs:', error);
      res.status(500).json({ message: '获取管理员登录日志失败' });
    }
  });

  const httpServer = createServer(app);
  // 菲菲网分类API
  app.get('/api/feifei-categories', async (req, res) => {
    try {
      const categories = await storage.getAllFeifeiCategories();
      res.json(categories);
    } catch (error) {
      console.error('Error fetching feifei categories:', error);
      res.status(500).json({ message: '获取菲菲网分类失败' });
    }
  });

  app.get('/api/feifei-categories/:id', async (req, res) => {
    try {
      const categoryId = parseInt(req.params.id);
      if (isNaN(categoryId)) {
        res.status(400).json({ message: '无效的分类ID' });
        return;
      }

      const category = await storage.getFeifeiCategory(categoryId);
      if (!category) {
        res.status(404).json({ message: '分类不存在' });
        return;
      }

      res.json(category);
    } catch (error) {
      console.error('Error fetching feifei category:', error);
      res.status(500).json({ message: '获取菲菲网分类详情失败' });
    }
  });

  app.post('/api/feifei-categories', authenticateUser as any, authorizeAdmin as any, async (req, res) => {
    try {
      const validationResult = insertFeifeiCategorySchema.safeParse(req.body);
      if (!validationResult.success) {
        res.status(400).json({ message: '分类数据无效', errors: validationResult.error.format() });
        return;
      }

      const category = await storage.createFeifeiCategory(validationResult.data);
      res.status(201).json(category);
    } catch (error) {
      console.error('Error creating feifei category:', error);
      res.status(500).json({ message: '创建菲菲网分类失败' });
    }
  });

  app.patch('/api/feifei-categories/:id', authenticateUser as any, authorizeAdmin as any, async (req, res) => {
    try {
      const categoryId = parseInt(req.params.id);
      if (isNaN(categoryId)) {
        res.status(400).json({ message: '无效的分类ID' });
        return;
      }

      const category = await storage.getFeifeiCategory(categoryId);
      if (!category) {
        res.status(404).json({ message: '分类不存在' });
        return;
      }

      const validationResult = insertFeifeiCategorySchema.partial().safeParse(req.body);
      if (!validationResult.success) {
        res.status(400).json({ message: '分类数据无效', errors: validationResult.error.format() });
        return;
      }

      const updatedCategory = await storage.updateFeifeiCategory(categoryId, validationResult.data);
      res.json(updatedCategory);
    } catch (error) {
      console.error('Error updating feifei category:', error);
      res.status(500).json({ message: '更新菲菲网分类失败' });
    }
  });

  app.delete('/api/feifei-categories/:id', authenticateUser as any, authorizeAdmin as any, async (req, res) => {
    try {
      const categoryId = parseInt(req.params.id);
      if (isNaN(categoryId)) {
        res.status(400).json({ message: '无效的分类ID' });
        return;
      }

      const deleted = await storage.deleteFeifeiCategory(categoryId);
      if (!deleted) {
        res.status(404).json({ message: '分类不存在' });
        return;
      }

      res.status(204).end();
    } catch (error) {
      console.error('Error deleting feifei category:', error);
      res.status(500).json({ message: '删除菲菲网分类失败' });
    }
  });
  
  // URL解析API：解析菲菲网分类URL中的资源链接
  app.post('/api/feifei-categories/:id/parse', async (req, res) => {
    try {
      const categoryId = parseInt(req.params.id);
      if (isNaN(categoryId)) {
        res.status(400).json({ message: '无效的分类ID' });
        return;
      }

      // 获取分类信息
      const category = await storage.getFeifeiCategory(categoryId);
      if (!category) {
        res.status(404).json({ message: '分类不存在' });
        return;
      }

      // 导入cheerio库进行HTML解析
      const axios = (await import('axios')).default;
      const { load } = await import('cheerio');
      
      // 获取网页内容
      const response = await axios.get(category.url);
      const html = response.data;
      const $ = load(html);
      
      // 找到所有container内的链接
      const links: { url: string, tags: string[], chineseTitle: string, englishTitle: string | null }[] = [];
      $('section.container a').each((idx: number, element: any) => {
        const url = $(element).attr('href');
        if (!url || !url.startsWith('http')) return;
        
        // 首先尝试获取title属性，如果没有则使用<a>标签中的文本内容
        let title = $(element).attr('title');
        if (!title || title.trim() === '') {
          title = $(element).text().trim();
        }
        
        // 提取标题中的标签，例如[udemy]
        const tags: string[] = [];
        const tagRegex = /\[(.*?)\]/g;
        let match;
        let cleanTitle = title || '';
        
        while ((match = tagRegex.exec(cleanTitle)) !== null) {
          const tag = match[1].toLowerCase().trim();
          if (tag && !tags.includes(tag)) {
            tags.push(tag);
          }
        }
        
        // 移除标题中的标签，获得干净的标题
        cleanTitle = cleanTitle.replace(/\[.*?\]/g, '').trim();
        
        // 处理标题中的中英文分隔（使用|符号分隔）
        let chineseTitle: string = cleanTitle || url;
        let englishTitle: string | null = null;
        
        if (cleanTitle.includes('|')) {
          const titleParts = cleanTitle.split('|');
          chineseTitle = titleParts[0].trim();
          englishTitle = titleParts[1].trim();
          
          // 如果中文部分为空，则使用URL
          if (chineseTitle === '') chineseTitle = url;
          
          // 如果分割后发现英文部分为空，则设为null
          if (englishTitle === '') englishTitle = null;
        }
        
        links.push({ 
          chineseTitle,
          englishTitle,
          url,
          tags 
        });
      });
      
      // 保存找到的链接到数据库
      const savedResources = [];
      for (const link of links) {
        // 检查资源是否已存在
        const existingResources = await storage.getFeifeiResourcesByUrl(link.url);
        
        let resource: FeifeiResource;
        
        if (existingResources.length === 0) {
          // 不存在则创建新资源
          resource = await storage.createFeifeiResource({
            chinese_title: link.chineseTitle,
            english_title: link.englishTitle,
            url: link.url,
            category_id: categoryId,
            description: null,
            icon: null
          });
        } else {
          // 存在则更新标题并加入结果列表
          const updatedResource = await storage.updateFeifeiResource(existingResources[0].id, {
            chinese_title: link.chineseTitle,
            english_title: link.englishTitle
          });
          resource = updatedResource || existingResources[0];
        }
        
        savedResources.push(resource);
        
        // 处理标签
        if (link.tags.length > 0) {
          // 删除已有的资源-标签关联
          const existingTags = await storage.getFeifeiResourceTags(resource.id);
          for (const tag of existingTags) {
            await storage.deleteFeifeiResourceTag(resource.id, tag.id);
          }
          
          // 添加新标签
          for (const tagName of link.tags) {
            // 查找或创建标签
            let tag = await storage.getFeifeiTagByName(tagName);
            if (!tag) {
              tag = await storage.createFeifeiTag({ name: tagName });
            }
            
            // 创建资源-标签关联
            await storage.createFeifeiResourceTag({
              resource_id: resource.id,
              tag_id: tag.id
            });
          }
        }
      }
      
      res.json({
        message: `成功解析并保存了 ${savedResources.length} 个链接`,
        resources: savedResources
      });
    } catch (error) {
      console.error('Error parsing feifei category URL:', error);
      res.status(500).json({ message: '解析URL失败: ' + (error instanceof Error ? error.message : String(error)) });
    }
  });
  
  // 获取菲菲资源
  app.get('/api/feifei-resources/:categoryId', async (req, res) => {
    try {
      const categoryId = parseInt(req.params.categoryId);
      if (isNaN(categoryId)) {
        res.status(400).json({ message: '无效的分类ID' });
        return;
      }
      
      const resources = await storage.getFeifeiResourcesByCategory(categoryId);
      
      // 为每个资源添加标签信息
      const enrichedResources = await Promise.all(resources.map(async (resource) => {
        const tags = await storage.getFeifeiResourceTags(resource.id);
        return {
          ...resource,
          tags
        };
      }));
      
      res.json(enrichedResources);
    } catch (error) {
      console.error('Error getting feifei resources:', error);
      res.status(500).json({ message: '获取资源失败: ' + (error instanceof Error ? error.message : String(error)) });
    }
  });
  
  // 获取所有菲菲资源
  app.get('/api/feifei-resources', async (req, res) => {
    try {
      const resources = await storage.getAllFeifeiResources();
      
      // 为每个资源添加标签信息
      const enrichedResources = await Promise.all(resources.map(async (resource) => {
        const tags = await storage.getFeifeiResourceTags(resource.id);
        return {
          ...resource,
          tags
        };
      }));
      
      res.json(enrichedResources);
    } catch (error) {
      console.error('Error getting all feifei resources:', error);
      res.status(500).json({ message: '获取所有资源失败: ' + (error instanceof Error ? error.message : String(error)) });
    }
  });

  // 解析单个菲菲资源页面内容的API
  app.post('/api/feifei-resources/:id/parse', authenticateUser as any, authorizeAdmin as any, async (req: AuthenticatedRequest, res) => {
    try {
      const resourceId = parseInt(req.params.id);
      if (isNaN(resourceId)) {
        return res.status(400).json({ message: '无效的资源ID' });
      }

      // 获取资源信息
      const resource = await storage.getFeifeiResource(resourceId);
      if (!resource) {
        return res.status(404).json({ message: '资源不存在' });
      }

      const { url } = resource;
      if (!url) {
        return res.status(400).json({ message: '资源URL不存在' });
      }
      
      // 动态导入所需模块
      const { default: axios } = await import('axios');
      
      try {
        // 发送请求获取页面内容
        const response = await axios.get(url);
        const html = response.data;
        
        // 动态导入cheerio，使用合适的方式
        const cheerio = await import('cheerio');
        
        // 使用cheerio的load方法
        const $ = cheerio.load(html);
        
        // 解析页面内容
        const detailsBox = $('.details-box');
        
        // 提取资源信息
        const infoItems: Record<string, string> = {};
        
        // 尝试使用原始选择器
        detailsBox.find('.infos-box .item').each((i: number, elem: any) => {
          const label = $(elem).find('.label').text().trim();
          const value = $(elem).find('.value').text().trim();
          if (label) infoItems[label] = value;
        });
        
        // 尝试处理info-box中的li元素
        $('.info-box li').each((i: number, elem: any) => {
          const text = $(elem).text().trim();
          // 解析"文件内容: 视频+中英字幕+配套课件"这样的格式
          const parts = text.split(':');
          if (parts.length >= 2) {
            const label = parts[0].trim();
            const value = parts.slice(1).join(':').trim(); // 处理值中可能含有冒号的情况
            infoItems[label] = value;
          }
        });
        
        // 处理其他格式的行，如"资源分类： -"
        $('.info-box').contents().each((i: number, elem: any) => {
          if (elem.type === 'text') {
            const text = $(elem).text().trim();
            if (text.includes('：')) {
              const parts = text.split('：');
              if (parts.length >= 2) {
                const label = parts[0].trim();
                const value = parts.slice(1).join('：').trim();
                infoItems[label] = value;
              }
            }
          }
        });
        
        console.log('所有选择器处理后的信息:', infoItems);
        
        // 提取详情介绍
        let details = $('.introduction-box .content').html() || '';
        
        // 记录提取的信息
        console.log('提取的页面信息:', infoItems);
        console.log('获取的详情内容长度:', details ? details.length : 0);
        
        // 更新资源信息
        const updateData = {
          resource_category: infoItems['资源分类'] || null,
          popularity: infoItems['热度'] || infoItems['浏览'] || null,
          publish_date: infoItems['发布时间'] || null,
          last_update: infoItems['最近更新'] || null,
          content_info: infoItems['文件内容'] || null,
          video_size: infoItems['视频尺寸'] || null,
          file_size: infoItems['视频大小'] || infoItems['文件大小'] || null,
          duration: infoItems['课时'] || infoItems['视频时长'] || null,
          language: infoItems['语言'] || infoItems['视频语言'] || null,
          subtitle: infoItems['字幕'] || infoItems['视频字幕'] || null,
          details: details,
        };
        
        // 提取页面中的标签
        const tagNames: string[] = [];
        $('.tag-box .tag').each((i: number, elem: any) => {
          const tagName = $(elem).text().trim();
          if (tagName) {
            tagNames.push(tagName);
          }
        });
        
        // 更新资源信息
        const updatedResource = await storage.updateFeifeiResource(resourceId, updateData);
        
        // 处理标签
        for (const tagName of tagNames) {
          // 查找或创建标签
          let tag = await storage.getFeifeiTagByName(tagName);
          if (!tag) {
            tag = await storage.createFeifeiTag({ name: tagName });
          }
          
          // 检查关联是否存在
          const existingTagRelation = await storage.getFeifeiResourceTagRelation(resourceId, tag.id);
          if (!existingTagRelation) {
            // 创建资源与标签的关联
            await storage.createFeifeiResourceTag({
              resource_id: resourceId,
              tag_id: tag.id
            });
          }
        }
        
        // 获取更新后的完整资源数据（包括标签）
        const updatedTags = await storage.getFeifeiResourceTags(resourceId);
        
        res.json({
          message: '资源页面解析成功',
          resource: {
            ...updatedResource,
            tags: updatedTags
          }
        });
      } catch (error) {
        console.error('Error parsing resource page:', error);
        res.status(500).json({ message: '解析页面失败: ' + (error instanceof Error ? error.message : String(error)) });
      }
    } catch (error) {
      console.error('Error processing parse request:', error);
      res.status(500).json({ message: '处理解析请求失败: ' + (error instanceof Error ? error.message : String(error)) });
    }
  });

  return httpServer;
}