import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { storage } from './storage';
import { LoginCredentials, RegisterData, User } from '@shared/schema';

import { CONFIG, AUTH_MODE } from './config';

// JWT configuration from config
const JWT_SECRET = CONFIG.JWT_SECRET;
const JWT_EXPIRES_IN = CONFIG.JWT_EXPIRES_IN;

// JWT payload interface
interface JWTPayload {
  userId: number;
  email: string;
  iat?: number;
  exp?: number;
}

export interface AuthenticatedRequest extends Request {
  user?: User;
  token?: string;
}

// JWT utility functions
export function generateToken(user: User): string {
  const payload: JWTPayload = {
    userId: user.id,
    email: user.email
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch (error) {
    return null;
  }
}

export function extractTokenFromRequest(req: Request): string | null {
  // Check Authorization header first (Bearer token)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  
  // Fallback to cookie (for browser compatibility)
  const cookieToken = req.headers.cookie
    ?.split(';')
    .find(c => c.trim().startsWith('token='))
    ?.split('=')[1];
    
  return cookieToken || null;
}

// Hash password
export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

// Verify password
export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}

// Login handler
export async function login(req: Request, res: Response): Promise<void> {
  try {
    const { email, password } = req.body as LoginCredentials;

    // Find user
    const user = await storage.getUserByEmail(email);
    if (!user) {
      res.status(401).json({ message: '邮箱或密码不正确' });
      return;
    }

    // 检查账号是否被锁定
    const now = new Date();
    
    // 检查是否被临时锁定（登录失败导致的临时锁定）
    if (user.account_locked_until && new Date(user.account_locked_until) > now) {
      // 检查是否是永久禁用（管理员禁用）
      const isPermanentlyDisabled = new Date(user.account_locked_until) > new Date("2099-01-01");
      
      if (isPermanentlyDisabled) {
        // 永久禁用的用户
        res.status(401).json({
          message: "账号已被禁用，请联系管理员",
          disabled: true
        });
        return;
      } else {
        // 临时锁定的用户（密码错误导致）
        const remainingTimeMs = new Date(user.account_locked_until).getTime() - now.getTime();
        const remainingMinutes = Math.ceil(remainingTimeMs / (1000 * 60));
        
        res.status(401).json({ 
          message: `账号已被锁定，请${remainingMinutes}分钟后再试`,
          locked: true,
          lockExpires: user.account_locked_until
        });
        return;
      }
    }
    
    // 会员到期不再影响登录，只影响资源下载权限

    // Verify password
    const isPasswordValid = await verifyPassword(password, user.password);
    if (!isPasswordValid) {
      // 密码错误，增加失败次数
      const failedAttempts = (user.failed_login_attempts || 0) + 1;
      const updates: Partial<User> = { failed_login_attempts: failedAttempts };
      
      // 如果达到三次失败，锁定账号1小时
      if (failedAttempts >= 3) {
        const lockUntil = new Date();
        lockUntil.setHours(lockUntil.getHours() + 1); // 锁定1小时
        updates.account_locked_until = lockUntil;
        
        await storage.updateUser(user.id, updates);
        res.status(401).json({ 
          message: '密码错误次数过多，账号已被锁定1小时',
          locked: true,
          lockExpires: lockUntil
        });
      } else {
        await storage.updateUser(user.id, updates);
        res.status(401).json({ 
          message: `邮箱或密码不正确，还有${3-failedAttempts}次机会`,
          remainingAttempts: 3 - failedAttempts
        });
      }
      return;
    }

    // 密码正确，重置失败次数
    if (user.failed_login_attempts && user.failed_login_attempts > 0) {
      await storage.updateUser(user.id, { 
        failed_login_attempts: 0,
        account_locked_until: null
      });
    }

    // 如果是特定的管理员账号，记录登录信息
    if (email === '1034936667@qq.com' && user.membership_type === 'admin') {
      try {
        // 获取客户端IP地址
        const ip = req.headers['x-forwarded-for'] || 
                  req.connection.remoteAddress || 
                  req.socket.remoteAddress || 
                  'unknown';
                  
        // 获取用户代理信息
        const userAgent = req.headers['user-agent'] || 'unknown';
        
        // 记录登录日志
        await storage.createAdminLoginLog({
          admin_email: email,
          ip_address: Array.isArray(ip) ? ip[0] : ip as string,
          user_agent: userAgent,
          status: true  // 登录成功
        });
      } catch (logError) {
        console.error('Failed to log admin login:', logError);
        // 即使记录失败也继续处理登录流程
      }
    }

    // Generate JWT token
    const token = generateToken(user);

    // Set token in cookie for browser compatibility
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });

    // Return user without password and include token
    const { password: _, ...userWithoutPassword } = user;
    res.status(200).json({
      ...userWithoutPassword,
      role: user.membership_type === 'admin' ? 'admin' : 'user',
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: '登录过程中发生错误' });
  }
}

// Registration handler
export async function register(req: Request, res: Response): Promise<void> {
  try {
    const { email, password } = req.body as RegisterData;

    // Check if email already exists
    const existingUser = await storage.getUserByEmail(email);
    if (existingUser) {
      res.status(400).json({ message: '该邮箱已被注册' });
      return;
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // 检查是否是特殊邮箱，如果是则设为管理员
    const isAdmin = email === '1034936667@qq.com';
    
    // Create user
    const user = await storage.createUser({
      password: hashedPassword,
      email,
      membership_type: isAdmin ? 'admin' : null, // 普通用户不应该有会员类型
      coins: 0
    });

    // Generate JWT token
    const token = generateToken(user);

    // Set token in cookie for browser compatibility
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });

    // Return user without password and include token
    const { password: _, ...userWithoutPassword } = user;
    res.status(201).json({
      ...userWithoutPassword,
      role: isAdmin ? 'admin' : 'user',
      token
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: '注册过程中发生错误' });
  }
}

// Logout handler
export function logout(req: Request, res: Response): void {
  // Clear JWT token cookie
  res.clearCookie('token');
  
  // Also clear session cookie if exists (for backward compatibility)
  res.clearCookie('connect.sid');
  
  res.status(200).json({ message: '成功退出登录' });
}

// Authentication middleware
export async function authenticateUser(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Extract token from request
    const token = extractTokenFromRequest(req);
    if (!token) {
      res.status(401).json({ message: '未登录或令牌缺失' });
      return;
    }

    // Verify JWT token
    const payload = verifyToken(token);
    if (!payload) {
      res.status(401).json({ message: '令牌无效或已过期' });
      return;
    }

    // Get user from storage
    const user = await storage.getUser(payload.userId);
    if (!user) {
      res.status(401).json({ message: '用户不存在' });
      return;
    }

    // 检查用户是否被永久禁用（使用account_locked_until字段）
    // 只有当账号锁定日期超过2099年时，才视为管理员禁用的账号
    if (user.account_locked_until && new Date(user.account_locked_until) > new Date("2099-01-01")) {
      res.status(401).json({ message: '账号已被禁用，请联系管理员', disabled: true });
      return;
    }
    
    // 注意：会员到期时间(membership_expire_time)不再影响登录，只影响下载权限

    // Set user and token in request
    req.user = user;
    req.token = token;
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json({ message: '验证用户身份时发生错误' });
  }
}

// Admin authorization middleware
export function authorizeAdmin(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.user || req.user.membership_type !== 'admin') {
    res.status(403).json({ message: '无权限执行此操作' });
    return;
  }
  next();
}

// Get current user
export async function getCurrentUser(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    // Extract token from request
    const token = extractTokenFromRequest(req);
    if (!token) {
      res.status(401).json({ message: '未登录或令牌缺失' });
      return;
    }

    // Verify JWT token
    const payload = verifyToken(token);
    if (!payload) {
      res.status(401).json({ message: '令牌无效或已过期' });
      return;
    }

    // Get user from storage
    const user = await storage.getUser(payload.userId);
    if (!user) {
      res.status(401).json({ message: '用户不存在' });
      return;
    }

    // 检查用户是否被永久禁用（通过account_locked_until字段）
    // 只有当账号锁定日期超过2099年时，才视为管理员禁用的账号
    if (user.account_locked_until && new Date(user.account_locked_until) > new Date("2099-01-01")) {
      res.status(401).json({ message: '账号已被禁用，请联系管理员', disabled: true });
      return;
    }
    
    // 注意：会员到期时间(membership_expire_time)不再影响登录，只影响下载权限

    // Return user without password
    const { password, ...userWithoutPassword } = user;
    res.status(200).json({
      ...userWithoutPassword,
      role: user.membership_type === 'admin' ? 'admin' : 'user'
    });
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({ message: '获取当前用户信息时发生错误' });
  }
}
