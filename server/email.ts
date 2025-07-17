import nodemailer from 'nodemailer';
import { storage } from './storage';

interface EmailConfig {
  service?: string;      // 邮件服务提供商名称（如 'gmail', 'qq', '163' 等）
  host?: string;         // SMTP服务器主机名
  port?: number;         // SMTP服务器端口
  secure?: boolean;      // 是否使用SSL/TLS
  auth: {
    user: string;        // 用户名/邮箱
    pass: string;        // 密码或授权码
  };
  from: string;          // 发件人显示的名称和邮箱地址
}

/**
 * 获取系统参数
 */
export async function getSystemParam(key: string, defaultValue: string = ''): Promise<string> {
  try {
    const param = await storage.getParameterByKey(key);
    return param?.value || defaultValue;
  } catch (error) {
    console.error(`获取系统参数 ${key} 错误:`, error);
    return defaultValue;
  }
}

/**
 * 从系统参数表中获取邮件配置
 */
export async function getEmailConfig(): Promise<EmailConfig | null> {
  try {
    // 从系统参数表获取邮箱配置
    const serviceParam = await storage.getParameterByKey('EMAIL_SERVICE');
    const hostParam = await storage.getParameterByKey('EMAIL_HOST');
    const portParam = await storage.getParameterByKey('EMAIL_PORT');
    const userParam = await storage.getParameterByKey('EMAIL_USER');
    const passParam = await storage.getParameterByKey('EMAIL_PASSWORD');
    const fromParam = await storage.getParameterByKey('EMAIL_FROM');
    
    // 检查必要的参数是否都存在
    if (!userParam || !passParam || !fromParam) {
      console.error('缺少必要的邮箱配置参数（用户名、密码和发件人）');
      return null;
    }
    
    const config: EmailConfig = {
      auth: {
        user: userParam.value,
        pass: passParam.value
      },
      from: fromParam.value
    };
    
    // 优先使用 service 配置，如果没有则使用 host 和 port
    if (serviceParam && serviceParam.value) {
      config.service = serviceParam.value;
    } else if (hostParam && hostParam.value) {
      config.host = hostParam.value;
      
      if (portParam && portParam.value) {
        const port = parseInt(portParam.value);
        if (!isNaN(port)) {
          config.port = port;
          config.secure = port === 465; // 465端口通常是SSL
        }
      }
    } else {
      console.error('既没有设置邮件服务(service)，也没有设置SMTP服务器(host)');
      return null;
    }
    
    return config;
  } catch (error) {
    console.error('获取邮箱配置错误:', error);
    return null;
  }
}

/**
 * 发送新用户注册通知邮件给管理员
 */
export async function sendNewUserRegistrationNotification(
  userEmail: string,
  userId: number
): Promise<boolean> {
  try {
    const config = await getEmailConfig();
    if (!config) {
      console.error('无法获取邮箱配置，邮件发送失败');
      return false;
    }
    
    console.log('发送新用户注册通知邮件给管理员');
    
    // 创建邮件传输对象
    const transporter = nodemailer.createTransport({
      service: config.service,
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.auth.user,
        pass: config.auth.pass
      }
    });
    
    // 从系统参数获取网站信息
    const siteUrl = await getSystemParam('SITE_URL', 'https://ziyuanbao.replit.app');
    const siteName = await getSystemParam('SITE_NAME', '资源宝');
    
    // 管理员邮箱
    const adminEmail = 'CRM@wangmaild.cn';
    
    // 发送邮件给管理员
    const info = await transporter.sendMail({
      from: config.from,
      to: adminEmail,
      subject: `新用户注册通知 - ${siteName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e1e1e1; border-radius: 5px;">
          <h2 style="color: #333; border-bottom: 1px solid #eee; padding-bottom: 10px;">新用户注册通知</h2>
          <p>管理员您好！</p>
          <p>有新用户在 <strong>${siteName}</strong> 平台注册了账户。</p>
          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 4px; margin: 20px 0;">
            <h3 style="margin: 0 0 10px 0; color: #495057;">用户信息:</h3>
            <p style="margin: 5px 0;"><strong>用户ID:</strong> ${userId}</p>
            <p style="margin: 5px 0;"><strong>邮箱:</strong> ${userEmail}</p>
            <p style="margin: 5px 0;"><strong>注册时间:</strong> ${new Date().toLocaleString('zh-CN')}</p>
          </div>
          <p>
            <a 
              href="${siteUrl}/admin/users" 
              style="display: inline-block; background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; margin-top: 15px;"
              target="_blank"
            >
              查看用户管理页面
            </a>
          </p>
          <p style="margin-top: 30px; font-size: 12px; color: #777; border-top: 1px solid #eee; padding-top: 10px;">
            此邮件由系统自动发送，请勿直接回复。<br>
            本邮件由 <a href="${siteUrl}" style="color: #007bff; text-decoration: none;" target="_blank">${siteName}</a> 发送。
          </p>
        </div>
      `
    });
    
    console.log('管理员通知邮件发送成功，ID:', info.messageId);
    return true;
  } catch (error) {
    console.error('发送管理员通知邮件失败:', error);
    return false;
  }
}

/**
 * 发送资源上架通知邮件
 */
export async function sendResourcePublishedEmail(
  userEmail: string, 
  resourceTitle: string, 
  resourceId: number
): Promise<boolean> {
  try {
    const config = await getEmailConfig();
    if (!config) {
      console.error('无法获取邮箱配置，邮件发送失败');
      return false;
    }
    
    console.log('使用以下配置发送邮件：', {
      service: config.service,
      host: config.host,
      port: config.port,
      secure: config.secure,
      user: config.auth.user,
      from: config.from
    });
    
    // 创建邮件传输对象
    const transporter = nodemailer.createTransport({
      service: config.service,
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.auth.user,
        pass: config.auth.pass
      }
    });
    
    // 从系统参数获取网站URL
    const siteUrl = await getSystemParam('SITE_URL', 'https://ziyuanbao.replit.app');
    const siteName = await getSystemParam('SITE_NAME', '资源宝');
    
    // 构建资源链接URL (确保URL以/结尾)
    const baseUrl = siteUrl.endsWith('/') ? siteUrl : `${siteUrl}/`;
    const resourceUrl = `${baseUrl}resources/${resourceId}`;
    
    // 发送邮件
    const info = await transporter.sendMail({
      from: config.from,
      to: userEmail,
      subject: `「${resourceTitle}」上架通知`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e1e1e1; border-radius: 5px;">
          <h2 style="color: #333; border-bottom: 1px solid #eee; padding-bottom: 10px;">「${resourceTitle}」上架通知</h2>
          <p>您好！</p>
          <p>您之前关注的资源 <strong>${resourceTitle}</strong> 已经上架了！</p>
          <p>您现在可以登录系统查看和下载这个资源。</p>
          <p>
            <a 
              href="${resourceUrl}" 
              style="display: inline-block; background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; margin-top: 15px;"
              target="_blank"
            >
              立即查看资源
            </a>
          </p>
          <p style="margin-top: 30px; font-size: 12px; color: #777; border-top: 1px solid #eee; padding-top: 10px;">
            此邮件由系统自动发送，请勿直接回复。<br>
            本邮件由 <a href="${siteUrl}" style="color: #4CAF50; text-decoration: none;" target="_blank">${siteName}</a> 发送。
          </p>
        </div>
      `
    });
    
    console.log('邮件发送成功，ID:', info.messageId);
    return true;
  } catch (error) {
    console.error('发送邮件失败:', error);
    return false;
  }
}