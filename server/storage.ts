import { 
  users, type User, type InsertUser, 
  categories, type Category, type InsertCategory,
  resources, type Resource, type InsertResource,
  resourceRequests, type ResourceRequest, type InsertResourceRequest,
  reviews, type Review, type InsertReview,
  adminLoginLogs, type AdminLoginLog, type InsertAdminLoginLog,
  authors, type Author, type InsertAuthor,
  userPurchases, type UserPurchase, type InsertUserPurchase,
  feifeiCategories, type FeifeiCategory, type InsertFeifeiCategory,
  feifeiResources, type FeifeiResource, type InsertFeifeiResource,
  feifeiTags, type FeifeiTag, type InsertFeifeiTag,
  feifeiResourceTags, type FeifeiResourceTag, type InsertFeifeiResourceTag,
  parameters, type Parameter, type InsertParameter
} from "@shared/schema";
import { db } from "./db";
import { eq, like, and, or, desc, sql, count } from "drizzle-orm";

// Storage interface
export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, data: Partial<User>): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;

  // Author operations
  getAuthor(id: number): Promise<Author | undefined>;
  getAuthorByName(name: string): Promise<Author | undefined>;
  createAuthor(author: InsertAuthor): Promise<Author>;
  updateAuthor(id: number, data: Partial<Author>): Promise<Author | undefined>;
  deleteAuthor(id: number): Promise<boolean>;
  getAllAuthors(): Promise<Author[]>;

  // Category operations
  getCategory(id: number): Promise<Category | undefined>;
  getCategoryByName(name: string): Promise<Category | undefined>;
  createCategory(category: InsertCategory): Promise<Category>;
  updateCategory(id: number, data: Partial<Category>): Promise<Category | undefined>;
  deleteCategory(id: number): Promise<boolean>;
  getAllCategories(): Promise<Category[]>;

  // Resource operations
  getResource(id: number): Promise<Resource | undefined>;
  createResource(resource: InsertResource): Promise<Resource>;
  updateResource(id: number, data: Partial<Resource>): Promise<Resource | undefined>;
  deleteResource(id: number): Promise<boolean>;
  getAllResources(filters?: ResourceFilters): Promise<{ resources: Resource[], total: number }>;
  getResourcesByCategory(categoryId: number): Promise<Resource[]>;
  
  // Review operations
  createReview(review: InsertReview): Promise<Review>;
  getReview(id: number): Promise<Review | undefined>;
  getReviewsByResource(resourceId: number): Promise<Review[]>;
  getReviewsByUser(userId: number): Promise<Review[]>;
  getAllReviews(): Promise<Review[]>;
  getResourceAverageRating(resourceId: number): Promise<number>;
  getResourceReviewCount(resourceId: number): Promise<number>;
  updateReview(id: number, data: Partial<Review>): Promise<Review | undefined>;
  deleteReview(id: number): Promise<boolean>;
  
  // Resource Request operations
  createResourceRequest(request: InsertResourceRequest): Promise<ResourceRequest>;
  getResourceRequest(id: number): Promise<ResourceRequest | undefined>;
  getAllResourceRequests(): Promise<ResourceRequest[]>;
  updateResourceRequestStatus(id: number, status: number, notes?: string): Promise<ResourceRequest | undefined>;
  
  // User Purchase operations
  createUserPurchase(userId: number, resourceId: number, price: number): Promise<UserPurchase>;
  getUserPurchase(userId: number, resourceId: number): Promise<UserPurchase | undefined>;
  getUserPurchases(userId: number): Promise<UserPurchase[]>;
  
  // Admin Login Log operations
  createAdminLoginLog(log: InsertAdminLoginLog): Promise<AdminLoginLog>;
  getAdminLoginLogs(adminEmail?: string, limit?: number): Promise<AdminLoginLog[]>;
  
  // Feifei Category operations
  getFeifeiCategory(id: number): Promise<FeifeiCategory | undefined>;
  getFeifeiCategoryByUrl(url: string): Promise<FeifeiCategory[] | undefined>;
  createFeifeiCategory(category: InsertFeifeiCategory): Promise<FeifeiCategory>;
  updateFeifeiCategory(id: number, data: Partial<FeifeiCategory>): Promise<FeifeiCategory | undefined>;
  deleteFeifeiCategory(id: number): Promise<boolean>;
  getAllFeifeiCategories(options?: { 
    invalidStatus?: boolean | null, 
    keyword?: string | null,
    page?: number, 
    pageSize?: number 
  }): Promise<{ categories: FeifeiCategory[], total: number }>;
  setFeifeiCategoryInvalidStatus(id: number, isInvalid: boolean): Promise<FeifeiCategory | undefined>;
  
  // Feifei Resource operations
  getFeifeiResource(id: number): Promise<FeifeiResource | undefined>;
  getFeifeiResourcesByCategory(categoryId: number, page?: number, pageSize?: number): Promise<{ resources: FeifeiResource[], total: number }>;
  getFeifeiResourcesByUrl(url: string): Promise<FeifeiResource[]>;
  createFeifeiResource(resource: InsertFeifeiResource): Promise<FeifeiResource>;
  updateFeifeiResource(id: number, data: Partial<FeifeiResource>): Promise<FeifeiResource | undefined>;
  deleteFeifeiResource(id: number): Promise<boolean>;
  getAllFeifeiResources(): Promise<FeifeiResource[]>;
  
  // Feifei Tag operations
  getFeifeiTag(id: number): Promise<FeifeiTag | undefined>;
  getFeifeiTagByName(name: string): Promise<FeifeiTag | undefined>;
  createFeifeiTag(tag: InsertFeifeiTag): Promise<FeifeiTag>;
  updateFeifeiTag(id: number, data: Partial<FeifeiTag>): Promise<FeifeiTag | undefined>;
  deleteFeifeiTag(id: number): Promise<boolean>;
  getAllFeifeiTags(): Promise<FeifeiTag[]>;
  
  // Feifei Resource-Tag operations
  createFeifeiResourceTag(resourceTag: InsertFeifeiResourceTag): Promise<FeifeiResourceTag>;
  getFeifeiResourceTags(resourceId: number): Promise<FeifeiTag[]>;
  getFeifeiTagResources(tagId: number): Promise<FeifeiResource[]>;
  deleteFeifeiResourceTag(resourceId: number, tagId: number): Promise<boolean>;
  getFeifeiResourceTagRelation(resourceId: number, tagId: number): Promise<FeifeiResourceTag | undefined>;
  
  // Parameter operations
  getParameter(id: number): Promise<Parameter | undefined>;
  getParameterByKey(key: string): Promise<Parameter | undefined>;
  createParameter(parameter: InsertParameter): Promise<Parameter>;
  updateParameter(id: number, data: Partial<Parameter>): Promise<Parameter | undefined>;
  deleteParameter(id: number): Promise<boolean>;
  getAllParameters(): Promise<Parameter[]>;
  
  // Initialize default data
  initializeDefaultData(): Promise<void>;
}

// Filter types for resource queries
export interface ResourceFilters {
  category_id?: number;
  status?: number;
  is_free?: boolean;
  search?: string;
  source_url?: string; // 增加source_url筛选字段
  page?: number;
  limit?: number;
  offset?: number;
}

// Database implementation
export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async updateUser(id: number, data: Partial<User>): Promise<User | undefined> {
    // 确保所有的日期值都是有效的 Date 对象
    const updateData = { ...data };
    
    // 如果包含 membership_expire_time 且不是 Date 对象，尝试转换
    if (updateData.membership_expire_time !== undefined && 
        !(updateData.membership_expire_time instanceof Date) && 
        updateData.membership_expire_time !== null) {
      try {
        updateData.membership_expire_time = new Date(updateData.membership_expire_time);
      } catch (error) {
        console.error('Error converting membership_expire_time to Date', error);
        // 如果无法转换，设置为null
        updateData.membership_expire_time = null;
      }
    }
    
    // 确保 updated_at 始终是 Date 对象
    const [user] = await db
      .update(users)
      .set({ ...updateData, updated_at: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user || undefined;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
  }
  
  // Author 方法
  async getAuthor(id: number): Promise<Author | undefined> {
    const [author] = await db.select().from(authors).where(eq(authors.id, id));
    return author || undefined;
  }

  async getAuthorByName(name: string): Promise<Author | undefined> {
    const [author] = await db.select().from(authors).where(eq(authors.name, name));
    return author || undefined;
  }

  async createAuthor(insertAuthor: InsertAuthor): Promise<Author> {
    const [author] = await db
      .insert(authors)
      .values(insertAuthor)
      .returning();
    return author;
  }

  async updateAuthor(id: number, data: Partial<Author>): Promise<Author | undefined> {
    const [author] = await db
      .update(authors)
      .set({ ...data, updated_at: new Date() })
      .where(eq(authors.id, id))
      .returning();
    return author || undefined;
  }

  async deleteAuthor(id: number): Promise<boolean> {
    const result = await db
      .delete(authors)
      .where(eq(authors.id, id))
      .returning({ id: authors.id });
    return result.length > 0;
  }

  async getAllAuthors(): Promise<Author[]> {
    return await db.select().from(authors).orderBy(authors.name);
  }

  async getCategory(id: number): Promise<Category | undefined> {
    const [category] = await db.select().from(categories).where(eq(categories.id, id));
    return category || undefined;
  }

  async getCategoryByName(name: string): Promise<Category | undefined> {
    const [category] = await db.select().from(categories).where(eq(categories.name, name));
    return category || undefined;
  }

  async createCategory(insertCategory: InsertCategory): Promise<Category> {
    const [category] = await db
      .insert(categories)
      .values(insertCategory)
      .returning();
    return category;
  }

  async updateCategory(id: number, data: Partial<Category>): Promise<Category | undefined> {
    const [category] = await db
      .update(categories)
      .set({ ...data, updated_at: new Date() })
      .where(eq(categories.id, id))
      .returning();
    return category || undefined;
  }

  async deleteCategory(id: number): Promise<boolean> {
    const result = await db
      .delete(categories)
      .where(eq(categories.id, id))
      .returning({ id: categories.id });
    return result.length > 0;
  }

  async getAllCategories(): Promise<Category[]> {
    return await db.select().from(categories);
  }

  async getResource(id: number): Promise<Resource | undefined> {
    const [resource] = await db.select().from(resources).where(eq(resources.id, id));
    return resource || undefined;
  }

  async createResource(insertResource: InsertResource): Promise<Resource> {
    const [resource] = await db
      .insert(resources)
      .values(insertResource)
      .returning();
    return resource;
  }

  async updateResource(id: number, data: Partial<Resource>): Promise<Resource | undefined> {
    const [resource] = await db
      .update(resources)
      .set({ ...data, updated_at: new Date() })
      .where(eq(resources.id, id))
      .returning();
    return resource || undefined;
  }

  async deleteResource(id: number): Promise<boolean> {
    const result = await db
      .delete(resources)
      .where(eq(resources.id, id))
      .returning({ id: resources.id });
    return result.length > 0;
  }

  async getAllResources(filters: ResourceFilters = {}): Promise<{ resources: Resource[], total: number }> {
    // Build where clause based on filters
    const whereConditions = [];
    
    if (filters.category_id !== undefined) {
      whereConditions.push(eq(resources.category_id, filters.category_id));
    }
    
    if (filters.status !== undefined) {
      whereConditions.push(eq(resources.status, filters.status));
    }
    
    if (filters.is_free !== undefined) {
      whereConditions.push(eq(resources.is_free, filters.is_free));
    }
    
    if (filters.search) {
      whereConditions.push(
        or(
          like(resources.title, `%${filters.search}%`),
          like(resources.subtitle || '', `%${filters.search}%`),
          like(resources.description || '', `%${filters.search}%`)
        )
      );
    }
    
    const whereClause = whereConditions.length > 0 
      ? and(...whereConditions) 
      : undefined;
    
    // Count total records
    const [countResult] = await db
      .select({ count: sql`COUNT(*)`.mapWith(Number) })
      .from(resources)
      .where(whereClause || sql`TRUE`);
    
    const total = countResult?.count || 0;
    
    // Get resources with pagination
    let resourcesList: Resource[] = [];
    
    try {
      if (filters.page !== undefined && filters.limit !== undefined) {
        const offset = (filters.page - 1) * filters.limit;
        // 使用单个查询处理分页
        resourcesList = await db
          .select()
          .from(resources)
          .where(whereClause || sql`TRUE`)
          .orderBy(desc(resources.created_at))
          .limit(filters.limit)
          .offset(offset);
      } else {
        // 无分页查询
        resourcesList = await db
          .select()
          .from(resources)
          .where(whereClause || sql`TRUE`)
          .orderBy(desc(resources.created_at));
      }
    } catch (error) {
      console.error("Error in getAllResources:", error);
      resourcesList = [];
    }
    
    return { resources: resourcesList, total };
  }

  async getResourcesByCategory(categoryId: number): Promise<Resource[]> {
    return await db
      .select()
      .from(resources)
      .where(eq(resources.category_id, categoryId));
  }
  
  // Resource Request methods
  async createResourceRequest(insertRequest: InsertResourceRequest): Promise<ResourceRequest> {
    const [request] = await db
      .insert(resourceRequests)
      .values(insertRequest)
      .returning();
    return request;
  }
  
  async getResourceRequest(id: number): Promise<ResourceRequest | undefined> {
    const [request] = await db.select().from(resourceRequests).where(eq(resourceRequests.id, id));
    return request || undefined;
  }
  
  async getAllResourceRequests(): Promise<ResourceRequest[]> {
    return await db
      .select()
      .from(resourceRequests)
      .orderBy(desc(resourceRequests.created_at));
  }
  
  async updateResourceRequestStatus(id: number, status: number, notes?: string): Promise<ResourceRequest | undefined> {
    const updateData: Partial<ResourceRequest> = { 
      status, 
      updated_at: new Date() 
    };
    
    if (notes !== undefined) {
      updateData.admin_notes = notes;
    }
    
    const [request] = await db
      .update(resourceRequests)
      .set(updateData)
      .where(eq(resourceRequests.id, id))
      .returning();
    return request || undefined;
  }
  
  // Review methods
  async createReview(insertReview: InsertReview): Promise<Review> {
    const [review] = await db
      .insert(reviews)
      .values(insertReview)
      .returning();
    return review;
  }
  
  async getReview(id: number): Promise<Review | undefined> {
    const [review] = await db.select().from(reviews).where(eq(reviews.id, id));
    return review || undefined;
  }
  
  async getReviewsByResource(resourceId: number): Promise<Review[]> {
    return await db
      .select()
      .from(reviews)
      .where(eq(reviews.resource_id, resourceId))
      .orderBy(desc(reviews.created_at));
  }
  
  async getReviewsByUser(userId: number): Promise<Review[]> {
    return await db
      .select()
      .from(reviews)
      .where(eq(reviews.user_id, userId))
      .orderBy(desc(reviews.created_at));
  }
  
  async getAllReviews(): Promise<Review[]> {
    return await db
      .select()
      .from(reviews)
      .orderBy(desc(reviews.created_at));
  }
  
  async getResourceAverageRating(resourceId: number): Promise<number> {
    const [result] = await db
      .select({
        average: sql`AVG(${reviews.rating})`.mapWith(Number)
      })
      .from(reviews)
      .where(eq(reviews.resource_id, resourceId));
    
    return result?.average || 0;
  }
  
  async getResourceReviewCount(resourceId: number): Promise<number> {
    const [result] = await db
      .select({
        count: sql`COUNT(*)`.mapWith(Number)
      })
      .from(reviews)
      .where(eq(reviews.resource_id, resourceId));
    
    return result?.count || 0;
  }
  
  async updateReview(id: number, data: Partial<Review>): Promise<Review | undefined> {
    const [review] = await db
      .update(reviews)
      .set({ ...data, updated_at: new Date() })
      .where(eq(reviews.id, id))
      .returning();
    return review || undefined;
  }
  
  async deleteReview(id: number): Promise<boolean> {
    const result = await db
      .delete(reviews)
      .where(eq(reviews.id, id))
      .returning({ id: reviews.id });
    return result.length > 0;
  }
  
  // User Purchase methods
  async createUserPurchase(userId: number, resourceId: number, price: number): Promise<UserPurchase> {
    try {
      const [purchase] = await db
        .insert(userPurchases)
        .values({
          user_id: userId,
          resource_id: resourceId,
          price: price.toString()
        })
        .returning();
      return purchase;
    } catch (error) {
      console.error('Error creating user purchase:', error);
      throw error;
    }
  }
  
  async getUserPurchase(userId: number, resourceId: number): Promise<UserPurchase | undefined> {
    try {
      const [purchase] = await db
        .select()
        .from(userPurchases)
        .where(and(
          eq(userPurchases.user_id, userId),
          eq(userPurchases.resource_id, resourceId)
        ));
      return purchase;
    } catch (error) {
      console.error('Error getting user purchase:', error);
      return undefined;
    }
  }
  
  async getUserPurchases(userId: number): Promise<UserPurchase[]> {
    try {
      return await db
        .select()
        .from(userPurchases)
        .where(eq(userPurchases.user_id, userId))
        .orderBy(desc(userPurchases.purchase_time));
    } catch (error) {
      console.error('Error getting user purchases:', error);
      return [];
    }
  }
  
  // Admin Login Log 方法
  async createAdminLoginLog(insertLog: InsertAdminLoginLog): Promise<AdminLoginLog> {
    const [log] = await db
      .insert(adminLoginLogs)
      .values(insertLog)
      .returning();
    return log;
  }
  
  async getAdminLoginLogs(adminEmail?: string, limit?: number): Promise<AdminLoginLog[]> {
    try {
      // 创建一个更直接的查询，避免TypeScript警告
      const baseQuery = db.select().from(adminLoginLogs);
      
      // 根据条件构建查询
      if (adminEmail) {
        const filteredQuery = baseQuery.where(eq(adminLoginLogs.admin_email, adminEmail));
        const logs = await (limit ? filteredQuery.limit(limit) : filteredQuery)
          .orderBy(desc(adminLoginLogs.login_time));
        return logs;
      } else {
        const logs = await (limit ? baseQuery.limit(limit) : baseQuery)
          .orderBy(desc(adminLoginLogs.login_time));
        return logs;
      }
    } catch (error) {
      console.error("Error in getAdminLoginLogs:", error);
      return [];  // 错误时返回空数组而不是让错误冒泡
    }
  }

  // Initialize with default data if needed
  async initializeDefaultData() {
    // Check if we already have users
    const userCount = await db.select({ count: sql`COUNT(*)`.mapWith(Number) }).from(users);
    if (userCount[0]?.count === 0) {
      // Create default admin user
      await this.createUser({
        password: "$2b$10$TnZHFgGdhrXGz.Tlx1/4TuEGZlMrxRPTfGwsFTeQQ.yqMW9jkfUV.", // "admin123"
        email: "admin@example.com",
        membership_type: "admin",
        coins: 1000
      });
    }

    // Check if we already have categories
    const categoryCount = await db.select({ count: sql`COUNT(*)`.mapWith(Number) }).from(categories);
    if (categoryCount[0]?.count === 0) {
      // Create default categories
      const defaultCategories = [
        { name: "编程开发", icon: "code-box-line", sort_order: 1 },
        { name: "设计创意", icon: "palette-line", sort_order: 2 },
        { name: "商业管理", icon: "line-chart-line", sort_order: 3 },
        { name: "影视制作", icon: "film-line", sort_order: 4 },
        { name: "语言学习", icon: "translate-2", sort_order: 5 }
      ];

      for (const cat of defaultCategories) {
        await this.createCategory({
          name: cat.name,
          icon: cat.icon,
          sort_order: cat.sort_order
        });
      }
    }
    
    // 检查是否已有作者
    try {
      const authorCount = await db.select({ count: sql`COUNT(*)`.mapWith(Number) }).from(authors);
      if (authorCount[0]?.count === 0) {
        // 创建默认作者
        const defaultAuthors = [
          { 
            name: "陈开发", 
            title: "资深前端工程师", 
            bio: "拥有10年React开发经验，曾任职于多家知名互联网公司。",
            avatar: "https://images.unsplash.com/photo-1568602471122-7832951cc4c5?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=facearea&facepad=2&w=300&h=300&q=80"
          },
          { 
            name: "李数据", 
            title: "数据分析专家", 
            bio: "专注于Python数据分析和机器学习，拥有丰富的教学和实战经验。",
            avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=facearea&facepad=2&w=300&h=300&q=80"
          }
        ];

        for (const author of defaultAuthors) {
          await this.createAuthor(author);
        }
      }
    } catch (error) {
      console.log("Authors table may not exist yet, skipping author initialization");
    }
  }
  
  // 菲菲网分类操作方法
  async getFeifeiCategory(id: number): Promise<FeifeiCategory | undefined> {
    const [category] = await db.select().from(feifeiCategories).where(eq(feifeiCategories.id, id));
    return category || undefined;
  }
  
  async getFeifeiCategoryByUrl(url: string): Promise<FeifeiCategory[] | undefined> {
    const categories = await db.select().from(feifeiCategories).where(eq(feifeiCategories.url, url));
    return categories.length > 0 ? categories : undefined;
  }
  
  async createFeifeiCategory(insertCategory: InsertFeifeiCategory): Promise<FeifeiCategory> {
    const [category] = await db
      .insert(feifeiCategories)
      .values(insertCategory)
      .returning();
    return category;
  }
  
  async updateFeifeiCategory(id: number, data: Partial<FeifeiCategory>): Promise<FeifeiCategory | undefined> {
    const [category] = await db
      .update(feifeiCategories)
      .set({ ...data, updated_at: new Date() })
      .where(eq(feifeiCategories.id, id))
      .returning();
    return category || undefined;
  }
  
  async deleteFeifeiCategory(id: number): Promise<boolean> {
    try {
      // 先获取该分类下的所有资源
      const resources = await this.getFeifeiResourcesByCategory(id);
      
      // 对每个资源，解除与标签的关联并删除资源
      for (const resource of resources) {
        // 1. 获取资源的所有标签
        const tags = await this.getFeifeiResourceTags(resource.id);
        
        // 2. 解除资源与标签的关联
        for (const tag of tags) {
          await this.deleteFeifeiResourceTag(resource.id, tag.id);
        }
        
        // 3. 删除资源
        await this.deleteFeifeiResource(resource.id);
      }
      
      // 最后删除分类
      const result = await db
        .delete(feifeiCategories)
        .where(eq(feifeiCategories.id, id))
        .returning({ id: feifeiCategories.id });
      
      return result.length > 0;
    } catch (error) {
      console.error('Error deleting feifei category with related resources:', error);
      throw error;
    }
  }
  
  async getAllFeifeiCategories(options?: { invalidStatus?: boolean | null, keyword?: string | null, page?: number, pageSize?: number }): Promise<{ categories: FeifeiCategory[], total: number }> {
    // 构建查询条件
    const conditions = [];
    
    // 根据作废状态过滤
    if (options?.invalidStatus !== undefined && options.invalidStatus !== null) {
      conditions.push(eq(feifeiCategories.is_invalid, options.invalidStatus));
    }
    
    // 根据关键字搜索标题
    if (options?.keyword && options.keyword.trim() !== '') {
      const keyword = options.keyword.trim();
      conditions.push(like(feifeiCategories.title, `%${keyword}%`));
    }
    
    // 应用过滤条件
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    
    let query = db.select().from(feifeiCategories).where(whereClause);
    
    // 获取总记录数的查询
    let countQuery = db.select({ count: count() }).from(feifeiCategories).where(whereClause);
    
    // 按ID升序排列
    query = query.orderBy(feifeiCategories.id);
    
    // 获取总数
    const countResult = await countQuery;
    const total = Number(countResult[0]?.count || 0);
    
    // 如果提供了分页参数
    if (options?.page !== undefined && options?.pageSize !== undefined) {
      const offset = (options.page - 1) * options.pageSize;
      query = query.limit(options.pageSize).offset(offset);
    }
    
    const result = await query;
    return { categories: result, total };
  }
  
  // 设置分类的作废状态
  async setFeifeiCategoryInvalidStatus(id: number, isInvalid: boolean): Promise<FeifeiCategory | undefined> {
    const result = await db.update(feifeiCategories)
      .set({ is_invalid: isInvalid, updated_at: new Date() })
      .where(eq(feifeiCategories.id, id))
      .returning();
    
    if (result.length === 0) return undefined;
    return result[0];
  }
  
  // 菲菲网资源方法
  async getFeifeiResource(id: number): Promise<FeifeiResource | undefined> {
    const [resource] = await db
      .select()
      .from(feifeiResources)
      .where(eq(feifeiResources.id, id));
    return resource || undefined;
  }

  async getFeifeiResourcesByCategory(categoryId: number, page: number = 1, pageSize: number = 10): Promise<{ resources: FeifeiResource[], total: number }> {
    // 获取总数
    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(feifeiResources)
      .where(eq(feifeiResources.category_id, categoryId));
    
    const total = Number(countResult?.count || 0);
    
    // 计算分页偏移量
    const offset = (page - 1) * pageSize;
    
    // 获取当前页的数据
    const resources = await db
      .select()
      .from(feifeiResources)
      .where(eq(feifeiResources.category_id, categoryId))
      .orderBy(feifeiResources.id) // 按ID升序排列，最小的在最上面
      .limit(pageSize)
      .offset(offset);
    
    return { resources, total };
  }
  
  async getFeifeiResourcesByUrl(url: string): Promise<FeifeiResource[]> {
    return await db
      .select()
      .from(feifeiResources)
      .where(eq(feifeiResources.url, url));
  }
  
  async createFeifeiResource(resource: InsertFeifeiResource): Promise<FeifeiResource> {
    const [newResource] = await db
      .insert(feifeiResources)
      .values(resource)
      .returning();
    return newResource;
  }
  
  async updateFeifeiResource(id: number, data: Partial<FeifeiResource>): Promise<FeifeiResource | undefined> {
    const [resource] = await db
      .update(feifeiResources)
      .set({ ...data, updated_at: new Date() })
      .where(eq(feifeiResources.id, id))
      .returning();
    return resource || undefined;
  }
  
  async deleteFeifeiResource(id: number): Promise<boolean> {
    const result = await db
      .delete(feifeiResources)
      .where(eq(feifeiResources.id, id))
      .returning({ id: feifeiResources.id });
    return result.length > 0;
  }
  
  async getAllFeifeiResources(): Promise<FeifeiResource[]> {
    return await db
      .select()
      .from(feifeiResources)
      .orderBy(desc(feifeiResources.created_at));
  }
  
  // 菲菲资源标签相关方法
  async getFeifeiTag(id: number): Promise<FeifeiTag | undefined> {
    const [tag] = await db
      .select()
      .from(feifeiTags)
      .where(eq(feifeiTags.id, id));
    return tag || undefined;
  }
  
  async getFeifeiTagByName(name: string): Promise<FeifeiTag | undefined> {
    const [tag] = await db
      .select()
      .from(feifeiTags)
      .where(eq(feifeiTags.name, name));
    return tag || undefined;
  }
  
  async createFeifeiTag(tag: InsertFeifeiTag): Promise<FeifeiTag> {
    const [newTag] = await db
      .insert(feifeiTags)
      .values(tag)
      .returning();
    return newTag;
  }
  
  async updateFeifeiTag(id: number, data: Partial<FeifeiTag>): Promise<FeifeiTag | undefined> {
    const [tag] = await db
      .update(feifeiTags)
      .set({ ...data, updated_at: new Date() })
      .where(eq(feifeiTags.id, id))
      .returning();
    return tag || undefined;
  }
  
  async deleteFeifeiTag(id: number): Promise<boolean> {
    const result = await db
      .delete(feifeiTags)
      .where(eq(feifeiTags.id, id))
      .returning({ id: feifeiTags.id });
    return result.length > 0;
  }
  
  async getAllFeifeiTags(): Promise<FeifeiTag[]> {
    return await db
      .select()
      .from(feifeiTags)
      .orderBy(feifeiTags.name);
  }
  
  // 菲菲资源-标签关联方法
  async createFeifeiResourceTag(resourceTag: InsertFeifeiResourceTag): Promise<FeifeiResourceTag> {
    const [newResourceTag] = await db
      .insert(feifeiResourceTags)
      .values(resourceTag)
      .returning();
    return newResourceTag;
  }
  
  async getFeifeiResourceTags(resourceId: number): Promise<FeifeiTag[]> {
    console.time(`db-get-tags-for-resource-${resourceId}`);
    const results = await db
      .select({
        tag: feifeiTags
      })
      .from(feifeiResourceTags)
      .innerJoin(feifeiTags, eq(feifeiResourceTags.tag_id, feifeiTags.id))
      .where(eq(feifeiResourceTags.resource_id, resourceId));
    
    const tags = results.map(r => r.tag);
    console.timeEnd(`db-get-tags-for-resource-${resourceId}`);
    console.log(`获取到资源 ${resourceId} 的标签数量: ${tags.length}`);
    return tags;
  }
  
  async getFeifeiTagResources(tagId: number): Promise<FeifeiResource[]> {
    const results = await db
      .select({
        resource: feifeiResources
      })
      .from(feifeiResourceTags)
      .innerJoin(feifeiResources, eq(feifeiResourceTags.resource_id, feifeiResources.id))
      .where(eq(feifeiResourceTags.tag_id, tagId));
    
    return results.map(r => r.resource);
  }
  
  async deleteFeifeiResourceTag(resourceId: number, tagId: number): Promise<boolean> {
    const result = await db
      .delete(feifeiResourceTags)
      .where(
        and(
          eq(feifeiResourceTags.resource_id, resourceId),
          eq(feifeiResourceTags.tag_id, tagId)
        )
      )
      .returning({ id: feifeiResourceTags.id });
    
    return result.length > 0;
  }
  
  async getFeifeiResourceTagRelation(resourceId: number, tagId: number): Promise<FeifeiResourceTag | undefined> {
    const [relation] = await db
      .select()
      .from(feifeiResourceTags)
      .where(
        and(
          eq(feifeiResourceTags.resource_id, resourceId),
          eq(feifeiResourceTags.tag_id, tagId)
        )
      );
    
    return relation || undefined;
  }
  
  // Parameter 操作方法
  async getParameter(id: number): Promise<Parameter | undefined> {
    const [parameter] = await db.select().from(parameters).where(eq(parameters.id, id));
    return parameter || undefined;
  }

  async getParameterByKey(key: string): Promise<Parameter | undefined> {
    const [parameter] = await db.select().from(parameters).where(eq(parameters.key, key));
    return parameter || undefined;
  }

  async createParameter(insertParameter: InsertParameter): Promise<Parameter> {
    const [parameter] = await db
      .insert(parameters)
      .values(insertParameter)
      .returning();
    return parameter;
  }

  async updateParameter(id: number, data: Partial<Parameter>): Promise<Parameter | undefined> {
    const [parameter] = await db
      .update(parameters)
      .set({ ...data, updated_at: new Date() })
      .where(eq(parameters.id, id))
      .returning();
    return parameter || undefined;
  }

  async deleteParameter(id: number): Promise<boolean> {
    const result = await db
      .delete(parameters)
      .where(eq(parameters.id, id))
      .returning({ id: parameters.id });
    return result.length > 0;
  }

  async getAllParameters(): Promise<Parameter[]> {
    return await db
      .select()
      .from(parameters)
      .orderBy(parameters.key);
  }
}

// Export storage variable
export let storage: IStorage;

// Initialize storage - this will be called in index.ts
export async function initializeStorage() {
  // Use database storage
  const dbStorage = new DatabaseStorage();
  
  // Initialize default data if needed
  await dbStorage.initializeDefaultData();
  
  storage = dbStorage;
  return storage;
}
