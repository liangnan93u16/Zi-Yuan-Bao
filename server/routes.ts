import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage, ResourceFilters } from "./storage";
import session from "express-session";
import { z } from "zod";
import axios from 'axios';
import * as cheerio from 'cheerio';
import OpenAI from 'openai';
import { db } from './db';
import { eq } from 'drizzle-orm';
import { 
  insertCategorySchema, 
  insertResourceSchema, 
  insertResourceRequestSchema,
  insertReviewSchema,
  insertAuthorSchema,
  insertFeifeiCategorySchema,
  insertFeifeiResourceSchema,
  loginSchema, 
  registerSchema,
  type Review,
  type FeifeiResource,
  type FeifeiCategory,
  resources
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
      const page = req.query.page ? parseInt(req.query.page as string) : 1;
      const pageSize = req.query.pageSize ? parseInt(req.query.pageSize as string) : 10;
      
      // 处理关键字搜索
      const keyword = req.query.keyword ? (req.query.keyword as string) : null;
      
      // 处理作废状态过滤：null表示全部，true表示作废，false表示未作废
      let invalidStatus: boolean | null = null;
      if (req.query.invalidStatus !== undefined) {
        if (req.query.invalidStatus === 'true') {
          invalidStatus = true;
        } else if (req.query.invalidStatus === 'false') {
          invalidStatus = false;
        }
      }
      
      const result = await storage.getAllFeifeiCategories({
        invalidStatus,
        keyword,
        page,
        pageSize
      });
      
      res.json(result);
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

      // 记录收到的请求体内容
      console.log('更新菲菲网分类请求数据:', req.body);

      const validationResult = insertFeifeiCategorySchema.partial().safeParse(req.body);
      if (!validationResult.success) {
        console.error('数据验证失败:', validationResult.error.format());
        res.status(400).json({ message: '分类数据无效', errors: validationResult.error.format() });
        return;
      }

      console.log('验证通过的数据:', validationResult.data);

      const updatedCategory = await storage.updateFeifeiCategory(categoryId, validationResult.data);
      console.log('更新后的分类:', updatedCategory);
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
  
  // 设置分类作废状态
  app.patch('/api/feifei-categories/:id/invalidate', authenticateUser as any, authorizeAdmin as any, async (req, res) => {
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
      
      const { isInvalid = true } = req.body;
      
      const updatedCategory = await storage.setFeifeiCategoryInvalidStatus(categoryId, isInvalid);
      
      res.json({
        message: isInvalid ? "分类已成功作废" : "分类已成功取消作废",
        category: updatedCategory
      });
    } catch (error) {
      console.error('Error updating feifei category invalid status:', error);
      res.status(500).json({ message: '设置菲菲网分类作废状态失败' });
    }
  });
  
  // 解析网站分类API：解析菲菲网站导航菜单中的分类
  app.post('/api/parse-feifei-website', authenticateUser as any, authorizeAdmin as any, async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user) {
        res.status(401).json({ message: '未登录或会话已过期' });
        return;
      }
      
      const { url = 'https://www.feifeiziyuan.com' } = req.body;
      
      // 导入cheerio库进行HTML解析
      const axios = (await import('axios')).default;
      const { load } = await import('cheerio');
      
      // 获取网页内容
      console.log(`开始解析网站：${url}`);
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });
      const html = response.data;
      const $ = load(html);
      
      // 找到所有导航菜单中的分类链接
      const links: { title: string, url: string, parent: string | null }[] = [];
      
      // 直接查找导航菜单中的分类
      console.log('开始查找菜单中的分类，优先使用<ul class="sub-menu">...');
      
      // 查找所有菜单项
      $('li.menu-item-has-children').each((idx, element) => {
        // 获取主分类
        const parentCategory = $(element).find('> a').first();
        const parentText = parentCategory.text().trim();
        const parentUrl = parentCategory.attr('href');
        
        console.log(`找到主分类: ${parentText}, URL: ${parentUrl}`);
        
        if (parentText) {
          // 如果有父类URL，添加到links
          if (parentUrl) {
            links.push({
              title: parentText,
              url: parentUrl,
              parent: null
            });
          }
          
          // 获取子分类 - 使用 ul.sub-menu 选择器
          $(element).find('ul.sub-menu > li > a').each((subIdx, subElement) => {
            const subLink = $(subElement);
            const subText = subLink.text().trim();
            const subUrl = subLink.attr('href');
            
            if (subText && subUrl) {
              // 完整URL处理
              const fullUrl = subUrl.startsWith('http') ? subUrl : `${url}${subUrl}`;
              console.log(`  子分类: ${subText}, URL: ${fullUrl}`);
              
              // 添加子分类，标题格式：主分类-子分类
              links.push({
                title: `${parentText}-${subText}`,
                url: fullUrl,
                parent: parentText
              });
            }
          });
        }
      });
      
      // 如果找不到子菜单项，尝试使用备选方法
      if (links.length === 0) {
        console.log('未找到子菜单项，尝试使用备选方法...');
        // 尝试寻找所有分类链接
        $('a').each((idx, element) => {
          const link = $(element);
          const url = link.attr('href');
          const text = link.text().trim();
          
          // 基本有效性检查
          if (!url || !text || text.length < 2 || !url.includes('feifeiziyuan.com')) {
            return;
          }
          
          // 跳过首页、登录等常见导航链接
          const skipWords = ['登录', '注册', '首页', '会员', '关于', 'VIP'];
          if (skipWords.some(word => text.includes(word))) {
            return;
          }
          
          console.log(`找到备选分类: ${text}, URL: ${url}`);
          
          // 添加到links
          links.push({
            title: text,
            url: url,
            parent: null
          });
        });
      }
      
      console.log(`共解析出 ${links.length} 个分类链接`);
      
      // 保存或更新分类到数据库
      const savedCategories: FeifeiCategory[] = [];
      
      for (const link of links) {
        // 检查URL是否已存在
        const existingCategories = await storage.getFeifeiCategoryByUrl(link.url);
        
        let category: FeifeiCategory;
        
        if (!existingCategories || existingCategories.length === 0) {
          // 不存在则创建新分类
          category = await storage.createFeifeiCategory({
            title: link.title,
            url: link.url,
            sort_order: 0
          });
          console.log(`创建新分类: ${category.title}`);
        } else {
          // 存在则只更新标题，保持作废状态不变
          const updatedCategory = await storage.updateFeifeiCategory(existingCategories[0].id, {
            title: link.title,
            // 这里不更新 is_invalid 字段，保持原有的作废状态
          });
          category = updatedCategory || existingCategories[0];
          console.log(`更新已有分类: ${category.title}`);
        }
        
        savedCategories.push(category);
      }
      
      res.json({
        message: `成功解析并保存 ${savedCategories.length} 个分类`,
        categories: savedCategories
      });
      
    } catch (error) {
      console.error('Error parsing feifei website categories:', error);
      res.status(500).json({ message: '解析菲菲网站分类失败', error: (error as Error).message });
    }
  });
  
  // 定义解析菲菲分类URL的函数，供单独解析和批量解析共用
  async function parseFeifeiCategoryUrl(categoryId: number, isLogVerbose: boolean = false): Promise<{ savedResources: FeifeiResource[], message: string }> {
    // 获取分类信息
    const category = await storage.getFeifeiCategory(categoryId);
    if (!category) {
      throw new Error('分类不存在');
    }

    // 导入cheerio库进行HTML解析
    const axios = (await import('axios')).default;
    const { load } = await import('cheerio');
    
    // 保存找到的所有链接
    const links: { url: string, tags: string[], chineseTitle: string, englishTitle: string | null }[] = [];
    let currentPage = 1; 
    let hasNextPage = true;
    
    // 函数：从HTML内容中提取链接
    const extractLinks = (html: string): { url: string, tags: string[], chineseTitle: string, englishTitle: string | null }[] => {
      const $ = load(html);
      const extractedLinks: { url: string, tags: string[], chineseTitle: string, englishTitle: string | null }[] = [];
      
      $('section.container a').each((idx: number, element: any) => {
        const url = $(element).attr('href');
        if (!url || !url.startsWith('http')) return;
        
        // 如果URL以"https://www.feifeiziyuan.com/category"开头，则跳过
        if (url.startsWith('https://www.feifeiziyuan.com/category')) return;
        
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
        
        extractedLinks.push({ 
          chineseTitle,
          englishTitle,
          url,
          tags 
        });
      });
      
      return extractedLinks;
    };
    
    // 循环获取所有页面的内容
    while (hasNextPage) {
      // 构建当前页面的URL
      let pageUrl = category.url;
      if (currentPage > 1) {
        pageUrl = `${category.url}${pageUrl.endsWith('/') ? '' : '/'}page/${currentPage}/`;
      }
      
      if (isLogVerbose) {
        console.log(`  正在解析第 ${currentPage} 页: ${pageUrl}`);
      }
      
      try {
        // 获取网页内容
        const response = await axios.get(pageUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          },
          validateStatus: (status) => {
            return status < 500; // 允许处理404等客户端错误
          }
        });
        
        // 检查是否返回404，如果是则表示没有下一页
        if (response.status === 404) {
          if (isLogVerbose && currentPage > 1) {
            console.log(`  第 ${currentPage} 页不存在，爬取结束`);
          }
          hasNextPage = false;
          continue;
        }
        
        // 解析HTML并提取链接
        const pageLinks = extractLinks(response.data);
        
        if (isLogVerbose) {
          console.log(`  在第 ${currentPage} 页找到 ${pageLinks.length} 个资源链接`);
        }
        
        // 如果当前页没有找到链接，且不是第一页，则可能已经到达末页
        if (pageLinks.length === 0 && currentPage > 1) {
          if (isLogVerbose) {
            console.log(`  第 ${currentPage} 页没有找到资源，爬取结束`);
          }
          hasNextPage = false;
          continue;
        }
        
        // 将当前页的链接添加到总链接列表
        links.push(...pageLinks);
        
        // 移动到下一页
        currentPage++;
        
        // 每获取一页暂停1秒，避免请求过于频繁
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        // 处理请求异常，可能是404或其他错误
        if (isLogVerbose) {
          console.error(`  获取第 ${currentPage} 页时出错:`, error instanceof Error ? error.message : String(error));
        }
        hasNextPage = false;
      }
    }
    
    if (isLogVerbose) {
      console.log(`  共爬取了 ${currentPage - 1} 页，找到 ${links.length} 个资源链接`);
    }
    
    // 保存找到的链接到数据库
    const savedResources = [];
    let newResourceCount = 0;
    
    for (const link of links) {
      // 检查资源是否已存在
      const existingResources = await storage.getFeifeiResourcesByUrl(link.url);
      
      let resource: FeifeiResource;
      let isNew = false;
      
      if (existingResources.length === 0) {
        // 不存在则创建新资源
        resource = await storage.createFeifeiResource({
          chinese_title: link.chineseTitle,
          english_title: link.englishTitle,
          url: link.url,
          category_id: categoryId,
          preview_url: '',
          coin_price: 0,
          details_html: null,
          course_html: null
        });
        isNew = true;
        newResourceCount++;
      } else {
        // 存在则更新标题并加入结果列表
        const updatedResource = await storage.updateFeifeiResource(existingResources[0].id, {
          chinese_title: link.chineseTitle,
          english_title: link.englishTitle
        });
        resource = updatedResource || existingResources[0];
      }
      
      savedResources.push(resource);
      
      if (isLogVerbose) {
        console.log(`  ${isNew ? '创建' : '更新'}资源: ${link.chineseTitle}`);
      }
      
      // 处理标签
      if (link.tags.length > 0) {
        for (const tagName of link.tags) {
          // 查找或创建标签
          let tag = await storage.getFeifeiTagByName(tagName);
          if (!tag) {
            tag = await storage.createFeifeiTag({ name: tagName });
            if (isLogVerbose) {
              console.log(`    创建新标签: ${tagName}`);
            }
          }
          
          // 检查资源-标签关系是否存在
          const tagRelation = await storage.getFeifeiResourceTagRelation(resource.id, tag.id);
          if (!tagRelation) {
            // 创建资源-标签关联
            await storage.createFeifeiResourceTag({
              resource_id: resource.id,
              tag_id: tag.id
            });
          }
        }
      }
    }
    
    if (isLogVerbose) {
      console.log(`  成功解析并保存了 ${newResourceCount} 个新资源，总共 ${savedResources.length} 个资源`);
    }
    
    return {
      savedResources,
      message: `成功解析并保存了 ${newResourceCount} 个新资源，总共 ${savedResources.length} 个资源 (共爬取了 ${currentPage - 1} 页)`
    };
  }

  // URL解析API：解析菲菲网分类URL中的资源链接
  app.post('/api/feifei-categories/:id/parse', async (req, res) => {
    try {
      const categoryId = parseInt(req.params.id);
      if (isNaN(categoryId)) {
        res.status(400).json({ message: '无效的分类ID' });
        return;
      }

      // 调用共用函数解析分类URL
      const result = await parseFeifeiCategoryUrl(categoryId);
      
      res.json({
        message: result.message,
        resources: result.savedResources
      });
    } catch (error) {
      console.error('Error parsing feifei category URL:', error);
      res.status(500).json({ message: '解析URL失败: ' + (error instanceof Error ? error.message : String(error)) });
    }
  });
  
  // 导入菲菲分类到资源管理分类
  app.post('/api/import-feifei-categories', authenticateUser as any, authorizeAdmin as any, async (req, res) => {
    try {
      const feifeiCategories = await storage.getAllFeifeiCategories({ invalidStatus: false });
      const importedCount = { created: 0, updated: 0 };
      
      // 遍历菲菲网分类
      for (const feifeiCategory of feifeiCategories.categories) {
        // 检查资源管理分类中是否已存在相同名称的分类
        const existingCategory = await storage.getCategoryByName(feifeiCategory.title);
        
        // 构建分类数据
        const categoryData = {
          name: feifeiCategory.title,
          sort_order: feifeiCategory.sort_order
          // 这里可以添加其他需要转换的字段
        };
        
        if (existingCategory) {
          // 如果已存在，则更新
          await storage.updateCategory(existingCategory.id, categoryData);
          importedCount.updated++;
        } else {
          // 如果不存在，则创建新分类
          await storage.createCategory(categoryData);
          importedCount.created++;
        }
      }
      
      res.json({ 
        success: true, 
        message: `成功导入 ${importedCount.created} 个新分类，更新 ${importedCount.updated} 个已有分类。`,
        data: importedCount
      });
    } catch (error: any) {
      console.error("导入菲菲分类错误:", error);
      res.status(500).json({ message: error.message || "导入菲菲分类失败" });
    }
  });
  
  // 获取菲菲资源
  app.get('/api/feifei-resources/:categoryId', async (req, res) => {
    try {
      console.time('total-feifei-resources-request');
      const categoryId = parseInt(req.params.categoryId);
      if (isNaN(categoryId)) {
        res.status(400).json({ message: '无效的分类ID' });
        return;
      }
      
      // 获取分页参数
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 10;
      
      console.log(`获取分类ID: ${categoryId} 的资源，页码: ${page}，每页数量: ${pageSize}`);
      
      // 获取分页的资源数据
      console.time('db-query-resources');
      const result = await storage.getFeifeiResourcesByCategory(categoryId, page, pageSize);
      console.timeEnd('db-query-resources');
      
      // 确保 resources 存在并且是数组
      const resources = result?.resources || [];
      const total = result?.total || 0;
      
      console.log(`获取到 ${resources.length} 条资源，总数: ${total}`);
      
      // 为每个资源添加标签信息
      console.time('enrich-resources-with-tags');
      const enrichedResources = await Promise.all(resources.map(async (resource) => {
        console.time(`get-tags-for-resource-${resource.id}`);
        const tags = await storage.getFeifeiResourceTags(resource.id);
        console.timeEnd(`get-tags-for-resource-${resource.id}`);
        return {
          ...resource,
          tags
        };
      }));
      console.timeEnd('enrich-resources-with-tags');
      
      // 返回资源和分页信息
      res.json({
        resources: enrichedResources,
        pagination: {
          total,
          page,
          pageSize,
          totalPages: Math.ceil(total / pageSize)
        }
      });
      console.timeEnd('total-feifei-resources-request');
    } catch (error) {
      console.error('Error getting feifei resources:', error);
      res.status(500).json({ message: '获取资源失败: ' + (error instanceof Error ? error.message : String(error)) });
    }
  });
  
  // 更新菲菲资源
  app.patch('/api/feifei-resources/:id', authenticateUser as any, authorizeAdmin as any, async (req, res) => {
    try {
      const resourceId = parseInt(req.params.id);
      if (isNaN(resourceId)) {
        res.status(400).json({ message: '无效的资源ID' });
        return;
      }

      const resource = await storage.getFeifeiResource(resourceId);
      if (!resource) {
        res.status(404).json({ message: '资源不存在' });
        return;
      }

      // 记录收到的请求体内容
      console.log('更新菲菲资源请求数据:', {
        resourceId,
        hasHtmlContent: !!req.body.course_html,
        courseHtmlLength: req.body.course_html ? req.body.course_html.length : 0,
        hasParsedContent: !!req.body.parsed_content,
        parsedContentLength: req.body.parsed_content ? req.body.parsed_content.length : 0,
        bodyKeys: Object.keys(req.body)
      });

      const validationResult = insertFeifeiResourceSchema.partial().safeParse(req.body);
      if (!validationResult.success) {
        console.error('数据验证失败:', validationResult.error.format());
        res.status(400).json({ message: '资源数据无效', errors: validationResult.error.format() });
        return;
      }

      console.log('验证通过的数据:', {
        dataKeys: Object.keys(validationResult.data),
        hasHtmlContent: !!validationResult.data.course_html,
        hasParsedContent: !!validationResult.data.parsed_content
      });

      const updatedResource = await storage.updateFeifeiResource(resourceId, validationResult.data);
      console.log('更新后的资源:', updatedResource);
      res.json(updatedResource);
    } catch (error) {
      console.error('Error updating feifei resource:', error);
      res.status(500).json({ message: '更新菲菲资源失败' });
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

  // 解析单个菲菲资源页面内容已合并到下方的智谱AI解析API

  // Parameter management routes (admin only)
  app.get('/api/parameters', authenticateUser as any, authorizeAdmin as any, async (req: AuthenticatedRequest, res) => {
    try {
      const parameters = await storage.getAllParameters();
      res.json(parameters);
    } catch (error) {
      console.error('Error getting parameters:', error);
      res.status(500).json({ message: '获取参数列表失败: ' + (error instanceof Error ? error.message : String(error)) });
    }
  });

  app.get('/api/parameters/:id', authenticateUser as any, authorizeAdmin as any, async (req: AuthenticatedRequest, res) => {
    try {
      const parameterId = parseInt(req.params.id);
      if (isNaN(parameterId)) {
        return res.status(400).json({ message: '无效的参数ID' });
      }

      const parameter = await storage.getParameter(parameterId);
      if (!parameter) {
        return res.status(404).json({ message: '参数不存在' });
      }

      res.json(parameter);
    } catch (error) {
      console.error('Error getting parameter:', error);
      res.status(500).json({ message: '获取参数失败: ' + (error instanceof Error ? error.message : String(error)) });
    }
  });

  app.post('/api/parameters', authenticateUser as any, authorizeAdmin as any, async (req: AuthenticatedRequest, res) => {
    try {
      const { key, value, description } = req.body;

      // Validate required fields
      if (!key || !value) {
        return res.status(400).json({ message: '键和值是必须的' });
      }

      // Check if parameter with this key already exists
      const existingParameter = await storage.getParameterByKey(key);
      if (existingParameter) {
        return res.status(400).json({ message: '使用此键的参数已存在' });
      }

      const newParameter = await storage.createParameter({
        key,
        value,
        description: description || '',
      });

      res.status(201).json(newParameter);
    } catch (error) {
      console.error('Error creating parameter:', error);
      res.status(500).json({ message: '创建参数失败: ' + (error instanceof Error ? error.message : String(error)) });
    }
  });

  app.put('/api/parameters/:id', authenticateUser as any, authorizeAdmin as any, async (req: AuthenticatedRequest, res) => {
    try {
      const parameterId = parseInt(req.params.id);
      if (isNaN(parameterId)) {
        return res.status(400).json({ message: '无效的参数ID' });
      }

      const { key, value, description } = req.body;

      // Validate required fields
      if (!key || !value) {
        return res.status(400).json({ message: '键和值是必须的' });
      }

      // Check if parameter exists
      const parameter = await storage.getParameter(parameterId);
      if (!parameter) {
        return res.status(404).json({ message: '参数不存在' });
      }

      // If key is being changed, check if new key already exists
      if (key !== parameter.key) {
        const existingParameter = await storage.getParameterByKey(key);
        if (existingParameter && existingParameter.id !== parameterId) {
          return res.status(400).json({ message: '使用此键的参数已存在' });
        }
      }

      const updatedParameter = await storage.updateParameter(parameterId, {
        key,
        value,
        description: description || '',
      });

      res.json(updatedParameter);
    } catch (error) {
      console.error('Error updating parameter:', error);
      res.status(500).json({ message: '更新参数失败: ' + (error instanceof Error ? error.message : String(error)) });
    }
  });

  app.delete('/api/parameters/:id', authenticateUser as any, authorizeAdmin as any, async (req: AuthenticatedRequest, res) => {
    try {
      const parameterId = parseInt(req.params.id);
      if (isNaN(parameterId)) {
        return res.status(400).json({ message: '无效的参数ID' });
      }

      // Check if parameter exists
      const parameter = await storage.getParameter(parameterId);
      if (!parameter) {
        return res.status(404).json({ message: '参数不存在' });
      }

      const success = await storage.deleteParameter(parameterId);
      if (!success) {
        return res.status(500).json({ message: '删除参数失败' });
      }

      res.json({ message: '参数已成功删除' });
    } catch (error) {
      console.error('Error deleting parameter:', error);
      res.status(500).json({ message: '删除参数失败: ' + (error instanceof Error ? error.message : String(error)) });
    }
  });

  // 用智谱AI提取课程大纲
  // 课程内容Tab中的"AI获取大纲"按钮 - 从已保存的HTML内容中提取课程结构
  app.post('/api/feifei-resources/:id/extract-outline', authenticateUser as any, authorizeAdmin as any, async (req: AuthenticatedRequest, res) => {
    try {
      const resourceId = parseInt(req.params.id);
      if (isNaN(resourceId)) {
        return res.status(400).json({ message: '无效的资源ID' });
      }

      // 获取资源
      const resource = await storage.getFeifeiResource(resourceId);
      if (!resource) {
        return res.status(404).json({ message: '资源不存在' });
      }

      // 检查资源是否有HTML内容
      if (!resource.course_html) {
        return res.status(400).json({ message: '资源没有HTML内容可供解析' });
      }

      // 从参数表获取智谱AI配置
      const apiKeyParam = await storage.getParameterByKey('ZHIPU_API');
      const modelParam = await storage.getParameterByKey('ZHIPU_MODEL');
      const baseUrlParam = await storage.getParameterByKey('ZHIPU_BASE_URL');

      if (!apiKeyParam || !apiKeyParam.value) {
        return res.status(400).json({ message: '缺少智谱AI API密钥配置，请在系统参数中设置ZHIPU_API参数' });
      }

      const apiKey = apiKeyParam.value;
      const model = modelParam?.value || 'glm-4-flash'; // 默认使用glm-4-flash
      const baseUrl = baseUrlParam?.value || 'https://open.bigmodel.cn/api/paas/v4';

      // 配置OpenAI客户端（兼容智谱AI）
      console.log('智谱AI配置:', { 
        apiKey: '(已隐藏)', 
        baseURL: baseUrl, 
        model: model 
      });
      
      // 智谱AI的API结构：baseURL + /chat/completions
      console.log('智谱AI的API配置参数:', {
        apiKeyLength: apiKey.length,
        baseURL: baseUrl,
        model: model
      });
      
      // 使用完整的智谱AI API URL
      const openai = new OpenAI({
        apiKey: apiKey,
        baseURL: baseUrl
      });

      // 准备请求
      const prompt = `
      我需要你从以下HTML代码中提取课程大纲信息。
      HTML代码描述了一个在线课程的章节和讲座结构。
      请提取所有章节和每个章节下的讲座信息，包括标题和时长。

      请以以下JSON格式返回：
      {
        "chapters": [
          {
            "title": "章节标题",
            "duration": "章节总时长",
            "lectures": [
              {
                "title": "讲座标题",
                "duration": "讲座时长"
              }
            ]
          }
        ]
      }

      HTML代码：
      ${resource.course_html}
      
      请只返回提取后的JSON数据，不要有任何其他文字说明。
      `;

      // 调用智谱AI
      console.log('调用智谱AI解析HTML内容...');
      const completion = await openai.chat.completions.create({
        model: model,
        messages: [
          { role: 'system', content: '你是一个帮助解析HTML结构的专业助手，擅长从HTML中提取结构化信息并返回JSON格式数据。' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.2
      });

      console.log('智谱AI响应:', JSON.stringify(completion, null, 2));

      // 提取返回的内容
      const content = completion.choices[0]?.message?.content || '';
      
      // 尝试解析JSON
      let parsedContent;
      let parsedContentStr;
      try {
        // 清理内容，移除可能的markdown代码块标记
        const cleanedContent = content.replace(/```json|```/g, '').trim();
        console.log('清理后的内容:', cleanedContent);
        
        parsedContent = JSON.parse(cleanedContent);
        parsedContentStr = JSON.stringify(parsedContent, null, 2);
        console.log('成功解析JSON结果:', parsedContentStr);
      } catch (parseError) {
        console.error('解析智谱AI返回的JSON失败:', parseError);
        console.error('接收到的原始内容:', content);
        parsedContent = { error: '无法解析返回的JSON', content };
        parsedContentStr = JSON.stringify(parsedContent);
      }

      // 保存解析结果到数据库
      console.log('保存解析结果到数据库...');
      console.log('解析结果长度:', parsedContentStr ? parsedContentStr.length : 0);
      
      const updateResult = await storage.updateFeifeiResource(resourceId, {
        parsed_content: parsedContentStr
      });
      
      console.log('数据库更新结果:', JSON.stringify({
        success: !!updateResult,
        resourceId,
        hasParsedContent: !!updateResult?.parsed_content,
        contentLength: updateResult?.parsed_content?.length || 0
      }));

      // 获取更新后的资源
      const updatedResource = await storage.getFeifeiResource(resourceId);
      console.log('更新后的资源:', JSON.stringify({
        id: updatedResource?.id,
        has_parsed_content: !!updatedResource?.parsed_content
      }));

      // 获取资源关联的标签
      const tags = await storage.getFeifeiResourceTags(resourceId);

      // 返回增强的资源对象以及解析结果
      const enrichedResource = {
        ...updatedResource,
        tags: tags
      };

      return res.status(200).json({ 
        message: '课程大纲提取成功', 
        resource: enrichedResource 
      });
    } catch (error) {
      console.error('提取课程大纲时出错:', error);
      return res.status(500).json({ message: '服务器错误', error: (error as Error).message });
    }
  });
  
  // 公共函数：解析一个菲菲资源页面
  async function parseFeifeiResourcePage(resourceId: number, isLogVerbose: boolean = false): Promise<{
    success: boolean;
    message: string;
    resource?: any;
    error?: string;
  }> {
    // 获取资源信息
    const resource = await storage.getFeifeiResource(resourceId);
    
    if (!resource) {
      if (isLogVerbose) console.log(`资源 ID ${resourceId} 不存在`);
      return { success: false, message: '资源不存在' };
    }
    
    if (!resource.url) {
      if (isLogVerbose) console.log(`资源 ID ${resourceId} 的URL为空`);
      return { success: false, message: '资源URL为空，无法获取页面内容' };
    }
    
    if (isLogVerbose) console.log(`准备从URL获取页面内容: ${resource.url}`);
    
    // 导入axios和cheerio库
    const axios = (await import('axios')).default;
    const { load } = await import('cheerio');
    
    try {
      // 获取网页内容
      const response = await axios.get(resource.url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });
      const html = response.data;
      
      // 使用cheerio解析HTML
      const $ = load(html);
      
      // 保存整个body内容
      let courseHtml = $('body').html() || '';
      if (isLogVerbose) console.log(`保存body内容，长度: ${courseHtml.length} 字符`);
      
      // 提取标签信息
      const tagElements = $('.entry-tags a');
      const tagNames: string[] = [];
      
      if (tagElements.length > 0) {
        if (isLogVerbose) console.log(`找到 ${tagElements.length} 个标签`);
        tagElements.each((idx, element) => {
          const tagName = $(element).text().trim();
          if (tagName) {
            tagNames.push(tagName);
            if (isLogVerbose) console.log(`  标签 ${idx + 1}: ${tagName}`);
          }
        });
      } else {
        if (isLogVerbose) console.log('未找到标签元素');
      }
      
      // 提取资源元数据
      const articleMeta = $('.article-meta');
      
      // 初始化元数据字段
      let resourceCategory = '';
      let popularity = '';
      let publishDate = '';
      let lastUpdate = '';
      let contentInfo = '';
      let videoSize = '';
      let fileSize = '';
      let duration = '';
      let language = '';
      let subtitle = '';
      let coinPrice = '';
      
      // 从article-meta中提取信息
      if (articleMeta.length > 0) {
        if (isLogVerbose) console.log('找到article-meta元素，开始提取元数据');
        
        // 遍历所有li元素
        articleMeta.find('li').each((index, element) => {
          const text = $(element).text().trim();
          
          if (text.includes('资源分类:')) {
            resourceCategory = $(element).find('a').text().trim();
          } 
          else if (text.includes('浏览热度:')) {
            // 提取热度值，并去除括号，只保留数字
            const rawPopularity = text.replace('浏览热度:', '').trim();
            // 使用正则表达式提取括号中的数字
            const popularityMatch = rawPopularity.match(/\((\d+)\)/);
            popularity = popularityMatch ? popularityMatch[1] : rawPopularity;
          }
          else if (text.includes('发布时间:')) {
            publishDate = text.replace('发布时间:', '').trim();
          }
          else if (text.includes('最近更新:')) {
            lastUpdate = text.replace('最近更新:', '').trim();
          }
          else if (text.includes('文件内容:')) {
            contentInfo = text.replace('文件内容:', '').trim();
          }
          else if (text.includes('视频尺寸:')) {
            videoSize = text.replace('视频尺寸:', '').trim();
          }
          else if (text.includes('视频大小:')) {
            fileSize = text.replace('视频大小:', '').trim();
          }
          else if (text.includes('课时:')) {
            duration = text.replace('课时:', '').trim();
          }
          else if (text.includes('视频语言:')) {
            language = text.replace('视频语言:', '').trim();
          }
          else if (text.includes('视频字幕:')) {
            subtitle = text.replace('视频字幕:', '').trim();
          }
        });
        
        if (isLogVerbose) {
          console.log('元数据提取完成:', {
            resourceCategory,
            popularity,
            publishDate,
            lastUpdate,
            contentInfo,
            videoSize,
            fileSize,
            duration,
            language,
            subtitle,
            coinPrice
          });
        }
      } else {
        if (isLogVerbose) console.log('未找到article-meta元素，无法提取元数据');
      }
      
      // 提取金币价格信息
      const pricesInfo = $('.prices-info');
      if (pricesInfo.length > 0) {
        // 查找普通价格项
        const priceItem = pricesInfo.find('.price-item.no');
        if (priceItem.length > 0) {
          const priceText = priceItem.text().trim();
          // 使用正则表达式提取数字部分
          const priceMatch = priceText.match(/(\d+)金币/);
          if (priceMatch && priceMatch[1]) {
            coinPrice = priceMatch[1];
            if (isLogVerbose) console.log(`提取到金币价格: ${coinPrice}`);
          }
        }
      }
      
      // 提取查看预览的URL
      let previewUrl = '';
      // 尝试多种选择器找到"查看预览"链接
      const previewLink = $('a.btn:contains("查看预览"), a.btn-dark:contains("查看预览"), a:contains("查看预览")').first();
      if (previewLink.length > 0) {
        previewUrl = previewLink.attr('href') || '';
        if (isLogVerbose) console.log(`提取到预览链接: ${previewUrl}`);
      } else {
        if (isLogVerbose) console.log('未找到查看预览链接');
      }
      
      // 提取图片URL
      const imgUrl = $('meta[property="og:image"]').attr('content') || 
                    $('.wp-post-image').attr('src') ||
                    $('img.attachment-large').attr('src');
      
      // 提取详情描述
      const details = $('.entry-content').text().trim();
      
      // 提取article标签内容 - 针对详情介绍的提取
      let articleContentHtml = '';
      const articleContent = $('article.post-content');
      if (articleContent.length > 0) {
        articleContentHtml = articleContent.html() || '';
        if (isLogVerbose) console.log(`成功提取到 article.post-content HTML 内容，长度: ${articleContentHtml.length} 字符`);
      } else {
        if (isLogVerbose) console.log('未找到 article.post-content 元素，尝试其他article元素');
        // 如果没有找到指定class的article，尝试查找任何article标签
        const anyArticle = $('article');
        if (anyArticle.length > 0) {
          articleContentHtml = anyArticle.html() || '';
          if (isLogVerbose) console.log(`成功提取到 article HTML 内容，长度: ${articleContentHtml.length} 字符`);
        } else {
          if (isLogVerbose) console.log('未找到任何 article 元素');
        }
      }
      
      // 删除声明文字
      const declarationText = "声明：本站所有文章，如无特殊说明或标注，均为本站原创发布。任何个人或组织，在未征得本站同意时，禁止复制、盗用、采集、发布本站内容到任何网站、书籍等各类媒体平台。如若本站内容侵犯了原著者的合法权益，可联系我们进行处理。";
      if (articleContentHtml.includes(declarationText)) {
        if (isLogVerbose) console.log('找到声明文字，正在删除...');
        articleContentHtml = articleContentHtml.replace(declarationText, '');
        if (isLogVerbose) console.log(`删除声明文字后，内容长度: ${articleContentHtml.length} 字符`);
      } else {
        if (isLogVerbose) console.log('未找到声明文字，无需删除');
        
        // 尝试使用包含p标签的方式删除
        const declarationPattern = /<p[^>]*>.*?本站所有文章.*?原创发布.*?进行处理.*?<\/p>/i;
        if (declarationPattern.test(articleContentHtml)) {
          if (isLogVerbose) console.log('使用正则表达式匹配到声明段落，正在删除...');
          articleContentHtml = articleContentHtml.replace(declarationPattern, '');
          if (isLogVerbose) console.log(`使用正则表达式删除声明后，内容长度: ${articleContentHtml.length} 字符`);
        }
      }
      
      // 删除目录结构 <div class="lwptoc">
      const lwptocPattern = /<div\s+class=["']lwptoc[^"']*["'][^>]*>[\s\S]*?<\/div>/gi;
      if (lwptocPattern.test(articleContentHtml)) {
        if (isLogVerbose) console.log('找到lwptoc目录元素，正在删除...');
        articleContentHtml = articleContentHtml.replace(lwptocPattern, '');
        if (isLogVerbose) console.log(`删除lwptoc目录元素后，内容长度: ${articleContentHtml.length} 字符`);
      } else {
        if (isLogVerbose) console.log('未找到lwptoc目录元素，无需删除');
        
        // 尝试通过部分类名匹配
        const partialLwptocPattern = /<div[^>]*lwptoc[^>]*>[\s\S]*?<\/div>/gi;
        if (partialLwptocPattern.test(articleContentHtml)) {
          if (isLogVerbose) console.log('使用部分类名匹配到lwptoc目录元素，正在删除...');
          articleContentHtml = articleContentHtml.replace(partialLwptocPattern, '');
          if (isLogVerbose) console.log(`使用部分类名删除lwptoc目录元素后，内容长度: ${articleContentHtml.length} 字符`);
        }
      }
      
      // 更新资源信息，在提取到articleContentHtml的情况下，更新details_html字段
      const updateData: Partial<FeifeiResource> = {
        // 不更新course_html字段，按照用户要求
        // 更新details_html字段
        ...(articleContentHtml && { details_html: articleContentHtml }),
        ...(imgUrl && { image_url: imgUrl }),
        ...(resourceCategory && { resource_category: resourceCategory }),
        ...(popularity && { popularity }),
        ...(publishDate && { publish_date: publishDate }),
        ...(lastUpdate && { last_update: lastUpdate }),
        ...(contentInfo && { content_info: contentInfo }),
        ...(fileSize && { file_size: fileSize }),
        ...(videoSize && { video_size: videoSize }),
        ...(duration && { duration }),
        ...(language && { language }),
        ...(subtitle && { subtitle }),
        ...(details && { details }),
        ...(coinPrice && { coin_price: coinPrice }),
        ...(previewUrl && { preview_url: previewUrl })
      };
      
      // 记录提取到的信息
      if (isLogVerbose) {
        console.log(`提取到的页面信息:`, JSON.stringify({
          hasHtml: !!courseHtml,
          htmlLength: courseHtml.length,
          articleHtmlLength: articleContentHtml.length,
          imgUrl,
          resourceCategory,
          popularity,
          publishDate,
          lastUpdate,
          coinPrice,
          previewUrl
        }));
      }
      
      // 保存到数据库
      const updatedResource = await storage.updateFeifeiResource(resourceId, updateData);
      if (!updatedResource) {
        if (isLogVerbose) console.log(`更新资源 ID ${resourceId} 失败`);
        return { success: false, message: '更新资源信息失败' };
      }
      
      // 处理提取的标签
      if (tagNames.length > 0) {
        if (isLogVerbose) console.log('开始处理标签数据，准备更新数据库...');
        
        // 获取现有标签
        const existingTags = await storage.getFeifeiResourceTags(resourceId);
        const existingTagNames = new Set(existingTags.map(tag => tag.name.trim().toLowerCase()));
        
        for (const tagName of tagNames) {
          // 检查标签是否已存在（不区分大小写的比较）
          const normalizedTagName = tagName.trim().toLowerCase();
          if (existingTagNames.has(normalizedTagName)) {
            if (isLogVerbose) console.log(`标签 "${tagName}" 已与资源关联，跳过`);
            continue;
          }
          
          // 查找或创建标签
          let tag = await storage.getFeifeiTagByName(tagName);
          if (!tag) {
            tag = await storage.createFeifeiTag({ name: tagName });
            if (isLogVerbose) console.log(`创建新标签: ${tagName}`);
          }
          
          // 检查资源-标签关系是否存在
          const tagRelation = await storage.getFeifeiResourceTagRelation(resourceId, tag.id);
          if (!tagRelation) {
            // 创建资源-标签关联
            await storage.createFeifeiResourceTag({
              resource_id: resourceId,
              tag_id: tag.id
            });
            if (isLogVerbose) console.log(`为资源 ID ${resourceId} 添加标签: ${tagName}`);
          }
        }
      } else {
        if (isLogVerbose) console.log('没有标签需要处理');
      }
      
      // 获取更新后的标签数据
      const updatedTags = await storage.getFeifeiResourceTags(resourceId);
      if (isLogVerbose) console.log(`资源 ${resourceId} 最终关联的标签数量: ${updatedTags.length}`);
      
      // 返回成功结果
      return { 
        success: true, 
        message: '成功获取并解析页面内容',
        resource: { ...updatedResource, tags: updatedTags }
      };
    } catch (fetchError) {
      if (isLogVerbose) console.error('获取页面内容时出错:', fetchError);
      return { 
        success: false, 
        message: '获取页面内容失败', 
        error: (fetchError as Error).message 
      };
    }
  }

  // 列表页中的解析页面按钮 - 从网络获取页面内容并解析
  app.post('/api/feifei-resources/:id/fetch-and-parse', authenticateUser as any, authorizeAdmin as any, async (req: AuthenticatedRequest, res) => {
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
      
      // 使用公共解析函数
      const result = await parseFeifeiResourcePage(resourceId, true);
      
      if (result.success) {
        res.status(200).json({
          message: result.message,
          resource: result.resource
        });
      } else {
        res.status(400).json({ message: result.message, error: result.error });
      }
    } catch (error) {
      console.error('处理资源页面时出错:', error);
      return res.status(500).json({ 
        message: '服务器错误', 
        error: (error as Error).message 
      });
    }
  });
  
  // 将菲菲资源转移到资源表（待上架功能）
  // 用于调试source_url的路由
  app.get('/api/debug/resources-by-source-url', authenticateUser as any, authorizeAdmin as any, async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user) {
        res.status(401).json({ message: '未登录或会话已过期' });
        return;
      }
      
      const sourceUrl = req.query.url as string;
      if (!sourceUrl) {
        return res.status(400).json({ message: '缺少url参数' });
      }
      
      console.log(`正在查找source_url为 ${sourceUrl} 的资源`);
      const existingResources = await storage.getAllResources({
        source_url: sourceUrl
      });
      console.log(`查询结果: 找到 ${existingResources.resources.length} 个匹配source_url的资源`);
      
      if (existingResources.resources.length > 0) {
        // 列出所有匹配资源的详细信息
        const resources = existingResources.resources.map(r => ({
          id: r.id,
          title: r.title,
          source_url: r.source_url,
          source_type: r.source_type
        }));
        
        return res.json({ 
          count: existingResources.resources.length,
          resources,
          query_url: sourceUrl
        });
      } else {
        return res.json({ 
          count: 0, 
          resources: [],
          query_url: sourceUrl
        });
      }
    } catch (error) {
      console.error('调试source_url查询时出错:', error);
      return res.status(500).json({ message: '查询出错' });
    }
  });

  app.post('/api/feifei-resources/:id/to-resource', authenticateUser as any, authorizeAdmin as any, async (req: AuthenticatedRequest, res) => {
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
      
      // 获取菲菲资源
      const feifeiResource = await storage.getFeifeiResource(resourceId);
      if (!feifeiResource) {
        res.status(404).json({ message: '未找到指定的菲菲资源' });
        return;
      }
      
      // 获取该资源所属的菲菲分类
      let feifeiCategory = null;
      if (feifeiResource.category_id) {
        feifeiCategory = await storage.getFeifeiCategory(feifeiResource.category_id);
      }
      
      // 尝试根据菲菲资源的URL查找现有资源
      console.log(`正在查找source_url为 ${feifeiResource.url} 的资源`);
      
      // 直接执行SQL查询查找匹配的资源
      const matchingResources = await db
        .select()
        .from(resources)
        .where(eq(resources.source_url, feifeiResource.url));
      
      console.log(`直接SQL查询结果: 找到 ${matchingResources.length} 个匹配source_url的资源`);
      
      // 保持原有接口结构，方便后面的代码使用
      const existingResources = {
        resources: matchingResources,
        total: matchingResources.length
      };
      
      // 尝试根据菲菲分类标题查找对应的系统分类
      let matchedCategoryId = null;
      if (feifeiCategory) {
        // 获取所有系统分类
        const allCategories = await storage.getAllCategories();
        
        // 对菲菲分类标题进行标准化处理
        const normalizedFeifeiTitle = feifeiCategory.title.replace(/\s+/g, '').toLowerCase();
        
        // 1. 首先尝试查找完全匹配的分类
        let exactMatch = false;
        for (const category of allCategories) {
          // 对系统分类名称也进行标准化处理
          const normalizedCategoryName = category.name.replace(/\s+/g, '').toLowerCase();
          
          // 检查完全匹配
          if (normalizedCategoryName === normalizedFeifeiTitle) {
            matchedCategoryId = category.id;
            console.log(`找到完全匹配的分类: ${category.name}, ID: ${category.id}`);
            exactMatch = true;
            break;
          }
        }
        
        // 2. 如果没有完全匹配，尝试处理"设计-平面设计与插画"这种格式
        if (!exactMatch) {
          // 对菲菲分类标题按'-'分割
          const titleParts = feifeiCategory.title.split('-').map(part => part.trim());
          
          if (titleParts.length > 1) {
            // 组合成"设计-平面设计与插画"类型的完整分类名
            const combinedTitle = titleParts.join('-');
            const combinedTitleNoHyphen = titleParts.join(''); // 无连字符版本
            
            for (const category of allCategories) {
              const normalizedCategoryName = category.name.replace(/\s+/g, '').toLowerCase();
              
              // 检查是否匹配组合后的完整名称（无论有无连字符）
              if (normalizedCategoryName === combinedTitle.toLowerCase().replace(/\s+/g, '') ||
                  normalizedCategoryName === combinedTitleNoHyphen.toLowerCase() ||
                  normalizedCategoryName.includes(combinedTitle.toLowerCase().replace(/\s+/g, '')) ||
                  combinedTitle.toLowerCase().replace(/\s+/g, '').includes(normalizedCategoryName)) {
                matchedCategoryId = category.id;
                console.log(`找到组合名称匹配: ${category.name}, ID: ${category.id}`);
                exactMatch = true;
                break;
              }
            }
          }
        }
        
        // 3. 尝试分段匹配
        if (!exactMatch) {
          const titleParts = feifeiCategory.title.split('-').map(part => part.trim());
          
          // 尝试使用第一部分查找匹配的系统分类 (例如：'设计')
          if (titleParts.length > 0) {
            const mainCategoryName = titleParts[0];
            let mainMatch = false;
            
            // 查找标题第一部分的匹配
            for (const category of allCategories) {
              const normalizedCategoryName = category.name.replace(/\s+/g, '').toLowerCase();
              const normalizedMainName = mainCategoryName.replace(/\s+/g, '').toLowerCase();
              
              if (normalizedCategoryName === normalizedMainName || 
                  normalizedCategoryName.includes(normalizedMainName)) {
                matchedCategoryId = category.id;
                console.log(`找到主分类匹配: ${category.name}, ID: ${category.id}`);
                mainMatch = true;
                break;
              }
            }
            
            // 如果主分类没有匹配，尝试使用子分类
            if (!mainMatch && titleParts.length > 1) {
              const subCategoryName = titleParts[1];
              
              for (const category of allCategories) {
                const normalizedCategoryName = category.name.replace(/\s+/g, '').toLowerCase();
                const normalizedSubName = subCategoryName.replace(/\s+/g, '').toLowerCase();
                
                if (normalizedCategoryName.includes(normalizedSubName)) {
                  matchedCategoryId = category.id;
                  console.log(`找到子分类匹配: ${category.name}, ID: ${category.id}`);
                  break;
                }
              }
            }
          }
        }
        
        // 4. 最后尝试模糊匹配
        if (!matchedCategoryId) {
          // 尝试找出最佳匹配
          let bestMatchScore = 0;
          let bestMatchCategory = null;
          
          for (const category of allCategories) {
            const normalizedCategoryName = category.name.replace(/\s+/g, '').toLowerCase();
            
            // 计算两个字符串的相似度（简化版，仅检查包含关系）
            let score = 0;
            if (normalizedCategoryName.includes(normalizedFeifeiTitle)) {
              score = normalizedFeifeiTitle.length;
            } else if (normalizedFeifeiTitle.includes(normalizedCategoryName)) {
              score = normalizedCategoryName.length;
            }
            
            // 保存最高分的匹配
            if (score > bestMatchScore) {
              bestMatchScore = score;
              bestMatchCategory = category;
            }
          }
          
          if (bestMatchCategory) {
            matchedCategoryId = bestMatchCategory.id;
            console.log(`找到最佳模糊匹配: ${bestMatchCategory.name}, ID: ${bestMatchCategory.id}, 分数: ${bestMatchScore}`);
          }
        }
        
        // 5. 如果所有匹配尝试都失败，使用默认分类（假设ID为1是设计创意分类）
        if (!matchedCategoryId) {
          // 寻找设计创意分类
          const defaultCategory = allCategories.find(cat => 
            cat.name.includes('设计') || cat.name.includes('创意')
          );
          
          if (defaultCategory) {
            matchedCategoryId = defaultCategory.id;
            console.log(`使用默认设计分类: ${defaultCategory.name}, ID: ${defaultCategory.id}`);
          } else if (allCategories.length > 0) {
            // 如果找不到设计分类，使用第一个分类作为后备
            matchedCategoryId = allCategories[0].id;
            console.log(`使用第一个系统分类作为后备: ${allCategories[0].name}, ID: ${allCategories[0].id}`);
          }
        }
        
        console.log(`菲菲分类: ${feifeiCategory.title}, 最终匹配的系统分类ID: ${matchedCategoryId || '未找到匹配的分类'}`);
      }
      
      // 准备资源数据
      const resourceData = {
        title: feifeiResource.chinese_title,
        subtitle: feifeiResource.english_title || "",
        cover_image: feifeiResource.image_url || "",
        // 使用匹配到的分类ID
        category_id: matchedCategoryId,
        // 默认作者ID，后续可以在资源管理页面修改
        author_id: 1,
        price: feifeiResource.coin_price || "0",
        video_url: "",
        // 确保视频时长是字符串类型
        video_duration: 0,
        // 注意：video_size是字符串类型，但在schema中可能定义为numeric
        // 如果必要，此处可以尝试提取数字部分，但现在先设为null以解决问题
        video_size: null,
        language: feifeiResource.language || "",
        subtitle_languages: feifeiResource.subtitle || "",
        resolution: feifeiResource.video_size || "",
        source_type: "feifei",
        status: 0, // 默认设置为下架状态
        is_free: false,
        description: feifeiResource.description || "",
        contents: feifeiResource.parsed_content || "",
        faq_content: "",
        resource_url: feifeiResource.url,
        resource_type: "feifei",
        source_url: feifeiResource.url  // 将feifei资源的原始URL赋值给资源来源字段
      };
      
      let resource;
      let message;
      
      if (existingResources.resources.length > 0) {
        // 更新已有资源
        const existingResource = existingResources.resources[0];
        console.log(`找到已存在的资源: ID=${existingResource.id}, 标题=${existingResource.title}`);
        console.log(`将更新此资源而不是创建新资源`);
        resource = await storage.updateResource(existingResource.id, resourceData);
        message = "已更新资源";
      } else {
        // 创建新资源
        console.log(`未找到匹配source_url的资源，将创建新资源`);
        resource = await storage.createResource(resourceData);
        message = "已创建新资源";
      }
      
      return res.json({ 
        message, 
        resource,
        status: "success"
      });
    } catch (error) {
      console.error("将菲菲资源转换为资源时出错:", error);
      return res.status(500).json({ 
        message: error instanceof Error ? error.message : "服务器错误，将菲菲资源转换为资源时出错",
        status: "error"
      });
    }
  });

  // 后台解析所有菲菲资源的端点
  app.post('/api/parse-all-feifei-resources', authenticateUser as any, authorizeAdmin as any, async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user) {
        res.status(401).json({ message: '未登录或会话已过期' });
        return;
      }

      // 立即回应客户端，表示任务已开始
      res.json({ message: '已启动菲菲资源的解析任务 (仅解析第一个分类)，请查看控制台日志了解进度' });
      
      console.log('=== 开始解析菲菲资源 (仅第一个分类) ===');
      
      // 1. 获取所有分类
      const categoriesResult = await storage.getAllFeifeiCategories({ invalidStatus: false });
      const allCategories = categoriesResult.categories;
      console.log(`获取到 ${allCategories.length} 个有效分类`);
      
      // 2. 仅处理第一个分类
      if (allCategories.length > 0) {
        const category = allCategories[0];
        console.log(`\n处理分类: ${category.title}`);
        
        try {
          // 调用共用函数解析分类URL
          console.log(`  正在解析分类页面: ${category.url}`);
          const parseResult = await parseFeifeiCategoryUrl(category.id, true);
          console.log(`  ${parseResult.message}`);
          
          // 获取该分类下的所有资源
          const resourcesResult = await storage.getFeifeiResourcesByCategory(category.id, 1, 1000);
          const categoryResources = resourcesResult.resources;
          console.log(`\n=== 开始解析分类 "${category.title}" 下的 ${categoryResources.length} 个资源详情页 ===`);
          
          // 遍历该分类下的所有资源
          for (let k = 0; k < categoryResources.length; k++) {
            const resource = categoryResources[k];
            console.log(`\n[${k+1}/${categoryResources.length}] 解析资源: ${resource.chinese_title}`);
            
            try {
              // 使用公共解析函数处理资源
              console.log(`  正在解析资源页面: ${resource.url}`);
              const parseResult = await parseFeifeiResourcePage(resource.id, true);
              
              if (parseResult.success) {
                console.log(`  成功解析并保存资源: ${resource.chinese_title}`);
              } else {
                console.error(`  解析资源失败: ${parseResult.message}`);
              }
            } catch (error) {
              console.error(`  解析资源 "${resource.chinese_title}" 时出错:`, error instanceof Error ? error.message : String(error));
            }
            
            // 在处理完一个资源后暂停3秒
            await new Promise(resolve => setTimeout(resolve, 3000));
          }
        } catch (error) {
          console.error(`  解析分类 "${category.title}" 时出错:`, error instanceof Error ? error.message : String(error));
        }
      } else {
        console.log('没有找到有效分类，解析终止');
      }
      
      console.log('\n=== 菲菲资源解析任务完成 (仅解析了第一个分类) ===');
      
    } catch (error) {
      console.error('解析菲菲资源时出错:', error);
      // 由于已经向客户端发送了响应，这里只记录错误
    }
  });

  return httpServer;
}