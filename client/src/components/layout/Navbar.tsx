import { Link, useLocation } from "wouter";
import { Search, ShoppingCart, Menu, User, ShoppingBag, LogOut, BookOpen, Edit, CheckCircle, ClipboardCheck, Users, History, Shield, Home, Package, Crown, HelpCircle, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { 
  Sheet, 
  SheetContent, 
  SheetTrigger 
} from "@/components/ui/sheet";

export default function Navbar() {
  const [location, setLocation] = useLocation();
  const { user, logout, elevateToAdmin } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");

  const isActive = (path: string) => {
    return location === path;
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      // Redirect to resources page with search query
      const encodedQuery = encodeURIComponent(searchQuery.trim());
      setLocation(`/resources?search=${encodedQuery}`);
      setSearchQuery("");
    }
  };

  return (
    <nav className="bg-white shadow-sm sticky top-0 z-50">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              <Link href="/">
                <span className="text-primary font-bold text-xl cursor-pointer">资源宝</span>
              </Link>
            </div>
            <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
              <Link href="/" className={`inline-flex items-center gap-1 px-1 pt-1 border-b-2 text-sm font-medium ${
                  isActive("/") 
                    ? "border-primary text-neutral-900" 
                    : "border-transparent text-neutral-600 hover:border-neutral-300 hover:text-neutral-800"
                }`}>
                  <Home className="h-4 w-4" />
                  首页
              </Link>
              <Link href="/resources" className={`inline-flex items-center gap-1 px-1 pt-1 border-b-2 text-sm font-medium ${
                  location.startsWith("/resources") && !location.includes("admin")
                    ? "border-primary text-neutral-900" 
                    : "border-transparent text-neutral-600 hover:border-neutral-300 hover:text-neutral-800"
                }`}>
                  <Package className="h-4 w-4" />
                  全部资源
              </Link>
              <Link href="/membership" className={`inline-flex items-center gap-1 px-1 pt-1 border-b-2 text-sm font-medium ${
                  isActive("/membership") 
                    ? "border-primary text-neutral-900" 
                    : "border-transparent text-neutral-600 hover:border-neutral-300 hover:text-neutral-800"
                }`}>
                  <Crown className="h-4 w-4" />
                  会员专区
              </Link>
              <Link href="/resource-request" className={`inline-flex items-center gap-1 px-1 pt-1 border-b-2 text-sm font-medium ${
                  isActive("/resource-request") 
                    ? "border-primary text-neutral-900" 
                    : "border-transparent text-neutral-600 hover:border-neutral-300 hover:text-neutral-800"
                }`}>
                  <HelpCircle className="h-4 w-4" />
                  资源求助
              </Link>
              <Link href="/about" className={`inline-flex items-center gap-1 px-1 pt-1 border-b-2 text-sm font-medium ${
                  isActive("/about") 
                    ? "border-primary text-neutral-900" 
                    : "border-transparent text-neutral-600 hover:border-neutral-300 hover:text-neutral-800"
                }`}>
                  <Info className="h-4 w-4" />
                  关于我们
              </Link>
            </div>
          </div>
          <div className="hidden sm:ml-6 sm:flex sm:items-center sm:space-x-4">
            <form onSubmit={handleSearch} className="relative">
              <Input
                type="text"
                placeholder="搜索资源..."
                className="bg-neutral-100 px-4 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:bg-white w-64"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <Search className="absolute right-3 top-2.5 h-4 w-4 text-neutral-500" />
            </form>

            <Link href="/cart">
              <Button variant="ghost" size="icon" className="text-neutral-600 hover:text-neutral-900">
                <ShoppingCart className="h-5 w-5" />
              </Button>
            </Link>

            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Avatar className="h-8 w-8 cursor-pointer">
                    <AvatarImage src={user.avatar || ""} alt={user.email} />
                    <AvatarFallback>{user.email.charAt(0).toUpperCase()}</AvatarFallback>
                  </Avatar>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem>
                    <Link href="/profile" className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      个人中心
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Link href="/downloads" className="flex items-center gap-2">
                      <ShoppingBag className="h-4 w-4" />
                      我的购买
                    </Link>
                  </DropdownMenuItem>
                  {user.role === "admin" && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem>
                        <Link href="/admin/resources" className="flex items-center gap-2">
                          <BookOpen className="h-4 w-4" />
                          资源管理
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Link href="/admin/reviews" className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4" />
                          评论审核
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Link href="/admin/resource-requests" className="flex items-center gap-2">
                          <ClipboardCheck className="h-4 w-4" />
                          资源需求管理
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Link href="/admin/users" className="flex items-center gap-2">
                          <Users className="h-4 w-4" />
                          会员续费
                        </Link>
                      </DropdownMenuItem>
                      {user.email === "1034936667@qq.com" && (
                        <DropdownMenuItem>
                          <Link href="/admin/login-logs" className="flex items-center gap-2">
                            <History className="h-4 w-4" />
                            登录日志
                          </Link>
                        </DropdownMenuItem>
                      )}
                    </>
                  )}
                  {user.email === "1034936667@qq.com" && (
                    <>
                      <DropdownMenuSeparator />
                      {user.role !== "admin" ? (
                        <DropdownMenuItem onClick={() => elevateToAdmin()} className="flex items-center gap-2">
                          <Shield className="h-4 w-4" />
                          升级为管理员
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem disabled className="flex items-center gap-2">
                          <Shield className="h-4 w-4" />
                          已是管理员
                        </DropdownMenuItem>
                      )}
                    </>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => logout()} className="flex items-center gap-2">
                    <LogOut className="h-4 w-4" />
                    退出登录
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Link href="/login">
                <Button variant="outline">登录 / 注册</Button>
              </Link>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="flex items-center sm:hidden">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="text-neutral-400 hover:text-neutral-500">
                  <Menu className="h-6 w-6" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right">
                <div className="flex flex-col space-y-4 mt-4">
                  <Link href="/" className={`flex items-center gap-2 px-3 py-2 rounded-md text-base font-medium ${
                      isActive("/") 
                        ? "text-primary bg-neutral-50" 
                        : "text-neutral-700 hover:text-primary hover:bg-neutral-50"
                    }`}>
                      <Home className="h-4 w-4" />
                      首页
                  </Link>
                  <Link href="/resources" className={`flex items-center gap-2 px-3 py-2 rounded-md text-base font-medium ${
                      location.startsWith("/resources") && !location.includes("admin")
                        ? "text-primary bg-neutral-50" 
                        : "text-neutral-700 hover:text-primary hover:bg-neutral-50"
                    }`}>
                      <Package className="h-4 w-4" />
                      全部资源
                  </Link>
                  <Link href="/membership" className={`flex items-center gap-2 px-3 py-2 rounded-md text-base font-medium ${
                      isActive("/membership") 
                        ? "text-primary bg-neutral-50" 
                        : "text-neutral-700 hover:text-primary hover:bg-neutral-50"
                    }`}>
                      <Crown className="h-4 w-4" />
                      会员专区
                  </Link>
                  <Link href="/resource-request" className={`flex items-center gap-2 px-3 py-2 rounded-md text-base font-medium ${
                      isActive("/resource-request") 
                        ? "text-primary bg-neutral-50" 
                        : "text-neutral-700 hover:text-primary hover:bg-neutral-50"
                    }`}>
                      <HelpCircle className="h-4 w-4" />
                      资源求助
                  </Link>
                  <Link href="/about" className={`flex items-center gap-2 px-3 py-2 rounded-md text-base font-medium ${
                      isActive("/about") 
                        ? "text-primary bg-neutral-50" 
                        : "text-neutral-700 hover:text-primary hover:bg-neutral-50"
                    }`}>
                      <Info className="h-4 w-4" />
                      关于我们
                  </Link>
                  
                  {user ? (
                    <>
                      <div className="border-t border-neutral-200 pt-4 mt-4">
                        <Link href="/profile" className="flex items-center gap-2 px-3 py-2 rounded-md text-base font-medium text-neutral-700 hover:text-primary hover:bg-neutral-50">
                            <User className="h-4 w-4" />
                            个人中心
                        </Link>
                        <Link href="/downloads" className="flex items-center gap-2 px-3 py-2 rounded-md text-base font-medium text-neutral-700 hover:text-primary hover:bg-neutral-50">
                            <ShoppingBag className="h-4 w-4" />
                            我的购买
                        </Link>
                        {user.role === "admin" && (
                          <>
                            <Link href="/admin/resources" className="flex items-center gap-2 px-3 py-2 rounded-md text-base font-medium text-neutral-700 hover:text-primary hover:bg-neutral-50">
                                <BookOpen className="h-4 w-4" />
                                资源管理
                            </Link>
                            <Link href="/admin/reviews" className="flex items-center gap-2 px-3 py-2 rounded-md text-base font-medium text-neutral-700 hover:text-primary hover:bg-neutral-50">
                                <CheckCircle className="h-4 w-4" />
                                评论审核
                            </Link>
                            <Link href="/admin/resource-requests" className="flex items-center gap-2 px-3 py-2 rounded-md text-base font-medium text-neutral-700 hover:text-primary hover:bg-neutral-50">
                                <ClipboardCheck className="h-4 w-4" />
                                资源需求管理
                            </Link>
                            <Link href="/admin/users" className="flex items-center gap-2 px-3 py-2 rounded-md text-base font-medium text-neutral-700 hover:text-primary hover:bg-neutral-50">
                                <Users className="h-4 w-4" />
                                会员续费
                            </Link>
                            {user.email === "1034936667@qq.com" && (
                              <Link href="/admin/login-logs" className="flex items-center gap-2 px-3 py-2 rounded-md text-base font-medium text-neutral-700 hover:text-primary hover:bg-neutral-50">
                                  <History className="h-4 w-4" />
                                  登录日志
                              </Link>
                            )}
                          </>
                        )}
                        {user.email === "1034936667@qq.com" && (
                          user.role !== "admin" ? (
                            <button 
                              onClick={() => elevateToAdmin()}
                              className="flex items-center gap-2 w-full text-left px-3 py-2 rounded-md text-base font-medium text-blue-600 hover:bg-neutral-50"
                            >
                              <Shield className="h-4 w-4" />
                              升级为管理员
                            </button>
                          ) : (
                            <button 
                              disabled
                              className="flex items-center gap-2 w-full text-left px-3 py-2 rounded-md text-base font-medium text-gray-400"
                            >
                              <Shield className="h-4 w-4" />
                              已是管理员
                            </button>
                          )
                        )}
                        <button 
                          onClick={() => logout()}
                          className="flex items-center gap-2 w-full text-left px-3 py-2 rounded-md text-base font-medium text-red-600 hover:bg-neutral-50"
                        >
                          <LogOut className="h-4 w-4" />
                          退出登录
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="border-t border-neutral-200 pt-4 mt-4">
                      <Link href="/login" className="flex items-center gap-2 px-3 py-2 rounded-md text-base font-medium text-primary hover:bg-neutral-50">
                          <User className="h-4 w-4" />
                          登录 / 注册
                      </Link>
                    </div>
                  )}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </nav>
  );
}
