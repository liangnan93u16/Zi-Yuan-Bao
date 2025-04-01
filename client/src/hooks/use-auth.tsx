import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { apiRequest } from "@/lib/queryClient";
import { AuthUser } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  elevateToAdmin: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch("/api/auth/me", { credentials: "include" });
        if (res.ok) {
          const userData = await res.json();
          setUser(userData);
        }
      } catch (error) {
        console.error("Failed to check auth status:", error);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      setLoading(true);
      const res = await apiRequest("POST", "/api/auth/login", { email, password });
      const userData = await res.json();
      setUser(userData);
      toast({
        title: "登录成功",
        description: `欢迎回来！`,
      });
    } catch (error: any) {
      // 检查是否有响应体，包含详细错误信息
      let errorMessage = "用户名或密码错误，请重试。";
      
      if (error.response) {
        try {
          const errorData = await error.response.json();
          
          // 处理不同的错误情况
          if (errorData.locked) {
            errorMessage = errorData.message || "账号已被锁定，请稍后再试。";
          } else if (errorData.remainingAttempts !== undefined) {
            errorMessage = errorData.message || `密码错误，还有${errorData.remainingAttempts}次尝试机会。`;
          } else {
            errorMessage = errorData.message || errorMessage;
          }
        } catch (e) {
          console.error("Failed to parse error response:", e);
        }
      }
      
      toast({
        title: "登录失败",
        description: errorMessage,
        variant: "destructive",
      });
      
      // 创建一个新错误对象，包含详细信息
      const enhancedError = new Error(errorMessage);
      enhancedError.name = "AuthError";
      if (error.response && error.response.status) {
        (enhancedError as any).status = error.response.status;
      }
      throw enhancedError;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      setLoading(true);
      await apiRequest("POST", "/api/auth/logout", {});
      setUser(null);
      toast({
        title: "已退出登录",
        description: "您已成功退出登录。",
      });
    } catch (error) {
      toast({
        title: "退出失败",
        description: "退出登录时出现错误，请重试。",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const register = async (email: string, password: string) => {
    try {
      setLoading(true);
      const res = await apiRequest("POST", "/api/auth/register", { email, password });
      const userData = await res.json();
      setUser(userData);
      toast({
        title: "注册成功",
        description: "您的账号已成功创建！",
      });
    } catch (error) {
      toast({
        title: "注册失败",
        description: "注册时出现错误，该邮箱可能已被注册。",
        variant: "destructive",
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };
  
  const elevateToAdmin = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/auth/elevate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
      });
      
      const userData = await res.json();
      
      if (res.ok) {
        setUser(userData);
        toast({
          title: "权限升级成功",
          description: "您的账号已成功升级为管理员！",
        });
      } else {
        toast({
          title: "权限升级失败",
          description: userData.message || "您的账号不符合升级条件。",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("升级权限错误:", error);
      toast({
        title: "权限升级失败",
        description: "升级权限时出现错误，请重试。",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, register, elevateToAdmin }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
