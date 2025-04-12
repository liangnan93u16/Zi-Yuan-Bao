import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { 
  ArrowLeft, 
  Search, 
  RefreshCw, 
  ChevronLeft, 
  ChevronRight,
  Calendar,
  User,
  FileText
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import {
  Card,
  CardContent
} from '@/components/ui/card';

export default function ResourceNotificationsPage() {
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [resourceId, setResourceId] = useState<number | undefined>(undefined);
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  // 获取通知记录
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['/api/admin/resource-notifications', page, resourceId],
    queryFn: async () => {
      let url = `/api/admin/resource-notifications?page=${page}&pageSize=10`;
      if (resourceId) {
        url += `&resourceId=${resourceId}`;
      }
      return fetch(url).then(res => {
        if (!res.ok) throw new Error('获取通知记录失败');
        return res.json();
      });
    }
  });

  // 处理搜索
  const handleSearch = () => {
    // 如果是有效的资源ID
    if (searchTerm && !isNaN(Number(searchTerm))) {
      setResourceId(Number(searchTerm));
      setPage(1); // 重置到第一页
    } else if (searchTerm === '') {
      // 清空搜索条件
      resetFilter();
    } else {
      toast({
        title: "搜索格式错误",
        description: "请输入有效的资源ID",
        variant: "destructive",
      });
    }
  };

  // 重置筛选
  const resetFilter = () => {
    setPage(1);
    setSearchTerm("");
    setResourceId(undefined);
  };

  // 格式化日期时间
  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };
  
  // 判断资源是否为预售状态
  const isPreorder = (resource: any) => {
    return resource && !resource.resource_url;
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">资源上架通知记录</h1>
        <Link href="/admin/resources">
          <Button variant="outline" className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            返回资源管理
          </Button>
        </Link>
      </div>

      {/* 搜索栏 */}
      <div className="bg-white rounded-lg shadow-sm mb-6 p-4">
        <div className="flex gap-2">
          <Input
            placeholder="输入资源ID进行搜索"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-sm"
          />
          <Button onClick={handleSearch}>
            <Search className="h-4 w-4 mr-2" />
            搜索
          </Button>
          {resourceId && (
            <Button variant="outline" onClick={resetFilter}>
              清除筛选
            </Button>
          )}
          <Button variant="outline" onClick={() => refetch()} className="ml-auto">
            <RefreshCw className="h-4 w-4 mr-2" />
            刷新
          </Button>
        </div>
      </div>

      {/* 通知列表 */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-24 text-center">
              <div className="inline-block animate-spin">
                <RefreshCw className="h-8 w-8 text-primary" />
              </div>
              <p className="mt-2 text-neutral-500">加载中...</p>
            </div>
          ) : isError ? (
            <div className="py-24 text-center">
              <p className="text-red-500">加载失败，请重试</p>
              <Button onClick={() => refetch()} variant="outline" className="mt-2">
                重试
              </Button>
            </div>
          ) : data?.notifications?.length > 0 ? (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>用户</TableHead>
                    <TableHead>资源</TableHead>
                    <TableHead>资源状态</TableHead>
                    <TableHead>通知时间</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.notifications.map((notification: any) => (
                    <TableRow key={notification.id}>
                      <TableCell className="font-medium">{notification.id}</TableCell>
                      <TableCell>
                        {notification.user ? (
                          <div className="flex items-center gap-2">
                            {notification.user.avatar && (
                              <img 
                                src={notification.user.avatar} 
                                alt={notification.user.email} 
                                className="h-6 w-6 rounded-full"
                              />
                            )}
                            <span>{notification.user.email}</span>
                          </div>
                        ) : (
                          <span className="text-neutral-500">用户不存在</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {notification.resource ? (
                          <Link href={`/resources/${notification.resource.id}`}>
                            <a className="flex items-center gap-2 text-primary hover:underline">
                              {notification.resource.cover_image && (
                                <img 
                                  src={notification.resource.cover_image} 
                                  alt={notification.resource.title} 
                                  className="h-8 w-8 object-cover rounded"
                                />
                              )}
                              <span title={notification.resource.title}>
                                {notification.resource.title.length > 20
                                  ? notification.resource.title.substring(0, 20) + "..."
                                  : notification.resource.title}
                              </span>
                            </a>
                          </Link>
                        ) : (
                          <span className="text-neutral-500">资源不存在</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {notification.resource ? (
                          isPreorder(notification.resource) ? (
                            <Badge variant="outline" className="bg-amber-100 text-amber-800 border-0">
                              预售中
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-green-100 text-green-800 border-0">
                              已上架
                            </Badge>
                          )
                        ) : (
                          <Badge variant="outline" className="bg-red-100 text-red-800 border-0">
                            已删除
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>{formatDateTime(notification.created_at)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* 分页 */}
              {data.totalPages > 1 && (
                <div className="p-4 flex justify-center">
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious 
                          onClick={() => setPage(p => Math.max(1, p - 1))}
                          isActive={page > 1}
                        />
                      </PaginationItem>
                      
                      {Array.from({ length: data.totalPages }, (_, i) => i + 1)
                        .filter(p => p === 1 || p === data.totalPages || (p >= page - 1 && p <= page + 1))
                        .map((p, i, arr) => {
                          // 如果不是连续的页码，添加省略号
                          if (i > 0 && p > arr[i - 1] + 1) {
                            return (
                              <React.Fragment key={`ellipsis-${p}`}>
                                <PaginationItem>
                                  <PaginationEllipsis />
                                </PaginationItem>
                                <PaginationItem>
                                  <PaginationLink
                                    isActive={page === p}
                                    onClick={() => setPage(p)}
                                  >
                                    {p}
                                  </PaginationLink>
                                </PaginationItem>
                              </React.Fragment>
                            );
                          }
                          return (
                            <PaginationItem key={p}>
                              <PaginationLink
                                isActive={page === p}
                                onClick={() => setPage(p)}
                              >
                                {p}
                              </PaginationLink>
                            </PaginationItem>
                          );
                        })}
                      
                      <PaginationItem>
                        <PaginationNext 
                          onClick={() => setPage(p => Math.min(data.totalPages, p + 1))}
                          isActive={page < data.totalPages}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </>
          ) : (
            <div className="py-24 text-center">
              <div className="flex flex-col items-center justify-center">
                <FileText className="h-12 w-12 text-neutral-300" />
                <p className="mt-4 text-neutral-500">暂无通知记录</p>
                {resourceId && (
                  <Button onClick={resetFilter} variant="outline" className="mt-2">
                    清除筛选查看所有记录
                  </Button>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 统计信息 */}
      {data && (
        <div className="mt-4 text-sm text-neutral-500">
          共 {data.total} 条记录，当前显示第 {page} 页，每页 {data.pageSize} 条
        </div>
      )}
    </div>
  );
}