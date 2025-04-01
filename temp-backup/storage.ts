import { 
  users, type User, type InsertUser, 
  categories, type Category, type InsertCategory,
  resources, type Resource, type InsertResource,
  resourceRequests, type ResourceRequest, type InsertResourceRequest,
  reviews, type Review, type InsertReview
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
  getReviewsByResource(resourceId: number, includeUnapproved?: boolean, userId?: number): Promise<Review[]>;
  getReviewsByUser(userId: number): Promise<Review[]>;
  getAllReviews(status?: number): Promise<Review[]>; // Get all reviews with optional status filter
  getResourceAverageRating(resourceId: number): Promise<number>;
  getResourceReviewCount(resourceId: number): Promise<number>;
  updateReview(id: number, data: Partial<Review>): Promise<Review | undefined>;
  updateReviewStatus(id: number, status: number, adminNotes?: string): Promise<Review | undefined>; // Approve or reject review
  deleteReview(id: number): Promise<boolean>;
  
  // Resource Request operations
  createResourceRequest(request: InsertResourceRequest): Promise<ResourceRequest>;
  getResourceRequest(id: number): Promise<ResourceRequest | undefined>;
  getAllResourceRequests(): Promise<ResourceRequest[]>;
  updateResourceRequestStatus(id: number, status: number, notes?: string): Promise<ResourceRequest | undefined>;
  
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
    const baseQuery = db
      .select()
      .from(resources)
      .where(whereClause || sql`TRUE`)
      .orderBy(desc(resources.created_at));
    
    // Apply pagination if specified
    let finalQuery = baseQuery;
    if (filters.page !== undefined && filters.limit !== undefined) {
      const offset = (filters.page - 1) * filters.limit;
      finalQuery = baseQuery.limit(filters.limit).offset(offset);
    }
    
    const resourcesList = await finalQuery;
    
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
  
  async getReviewsByResource(resourceId: number, includeUnapproved: boolean = false, userId?: number): Promise<Review[]> {
    // Base where conditions
    let whereConditions = [eq(reviews.resource_id, resourceId)];
    
    // If not including unapproved reviews, filter to only approved ones
    // Unless a userId is provided, in which case also include that user's pending reviews
    if (!includeUnapproved) {
      if (userId) {
        whereConditions.push(
          or(
            eq(reviews.status, 1), // approved reviews
            and(eq(reviews.user_id, userId), eq(reviews.status, 0)) // user's own pending reviews
          )
        );
      } else {
        whereConditions.push(eq(reviews.status, 1)); // only approved reviews
      }
    }
    
    return await db
      .select()
      .from(reviews)
      .where(and(...whereConditions))
      .orderBy(desc(reviews.created_at));
  }
  
  async getAllReviews(status?: number): Promise<Review[]> {
    // Create a query to get all reviews
    let query = db.select().from(reviews);
    
    // Add status filter if provided
    if (status !== undefined) {
      query = query.where(eq(reviews.status, status));
    }
    
    // Include user information
    const reviewsWithUsers = await query
      .leftJoin(users, eq(reviews.user_id, users.id))
      .orderBy(desc(reviews.created_at));
    
    // Convert join result to Review[] with user info
    return reviewsWithUsers.map(row => {
      const review = {
        id: row.reviews.id,
        resource_id: row.reviews.resource_id,
        user_id: row.reviews.user_id,
        rating: row.reviews.rating,
        content: row.reviews.content,
        status: row.reviews.status,
        admin_notes: row.reviews.admin_notes,
        created_at: row.reviews.created_at,
        updated_at: row.reviews.updated_at,
        user: row.users ? {
          id: row.users.id,
          email: row.users.email,
          avatar: row.users.avatar,
          membership_type: row.users.membership_type
        } : undefined
      };
      return review;
    });
  }
  
  async updateReviewStatus(id: number, status: number, adminNotes?: string): Promise<Review | undefined> {
    const updateData: Partial<Review> = { 
      status, 
      updated_at: new Date() 
    };
    
    if (adminNotes !== undefined) {
      updateData.admin_notes = adminNotes;
    }
    
    const [review] = await db
      .update(reviews)
      .set(updateData)
      .where(eq(reviews.id, id))
      .returning();
    
    return review || undefined;
  }
  
  // This is a placeholder to delete the method in correct position
// It's moved to right after getReviewsByResource above
  
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
