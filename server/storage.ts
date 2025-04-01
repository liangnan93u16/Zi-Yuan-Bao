import { 
  users, type User, type InsertUser, 
  categories, type Category, type InsertCategory,
  resources, type Resource, type InsertResource,
  resourceRequests, type ResourceRequest, type InsertResourceRequest
} from "@shared/schema";

// Storage interface
export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, data: Partial<User>): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;

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
  
  // Resource Request operations
  createResourceRequest(request: InsertResourceRequest): Promise<ResourceRequest>;
  getResourceRequest(id: number): Promise<ResourceRequest | undefined>;
  getAllResourceRequests(): Promise<ResourceRequest[]>;
  updateResourceRequestStatus(id: number, status: number, notes?: string): Promise<ResourceRequest | undefined>;
}

// Filter types for resource queries
export interface ResourceFilters {
  category_id?: number;
  status?: number;
  is_free?: boolean;
  search?: string;
  page?: number;
  limit?: number;
}

// In-memory implementation
export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private categories: Map<number, Category>;
  private resources: Map<number, Resource>;
  private resourceRequests: Map<number, ResourceRequest>;
  private userIdCounter: number;
  private categoryIdCounter: number;
  private resourceIdCounter: number;
  private resourceRequestIdCounter: number;

  constructor() {
    this.users = new Map();
    this.categories = new Map();
    this.resources = new Map();
    this.resourceRequests = new Map();
    this.userIdCounter = 1;
    this.categoryIdCounter = 1;
    this.resourceIdCounter = 1;
    this.resourceRequestIdCounter = 1;

    // Initialize with some sample categories
    this.initializeDefaultData();
  }

  private initializeDefaultData() {
    // Create default admin user
    const adminUser: InsertUser = {
      password: "$2b$10$TnZHFgGdhrXGz.Tlx1/4TuEGZlMrxRPTfGwsFTeQQ.yqMW9jkfUV.", // "admin123"
      email: "admin@example.com",
      membership_type: "admin",
      coins: 1000
    };
    this.createUser(adminUser);

    // Create some basic categories
    const categories = [
      { name: "编程开发", icon: "code-box-line", sort_order: 1 },
      { name: "设计创意", icon: "palette-line", sort_order: 2 },
      { name: "商业管理", icon: "line-chart-line", sort_order: 3 },
      { name: "影视制作", icon: "film-line", sort_order: 4 },
      { name: "语言学习", icon: "translate-2", sort_order: 5 }
    ];

    categories.forEach(cat => {
      this.createCategory({
        name: cat.name,
        icon: cat.icon,
        sort_order: cat.sort_order
      });
    });
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.email === email
    );
  }

  async createUser(userData: InsertUser): Promise<User> {
    const id = this.userIdCounter++;
    const now = new Date();
    const user: User = { 
      ...userData, 
      id,
      created_at: now,
      updated_at: now
    };
    this.users.set(id, user);
    return user;
  }

  async updateUser(id: number, data: Partial<User>): Promise<User | undefined> {
    const user = await this.getUser(id);
    if (!user) return undefined;
    
    const updatedUser = { 
      ...user, 
      ...data,
      updated_at: new Date()
    };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  // Category methods
  async getCategory(id: number): Promise<Category | undefined> {
    return this.categories.get(id);
  }

  async getCategoryByName(name: string): Promise<Category | undefined> {
    return Array.from(this.categories.values()).find(
      (category) => category.name === name
    );
  }

  async createCategory(categoryData: InsertCategory): Promise<Category> {
    const id = this.categoryIdCounter++;
    const now = new Date();
    const category: Category = { 
      ...categoryData, 
      id,
      created_at: now,
      updated_at: now
    };
    this.categories.set(id, category);
    return category;
  }

  async updateCategory(id: number, data: Partial<Category>): Promise<Category | undefined> {
    const category = await this.getCategory(id);
    if (!category) return undefined;
    
    const updatedCategory = { 
      ...category, 
      ...data,
      updated_at: new Date()
    };
    this.categories.set(id, updatedCategory);
    return updatedCategory;
  }

  async deleteCategory(id: number): Promise<boolean> {
    return this.categories.delete(id);
  }

  async getAllCategories(): Promise<Category[]> {
    return Array.from(this.categories.values());
  }

  // Resource methods
  async getResource(id: number): Promise<Resource | undefined> {
    return this.resources.get(id);
  }

  async createResource(resourceData: InsertResource): Promise<Resource> {
    const id = this.resourceIdCounter++;
    const now = new Date();
    const resource: Resource = { 
      ...resourceData, 
      id,
      created_at: now,
      updated_at: now
    };
    this.resources.set(id, resource);
    return resource;
  }

  async updateResource(id: number, data: Partial<Resource>): Promise<Resource | undefined> {
    const resource = await this.getResource(id);
    if (!resource) return undefined;
    
    const updatedResource = { 
      ...resource, 
      ...data,
      updated_at: new Date()
    };
    this.resources.set(id, updatedResource);
    return updatedResource;
  }

  async deleteResource(id: number): Promise<boolean> {
    return this.resources.delete(id);
  }

  async getAllResources(filters: ResourceFilters = {}): Promise<{ resources: Resource[], total: number }> {
    let resources = Array.from(this.resources.values());
    
    // Apply filters
    if (filters.category_id !== undefined) {
      resources = resources.filter(r => r.category_id === filters.category_id);
    }
    
    if (filters.status !== undefined) {
      resources = resources.filter(r => r.status === filters.status);
    }
    
    if (filters.is_free !== undefined) {
      resources = resources.filter(r => r.is_free === filters.is_free);
    }
    
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      resources = resources.filter(r => 
        r.title.toLowerCase().includes(searchLower) || 
        (r.subtitle && r.subtitle.toLowerCase().includes(searchLower)) ||
        (r.description && r.description.toLowerCase().includes(searchLower))
      );
    }
    
    // Sort by created_at in descending order (newest first)
    resources.sort((a, b) => {
      if (!a.created_at || !b.created_at) return 0;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
    
    const total = resources.length;
    
    // Pagination
    if (filters.page && filters.limit) {
      const start = (filters.page - 1) * filters.limit;
      resources = resources.slice(start, start + filters.limit);
    }
    
    return { resources, total };
  }

  async getResourcesByCategory(categoryId: number): Promise<Resource[]> {
    return Array.from(this.resources.values()).filter(
      (resource) => resource.category_id === categoryId
    );
  }
  
  // Resource Request methods
  async createResourceRequest(requestData: InsertResourceRequest): Promise<ResourceRequest> {
    const id = this.resourceRequestIdCounter++;
    const now = new Date();
    const request: ResourceRequest = { 
      ...requestData, 
      id,
      status: 0, // Default to pending
      admin_notes: null,
      created_at: now,
      updated_at: now
    };
    this.resourceRequests.set(id, request);
    return request;
  }
  
  async getResourceRequest(id: number): Promise<ResourceRequest | undefined> {
    return this.resourceRequests.get(id);
  }
  
  async getAllResourceRequests(): Promise<ResourceRequest[]> {
    return Array.from(this.resourceRequests.values());
  }
  
  async updateResourceRequestStatus(id: number, status: number, notes?: string): Promise<ResourceRequest | undefined> {
    const request = await this.getResourceRequest(id);
    if (!request) return undefined;
    
    const updatedRequest = { 
      ...request, 
      status,
      admin_notes: notes || request.admin_notes,
      updated_at: new Date()
    };
    this.resourceRequests.set(id, updatedRequest);
    return updatedRequest;
  }
}

import { db } from "./db";
import { eq, like, and, or, desc } from "drizzle-orm";

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
    let query = db
      .select()
      .from(resources)
      .where(whereClause || sql`TRUE`)
      .orderBy(desc(resources.created_at));
    
    // Apply pagination if specified
    if (filters.page !== undefined && filters.limit !== undefined) {
      const offset = (filters.page - 1) * filters.limit;
      query = query.limit(filters.limit).offset(offset);
    }
    
    const resourcesList = await query;
    
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
  }
}

// Import SQL utility
import { sql } from "drizzle-orm";

// Export storage variable
export let storage: IStorage;

// Initialize storage - this will be called in index.ts
export async function initializeStorage() {
  try {
    // Use database storage
    const dbStorage = new DatabaseStorage();
    
    // Initialize default data if needed
    await dbStorage.initializeDefaultData();
    
    storage = dbStorage;
    return storage;
  } catch (error) {
    console.error('Failed to initialize database storage, falling back to in-memory storage:', error);
    // Fallback to in-memory storage if database connection fails
    storage = new MemStorage();
    return storage;
  }
}
