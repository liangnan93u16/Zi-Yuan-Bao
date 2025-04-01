import { pgTable, text, serial, integer, boolean, timestamp, decimal } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Reviews table
export const reviews = pgTable("reviews", {
  id: serial("id").primaryKey(),
  resource_id: integer("resource_id").notNull(),
  user_id: integer("user_id").notNull(),
  rating: integer("rating").notNull(),
  content: text("content").notNull(),
  status: integer("status").default(0), // 0: pending, 1: approved, 2: rejected
  admin_notes: text("admin_notes"),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow()
});

// Categories table
export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  icon: text("icon"),
  parent_id: integer("parent_id"),
  sort_order: integer("sort_order").default(0),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow()
});

// Resources table
export const resources = pgTable("resources", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  subtitle: text("subtitle"),
  cover_image: text("cover_image"),
  category_id: integer("category_id").references(() => categories.id),
  price: decimal("price", { precision: 10, scale: 2 }).default("0"),
  video_url: text("video_url"),
  video_duration: integer("video_duration"),
  video_size: decimal("video_size", { precision: 10, scale: 2 }),
  language: text("language"),
  subtitle_languages: text("subtitle_languages"),
  resolution: text("resolution"),
  source_type: text("source_type"),
  status: integer("status").default(1),
  is_free: boolean("is_free").default(false),
  description: text("description"),
  contents: text("contents"), // 课程目录，使用Markdown格式
  faq_content: text("faq_content"), // 常见问题，使用Markdown格式
  // 新增资源链接和类型
  resource_url: text("resource_url"),
  resource_type: text("resource_type").default("baidu"), // baidu, aliyun
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow()
});

// Users table
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  avatar: text("avatar"),
  membership_type: text("membership_type"),
  membership_expire_time: timestamp("membership_expire_time"),
  coins: integer("coins").default(0),
  failed_login_attempts: integer("failed_login_attempts").default(0),
  account_locked_until: timestamp("account_locked_until"),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow()
});

// Insert schemas
export const insertCategorySchema = createInsertSchema(categories).omit({
  id: true,
  created_at: true,
  updated_at: true
});

export const insertResourceSchema = createInsertSchema(resources).omit({
  id: true,
  created_at: true,
  updated_at: true
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  created_at: true,
  updated_at: true
});

// Authentication schemas
export const loginSchema = z.object({
  email: z.string().email("邮箱格式不正确").min(1, "邮箱不能为空"),
  password: z.string().min(1, "密码不能为空")
});

export const registerSchema = z.object({
  email: z.string().email("邮箱格式不正确"),
  password: z.string().min(6, "密码至少6个字符")
});

// Resource Requests table
export const resourceRequests = pgTable("resource_requests", {
  id: serial("id").primaryKey(),
  email: text("email").notNull(),
  description: text("description").notNull(),
  status: integer("status").default(0), // 0: pending, 1: under review, 2: approved, 3: declined
  admin_notes: text("admin_notes"),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow()
});

// Insert schemas
export const insertReviewSchema = createInsertSchema(reviews).omit({
  id: true,
  status: true,
  admin_notes: true,
  created_at: true,
  updated_at: true
});

export const insertResourceRequestSchema = createInsertSchema(resourceRequests).omit({
  id: true,
  status: true,
  admin_notes: true,
  created_at: true,
  updated_at: true
});

// Types
export type Category = typeof categories.$inferSelect;
export type InsertCategory = z.infer<typeof insertCategorySchema>;

export type Resource = typeof resources.$inferSelect;
export type InsertResource = z.infer<typeof insertResourceSchema>;

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type ResourceRequest = typeof resourceRequests.$inferSelect;
export type InsertResourceRequest = z.infer<typeof insertResourceRequestSchema>;

export type Review = typeof reviews.$inferSelect;
export type InsertReview = z.infer<typeof insertReviewSchema>;

export type LoginCredentials = z.infer<typeof loginSchema>;
export type RegisterData = z.infer<typeof registerSchema>;
