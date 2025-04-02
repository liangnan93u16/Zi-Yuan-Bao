import { drizzle } from 'drizzle-orm/node-postgres';
import { eq, like, and, desc, sql } from 'drizzle-orm';
import { Client } from 'pg';
import { 
  users, type User, type InsertUser, 
  categories, type Category, type InsertCategory,
  resources, type Resource, type InsertResource,
  authors, type Author, type InsertAuthor
} from "@shared/schema";
import { IStorage, ResourceFilters } from './storage';

export class PgStorage implements IStorage {
  private db: ReturnType<typeof drizzle>;
  private client: Client;

  constructor() {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL environment variable is not set');
    }

    this.client = new Client({
      connectionString: process.env.DATABASE_URL,
    });
    
    // We'll connect in an async init method
    this.db = drizzle(this.client);
  }

  async init() {
    try {
      await this.client.connect();
      console.log('Connected to PostgreSQL database');
      
      // Seed default data if needed
      await this.initializeDefaultData();
      
      return this;
    } catch (error) {
      console.error('Failed to connect to PostgreSQL database:', error);
      throw error;
    }
  }

  private async initializeDefaultData() {
    // Check if we have any categories, if not seed them
    const existingCategories = await this.getAllCategories();
    
    if (existingCategories.length === 0) {
      console.log('Seeding initial data...');

      // Create some basic categories
      const categoriesToCreate = [
        { name: "编程开发", icon: "code-box-line", sort_order: 1 },
        { name: "设计创意", icon: "palette-line", sort_order: 2 },
        { name: "商业管理", icon: "line-chart-line", sort_order: 3 },
        { name: "影视制作", icon: "film-line", sort_order: 4 },
        { name: "语言学习", icon: "translate-2", sort_order: 5 }
      ];

      for (const cat of categoriesToCreate) {
        await this.createCategory({
          name: cat.name,
          icon: cat.icon,
          sort_order: cat.sort_order
        });
      }
      
      console.log('Created default categories');
    }
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    const result = await this.db.select().from(users).where(eq(users.id, id));
    return result[0];
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await this.db.select().from(users).where(eq(users.email, email));
    return result[0];
  }

  async createUser(userData: InsertUser): Promise<User> {
    const result = await this.db.insert(users).values(userData).returning();
    return result[0];
  }

  async updateUser(id: number, data: Partial<User>): Promise<User | undefined> {
    const result = await this.db
      .update(users)
      .set({ ...data, updated_at: new Date() })
      .where(eq(users.id, id))
      .returning();
    return result[0];
  }

  async getAllUsers(): Promise<User[]> {
    return await this.db.select().from(users);
  }

  // Category methods
  async getCategory(id: number): Promise<Category | undefined> {
    const result = await this.db.select().from(categories).where(eq(categories.id, id));
    return result[0];
  }

  async getCategoryByName(name: string): Promise<Category | undefined> {
    const result = await this.db.select().from(categories).where(eq(categories.name, name));
    return result[0];
  }

  async createCategory(categoryData: InsertCategory): Promise<Category> {
    const result = await this.db.insert(categories).values(categoryData).returning();
    return result[0];
  }

  async updateCategory(id: number, data: Partial<Category>): Promise<Category | undefined> {
    const result = await this.db
      .update(categories)
      .set({ ...data, updated_at: new Date() })
      .where(eq(categories.id, id))
      .returning();
    return result[0];
  }

  async deleteCategory(id: number): Promise<boolean> {
    const result = await this.db
      .delete(categories)
      .where(eq(categories.id, id))
      .returning({ id: categories.id });
    return result.length > 0;
  }

  async getAllCategories(): Promise<Category[]> {
    return await this.db.select().from(categories).orderBy(categories.sort_order);
  }

  // Resource methods
  async getResource(id: number): Promise<Resource | undefined> {
    const result = await this.db.select().from(resources).where(eq(resources.id, id));
    return result[0];
  }

  async createResource(resourceData: InsertResource): Promise<Resource> {
    const result = await this.db.insert(resources).values(resourceData).returning();
    return result[0];
  }

  async updateResource(id: number, data: Partial<Resource>): Promise<Resource | undefined> {
    const result = await this.db
      .update(resources)
      .set({ ...data, updated_at: new Date() })
      .where(eq(resources.id, id))
      .returning();
    return result[0];
  }

  async deleteResource(id: number): Promise<boolean> {
    const result = await this.db
      .delete(resources)
      .where(eq(resources.id, id))
      .returning({ id: resources.id });
    return result.length > 0;
  }

  async getAllResources(filters: ResourceFilters = {}): Promise<{ resources: Resource[], total: number }> {
    // Build the where conditions based on filters
    const conditions = [];
    
    if (filters.category_id !== undefined) {
      conditions.push(eq(resources.category_id, filters.category_id));
    }
    
    if (filters.status !== undefined) {
      conditions.push(eq(resources.status, filters.status));
    }
    
    if (filters.is_free !== undefined) {
      conditions.push(eq(resources.is_free, filters.is_free));
    }
    
    if (filters.search) {
      conditions.push(
        sql`(${resources.title} ILIKE ${`%${filters.search}%`} OR 
             ${resources.subtitle} ILIKE ${`%${filters.search}%`} OR 
             ${resources.description} ILIKE ${`%${filters.search}%`})`
      );
    }

    // Apply all filters and count total before pagination
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    
    // Get total count
    const countResult = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(resources)
      .where(whereClause);
    
    const total = Number(countResult[0]?.count || 0);
    
    // Get actual resources with pagination
    let query = this.db
      .select()
      .from(resources)
      .where(whereClause)
      .orderBy(desc(resources.created_at));
    
    // Apply pagination if specified
    if (filters.page !== undefined && filters.limit !== undefined) {
      const offset = (filters.page - 1) * filters.limit;
      // Due to TypeScript limitations, we'll use the exact drizzle API
      query = query.$dynamic().limit(filters.limit).offset(offset);
    }
    
    const resourcesList = await query;
    
    return { resources: resourcesList, total };
  }

  async getResourcesByCategory(categoryId: number): Promise<Resource[]> {
    return await this.db
      .select()
      .from(resources)
      .where(eq(resources.category_id, categoryId));
  }

  // Author methods
  async getAuthor(id: number): Promise<Author | undefined> {
    const result = await this.db.select().from(authors).where(eq(authors.id, id));
    return result[0];
  }

  async getAuthorByName(name: string): Promise<Author | undefined> {
    const result = await this.db.select().from(authors).where(eq(authors.name, name));
    return result[0];
  }

  async createAuthor(authorData: InsertAuthor): Promise<Author> {
    const result = await this.db.insert(authors).values(authorData).returning();
    return result[0];
  }

  async updateAuthor(id: number, data: Partial<Author>): Promise<Author | undefined> {
    const result = await this.db
      .update(authors)
      .set({ ...data, updated_at: new Date() })
      .where(eq(authors.id, id))
      .returning();
    return result[0];
  }

  async deleteAuthor(id: number): Promise<boolean> {
    const result = await this.db
      .delete(authors)
      .where(eq(authors.id, id))
      .returning({ id: authors.id });
    return result.length > 0;
  }

  async getAllAuthors(): Promise<Author[]> {
    return await this.db.select().from(authors);
  }
}