import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { apiRequest } from "@/lib/queryClient";
import { AuthUser } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
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

  const login = async (username: string, password: string) => {
    try {
      setLoading(true);
      const res = await apiRequest("POST", "/api/auth/login", { username, password });
      const userData = await res.json();
      setUser(userData);
      toast({
        title: "登录成功",
        description: `欢迎回来，${userData.username}！`,
      });
    } catch (error) {
      toast({
        title: "登录失败",
        description: "用户名或密码错误，请重试。",
        variant: "destructive",
      });
      throw error;
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

  const register = async (username: string, email: string, password: string) => {
    try {
      setLoading(true);
      const res = await apiRequest("POST", "/api/auth/register", { username, email, password });
      const userData = await res.json();
      setUser(userData);
      toast({
        title: "注册成功",
        description: "您的账号已成功创建！",
      });
    } catch (error) {
      toast({
        title: "注册失败",
        description: "注册时出现错误，用户名可能已存在。",
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
      const res = await apiRequest("POST", "/api/auth/elevate", {});
      const userData = await res.json();
      
      if (res.status === 200) {
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
