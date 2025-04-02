import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface LoginLog {
  id: number;
  admin_email: string;
  ip_address: string;
  login_time: string;
  user_agent: string;
  status: boolean;
}

export default function LoginLogs() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredLogs, setFilteredLogs] = useState<LoginLog[]>([]);

  // 获取登录日志
  const {
    data: logs,
    isLoading,
    isError,
    refetch
  } = useQuery<LoginLog[]>({
    queryKey: ["/api/admin/login-logs"],
    enabled: !!user && user.role === "admin"
  });

  // 过滤日志
  useEffect(() => {
    if (!logs) return;

    if (searchTerm.trim() === "") {
      setFilteredLogs(logs);
    } else {
      const filtered = logs.filter(
        (log) =>
          log.admin_email.toLowerCase().includes(searchTerm.toLowerCase()) ||
          log.ip_address.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredLogs(filtered);
    }
  }, [logs, searchTerm]);

  // 如果用户不是管理员，显示无权限消息
  if (user?.role !== "admin") {
    return (
      <div className="container py-10">
        <Card>
          <CardHeader>
            <CardTitle className="text-center text-red-500">权限不足</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-center">您没有权限访问管理员登录日志。</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container py-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold">管理员登录日志</h1>
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <Input
              id="search"
              placeholder="按邮箱或IP地址搜索..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full"
            />
          </div>
          <Button onClick={() => refetch()} size="sm">刷新</Button>
        </div>
      </div>
      <Separator className="my-4" />

      <Card className="shadow-sm">
        <CardContent className="p-0 overflow-x-auto">
          {isLoading ? (
            <div className="flex justify-center items-center p-6">
              <p>加载中...</p>
            </div>
          ) : isError ? (
            <div className="flex justify-center items-center p-6">
              <p className="text-red-500">加载日志时发生错误</p>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="flex justify-center items-center p-6">
              <p>没有找到登录日志</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">ID</TableHead>
                    <TableHead className="w-[200px]">管理员邮箱</TableHead>
                    <TableHead className="w-[150px]">IP地址</TableHead>
                    <TableHead className="w-[180px]">登录时间</TableHead>
                    <TableHead>浏览器</TableHead>
                    <TableHead className="w-[80px] text-center">状态</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-center">{log.id}</TableCell>
                      <TableCell className="font-medium">{log.admin_email}</TableCell>
                      <TableCell className="font-mono text-sm">{log.ip_address}</TableCell>
                      <TableCell className="text-sm">
                        {format(new Date(log.login_time), "yyyy-MM-dd HH:mm:ss")}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                        {log.user_agent}
                      </TableCell>
                      <TableCell className="text-center">
                        {log.status ? (
                          <span className="text-green-500 font-medium">成功</span>
                        ) : (
                          <span className="text-red-500 font-medium">失败</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}