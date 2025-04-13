import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import CategoryCard from "@/components/resources/CategoryCard";
import ResourceCard from "@/components/resources/ResourceCard";
import { FilterType, ResourceWithCategory } from "@/lib/types";
import { Category } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";
import SEO from "@/components/SEO";

export default function Home() {
  const [filter, setFilter] = useState<FilterType>("all");
  const { user } = useAuth(); // 获取当前用户登录状态
  
  // Fetch categories
  const { data: allCategories = [], isLoading: isLoadingCategories } = useQuery<Category[]>({
    queryKey: ['/api/categories'],
  });
  
  // 过滤并整理分类数据
  // 1. 对于热门分类区域，我们需要显示"设计-平面设计与插画"作为第一个分类
  // 2. 然后显示其他几个排序靠前的子分类
  const categories = [
    // 首先确保"设计-平面设计与插画"排在第一位
    ...allCategories.filter(c => c.id === 7),
    // 然后是其他几个排序靠前的子分类（但排除已经显示的设计-平面设计与插画）
    ...allCategories.filter(c => c.id !== 7 && c.name.includes('-')).slice(0, 5)
  ];
  
  // Fetch resources with filter
  const { data: resourcesData, isLoading: isLoadingResources } = useQuery<{resources: ResourceWithCategory[], total: number}>({
    queryKey: ['/api/resources', filter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filter === "free") params.append("is_free", "true");
      if (filter === "paid") params.append("is_free", "false");
      params.append("page", "1");
      params.append("limit", "8"); // 显示8个资源
      params.append("status", "1"); // 只显示已上架的资源
      
      const url = `/api/resources?${params.toString()}`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error("Failed to fetch resources");
      }
      return response.json();
    },
  });

  // Extract resources from the response and provide a default empty array
  const resources = resourcesData?.resources || [];

  // 为首页添加SEO数据
  const homeSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "资源宝 - 精品学习资源分享平台",
    "url": "https://resourcetreasure.replit.app/",
    "potentialAction": {
      "@type": "SearchAction",
      "target": "https://resourcetreasure.replit.app/resources?query={search_term_string}",
      "query-input": "required name=search_term_string"
    }
  };
  
  return (
    <>
      <SEO 
        title="资源宝 - 精品学习资源分享平台"
        description="数千种精选视频课程、电子书和学习资料，助您掌握新技能，提升专业水平，高质量学习资源一站式获取平台"
        keywords="学习资源,视频教程,电子书,技能提升,在线学习,设计教程,编程教程"
        schema={JSON.stringify(homeSchema)}
      />
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
          <Link href="/resources">
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
            {/* 显示管理后台中排序的前6个分类 */}
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
          <div className="flex items-center">
            <div className="flex space-x-2 mr-4">
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
            <Link href="/resources">
              <a className="text-primary hover:text-blue-700 text-sm font-medium flex items-center">
                查看全部
                <ArrowRight className="ml-1 h-4 w-4" />
              </a>
            </Link>
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
              <ResourceCard 
                key={resource.id} 
                resource={resource} 
                isLoggedIn={!!user} 
              />
            ))}
          </div>
        )}
      </div>
    </div>
    </>
  );
}
