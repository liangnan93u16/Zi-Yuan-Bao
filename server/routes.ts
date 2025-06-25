import express, { type Express } from "express";
import { createServer, type Server } from "http";
import { storage, ResourceFilters } from "./storage";
import session from "express-session";
import { z } from "zod";
import axios from 'axios';
import * as cheerio from 'cheerio';
import OpenAI from 'openai';
import { db } from './db';
import { fixMarkdownContent } from './html-to-markdown';
import { generateOrderNo, generatePaymentSign, verifyPaymentCallback } from './utils/payment';
import { eq, sql, and, isNull, isNotNull, ne } from 'drizzle-orm';
import * as fs from 'fs';
import * as path from 'path';
import multer from 'multer';
import { 
  insertCategorySchema, 
  insertResourceSchema, 
  insertResourceRequestSchema,
  insertReviewSchema,
  insertAuthorSchema,
  insertFeifeiCategorySchema,
  insertFeifeiResourceSchema,
  feifeiResources,
  loginSchema, 
  registerSchema,
  type Review,
  type FeifeiResource,
  type FeifeiCategory,
  resources,
  userPurchases
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
  // 创建图片保存目录
  const imagesDir = path.join('public', 'images');
  try {
    if (!fs.existsSync(imagesDir)) {
      console.log(`创建图片保存目录: ${imagesDir}`);
      fs.mkdirSync(imagesDir, { recursive: true });
    } else {
      console.log(`图片保存目录已存在: ${imagesDir}`);
    }
  } catch (err) {
    console.error(`创建图片保存目录失败: ${err}`);
  }
  
  // 设置静态文件服务，提供图片访问
  app.use('/images', express.static(path.join('public', 'images')));
  
  // 配置multer以处理文件上传
  const multerStorage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, imagesDir);
    },
    filename: function (req, file, cb) {
      // 生成文件名: 原始名称-时间戳.扩展名
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const ext = path.extname(file.originalname);
      const filename = file.originalname.replace(ext, '') + '-' + uniqueSuffix + ext;
      cb(null, filename);
    }
  });
  
  const upload = multer({ 
    storage: multerStorage,
    limits: {
      fileSize: 10 * 1024 * 1024, // 限制文件大小为10MB
    },
    fileFilter: function (req, file, cb) {
      // 接受的图片类型
      const filetypes = /jpeg|jpg|png|gif|webp|svg/;
      const mimetype = filetypes.test(file.mimetype);
      const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
      
      if (mimetype && extname) {
        return cb(null, true);
      }
      
      cb(new Error('只支持上传图片文件(jpg, jpeg, png, gif, webp, svg)'));
    }
  });
  
  // 检查资源是否可以被删除（是否已被购买）
  async function canDeleteResource(resourceId: number): Promise<boolean> {
    const purchases = await db
      .select({ count: sql`count(*)` })
      .from(userPurchases)
      .where(eq(userPurchases.resource_id, resourceId));
    
    return Number(purchases[0]?.count || 0) === 0;
  }
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
      
      // 丰富购买记录数据，添加资源信息（包括提取码）
      const enrichedPurchases = await Promise.all(purchases.map(async (purchase) => {
        const resource = await storage.getResource(purchase.resource_id);
        return {
          ...purchase,
          resource: resource ? {
            id: resource.id,
            title: resource.title,
            subtitle: resource.subtitle,
            cover_image: resource.cover_image,
            resource_url: resource.resource_url,
            resource_code: resource.resource_code // 添加提取码信息
          } : { title: '未知资源', subtitle: '' }
        };
      }));
      
      res.json(enrichedPurchases);
    } catch (error) {
      console.error('Error fetching user purchases:', error);
      res.status(500).json({ message: '获取购买记录失败' });
    }
  });
  
  // 获取用户收藏的资源列表
  app.get('/api/user/favorites', authenticateUser as any, async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user) {
        res.status(401).json({ message: '未登录或会话已过期' });
        return;
      }
      
      // 获取用户的收藏资源
      const { resources, total } = await storage.getUserFavorites(req.user.id);
      
      // 对资源进行分类增强
      const enrichedResources = await Promise.all(resources.map(async (resource) => {
        let category = null;
        if (resource.category_id) {
          category = await storage.getCategory(resource.category_id);
        }
        
        let author = null;
        if (resource.author_id) {
          author = await storage.getAuthor(resource.author_id);
        }
        
        return {
          ...resource,
          category,
          author
        };
      }));
      
      res.json({
        resources: enrichedResources,
        total
      });
    } catch (error) {
      console.error('Error fetching user favorites:', error);
      res.status(500).json({ message: '获取收藏记录失败' });
    }
  });
  
  // 添加收藏
  app.post('/api/resources/:id/favorite', authenticateUser as any, async (req: AuthenticatedRequest, res) => {
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
      
      // 检查资源是否存在
      const resource = await storage.getResource(resourceId);
      if (!resource) {
        res.status(404).json({ message: '资源不存在' });
        return;
      }
      
      // 检查用户是否已经收藏过该资源
      const existingFavorite = await storage.getUserFavorite(req.user.id, resourceId);
      if (existingFavorite) {
        res.status(200).json({ 
          success: true, 
          message: '已经收藏过该资源', 
          favorited: true 
        });
        return;
      }
      
      // 添加收藏
      await storage.createUserFavorite(req.user.id, resourceId);
      
      res.status(201).json({ 
        success: true, 
        message: '收藏成功',
        favorited: true
      });
    } catch (error) {
      console.error('Error adding favorite:', error);
      res.status(500).json({ message: '收藏失败' });
    }
  });
  
  // 取消收藏
  app.delete('/api/resources/:id/favorite', authenticateUser as any, async (req: AuthenticatedRequest, res) => {
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
      
      // 删除收藏
      const result = await storage.deleteUserFavorite(req.user.id, resourceId);
      
      if (result) {
        res.json({ 
          success: true, 
          message: '取消收藏成功',
          favorited: false
        });
      } else {
        res.status(404).json({ message: '收藏记录不存在' });
      }
    } catch (error) {
      console.error('Error removing favorite:', error);
      res.status(500).json({ message: '取消收藏失败' });
    }
  });
  
  // 检查资源是否已收藏
  app.get('/api/resources/:id/favorite/check', authenticateUser as any, async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user) {
        res.status(401).json({ message: '未登录或会话已过期', favorited: false });
        return;
      }
      
      const resourceId = parseInt(req.params.id);
      if (isNaN(resourceId)) {
        res.status(400).json({ message: '无效的资源ID', favorited: false });
        return;
      }
      
      // 检查是否收藏过
      const favorited = await storage.checkIfUserFavorited(req.user.id, resourceId);
      
      res.json({ 
        success: true, 
        favorited 
      });
    } catch (error) {
      console.error('Error checking favorite status:', error);
      res.status(500).json({ message: '检查收藏状态失败', favorited: false });
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
      
      // 从系统参数表获取每日购买限制
      let dailyLimit = 5; // 默认限制为5
      try {
        const limitParam = await storage.getParameterByKey('DAILY_PURCHASE_LIMIT');
        if (limitParam && limitParam.value) {
          const parsedLimit = parseInt(limitParam.value);
          if (!isNaN(parsedLimit) && parsedLimit > 0) {
            dailyLimit = parsedLimit;
          }
        }
      } catch (error) {
        console.error('获取每日购买限制参数失败，使用默认值5:', error);
      }
      
      // 检查用户当天的购买次数是否已达到限制
      const dailyPurchaseCount = await storage.getUserDailyPurchaseCount(req.user.id);
      if (dailyPurchaseCount >= dailyLimit) {
        res.status(400).json({
          success: false,
          message: `您今天已达到购买限制（每天最多购买${dailyLimit}条资源），请明天再来`
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
      
      // 只有高级会员(premium)和管理员(admin)才能免费获取资源，且高级会员必须是有效期内
      // 管理员不受会员到期时间的限制
      if (req.user.membership_type) {
        // admin会员不受有效期限制，永远可以免费获取
        if (req.user.membership_type === 'admin') {
          // 记录购买信息（管理员免费获取）时保存实际资源价格，而不是0
          const actualPrice = typeof resource.price === 'string' ? parseFloat(resource.price) : (resource.price || 0);
          await storage.createUserPurchase(req.user.id, resourceId, actualPrice);
          
          res.json({ 
            success: true, 
            message: '管理员资源获取成功',
            resource_url: resource.resource_url
          });
          return;
        }
        
        // 高级会员(premium)需要检查会员是否有效（没有到期时间或当前时间小于到期时间）
        if (req.user.membership_type === 'premium') {
          const membershipValid = !req.user.membership_expire_time || 
                                 new Date(req.user.membership_expire_time) > new Date();
                                 
          console.log('高级会员检查:', {
            userId: req.user.id,
            membershipType: req.user.membership_type,
            expireTime: req.user.membership_expire_time,
            isValidMembership: membershipValid,
            resourceId,
            resourcePrice: resource.price,
            isFree: resource.is_free
          });
          
          if (membershipValid) {
            // 记录购买信息（高级会员免费获取）时保存实际资源价格，而不是0
            const actualPrice = typeof resource.price === 'string' ? parseFloat(resource.price) : (resource.price || 0);
            await storage.createUserPurchase(req.user.id, resourceId, actualPrice);
            
            res.json({ 
              success: true, 
              message: '高级会员资源获取成功',
              resource_url: resource.resource_url
            });
            return;
          } else {
            // 高级会员已过期，提示用户
            console.log('高级会员已过期:', {
              userId: req.user.id,
              expireTime: req.user.membership_expire_time
            });
          }
        }
      }
      
      // 计算资源价格（确保是数字）
      const price = typeof resource.price === 'string' ? parseFloat(resource.price) : (resource.price || 0);
      
      // 严格检查用户积分是否足够
      console.log('积分检查:', {
        userId: req.user.id,
        userCoins: req.user.coins || 0,
        resourcePrice: price,
        isEnough: (req.user.coins || 0) >= price
      });
      
      if ((req.user.coins || 0) < price) {
        // 积分不足时，创建支付订单
        try {
          // 获取商户信息
          const merchantIdParam = await storage.getParameterByKey('商户ID');
          const merchantKeyParam = await storage.getParameterByKey('商户密钥');
          const siteUrlParam = await storage.getParameterByKey('SITE_URL');

          if (!merchantIdParam?.value || !merchantKeyParam?.value) {
            res.status(500).json({ message: '支付配置不完整，请联系管理员' });
            return;
          }

          const merchantId = merchantIdParam.value;
          const merchantKey = merchantKeyParam.value;
          const siteUrl = siteUrlParam?.value || req.headers.origin || '';

          // 生成唯一订单号
          const orderNo = generateOrderNo();

          // 创建订单记录
          const order = await storage.createOrder({
            order_no: orderNo,
            user_id: req.user.id,
            resource_id: resourceId,
            amount: price.toString(),
            payment_method: 'alipay',
            status: 'pending'
          });

          // 构建支付参数
          const paymentParams = {
            pid: merchantId,
            type: 'alipay',
            out_trade_no: orderNo,
            notify_url: `${siteUrl}/api/payment/notify`,
            return_url: `${siteUrl}/payment/result`,
            name: resource.title,
            money: price.toString(),
            sign_type: 'MD5'
          };

          // 生成签名
          const sign = generatePaymentSign(paymentParams, merchantKey);

          // 返回支付参数给前端
          res.json({
            success: false, 
            message: '积分不足，请支付',
            required: price,
            available: req.user.coins || 0,
            payment_required: true,
            payment: {
              order_id: order.id,
              order_no: orderNo,
              payment_url: 'https://zpayz.cn/submit.php',
              payment_params: {
                ...paymentParams,
                sign
              }
            }
          });
        } catch (error) {
          console.error('创建支付订单失败:', error);
          res.status(500).json({ 
            success: false, 
            message: '积分不足，创建支付订单失败',
            required: price,
            available: req.user.coins || 0
          });
        }
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
          (enrichedResource as any).category = category;
        }
        
        // 添加作者信息
        if (resource.author_id) {
          const author = await storage.getAuthor(resource.author_id);
          (enrichedResource as any).author = author;
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
      
      // 检查资源状态，非管理员只能查看已上架资源
      if (resource.status !== 1 && (!req.user || req.user.role !== 'admin')) {
        res.status(403).json({ message: '该资源未上架或已下架' });
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

      // 获取更新前的资源，用于比较
      const originalResource = await storage.getResource(resourceId);
      console.log('原始资源数据:', JSON.stringify(originalResource));
      console.log('请求体:', JSON.stringify(req.body));

      const validationResult = insertResourceSchema.partial().safeParse(req.body);
      if (!validationResult.success) {
        res.status(400).json({ message: '资源数据无效', errors: validationResult.error.format() });
        return;
      }

      console.log('验证后的数据:', JSON.stringify(validationResult.data));

      // Check if category exists if category_id is provided
      if (validationResult.data.category_id) {
        const category = await storage.getCategory(validationResult.data.category_id);
        if (!category) {
          res.status(400).json({ message: '所选分类不存在' });
          return;
        }
      }

      // 进行明确的字段赋值，确保关键字段被更新
      const dataToUpdate = {
        ...validationResult.data,
        title: validationResult.data.title !== undefined ? validationResult.data.title : originalResource?.title,
        subtitle: validationResult.data.subtitle !== undefined ? validationResult.data.subtitle : originalResource?.subtitle,
        category_id: validationResult.data.category_id !== undefined ? validationResult.data.category_id : originalResource?.category_id
      };

      console.log('最终更新数据:', JSON.stringify(dataToUpdate));

      const updatedResource = await storage.updateResource(resourceId, dataToUpdate);
      if (!updatedResource) {
        res.status(404).json({ message: '资源不存在' });
        return;
      }

      // 导入邮件发送模块
      const { sendResourcePublishedEmail } = await import('./email');
      
      // 检查是否从无资源链接变为有资源链接
      const isResourceUrlAdded = req.body.resource_url && 
                               (!originalResource.resource_url || originalResource.resource_url === '');
      
      // 检查是否需要发送邮件通知
      if (isResourceUrlAdded && updatedResource.status === 1) {
        console.log(`资源 ${resourceId} 已上架且新增了下载链接`);
        
        // 检查资源下载链接是否存在
        if (updatedResource.resource_url) {
          console.log(`资源 ${resourceId} 存在下载链接，检查是否需要发送上架通知邮件`);
          
          // 获取与该资源相关的未发送邮件的通知记录
          const { notifications } = await storage.getResourceNotifications(1, 100, resourceId, false);
          
          if (notifications && notifications.length > 0) {
            console.log(`找到 ${notifications.length} 条需要发送上架通知的记录`);
            
            // 对每条通知记录，获取用户邮箱并发送通知邮件
            for (const notification of notifications) {
              const user = await storage.getUser(notification.user_id);
              if (user && user.email) {
                console.log(`正在向用户 ${user.email} 发送资源上架通知邮件`);
                
                // 发送邮件
                const sent = await sendResourcePublishedEmail(
                  user.email, 
                  updatedResource.title, 
                  resourceId
                );
                
                if (sent) {
                  // 更新通知记录的邮件发送状态
                  await storage.updateNotificationEmailStatus(notification.id, true);
                  console.log(`已成功向用户 ${user.email} 发送资源上架通知邮件`);
                } else {
                  console.error(`向用户 ${user.email} 发送资源上架通知邮件失败`);
                }
              } else {
                console.log(`用户 ${notification.user_id} 不存在或没有邮箱信息，跳过发送`);
              }
            }
          } else {
            console.log(`资源 ${resourceId} 没有需要发送通知的记录`);
          }
        }
      }

      console.log('更新后的资源:', JSON.stringify(updatedResource));
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
      
      // 检查资源是否存在
      const resource = await storage.getResource(resourceId);
      if (!resource) {
        res.status(404).json({ message: '资源不存在' });
        return;
      }
      
      // 检查资源是否已被购买
      const canDelete = await canDeleteResource(resourceId);
      if (!canDelete) {
        return res.status(400).json({ 
          message: '无法删除已被购买的资源',
          error: '该资源已被用户购买，删除会影响用户权益，请考虑将其下架而不是删除' 
        });
      }

      const deleted = await storage.deleteResource(resourceId);
      if (!deleted) {
        res.status(500).json({ message: '删除资源失败' });
        return;
      }

      res.status(204).end();
    } catch (error) {
      console.error('Error deleting resource:', error);
      res.status(500).json({ message: '删除资源失败' });
    }
  });

  // 图片上传接口 - 允许已登录用户上传图片
  app.post('/api/upload/image', authenticateUser as any, upload.single('image'), async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user) {
        res.status(401).json({ message: '未登录或会话已过期' });
        return;
      }
      
      // 检查是否有文件上传
      if (!req.file) {
        res.status(400).json({ message: '没有上传文件或文件格式不正确' });
        return;
      }
      
      // 生成可访问的文件路径
      const imageUrl = `/images/${req.file.filename}`;
      const localPath = req.file.path;
      
      // 返回图片URL和本地路径
      res.status(200).json({
        success: true,
        message: '图片上传成功',
        data: {
          image_url: imageUrl,
          local_path: localPath
        }
      });
    } catch (error) {
      console.error('图片上传失败:', error);
      res.status(500).json({ message: '图片上传失败', error: String(error) });
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
          (enrichedResource as any).category = category;
        }
        
        // 添加作者信息
        if (resource.author_id) {
          const author = await storage.getAuthor(resource.author_id);
          (enrichedResource as any).author = author;
        }
        
        return enrichedResource;
      }));

      res.json({ ...result, resources: enrichedResources });
    } catch (error) {
      console.error('Error fetching admin resources:', error);
      res.status(500).json({ message: '获取资源列表失败' });
    }
  });
  
  // 管理员获取单个资源详情
  app.get('/api/admin/resources/:id', authenticateUser as any, authorizeAdmin as any, async (req, res) => {
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
      console.error('Error fetching admin resource:', error);
      res.status(500).json({ message: '获取资源详情失败' });
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
      
      // 获取更新前的资源信息
      const originalResource = await storage.getResource(resourceId);
      if (!originalResource) {
        res.status(404).json({ message: '资源不存在' });
        return;
      }
      
      // 更新资源
      const updatedResource = await storage.updateResource(resourceId, validationResult.data);
      if (!updatedResource) {
        res.status(404).json({ message: '资源不存在' });
        return;
      }
      
      // 导入邮件发送模块
      const { sendResourcePublishedEmail } = await import('./email');
      
      // 检查是否为上架操作（状态从非1变为1）
      const isStatusChangeToPublished = req.body.status === 1 && originalResource.status !== 1;
      
      // 检查是否从无资源链接变为有资源链接
      const isResourceUrlAdded = req.body.resource_url && 
                               (!originalResource.resource_url || originalResource.resource_url === '');
      
      // 检查是否需要发送邮件通知
      if (isStatusChangeToPublished || isResourceUrlAdded) {
        // 记录触发条件
        if (isStatusChangeToPublished) {
          console.log(`资源 ${resourceId} 从下架状态变为上架状态`);
        }
        
        if (isResourceUrlAdded) {
          console.log(`资源 ${resourceId} 新增了下载链接`);
        }
        
        // 检查资源下载链接是否存在
        if (updatedResource.resource_url) {
          console.log(`资源 ${resourceId} 存在下载链接，检查是否需要发送上架通知邮件`);
          
          // 获取与该资源相关的未发送邮件的通知记录
          const { notifications } = await storage.getResourceNotifications(1, 100, resourceId, false);
          
          if (notifications && notifications.length > 0) {
            console.log(`找到 ${notifications.length} 条需要发送上架通知的记录`);
            
            // 对每条通知记录，获取用户邮箱并发送通知邮件
            for (const notification of notifications) {
              const user = await storage.getUser(notification.user_id);
              if (user && user.email) {
                console.log(`正在向用户 ${user.email} 发送资源上架通知邮件`);
                
                // 发送邮件
                const sent = await sendResourcePublishedEmail(
                  user.email, 
                  updatedResource.title, 
                  resourceId
                );
                
                if (sent) {
                  // 更新通知记录的邮件发送状态
                  await storage.updateNotificationEmailStatus(notification.id, true);
                  console.log(`已成功向用户 ${user.email} 发送资源上架通知邮件`);
                } else {
                  console.error(`向用户 ${user.email} 发送资源上架通知邮件失败`);
                }
              } else {
                console.log(`用户 ${notification.user_id} 不存在或没有邮箱信息，跳过发送`);
              }
            }
          } else {
            console.log(`资源 ${resourceId} 没有需要发送通知的记录`);
          }
        } else {
          console.log(`资源 ${resourceId} 没有下载链接，不发送上架通知邮件`);
        }
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
  
  // 管理员获取用户购买记录
  app.get('/api/admin/users/:id/purchases', authenticateUser as any, authorizeAdmin as any, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = parseInt(req.params.id);
      if (isNaN(userId)) {
        res.status(400).json({ message: '无效的用户ID' });
        return;
      }
      
      // 检查用户是否存在
      const user = await storage.getUser(userId);
      if (!user) {
        res.status(404).json({ message: '用户不存在' });
        return;
      }
      
      // 获取用户的购买记录
      const purchases = await storage.getUserPurchases(userId);
      
      // 丰富购买记录数据，添加资源信息
      const enrichedPurchases = await Promise.all(purchases.map(async (purchase) => {
        const resource = await storage.getResource(purchase.resource_id);
        return {
          ...purchase,
          resource: resource || { title: '资源已删除', cover_image: null }
        };
      }));
      
      res.json(enrichedPurchases);
    } catch (error) {
      console.error('Error getting user purchases:', error);
      res.status(500).json({ message: '获取用户购买记录失败' });
    }
  });
  
  // 管理员删除用户购买记录
  app.delete('/api/admin/purchases/:id', authenticateUser as any, authorizeAdmin as any, async (req: AuthenticatedRequest, res) => {
    try {
      const purchaseId = parseInt(req.params.id);
      if (isNaN(purchaseId)) {
        res.status(400).json({ message: '无效的购买记录ID' });
        return;
      }
      
      // 删除购买记录
      const success = await storage.deleteUserPurchase(purchaseId);
      
      if (success) {
        res.status(200).json({ message: '购买记录已成功删除' });
      } else {
        res.status(404).json({ message: '购买记录不存在或已被删除' });
      }
    } catch (error) {
      console.error('Error deleting user purchase:', error);
      res.status(500).json({ message: '删除购买记录失败' });
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
      const allowedFields = ['membership_type', 'coins', 'email', 'avatar', 'account_locked_until'];
      const updateData: any = {};
      
      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          // 特殊处理account_locked_until字段
          if (field === 'account_locked_until' && req.body[field]) {
            // 将日期字符串转换为Date对象
            try {
              const lockDate = new Date(req.body[field]);
              if (!isNaN(lockDate.getTime())) {
                updateData[field] = lockDate;
              }
            } catch (err) {
              console.error('Invalid account_locked_until value:', req.body[field]);
              // 如果转换失败，不更新该字段
            }
          } else {
            updateData[field] = req.body[field];
          }
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

  // 管理员删除用户
  app.delete('/api/admin/users/:id', authenticateUser as any, authorizeAdmin as any, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = parseInt(req.params.id);
      if (isNaN(userId)) {
        res.status(400).json({ message: '无效的用户ID' });
        return;
      }
      
      // 检查用户是否存在
      const user = await storage.getUser(userId);
      if (!user) {
        res.status(404).json({ message: '用户不存在' });
        return;
      }
      
      // 不允许删除管理员用户
      if (user.membership_type === 'admin') {
        res.status(403).json({ message: '不能删除管理员用户' });
        return;
      }
      
      // 不允许删除自己
      if (userId === req.user.id) {
        res.status(403).json({ message: '不能删除自己的账户' });
        return;
      }
      
      // 删除用户（会级联删除相关记录）
      const success = await storage.deleteUser(userId);
      if (success) {
        res.status(200).json({ message: '会员及其相关数据已成功删除' });
      } else {
        res.status(500).json({ message: '删除用户失败' });
      }
    } catch (error) {
      console.error('Error deleting user:', error);
      res.status(500).json({ message: '删除用户时发生错误' });
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
  
  // 解析分类下所有资源的详细页面
  // 批量上架分类下所有资源到资源库
  app.post('/api/feifei-categories/:id/batch-add-to-resources', authenticateUser as any, authorizeAdmin as any, async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user) {
        res.status(401).json({ message: '未登录或会话已过期' });
        return;
      }
      
      const categoryId = parseInt(req.params.id);
      if (isNaN(categoryId)) {
        res.status(400).json({ message: '无效的分类ID' });
        return;
      }
      
      // 先检查分类是否存在
      const categoryResult = await storage.getFeifeiCategory(categoryId);
      if (!categoryResult) {
        res.status(404).json({ message: '分类不存在' });
        return;
      }
      
      // 立即回应客户端，表示任务已开始
      res.json({ message: `已启动对分类"${categoryResult.title}"下所有资源的批量上架任务，请查看控制台日志了解进度` });
      
      console.log(`=== 开始批量上架分类"${categoryResult.title}"下所有资源 ===`);
      
      // 1. 获取分类下所有资源的总数
      const countResult = await storage.getFeifeiResourcesByCategory(categoryId, 1, 1);
      const totalResources = countResult.total;
      console.log(`分类 ${categoryResult.title} 下共有 ${totalResources} 个资源`);
      
      // 计算需要的分页数
      const pageSize = 100; // 每页获取100条记录
      const totalPages = Math.ceil(totalResources / pageSize);
      console.log(`将分 ${totalPages} 页处理，每页 ${pageSize} 条记录`);
      
      // 批量处理统计数据
      let successCount = 0;
      let skipCount = 0;
      let failureCount = 0;
      const startTime = new Date();
      
      // 2. 循环处理每一页
      for (let page = 1; page <= totalPages; page++) {
        console.log(`正在处理第 ${page}/${totalPages} 页...`);
        
        // 获取当前页的资源
        const pageResult = await storage.getFeifeiResourcesByCategory(categoryId, page, pageSize);
        const resources = pageResult.resources;
        
        // 处理当前页的每个资源
        for (let i = 0; i < resources.length; i++) {
          const resource = resources[i];
          const resourceIndex = (page - 1) * pageSize + i + 1;
          
          console.log(`[${resourceIndex}/${totalResources}] 处理资源: ${resource.chinese_title}`);
          
          try {
            // 检查资源是否已经上架
            if (resource.linked_resource_id) {
              console.log(`  - 跳过: 资源已经上架到资源库，关联资源ID=${resource.linked_resource_id}`);
              skipCount++;
              continue;
            }
            
            // 使用公共函数上架资源
            const result = await addFeifeiResourceToResourceLibrary(resource.id);
            
            if (result.success) {
              console.log(`  - 成功: ${result.message}`);
              successCount++;
            } else {
              console.log(`  - 失败: ${result.message}`);
              failureCount++;
            }
            
            // 每处理10个资源暂停1秒，避免请求过快
            if (i > 0 && i % 10 === 0) {
              console.log(`已处理 ${i} 个资源，暂停1秒...`);
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          } catch (error) {
            console.error(`  - 错误: 处理资源时发生异常:`, error);
            failureCount++;
          }
        }
        
        console.log(`完成第 ${page}/${totalPages} 页处理`);
      }
      
      const endTime = new Date();
      const totalTime = (endTime.getTime() - startTime.getTime()) / 1000; // 总耗时（秒）
      const avgTime = totalTime / (successCount + failureCount); // 平均每个资源处理时间（秒）
      
      console.log(`=== 批量上架任务完成 ===`);
      console.log(`总资源数: ${totalResources}`);
      console.log(`成功上架: ${successCount}`);
      console.log(`已跳过(已上架): ${skipCount}`);
      console.log(`失败: ${failureCount}`);
      console.log(`总耗时: ${totalTime.toFixed(2)}秒`);
      console.log(`平均每个资源耗时: ${avgTime.toFixed(2)}秒`);
      
    } catch (error) {
      console.error('批量上架资源时出错:', error);
      // 客户端已经收到了响应，这里只需记录错误
    }
  });

  app.post('/api/feifei-categories/:id/parse-all-resources', authenticateUser as any, authorizeAdmin as any, async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user) {
        res.status(401).json({ message: '未登录或会话已过期' });
        return;
      }
      
      const categoryId = parseInt(req.params.id);
      if (isNaN(categoryId)) {
        res.status(400).json({ message: '无效的分类ID' });
        return;
      }
      
      // 先检查分类是否存在
      const categoryResult = await storage.getFeifeiCategory(categoryId);
      if (!categoryResult) {
        res.status(404).json({ message: '分类不存在' });
        return;
      }
      
      // 立即回应客户端，表示任务已开始
      res.json({ message: `已启动对分类"${categoryResult.title}"下所有资源的解析任务，请查看控制台日志了解进度` });
      
      console.log(`=== 开始解析分类"${categoryResult.title}"下所有资源 ===`);
      
      // 1. 获取分类下所有资源的总数
      const countResult = await storage.getFeifeiResourcesByCategory(categoryId, 1, 1);
      const totalResources = countResult.total;
      console.log(`分类 ${categoryResult.title} 下共有 ${totalResources} 个资源`);
      
      // 计算需要的分页数
      const pageSize = 100; // 每页获取100条记录
      const totalPages = Math.ceil(totalResources / pageSize);
      console.log(`将分 ${totalPages} 页处理，每页 ${pageSize} 条记录`);
      
      // 2. 直接分页处理，避免一次性加载所有资源导致内存问题
      let parsedCount = 0;
      let errorCount = 0;
      
      // 解析开始时间
      const batchStartTime = Date.now();
      let totalProcessedCount = 0;
      
      // 按页处理资源
      for (let currentPage = 1; currentPage <= totalPages; currentPage++) {
        console.log(`正在获取并处理第 ${currentPage}/${totalPages} 页资源...`);
        const pageResult = await storage.getFeifeiResourcesByCategory(categoryId, currentPage, pageSize);
        const pageResources = pageResult.resources;
        console.log(`本页获取到 ${pageResources.length} 个资源，准备解析`);
        
        // 处理当前页的资源
        for (let i = 0; i < pageResources.length; i++) {
          const resource = pageResources[i];
          const resourceTitle = resource.chinese_title || `资源ID: ${resource.id}`;
          const itemStartTime = Date.now();
          totalProcessedCount++;
          
          console.log(`[${totalProcessedCount}/${totalResources}] 正在解析资源: ${resourceTitle} (URL: ${resource.url})`);
          
          try {
            // 调用共用函数解析资源页面
            const parseResult = await parseFeifeiResourcePage(resource.id, true);
            if (parseResult.success) {
              parsedCount++;
              const itemDuration = ((Date.now() - itemStartTime) / 1000).toFixed(2);
              console.log(`  ✓ 解析成功 (耗时: ${itemDuration}秒): ${parseResult.message}`);
            } else {
              errorCount++;
              console.log(`  ✗ 解析失败: ${parseResult.message}`);
            }
          } catch (error) {
            errorCount++;
            console.error(`  ✗ 解析出错:`, error instanceof Error ? error.message : String(error));
          }
          
          // 每处理10个资源暂停1秒，避免请求过快
          if ((totalProcessedCount % 10 === 0) && (totalProcessedCount < totalResources)) {
            const batchDuration = ((Date.now() - batchStartTime) / 1000);
            const batchDurationStr = batchDuration.toFixed(2);
            const avgDuration = (batchDuration / totalProcessedCount);
            const avgDurationStr = avgDuration.toFixed(2);
            const remaining = totalResources - totalProcessedCount;
            const estRemainingMinutes = (avgDuration * remaining / 60);
            const estRemainingStr = estRemainingMinutes.toFixed(1);
            
            console.log(`  -- 已处理 ${totalProcessedCount}/${totalResources} 个资源 (${batchDurationStr}秒, 平均${avgDurationStr}秒/项) --`);
            console.log(`  -- 剩余 ${remaining} 项, 预计还需 ${estRemainingStr} 分钟 --`);
            console.log(`  -- 暂停1秒... --`);
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
        
        // 每处理完一页，打印进度
        console.log(`完成处理第 ${currentPage}/${totalPages} 页，当前总进度: ${totalProcessedCount}/${totalResources}`);
      }
      

      
      // 总结果
      const totalDuration = ((Date.now() - batchStartTime) / 1000);
      const totalDurationStr = totalDuration.toFixed(2);
      const avgItemDuration = totalProcessedCount > 0 ? (totalDuration / totalProcessedCount) : 0;
      const avgItemDurationStr = avgItemDuration.toFixed(2);
      
      console.log(`=== 分类"${categoryResult.title}"下所有资源解析完成 ===`);
      console.log(`成功: ${parsedCount}, 失败: ${errorCount}, 总计: ${totalProcessedCount}`);
      console.log(`总用时: ${totalDurationStr}秒, 平均每项: ${avgItemDurationStr}秒`);
    } catch (error) {
      console.error('Error parsing all resources in category:', error);
      // 由于我们已经向客户端返回了响应，这里的错误只记录，不再发送
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

  // 获取单个系统参数（公开接口）
  app.get('/api/public-parameter/:key', async (req, res) => {
    try {
      const { key } = req.params;
      if (!key) {
        return res.status(400).json({ message: '参数键是必须的' });
      }
      
      const parameter = await storage.getParameterByKey(key);
      if (!parameter) {
        return res.status(404).json({ message: '参数不存在' });
      }
      
      res.json({
        key: parameter.key,
        value: parameter.value
      });
    } catch (error) {
      console.error('Error getting public parameter:', error);
      res.status(500).json({ message: '获取参数失败' });
    }
  });

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
      
      // 检查是否为Udemy课程
      const isUdemyCourse = (resource.preview_url && 
                            (resource.preview_url.includes('www.udemy.com') || 
                             resource.preview_url.includes('udemy.com'))) ||
                            (resource.url && 
                            (resource.url.includes('www.udemy.com') || 
                             resource.url.includes('udemy.com')));
      
      if (!isUdemyCourse) {
        return res.status(400).json({ 
          message: '当前解析功能仅支持Udemy课程，请确认预览链接或资源URL包含udemy.com' 
        });
      }

      // 从参数表获取智谱AI配置
      const apiKeyParam = await storage.getParameterByKey('ZHIPU_API');
      const modelParam = await storage.getParameterByKey('ZHIPU_MODEL');
      const baseUrlParam = await storage.getParameterByKey('ZHIPU_BASE_URL');

      if (!apiKeyParam || !apiKeyParam.value) {
        return res.status(400).json({ message: '缺少智谱AI API密钥配置，请在系统参数中设置ZHIPU_API参数' });
      }

      const apiKey = apiKeyParam.value;
      const model = modelParam?.value || 'glm-4'; // 默认使用glm-4，支持多次输出
      const baseUrl = baseUrlParam?.value || 'https://open.bigmodel.cn/api/paas/v4';

      // 配置OpenAI客户端（兼容智谱AI）
      console.log('智谱AI配置:', { 
        apiKey: '(已隐藏)', 
        baseURL: baseUrl, 
        model: model 
      });
      
      // 使用完整的智谱AI API URL
      const openai = new OpenAI({
        apiKey: apiKey,
        baseURL: baseUrl
      });

      // 提取HTML内容中的关键部分，减少数据量
      let reducedHtml = resource.course_html;
      // 尝试提取课程内容部分，如果HTML过大则只取部分内容
      if (reducedHtml.length > 20000) {
        // 特别针对课程大纲的常见HTML结构进行提取
        // 首先尝试提取课程章节的特定结构
        // 这里我们直接针对提供的class名进行精确匹配
        let allPanels = [];
        // 尝试匹配所有的accordion-panel-module--panel元素
        const panelRegex = /<div[^>]*?class="[^"]*accordion-panel-module--panel--Eb0it[^"]*"[^>]*>[\s\S]*?<\/div>/gi;
        let panelMatch;
        while ((panelMatch = panelRegex.exec(reducedHtml)) !== null) {
          allPanels.push(panelMatch[0]);
        }
        
        // 如果找到了panel元素，将它们合并
        let accordionMatch = allPanels.length > 0 ? allPanels : (
          reducedHtml.match(/<div[^>]*class="[^"]*accordion-panel[^"]*"[^>]*>[\s\S]*?<\/div>/i) ||
          reducedHtml.match(/<div[^>]*class="[^"]*section--panel[^"]*"[^>]*>[\s\S]*?<\/div>/i) ||
          reducedHtml.match(/<div[^>]*?class="[^"]*accordion-panel-module--panel[^"]*"[^>]*>[\s\S]*?<\/div>/gi)
        );
        
        // 如果找到特定的章节结构
        if (accordionMatch) {
          if (Array.isArray(accordionMatch)) {
            // 如果匹配了多个章节元素，将它们合并
            reducedHtml = accordionMatch.join('\n');
          } else {
            reducedHtml = accordionMatch[0];
          }
          console.log(`提取了课程章节结构，长度从${resource.course_html.length}减少到${reducedHtml.length}`);
        } else {
          // 退回到常规提取方法：提取表格或列表元素
          let contentMatch = reducedHtml.match(/<table[^>]*>[\s\S]*?<\/table>/i) || 
                            reducedHtml.match(/<ul[^>]*>[\s\S]*?<\/ul>/i) || 
                            reducedHtml.match(/<ol[^>]*>[\s\S]*?<\/ol>/i) ||
                            reducedHtml.match(/<div[^>]*class="[^"]*content[^"]*"[^>]*>[\s\S]*?<\/div>/i);
          
          if (contentMatch) {
            reducedHtml = contentMatch[0];
            console.log(`提取了可能包含课程结构的HTML部分，长度从${resource.course_html.length}减少到${reducedHtml.length}`);
          } else {
            // 如果找不到特定元素，取前20000个字符
            reducedHtml = reducedHtml.substring(0, 20000);
            console.log(`无法找到结构化内容，截取了前20000个字符用于分析`);
          }
        }
      }

      // 使用多次输出的方式构建JSON
      // 第一次：分析课程结构并获取章节列表
      const extractChaptersPrompt = `
      我需要你从以下HTML代码中分析课程大纲的章节结构。

      HTML代码片段：
      ${reducedHtml}

      请仔细分析HTML并提取所有主要章节的信息，返回一个JSON对象，格式如下：
      {
        "章节": [
          {
            "标题": "Introduction", // 保留原始英文标题
            "时长": "6个讲座・25 分钟" // 格式应该类似"X个讲座・XX 分钟"
          },
          ...更多章节
        ]
      }

      参考：在课程大纲中，主章节格式通常如下所示：
      - "Introduction" - "6个讲座・25 分钟"
      - "URL Works" - "5个讲座・19 分钟"
      - "Less" - "6个讲座・15 分钟"
      - "Layout and resources" - "8个讲座・33 分钟"
      - "Debug Layout" - "4个讲座・16 分钟"
      - "About themes" - "3个讲座・12 分钟"
      - "From PSD to Magento 2" - "5个讲座・41 分钟"

      专门技术说明：
      我们处理的网页使用了特殊的HTML结构，主章节通常包含在带有特定类名的div元素中：
      - 章节外层容器通常有类似"accordion-panel-module--panel--Eb0it"或"section--panel--qYPjj"这样的类名
      - 章节标题通常在具有箭头图标的可点击元素中
      
      重要说明：
      1. 特别注意以下特定的章节识别方式：
         - 查找带有特定类名的<div>元素，如"accordion-panel-module--panel--Eb0it"和"section--panel--qYPjj"
         - 查找这些div内部的标题元素，通常包含章节名称
         - 不要遗漏任何折叠的章节（特别是前7个章节）
      2. 保留原始英文章节标题，不要翻译成中文
      3. 时长格式应该是"X个讲座・XX 分钟"，即讲座数量和总时长
      4. 使用中文字段名（"章节"、"标题"、"时长"）
      5. 极其重要：根据提供的HTML，应该能识别出7个主要章节，请务必全部提取出来

      确保返回的JSON是有效的，并涵盖课程中的所有章节。页面顶部通常会显示总共有多少个章节（例如"7个章节"），请确保你的提取结果与此匹配。
      `;

      console.log('第1步：调用智谱AI提取课程章节...');
      
      try {
        // 第一次调用：提取章节列表
        const chaptersCompletion = await openai.chat.completions.create({
          model: model,
          messages: [
            { role: 'system', content: '你是一个专业的HTML解析助手，擅长提取网页中的课程大纲信息。你只返回JSON格式的数据，不添加任何其他解释文字。' },
            { role: 'user', content: extractChaptersPrompt }
          ],
          temperature: 0.1,
          response_format: { type: "json_object" } // 明确要求JSON格式回复
        });

        // 提取章节内容
        const chaptersContent = chaptersCompletion.choices[0]?.message?.content || '';
        console.log('章节提取结果:', chaptersContent);
        
        // 解析章节数据
        let chaptersData;
        try {
          // 清理内容以确保是有效的JSON
          const cleanedChaptersContent = chaptersContent.replace(/```json|```/g, '').trim();
          chaptersData = JSON.parse(cleanedChaptersContent);
          console.log('成功解析章节数据，获取到', chaptersData.章节?.length || 0, '个章节');
        } catch (parseError) {
          console.error('解析章节数据失败:', parseError);
          throw new Error('无法解析章节数据');
        }
        
        // 检查章节列表是否有效
        if (!chaptersData.章节 || !Array.isArray(chaptersData.章节) || chaptersData.章节.length === 0) {
          throw new Error('无法从HTML中提取到有效的章节列表');
        }
        
        // 第二步：获取每个章节的详细讲座信息
        const fullOutlineData: {
          章节: Array<{
            标题: string;
            时长: string;
            讲座: Array<{
              标题: string;
              时长: string;
            }>;
          }>;
        } = {
          章节: []
        };
        
        console.log('第2步：逐个获取章节下的讲座列表...');
        
        // 检查章节结构并重新组织
        // 这段代码将尝试清理章节结构，消除可能的重复和子章节错误分类
        let chapterPrefix = '';
        let mainChapters: Array<{
          标题: string;
          时长: string;
          讲座: Array<{
            标题: string;
            时长: string;
          }>;
        }> = [];
        
        // 首先检测章节编号模式（例如"1."，"第1章"等）
        for (const chapter of chaptersData.章节) {
          const title = chapter.标题;
          const match = title.match(/^(\d+[\.\:、]|第\d+章|Chapter\s+\d+)/i);
          if (match) {
            chapterPrefix = match[1];
            break;
          }
        }
        
        // 根据章节前缀重新组织章节
        // 如果标题以数字开头，可能是主章节
        for (const chapter of chaptersData.章节) {
          const title = chapter.标题;
          // 将所有章节视为主章节
          mainChapters.push({
            ...chapter,
            讲座: [] // 初始化为空数组，后面会填充
          });
        }
        
        // 如果未检测到任何章节，使用原始的章节数据
        if (mainChapters.length === 0) {
          console.log('未检测到任何主章节，使用原始章节数据...');
          mainChapters = chaptersData.章节.map((chapter: {标题: string; 时长?: string}) => ({
            标题: chapter.标题,
            时长: chapter.时长 || "未知",
            讲座: []
          }));
        }
        
        console.log(`检测到${mainChapters.length}个主章节`);
        
        // 为每个主章节获取讲座信息
        for (let i = 0; i < mainChapters.length; i++) {
          const chapter = mainChapters[i];
          console.log(`处理第${i + 1}章:`, chapter.标题);
          
          const lecturesPrompt = `
          我需要你从HTML内容中准确提取"${chapter.标题}"章节下的所有讲座信息。
          
          请确保:
          1. 只返回直接属于"${chapter.标题}"章节的讲座
          2. 不要包含其他章节的讲座
          3. 讲座应按照在HTML中出现的顺序排列
          4. 每个讲座只出现一次

          HTML代码片段：
          ${reducedHtml}

          请返回该章节下所有讲座的信息，并按以下JSON格式严格返回：
          {
            "讲座": [
              {
                "标题": "1.1 Theme Files",
                "时长": "07:44"
              },
              {
                "标题": "1.2 URL Images",
                "时长": "03:36"
              }
            ]
          }

          参考：根据提供的截图，讲座格式具体如下：
          如果章节是"Introduction"，其下的讲座可能是：
          - "1.1 Theme Files" - "07:44"
          - "1.2 URL Images" - "03:36"
          - "1.3 URL Static Files" - "03:48"
          - "1.4 URL Cover" - "05:07"
          - "1.5 Uninstall Theme" - "03:33"
          
          如果章节是"URL Works"，其下的讲座可能是：
          - "2.1 Modifications with LESS" - "06:43"
          - "2.2 Compiled Static" - "05:30"
          - "2.3 URL Developer Tools" - "03:57"
          - "2.4 Exercise" - "00:35"

          注意事项:
          1. 保留原始英文讲座标题
          2. 保留讲座编号，编号格式应为"章节序号.讲座序号"，例如"1.1"、"2.3"等
          3. 时长格式应为"分钟:秒"，使用两位数表示，例如"07:44"而非"7:44"
          4. 不要在JSON中添加任何注释或额外字符，确保输出是有效的JSON格式
          5. 如果找不到讲座信息，请返回 {"讲座": []}
          6. 不要使用注释符号(//)或多行注释(/* */)
          7. 请不要添加任何额外的字段
          `;
          
          try {
            // 为当前章节获取讲座信息
            const lecturesCompletion = await openai.chat.completions.create({
              model: model,
              messages: [
                { role: 'system', content: '你是一个专业的HTML解析助手，擅长提取课程章节中的讲座信息。你只返回JSON格式的数据，不添加任何解释文字。' },
                { role: 'user', content: lecturesPrompt }
              ],
              temperature: 0.1,
              response_format: { type: "json_object" }
            });
            
            // 提取讲座内容
            const lecturesContent = lecturesCompletion.choices[0]?.message?.content || '';
            console.log(`章节"${chapter.标题}"的讲座提取结果:`, lecturesContent);
            
            // 解析讲座数据
            let lecturesData;
            try {
              // 更严格地清理内容，移除所有可能的注释和无效字符
              let cleanedLecturesContent = lecturesContent.replace(/```json|```/g, '').trim();
              
              // 移除JSON中的所有注释 (// 或 /* */)
              cleanedLecturesContent = cleanedLecturesContent
                .replace(/\/\/.*?(\r\n|\n|$)/g, '') // 移除单行注释
                .replace(/\/\*[\s\S]*?\*\//g, '');  // 移除多行注释
              
              // 尝试解析JSON
              try {
                lecturesData = JSON.parse(cleanedLecturesContent);
              } catch (initialParseError) {
                // 如果失败，尝试更激进的清理
                console.log(`初次解析"${chapter.标题}"的讲座数据失败，尝试更深度的清理`);
                
                // 尝试找到并提取有效的JSON对象部分
                const jsonMatch = cleanedLecturesContent.match(/\{\s*"讲座"\s*:\s*\[[\s\S]*?\]\s*\}/);
                if (jsonMatch) {
                  try {
                    lecturesData = JSON.parse(jsonMatch[0]);
                  } catch (extractError) {
                    throw new Error(`提取JSON对象失败: ${extractError.message}`);
                  }
                } else {
                  throw new Error('无法找到有效的JSON结构');
                }
              }
            } catch (parseError) {
              console.error(`解析"${chapter.标题}"的讲座数据失败:`, parseError);
              console.log('原始内容:', lecturesContent);
              // 创建一个空的讲座列表
              lecturesData = { 讲座: [] };
            }
            
            // 将章节和讲座信息整合到最终结果中
            fullOutlineData.章节.push({
              标题: chapter.标题,
              时长: chapter.时长 || "未知",
              讲座: lecturesData.讲座 || []
            });
            
          } catch (chapterError) {
            console.error(`获取"${chapter.标题}"讲座信息失败:`, chapterError);
            // 即使失败，仍然添加带有空讲座列表的章节
            fullOutlineData.章节.push({
              标题: chapter.标题,
              时长: chapter.时长 || "未知",
              讲座: []
            });
          }
        }
        
        // 将完整的课程大纲转换为JSON字符串
        const finalJsonStr = JSON.stringify(fullOutlineData, null, 2);
        console.log('最终课程大纲结构:', finalJsonStr);
        
        // 第3步：将提取的内容翻译成中文
        console.log('第3步：翻译提取的内容...');
        
        // 由于内容可能很长，需要分章节翻译
        const translatedOutline: {
          章节: Array<{
            标题: string;
            时长: string;
            讲座: Array<{
              标题: string;
              时长: string;
            }>;
          }>;
        } = {
          章节: []
        };
        
        // 为每个章节进行翻译
        for (let i = 0; i < fullOutlineData.章节.length; i++) {
          const chapter = fullOutlineData.章节[i];
          console.log(`翻译第${i + 1}章:`, chapter.标题);
          
          // 每次翻译一个章节及其讲座
          const chapterToTranslate = {
            章节: [chapter]
          };
          
          const translatePrompt = `
          请将以下JSON数据中的所有英文内容翻译成中文。请保持JSON结构不变，只翻译值。
          
          原始JSON数据：
          ${JSON.stringify(chapterToTranslate, null, 2)}
          
          翻译规则：
          1. 所有英文标题必须翻译成中文，但保留原始编号和格式
          2. "时长"字段保持原样不变
          3. 如果讲座标题有编号（如"1.1"），请保留编号
          4. 只返回翻译后的JSON数据，不要有任何额外文字说明
          5. 确保返回的是有效的JSON结构
          
          例如：
          - "Introduction" -> "介绍"
          - "Theme Files" -> "主题文件"
          - "URL Images" -> "URL图像"
          - "1.1 Getting Started" -> "1.1 入门指南"
          
          注意事项：
          1. 不要翻译专有名词，如"URL"、"CSS"、"HTML"等
          2. 保留讲座编号，确保不会丢失章节结构
          3. 确保只翻译标题内容，其他字段（如"时长"）不要改变
          `;
          
          try {
            // 为当前章节获取翻译
            const translationCompletion = await openai.chat.completions.create({
              model: model,
              messages: [
                { role: 'system', content: '你是一个专业的英汉翻译助手。你的任务是将所有英文内容准确地翻译成中文，同时保持JSON结构的完整性。' },
                { role: 'user', content: translatePrompt }
              ],
              temperature: 0.1,
              response_format: { type: "json_object" }
            });
            
            // 提取翻译内容
            const translationContent = translationCompletion.choices[0]?.message?.content || '';
            console.log(`章节"${chapter.标题}"的翻译结果:`, translationContent);
            
            // 解析翻译数据
            try {
              const cleanedTranslation = translationContent.replace(/```json|```/g, '').trim();
              const translationData = JSON.parse(cleanedTranslation);
              
              // 将翻译后的章节添加到最终结果
              if (translationData.章节 && translationData.章节[0]) {
                translatedOutline.章节.push(translationData.章节[0]);
              } else {
                // 翻译失败，使用原始章节
                console.log(`章节"${chapter.标题}"翻译结构无效，使用原始数据`);
                translatedOutline.章节.push(chapter);
              }
            } catch (parseError) {
              console.error(`解析章节"${chapter.标题}"的翻译失败:`, parseError);
              // 翻译失败，添加原始章节
              translatedOutline.章节.push(chapter);
            }
          } catch (translationError) {
            console.error(`翻译章节"${chapter.标题}"失败:`, translationError);
            // 翻译失败，添加原始章节
            translatedOutline.章节.push(chapter);
          }
        }
        
        // 将翻译后的课程大纲转换为JSON字符串
        const translatedJsonStr = JSON.stringify(translatedOutline, null, 2);
        console.log('翻译后的课程大纲结构:', translatedJsonStr);
        
        // 保存解析结果到数据库
        console.log('保存解析结果到数据库...');
        const updateResult = await storage.updateFeifeiResource(resourceId, {
          parsed_content: translatedJsonStr
        });
        
        // 获取更新后的资源
        const updatedResource = await storage.getFeifeiResource(resourceId);
        
        // 获取资源关联的标签
        const tags = await storage.getFeifeiResourceTags(resourceId);
        
        // 返回增强的资源对象以及解析结果
        const enrichedResource = {
          ...updatedResource,
          tags: tags
        };
        
        return res.status(200).json({ 
          message: '课程大纲提取并翻译成功', 
          resource: enrichedResource 
        });
        
      } catch (aiError) {
        console.error('使用智谱AI提取大纲失败:', aiError);
        
        // 备用方案：使用单次调用方式尝试提取
        try {
          console.log('尝试使用备用方案（单次调用）提取大纲...');
          
          const backupPrompt = `
          我需要你从HTML内容中提取课程大纲信息，以JSON格式返回。

          HTML代码片段：
          ${reducedHtml}

          请仔细分析HTML，提取所有主要章节及其子讲座的完整结构，返回按照以下格式的JSON数据：
          {
            "章节": [
              {
                "标题": "Introduction", // 主章节，保留原始英文标题
                "时长": "6个讲座・25 分钟", // 格式应该类似"X个讲座・XX 分钟"
                "讲座": [
                  {
                    "标题": "1.1 Theme Files", // 子讲座，保留编号和原始英文标题
                    "时长": "07:44" // 格式为分钟:秒
                  },
                  {
                    "标题": "1.2 URL Images",
                    "时长": "03:36"
                  }
                ]
              },
              {
                "标题": "URL Works", // 另一个主章节
                "时长": "5个讲座・19 分钟",
                "讲座": [
                  {
                    "标题": "2.1 Modifications with LESS",
                    "时长": "06:43"
                  }
                ]
              }
            ]
          }

          专门技术说明：
          我们处理的网页使用了特殊的HTML结构，主章节通常包含在带有特定类名的div元素中：
          - 章节外层容器通常有类似"accordion-panel-module--panel--Eb0it"或"section--panel--qYPjj"这样的类名
          - 章节标题通常在具有箭头图标的可点击元素中

          重要说明：
          1. 特别注意这些章节识别方式：
             - 查找带有特定类名的<div>元素，如"accordion-panel-module--panel--Eb0it"和"section--panel--qYPjj"
             - 查找上面提到的div内部的标题元素（通常是h2或h3元素）
             - 查找页面顶部总章节数的信息，例如"7个章节"
             - 确保提取所有可折叠的章节，不要只提取默认展开的部分

          2. 章节编号关系：
             - 检查页面顶部是否有类似"7个章节"的文本
             - 确保提取的章节数量与页面声明的章节数量一致
             - 子讲座编号格式通常为"章节序号.讲座序号"，例如1.1、2.3等
          
          3. 保留原始英文标题，不要翻译
          
          4. 格式说明：
             - 主章节时长: "X个讲座・XX 分钟"
             - 子讲座时长: 分钟:秒格式，如"07:44"或"03:36"
             
          5. 特别重要：根据示例，应该能够识别出全部7个章节，而不是只有2个章节
          
          6. 只返回JSON格式的数据，不要包含其他任何解释
          `;
          
          const backupCompletion = await openai.chat.completions.create({
            model: model,
            messages: [
              { role: 'system', content: '你是一个专业的HTML解析助手，擅长提取课程大纲信息并以JSON格式返回。' },
              { role: 'user', content: backupPrompt }
            ],
            temperature: 0.1,
            response_format: { type: "json_object" }
          });
          
          const backupContent = backupCompletion.choices[0]?.message?.content || '';
          
          // 解析返回的JSON
          let backupData;
          try {
            const cleanedContent = backupContent.replace(/```json|```/g, '').trim();
            backupData = JSON.parse(cleanedContent);
            
            // 保存备用方案结果到数据库
            await storage.updateFeifeiResource(resourceId, {
              parsed_content: JSON.stringify(backupData, null, 2)
            });
            
            return res.status(200).json({
              message: '通过备用方案成功提取课程大纲',
              resource: {
                ...await storage.getFeifeiResource(resourceId),
                tags: await storage.getFeifeiResourceTags(resourceId)
              }
            });
            
          } catch (backupParseError) {
            console.error('解析备用方案返回的JSON失败:', backupParseError);
            throw new Error('备用提取方案也失败了');
          }
          
        } catch (backupError) {
          console.error('备用提取方案失败:', backupError);
          
          // 最终备用方案：创建一个基本结构
          const fallbackData = {
            "章节": [
              {
                "标题": "无法自动提取课程大纲",
                "时长": "未知",
                "讲座": [
                  {
                    "标题": "请手动编辑课程内容",
                    "时长": "00:00"
                  }
                ]
              }
            ]
          };
          
          // 保存基本结构到数据库
          await storage.updateFeifeiResource(resourceId, {
            parsed_content: JSON.stringify(fallbackData, null, 2)
          });
          
          return res.status(200).json({ 
            message: '无法通过AI提取课程大纲，已创建基本结构', 
            resource: await storage.getFeifeiResource(resourceId) 
          });
        }
      }
      
    } catch (error) {
      console.error('提取课程大纲时出错:', error);
      return res.status(500).json({ message: '服务器错误', error: (error as Error).message });
    }
  });
  
  // 修复资源描述中的Markdown格式
  app.post('/api/admin/fix-markdown', authenticateUser as any, authorizeAdmin as any, async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user) {
        res.status(401).json({ message: '未登录或会话已过期' });
        return;
      }
      
      // 导入修复脚本
      const { fixResourceDescriptions } = await import('./fix-markdown');
      
      // 执行修复
      const result = await fixResourceDescriptions();
      
      if (result.success) {
        res.status(200).json({ 
          message: result.message,
          count: result.count
        });
      } else {
        res.status(500).json({ 
          message: '修复过程中出错',
          error: result.message
        });
      }
    } catch (error) {
      console.error('运行修复脚本时出错:', error);
      res.status(500).json({ 
        message: '修复过程中出错',
        error: error instanceof Error ? error.message : String(error)
      });
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
    
    // 导入文件系统模块
    const path = (await import('path')).default;  
    const fs = (await import('fs')).promises;
    
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
      
      // 保存图片到本地
      let localImagePath = null;
      if (imgUrl) {
        try {
          // 创建唯一的文件名，使用资源ID和时间戳
          const fileExtension = path.extname(new URL(imgUrl).pathname) || '.jpg';
          const fileName = `feifei_${resourceId}_${Date.now()}${fileExtension}`;
          const imagePath = path.join('public', 'images', fileName);
          
          if (isLogVerbose) console.log(`下载图片: ${imgUrl} 到本地: ${imagePath}`);
          
          // 下载图片
          const imageResponse = await axios.get(imgUrl, { responseType: 'arraybuffer' });
          
          // 保存图片到本地
          await fs.writeFile(imagePath, Buffer.from(imageResponse.data));
          
          // 设置相对路径用于数据库存储
          localImagePath = `/images/${fileName}`;
          
          if (isLogVerbose) console.log(`图片已保存到本地: ${localImagePath}`);
        } catch (imgError) {
          console.error('下载或保存图片时出错:', imgError);
          if (isLogVerbose) console.log(`无法保存图片: ${imgUrl}`);
        }
      } else {
        if (isLogVerbose) console.log('未找到图片URL，跳过图片下载');
      }
      
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
        ...(localImagePath && { local_image_path: localImagePath }),
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
  
  // 智谱AI将HTML转换为Markdown格式的API
  app.post('/api/feifei-resources/:id/html-to-markdown', authenticateUser as any, authorizeAdmin as any, async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user) {
        res.status(401).json({ message: '未登录或会话已过期' });
        return;
      }
      
      const resourceId = parseInt(req.params.id);
      if (isNaN(resourceId)) {
        return res.status(400).json({ message: '无效的资源ID' });
      }
      
      // 获取资源
      const resource = await storage.getFeifeiResource(resourceId);
      if (!resource) {
        return res.status(404).json({ message: '资源不存在' });
      }
      
      // 检查资源是否有HTML详情内容
      if (!resource.details_html) {
        return res.status(400).json({ message: '资源没有HTML详情内容可供转换' });
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
      
      console.log('智谱AI配置:', { 
        apiKey: '(已隐藏)', 
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
      请将以下HTML内容转换为完整的Markdown格式，保留所有内容，包括标题、段落、列表、链接等结构。
      请对HTML内容进行清理，去除垃圾字符，使其更加清晰可读。
      
      HTML内容：
      ${resource.details_html}
      
      请只返回转换后的Markdown内容，不要有任何其他文字说明。
      `;
      
      // 调用智谱AI
      console.log('调用智谱AI转换HTML内容为Markdown...');
      const completion = await openai.chat.completions.create({
        model: model,
        messages: [
          { role: 'system', content: '你是一个专业的HTML转Markdown工具，擅长将复杂的HTML内容转换为清晰、结构化的Markdown格式。' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.2
      });
      
      console.log('智谱AI响应:', JSON.stringify({
        choiceLength: completion.choices.length,
        hasContent: !!completion.choices[0]?.message?.content
      }));
      
      // 提取返回的内容
      const markdownContent = completion.choices[0]?.message?.content || '';
      
      // 如果内容为空，返回错误
      if (!markdownContent.trim()) {
        return res.status(500).json({ message: '转换结果为空，请重试' });
      }
      
      // 更新资源的markdown_content字段
      const updateResult = await storage.updateFeifeiResource(resourceId, {
        markdown_content: markdownContent
      });
      
      console.log('数据库更新结果:', JSON.stringify({
        success: !!updateResult,
        resourceId,
        hasMarkdownContent: !!updateResult?.markdown_content,
        contentLength: updateResult?.markdown_content?.length || 0
      }));
      
      // 获取更新后的资源
      const updatedResource = await storage.getFeifeiResource(resourceId);
      
      // 获取资源关联的标签
      const tags = await storage.getFeifeiResourceTags(resourceId);
      
      // 返回增强的资源对象以及转换结果
      const enrichedResource = {
        ...updatedResource,
        tags: tags
      };
      
      return res.status(200).json({ 
        message: 'HTML内容已成功转换为Markdown', 
        resource: enrichedResource 
      });
    } catch (error) {
      console.error('转换HTML内容为Markdown时出错:', error);
      return res.status(500).json({ message: '服务器错误', error: (error as Error).message });
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

  // 将菲菲资源转换为资源库资源的公共函数
  async function addFeifeiResourceToResourceLibrary(resourceId: number, parsedContent?: string) {
    console.log(`================== 将菲菲资源添加到资源库 ==================`);
    console.log(`处理菲菲资源ID: ${resourceId}`);
    if (parsedContent) {
      console.log('接收到前端传递的解析结果，将用于资源上架');
    }
    
    // 导入HTML到Markdown转换工具
    const { convertHtmlToMarkdown, fixMarkdownContent, isHtml } = await import('./html-to-markdown');
    
    try {
      // 获取菲菲资源
      const feifeiResource = await storage.getFeifeiResource(resourceId);
      if (!feifeiResource) {
        console.log(`未找到指定的菲菲资源, ID=${resourceId}`);
        return { 
          success: false, 
          message: '未找到指定的菲菲资源',
          resource: null
        };
      }
      
      // 检查资源是否已经上架
      if (feifeiResource.linked_resource_id) {
        console.log(`菲菲资源已经关联到资源库, 菲菲资源ID=${resourceId}, 关联资源ID=${feifeiResource.linked_resource_id}`);
        // 获取关联的资源
        const linkedResource = await storage.getResource(feifeiResource.linked_resource_id);
        if (linkedResource) {
          // 检查是否需要更新资源库中的空字段
          const updateData: any = {};
          let needsUpdate = false;
          
          // 总是使用菲菲资源的最新网盘链接更新资源库（无论是否为空）
          if (feifeiResource.cloud_disk_url) {
            console.log(`从菲菲资源更新网盘链接: 从 ${linkedResource.resource_url || '无'} 更新为 ${feifeiResource.cloud_disk_url}`);
            updateData.resource_url = feifeiResource.cloud_disk_url;
            needsUpdate = true;
          }
          
          // 总是使用菲菲资源的最新提取码更新资源库（无论是否为空）
          if (feifeiResource.cloud_disk_code) {
            console.log(`从菲菲资源更新提取码: 从 ${linkedResource.resource_code || '无'} 更新为 ${feifeiResource.cloud_disk_code}`);
            updateData.resource_code = feifeiResource.cloud_disk_code;
            needsUpdate = true;
          }
          
          // 检查本地图片路径：如果菲菲资源有本地图片路径，且资源库中没有或与菲菲资源不同，则更新
          if (feifeiResource.local_image_path && 
              (!linkedResource.local_image_path || linkedResource.local_image_path !== feifeiResource.local_image_path)) {
            console.log(`更新资源库中的本地图片路径: 从 ${linkedResource.local_image_path || '无'} 更新为 ${feifeiResource.local_image_path}`);
            updateData.local_image_path = feifeiResource.local_image_path;
            needsUpdate = true;
          }
          
          // 无论课程目录是否为空，只要有解析结果，就总是更新课程目录内容
          if (parsedContent || feifeiResource.parsed_content) {
            console.log(`更新资源库中的课程目录内容，确保总是使用最新的解析结果`);
            updateData.contents = parsedContent || feifeiResource.parsed_content || "";
            needsUpdate = true;
          }
          
          // 如果需要更新，执行更新操作
          if (needsUpdate) {
            console.log(`更新资源库中的字段:`, updateData);
            const updatedResource = await storage.updateResource(linkedResource.id, updateData);
            
            // 如果资源是上架状态且更新了网盘链接或提取码，检查是否需要发送上架通知邮件
            if (updatedResource.status === 1 && (updateData.resource_url || updateData.resource_code)) {
              // 检查资源是否有下载链接
              if (updatedResource.resource_url) {
                console.log(`资源 ${updatedResource.id} 已上架且更新了链接，检查是否需要发送上架通知邮件`);
                
                // 导入邮件发送模块
                const { sendResourcePublishedEmail } = await import('./email');
                
                // 获取与该资源相关的未发送邮件的通知记录
                const { notifications } = await storage.getResourceNotifications(1, 100, updatedResource.id, false);
                
                if (notifications && notifications.length > 0) {
                  console.log(`找到 ${notifications.length} 条需要发送上架通知的记录`);
                  
                  // 对每条通知记录，获取用户邮箱并发送通知邮件
                  for (const notification of notifications) {
                    const user = await storage.getUser(notification.user_id);
                    if (user && user.email) {
                      console.log(`正在向用户 ${user.email} 发送资源上架通知邮件`);
                      
                      // 发送邮件
                      const sent = await sendResourcePublishedEmail(
                        user.email, 
                        updatedResource.title, 
                        updatedResource.id
                      );
                      
                      if (sent) {
                        // 更新通知记录的邮件发送状态
                        await storage.updateNotificationEmailStatus(notification.id, true);
                        console.log(`已成功向用户 ${user.email} 发送资源上架通知邮件`);
                      } else {
                        console.error(`向用户 ${user.email} 发送资源上架通知邮件失败`);
                      }
                    } else {
                      console.log(`用户 ${notification.user_id} 不存在或没有邮箱信息，跳过发送`);
                    }
                  }
                } else {
                  console.log(`资源 ${updatedResource.id} 没有需要发送通知的记录`);
                }
              } else {
                console.log(`资源 ${updatedResource.id} 没有下载链接，不发送上架通知邮件`);
              }
            }
            
            return { 
              success: true, 
              message: '已更新资源库中的信息',
              resource: updatedResource
            };
          }
          
          // 如果不需要更新，返回原始资源
          return { 
            success: true, 
            message: '该资源已经上架到资源库',
            resource: linkedResource
          };
        }
      }
      
      // 继续处理资源上架流程
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
      
      // 构建查询结果对象
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
          const titleParts = feifeiCategory.title.split('-').map((part: string) => part.trim());
          
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
          const titleParts = feifeiCategory.title.split('-').map((part: string) => part.trim());
          
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
      
      // 如果资源有HTML详情，但还没有Markdown内容，尝试通过AI转换为Markdown
      let descriptionMarkdown = feifeiResource.description || "";
      if (feifeiResource.details_html && !feifeiResource.markdown_content) {
        console.log(`资源有HTML详情但没有Markdown内容，尝试通过AI转换...`);
        
        try {
          // 从参数表获取智谱AI配置
          const apiKeyParam = await storage.getParameterByKey('ZHIPU_API');
          const modelParam = await storage.getParameterByKey('ZHIPU_MODEL');
          const baseUrlParam = await storage.getParameterByKey('ZHIPU_BASE_URL');
          
          if (apiKeyParam && apiKeyParam.value) {
            const apiKey = apiKeyParam.value;
            const model = modelParam?.value || 'glm-4-flash'; // 默认使用glm-4-flash
            const baseUrl = baseUrlParam?.value || 'https://open.bigmodel.cn/api/paas/v4';
            
            console.log('智谱AI配置:', { 
              apiKey: '(已隐藏)', 
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
            请将以下HTML内容转换为完整的Markdown格式，保留所有内容，包括标题、段落、列表、链接等结构。
            请对HTML内容进行清理，去除垃圾字符，使其更加清晰可读。
            
            HTML内容：
            ${feifeiResource.details_html}
            
            请只返回转换后的Markdown内容，不要有任何其他文字说明。
            `;
            
            // 调用智谱AI
            console.log('调用智谱AI转换HTML内容为Markdown...');
            const completion = await openai.chat.completions.create({
              model: model,
              messages: [
                { role: 'system', content: '你是一个专业的HTML转Markdown工具，擅长将复杂的HTML内容转换为清晰、结构化的Markdown格式。' },
                { role: 'user', content: prompt }
              ],
              temperature: 0.2
            });
            
            // 提取返回的内容
            const markdownContent = completion.choices[0]?.message?.content || '';
            
            if (markdownContent.trim()) {
              // 使用转换后的Markdown内容
              descriptionMarkdown = markdownContent;
              console.log(`成功将HTML转换为Markdown，长度: ${markdownContent.length} 字符`);
              
              // 保存转换后的Markdown内容到数据库
              await storage.updateFeifeiResource(resourceId, {
                markdown_content: markdownContent
              });
              console.log(`已保存Markdown内容到数据库`);
            } else {
              console.log(`转换结果为空，将使用原始描述`);
            }
          } else {
            console.log(`未配置智谱API密钥，跳过转换过程`);
          }
        } catch (error) {
          console.error(`转换HTML到Markdown时出错:`, error);
          console.log(`将使用原始描述字段`);
        }
      } else if (feifeiResource.markdown_content) {
        console.log(`使用已存在的Markdown内容，长度: ${feifeiResource.markdown_content.length} 字符`);
        descriptionMarkdown = feifeiResource.markdown_content || "";
      }
      
      // 准备资源数据
      // 将中文语言名称转换为英文的映射（备用）
      const languageMapping: { [key: string]: string } = {
        "英语": "english",
        "中文": "chinese",
        "英文": "english",
        "日语": "japanese",
        "法语": "french",
        "德语": "german",
        "西班牙语": "spanish",
        "意大利语": "italian",
        "俄语": "russian",
        "葡萄牙语": "portuguese",
        "韩语": "korean",
        "阿拉伯语": "arabic"
      };
      
      // 按用户要求直接使用原始语言值而不做任何转换
      const languageValue = feifeiResource.language || "";
      
      console.log(`===========================================`);
      console.log(`语言字段: 值="${languageValue}" (直接使用原始值)`);
      console.log(`===========================================`);
      
      // 解析视频时长（从课时字段中提取）
      let videoDurationMinutes = 0;
      if (feifeiResource.duration) {
        console.log(`解析视频时长，原始课时信息: "${feifeiResource.duration}"`);
        
        // 使用正则表达式提取小时和分钟
        // 匹配格式：xx 节课（xx 小时 xx 分钟）等
        const timeMatch = feifeiResource.duration.match(/\((\d+)\s*小时\s*(\d+)\s*分钟\)/);
        if (timeMatch) {
          const hours = parseInt(timeMatch[1], 10);
          const minutes = parseInt(timeMatch[2], 10);
          videoDurationMinutes = hours * 60 + minutes;
          console.log(`提取到括号内时长: ${hours}小时${minutes}分钟，转换为${videoDurationMinutes}分钟`);
        } else {
          // 尝试匹配不带括号的格式：xx 小时 xx 分钟
          const noParenMatch = feifeiResource.duration.match(/(\d+)\s*小时\s*(\d+)\s*分钟/);
          if (noParenMatch) {
            const hours = parseInt(noParenMatch[1], 10);
            const minutes = parseInt(noParenMatch[2], 10);
            videoDurationMinutes = hours * 60 + minutes;
            console.log(`提取到时长: ${hours}小时${minutes}分钟，转换为${videoDurationMinutes}分钟`);
          } else {
            // 尝试只匹配小时
            const hoursOnlyMatch = feifeiResource.duration.match(/(\d+)\s*小时/);
            if (hoursOnlyMatch) {
              const hours = parseInt(hoursOnlyMatch[1], 10);
              videoDurationMinutes = hours * 60;
              console.log(`只提取到小时: ${hours}小时，转换为${videoDurationMinutes}分钟`);
            } else {
              // 尝试只匹配分钟
              const minutesOnlyMatch = feifeiResource.duration.match(/(\d+)\s*分钟/);
              if (minutesOnlyMatch) {
                videoDurationMinutes = parseInt(minutesOnlyMatch[1], 10);
                console.log(`只提取到分钟: ${videoDurationMinutes}分钟`);
              } else {
                console.log(`无法从课时信息中提取时长`);
              }
            }
          }
        }
      }
      
      // 解析文件大小（从file_size字段中提取）
      let videoSizeGB = 0;
      if (feifeiResource.file_size) {
        console.log(`解析文件大小，原始信息: "${feifeiResource.file_size}"`);
        
        // 匹配 GB 格式
        const gbMatch = feifeiResource.file_size.match(/(\d+(?:\.\d+)?)\s*GB/i);
        if (gbMatch) {
          videoSizeGB = parseFloat(gbMatch[1]);
          console.log(`提取到GB大小: ${videoSizeGB} GB`);
        } else {
          // 匹配 MB 格式并转换为 GB
          const mbMatch = feifeiResource.file_size.match(/(\d+(?:\.\d+)?)\s*MB/i);
          if (mbMatch) {
            const mbSize = parseFloat(mbMatch[1]);
            videoSizeGB = mbSize / 1024;
            console.log(`提取到MB大小: ${mbSize} MB，转换为 ${videoSizeGB.toFixed(2)} GB`);
          } else {
            // 匹配 KB 格式并转换为 GB
            const kbMatch = feifeiResource.file_size.match(/(\d+(?:\.\d+)?)\s*KB/i);
            if (kbMatch) {
              const kbSize = parseFloat(kbMatch[1]);
              videoSizeGB = kbSize / (1024 * 1024);
              console.log(`提取到KB大小: ${kbSize} KB，转换为 ${videoSizeGB.toFixed(4)} GB`);
            } else {
              console.log(`无法从文件大小信息中提取大小`);
            }
          }
        }
      }
      
      // 为作者ID查找一个有效的作者
      const authors = await storage.getAllAuthors();
      let defaultAuthorId = 1; // 默认为ID为1的作者，如果没有作者则使用null
      
      if (Array.isArray(authors) && authors.length > 0) {
        defaultAuthorId = authors[0].id; // 使用第一个作者
        console.log(`使用第一个作者 ID=${defaultAuthorId} 作为默认作者`);
      } else {
        console.log(`警告：未找到作者数据，将使用默认作者ID=${defaultAuthorId}`);
      }
      
      const resourceData = {
        title: feifeiResource.chinese_title,
        subtitle: feifeiResource.english_title || "",
        local_image_path: feifeiResource.local_image_path || null, // 添加本地图片路径
        cover_image: feifeiResource.image_url || "",
        // 使用匹配到的分类ID
        category_id: matchedCategoryId ? Number(matchedCategoryId) : null,
        // 使用找到的作者ID
        author_id: defaultAuthorId ? Number(defaultAuthorId) : null,
        price: feifeiResource.coin_price || "0",
        video_url: "",
        // 使用解析后的视频时长（分钟）
        video_duration: videoDurationMinutes,
        // 视频大小（GB）- 转换为字符串
        video_size: videoSizeGB.toString(),
        language: languageValue,
        subtitle_languages: feifeiResource.subtitle || "",
        resolution: feifeiResource.video_size || "",
        status: 1, // 默认设置为上架状态
        is_free: false,
        description: fixMarkdownContent(descriptionMarkdown), // 使用转换后的Markdown内容作为描述
        contents: parsedContent || feifeiResource.parsed_content || "",
        faq_content: "",
        resource_url: feifeiResource.cloud_disk_url || "", // 将网盘链接复制到资源下载链接
        resource_code: feifeiResource.cloud_disk_code || "", // 将网盘提取码复制到资源提取码
        resource_type: "video",
        source_type: "feifei",  // 设置来源类型为菲菲网
        source_url: feifeiResource.url  // 将feifei资源的原始URL赋值给资源来源字段
      };
      
      console.log("创建/更新资源的数据:", {
        category_id: resourceData.category_id,
        author_id: resourceData.author_id
      });
      
      let resource;
      let message;
      
      // 检查是否已存在匹配的资源
      if (existingResources.total > 0) {
        // 使用第一个匹配的资源进行更新
        const existingResource = existingResources.resources[0];
        console.log(`找到现有资源 ID=${existingResource.id}，将更新此资源`);
        
        // 更新资源
        resource = await storage.updateResource(existingResource.id, resourceData);
        message = '已更新现有资源';
        
        // 更新菲菲资源的关联信息
        await storage.updateFeifeiResource(resourceId, {
          linked_resource_id: existingResource.id
        });
        
        console.log(`已更新菲菲资源与资源库的关联 (feifei_id=${resourceId} <-> resource_id=${existingResource.id})`);
      } else {
        // 创建新资源
        console.log(`未找到现有资源，将创建新资源`);
        resource = await storage.createResource(resourceData);
        message = '已创建新资源';
        
        if (resource) {
          // 更新菲菲资源的关联信息
          await storage.updateFeifeiResource(resourceId, {
            linked_resource_id: resource.id
          });
          
          console.log(`已建立菲菲资源与资源库的关联 (feifei_id=${resourceId} <-> resource_id=${resource.id})`);
        }
      }
      
      console.log(`资源处理完成: ${message}`);
      return { 
        success: true, 
        message: message,
        resource: resource
      };
    } catch (error) {
      console.error('将菲菲资源添加到资源库时出错:', error);
      return { 
        success: false, 
        message: '处理资源时出错: ' + (error instanceof Error ? error.message : String(error)),
        resource: null
      };
    }
  }

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
      
      console.log(`================== TO-RESOURCE API START ==================`);
      
      // 检查是否有前端传递的解析结果内容
      const { parsed_content } = req.body || {};
      if (parsed_content) {
        console.log('从前端接收到解析结果内容，将用于资源上架');
      }
      
      // 使用公共函数上架资源
      const result = await addFeifeiResourceToResourceLibrary(resourceId, parsed_content);
      
      // 根据结果返回响应
      if (result.success) {
        res.json({ 
          message: result.message, 
          resource: result.resource 
        });
      } else {
        res.status(400).json({ message: result.message });
      }
      
      return;
      
      // 以下原有代码保留作为参考，实际执行时不会执行到这里
      
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
      
      // 如果资源有HTML详情，但还没有Markdown内容，尝试通过AI转换为Markdown
      let descriptionMarkdown = feifeiResource.description || "";
      if (feifeiResource.details_html && !feifeiResource.markdown_content) {
        console.log(`资源有HTML详情但没有Markdown内容，尝试通过AI转换...`);
        
        try {
          // 从参数表获取智谱AI配置
          const apiKeyParam = await storage.getParameterByKey('ZHIPU_API');
          const modelParam = await storage.getParameterByKey('ZHIPU_MODEL');
          const baseUrlParam = await storage.getParameterByKey('ZHIPU_BASE_URL');
          
          if (apiKeyParam && apiKeyParam.value) {
            const apiKey = apiKeyParam.value;
            const model = modelParam?.value || 'glm-4-flash'; // 默认使用glm-4-flash
            const baseUrl = baseUrlParam?.value || 'https://open.bigmodel.cn/api/paas/v4';
            
            console.log('智谱AI配置:', { 
              apiKey: '(已隐藏)', 
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
            请将以下HTML内容转换为完整的Markdown格式，保留所有内容，包括标题、段落、列表、链接等结构。
            请对HTML内容进行清理，去除垃圾字符，使其更加清晰可读。
            
            HTML内容：
            ${feifeiResource.details_html}
            
            请只返回转换后的Markdown内容，不要有任何其他文字说明。
            `;
            
            // 调用智谱AI
            console.log('调用智谱AI转换HTML内容为Markdown...');
            const completion = await openai.chat.completions.create({
              model: model,
              messages: [
                { role: 'system', content: '你是一个专业的HTML转Markdown工具，擅长将复杂的HTML内容转换为清晰、结构化的Markdown格式。' },
                { role: 'user', content: prompt }
              ],
              temperature: 0.2
            });
            
            // 提取返回的内容
            const markdownContent = completion.choices[0]?.message?.content || '';
            
            if (markdownContent.trim()) {
              // 使用转换后的Markdown内容
              descriptionMarkdown = markdownContent;
              console.log(`成功将HTML转换为Markdown，长度: ${markdownContent.length} 字符`);
              
              // 保存转换后的Markdown内容到数据库
              await storage.updateFeifeiResource(resourceId, {
                markdown_content: markdownContent
              });
              console.log(`已保存Markdown内容到数据库`);
            } else {
              console.log(`转换结果为空，将使用原始描述`);
            }
          } else {
            console.log(`未配置智谱API密钥，跳过转换过程`);
          }
        } catch (error) {
          console.error(`转换HTML到Markdown时出错:`, error);
          console.log(`将使用原始描述字段`);
        }
      } else if (feifeiResource.markdown_content) {
        console.log(`使用已存在的Markdown内容，长度: ${feifeiResource.markdown_content.length} 字符`);
        descriptionMarkdown = feifeiResource.markdown_content;
      }
      
      // 准备资源数据
      // 将中文语言名称转换为英文
      const languageMapping = {
        "英语": "english",
        "中文": "chinese",
        "英文": "english",
        "日语": "japanese",
        "法语": "french",
        "德语": "german",
        "西班牙语": "spanish",
        "意大利语": "italian",
        "俄语": "russian",
        "葡萄牙语": "portuguese",
        "韩语": "korean",
        "阿拉伯语": "arabic"
      };
      
      // 按用户要求直接使用原始语言值而不做任何转换
      const languageValue = feifeiResource.language || "";
      
      console.log(`===========================================`);
      console.log(`语言字段: 值="${languageValue}" (直接使用原始值)`);
      console.log(`===========================================`);
      
      // 解析视频时长（从课时字段中提取）
      let videoDurationMinutes = 0;
      if (feifeiResource.duration) {
        console.log(`解析视频时长，原始课时信息: "${feifeiResource.duration}"`);
        
        // 使用正则表达式提取小时和分钟
        // 匹配格式：xx 节课（xx 小时 xx 分钟）等
        const timeMatch = feifeiResource.duration.match(/\((\d+)\s*小时\s*(\d+)\s*分钟\)/);
        if (timeMatch) {
          const hours = parseInt(timeMatch[1], 10);
          const minutes = parseInt(timeMatch[2], 10);
          videoDurationMinutes = hours * 60 + minutes;
          console.log(`提取到括号内时长: ${hours}小时${minutes}分钟，转换为${videoDurationMinutes}分钟`);
        } else {
          // 尝试匹配不带括号的格式：xx 小时 xx 分钟
          const noParenMatch = feifeiResource.duration.match(/(\d+)\s*小时\s*(\d+)\s*分钟/);
          if (noParenMatch) {
            const hours = parseInt(noParenMatch[1], 10);
            const minutes = parseInt(noParenMatch[2], 10);
            videoDurationMinutes = hours * 60 + minutes;
            console.log(`提取到时长: ${hours}小时${minutes}分钟，转换为${videoDurationMinutes}分钟`);
          } else {
            // 尝试只匹配小时
            const hoursOnlyMatch = feifeiResource.duration.match(/(\d+)\s*小时/);
            if (hoursOnlyMatch) {
              const hours = parseInt(hoursOnlyMatch[1], 10);
              videoDurationMinutes = hours * 60;
              console.log(`只提取到小时: ${hours}小时，转换为${videoDurationMinutes}分钟`);
            } else {
              // 尝试只匹配分钟
              const minutesOnlyMatch = feifeiResource.duration.match(/(\d+)\s*分钟/);
              if (minutesOnlyMatch) {
                videoDurationMinutes = parseInt(minutesOnlyMatch[1], 10);
                console.log(`只提取到分钟: ${videoDurationMinutes}分钟`);
              } else {
                console.log(`无法从课时信息中提取时长`);
              }
            }
          }
        }
      }
      
      // 解析文件大小（从file_size字段中提取）
      let videoSizeGB = 0;
      if (feifeiResource.file_size) {
        console.log(`解析文件大小，原始信息: "${feifeiResource.file_size}"`);
        
        // 匹配 GB 格式
        const gbMatch = feifeiResource.file_size.match(/(\d+(?:\.\d+)?)\s*GB/i);
        if (gbMatch) {
          videoSizeGB = parseFloat(gbMatch[1]);
          console.log(`提取到GB大小: ${videoSizeGB} GB`);
        } else {
          // 匹配 MB 格式并转换为 GB
          const mbMatch = feifeiResource.file_size.match(/(\d+(?:\.\d+)?)\s*MB/i);
          if (mbMatch) {
            const mbSize = parseFloat(mbMatch[1]);
            videoSizeGB = mbSize / 1024;
            console.log(`提取到MB大小: ${mbSize} MB，转换为 ${videoSizeGB.toFixed(2)} GB`);
          } else {
            // 匹配 KB 格式并转换为 GB
            const kbMatch = feifeiResource.file_size.match(/(\d+(?:\.\d+)?)\s*KB/i);
            if (kbMatch) {
              const kbSize = parseFloat(kbMatch[1]);
              videoSizeGB = kbSize / (1024 * 1024);
              console.log(`提取到KB大小: ${kbSize} KB，转换为 ${videoSizeGB.toFixed(4)} GB`);
            } else {
              console.log(`无法从文件大小信息中提取大小`);
            }
          }
        }
      }
        
      // 为作者ID查找一个有效的作者
      const authors = await storage.getAllAuthors();
      let defaultAuthorId = 1; // 默认为ID为1的作者，如果没有作者则使用null
      
      if (Array.isArray(authors) && authors.length > 0) {
        defaultAuthorId = authors[0].id; // 使用第一个作者
        console.log(`使用第一个作者 ID=${defaultAuthorId} 作为默认作者`);
      } else {
        console.log(`警告：未找到作者数据，将使用默认作者ID=${defaultAuthorId}`);
      }
      
      const resourceData = {
        title: feifeiResource.chinese_title,
        subtitle: feifeiResource.english_title || "",
        local_image_path: feifeiResource.local_image_path || null, // 添加本地图片路径
        cover_image: feifeiResource.image_url || "",
        // 使用匹配到的分类ID
        category_id: matchedCategoryId ? Number(matchedCategoryId) : null,
        // 使用找到的作者ID
        author_id: defaultAuthorId ? Number(defaultAuthorId) : null,
        price: feifeiResource.coin_price || "0",
        video_url: "",
        // 使用解析后的视频时长（分钟）
        video_duration: videoDurationMinutes,
        // 视频大小（GB）- 转换为字符串
        video_size: videoSizeGB.toString(),
        language: languageValue,
        subtitle_languages: feifeiResource.subtitle || "",
        resolution: feifeiResource.video_size || "",
        status: 1, // 默认设置为上架状态
        is_free: false,
        description: fixMarkdownContent(descriptionMarkdown), // 使用转换后的Markdown内容作为描述
        contents: parsedContent || feifeiResource.parsed_content || "",
        faq_content: "",
        resource_url: feifeiResource.cloud_disk_url || "", // 将网盘链接复制到资源下载链接
        resource_code: feifeiResource.cloud_disk_code || "", // 将网盘提取码复制到资源提取码
        resource_type: "video",
        source_type: "feifei",  // 设置来源类型为菲菲网
        source_url: feifeiResource.url  // 将feifei资源的原始URL赋值给资源来源字段
      };
      
      console.log("创建/更新资源的数据:", {
        category_id: resourceData.category_id,
        author_id: resourceData.author_id
      });
      
      let resource;
      let message;
      
      if (existingResources.resources.length > 0) {
        // 更新已有资源
        const existingResource = existingResources.resources[0];
        console.log(`找到已存在的资源: ID=${existingResource.id}, 标题=${existingResource.title}`);
        console.log(`将更新此资源而不是创建新资源`);
        
        // 确保本地图片路径被正确更新
        if (feifeiResource.local_image_path && (!existingResource.local_image_path || existingResource.local_image_path !== feifeiResource.local_image_path)) {
          console.log(`更新资源本地图片路径: 从 ${existingResource.local_image_path || '无'} 更新为 ${feifeiResource.local_image_path}`);
        }
        
        resource = await storage.updateResource(existingResource.id, resourceData);
        message = "已更新资源";
      } else {
        // 创建新资源
        console.log(`未找到匹配source_url的资源，将创建新资源`);
        if (feifeiResource.local_image_path) {
          console.log(`新资源将使用本地图片路径: ${feifeiResource.local_image_path}`);
        }
        resource = await storage.createResource(resourceData);
        message = "已创建新资源";
      }
      
      // 更新菲菲资源，保存关联的资源ID
      if (resource && resource.id) {
        console.log(`更新菲菲资源 ID=${feifeiResource.id} 的 linked_resource_id 为 ${resource.id}`);
        await storage.updateFeifeiResource(feifeiResource.id, {
          linked_resource_id: resource.id
        });
        
        // 重新获取更新后的菲菲资源
        const updatedFeifeiResource = await storage.getFeifeiResource(feifeiResource.id);
        console.log(`更新后的菲菲资源:`, updatedFeifeiResource);
        
        // 检查最终创建的资源
        console.log(`================== 导入结果信息 ==================`);
        console.log(`原始菲菲资源语言: ${feifeiResource.language}`);
        console.log(`导入后资源语言: ${resource.language}`);
        console.log(`=================================================`);
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

  // 同步菲菲资源的本地图片路径到关联的资源
  app.post('/api/sync-feifei-image-paths', authenticateUser as any, authorizeAdmin as any, async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user) {
        res.status(401).json({ message: '未登录或会话已过期' });
        return;
      }

      // 获取所有已关联资源的菲菲资源
      const feifeiResourcesData = await db
        .select()
        .from(feifeiResources)
        .where(and(
          isNotNull(feifeiResources.linked_resource_id),
          isNotNull(feifeiResources.local_image_path)
        ));

      console.log(`找到 ${feifeiResourcesData.length} 个带有本地图片的已关联菲菲资源`);
      
      // 记录更新的资源数量
      let updatedCount = 0;
      let errorCount = 0;
      
      // 遍历菲菲资源，更新对应的资源本地图片路径
      for (const feifeiResource of feifeiResourcesData) {
        if (feifeiResource.linked_resource_id && feifeiResource.local_image_path) {
          try {
            // 更新资源的本地图片路径
            await storage.updateResource(feifeiResource.linked_resource_id, {
              local_image_path: feifeiResource.local_image_path
            });
            
            console.log(`已更新资源 ID=${feifeiResource.linked_resource_id} 的本地图片路径: ${feifeiResource.local_image_path}`);
            updatedCount++;
          } catch (error) {
            console.error(`更新资源 ID=${feifeiResource.linked_resource_id} 的本地图片路径时出错:`, error);
            errorCount++;
          }
        }
      }
      
      // 返回结果
      res.json({
        success: true,
        message: `成功同步 ${updatedCount} 个资源的本地图片路径，失败 ${errorCount} 个`,
        updated: updatedCount,
        errors: errorCount,
        total: feifeiResourcesData.length
      });
    } catch (error) {
      console.error('同步本地图片路径时出错:', error);
      res.status(500).json({
        success: false,
        message: '同步本地图片路径失败',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // 为单个资源同步菲菲资源的本地图片路径
  app.post('/api/resources/:id/sync-feifei-image-path', authenticateUser as any, authorizeAdmin as any, async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user) {
        res.status(401).json({ message: '未登录或会话已过期' });
        return;
      }

      const resourceId = parseInt(req.params.id);
      if (isNaN(resourceId)) {
        res.status(400).json({ success: false, message: '无效的资源ID' });
        return;
      }

      // 查找与该资源关联的菲菲资源
      const feifeiResource = await db
        .select()
        .from(feifeiResources)
        .where(eq(feifeiResources.linked_resource_id, resourceId))
        .limit(1);

      if (feifeiResource.length === 0) {
        res.status(404).json({ success: false, message: '未找到与该资源关联的菲菲资源' });
        return;
      }

      // 检查菲菲资源是否有本地图片路径
      if (!feifeiResource[0].local_image_path) {
        res.status(404).json({ success: false, message: '菲菲资源没有本地图片路径' });
        return;
      }

      // 更新资源的本地图片路径
      const updatedResource = await storage.updateResource(resourceId, {
        local_image_path: feifeiResource[0].local_image_path
      });

      console.log(`已更新资源 ID=${resourceId} 的本地图片路径: ${feifeiResource[0].local_image_path}`);

      // 返回结果
      res.json({
        success: true,
        message: `成功更新资源 ID=${resourceId} 的本地图片路径`,
        resource: updatedResource
      });
    } catch (error) {
      console.error(`更新资源 ID=${req.params.id} 的本地图片路径时出错:`, error);
      res.status(500).json({
        success: false,
        message: '更新本地图片路径失败',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // 添加资源上架通知记录
  app.post('/api/resources/:id/notify', authenticateUser as any, async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user) {
        res.status(401).json({ message: '未登录或会话已过期' });
        return;
      }
      
      const resourceId = parseInt(req.params.id);
      if (isNaN(resourceId)) {
        res.status(400).json({ success: false, message: '无效的资源ID' });
        return;
      }
      
      // 检查资源是否存在
      const resource = await storage.getResource(resourceId);
      if (!resource) {
        res.status(404).json({ success: false, message: '资源不存在' });
        return;
      }
      
      // 创建通知记录
      const notification = await storage.createResourceNotification(req.user.id, resourceId);
      
      // 返回结果
      res.status(201).json({ 
        success: true, 
        message: '已添加上架通知',
        notification
      });
    } catch (error) {
      console.error('添加资源上架通知记录时出错:', error);
      res.status(500).json({ 
        success: false, 
        message: '添加上架通知失败',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // 获取资源通知记录列表 (仅管理员可访问)
  app.get('/api/admin/resource-notifications', authenticateUser as any, async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user || req.user.membership_type !== 'admin') {
        res.status(403).json({ success: false, message: '权限不足' });
        return;
      }
      
      // 获取查询参数
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 10;
      const resourceId = req.query.resourceId ? parseInt(req.query.resourceId as string) : undefined;
      
      // 获取通知列表
      const { notifications, total } = await storage.getResourceNotifications(page, pageSize, resourceId);
      
      // 获取用户和资源信息，进行关联
      const enrichedNotifications = await Promise.all(
        notifications.map(async (notification) => {
          const user = await storage.getUser(notification.user_id);
          const resource = await storage.getResource(notification.resource_id);
          
          return {
            ...notification,
            user: user ? {
              id: user.id,
              email: user.email,
              avatar: user.avatar
            } : null,
            resource: resource ? {
              id: resource.id,
              title: resource.title,
              subtitle: resource.subtitle,
              cover_image: resource.cover_image,
              status: resource.status,
              resource_url: resource.resource_url
            } : null
          };
        })
      );
      
      // 返回结果
      res.json({
        success: true,
        notifications: enrichedNotifications,
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize)
      });
    } catch (error) {
      console.error('获取资源通知列表时出错:', error);
      res.status(500).json({ 
        success: false, 
        message: '获取资源通知列表失败',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // 支付回调通知处理
  app.get('/api/payment/notify', async (req, res) => {
    try {
      const callbackParams = req.query;
      console.log('收到支付回调通知:', JSON.stringify(callbackParams));
      
      // 获取商户密钥
      const merchantKeyParam = await storage.getParameterByKey('商户密钥');
      if (!merchantKeyParam?.value) {
        console.error('支付回调验证失败: 商户密钥未配置');
        return res.status(500).send('FAIL');
      }

      // 验证签名
      const isValidSign = verifyPaymentCallback(callbackParams as Record<string, any>, merchantKeyParam.value);
      if (!isValidSign) {
        console.error('支付回调验证失败: 签名无效', callbackParams);
        return res.status(400).send('FAIL');
      }

      // 获取订单信息
      const orderNo = callbackParams.out_trade_no as string;
      const order = await storage.getOrderByOrderNo(orderNo);
      if (!order) {
        console.error('支付回调验证失败: 订单不存在', orderNo);
        return res.status(404).send('FAIL');
      }

      // 检查支付状态
      if (callbackParams.trade_status !== 'TRADE_SUCCESS') {
        console.log('订单未成功支付:', callbackParams.trade_status);
        return res.send('success');
      }

      // 如果订单已经处理过，直接返回成功
      if (order.status === 'paid') {
        return res.send('success');
      }

      // 更新订单状态为已支付
      await storage.updateOrder(order.id, {
        status: 'paid',
        trade_no: callbackParams.trade_no as string,
        pay_time: new Date()
      });

      // 为用户添加积分
      const user = await storage.getUser(order.user_id);
      if (user) {
        const amount = parseFloat(order.amount);
        await storage.updateUser(user.id, {
          coins: (user.coins || 0) + amount
        });

        console.log(`用户 ${user.id} 支付成功，已增加 ${amount} 积分`);
      }

      // 如果订单有关联资源，记录购买记录
      if (order.resource_id) {
        await storage.createUserPurchase(
          order.user_id, 
          order.resource_id, 
          parseFloat(order.amount)
        );
        console.log(`为用户 ${order.user_id} 创建资源 ${order.resource_id} 的购买记录`);
      }

      // 返回成功响应
      res.send('success');
    } catch (error) {
      console.error('处理支付回调失败:', error);
      res.status(500).send('FAIL');
    }
  });

  // 查询订单状态
  app.get('/api/payment/order/:orderNo', authenticateUser as any, async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: '未登录或会话已过期' });
      }

      const { orderNo } = req.params;
      const order = await storage.getOrderByOrderNo(orderNo);

      if (!order) {
        return res.status(404).json({ message: '订单不存在' });
      }

      // 验证是否是当前用户的订单
      if (order.user_id !== req.user.id) {
        return res.status(403).json({ message: '无权访问此订单' });
      }

      // 如果已支付，获取资源信息
      let resource = null;
      if (order.resource_id) {
        resource = await storage.getResource(order.resource_id);
      }

      res.json({
        success: true,
        order: {
          id: order.id,
          order_no: order.order_no,
          amount: order.amount,
          status: order.status,
          payment_method: order.payment_method,
          created_at: order.created_at,
          pay_time: order.pay_time
        },
        resource: resource ? {
          id: resource.id,
          title: resource.title,
          resource_url: order.status === 'paid' ? resource.resource_url : null
        } : null
      });
    } catch (error) {
      console.error('查询订单状态失败:', error);
      res.status(500).json({ message: '查询订单状态失败，请稍后再试' });
    }
  });

  return httpServer;
}