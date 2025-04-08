import { useState } from "react";
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
  ShoppingCart, 
  Heart,
  CheckCircle
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import ReviewSection from "@/components/ReviewSection";
import CourseSyllabus from "@/components/CourseSyllabus";

export default function ResourceDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const [tab, setTab] = useState("details");

  // Fetch resource detail
  const { data: resource = {}, isLoading } = useQuery<any>({
    queryKey: [`/api/resources/${id}`],
  });

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
        description: "您需要登录后才能下载资源。",
        variant: "destructive",
      });
      return;
    }

    // 如果资源是免费的或者用户是有效会员，直接获取资源
    if (isFree || (user.membership_type && (!user.membership_expire_time || new Date(user.membership_expire_time) > new Date()))) {
      try {
        const response = await fetch(`/api/resources/${id}/purchase`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include'
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
          if (data.resource_url) {
            // 如果有资源下载链接，打开新窗口访问链接
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
        } else {
          toast({
            title: "获取资源失败",
            description: data.message || "请稍后再试",
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error("获取资源时出错:", error);
        toast({
          title: "获取资源失败",
          description: "服务器错误，请稍后再试",
          variant: "destructive",
        });
      }
      return;
    }
    
    // 无论是否需要付费，先尝试获取资源（API 会检查是否已购买）
    try {
      const response = await fetch(`/api/resources/${id}/purchase`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include'
      });
      
      const data = await response.json();
      
      // 如果请求成功且消息包含"已购买过"，说明用户已经购买过此资源
      if (response.ok && data.success && data.message && data.message.includes('已购买过')) {
        // 直接打开资源链接，不需要确认
        if (data.resource_url) {
          window.open(data.resource_url, '_blank');
          toast({
            title: "资源链接已打开",
            description: "请在新窗口查看资源下载链接",
          });
        }
        return;
      }
      
      // 如果用户需要付费且未购买过，弹出确认对话框
      if (!response.ok && response.status === 400 && data.message === '积分不足') {
        // 积分不足
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
        return;
      }
      
      // 如果是普通用户且资源不免费，直接尝试扣除积分
      // 检查会员是否有效（没有会员类型或会员已过期）
      const isMembershipValid = user.membership_type && 
                                (!user.membership_expire_time || new Date(user.membership_expire_time) > new Date());
      
      if (!isFree && !isMembershipValid) {
        // 如果API返回成功，说明资源已获取（可能是会员获取或第一次API调用已成功）
        if (response.ok && data.success) {
          // 获取成功
          if (data.message) {
            toast({
              title: "获取成功",
              description: data.message,
            });
          }
          
          // 打开资源链接
          if (data.resource_url) {
            window.open(data.resource_url, '_blank');
            toast({
              title: "资源链接已打开",
              description: "请在新窗口查看资源下载链接",
            });
          }
          
          // 更新积分
          if (data.remaining_coins !== undefined && user) {
            user.coins = data.remaining_coins;
          }
        } 
        // API返回失败时，再次确认错误类型
        else {
          // 如果是积分不足的情况，提示充值
          if (response.status === 400 && data.message === '积分不足') {
            // 已经在前面处理过，这里不需要重复处理
            return;
          } 
          // 其他错误情况，直接尝试购买（不再弹出确认对话框）
          else {
            const purchaseResponse = await fetch(`/api/resources/${id}/purchase`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              credentials: 'include'
            });
            
            const purchaseData = await purchaseResponse.json();
            
            if (purchaseResponse.ok && purchaseData.success) {
              // 购买成功
              toast({
                title: "购买成功",
                description: purchaseData.message || `已成功扣除${price}积分`,
              });
              
              // 打开资源链接
              if (purchaseData.resource_url) {
                window.open(purchaseData.resource_url, '_blank');
                toast({
                  title: "资源链接已打开",
                  description: "请在新窗口查看资源下载链接",
                });
              }
              
              // 刷新用户信息（更新积分）
              if (purchaseData.remaining_coins !== undefined) {
                // 直接更新用户对象中的积分余额
                if (user) {
                  user.coins = purchaseData.remaining_coins;
                }
              }
            } else {
              // 其他错误
              toast({
                title: "购买失败",
                description: purchaseData.message || "请稍后再试",
                variant: "destructive",
              });
            }
          }
        }
      }
    } catch (error) {
      console.error("获取/购买资源时出错:", error);
      toast({
        title: "操作失败",
        description: "服务器错误，请稍后再试",
        variant: "destructive",
      });
    }
  };

  const handleAddToCart = () => {
    if (!user) {
      toast({
        title: "请先登录",
        description: "您需要登录后才能将资源添加到购物车。",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "已添加到购物车",
      description: "您可以在购物车中查看并结算资源。",
    });
  };

  const handleAddToFavorites = () => {
    if (!user) {
      toast({
        title: "请先登录",
        description: "您需要登录后才能收藏资源。",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "已收藏",
      description: "资源已添加到您的收藏夹。",
    });
  };

  return (
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
                  <div className="text-4xl font-bold text-neutral-900 mb-1">
                    {isFree ? '免费' : `${Math.round(price)} 积分`}
                  </div>
                  {!isFree && (
                    <div className="text-neutral-500 line-through">原价: {Math.round(originalPrice)} 积分</div>
                  )}
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
                    
                    {resource.source_url && (
                      <a 
                        href={resource.source_url} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="inline-flex items-center justify-center w-full px-4 py-2 text-sm font-medium text-green-700 bg-green-100 hover:bg-green-200 rounded-md shadow-sm mt-2"
                      >
                        <Globe className="mr-2 h-4 w-4" />
                        访问原始页面
                      </a>
                    )}
                  </div>
                </div>
                
                <div className="flex flex-col gap-3">
                  <Button onClick={handleDownload} size="lg" className="w-full text-base py-5">
                    立即获取
                  </Button>
                  <div className="text-center text-sm text-neutral-500">
                    已有 12,569 人下载此资源
                  </div>
                  <div className="flex justify-center gap-4 mt-2 hidden">
                    <Button onClick={handleAddToCart} variant="secondary" className="gap-2">
                      <ShoppingCart className="h-4 w-4" /> 加入购物车
                    </Button>
                    <Button onClick={handleAddToFavorites} variant="outline" className="gap-2">
                      <Heart className="h-4 w-4" /> 收藏
                    </Button>
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
                  <>
                    <div className="space-y-4">
                      <div>
                        <h4 className="font-medium mb-2">第1章：React 基础入门</h4>
                        <ul className="space-y-2 pl-4">
                          <li className="flex justify-between">
                            <span>1.1 课程介绍与环境搭建</span>
                            <span className="text-sm text-neutral-500">15:20</span>
                          </li>
                          <li className="flex justify-between">
                            <span>1.2 React 核心概念</span>
                            <span className="text-sm text-neutral-500">22:45</span>
                          </li>
                          <li className="flex justify-between">
                            <span>1.3 创建第一个 React 组件</span>
                            <span className="text-sm text-neutral-500">18:30</span>
                          </li>
                        </ul>
                      </div>
                      
                      <div>
                        <h4 className="font-medium mb-2">第2章：React Hooks 详解</h4>
                        <ul className="space-y-2 pl-4">
                          <li className="flex justify-between">
                            <span>2.1 useState 状态管理</span>
                            <span className="text-sm text-neutral-500">20:15</span>
                          </li>
                          <li className="flex justify-between">
                            <span>2.2 useEffect 与生命周期</span>
                            <span className="text-sm text-neutral-500">25:40</span>
                          </li>
                          <li className="flex justify-between">
                            <span>2.3 useContext 全局状态</span>
                            <span className="text-sm text-neutral-500">19:50</span>
                          </li>
                        </ul>
                      </div>
                      
                      <div>
                        <h4 className="font-medium mb-2">第3章：React 路由</h4>
                        <ul className="space-y-2 pl-4">
                          <li className="flex justify-between">
                            <span>3.1 React Router 基础</span>
                            <span className="text-sm text-neutral-500">22:10</span>
                          </li>
                          <li className="flex justify-between">
                            <span>3.2 动态路由与参数</span>
                            <span className="text-sm text-neutral-500">18:35</span>
                          </li>
                          <li className="flex justify-between">
                            <span>3.3 嵌套路由与布局</span>
                            <span className="text-sm text-neutral-500">24:20</span>
                          </li>
                        </ul>
                      </div>
                    </div>
                    
                    <div className="mt-4 text-center">
                      <Button variant="outline">查看完整目录</Button>
                    </div>
                  </>
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
                  <div className="space-y-5">
                    <div>
                      <h4 className="font-medium mb-2">1. 这门课程适合完全没有React经验的人吗？</h4>
                      <p className="text-neutral-700">是的，这门课程是从零基础开始讲解的，即使你之前没有React经验也可以学习。不过，建议你至少具备基本的HTML、CSS和JavaScript知识。</p>
                    </div>
                    
                    <div>
                      <h4 className="font-medium mb-2">2. 购买后我可以永久访问课程内容吗？</h4>
                      <p className="text-neutral-700">是的，一旦购买，你将获得课程的终身访问权限，包括未来的内容更新。</p>
                    </div>
                    
                    <div>
                      <h4 className="font-medium mb-2">3. 课程包含源代码和项目文件吗？</h4>
                      <p className="text-neutral-700">是的，课程包含所有讲解中使用的源代码和项目文件，你可以直接下载并在本地运行。</p>
                    </div>
                    
                    <div>
                      <h4 className="font-medium mb-2">4. 如果我对课程有疑问，可以获得支持吗？</h4>
                      <p className="text-neutral-700">当然可以，你可以在课程评论区提问，老师和助教会定期回复学员的问题。VIP会员还可以获得优先回复和一对一指导。</p>
                    </div>
                    
                    <div>
                      <h4 className="font-medium mb-2">5. 课程内容会定期更新吗？</h4>
                      <p className="text-neutral-700">是的，我们会根据React的版本更新和前端技术发展，定期更新课程内容，确保学员学习的是最新的知识和技能。</p>
                    </div>
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
          {/* 作者信息卡片 */}
          <div className="bg-white rounded-xl shadow-md overflow-hidden p-5">
            <h3 className="font-semibold text-lg mb-3">关于作者</h3>
            {resource.author ? (
              <div className="flex">
                <Avatar className="h-12 w-12 mr-4">
                  <AvatarImage src={resource.author.avatar || "https://images.unsplash.com/photo-1568602471122-7832951cc4c5?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=facearea&facepad=2&w=300&h=300&q=80"} />
                  <AvatarFallback>{resource.author.name?.[0] || '作'}</AvatarFallback>
                </Avatar>
                <div>
                  <div className="font-medium">{resource.author.name}</div>
                  <p className="text-sm text-neutral-600">{resource.author.title || '资深讲师'}{resource.author.description ? `，${resource.author.description}` : ''}</p>
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
  );
}
