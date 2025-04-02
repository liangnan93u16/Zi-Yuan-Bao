import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Trash2, Edit, Plus } from "lucide-react";

// 作者类型定义
interface Author {
  id: number;
  name: string;
  avatar: string;
  title: string;
  bio: string;
  created_at: string;
  updated_at: string;
}

// 新增或编辑作者表单类型
interface AuthorFormData {
  name: string;
  avatar: string;
  title: string;
  bio: string;
}

export default function AuthorManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAuthor, setEditingAuthor] = useState<Author | null>(null);
  const [formData, setFormData] = useState<AuthorFormData>({
    name: '',
    avatar: '',
    title: '',
    bio: ''
  });

  // 获取所有作者数据
  const { data: authors = [], isLoading } = useQuery<Author[]>({
    queryKey: ['/api/authors'],
    staleTime: 60000,
  });

  // 创建作者
  const createMutation = useMutation({
    mutationFn: async (data: AuthorFormData) => {
      const response = await fetch('/api/authors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        credentials: 'include'
      });
      
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || response.statusText);
      }
      
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/authors'] });
      toast({
        title: "创建成功",
        description: "作者信息已成功添加。"
      });
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: "创建失败",
        description: error.message || "添加作者信息时出错，请重试。",
        variant: "destructive"
      });
    }
  });

  // 更新作者
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number, data: AuthorFormData }) => {
      const response = await fetch(`/api/authors/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        credentials: 'include'
      });
      
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || response.statusText);
      }
      
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/authors'] });
      toast({
        title: "更新成功",
        description: "作者信息已成功更新。"
      });
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: "更新失败",
        description: error.message || "更新作者信息时出错，请重试。",
        variant: "destructive"
      });
    }
  });

  // 删除作者
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/authors/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || response.statusText);
      }
      
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/authors'] });
      toast({
        title: "删除成功",
        description: "作者信息已成功删除。"
      });
    },
    onError: (error: any) => {
      toast({
        title: "删除失败",
        description: error.message || "删除作者信息时出错，请重试。",
        variant: "destructive"
      });
    }
  });

  // 处理表单提交
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name) {
      toast({
        title: "验证失败",
        description: "作者姓名为必填项。",
        variant: "destructive"
      });
      return;
    }

    if (editingAuthor) {
      updateMutation.mutate({ id: editingAuthor.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
    setIsDialogOpen(false);
  };

  // 处理表单变更
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // 打开编辑对话框
  const openEditDialog = (author: Author) => {
    setEditingAuthor(author);
    setFormData({
      name: author.name,
      avatar: author.avatar || '',
      title: author.title || '',
      bio: author.bio || ''
    });
    setIsDialogOpen(true);
  };

  // 打开新增对话框
  const openNewDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  // 重置表单
  const resetForm = () => {
    setEditingAuthor(null);
    setFormData({
      name: '',
      avatar: '',
      title: '',
      bio: ''
    });
  };

  // 处理取消操作
  const handleCancel = () => {
    resetForm();
    setIsDialogOpen(false);
  };

  // 确认删除
  const confirmDelete = (author: Author) => {
    if (confirm(`确定要删除作者"${author.name}"吗？此操作不可撤销。`)) {
      deleteMutation.mutate(author.id);
    }
  };

  return (
    <div className="container max-w-5xl py-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">作者管理</h1>
        <Button onClick={openNewDialog}>
          <Plus className="mr-2 h-4 w-4" />
          添加作者
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>作者列表</CardTitle>
          <CardDescription>管理平台上的所有作者信息</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-10 text-center">加载中...</div>
          ) : authors && authors.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>头像</TableHead>
                  <TableHead>姓名</TableHead>
                  <TableHead>职称</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {authors.map((author) => (
                  <TableRow key={author.id}>
                    <TableCell>{author.id}</TableCell>
                    <TableCell>
                      <Avatar>
                        <AvatarImage src={author.avatar} alt={author.name} />
                        <AvatarFallback>{author.name.slice(0, 2)}</AvatarFallback>
                      </Avatar>
                    </TableCell>
                    <TableCell className="font-medium">{author.name}</TableCell>
                    <TableCell>{author.title || '暂无'}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => openEditDialog(author)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => confirmDelete(author)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="py-10 text-center">暂无作者数据</div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingAuthor ? '编辑作者' : '添加新作者'}</DialogTitle>
            <DialogDescription>
              请填写作者的详细信息。
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">姓名 *</Label>
                <Input
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="请输入作者姓名"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="avatar">头像URL</Label>
                <Input
                  id="avatar"
                  name="avatar"
                  value={formData.avatar}
                  onChange={handleChange}
                  placeholder="请输入头像URL地址"
                />
                {formData.avatar && (
                  <div className="mt-2">
                    <p className="text-sm text-gray-500 mb-1">预览：</p>
                    <Avatar className="h-16 w-16">
                      <AvatarImage src={formData.avatar} alt="预览" />
                      <AvatarFallback>{formData.name.slice(0, 2)}</AvatarFallback>
                    </Avatar>
                  </div>
                )}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="title">职称</Label>
                <Input
                  id="title"
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  placeholder="请输入作者职称，如'资深前端工程师'"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="bio">简介</Label>
                <Textarea
                  id="bio"
                  name="bio"
                  value={formData.bio}
                  onChange={handleChange}
                  placeholder="请输入作者简介"
                  rows={4}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCancel}>
                取消
              </Button>
              <Button type="submit">
                {editingAuthor ? '更新' : '创建'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}