import { 
  users, type User, type InsertUser, 
  categories, type Category, type InsertCategory,
  resources, type Resource, type InsertResource
} from "@shared/schema";

// Storage interface
export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
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
  private userIdCounter: number;
  private categoryIdCounter: number;
  private resourceIdCounter: number;

  constructor() {
    this.users = new Map();
    this.categories = new Map();
    this.resources = new Map();
    this.userIdCounter = 1;
    this.categoryIdCounter = 1;
    this.resourceIdCounter = 1;

    // Initialize with some sample categories
    this.initializeDefaultData();
  }

  private initializeDefaultData() {
    // Create default admin user
    const adminUser: InsertUser = {
      username: "admin",
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

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username
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
}

// Create and export the storage instance
export const storage = new MemStorage();
