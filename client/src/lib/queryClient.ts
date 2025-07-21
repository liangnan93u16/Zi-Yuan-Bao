import { QueryClient, QueryFunction } from "@tanstack/react-query";

// JWT token storage and management
class TokenManager {
  private static readonly TOKEN_KEY = 'auth_token';

  static getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  static setToken(token: string): void {
    localStorage.setItem(this.TOKEN_KEY, token);
  }

  static removeToken(): void {
    localStorage.removeItem(this.TOKEN_KEY);
  }

  static getAuthHeaders(): Record<string, string> {
    const token = this.getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest<T = any>(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<T> {
  const headers: Record<string, string> = {
    ...TokenManager.getAuthHeaders(),
  };

  if (data) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include", // Still include cookies for fallback compatibility
  });

  await throwIfResNotOk(res);
  
  try {
    const result = await res.json();
    
    // Store token if returned from login/register
    if ((url.includes('/api/auth/login') || url.includes('/api/auth/register')) && result.token) {
      TokenManager.setToken(result.token);
    }
    
    return result as T;
  } catch (e) {
    // 如果无法解析为JSON（例如空响应），则返回空对象
    return {} as T;
  }
}

export { TokenManager };

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    // 获取基本URL
    const baseUrl = queryKey[0] as string;
    
    // 处理查询参数（如果有）
    let url = baseUrl;
    if (queryKey.length > 1 && typeof queryKey[1] === 'object') {
      const params = new URLSearchParams();
      const queryParams = queryKey[1] as Record<string, any>;
      
      for (const key in queryParams) {
        if (queryParams[key] !== undefined && queryParams[key] !== null) {
          params.append(key, String(queryParams[key]));
        }
      }
      
      const paramsString = params.toString();
      if (paramsString) {
        url = `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}${paramsString}`;
      }
    }
    
    console.log("请求URL:", url); // 调试用
    
    const res = await fetch(url, {
      headers: TokenManager.getAuthHeaders(),
      credentials: "include", // Still include cookies for fallback compatibility
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
