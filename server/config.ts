// 速率限制配置
interface RateLimitConfig {
  // 全局速率限制
  global: {
    windowMs: number; // 时间窗口，单位毫秒
    max: number; // 最大请求数
  };
  // 资源请求限制
  resourceRequest: {
    windowMs: number; // 时间窗口，单位毫秒
    max: number; // 最大请求数
  };
  // 开发模式配置
  development: {
    enabled: boolean; // 是否在开发模式下启用速率限制
    global: {
      windowMs: number;
      max: number;
    };
    resourceRequest: {
      windowMs: number;
      max: number;
    };
  }
}

// 默认配置
export const rateLimitConfig: RateLimitConfig = {
  global: {
    windowMs: 15 * 60 * 1000, // 15分钟
    max: 100, // 每个IP在15分钟内最多100个请求
  },
  resourceRequest: {
    windowMs: 60 * 60 * 1000, // 1小时
    max: 5, // 每个IP在1小时内最多5次请求
  },
  development: {
    enabled: true, // 在开发模式下启用速率限制
    global: {
      windowMs: 15 * 60 * 1000, // 15分钟
      max: 1000, // 开发环境下更宽松的限制：1000次请求
    },
    resourceRequest: {
      windowMs: 60 * 60 * 1000, // 1小时
      max: 1000, // 开发环境下更宽松的限制：1000次请求
    }
  }
};

// 获取当前环境配置
export function getRateLimitConfig() {
  const isDevelopment = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;
  
  if (isDevelopment && rateLimitConfig.development.enabled) {
    return {
      global: rateLimitConfig.development.global,
      resourceRequest: rateLimitConfig.development.resourceRequest
    };
  }
  
  return {
    global: rateLimitConfig.global,
    resourceRequest: rateLimitConfig.resourceRequest
  };
}