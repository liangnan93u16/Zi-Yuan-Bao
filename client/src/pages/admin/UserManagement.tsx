import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Search, UserPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

// User edit form schema
const userEditSchema = z.object({
  membership_type: z.string().optional(),
  membership_expire_time: z.string().optional(),
  coins: z.coerce.number().min(0, "金币数量不能为负数").optional(),
  email: z.string().email("请输入有效的邮箱地址").optional(),
  avatar: z.string().optional(),
});

type UserEditValues = z.infer<typeof userEditSchema>;

export default function UserManagement() {
  const [searchQuery, setSearchQuery] = useState("");
  const [membershipFilter, setMembershipFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const { toast } = useToast();

  // Fetch users
  const { data: users, isLoading } = useQuery({
    queryKey: ['/api/admin/users'],
  });

  // Form setup for editing user
  const form = useForm<UserEditValues>({
    resolver: zodResolver(userEditSchema),
    defaultValues: {
      membership_type: "",
      membership_expire_time: "",
      coins: 0,
      email: "",
      avatar: "",
    },
  });

  // Update user mutation
  const updateUserMutation = useMutation({
    mutationFn: async (data: UserEditValues & { id: number }) => {
      const { id, ...userData } = data;
      return apiRequest("PATCH", `/api/admin/users/${id}`, userData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      setIsEditDialogOpen(false);
      toast({
        title: "用户更新成功",
        description: "用户信息已成功更新。",
      });
    },
    onError: (error) => {
      toast({
        title: "更新失败",
        description: `更新用户信息时出错: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const handleEditUser = (user: any) => {
    setEditingUser(user);
    form.reset({
      membership_type: user.membership_type || "",
      membership_expire_time: user.membership_expire_time ? new Date(user.membership_expire_time).toISOString().split('T')[0] : "",
      coins: user.coins || 0,
      email: user.email || "",
      avatar: user.avatar || "",
    });
    setIsEditDialogOpen(true);
  };

  const onSubmitEdit = (data: UserEditValues) => {
    if (!editingUser) return;
    updateUserMutation.mutate({ id: editingUser.id, ...data });
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // Implement search functionality
    console.log("Searching for:", searchQuery);
  };

  // Filter users based on membership type and status
  const filteredUsers = users?.filter((user: any) => {
    let matches = true;
    
    if (membershipFilter !== "all") {
      matches = matches && user.membership_type === membershipFilter;
    }
    
    if (statusFilter === "active") {
      matches = matches && (!user.membership_expire_time || new Date(user.membership_expire_time) > new Date());
    } else if (statusFilter === "disabled") {
      matches = matches && (user.membership_expire_time && new Date(user.membership_expire_time) <= new Date());
    }
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      matches = matches && (
        user.username.toLowerCase().includes(query) || 
        (user.email && user.email.toLowerCase().includes(query))
      );
    }
    
    return matches;
  });

  // Pagination
  const itemsPerPage = 10;
  const paginatedUsers = filteredUsers?.slice((page - 1) * itemsPerPage, page * itemsPerPage);
  const totalPages = Math.ceil((filteredUsers?.length || 0) / itemsPerPage);

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="bg-white rounded-xl shadow-md overflow-hidden mb-8">
        <div className="border-b border-neutral-200 px-6 py-4">
          <h2 className="text-xl font-bold">用户管理</h2>
        </div>
        
        <Tabs defaultValue="users">
          <div className="border-b border-neutral-200">
            <TabsList className="h-auto">
              <TabsTrigger 
                value="users" 
                className="px-6 py-4 data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary"
              >
                用户列表
              </TabsTrigger>
              <TabsTrigger 
                value="resources" 
                className="px-6 py-4 data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary"
              >
                <a href="/admin/resources">资源管理</a>
              </TabsTrigger>
              <TabsTrigger 
                value="upload" 
                className="px-6 py-4 data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary"
              >
                <a href="/admin/resources/upload">上传资源</a>
              </TabsTrigger>
              <TabsTrigger 
                value="categories" 
                className="px-6 py-4 data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary"
              >
                分类管理
              </TabsTrigger>
              <TabsTrigger 
                value="stats" 
                className="px-6 py-4 data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary"
              >
                统计分析
              </TabsTrigger>
            </TabsList>
          </div>
          
          <TabsContent value="users" className="p-6">
            <div className="flex flex-wrap gap-4 mb-6">
              <form onSubmit={handleSearch} className="relative flex-grow">
                <Input
                  type="text"
                  placeholder="搜索用户..."
                  className="w-full bg-neutral-100 pr-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <Search className="absolute right-3 top-2.5 h-4 w-4 text-neutral-500" />
              </form>
              
              <div className="flex gap-2">
                <Select value={membershipFilter} onValueChange={setMembershipFilter}>
                  <SelectTrigger className="w-[160px] bg-neutral-100">
                    <SelectValue placeholder="所有会员类型" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">所有会员类型</SelectItem>
                    <SelectItem value="regular">普通用户</SelectItem>
                    <SelectItem value="vip">VIP会员</SelectItem>
                    <SelectItem value="premium">高级会员</SelectItem>
                    <SelectItem value="admin">管理员</SelectItem>
                  </SelectContent>
                </Select>
                
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[140px] bg-neutral-100">
                    <SelectValue placeholder="所有状态" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">所有状态</SelectItem>
                    <SelectItem value="active">活跃</SelectItem>
                    <SelectItem value="disabled">已禁用</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <Dialog>
                <DialogTrigger asChild>
                  <Button className="gap-2">
                    <UserPlus className="h-4 w-4" /> 添加用户
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>添加新用户</DialogTitle>
                    <DialogDescription>
                      创建新用户账号。创建后，用户将能够使用系统功能。
                    </DialogDescription>
                  </DialogHeader>
                  
                  <div className="space-y-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                      <FormLabel className="text-right">用户名</FormLabel>
                      <Input className="col-span-3" placeholder="输入用户名" />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <FormLabel className="text-right">邮箱</FormLabel>
                      <Input className="col-span-3" placeholder="user@example.com" type="email" />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <FormLabel className="text-right">密码</FormLabel>
                      <Input className="col-span-3" type="password" />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <FormLabel className="text-right">会员类型</FormLabel>
                      <Select>
                        <SelectTrigger className="col-span-3">
                          <SelectValue placeholder="选择会员类型" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="regular">普通用户</SelectItem>
                          <SelectItem value="vip">VIP会员</SelectItem>
                          <SelectItem value="premium">高级会员</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  <DialogFooter>
                    <Button type="submit">创建用户</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
            
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>用户信息</TableHead>
                    <TableHead>会员类型</TableHead>
                    <TableHead>金币</TableHead>
                    <TableHead>注册时间</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    [...Array(3)].map((_, i) => (
                      <TableRow key={i}>
                        <TableCell>
                          <div className="flex items-center">
                            <div className="h-10 w-10 bg-gray-200 rounded-full animate-pulse mr-4"></div>
                            <div>
                              <div className="h-4 bg-gray-200 rounded w-24 mb-2 animate-pulse"></div>
                              <div className="h-3 bg-gray-200 rounded w-32 animate-pulse"></div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell><div className="h-4 bg-gray-200 rounded w-20 animate-pulse"></div></TableCell>
                        <TableCell><div className="h-4 bg-gray-200 rounded w-16 animate-pulse"></div></TableCell>
                        <TableCell><div className="h-4 bg-gray-200 rounded w-24 animate-pulse"></div></TableCell>
                        <TableCell><div className="h-4 bg-gray-200 rounded w-16 animate-pulse"></div></TableCell>
                        <TableCell className="text-right">
                          <div className="h-4 bg-gray-200 rounded w-24 ml-auto animate-pulse"></div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    paginatedUsers?.map((user: any) => {
                      const isActive = !user.membership_expire_time || new Date(user.membership_expire_time) > new Date();
                      
                      return (
                        <TableRow key={user.id}>
                          <TableCell>
                            <div className="flex items-center">
                              <Avatar className="h-10 w-10 mr-4">
                                <AvatarImage src={user.avatar} alt={user.username} />
                                <AvatarFallback>{user.username.charAt(0).toUpperCase()}</AvatarFallback>
                              </Avatar>
                              <div>
                                <div className="font-medium">{user.username}</div>
                                <div className="text-sm text-neutral-500">{user.email || '未设置邮箱'}</div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`
                              ${user.membership_type === 'admin' ? 'bg-red-100 text-red-800' : 
                                user.membership_type === 'vip' ? 'bg-purple-100 text-purple-800' : 
                                user.membership_type === 'premium' ? 'bg-indigo-100 text-indigo-800' : 
                                'bg-neutral-100 text-neutral-800'}
                              border-0
                            `}>
                              {user.membership_type === 'admin' ? '管理员' : 
                               user.membership_type === 'vip' ? 'VIP会员' : 
                               user.membership_type === 'premium' ? '高级会员' : '普通用户'}
                            </Badge>
                            {user.membership_expire_time && (
                              <div className="text-xs text-neutral-500 mt-1">
                                {new Date(user.membership_expire_time).toLocaleDateString()}到期
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-neutral-500">
                            {user.coins || 0}
                          </TableCell>
                          <TableCell className="text-sm text-neutral-500">
                            {new Date(user.created_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`
                              ${isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}
                              border-0
                            `}>
                              {isActive ? '活跃' : '已禁用'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right text-sm font-medium">
                            <Button 
                              variant="ghost" 
                              className="text-primary hover:text-blue-700 h-auto p-0 mr-3"
                              onClick={() => handleEditUser(user)}
                            >
                              编辑
                            </Button>
                            <Button
                              variant="ghost"
                              className={isActive ? "text-red-600 hover:text-red-800 h-auto p-0" : "text-green-600 hover:text-green-800 h-auto p-0"}
                            >
                              {isActive ? '禁用' : '启用'}
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
            
            <div className="mt-6 flex items-center justify-between">
              <div className="text-sm text-neutral-700">
                显示 <span className="font-medium">{(page - 1) * itemsPerPage + 1}</span> 到 <span className="font-medium">{Math.min(page * itemsPerPage, filteredUsers?.length || 0)}</span> 共 <span className="font-medium">{filteredUsers?.length || 0}</span> 条结果
              </div>
              {totalPages > 1 && (
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious onClick={() => setPage(p => Math.max(1, p - 1))} />
                    </PaginationItem>
                    {[...Array(totalPages)].map((_, i) => (
                      <PaginationItem key={i + 1}>
                        <PaginationLink 
                          isActive={page === i + 1} 
                          onClick={() => setPage(i + 1)}
                        >
                          {i + 1}
                        </PaginationLink>
                      </PaginationItem>
                    ))}
                    <PaginationItem>
                      <PaginationNext onClick={() => setPage(p => Math.min(totalPages, p + 1))} />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              )}
            </div>
            
            {/* Edit User Dialog */}
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>编辑用户</DialogTitle>
                  <DialogDescription>
                    修改用户 {editingUser?.username} 的信息
                  </DialogDescription>
                </DialogHeader>
                
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmitEdit)} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="membership_type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>会员类型</FormLabel>
                          <Select 
                            onValueChange={field.onChange} 
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="选择会员类型" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="regular">普通用户</SelectItem>
                              <SelectItem value="vip">VIP会员</SelectItem>
                              <SelectItem value="premium">高级会员</SelectItem>
                              <SelectItem value="admin">管理员</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="membership_expire_time"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>会员到期时间</FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              type="date" 
                            />
                          </FormControl>
                          <FormDescription>
                            留空表示永不过期
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="coins"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>金币数量</FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              type="number" 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>邮箱</FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              type="email" 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="avatar"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>头像URL</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <DialogFooter>
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={() => setIsEditDialogOpen(false)}
                      >
                        取消
                      </Button>
                      <Button 
                        type="submit" 
                        disabled={updateUserMutation.isPending}
                      >
                        {updateUserMutation.isPending ? "保存中..." : "保存更改"}
                      </Button>
                    </DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
