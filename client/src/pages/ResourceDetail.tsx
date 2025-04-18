import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { 
  ArrowLeft, 
  Clock, 
  FileText, 
  Globe, 
  Subtitles, 
  MonitorSmartphone, 
  Star, 
  StarHalf, 
  Download, 
  Heart,
  CheckCircle,
  Copy,
  Key
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import ReviewSection from "@/components/ReviewSection";
import CourseSyllabus from "@/components/CourseSyllabus";
import SEO from "@/components/SEO";

export default function ResourceDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const [tab, setTab] = useState("details");
  const [isFavorited, setIsFavorited] = useState(false);
  const [isFavoriteLoading, setIsFavoriteLoading] = useState(false);
  const [copying, setCopying] = useState(false);

  // Fetch resource detail
  const { data: resource = {}, isLoading } = useQuery<any>({
    queryKey: [`/api/resources/${id}`],
  });
  
  // 检查是否已收藏
  useEffect(() => {
    if (!user || !id) return;
    
    const checkFavorite = async () => {
      try {
        const response = await apiRequest('GET', `/api/resources/${id}/favorite/check`);
        
        if (response.success) {
          setIsFavorited(response.favorited);
        }
      } catch (error) {
        console.error('Error checking favorite status:', error);
      }
    };
    
    checkFavorite();
  }, [id, user]);

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-40 mb-6"></div>
          <div className="bg-white rounded-xl shadow-md overflow-hidden mb-8">
            <div className="md:flex">
              <div className="md:w-2/3 p-6 md:p-8">
                <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
                <div className="h-8 bg-gray-200 rounded w-3/4 mb-4"></div>
                <div className="h-4 bg-gray-200 rounded w-full mb-6"></div>
                <div className="flex flex-wrap gap-2 mb-6">
                  <div className="h-4 bg-gray-200 rounded w-16"></div>
                  <div className="h-4 bg-gray-200 rounded w-16"></div>
                  <div className="h-4 bg-gray-200 rounded w-16"></div>
                </div>
                <div className="h-6 bg-gray-200 rounded w-1/2 mb-6"></div>
                <div className="h-10 bg-gray-200 rounded w-full mb-8"></div>
                <div className="border-t border-neutral-200 pt-6">
                  <div className="h-6 bg-gray-200 rounded w-1/4 mb-3"></div>
                  <div className="flex">
                    <div className="w-12 h-12 bg-gray-200 rounded-full mr-4"></div>
                    <div>
                      <div className="h-5 bg-gray-200 rounded w-24 mb-2"></div>
                      <div className="h-4 bg-gray-200 rounded w-full"></div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="md:w-1/3 bg-neutral-50 p-6 md:p-8">
                <div className="h-8 bg-gray-200 rounded w-1/2 mb-2"></div>
                <div className="h-5 bg-gray-200 rounded w-1/3 mb-4"></div>
                <div className="space-y-3 mb-6">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="h-4 bg-gray-200 rounded w-full"></div>
                  ))}
                </div>
                <div className="h-36 bg-gray-200 rounded mb-6"></div>
                <div className="h-10 bg-gray-200 rounded w-full"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!resource) {
    return (
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-white rounded-xl shadow-md p-8 text-center">
          <h2 className="text-2xl font-bold mb-4">资源不存在</h2>
          <p className="mb-6">您访问的资源可能已被删除或不存在。</p>
          <Link href="/resources">
            <Button>返回资源列表</Button>
          </Link>
        </div>
      </div>
    );
  }

  const isFree = resource.is_free;
  // 确保price是数字
  const price = typeof resource.price === 'string' ? parseFloat(resource.price) : (resource.price || 0);
  const originalPrice = price * 1.5; // Just for display purposes
  // Now we get actual rating from the reviews API
  
  const handleDownload = async () => {
    if (!user) {
      toast({
        title: "请先登录",
        description: `您需要登录后才能${resource.resource_url ? '下载资源' : '接收上架通知'}。`,
        variant: "destructive",
      });
      return;
    }
    
    // 如果资源没有下载链接，则处理预售通知逻辑
    if (!resource.resource_url) {
      try {
        // 添加上架通知记录
        const notifyResponse = await apiRequest('POST', `/api/resources/${id}/notify`);
        
        // 添加到收藏
        const favoriteResponse = await apiRequest('POST', `/api/resources/${id}/favorite`);
        
        if (favoriteResponse.success) {
          setIsFavorited(true);
          toast({
            title: "预售通知已设置",
            description: "当资源正式上架后，我们将通过邮件通知您。已自动添加到您的收藏夹。",
          });
        } else {
          toast({
            title: "预售通知已设置",
            description: "当资源正式上架后，我们将通过邮件通知您。",
          });
        }
      } catch (error) {
        console.error('Error setting up notification:', error);
        toast({
          title: "预售通知已设置",
          description: "当资源正式上架后，我们将通过邮件通知您。",
        });
      }
      return;
    }

    // 处理购买或获取资源的逻辑
    try {
      // 先检查用户是否有足够的积分购买非免费资源
      // 高级会员(premium)才能免费下载资源，且必须在有效期内才能享受该特权
      const isMembershipValid = user.membership_type === 'premium' && 
                              (!user.membership_expire_time || new Date(user.membership_expire_time) > new Date());
      
      // 注释掉前端积分验证，让后端处理支付逻辑
      // 仅记录日志，不做拦截
      console.log('用户积分情况：', {
        isFree,
        isMembershipValid,
        userCoins: user.coins || 0,
        price,
        resourceId: id,
        isEnough: (user.coins || 0) >= price || isFree || isMembershipValid
      });
      
      // 发送购买请求
      const response = await fetch(`/api/resources/${id}/purchase`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include'
      });
      
      const data = await response.json();
      
      // 处理积分不足需要支付的情况（返回200但success=false且有payment_required标记）
      if (response.ok && !data.success && data.payment_required && data.payment) {
        console.log('积分不足，处理支付流程 - 状态码200:', data);
        
        toast({
          title: "积分不足，正在处理支付",
          description: `需要${data.required || price}积分，即将跳转到支付页面。`,
          variant: "default",
        });
        
        // 创建支付表单并自动提交到弹出窗口
        const { payment_url, payment_params } = data.payment;
        
        // 创建一个弹出窗口
        const width = 800;
        const height = 600;
        const left = (window.innerWidth - width) / 2;
        const top = (window.innerHeight - height) / 2;
        const popup = window.open('about:blank', 'paymentWindow', 
          `width=${width},height=${height},left=${left},top=${top},location=yes,resizable=yes,status=yes`);
        
        if (!popup) {
          // 如果弹出窗口被阻止，则提示用户
          toast({
            title: "弹出窗口被阻止",
            description: "请允许弹出窗口以完成支付",
            variant: "destructive",
          });
          return;
        }
        
        // 在弹出窗口中创建表单
        popup.document.write('<html><head><title>正在前往支付页面，请稍候...</title></head><body></body></html>');
        const form = popup.document.createElement('form');
        form.method = 'POST';
        form.action = payment_url;
        
        // 添加所有参数
        for (const [key, value] of Object.entries(payment_params)) {
          const input = popup.document.createElement('input');
          input.type = 'hidden';
          input.name = key;
          input.value = String(value);
          form.appendChild(input);
        }
        
        // 添加到弹出窗口并提交
        popup.document.body.appendChild(form);
        form.submit();
        
        toast({
          title: "正在前往支付页面",
          description: "请在完成支付后返回此页面刷新",
          duration: 5000,
        });
        return;
      }
      
      // 请求成功处理 - 用户积分足够的情况
      if (response.ok && data.success) {
        let message = data.message || "资源获取成功";
        
        // 根据响应消息类型显示不同的提示
        if (data.message && data.message.includes('已购买过')) {
          toast({
            title: "已购买过此资源",
            description: "无需重复购买，直接获取",
          });
        } else {
          toast({
            title: "获取成功",
            description: message,
          });
          
          // 更新积分
          if (data.remaining_coins !== undefined && user) {
            user.coins = data.remaining_coins;
          }
        }
        
        // 打开资源链接
        if (data.resource_url) {
          window.open(data.resource_url, '_blank');
          toast({
            title: "资源链接已打开",
            description: "请在新窗口查看资源下载链接",
          });
        } else {
          toast({
            title: "开始下载",
            description: "资源下载已开始，请稍候...",
          });
          
          // Simulate download
          setTimeout(() => {
            toast({
              title: "下载完成",
              description: "资源已成功下载到您的设备。",
            });
          }, 2000);
        }
        return;
      }
      
      // 请求失败处理
      // 如果用户当天的购买数量达到上限
      if (response.status === 400 && data.message && data.message.includes('已达到购买限制')) {
        toast({
          title: "购买失败",
          description: data.message || "您今天已达到购买限制（每天最多购买5条资源），请明天再来",
          variant: "destructive",
        });
        return;
      }
      
      // 如果用户积分不足 (状态码400)
      if (response.status === 400 && data.message === '积分不足') {
        console.log('积分不足，处理支付流程 - 状态码400:', data);
        
        // 检查是否返回了支付信息
        if (data.payment_required && data.payment) {
          console.log('有支付信息，处理支付 - 状态码400:', data.payment);
          
          toast({
            title: "积分不足，正在处理支付",
            description: `需要${data.required || price}积分，即将跳转到支付页面。`,
            variant: "default",
          });
          
          // 创建支付表单并自动提交到弹出窗口
          const { payment_url, payment_params } = data.payment;
          
          // 创建一个弹出窗口
          const width = 800;
          const height = 600;
          const left = (window.innerWidth - width) / 2;
          const top = (window.innerHeight - height) / 2;
          const popup = window.open('about:blank', 'paymentWindow', 
            `width=${width},height=${height},left=${left},top=${top},location=yes,resizable=yes,status=yes`);
          
          if (!popup) {
            // 如果弹出窗口被阻止，则提示用户
            toast({
              title: "弹出窗口被阻止",
              description: "请允许弹出窗口以完成支付",
              variant: "destructive",
            });
            return;
          }
          
          // 在弹出窗口中创建表单
          popup.document.write('<html><head><title>正在前往支付页面，请稍候...</title></head><body></body></html>');
          const form = popup.document.createElement('form');
          form.method = 'POST';
          form.action = payment_url;
          
          // 添加所有参数
          for (const [key, value] of Object.entries(payment_params)) {
            const input = popup.document.createElement('input');
            input.type = 'hidden';
            input.name = key;
            input.value = String(value);
            form.appendChild(input);
          }
          
          // 添加到弹出窗口并提交
          popup.document.body.appendChild(form);
          form.submit();
          
          toast({
            title: "正在前往支付页面",
            description: "请在完成支付后返回此页面刷新",
            duration: 5000,
          });
        } else {
          // 旧的处理方式：提示充值
          toast({
            title: "积分不足",
            description: `您当前积分为${data.available || 0}，需要${data.required || price}积分。请先充值。`,
            variant: "destructive",
          });
          
          // 提示充值
          if (window.confirm("您的积分不足，是否前往充值页面？")) {
            // 跳转到充值页面
            window.location.href = "/profile?tab=coins";
          }
        }
        return;
      }
      
      // 其他错误情况
      toast({
        title: "获取资源失败",
        description: data.message || "请稍后再试",
        variant: "destructive",
      });
      
    } catch (error) {
      console.error("获取/购买资源时出错:", error);
      toast({
        title: "操作失败",
        description: "服务器错误，请稍后再试",
        variant: "destructive",
      });
    }
  };



  // 复制密码到剪贴板的函数
  const handleCopyPasswordToClipboard = async () => {
    // 检查用户是否已登录
    if (!user) {
      toast({
        title: "请先登录",
        description: "您需要登录后才能获取资源提取码。",
        variant: "destructive",
      });
      return;
    }
    
    if (!resource || !resource.resource_code) {
      toast({
        title: "无法复制密码",
        description: "该资源没有提取码",
        variant: "destructive",
      });
      return;
    }
    
    setCopying(true);
    
    try {
      await navigator.clipboard.writeText(resource.resource_code);
      toast({
        title: "复制成功",
        description: "资源提取码已复制到剪贴板",
      });
    } catch (error) {
      console.error('Error copying password to clipboard:', error);
      toast({
        title: "复制失败",
        description: "请手动复制提取码",
        variant: "destructive",
      });
    } finally {
      setCopying(false);
    }
  };

  const handleAddToFavorites = async () => {
    if (!user) {
      toast({
        title: "请先登录",
        description: "您需要登录后才能收藏资源。",
        variant: "destructive",
      });
      return;
    }
    
    if (isFavoriteLoading) return;
    
    setIsFavoriteLoading(true);
    
    try {
      if (isFavorited) {
        // 取消收藏
        const response = await apiRequest('DELETE', `/api/resources/${id}/favorite`);
        
        if (response.success) {
          setIsFavorited(false);
          toast({
            title: "已取消收藏",
            description: "资源已从您的收藏夹中移除",
          });
        }
      } else {
        // 添加收藏
        const response = await apiRequest('POST', `/api/resources/${id}/favorite`);
        
        if (response.success) {
          setIsFavorited(true);
          toast({
            title: "收藏成功",
            description: "资源已添加到您的收藏夹",
          });
        }
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
      toast({
        title: "操作失败",
        description: "请稍后再试",
        variant: "destructive",
      });
    } finally {
      setIsFavoriteLoading(false);
    }
  };

  // 为资源详情页面创建结构化数据
  const generateResourceSchema = () => {
    if (!resource || !resource.id) return null;
    
    // 创建课程结构化数据
    const courseSchema = {
      "@context": "https://schema.org",
      "@type": "Course",
      "name": resource.title || "",
      "description": resource.description || resource.subtitle || "",
      "provider": {
        "@type": "Organization",
        "name": "资源宝",
        "sameAs": "https://resourcetreasure.replit.app/"
      }
    };
    
    // 为视频类型资源添加特定属性
    if (resource.resource_type === 'video') {
      return {
        ...courseSchema,
        "timeRequired": resource.video_duration ? `PT${Math.floor(resource.video_duration)}M` : undefined,
        "educationalCredentialAwarded": "技能证书"
      };
    }
    
    // 为电子书类型资源添加特定属性
    if (resource.resource_type === 'ebook') {
      return {
        "@context": "https://schema.org",
        "@type": "Book",
        "name": resource.title || "",
        "description": resource.description || resource.subtitle || "",
        "author": resource.author ? {
          "@type": "Person",
          "name": resource.author.name || "未知作者"
        } : undefined,
        "publisher": {
          "@type": "Organization",
          "name": "资源宝"
        }
      };
    }
    
    return courseSchema;
  };
  
  // 生成SEO描述
  const generateDescription = () => {
    let desc = resource.subtitle || "";
    if (resource.description) {
      // 从markdown中提取纯文本，并截取前150个字符作为描述
      const plainText = resource.description.replace(/[#*_`~]/g, '').replace(/\n/g, ' ').trim();
      desc = (plainText.length > 150) ? `${plainText.substring(0, 150)}...` : plainText;
    }
    return desc || `${resource.title} - 资源宝分享的优质学习资源，助您快速掌握相关技能。`;
  };
  
  // 生成关键词
  const generateKeywords = () => {
    const keywords = [`${resource.title}`, "学习资源", "视频教程"];
    if (resource.category) {
      keywords.push(resource.category.name);
    }
    return keywords.join(',');
  };
  
  return (
    <>
      {!isLoading && resource && resource.id && (
        <SEO 
          title={`${resource.title} - 资源宝`}
          description={generateDescription()}
          keywords={generateKeywords()}
          ogImage={resource.cover_image || "https://resourcetreasure.replit.app/images/og-image.jpg"}
          ogType="article"
          path={`resources/${id}`}
          schema={JSON.stringify(generateResourceSchema())}
        />
      )}
      <div className="container mx-auto px-4 sm:px-6 py-6 max-w-[1400px]">
      <div className="mb-4">
        <Link href="/resources">
          <a className="text-primary hover:text-blue-700 flex items-center text-sm font-medium">
            <ArrowLeft className="mr-1 h-4 w-4" /> 返回资源列表
          </a>
        </Link>
      </div>
      

      
      {/* 使用grid grid-cols-12系统进行9:3比例布局 */}
      <div className="grid grid-cols-12 gap-6">
        {/* 左侧主内容区域 - 9/12比例 */}
        <div className="col-span-12 lg:col-span-9 space-y-6">
          {/* 资源基本信息卡片 */}
          <div className="bg-white rounded-xl shadow-md overflow-hidden p-6">
            <div className="flex flex-wrap gap-2 mb-3">
              {resource.category && (
                <Badge variant="outline" className="bg-blue-100 text-primary border-0">
                  {resource.category.name}
                </Badge>
              )}
              <Badge variant="outline" className="bg-neutral-100 text-neutral-800 border-0">
                前端开发
              </Badge>
              <Badge variant="outline" className="bg-neutral-100 text-neutral-800 border-0">
                React
              </Badge>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              {/* 左侧内容: 标题、价格、评分 */}
              <div className="md:col-span-7">
                <h1 className="text-2xl md:text-3xl font-bold mb-2">{resource.title}</h1>
                <p className="text-neutral-600 mb-3">{resource.subtitle || 'No description available'}</p>
                
                <div className="mb-4">
                  <div className="flex items-center mb-1">
                    <div className="text-4xl font-bold text-neutral-900">
                      {isFree ? '免费' : `${Math.round(price)} 积分`}
                    </div>
                    {!isFree && (
                      <div className="text-neutral-500 line-through ml-3 mt-1">
                        原价: {Math.round(originalPrice)} 积分
                      </div>
                    )}
                  </div>
                  {isFree && (
                    <div className="bg-green-100 text-green-800 text-sm px-2 py-0.5 rounded mt-2 inline-block">
                      限时免费，距结束还有 2 天
                    </div>
                  )}
                </div>
                
                <div className="flex items-center mb-4">
                  <div className="flex items-center text-amber-500 mr-3">
                    <Star className="h-4 w-4 fill-current" />
                    <Star className="h-4 w-4 fill-current" />
                    <Star className="h-4 w-4 fill-current" />
                    <Star className="h-4 w-4 fill-current" />
                    <StarHalf className="h-4 w-4 fill-current" />
                    <span className="ml-1 text-neutral-800 font-medium">4.5</span>
                  </div>
                  <span className="text-neutral-500 text-sm">(526 评价)</span>
                </div>
                
                {/* 课程内容要点 */}
                <div className="space-y-2 md:mt-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <div className="flex items-center">
                      <CheckCircle className="h-5 w-5 text-green-500 mr-2 flex-shrink-0" />
                      <span>终身访问所有课程内容</span>
                    </div>
                    <div className="flex items-center">
                      <CheckCircle className="h-5 w-5 text-green-500 mr-2 flex-shrink-0" />
                      <span>源代码和项目文件下载</span>
                    </div>
                    <div className="flex items-center">
                      <CheckCircle className="h-5 w-5 text-green-500 mr-2 flex-shrink-0" />
                      <span>完整中英字幕</span>
                    </div>
                    <div className="flex items-center">
                      <CheckCircle className="h-5 w-5 text-green-500 mr-2 flex-shrink-0" />
                      <span>移动端和TV端支持</span>
                    </div>
                    <div className="flex items-center">
                      <CheckCircle className="h-5 w-5 text-green-500 mr-2 flex-shrink-0" />
                      <span>课程完成证书</span>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* 右侧内容: 文件信息和下载按钮 */}
              <div className="md:col-span-5">
                {/* 文件信息 */}
                <div className="bg-neutral-50 p-4 rounded-lg mb-4">
                  <h3 className="font-semibold text-lg mb-2">文件信息</h3>
                  <div className="grid grid-cols-2 gap-y-2">
                    <span className="text-neutral-600">格式:</span>
                    <span className="font-medium text-right">MP4, PDF</span>
                    
                    <span className="text-neutral-600">大小:</span>
                    <span className="font-medium text-right">{resource.video_size ? `${resource.video_size} GB` : '1.80 GB'}</span>
                    
                    <span className="text-neutral-600">更新日期:</span>
                    <span className="font-medium text-right">{resource.updated_at ? new Date(resource.updated_at).toLocaleDateString() : '2025/4/2'}</span>
                    
                    {resource.source_type && (
                      <>
                        <span className="text-neutral-600">资源来源:</span>
                        <span className="font-medium text-right">{resource.source_type === 'feifei' ? '菲菲资源' : resource.source_type}</span>
                      </>
                    )}
                  </div>
                  
                  <div className="mt-4 pt-3 border-t border-neutral-200 space-y-2">
                    {resource.preview_url && (
                      <a 
                        href={resource.preview_url} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="inline-flex items-center justify-center w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md shadow-sm"
                      >
                        <Globe className="mr-2 h-4 w-4" />
                        查看预览
                      </a>
                    )}
                    
                    {/* 移除访问原始页面按钮 */}
                  </div>
                </div>
                
                <div className="flex flex-col gap-3">
                  <div className="flex gap-2">
                    <Button onClick={handleDownload} size="lg" className="flex-1 text-base py-5">
                      {resource.resource_url ? '立即获取' : '上架通知'}
                    </Button>
                    {resource.resource_code && (
                      <Button 
                        onClick={handleCopyPasswordToClipboard}
                        variant="secondary" 
                        size="lg"
                        disabled={copying}
                        className="px-3 py-5 bg-green-50 text-green-600 hover:bg-green-100 border-green-200"
                      >
                        {copying ? <Copy className="h-5 w-5 animate-pulse" /> : <Key className="h-5 w-5" />}
                        <span className="ml-1">密码</span>
                      </Button>
                    )}
                    <Button 
                      onClick={handleAddToFavorites} 
                      variant={isFavorited ? "secondary" : "outline"} 
                      className={`px-2 ${isFavorited ? 'bg-red-50 text-red-500 hover:bg-red-100 border-red-200' : ''}`}
                      disabled={isFavoriteLoading}
                      size="icon"
                    >
                      <Heart className={`h-5 w-5 ${isFavorited ? 'fill-red-500 text-red-500' : ''}`} />
                    </Button>
                  </div>
                  <div className="text-center text-sm text-neutral-500">
                    已有 {resource.download_count || 12569} 人{resource.resource_url ? '下载' : '关注'}此资源
                  </div>
                </div>
              </div>
            </div>
            
            <div className="hidden">
              {resource.video_duration && (
                <span className="flex items-center">
                  <Clock className="h-4 w-4 mr-1" /> 总时长: {resource.video_duration} 分钟
                </span>
              )}
              
              {resource.video_url && (
                <span className="flex items-center">
                  <FileText className="h-4 w-4 mr-1" /> 课时: {Math.floor(Math.random() * 180 + 20)} 讲
                </span>
              )}
              
              {resource.language && (
                <span className="flex items-center">
                  <Globe className="h-4 w-4 mr-1" /> 语言: {resource.language}
                </span>
              )}
              
              {resource.subtitle_languages && (
                <span className="flex items-center">
                  <Subtitles className="h-4 w-4 mr-1" /> 字幕: {resource.subtitle_languages}
                </span>
              )}
              
              {resource.resolution && (
                <span className="flex items-center">
                  <MonitorSmartphone className="h-4 w-4 mr-1" /> 分辨率: {resource.resolution}
                </span>
              )}
            </div>
          </div>
          
          {/* 详情选项卡区域 */}
          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            <Tabs value={tab} onValueChange={setTab}>
              <div className="border-b border-neutral-200">
                <TabsList className="h-auto px-5">
                  <TabsTrigger value="details" className="px-6 py-4 data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary">
                    课程详情
                  </TabsTrigger>
                  <TabsTrigger value="contents" className="px-6 py-4 data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary">
                    课程目录
                  </TabsTrigger>
                  <TabsTrigger value="reviews" className="px-6 py-4 data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary">
                    用户评价
                  </TabsTrigger>
                  <TabsTrigger value="faq" className="px-6 py-4 data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary">
                    常见问题
                  </TabsTrigger>
                  {resource.details && (
                    <TabsTrigger value="html_details" className="px-6 py-4 data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary">
                      详情介绍
                    </TabsTrigger>
                  )}
                </TabsList>
              </div>
              
              <TabsContent value="details" className="p-5 md:p-8 mx-auto">
                {resource.description ? (
                  <div className="prose prose-blue max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {resource.description}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <>
                    <p className="mb-4">本课程是一个完整的 React.js 学习指南，从基础概念到高级应用，全面覆盖 React 开发所需的各项技能。无论你是完全的初学者还是想提升 React 技能的开发者，这门课程都能满足你的需求。</p>
                    
                    <p className="mb-4">课程使用最新的 React 18 版本，深入讲解了函数式组件、Hooks、Context API、Redux 状态管理以及现代 React 应用的性能优化技巧。通过实践项目，你将学会如何构建专业、可扩展的 React 应用程序。</p>
                    
                    <div className="mb-6">
                      <h4 className="font-semibold mb-2">你将学到什么:</h4>
                      <ul className="list-disc pl-5 space-y-1">
                        <li>React 基础概念与工作原理</li>
                        <li>组件化开发与重用</li>
                        <li>React Hooks 的全面应用</li>
                        <li>状态管理策略 (Context API, Redux, Zustand)</li>
                        <li>React 路由与 SPA 应用开发</li>
                        <li>处理表单与用户输入</li>
                        <li>API 集成与数据获取</li>
                        <li>性能优化与最佳实践</li>
                        <li>测试 React 应用</li>
                        <li>3 个完整的实战项目</li>
                      </ul>
                    </div>
                    
                    <div className="mb-6">
                      <h4 className="font-semibold mb-2">适合人群:</h4>
                      <ul className="list-disc pl-5 space-y-1">
                        <li>想要学习 React 的前端开发初学者</li>
                        <li>希望提升 React 技能的开发者</li>
                        <li>需要更新到 React 18 知识的开发人员</li>
                        <li>前端开发或全栈开发工程师</li>
                      </ul>
                    </div>
                    
                    <div>
                      <h4 className="font-semibold mb-2">先决条件:</h4>
                      <ul className="list-disc pl-5 space-y-1">
                        <li>基本的 HTML, CSS 和 JavaScript 知识</li>
                        <li>了解 ES6+ 语法会有所帮助</li>
                        <li>不需要任何 React 经验，课程从基础开始讲解</li>
                      </ul>
                    </div>
                  </>
                )}
              </TabsContent>
              
              <TabsContent value="contents" className="p-5 md:p-8 mx-auto">
                {resource.contents ? (
                  <>
                    <CourseSyllabus contentsJson={resource.contents} />
                    
                    <div className="mt-12 pt-6 border-t border-neutral-200">
                      <div className="text-sm text-neutral-600 bg-neutral-50 p-4 rounded-lg">
                        <h4 className="font-medium text-neutral-800 mb-2">版权免责声明：</h4>
                        <p>本站所有文章，如无特殊说明或标注，均为本站原创发布。任何个人或组织，在未征得本站同意时，禁止复制、盗用、采集、发布本站内容到任何网站、书籍等各类媒体平台。如若本站内容侵犯了原著者的合法权益，可联系我们进行处理。</p>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="p-4 bg-neutral-50 text-neutral-500 rounded-md text-center">
                    暂无课程目录信息
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="reviews" className="p-5 md:p-8 mx-auto">
                <ReviewSection resourceId={id || 0} />
              </TabsContent>
              
              <TabsContent value="faq" className="p-5 md:p-8 mx-auto">
                <h3 className="text-xl font-bold mb-5">常见问题</h3>
                {resource.faq_content ? (
                  <div className="prose prose-blue max-w-none prose-headings:mt-6 prose-headings:mb-3 prose-p:my-2 prose-li:my-1 prose-hr:my-6">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {resource.faq_content}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <div className="p-4 bg-neutral-50 text-neutral-500 rounded-md text-center">
                    暂无常见问题
                  </div>
                )}
              </TabsContent>
              
              {resource.details && (
                <TabsContent value="html_details" className="p-5 md:p-8 mx-auto">
                  <h3 className="text-xl font-bold mb-5">详情介绍</h3>
                  <div className="prose prose-blue max-w-none">
                    <div dangerouslySetInnerHTML={{ __html: resource.details }} />
                  </div>
                </TabsContent>
              )}
            </Tabs>
          </div>
        </div>
        
        {/* 右侧边栏 - 3/12比例 */}
        <div className="col-span-12 lg:col-span-3 space-y-6">
          {/* 资源封面图片 */}
          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            <img 
              className="w-full object-cover"
              src={
                // 优先使用本地图片路径，如果存在
                resource.local_image_path 
                  ? `/images/${resource.local_image_path.split('/').pop()}` 
                  : (resource.cover_image || '/images/placeholder.svg')
              } 
              alt={resource.title} 
              onError={(e) => {
                // 如果本地图片加载失败，回退到远程图片
                const target = e.target as HTMLImageElement;
                if (resource.local_image_path && target.src.includes('/images/')) {
                  console.log('本地图片加载失败，切换到远程图片');
                  target.src = resource.cover_image || '/images/placeholder.svg';
                }
              }}
            />
          </div>
          
          {/* 作者信息卡片 */}
          <div className="bg-white rounded-xl shadow-md overflow-hidden p-5">
            <h3 className="font-semibold text-lg mb-3">关于作者</h3>
            {resource.author ? (
              <div className="space-y-4">
                <div className="flex items-start">
                  <Avatar className="h-16 w-16 mr-4">
                    <AvatarImage src={resource.author.avatar || "https://images.unsplash.com/photo-1568602471122-7832951cc4c5?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=facearea&facepad=2&w=300&h=300&q=80"} />
                    <AvatarFallback>{resource.author.name?.[0] || '作'}</AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-medium text-lg">{resource.author.name}</div>
                    <div className="text-sm text-neutral-600 mt-1">
                      {resource.author.title || '资深讲师'}
                    </div>
                    
                    {/* 社交媒体链接 - 可根据实际数据调整 */}
                    <div className="flex space-x-2 mt-2">
                      <a href="#" className="text-neutral-500 hover:text-primary">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-globe" viewBox="0 0 16 16">
                          <path d="M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8zm7.5-6.923c-.67.204-1.335.82-1.887 1.855A7.97 7.97 0 0 0 5.145 4H7.5V1.077zM4.09 4a9.267 9.267 0 0 1 .64-1.539 6.7 6.7 0 0 1 .597-.933A7.025 7.025 0 0 0 2.255 4H4.09zm-.582 3.5c.03-.877.138-1.718.312-2.5H1.674a6.958 6.958 0 0 0-.656 2.5h2.49zM4.847 5a12.5 12.5 0 0 0-.338 2.5H7.5V5H4.847zM8.5 5v2.5h2.99a12.495 12.495 0 0 0-.337-2.5H8.5zM4.51 8.5a12.5 12.5 0 0 0 .337 2.5H7.5V8.5H4.51zm3.99 0V11h2.653c.187-.765.306-1.608.338-2.5H8.5zM5.145 12c.138.386.295.744.47 1.068.552 1.035 1.218 1.65 1.887 1.855V12H5.145zm.182 2.472a6.696 6.696 0 0 1-.597-.933A9.268 9.268 0 0 1 4.09 12H2.255a7.024 7.024 0 0 0 3.072 2.472zM3.82 11a13.652 13.652 0 0 1-.312-2.5h-2.49c.062.89.291 1.733.656 2.5H3.82zm6.853 3.472A7.024 7.024 0 0 0 13.745 12H11.91a9.27 9.27 0 0 1-.64 1.539 6.688 6.688 0 0 1-.597.933zM8.5 12v2.923c.67-.204 1.335-.82 1.887-1.855.173-.324.33-.682.468-1.068H8.5zm3.68-1h2.146c.365-.767.594-1.61.656-2.5h-2.49a13.65 13.65 0 0 1-.312 2.5zm2.802-3.5a6.959 6.959 0 0 0-.656-2.5H12.18c.174.782.282 1.623.312 2.5h2.49zM11.27 2.461c.247.464.462.98.64 1.539h1.835a7.024 7.024 0 0 0-3.072-2.472c.218.284.418.598.597.933zM10.855 4a7.966 7.966 0 0 0-.468-1.068C9.835 1.897 9.17 1.282 8.5 1.077V4h2.355z"/>
                        </svg>
                      </a>
                      <a href="#" className="text-neutral-500 hover:text-blue-500">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-linkedin" viewBox="0 0 16 16">
                          <path d="M0 1.146C0 .513.526 0 1.175 0h13.65C15.474 0 16 .513 16 1.146v13.708c0 .633-.526 1.146-1.175 1.146H1.175C.526 16 0 15.487 0 14.854V1.146zm4.943 12.248V6.169H2.542v7.225h2.401zm-1.2-8.212c.837 0 1.358-.554 1.358-1.248-.015-.709-.52-1.248-1.342-1.248-.822 0-1.359.54-1.359 1.248 0 .694.521 1.248 1.327 1.248h.016zm4.908 8.212V9.359c0-.216.016-.432.08-.586.173-.431.568-.878 1.232-.878.869 0 1.216.662 1.216 1.634v3.865h2.401V9.25c0-2.22-1.184-3.252-2.764-3.252-1.274 0-1.845.7-2.165 1.193v.025h-.016a5.54 5.54 0 0 1 .016-.025V6.169h-2.4c.03.678 0 7.225 0 7.225h2.4z"/>
                        </svg>
                      </a>
                      <a href="#" className="text-neutral-500 hover:text-blue-400">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-twitter" viewBox="0 0 16 16">
                          <path d="M5.026 15c6.038 0 9.341-5.003 9.341-9.334 0-.14 0-.282-.006-.422A6.685 6.685 0 0 0 16 3.542a6.658 6.658 0 0 1-1.889.518 3.301 3.301 0 0 0 1.447-1.817 6.533 6.533 0 0 1-2.087.793A3.286 3.286 0 0 0 7.875 6.03a9.325 9.325 0 0 1-6.767-3.429 3.289 3.289 0 0 0 1.018 4.382A3.323 3.323 0 0 1 .64 6.575v.045a3.288 3.288 0 0 0 2.632 3.218 3.203 3.203 0 0 1-.865.115 3.23 3.23 0 0 1-.614-.057 3.283 3.283 0 0 0 3.067 2.277A6.588 6.588 0 0 1 .78 13.58a6.32 6.32 0 0 1-.78-.045A9.344 9.344 0 0 0 5.026 15z"/>
                        </svg>
                      </a>
                    </div>
                  </div>
                </div>
                
                {/* 作者简介 */}
                {resource.author.bio && (
                  <div className="mt-2">
                    <h4 className="text-sm font-medium text-neutral-700 mb-1">作者简介</h4>
                    <p className="text-sm text-neutral-600">{resource.author.bio}</p>
                  </div>
                )}
                
                {/* 教学风格和专长 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                  <div>
                    <h4 className="text-sm font-medium text-neutral-700 mb-1">专业领域</h4>
                    <div className="flex flex-wrap gap-1">
                      <Badge variant="outline" className="bg-neutral-100 text-neutral-800 border-0">
                        前端开发
                      </Badge>
                      <Badge variant="outline" className="bg-neutral-100 text-neutral-800 border-0">
                        React
                      </Badge>
                      <Badge variant="outline" className="bg-neutral-100 text-neutral-800 border-0">
                        JavaScript
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-neutral-700 mb-1">教学经验</h4>
                    <p className="text-sm text-neutral-600">7年+行业经验，5年+教学经验</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-neutral-500 text-sm">暂无作者信息</div>
            )}
          </div>
          
          {/* 可在这里添加其他右侧边栏内容，如相关推荐等 */}
        </div>
      </div>
    </div>
    </>
  );
}
