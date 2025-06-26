import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Link, useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { CheckCircle2, Lock, Star, Trophy, Gem } from 'lucide-react';
import { ResourceWithCategory } from '@/lib/types';

export default function Membership() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  
  // Fetch premium resources
  const { data: premiumResourcesData } = useQuery({
    queryKey: ['/api/resources', 'premium'],
    enabled: !!user,
  });

  const membershipPlans = [
    {
      id: 'monthly',
      name: '月度会员',
      price: '9.9',
      period: '月',
      features: [
        '无限下载本月更新资源',
        '会员专属技术支持',
        '优先获取最新资源',
        '资源定制建议权'
      ],
      recommended: false,
      badge: '基础',
      icon: <Star className="w-5 h-5 text-amber-500" />
    },
    {
      id: 'quarterly',
      name: '季度会员',
      price: '24',
      period: '季度',
      features: [
        '无限下载季度内更新资源',
        '会员专属技术支持',
        '优先获取最新资源',
        '资源定制建议权',
        '独家教程视频'
      ],
      recommended: true,
      badge: '推荐',
      savePercent: '20%',
      icon: <Trophy className="w-5 h-5 text-amber-500" />
    },
    {
      id: 'yearly',
      name: '年度会员',
      price: '72',
      period: '年',
      features: [
        '无限下载全年更新资源',
        'VIP专属技术支持',
        '最先获取所有新资源',
        '资源定制优先权',
        '独家教程视频',
        '年度会员专属线上活动'
      ],
      recommended: false,
      badge: '超值',
      savePercent: '40%',
      icon: <Gem className="w-5 h-5 text-violet-500" />
    },
  ];

  const benefits = [
    {
      title: '优质资源',
      description: '精选高质量资源，包括教程、模板、工具和素材，满足您的各种学习和创作需求。',
    },
    {
      title: '持续更新',
      description: '我们的团队持续不断地增加新资源，确保您能够获取最新、最前沿的内容。',
    },
    {
      title: '专业支持',
      description: '会员可以获得专业的技术支持，解决您在使用资源过程中遇到的问题。',
    },
    {
      title: '社区互动',
      description: '加入我们活跃的会员社区，分享经验，结交志同道合的朋友，共同成长。',
    },
  ];

  // Sample premium resources in case real data is not available
  const samplePremiumResources: ResourceWithCategory[] = [
    {
      id: 101,
      title: 'React高级组件开发实战',
      subtitle: '从零开始构建企业级React组件库',
      price: '199.00',
      is_free: false,
      status: 1,
      cover_image: 'https://placehold.co/400x300/4f46e5/ffffff?text=React高级组件',
      category_id: 1,
      created_at: null,
      updated_at: null,
      language: null,
      level: null,
      duration: null,
      video_url: null,
      download_url: null,
      views: null,
      description: null,
      category: { id: 1, name: '编程开发', icon: 'code-box-line', created_at: null, updated_at: null }
    },
    {
      id: 102,
      title: 'UI/UX设计系统全套教程',
      subtitle: '打造一致性强的设计系统与组件库',
      price: '249.00',
      is_free: false,
      status: 1,
      cover_image: 'https://placehold.co/400x300/16a34a/ffffff?text=UI/UX设计系统',
      category_id: 2,
      created_at: null,
      updated_at: null,
      language: null,
      level: null,
      duration: null,
      video_url: null,
      download_url: null,
      views: null,
      description: null,
      category: { id: 2, name: '创意设计', icon: 'palette-line', created_at: null, updated_at: null }
    },
    {
      id: 103,
      title: '商业数据分析与可视化',
      subtitle: '使用Python和Tableau进行数据决策',
      price: '179.00',
      is_free: false,
      status: 1,
      cover_image: 'https://placehold.co/400x300/dc2626/ffffff?text=数据分析',
      category_id: 3,
      created_at: null,
      updated_at: null,
      language: null,
      level: null,
      duration: null,
      video_url: null,
      download_url: null,
      views: null,
      description: null,
      category: { id: 3, name: '商业管理', icon: 'line-chart-line', created_at: null, updated_at: null }
    }
  ];

  // 获取资源数据，确保类型正确
  // 定义API返回的资源类型
  type ApiResponse = {
    resources: ResourceWithCategory[];
    total: number;
  };
  
  // 安全地获取资源数据并处理
  const apiResponse = premiumResourcesData as ApiResponse | undefined;
  const resources = apiResponse?.resources || [];
  
  // 使用实际数据或示例数据
  const displayResources = resources.length > 0 ? resources : samplePremiumResources;

  return (
    <div className="container mx-auto px-4 py-10">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold text-neutral-900 mb-3">会员专区</h1>
        <p className="text-lg text-neutral-600 max-w-2xl mx-auto">
          加入资源宝会员，畅享海量优质资源，提升您的学习和工作效率
        </p>
      </div>

      {!user ? (
        <div className="max-w-3xl mx-auto bg-gradient-to-r from-purple-50 to-blue-50 rounded-2xl p-8 mb-16">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-neutral-900 mb-3">登录后加入会员</h2>
            <p className="text-neutral-600">
              请先登录您的账号，即可畅享会员专区内的所有权益和资源
            </p>
          </div>
          <div className="flex justify-center">
            <Button 
              size="lg" 
              onClick={() => setLocation('/login')}
              className="bg-primary hover:bg-primary/90"
            >
              立即登录
            </Button>
          </div>
        </div>
      ) : (
        <Tabs defaultValue="plans" className="max-w-6xl mx-auto">
          <TabsList className="grid grid-cols-2 w-[400px] mx-auto mb-8">
            <TabsTrigger value="plans">会员计划</TabsTrigger>
            <TabsTrigger value="benefits">会员专享</TabsTrigger>
          </TabsList>
          
          <TabsContent value="plans">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
              {membershipPlans.map((plan) => (
                <Card key={plan.id} className={`relative overflow-hidden ${
                  plan.recommended ? 'border-primary shadow-lg' : 'border-neutral-200'
                }`}>
                  {plan.recommended && (
                    <div className="absolute top-0 right-0">
                      <Badge className="rounded-tl-none rounded-br-none rounded-tr rounded-bl bg-primary text-white">
                        最受欢迎
                      </Badge>
                    </div>
                  )}
                  <CardHeader>
                    <div className="flex items-center space-x-2 mb-2">
                      {plan.icon}
                      <Badge variant="outline" className="text-sm font-medium">
                        {plan.badge}
                      </Badge>
                    </div>
                    <CardTitle className="text-xl">{plan.name}</CardTitle>
                    <div className="flex items-baseline mt-2">
                      <span className="text-3xl font-bold">{Math.round(Number(plan.price))} 积分</span>
                      <span className="text-neutral-500 ml-1">/{plan.period}</span>
                    </div>
                    {plan.savePercent && (
                      <Badge variant="secondary" className="mt-1">
                        节省 {plan.savePercent}
                      </Badge>
                    )}
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {plan.features.map((feature, i) => (
                        <li key={i} className="flex items-start">
                          <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mr-2" />
                          <span className="text-neutral-700">{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                  <CardFooter>
                    <Button 
                      className={`w-full ${plan.recommended ? 'bg-primary hover:bg-primary/90' : ''}`}
                      variant={plan.recommended ? 'default' : 'outline'}
                    >
                      立即开通
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          </TabsContent>
          
          <TabsContent value="benefits">
            <div className="mb-16">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
                {benefits.map((benefit, index) => (
                  <div key={index} className="flex items-start space-x-4">
                    <div className="bg-primary/10 p-3 rounded-full">
                      <CheckCircle2 className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold mb-2">{benefit.title}</h3>
                      <p className="text-neutral-600">{benefit.description}</p>
                    </div>
                  </div>
                ))}
              </div>
              
              <Separator className="my-12" />
              
              <div className="mb-8">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold">会员专享资源</h2>
                  <Button variant="outline" onClick={() => setLocation('/resources?membership=premium')}>
                    查看更多
                  </Button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {displayResources.slice(0, 3).map((resource: ResourceWithCategory) => (
                    <Card key={resource.id} className="overflow-hidden group">
                      <div className="relative">
                        <img 
                          src={
                            // 优先使用本地图片路径，如果存在
                            resource.local_image_path 
                              ? `/images/${resource.local_image_path.split('/').pop()}` 
                              : (resource.cover_image || '/images/default-resource.svg')
                          } 
                          alt={resource.title} 
                          className="w-full h-48 object-cover"
                          onError={(e) => {
                            // 如果本地图片加载失败，回退到远程图片，最后使用默认图片
                            const target = e.target as HTMLImageElement;
                            if (resource.local_image_path && target.src.includes('/images/') && !target.src.includes('default-resource.svg')) {
                              console.log('本地图片加载失败，切换到远程图片');
                              target.src = resource.cover_image || '/images/default-resource.svg';
                            } else if (resource.cover_image && !target.src.includes('default-resource.svg')) {
                              console.log('远程图片加载失败，使用默认图片');
                              target.src = '/images/default-resource.svg';
                            }
                          }}
                        />
                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                          <Button variant="secondary" onClick={() => setLocation(`/resources/${resource.id}`)}>
                            查看详情
                          </Button>
                        </div>
                        <Badge className="absolute top-2 right-2 bg-primary text-white">
                          会员专享
                        </Badge>
                      </div>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-lg line-clamp-1">{resource.title}</CardTitle>
                        <CardDescription className="line-clamp-2">{resource.subtitle}</CardDescription>
                      </CardHeader>
                      <CardFooter className="flex justify-between pt-2">
                        <Badge variant="outline">{resource.category?.name || '未分类'}</Badge>
                        <div className="font-semibold">{Math.round(Number(resource.price || 0))} 积分</div>
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      )}
      
      <div className="bg-neutral-50 rounded-xl p-8 max-w-4xl mx-auto">
        <h2 className="text-2xl font-bold text-center mb-6">常见问题</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
          <div>
            <h3 className="font-semibold text-lg mb-2">如何成为会员？</h3>
            <p className="text-neutral-600">
              只需登录您的账号，选择适合您的会员计划，完成支付即可立即成为我们的会员。
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-lg mb-2">会员能下载哪些资源？</h3>
            <p className="text-neutral-600">
              会员可以下载所有标记为"会员专享"的优质资源，包括各类教程、模板和工具等。
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-lg mb-2">会员是否可以退款？</h3>
            <p className="text-neutral-600">
              会员一旦开通，将无法退款。建议您先了解我们的资源内容，确认符合需求后再开通会员。
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-lg mb-2">会员到期后资源还能使用吗？</h3>
            <p className="text-neutral-600">
              会员到期后，您在会员期间下载的资源仍然可以使用，但无法再下载新的会员专享资源。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}