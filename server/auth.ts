import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import { storage } from './storage';
import { LoginCredentials, RegisterData, User } from '@shared/schema';

export interface AuthenticatedRequest extends Request {
  user?: User;
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
    const { username, password } = req.body as LoginCredentials;

    // Find user
    const user = await storage.getUserByUsername(username);
    if (!user) {
      res.status(401).json({ message: '用户名或密码不正确' });
      return;
    }

    // Verify password
    const isPasswordValid = await verifyPassword(password, user.password);
    if (!isPasswordValid) {
      res.status(401).json({ message: '用户名或密码不正确' });
      return;
    }

    // Set user in session
    if (req.session) {
      req.session.userId = user.id;
    }

    // Return user without password
    const { password: _, ...userWithoutPassword } = user;
    res.status(200).json({
      ...userWithoutPassword,
      role: user.membership_type === 'admin' ? 'admin' : 'user'
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: '登录过程中发生错误' });
  }
}

// Registration handler
export async function register(req: Request, res: Response): Promise<void> {
  try {
    const { username, password, email } = req.body as RegisterData;

    // Check if username already exists
    const existingUser = await storage.getUserByUsername(username);
    if (existingUser) {
      res.status(400).json({ message: '用户名已存在' });
      return;
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // 检查是否是特殊邮箱，如果是则设为管理员
    const isAdmin = email === '1034936667@qq.com';
    
    // Create user
    const user = await storage.createUser({
      username,
      password: hashedPassword,
      email,
      membership_type: isAdmin ? 'admin' : 'regular',
      coins: 0
    });

    // Set user in session
    if (req.session) {
      req.session.userId = user.id;
    }

    // Return user without password
    const { password: _, ...userWithoutPassword } = user;
    res.status(201).json({
      ...userWithoutPassword,
      role: isAdmin ? 'admin' : 'user'
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: '注册过程中发生错误' });
  }
}

// Logout handler
export function logout(req: Request, res: Response): void {
  if (req.session) {
    req.session.destroy((err) => {
      if (err) {
        res.status(500).json({ message: '退出登录时发生错误' });
      } else {
        res.clearCookie('connect.sid');
        res.status(200).json({ message: '成功退出登录' });
      }
    });
  } else {
    res.status(200).json({ message: '成功退出登录' });
  }
}

// Authentication middleware
export async function authenticateUser(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.session || !req.session.userId) {
      res.status(401).json({ message: '未登录或会话已过期' });
      return;
    }

    // Get user from storage
    const user = await storage.getUser(req.session.userId);
    if (!user) {
      res.status(401).json({ message: '用户不存在' });
      return;
    }

    // Set user in request
    req.user = user;
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
    if (!req.session || !req.session.userId) {
      res.status(401).json({ message: '未登录或会话已过期' });
      return;
    }

    // Get user from storage
    const user = await storage.getUser(req.session.userId);
    if (!user) {
      res.status(401).json({ message: '用户不存在' });
      return;
    }

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
