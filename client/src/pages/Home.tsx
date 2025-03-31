import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowRight, ArrowDown } from "lucide-react";
import CategoryCard from "@/components/resources/CategoryCard";
import ResourceCard from "@/components/resources/ResourceCard";
import { FilterType, ResourceWithCategory } from "@/lib/types";
import { Category } from "@shared/schema";

export default function Home() {
  const [filter, setFilter] = useState<FilterType>("all");
  const [page, setPage] = useState(1);
  
  // Fetch categories
  const { data: categories = [], isLoading: isLoadingCategories } = useQuery<Category[]>({
    queryKey: ['/api/categories'],
  });
  
  // Fetch resources with filter
  const { data: resourcesData, isLoading: isLoadingResources } = useQuery<{resources: ResourceWithCategory[], total: number}>({
    queryKey: ['/api/resources', filter, page],
  });

  // Extract resources from the response and provide a default empty array
  const resources = resourcesData?.resources || [];

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-primary to-blue-600 rounded-xl shadow-md overflow-hidden mb-8">
        <div className="md:flex">
          <div className="p-8 md:w-1/2 flex flex-col justify-center">
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">发现高质量学习资源</h1>
            <p className="text-blue-100 mb-6">数千种精选视频课程、电子书和学习资料，助您掌握新技能，提升专业水平。</p>
            <div className="flex flex-wrap gap-3">
              <Link href="/resources">
                <Button className="bg-white text-primary hover:bg-blue-50">开始探索</Button>
              </Link>
              <Link href="/membership">
                <Button className="bg-blue-700 text-white hover:bg-blue-800">加入会员</Button>
              </Link>
            </div>
          </div>
          <div className="md:w-1/2 relative">
            <img 
              className="h-full w-full object-cover" 
              src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=1471&q=80" 
              alt="学习者正在使用笔记本电脑学习"
            />
          </div>
        </div>
      </div>

      {/* Categories Section */}
      <div className="mb-12">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">热门分类</h2>
          <Link href="/categories">
            <a className="text-primary hover:text-blue-700 text-sm font-medium flex items-center">
              查看全部
              <ArrowRight className="ml-1 h-4 w-4" />
            </a>
          </Link>
        </div>
        
        {isLoadingCategories ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl p-4 shadow-sm h-32 animate-pulse">
                <div className="w-12 h-12 bg-gray-200 rounded-full mx-auto mb-3"></div>
                <div className="h-4 bg-gray-200 rounded mx-auto w-20 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded mx-auto w-16"></div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {categories?.slice(0, 6).map((category: Category) => (
              <CategoryCard
                key={category.id}
                category={category}
                count={Math.floor(Math.random() * 200) + 20} // This would come from the API in a real app
              />
            ))}
          </div>
        )}
      </div>

      {/* Latest Resources Section */}
      <div className="mb-12">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">最新上架</h2>
          <div className="flex space-x-2">
            <Button 
              variant={filter === "all" ? "default" : "outline"} 
              onClick={() => setFilter("all")}
              size="sm"
            >
              全部
            </Button>
            <Button 
              variant={filter === "free" ? "default" : "outline"} 
              onClick={() => setFilter("free")}
              size="sm"
            >
              免费
            </Button>
            <Button 
              variant={filter === "paid" ? "default" : "outline"} 
              onClick={() => setFilter("paid")}
              size="sm"
            >
              付费
            </Button>
          </div>
        </div>
        
        {isLoadingResources ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl overflow-hidden shadow-sm animate-pulse">
                <div className="h-48 bg-gray-200 w-full"></div>
                <div className="p-4">
                  <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
                  <div className="h-6 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-4 bg-gray-200 rounded w-full mb-4"></div>
                  <div className="flex space-x-2 mb-4">
                    <div className="h-3 bg-gray-200 rounded w-1/4"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/4"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/4"></div>
                  </div>
                  <div className="flex justify-between">
                    <div className="h-5 bg-gray-200 rounded w-1/4"></div>
                    <div className="h-8 bg-gray-200 rounded w-1/4"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {resources?.map((resource: ResourceWithCategory) => (
              <ResourceCard key={resource.id} resource={resource} />
            ))}
          </div>
        )}
        
        <div className="mt-8 text-center">
          <Button 
            variant="outline" 
            onClick={() => setPage(prev => prev + 1)}
            className="mx-auto"
          >
            加载更多 <ArrowDown className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Membership Section */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden mb-16">
        <div className="md:flex">
          <div className="p-8 md:w-3/5">
            <h2 className="text-2xl font-bold mb-3">升级会员，畅享所有优质资源</h2>
            <p className="text-neutral-600 mb-6">加入我们的会员计划，一次性获取网站上的所有付费资源，无需单独购买。享受高速下载、优先更新等特权服务。</p>
            
            <div className="grid md:grid-cols-3 gap-4 mb-6">
              <div className="bg-neutral-50 p-4 rounded-lg">
                <div className="flex items-center mb-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="7 10 12 15 17 10"></polyline>
                    <line x1="12" y1="15" x2="12" y2="3"></line>
                  </svg>
                  <h3 className="font-medium">无限下载</h3>
                </div>
                <p className="text-sm text-neutral-600">畅享所有资源，没有下载限制</p>
              </div>
              <div className="bg-neutral-50 p-4 rounded-lg">
                <div className="flex items-center mb-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-amber-500 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                  </svg>
                  <h3 className="font-medium">专属内容</h3>
                </div>
                <p className="text-sm text-neutral-600">独享会员专属高端资源</p>
              </div>
              <div className="bg-neutral-50 p-4 rounded-lg">
                <div className="flex items-center mb-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-500 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                  </svg>
                  <h3 className="font-medium">优先支持</h3>
                </div>
                <p className="text-sm text-neutral-600">优先获得技术支持和答疑</p>
              </div>
            </div>
            
            <div className="flex flex-wrap gap-4">
              <Link href="/membership">
                <Button>查看会员计划</Button>
              </Link>
              <Link href="/about">
                <Button variant="outline">了解更多</Button>
              </Link>
            </div>
          </div>
          <div className="md:w-2/5 bg-gradient-to-br from-blue-100 to-indigo-100 p-8 flex items-center justify-center">
            <div className="text-center">
              <div className="text-5xl font-bold text-primary mb-2">40%</div>
              <div className="text-lg font-medium text-neutral-800 mb-1">限时优惠</div>
              <div className="text-sm text-neutral-600 mb-4">仅限7天，抓紧时间</div>
              <div className="bg-white text-primary text-sm font-medium px-4 py-2 rounded-full inline-block">
                使用优惠码: WELCOME40
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
