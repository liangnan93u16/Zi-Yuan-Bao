import { 
  users, type User, type InsertUser, 
  categories, type Category, type InsertCategory,
  resources, type Resource, type InsertResource,
  resourceRequests, type ResourceRequest, type InsertResourceRequest,
  reviews, type Review, type InsertReview,
  adminLoginLogs, type AdminLoginLog, type InsertAdminLoginLog,
  authors, type Author, type InsertAuthor
} from "@shared/schema";
import { db } from "./db";
import { eq, like, and, or, desc, sql } from "drizzle-orm";

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
  
  // Admin Login Log operations
  createAdminLoginLog(log: InsertAdminLoginLog): Promise<AdminLoginLog>;
  getAdminLoginLogs(adminEmail?: string, limit?: number): Promise<AdminLoginLog[]>;
  
  // Initialize default data
  initializeDefaultData(): Promise<void>;
}

// Filter types for resource queries
export interface ResourceFilters {
  category_id?: number;
  status?: number;
  is_free?: boolean;
  search?: string;
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
    const [user] = await db
      .update(users)
      .set({ ...data, updated_at: new Date() })
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
