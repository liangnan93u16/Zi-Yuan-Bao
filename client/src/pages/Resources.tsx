import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, SlidersHorizontal, X } from "lucide-react";
import ResourceCard from "@/components/resources/ResourceCard";
import { FilterType, ResourceWithCategory, SortOrder } from "@/lib/types";
import { Category } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";
import SEO from "@/components/SEO";

export default function Resources() {
  const [location] = useLocation();
  const { user } = useAuth(); // 获取当前用户登录状态
  
  // Parse search query from URL if available
  const getInitialSearchQuery = () => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      return urlParams.get("search") || "";
    }
    return "";
  };

  // State for filters, pagination, and search
  const [searchQuery, setSearchQuery] = useState(getInitialSearchQuery());
  const [pendingSearchQuery, setPendingSearchQuery] = useState(getInitialSearchQuery());
  const [filter, setFilter] = useState<FilterType>("all");
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");
  const [categoryFilter, setCategoryFilter] = useState<number | "all">("all");
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const limit = 12; // Resources per page

  // Check for URL params when component mounts
  useEffect(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      
      // Set search query from URL
      const urlSearch = urlParams.get("search");
      if (urlSearch) {
        setSearchQuery(urlSearch);
        setPendingSearchQuery(urlSearch);
      }
      
      // Set filter from URL
      const urlFilter = urlParams.get("filter") as FilterType;
      if (urlFilter && ["all", "free", "paid"].includes(urlFilter)) {
        setFilter(urlFilter);
      }
      
      // Set category from URL
      const urlCategory = urlParams.get("category") || urlParams.get("category_id");
      if (urlCategory) {
        if (urlCategory === "all") {
          setCategoryFilter("all");
        } else {
          const categoryId = parseInt(urlCategory);
          if (!isNaN(categoryId)) {
            setCategoryFilter(categoryId);
          }
        }
      }
      
      // Set sort from URL
      const urlSort = urlParams.get("sort") as SortOrder;
      if (urlSort && ["newest", "popular", "price-low", "price-high"].includes(urlSort)) {
        setSortOrder(urlSort);
      }
      
      // Set page from URL
      const urlPage = urlParams.get("page");
      if (urlPage) {
        const pageNum = parseInt(urlPage);
        if (!isNaN(pageNum) && pageNum > 0) {
          setPage(pageNum);
        }
      }
    }
  }, []);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [filter, sortOrder, categoryFilter, searchQuery]);

  // Fetch categories for filter
  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ['/api/categories'],
  });

  // Calculate params for API request
  const params = new URLSearchParams();
  if (filter === "free") params.append("is_free", "true");
  if (filter === "paid") params.append("is_free", "false");
  if (categoryFilter !== "all") params.append("category_id", String(categoryFilter));
  if (searchQuery) params.append("search", searchQuery);
  params.append("page", String(page));
  params.append("limit", String(limit));
  params.append("status", "1"); // 只显示已上架的资源
  
  // Convert sort order to API parameters
  switch (sortOrder) {
    case "newest":
      params.append("sort", "created_at");
      params.append("direction", "desc");
      break;
    case "popular":
      params.append("sort", "downloads");
      params.append("direction", "desc");
      break;
    case "price-low":
      params.append("sort", "price");
      params.append("direction", "asc");
      break;
    case "price-high":
      params.append("sort", "price");
      params.append("direction", "desc");
      break;
  }

  // Fetch resources with filters and pagination
  const { data: resourcesData, isLoading: isLoadingResources } = useQuery<{resources: ResourceWithCategory[], total: number}>({
    queryKey: ['/api/resources', filter, sortOrder, categoryFilter, searchQuery, page],
    queryFn: async () => {
      const url = `/api/resources?${params.toString()}`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error("Failed to fetch resources");
      }
      return response.json();
    },
  });

  // Extract resources and total count from the response
  const resources = resourcesData?.resources || [];
  const totalResources = resourcesData?.total || 0;
  const totalPages = Math.ceil(totalResources / limit);

  // Handle search submission
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchQuery(pendingSearchQuery);
  };

  // Clear all filters
  const clearFilters = () => {
    setFilter("all");
    setSortOrder("newest");
    setCategoryFilter("all");
    setSearchQuery("");
    setPendingSearchQuery("");
  };

  // Render pagination links
  const renderPaginationLinks = () => {
    const links = [];
    const maxVisiblePages = 5;
    
    // Always show the first page
    links.push(
      <PaginationItem key="page-1">
        <PaginationLink 
          onClick={() => setPage(1)} 
          isActive={page === 1}
        >
          1
        </PaginationLink>
      </PaginationItem>
    );

    // Calculate range of pages to show
    let startPage = Math.max(2, page - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages - 1, startPage + maxVisiblePages - 3);
    
    // Adjust startPage if we're near the end
    if (endPage < startPage + maxVisiblePages - 3 && startPage > 2) {
      startPage = Math.max(2, totalPages - maxVisiblePages + 1);
    }

    // Add ellipsis if needed
    if (startPage > 2) {
      links.push(
        <PaginationItem key="ellipsis-start">
          <PaginationEllipsis />
        </PaginationItem>
      );
    }

    // Add middle pages
    for (let i = startPage; i <= endPage; i++) {
      links.push(
        <PaginationItem key={`page-${i}`}>
          <PaginationLink 
            onClick={() => setPage(i)} 
            isActive={page === i}
          >
            {i}
          </PaginationLink>
        </PaginationItem>
      );
    }

    // Add ellipsis if needed
    if (endPage < totalPages - 1) {
      links.push(
        <PaginationItem key="ellipsis-end">
          <PaginationEllipsis />
        </PaginationItem>
      );
    }

    // Always show the last page if there's more than one page
    if (totalPages > 1) {
      links.push(
        <PaginationItem key={`page-${totalPages}`}>
          <PaginationLink 
            onClick={() => setPage(totalPages)} 
            isActive={page === totalPages}
          >
            {totalPages}
          </PaginationLink>
        </PaginationItem>
      );
    }

    return links;
  };

  // 为资源列表页创建结构化数据
  const resourcesListSchema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "name": "资源宝 - 学习资源列表",
    "description": "浏览我们的高质量视频教程、电子书和学习资料，提升专业技能",
    "url": "https://resourcetreasure.replit.app/resources",
    "isPartOf": {
      "@type": "WebSite",
      "name": "资源宝",
      "url": "https://resourcetreasure.replit.app/"
    }
  };
  
  // 为SEO组件构建标题和描述
  const getPageTitle = () => {
    let title = "学习资源列表";
    
    if (categoryFilter !== "all") {
      const categoryName = categories.find(c => c.id === categoryFilter)?.name || "";
      title = `${categoryName}相关资源`;
    }
    
    if (filter === "free") {
      title = `免费${title}`;
    } else if (filter === "paid") {
      title = `付费${title}`;
    }
    
    if (searchQuery) {
      title = `"${searchQuery}"的搜索结果`;
    }
    
    return `${title} - 资源宝`;
  };
  
  const getPageDescription = () => {
    let description = "探索高质量视频教程、电子书和学习资料，助您掌握新技能，提升专业水平。";
    
    if (categoryFilter !== "all") {
      const categoryName = categories.find(c => c.id === categoryFilter)?.name || "";
      description = `浏览${categoryName}相关的学习资源，${description.toLowerCase()}`;
    }
    
    if (filter === "free") {
      description = `免费学习资源汇总，${description.toLowerCase()}`;
    }
    
    if (searchQuery) {
      description = `关于"${searchQuery}"的学习资源搜索结果，${description.toLowerCase()}`;
    }
    
    return description;
  };
  
  return (
    <div>
      <SEO 
        title={getPageTitle()}
        description={getPageDescription()}
        keywords={`学习资源,${searchQuery || '教程'},${filter === 'free' ? '免费' : '专业'},视频教程,电子书,${categories.find(c => c.id === categoryFilter)?.name || '在线学习'}`}
        path="resources"
        schema={JSON.stringify(resourcesListSchema)}
      />
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">全部资源</h1>
        <p className="text-neutral-600">
          探索我们丰富的学习资源，找到适合你的内容
        </p>
      </div>

      {/* Search and filter bar */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden mb-6">
        <div className="p-4 border-b border-neutral-200">
          <div className="flex flex-col sm:flex-row gap-4">
            <form onSubmit={handleSearch} className="flex-1">
              <div className="relative">
                <Input
                  placeholder="搜索资源..."
                  value={pendingSearchQuery}
                  onChange={(e) => setPendingSearchQuery(e.target.value)}
                  className="pr-10"
                />
                {pendingSearchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setPendingSearchQuery("");
                      if (searchQuery) setSearchQuery("");
                    }}
                    className="absolute right-10 top-1/2 transform -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
                <button
                  type="submit"
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                >
                  <Search className="h-4 w-4" />
                </button>
              </div>
            </form>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="whitespace-nowrap"
                onClick={() => setShowFilters(!showFilters)}
              >
                <SlidersHorizontal className="mr-2 h-4 w-4" />
                筛选
              </Button>
              {(filter !== "all" || sortOrder !== "newest" || categoryFilter !== "all" || searchQuery) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="whitespace-nowrap"
                >
                  <X className="mr-2 h-4 w-4" />
                  清除筛选
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Expanded filter options */}
        {showFilters && (
          <div className="p-4 bg-neutral-50 border-b border-neutral-200">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-600 mb-1">
                  价格
                </label>
                <Tabs
                  value={filter}
                  onValueChange={(value) => setFilter(value as FilterType)}
                  className="w-full"
                >
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="all">全部</TabsTrigger>
                    <TabsTrigger value="free">免费</TabsTrigger>
                    <TabsTrigger value="paid">付费</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-600 mb-1">
                  分类
                </label>
                <Select
                  value={categoryFilter === "all" ? "all" : String(categoryFilter)}
                  onValueChange={(value) => setCategoryFilter(value === "all" ? "all" : Number(value))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择分类" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">所有分类</SelectItem>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={String(category.id)}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-600 mb-1">
                  排序方式
                </label>
                <Select
                  value={sortOrder}
                  onValueChange={(value) => setSortOrder(value as SortOrder)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="排序方式" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">最新上架</SelectItem>
                    <SelectItem value="popular">最受欢迎</SelectItem>
                    <SelectItem value="price-low">价格从低到高</SelectItem>
                    <SelectItem value="price-high">价格从高到低</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Active filters display */}
      {(filter !== "all" || categoryFilter !== "all" || searchQuery) && (
        <div className="flex flex-wrap gap-2 mb-4">
          {filter !== "all" && (
            <Badge variant="outline" className="bg-blue-50 border-0 flex items-center gap-1">
              {filter === "free" ? "免费资源" : "付费资源"}
              <button onClick={() => setFilter("all")}>
                <X className="h-3 w-3 ml-1" />
              </button>
            </Badge>
          )}
          
          {categoryFilter !== "all" && (
            <Badge variant="outline" className="bg-blue-50 border-0 flex items-center gap-1">
              {categories.find(c => c.id === categoryFilter)?.name || "分类"}
              <button onClick={() => setCategoryFilter("all")}>
                <X className="h-3 w-3 ml-1" />
              </button>
            </Badge>
          )}
          
          {searchQuery && (
            <Badge variant="outline" className="bg-blue-50 border-0 flex items-center gap-1">
              搜索: {searchQuery}
              <button onClick={() => setSearchQuery("")}>
                <X className="h-3 w-3 ml-1" />
              </button>
            </Badge>
          )}
        </div>
      )}
      
      {/* Total resources count */}
      <div className="flex justify-between items-center mb-4">
        <div className="text-sm text-neutral-600">
          共 {totalResources} 个资源
          {filter !== "all" && filter === "free" && ` (免费)`}
          {filter !== "all" && filter === "paid" && ` (付费)`}
          {categoryFilter !== "all" && ` 在 "${categories.find(c => c.id === categoryFilter)?.name || '所选分类'}"`}
          {searchQuery && ` 匹配 "${searchQuery}"`}
        </div>
        
        <div className="text-sm text-neutral-600">
          <Select
            value={sortOrder}
            onValueChange={(value) => setSortOrder(value as SortOrder)}
          >
            <SelectTrigger className="h-8 w-[180px]">
              <SelectValue placeholder="排序方式" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">最新上架</SelectItem>
              <SelectItem value="popular">最受欢迎</SelectItem>
              <SelectItem value="price-low">积分从低到高</SelectItem>
              <SelectItem value="price-high">积分从高到低</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      
      {/* Resources grid */}
      {isLoadingResources ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[...Array(12)].map((_, i) => (
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
      ) : resources.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {resources.map((resource) => (
            <ResourceCard 
              key={resource.id} 
              resource={resource} 
              isLoggedIn={!!user}
            />
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-md p-8 text-center">
          <h2 className="text-xl font-bold mb-2">未找到符合条件的资源</h2>
          <p className="text-neutral-600 mb-6">
            尝试调整筛选条件或搜索不同的关键词
          </p>
          <Button onClick={clearFilters}>
            清除筛选
          </Button>
        </div>
      )}
      
      {/* Pagination */}
      {!isLoadingResources && totalPages > 1 && (
        <Pagination className="mt-8">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious 
                onClick={() => setPage(prev => Math.max(1, prev - 1))}
                className={page === 1 ? "pointer-events-none opacity-50" : ""}
              />
            </PaginationItem>
            
            {renderPaginationLinks()}
            
            <PaginationItem>
              <PaginationNext 
                onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
                className={page === totalPages ? "pointer-events-none opacity-50" : ""}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
      
      {/* 版权免责声明 */}
      <div className="bg-neutral-50 p-5 rounded-lg mt-8 mb-6 text-sm text-neutral-600">
        <h4 className="font-semibold text-base mb-2 text-neutral-800">版权免责声明：</h4>
        <p>本站所有文章，如无特殊说明或标注，均为本站原创发布。任何个人或组织，在未征得本站同意时，禁止复制、盗用、采集、发布本站内容到任何网站、书籍等各类媒体平台。如若本站内容侵犯了原著者的合法权益，可联系我们进行处理。</p>
      </div>
    </div>
    </div>
  );
}