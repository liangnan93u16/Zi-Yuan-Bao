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
import { Search, UserPlus, Camera, FileText, Trash2 } from "lucide-react";
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
import { AvatarSelector } from "@/components/AvatarSelector";

// User edit form schema
const userEditSchema = z.object({
  membership_type: z.string().optional(),
  membership_expire_time: z.string().nullable().optional(),
  coins: z.coerce.number().min(0, "积分数量不能为负数").optional(),
  email: z.string().email("请输入有效的邮箱地址").optional(),
  avatar: z.string().optional(),
});

// User create form schema
const userCreateSchema = z.object({
  email: z.string().email("请输入有效的邮箱地址"),
  password: z.string().min(6, "密码至少需要6个字符"),
  membership_type: z.string().default("regular"),
  coins: z.coerce.number().min(0, "积分数量不能为负数").default(0),
});

type UserEditValues = z.infer<typeof userEditSchema>;
type UserCreateValues = z.infer<typeof userCreateSchema>;

// 定义购买记录类型
interface Purchase {
  id: number;
  user_id: number;
  resource_id: number;
  price: string;
  purchase_time: string;
  resource: {
    id: number;
    title: string;
    subtitle?: string;
    cover_image?: string;
    resource_url?: string;
  };
}

export default function UserManagement() {
  const [searchQuery, setSearchQuery] = useState("");
  const [membershipFilter, setMembershipFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isAvatarDialogOpen, setIsAvatarDialogOpen] = useState(false);
  const [isPurchasesDialogOpen, setIsPurchasesDialogOpen] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [userPurchases, setUserPurchases] = useState<Purchase[]>([]);
  const [isLoadingPurchases, setIsLoadingPurchases] = useState(false);
  const { toast } = useToast();

  // Fetch users
  const { data: users = [], isLoading } = useQuery<any[]>({
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
  
  // Form setup for creating user
  const createForm = useForm<UserCreateValues>({
    resolver: zodResolver(userCreateSchema),
    defaultValues: {
      email: "",
      password: "",
      membership_type: "regular",
      coins: 0,
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
  
  // 删除用户购买记录mutation
  const deletePurchaseMutation = useMutation({
    mutationFn: async (purchaseId: number) => {
      return apiRequest("DELETE", `/api/admin/purchases/${purchaseId}`);
    },
    onSuccess: () => {
      // 如果当前用户ID存在，则刷新该用户的购买记录
      if (currentUserId) {
        fetchUserPurchases(currentUserId);
      }
      toast({
        title: "删除成功",
        description: "购买记录已成功删除",
      });
    },
    onError: (error) => {
      toast({
        title: "删除失败",
        description: `删除购买记录时出错: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // 获取用户购买记录
  const fetchUserPurchases = async (userId: number) => {
    setIsLoadingPurchases(true);
    try {
      const response = await fetch(`/api/admin/users/${userId}/purchases`, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('获取购买记录失败');
      }
      
      const data = await response.json();
      setUserPurchases(data);
    } catch (error) {
      console.error('Error fetching user purchases:', error);
      toast({
        title: '获取失败',
        description: '无法加载用户购买记录，请稍后重试',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingPurchases(false);
    }
  };

  // 查看用户购买记录
  const handleViewPurchases = (userId: number) => {
    setCurrentUserId(userId);
    fetchUserPurchases(userId);
    setIsPurchasesDialogOpen(true);
  };

  // 删除购买记录
  const handleDeletePurchase = (purchaseId: number) => {
    if (confirm('确定要删除此购买记录吗？此操作不可撤销。')) {
      deletePurchaseMutation.mutate(purchaseId);
    }
  };

  // Toggle user status mutation
  const toggleUserStatusMutation = useMutation({
    mutationFn: async ({ userId, isActive }: { userId: number, isActive: boolean }) => {
      // 将禁用状态使用特殊的日期来表示：
      // 通过判断是否大于2099年，表示用户被禁用，但不影响会员权限
      
      const userData = {
        account_locked_until: isActive ? "2099-12-31" : null
      };
      
      return apiRequest("PATCH", `/api/admin/users/${userId}`, userData);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      toast({
        title: variables.isActive ? "用户已禁用" : "用户已启用",
        description: variables.isActive ? "用户已成功禁用。" : "用户已成功启用。",
      });
    },
    onError: (error) => {
      toast({
        title: "操作失败",
        description: `更改用户状态时出错: ${error.message}`,
        variant: "destructive",
      });
    },
  });
  
  // Create user mutation
  const createUserMutation = useMutation({
    mutationFn: async (data: UserCreateValues) => {
      return apiRequest("POST", "/api/admin/users", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      setIsAddDialogOpen(false);
      createForm.reset();
      toast({
        title: "用户创建成功",
        description: "新用户已成功创建。",
      });
    },
    onError: (error) => {
      toast({
        title: "创建失败",
        description: `创建用户时出错: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Delete user mutation
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: number) => {
      return apiRequest("DELETE", `/api/admin/users/${userId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      toast({
        title: "删除成功",
        description: "会员及其相关数据已成功删除。",
      });
    },
    onError: (error) => {
      toast({
        title: "删除失败",
        description: `删除会员时出错: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const handleEditUser = (user: any) => {
    // 如果用户是管理员，不允许编辑
    if (user.membership_type === 'admin') {
      toast({
        title: "无法编辑管理员",
        description: "管理员用户不可被编辑。",
        variant: "destructive",
      });
      return;
    }

    setEditingUser(user);
    form.reset({
      membership_type: user.membership_type || "regular",
      membership_expire_time: user.membership_expire_time ? new Date(user.membership_expire_time).toISOString().split('T')[0] : "",
      coins: user.coins || 0,
      email: user.email || "",
      avatar: user.avatar || "",
    });
    setIsEditDialogOpen(true);
  };

  const onSubmitEdit = (data: UserEditValues) => {
    if (!editingUser) return;
    
    // 确保会员到期时间格式正确
    const formattedData = { ...data };
    
    // 创建我们要发送到API的对象
    const apiData: any = { ...formattedData };
    
    // 处理空字符串的会员到期时间
    if (formattedData.membership_expire_time === "") {
      apiData.membership_expire_time = null;
    }
    
    // 处理"regular"会员类型，将其转为null（普通用户）
    if (formattedData.membership_type === "regular") {
      apiData.membership_type = null;
    }
    
    updateUserMutation.mutate({ id: editingUser.id, ...apiData });
  };
  
  const onSubmitCreate = (data: UserCreateValues) => {
    // 处理"regular"会员类型，将其转为null（普通用户）
    const formattedData = { ...data };
    if (formattedData.membership_type === "regular") {
      // 由于TypeScript的限制，我们需要使用as unknown的中间转换
      (formattedData as any).membership_type = null;
    }
    
    createUserMutation.mutate(formattedData);
  };

  // Handle delete user
  const handleDeleteUser = (user: any) => {
    // 不允许删除管理员用户
    if (user.membership_type === 'admin') {
      toast({
        title: "无法删除",
        description: "不能删除管理员用户。",
        variant: "destructive",
      });
      return;
    }

    if (confirm(`确定要删除会员 "${user.email}" 吗？此操作将同时删除该用户的所有购买记录、收藏记录等相关数据，且不可撤销。`)) {
      deleteUserMutation.mutate(user.id);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // Implement search functionality
    console.log("Searching for:", searchQuery);
  };
  
  // 处理头像选择
  const handleAvatarSelect = (avatarUrl: string) => {
    form.setValue("avatar", avatarUrl);
    setIsAvatarDialogOpen(false);
    
    toast({
      title: "头像已选择",
      description: "请保存更改以更新用户头像",
    });
  };

  // Filter users based on membership type and status
  const filteredUsers = users?.filter((user: any) => {
    let matches = true;
    
    if (membershipFilter !== "all") {
      if (membershipFilter === "regular") {
        // 对于regular过滤器，应该匹配null或者空值的用户
        matches = matches && (!user.membership_type || user.membership_type === "regular");
      } else {
        matches = matches && user.membership_type === membershipFilter;
      }
    }
    
    if (statusFilter === "active") {
      // 活跃用户：没有被永久禁用（账号锁定日期为空或不超过2099年）
      matches = matches && (!user.account_locked_until || new Date(user.account_locked_until) <= new Date("2099-01-01"));
    } else if (statusFilter === "disabled") {
      // 被禁用的用户：账号锁定日期超过2099年（永久禁用标志）
      matches = matches && (user.account_locked_until && new Date(user.account_locked_until) > new Date("2099-01-01"));
    }
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      matches = matches && user.email && user.email.toLowerCase().includes(query);
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
          <h2 className="text-xl font-bold">会员管理</h2>
        </div>
        
        <div className="border-b border-neutral-200">
          <h3 className="px-6 py-4 font-medium">会员列表</h3>
        </div>
        
        <div className="p-6">
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
              
              <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
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
                  
                  <Form {...createForm}>
                    <form onSubmit={createForm.handleSubmit(onSubmitCreate)} className="space-y-4 py-4">
                      <FormField
                        control={createForm.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem className="grid grid-cols-4 items-center gap-4">
                            <FormLabel className="text-right">邮箱</FormLabel>
                            <FormControl>
                              <Input className="col-span-3" placeholder="user@example.com" type="email" {...field} />
                            </FormControl>
                            <FormMessage className="col-span-3 col-start-2" />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={createForm.control}
                        name="password"
                        render={({ field }) => (
                          <FormItem className="grid grid-cols-4 items-center gap-4">
                            <FormLabel className="text-right">密码</FormLabel>
                            <FormControl>
                              <Input className="col-span-3" type="password" {...field} />
                            </FormControl>
                            <FormMessage className="col-span-3 col-start-2" />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={createForm.control}
                        name="membership_type"
                        render={({ field }) => (
                          <FormItem className="grid grid-cols-4 items-center gap-4">
                            <FormLabel className="text-right">会员类型</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger className="col-span-3">
                                  <SelectValue placeholder="选择会员类型" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="regular">普通用户</SelectItem>
                                <SelectItem value="premium">高级会员</SelectItem>
                                <SelectItem value="admin">管理员</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage className="col-span-3 col-start-2" />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={createForm.control}
                        name="coins"
                        render={({ field }) => (
                          <FormItem className="grid grid-cols-4 items-center gap-4">
                            <FormLabel className="text-right">积分</FormLabel>
                            <FormControl>
                              <Input 
                                className="col-span-3" 
                                type="number" 
                                min={0}
                                {...field}
                                onChange={(e) => field.onChange(parseInt(e.target.value))}
                              />
                            </FormControl>
                            <FormMessage className="col-span-3 col-start-2" />
                          </FormItem>
                        )}
                      />
                      
                      <DialogFooter>
                        <Button 
                          type="submit" 
                          disabled={createUserMutation.isPending}
                        >
                          {createUserMutation.isPending ? "创建中..." : "创建用户"}
                        </Button>
                      </DialogFooter>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </div>
            
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>用户信息</TableHead>
                    <TableHead>会员类型</TableHead>
                    <TableHead>积分</TableHead>
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
                      // 检查是否被禁用 - 使用account_locked_until判断，2099年之后的日期被认为是永久禁用状态
                      const isDisabled = user.account_locked_until && new Date(user.account_locked_until) > new Date("2099-01-01");
                      const isActive = !isDisabled;
                      
                      return (
                        <TableRow key={user.id}>
                          <TableCell>
                            <div className="flex items-center">
                              <Avatar className="h-10 w-10 mr-4">
                                <AvatarImage src={user.avatar} alt={user.email} />
                                <AvatarFallback>{user.email.charAt(0).toUpperCase()}</AvatarFallback>
                              </Avatar>
                              <div>
                                <div className="font-medium">{user.email}</div>
                                <div className="text-sm text-neutral-500">{user.membership_type || '普通用户'}</div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`
                              ${user.membership_type === 'admin' ? 'bg-red-100 text-red-800' : 
                                user.membership_type === 'premium' ? 'bg-indigo-100 text-indigo-800' : 
                                'bg-neutral-100 text-neutral-800'}
                              border-0
                            `}>
                              {user.membership_type === 'admin' ? '管理员' : 
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
                              disabled={user.membership_type === 'admin'}
                              title={user.membership_type === 'admin' ? "管理员用户不可编辑" : "编辑用户"}
                            >
                              编辑
                            </Button>
                            <Button 
                              variant="ghost" 
                              className="text-blue-600 hover:text-blue-800 h-auto p-0 mr-3"
                              onClick={() => handleViewPurchases(user.id)}
                              title="查看购买记录"
                            >
                              购买记录
                            </Button>
                            <Button
                              variant="ghost"
                              className={isActive ? "text-red-600 hover:text-red-800 h-auto p-0 mr-3" : "text-green-600 hover:text-green-800 h-auto p-0 mr-3"}
                              onClick={() => toggleUserStatusMutation.mutate({ userId: user.id, isActive: isActive })}
                              disabled={toggleUserStatusMutation.isPending || user.membership_type === 'admin'}
                              title={user.membership_type === 'admin' ? "管理员用户不可禁用" : (isActive ? "禁用用户" : "启用用户")}
                            >
                              {isActive ? '禁用' : '启用'}
                            </Button>
                            <Button
                              variant="ghost"
                              className="text-red-600 hover:text-red-800 h-auto p-0"
                              onClick={() => handleDeleteUser(user)}
                              disabled={deleteUserMutation.isPending || user.membership_type === 'admin'}
                              title={user.membership_type === 'admin' ? "管理员用户不可删除" : "删除会员"}
                            >
                              删除
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
                    修改用户 {editingUser?.email} 的信息
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
                      render={({ field }) => {
                        // 为日期字段使用字符串类型
                        const dateValue = field.value || "";
                        
                        return (
                          <FormItem>
                            <FormLabel>会员到期时间</FormLabel>
                            <FormControl>
                              <Input 
                                type="date"
                                value={dateValue}
                                onChange={(e) => {
                                  // 当清空字段时，设置为空字符串
                                  if (!e.target.value) {
                                    field.onChange("");
                                  } else {
                                    field.onChange(e.target.value);
                                  }
                                }}
                                onBlur={field.onBlur}
                                name={field.name}
                                ref={field.ref}
                              />
                            </FormControl>
                            <FormDescription>
                              留空表示永不过期
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        );
                      }}
                    />
                    
                    <FormField
                      control={form.control}
                      name="coins"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>积分数量</FormLabel>
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
                          <FormLabel>用户头像</FormLabel>
                          <div className="flex flex-col items-center mb-4">
                            <Avatar className="h-16 w-16 mb-4">
                              {field.value ? (
                                <AvatarImage 
                                  src={field.value} 
                                  alt={editingUser?.email} 
                                  className="object-cover"
                                  key={field.value} // 强制在头像URL变化时重新渲染
                                />
                              ) : (
                                <AvatarFallback className="text-2xl">{editingUser?.email?.charAt(0).toUpperCase()}</AvatarFallback>
                              )}
                            </Avatar>
                            
                            <div className="flex gap-2">
                              <FormControl>
                                <Input {...field} id="avatar-input" type="hidden" />
                              </FormControl>
                              <Button 
                                variant="outline" 
                                type="button" 
                                className="flex items-center gap-2" 
                                onClick={() => setIsAvatarDialogOpen(true)}
                              >
                                <Camera className="h-4 w-4" />
                                选择头像
                              </Button>
                            </div>
                          </div>
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
        </div>
      </div>
      
      {/* 头像选择器对话框 */}
      <AvatarSelector
        open={isAvatarDialogOpen}
        onOpenChange={setIsAvatarDialogOpen}
        onSelect={handleAvatarSelect}
        currentAvatar={form.getValues().avatar}
      />
      
      {/* 用户购买记录对话框 */}
      <Dialog open={isPurchasesDialogOpen} onOpenChange={setIsPurchasesDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>用户购买记录</DialogTitle>
            <DialogDescription>
              查看和管理用户的所有购买记录
            </DialogDescription>
          </DialogHeader>
          
          {isLoadingPurchases ? (
            <div className="py-8 flex justify-center">
              <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : userPurchases.length === 0 ? (
            <div className="py-8 text-center text-neutral-600">
              该用户暂无购买记录
            </div>
          ) : (
            <div className="overflow-y-auto max-h-[60vh]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>资源名称</TableHead>
                    <TableHead>价格</TableHead>
                    <TableHead>购买时间</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {userPurchases.map((purchase) => (
                    <TableRow key={purchase.id}>
                      <TableCell>
                        <div className="flex items-center">
                          {purchase.resource.cover_image ? (
                            <div className="w-10 h-10 mr-3 rounded overflow-hidden">
                              <img 
                                src={purchase.resource.cover_image} 
                                alt={purchase.resource.title}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          ) : (
                            <div className="w-10 h-10 mr-3 rounded bg-neutral-200 flex items-center justify-center">
                              <FileText className="h-5 w-5 text-neutral-500" />
                            </div>
                          )}
                          <div>
                            <div className="font-medium">{purchase.resource.title}</div>
                            {purchase.resource.subtitle && (
                              <div className="text-xs text-neutral-500">{purchase.resource.subtitle}</div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{purchase.price} 积分</TableCell>
                      <TableCell>
                        {new Date(purchase.purchase_time).toLocaleString('zh-CN', {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          className="text-red-600 hover:text-red-800 h-auto p-0"
                          onClick={() => handleDeletePurchase(purchase.id)}
                          title="删除购买记录"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setIsPurchasesDialogOpen(false)}
            >
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
