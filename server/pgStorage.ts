import { drizzle } from 'drizzle-orm/node-postgres';
import { eq, like, and, or, desc, sql } from 'drizzle-orm';
import { Client } from 'pg';
import { 
  users, type User, type InsertUser, 
  categories, type Category, type InsertCategory,
  resources, type Resource, type InsertResource,
  authors, type Author, type InsertAuthor,
  feifeiCategories, type FeifeiCategory, type InsertFeifeiCategory,
  feifeiResources, type FeifeiResource, type InsertFeifeiResource,
  feifeiTags, type FeifeiTag, type InsertFeifeiTag,
  feifeiResourceTags, type FeifeiResourceTag, type InsertFeifeiResourceTag
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
    
    // 添加source_url过滤条件
    if (filters.source_url) {
      console.log(`PgStorage: 添加source_url过滤条件: "${filters.source_url}"`);
      
      // 使用SQL显式指定source_url条件，确保正确匹配
      conditions.push(
        sql`${resources.source_url} = ${filters.source_url}`
      );
      
      // 打印完整的SQL条件以便调试
      console.log(`SQL条件: ${resources.source_url.name} = '${filters.source_url}'`);
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

  // Feifei Category methods
  async getFeifeiCategory(id: number): Promise<FeifeiCategory | undefined> {
    const result = await this.db.select().from(feifeiCategories).where(eq(feifeiCategories.id, id));
    return result[0];
  }

  async getFeifeiCategoryByUrl(url: string): Promise<FeifeiCategory[] | undefined> {
    const result = await this.db.select().from(feifeiCategories).where(eq(feifeiCategories.url, url));
    return result.length > 0 ? result : undefined;
  }

  async createFeifeiCategory(categoryData: InsertFeifeiCategory): Promise<FeifeiCategory> {
    const result = await this.db.insert(feifeiCategories).values(categoryData).returning();
    return result[0];
  }

  async updateFeifeiCategory(id: number, data: Partial<FeifeiCategory>): Promise<FeifeiCategory | undefined> {
    const result = await this.db
      .update(feifeiCategories)
      .set({ ...data, updated_at: new Date() })
      .where(eq(feifeiCategories.id, id))
      .returning();
    return result[0];
  }

  async deleteFeifeiCategory(id: number): Promise<boolean> {
    const result = await this.db
      .delete(feifeiCategories)
      .where(eq(feifeiCategories.id, id))
      .returning({ id: feifeiCategories.id });
    return result.length > 0;
  }

  async getAllFeifeiCategories(options?: { 
    invalidStatus?: boolean | null, 
    keyword?: string | null,
    page?: number, 
    pageSize?: number 
  }): Promise<{ categories: FeifeiCategory[], total: number }> {
    // 构建条件
    const conditions = [];
    
    // 根据作废状态过滤
    if (options?.invalidStatus !== undefined && options.invalidStatus !== null) {
      conditions.push(eq(feifeiCategories.is_invalid, options.invalidStatus));
    }
    
    // 根据关键字搜索
    if (options?.keyword && options.keyword.trim() !== '') {
      const keyword = options.keyword.trim();
      conditions.push(
        or(
          like(feifeiCategories.title, `%${keyword}%`),
          like(feifeiCategories.url, `%${keyword}%`)
        )
      );
    }
    
    // 应用过滤条件
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    
    // 获取总数
    const countResult = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(feifeiCategories)
      .where(whereClause);
    
    const total = Number(countResult[0]?.count || 0);
    
    // 构建查询
    let query = this.db
      .select()
      .from(feifeiCategories)
      .where(whereClause)
      .orderBy(feifeiCategories.sort_order);
    
    // 应用分页
    if (options?.page !== undefined && options?.pageSize !== undefined) {
      const offset = (options.page - 1) * options.pageSize;
      query = query.$dynamic().limit(options.pageSize).offset(offset);
    }
    
    const categoriesList = await query;
    
    return { categories: categoriesList, total };
  }

  async setFeifeiCategoryInvalidStatus(id: number, isInvalid: boolean): Promise<FeifeiCategory | undefined> {
    const result = await this.db
      .update(feifeiCategories)
      .set({ 
        is_invalid: isInvalid,
        updated_at: new Date()
      })
      .where(eq(feifeiCategories.id, id))
      .returning();
    return result[0];
  }

  // Feifei Resource methods
  async getFeifeiResource(id: number): Promise<FeifeiResource | undefined> {
    const result = await this.db.select().from(feifeiResources).where(eq(feifeiResources.id, id));
    return result[0];
  }

  async getFeifeiResourcesByCategory(categoryId: number, page: number = 1, pageSize: number = 10): Promise<{ resources: FeifeiResource[], total: number }> {
    // 获取总数
    const countResult = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(feifeiResources)
      .where(eq(feifeiResources.category_id, categoryId));
    
    const total = Number(countResult[0]?.count || 0);
    
    // 计算分页偏移量
    const offset = (page - 1) * pageSize;
    
    // 获取当前页的数据
    const resources = await this.db
      .select()
      .from(feifeiResources)
      .where(eq(feifeiResources.category_id, categoryId))
      .orderBy(feifeiResources.id)
      .limit(pageSize)
      .offset(offset);
    
    return { resources, total };
  }

  async getFeifeiResourcesByUrl(url: string): Promise<FeifeiResource[]> {
    return await this.db
      .select()
      .from(feifeiResources)
      .where(eq(feifeiResources.url, url));
  }

  async createFeifeiResource(resourceData: InsertFeifeiResource): Promise<FeifeiResource> {
    const result = await this.db.insert(feifeiResources).values(resourceData).returning();
    return result[0];
  }

  async updateFeifeiResource(id: number, data: Partial<FeifeiResource>): Promise<FeifeiResource | undefined> {
    const result = await this.db
      .update(feifeiResources)
      .set({ ...data, updated_at: new Date() })
      .where(eq(feifeiResources.id, id))
      .returning();
    return result[0];
  }

  async deleteFeifeiResource(id: number): Promise<boolean> {
    const result = await this.db
      .delete(feifeiResources)
      .where(eq(feifeiResources.id, id))
      .returning({ id: feifeiResources.id });
    return result.length > 0;
  }

  async getAllFeifeiResources(): Promise<FeifeiResource[]> {
    return await this.db.select().from(feifeiResources);
  }

  // Feifei Tag methods
  async getFeifeiTag(id: number): Promise<FeifeiTag | undefined> {
    const result = await this.db.select().from(feifeiTags).where(eq(feifeiTags.id, id));
    return result[0];
  }

  async getFeifeiTagByName(name: string): Promise<FeifeiTag | undefined> {
    const result = await this.db.select().from(feifeiTags).where(eq(feifeiTags.name, name));
    return result[0];
  }

  async createFeifeiTag(tagData: InsertFeifeiTag): Promise<FeifeiTag> {
    const result = await this.db.insert(feifeiTags).values(tagData).returning();
    return result[0];
  }

  async updateFeifeiTag(id: number, data: Partial<FeifeiTag>): Promise<FeifeiTag | undefined> {
    const result = await this.db
      .update(feifeiTags)
      .set({ ...data, updated_at: new Date() })
      .where(eq(feifeiTags.id, id))
      .returning();
    return result[0];
  }

  async deleteFeifeiTag(id: number): Promise<boolean> {
    const result = await this.db
      .delete(feifeiTags)
      .where(eq(feifeiTags.id, id))
      .returning({ id: feifeiTags.id });
    return result.length > 0;
  }

  async getAllFeifeiTags(): Promise<FeifeiTag[]> {
    return await this.db.select().from(feifeiTags);
  }

  // Feifei Resource-Tag methods
  async createFeifeiResourceTag(resourceTagData: InsertFeifeiResourceTag): Promise<FeifeiResourceTag> {
    const result = await this.db.insert(feifeiResourceTags).values(resourceTagData).returning();
    return result[0];
  }

  async getFeifeiResourceTags(resourceId: number): Promise<FeifeiTag[]> {
    const joins = await this.db
      .select({
        tagId: feifeiResourceTags.tag_id
      })
      .from(feifeiResourceTags)
      .where(eq(feifeiResourceTags.resource_id, resourceId));

    if (joins.length === 0) return [];

    const tagIds = joins.map(j => j.tagId);
    return await this.db
      .select()
      .from(feifeiTags)
      .where(sql`${feifeiTags.id} IN (${tagIds.join(',')})`);
  }

  async getFeifeiTagResources(tagId: number): Promise<FeifeiResource[]> {
    const joins = await this.db
      .select({
        resourceId: feifeiResourceTags.resource_id
      })
      .from(feifeiResourceTags)
      .where(eq(feifeiResourceTags.tag_id, tagId));

    if (joins.length === 0) return [];

    const resourceIds = joins.map(j => j.resourceId);
    return await this.db
      .select()
      .from(feifeiResources)
      .where(sql`${feifeiResources.id} IN (${resourceIds.join(',')})`);
  }

  async deleteFeifeiResourceTag(resourceId: number, tagId: number): Promise<boolean> {
    const result = await this.db
      .delete(feifeiResourceTags)
      .where(and(
        eq(feifeiResourceTags.resource_id, resourceId),
        eq(feifeiResourceTags.tag_id, tagId)
      ))
      .returning({ id: feifeiResourceTags.id });
    return result.length > 0;
  }

  async getFeifeiResourceTagRelation(resourceId: number, tagId: number): Promise<FeifeiResourceTag | undefined> {
    const result = await this.db
      .select()
      .from(feifeiResourceTags)
      .where(and(
        eq(feifeiResourceTags.resource_id, resourceId),
        eq(feifeiResourceTags.tag_id, tagId)
      ));
    return result[0];
  }
}