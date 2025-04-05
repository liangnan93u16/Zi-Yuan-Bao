import { QueryClient, QueryFunction } from "@tanstack/react-query";

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
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  
  // 对于一些特殊的端点（登录、登出等），可能不需要返回JSON
  if (url.includes('/api/auth/login') || url.includes('/api/auth/logout')) {
    const data = await res.json();
    return data as T;
  }
  
  try {
    return await res.json() as T;
  } catch (e) {
    // 如果无法解析为JSON（例如空响应），则返回空对象
    return {} as T;
  }
}

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
      credentials: "include",
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
