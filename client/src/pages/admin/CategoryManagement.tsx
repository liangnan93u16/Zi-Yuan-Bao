import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogClose
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  ArrowUp,
  ArrowDown,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Save,
  Edit3
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Category, insertCategorySchema } from "@shared/schema";
import { Link } from "wouter";
import { IconSelector, IconDisplay } from "@/components/IconSelector";

// Create form schema with client-side validation
const categoryFormSchema = insertCategorySchema.extend({
  name: z.string().min(1, "分类名称不能为空").max(50, "分类名称不能超过50个字符"),
  icon: z.string().optional(),
  parent_id: z.number().optional().nullable(),
  sort_order: z.number().optional().default(0)
});

type CategoryFormValues = z.infer<typeof categoryFormSchema>;

export default function CategoryManagement() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [isCreateIconSelectorOpen, setIsCreateIconSelectorOpen] = useState(false);
  const [isEditIconSelectorOpen, setIsEditIconSelectorOpen] = useState(false);
  const { toast } = useToast();
  const [tab, setTab] = useState("categories");

  // Fetch all categories
  const { 
    data: categories = [], 
    isLoading,
    isError,
    refetch
  } = useQuery<Category[]>({
    queryKey: ['/api/categories'],
  });

  // Create form for adding a new category
  const createForm = useForm<CategoryFormValues>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: {
      name: "",
      icon: "",
      parent_id: null,
      sort_order: 0
    }
  });

  // Create form for editing a category
  const editForm = useForm<CategoryFormValues>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: {
      name: "",
      icon: "",
      parent_id: null,
      sort_order: 0
    }
  });

  // Set edit form values when a category is selected for editing
  useEffect(() => {
    if (selectedCategory && isEditDialogOpen) {
      editForm.reset({
        name: selectedCategory.name,
        icon: selectedCategory.icon || "",
        parent_id: selectedCategory.parent_id || null,
        sort_order: selectedCategory.sort_order || 0
      });
    }
  }, [selectedCategory, isEditDialogOpen, editForm]);

  // Create category mutation
  const createCategoryMutation = useMutation({
    mutationFn: async (data: CategoryFormValues) => {
      return apiRequest("POST", "/api/categories", data);
    },
    onSuccess: () => {
      toast({
        title: "分类创建成功",
        description: "新分类已成功添加。",
      });
      setIsCreateDialogOpen(false);
      createForm.reset();
      refetch();
    },
    onError: (error: any) => {
      toast({
        title: "分类创建失败",
        description: error.message || "创建分类时出错，请重试。",
        variant: "destructive",
      });
    }
  });

  // Update category mutation
  const updateCategoryMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: CategoryFormValues }) => {
      return apiRequest("PUT", `/api/categories/${id}`, data);
    },
    onSuccess: () => {
      toast({
        title: "分类更新成功",
        description: "分类信息已成功更新。",
      });
      setIsEditDialogOpen(false);
      setSelectedCategory(null);
      refetch();
    },
    onError: (error: any) => {
      toast({
        title: "分类更新失败",
        description: error.message || "更新分类时出错，请重试。",
        variant: "destructive",
      });
    }
  });

  // Delete category mutation
  const deleteCategoryMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/categories/${id}`);
    },
    onSuccess: () => {
      toast({
        title: "分类删除成功",
        description: "分类已成功删除。",
      });
      setIsDeleteDialogOpen(false);
      setSelectedCategory(null);
      refetch();
    },
    onError: (error: any) => {
      toast({
        title: "分类删除失败",
        description: error.message || "删除分类时出错，请重试。",
        variant: "destructive",
      });
    }
  });

  // Handle create form submission
  const onCreateSubmit = (data: CategoryFormValues) => {
    createCategoryMutation.mutate(data);
  };

  // Handle edit form submission
  const onEditSubmit = (data: CategoryFormValues) => {
    if (selectedCategory) {
      updateCategoryMutation.mutate({ id: selectedCategory.id, data });
    }
  };

  // Handle delete confirmation
  const onDeleteConfirm = () => {
    if (selectedCategory) {
      deleteCategoryMutation.mutate(selectedCategory.id);
    }
  };

  // Function to update sort order
  const updateSortOrder = (category: Category, direction: 'up' | 'down') => {
    const currentIndex = categories.findIndex(c => c.id === category.id);
    let newSortOrder = category.sort_order || 0;
    
    if (direction === 'up' && currentIndex > 0) {
      newSortOrder -= 1;
    } else if (direction === 'down' && currentIndex < categories.length - 1) {
      newSortOrder += 1;
    }
    
    // Only pass the fields defined in the form schema
    updateCategoryMutation.mutate({
      id: category.id,
      data: { 
        name: category.name,
        icon: category.icon || undefined,
        parent_id: category.parent_id,
        sort_order: newSortOrder 
      }
    });
  };

  // Functions to handle dialog open/close
  const openCreateDialog = () => {
    createForm.reset({
      name: "",
      icon: "",
      parent_id: null,
      sort_order: categories.length
    });
    setIsCreateDialogOpen(true);
  };

  const openEditDialog = (category: Category) => {
    setSelectedCategory(category);
    setIsEditDialogOpen(true);
  };

  const openDeleteDialog = (category: Category) => {
    setSelectedCategory(category);
    setIsDeleteDialogOpen(true);
  };

  // Sort categories by sort_order
  const sortedCategories = [...categories].sort((a, b) => 
    (a.sort_order || 0) - (b.sort_order || 0)
  );

  // Determine parent category names for display
  const getCategoryName = (id: number | null) => {
    if (!id) return "-";
    const category = categories.find(c => c.id === id);
    return category ? category.name : "-";
  };

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="bg-white rounded-xl shadow-md overflow-hidden mb-8">
        <div className="border-b border-neutral-200 px-6 py-4">
          <h2 className="text-xl font-bold">资源管理后台</h2>
        </div>
        
        <Tabs value={tab} onValueChange={setTab}>
          <div className="border-b border-neutral-200">
            <TabsList className="h-auto">
              <TabsTrigger 
                value="resources" 
                className="px-6 py-4 data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary"
              >
                <Link href="/admin/resources">资源列表</Link>
              </TabsTrigger>
              <TabsTrigger 
                value="categories" 
                className="px-6 py-4 data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary"
              >
                分类管理
              </TabsTrigger>
            </TabsList>
          </div>
          
          <TabsContent value="categories" className="p-6">
            <div className="mb-6 flex justify-between items-center">
              <h3 className="text-lg font-semibold">分类管理</h3>
              <Button onClick={openCreateDialog} size="sm" className="flex items-center gap-1">
                <Plus className="h-4 w-4" />
                添加分类
              </Button>
            </div>

            {isLoading ? (
              <div className="py-10 flex justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : isError ? (
              <div className="py-10 text-center text-red-500">
                加载分类数据失败，请刷新页面重试
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[80px]">ID</TableHead>
                      <TableHead className="w-[200px]">分类名称</TableHead>
                      <TableHead className="w-[150px]">图标</TableHead>
                      <TableHead className="w-[150px]">父分类</TableHead>
                      <TableHead className="w-[100px]">排序</TableHead>
                      <TableHead className="w-[150px]">创建时间</TableHead>
                      <TableHead className="w-[150px]">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedCategories.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-6">
                          暂无分类数据
                        </TableCell>
                      </TableRow>
                    ) : (
                      sortedCategories.map((category) => (
                        <TableRow key={category.id}>
                          <TableCell>{category.id}</TableCell>
                          <TableCell>{category.name}</TableCell>
                          <TableCell>
                            {category.icon ? (
                              <div className="flex items-center">
                                <IconDisplay iconId={category.icon} className="h-5 w-5 text-gray-800" />
                                <span className="ml-2 text-xs text-gray-500">{category.icon}</span>
                              </div>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </TableCell>
                          <TableCell>{getCategoryName(category.parent_id)}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span>{category.sort_order || 0}</span>
                              <div className="flex flex-col">
                                <button 
                                  className="text-neutral-500 hover:text-primary" 
                                  onClick={() => updateSortOrder(category, 'up')}
                                >
                                  <ArrowUp className="h-3 w-3" />
                                </button>
                                <button 
                                  className="text-neutral-500 hover:text-primary" 
                                  onClick={() => updateSortOrder(category, 'down')}
                                >
                                  <ArrowDown className="h-3 w-3" />
                                </button>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            {category.created_at ? new Date(category.created_at as Date).toLocaleString('zh-CN', {
                              year: 'numeric',
                              month: '2-digit',
                              day: '2-digit'
                            }) : '-'}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button 
                                onClick={() => openEditDialog(category)} 
                                size="sm" 
                                variant="outline"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button 
                                onClick={() => openDeleteDialog(category)} 
                                size="sm" 
                                variant="destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Create Category Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>添加新分类</DialogTitle>
          </DialogHeader>
          <Form {...createForm}>
            <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-4">
              <FormField
                control={createForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>分类名称</FormLabel>
                    <FormControl>
                      <Input placeholder="输入分类名称" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={createForm.control}
                name="icon"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>图标</FormLabel>
                    <div className="flex items-center gap-2">
                      <FormControl>
                        <div className="flex-1 flex items-center h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                          {field.value ? (
                            <div className="flex items-center gap-2">
                              <IconDisplay iconId={field.value} className="h-5 w-5" />
                              <span className="text-sm">{field.value}</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">未选择图标</span>
                          )}
                        </div>
                      </FormControl>
                      <Button 
                        type="button" 
                        variant="outline"
                        onClick={() => setIsCreateIconSelectorOpen(true)}
                      >
                        <Edit3 className="h-4 w-4" />
                      </Button>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <IconSelector
                open={isCreateIconSelectorOpen}
                onOpenChange={setIsCreateIconSelectorOpen}
                currentIcon={createForm.getValues("icon")}
                onSelect={(iconId) => {
                  createForm.setValue("icon", iconId);
                  setIsCreateIconSelectorOpen(false);
                }}
              />
              
              <FormField
                control={createForm.control}
                name="parent_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>父分类</FormLabel>
                    <FormControl>
                      <select 
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        value={field.value?.toString() || ""}
                        onChange={(e) => {
                          const value = e.target.value;
                          field.onChange(value ? parseInt(value) : null);
                        }}
                      >
                        <option value="">无父分类</option>
                        {categories.map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.name}
                          </option>
                        ))}
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={createForm.control}
                name="sort_order"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>排序顺序</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        placeholder="输入排序顺序" 
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="outline">取消</Button>
                </DialogClose>
                <Button 
                  type="submit" 
                  disabled={createCategoryMutation.isPending}
                  className="gap-1"
                >
                  {createCategoryMutation.isPending && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}
                  保存
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit Category Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>编辑分类</DialogTitle>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
              <FormField
                control={editForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>分类名称</FormLabel>
                    <FormControl>
                      <Input placeholder="输入分类名称" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={editForm.control}
                name="icon"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>图标</FormLabel>
                    <div className="flex items-center gap-2">
                      <FormControl>
                        <div className="flex-1 flex items-center h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                          {field.value ? (
                            <div className="flex items-center gap-2">
                              <IconDisplay iconId={field.value} className="h-5 w-5" />
                              <span className="text-sm">{field.value}</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">未选择图标</span>
                          )}
                        </div>
                      </FormControl>
                      <Button 
                        type="button" 
                        variant="outline"
                        onClick={() => setIsEditIconSelectorOpen(true)}
                      >
                        <Edit3 className="h-4 w-4" />
                      </Button>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <IconSelector
                open={isEditIconSelectorOpen}
                onOpenChange={setIsEditIconSelectorOpen}
                currentIcon={editForm.getValues("icon")}
                onSelect={(iconId) => {
                  editForm.setValue("icon", iconId);
                  setIsEditIconSelectorOpen(false);
                }}
              />
              
              <FormField
                control={editForm.control}
                name="parent_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>父分类</FormLabel>
                    <FormControl>
                      <select 
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        value={field.value?.toString() || ""}
                        onChange={(e) => {
                          const value = e.target.value;
                          field.onChange(value ? parseInt(value) : null);
                        }}
                      >
                        <option value="">无父分类</option>
                        {categories
                          .filter(c => c.id !== selectedCategory?.id) // Prevent selecting self as parent
                          .map((category) => (
                            <option key={category.id} value={category.id}>
                              {category.name}
                            </option>
                          ))
                        }
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={editForm.control}
                name="sort_order"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>排序顺序</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        placeholder="输入排序顺序" 
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="outline">取消</Button>
                </DialogClose>
                <Button 
                  type="submit" 
                  disabled={updateCategoryMutation.isPending}
                  className="gap-1"
                >
                  {updateCategoryMutation.isPending && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}
                  保存
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Category Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p>确定要删除分类 <strong>{selectedCategory?.name}</strong> 吗？这个操作不能撤销。</p>
            <p className="text-red-500 mt-2 text-sm">注意：如果该分类下有资源，删除后这些资源将不再属于任何分类。</p>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">取消</Button>
            </DialogClose>
            <Button 
              onClick={onDeleteConfirm} 
              variant="destructive"
              disabled={deleteCategoryMutation.isPending}
              className="gap-1"
            >
              {deleteCategoryMutation.isPending && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              确认删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}