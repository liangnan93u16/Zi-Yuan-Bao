import { Link, useLocation } from "wouter";
import { Search, ShoppingCart, Menu } from "lucide-react";
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
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");

  const isActive = (path: string) => {
    return location === path;
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // Implement search functionality here
    console.log("Searching for:", searchQuery);
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
              <Link href="/">
                <a className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                  isActive("/") 
                    ? "border-primary text-neutral-900" 
                    : "border-transparent text-neutral-600 hover:border-neutral-300 hover:text-neutral-800"
                }`}>
                  首页
                </a>
              </Link>
              <Link href="/resources">
                <a className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                  location.startsWith("/resources") && !location.includes("admin")
                    ? "border-primary text-neutral-900" 
                    : "border-transparent text-neutral-600 hover:border-neutral-300 hover:text-neutral-800"
                }`}>
                  全部资源
                </a>
              </Link>
              <Link href="/membership">
                <a className="border-transparent text-neutral-600 hover:border-neutral-300 hover:text-neutral-800 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium">
                  会员专区
                </a>
              </Link>
              <Link href="/about">
                <a className="border-transparent text-neutral-600 hover:border-neutral-300 hover:text-neutral-800 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium">
                  关于我们
                </a>
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
                    <AvatarImage src={user.avatar || ""} alt={user.username} />
                    <AvatarFallback>{user.username.charAt(0).toUpperCase()}</AvatarFallback>
                  </Avatar>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem>
                    <Link href="/profile">个人中心</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Link href="/downloads">我的下载</Link>
                  </DropdownMenuItem>
                  {user.role === "admin" && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem>
                        <Link href="/admin/resources">资源管理</Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Link href="/admin/users">用户管理</Link>
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => logout()}>退出登录</DropdownMenuItem>
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
                  <Link href="/">
                    <a className="px-3 py-2 rounded-md text-base font-medium text-neutral-700 hover:text-primary hover:bg-neutral-50">
                      首页
                    </a>
                  </Link>
                  <Link href="/resources">
                    <a className="px-3 py-2 rounded-md text-base font-medium text-neutral-700 hover:text-primary hover:bg-neutral-50">
                      全部资源
                    </a>
                  </Link>
                  <Link href="/membership">
                    <a className="px-3 py-2 rounded-md text-base font-medium text-neutral-700 hover:text-primary hover:bg-neutral-50">
                      会员专区
                    </a>
                  </Link>
                  <Link href="/about">
                    <a className="px-3 py-2 rounded-md text-base font-medium text-neutral-700 hover:text-primary hover:bg-neutral-50">
                      关于我们
                    </a>
                  </Link>
                  
                  {user ? (
                    <>
                      <div className="border-t border-neutral-200 pt-4 mt-4">
                        <Link href="/profile">
                          <a className="px-3 py-2 rounded-md text-base font-medium text-neutral-700 hover:text-primary hover:bg-neutral-50">
                            个人中心
                          </a>
                        </Link>
                        <Link href="/downloads">
                          <a className="px-3 py-2 rounded-md text-base font-medium text-neutral-700 hover:text-primary hover:bg-neutral-50">
                            我的下载
                          </a>
                        </Link>
                        {user.role === "admin" && (
                          <>
                            <Link href="/admin/resources">
                              <a className="px-3 py-2 rounded-md text-base font-medium text-neutral-700 hover:text-primary hover:bg-neutral-50">
                                资源管理
                              </a>
                            </Link>
                            <Link href="/admin/users">
                              <a className="px-3 py-2 rounded-md text-base font-medium text-neutral-700 hover:text-primary hover:bg-neutral-50">
                                用户管理
                              </a>
                            </Link>
                          </>
                        )}
                        <button 
                          onClick={() => logout()}
                          className="w-full text-left px-3 py-2 rounded-md text-base font-medium text-red-600 hover:bg-neutral-50"
                        >
                          退出登录
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="border-t border-neutral-200 pt-4 mt-4">
                      <Link href="/login">
                        <a className="px-3 py-2 rounded-md text-base font-medium text-primary hover:bg-neutral-50">
                          登录 / 注册
                        </a>
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
