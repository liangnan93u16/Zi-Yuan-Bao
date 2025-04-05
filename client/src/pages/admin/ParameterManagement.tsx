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
import { Textarea } from "@/components/ui/textarea";
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
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Settings,
  ArrowLeft
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Parameter, insertParameterSchema } from "@shared/schema";
import { Link } from "wouter";

// Create form schema with client-side validation
const parameterFormSchema = insertParameterSchema.extend({
  key: z.string().min(1, "参数键不能为空").max(50, "参数键不能超过50个字符"),
  value: z.string().min(1, "参数值不能为空"),
  description: z.string().optional()
});

type ParameterFormValues = z.infer<typeof parameterFormSchema>;

export default function ParameterManagement() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedParameter, setSelectedParameter] = useState<Parameter | null>(null);
  const { toast } = useToast();
  const [tab, setTab] = useState("parameters");

  // Fetch all parameters
  const { 
    data: parameters = [], 
    isLoading,
    isError,
    refetch
  } = useQuery<Parameter[]>({
    queryKey: ['/api/parameters'],
  });

  // Create form for adding a new parameter
  const createForm = useForm<ParameterFormValues>({
    resolver: zodResolver(parameterFormSchema),
    defaultValues: {
      key: "",
      value: "",
      description: ""
    }
  });

  // Create form for editing a parameter
  const editForm = useForm<ParameterFormValues>({
    resolver: zodResolver(parameterFormSchema),
    defaultValues: {
      key: "",
      value: "",
      description: ""
    }
  });

  // Set edit form values when a parameter is selected for editing
  useEffect(() => {
    if (selectedParameter && isEditDialogOpen) {
      editForm.reset({
        key: selectedParameter.key,
        value: selectedParameter.value,
        description: selectedParameter.description || ""
      });
    }
  }, [selectedParameter, isEditDialogOpen, editForm]);

  // Create parameter mutation
  const createParameterMutation = useMutation({
    mutationFn: async (data: ParameterFormValues) => {
      return apiRequest("POST", "/api/parameters", data);
    },
    onSuccess: () => {
      toast({
        title: "参数创建成功",
        description: "新参数已成功添加。",
      });
      setIsCreateDialogOpen(false);
      createForm.reset();
      queryClient.invalidateQueries({ queryKey: ['/api/parameters'] });
      // 主动刷新表格数据
      setTimeout(() => refetch(), 100);
    },
    onError: (error: any) => {
      toast({
        title: "参数创建失败",
        description: error.message || "创建参数时出错，请重试。",
        variant: "destructive",
      });
    }
  });

  // Update parameter mutation
  const updateParameterMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: ParameterFormValues }) => {
      return apiRequest("PUT", `/api/parameters/${id}`, data);
    },
    onSuccess: () => {
      toast({
        title: "参数更新成功",
        description: "参数信息已成功更新。",
      });
      setIsEditDialogOpen(false);
      setSelectedParameter(null);
      queryClient.invalidateQueries({ queryKey: ['/api/parameters'] });
      // 主动刷新表格数据
      setTimeout(() => refetch(), 100);
    },
    onError: (error: any) => {
      toast({
        title: "参数更新失败",
        description: error.message || "更新参数时出错，请重试。",
        variant: "destructive",
      });
    }
  });

  // Delete parameter mutation
  const deleteParameterMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/parameters/${id}`);
    },
    onSuccess: () => {
      toast({
        title: "参数删除成功",
        description: "参数已成功删除。",
      });
      setIsDeleteDialogOpen(false);
      setSelectedParameter(null);
      queryClient.invalidateQueries({ queryKey: ['/api/parameters'] });
      // 主动刷新表格数据
      setTimeout(() => refetch(), 100);
    },
    onError: (error: any) => {
      toast({
        title: "参数删除失败",
        description: error.message || "删除参数时出错，请重试。",
        variant: "destructive",
      });
    }
  });

  // Handle create form submission
  const onCreateSubmit = (data: ParameterFormValues) => {
    createParameterMutation.mutate(data);
  };

  // Handle edit form submission
  const onEditSubmit = (data: ParameterFormValues) => {
    if (selectedParameter) {
      updateParameterMutation.mutate({ id: selectedParameter.id, data });
    }
  };

  // Handle delete confirmation
  const onDeleteConfirm = () => {
    if (selectedParameter) {
      deleteParameterMutation.mutate(selectedParameter.id);
    }
  };

  // Functions to handle dialog open/close
  const openCreateDialog = () => {
    createForm.reset({
      key: "",
      value: "",
      description: ""
    });
    setIsCreateDialogOpen(true);
  };

  const openEditDialog = (parameter: Parameter) => {
    setSelectedParameter(parameter);
    editForm.reset({
      key: parameter.key,
      value: parameter.value,
      description: parameter.description || ""
    });
    setIsEditDialogOpen(true);
  };

  const openDeleteDialog = (parameter: Parameter) => {
    setSelectedParameter(parameter);
    setIsDeleteDialogOpen(true);
  };

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="bg-white rounded-xl shadow-md overflow-hidden mb-8">
        <div className="border-b border-neutral-200 px-6 py-4 flex items-center">
          <Link href="/admin/resources">
            <Button variant="ghost" size="icon" className="mr-2">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h2 className="text-xl font-bold">系统参数管理</h2>
        </div>
        
        <Tabs value={tab} onValueChange={setTab}>
          <TabsContent value="parameters" className="p-6">
            <div className="mb-6 flex justify-between items-center">
              <div className="flex items-center">
                <Settings className="h-5 w-5 mr-2 text-primary" />
                <h3 className="text-lg font-semibold">系统参数</h3>
              </div>
              <Button onClick={openCreateDialog} size="sm" className="flex items-center gap-1">
                <Plus className="h-4 w-4" />
                添加参数
              </Button>
            </div>

            {isLoading ? (
              <div className="py-10 flex justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : isError ? (
              <div className="py-10 text-center text-red-500">
                加载参数数据失败，请刷新页面重试
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[80px]">ID</TableHead>
                      <TableHead className="w-[200px]">参数键</TableHead>
                      <TableHead className="w-[300px]">参数值</TableHead>
                      <TableHead className="w-[300px]">描述</TableHead>
                      <TableHead className="w-[150px]">创建时间</TableHead>
                      <TableHead className="w-[150px]">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parameters.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-6">
                          暂无参数数据
                        </TableCell>
                      </TableRow>
                    ) : (
                      parameters.map((parameter) => (
                        <TableRow key={parameter.id}>
                          <TableCell>{parameter.id}</TableCell>
                          <TableCell>
                            <div className="font-medium">{parameter.key}</div>
                          </TableCell>
                          <TableCell>
                            <div className="max-w-[300px] break-words overflow-hidden text-ellipsis">
                              {parameter.value}
                            </div>
                          </TableCell>
                          <TableCell>
                            {parameter.description || '-'}
                          </TableCell>
                          <TableCell>
                            {parameter.created_at ? new Date(parameter.created_at as Date).toLocaleString('zh-CN', {
                              year: 'numeric',
                              month: '2-digit',
                              day: '2-digit'
                            }) : '-'}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button 
                                onClick={() => openEditDialog(parameter)} 
                                size="sm" 
                                variant="outline"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button 
                                onClick={() => openDeleteDialog(parameter)} 
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

      {/* Create Parameter Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>添加新参数</DialogTitle>
          </DialogHeader>
          <Form {...createForm}>
            <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-4">
              <FormField
                control={createForm.control}
                name="key"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>参数键</FormLabel>
                    <FormControl>
                      <Input placeholder="输入参数键" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={createForm.control}
                name="value"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>参数值</FormLabel>
                    <FormControl>
                      <Input placeholder="输入参数值" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={createForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>描述</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="输入参数描述（可选）" 
                        className="resize-none" 
                        {...field} 
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
                  disabled={createParameterMutation.isPending}
                >
                  {createParameterMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  添加
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit Parameter Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>编辑参数</DialogTitle>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
              <FormField
                control={editForm.control}
                name="key"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>参数键</FormLabel>
                    <FormControl>
                      <Input placeholder="输入参数键" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={editForm.control}
                name="value"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>参数值</FormLabel>
                    <FormControl>
                      <Input placeholder="输入参数值" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={editForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>描述</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="输入参数描述（可选）" 
                        className="resize-none" 
                        {...field} 
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
                  disabled={updateParameterMutation.isPending}
                >
                  {updateParameterMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  保存
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Parameter Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            {selectedParameter && (
              <p>您确定要删除参数 "{selectedParameter.key}" 吗？该操作不可恢复。</p>
            )}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">取消</Button>
            </DialogClose>
            <Button 
              variant="destructive" 
              onClick={onDeleteConfirm}
              disabled={deleteParameterMutation.isPending}
            >
              {deleteParameterMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}