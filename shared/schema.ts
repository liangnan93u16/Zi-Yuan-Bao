import { pgTable, text, serial, integer, boolean, timestamp, decimal, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Authors table
export const authors = pgTable("authors", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  avatar: text("avatar"),
  title: text("title"), // 职称，如"资深前端工程师"
  bio: text("bio"), // 简介
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow()
});

// Reviews table
export const reviews = pgTable("reviews", {
  id: serial("id").primaryKey(),
  resource_id: integer("resource_id").notNull(),
  user_id: integer("user_id").notNull(),
  rating: integer("rating").notNull(),
  content: text("content").notNull(),
  status: integer("status").default(0).notNull(), // 0: 待审核, 1: 已通过, 2: 已拒绝
  admin_notes: text("admin_notes"), // 管理员备注
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
  local_image_path: text("local_image_path"), // 本地保存的图片路径，与feifei_resources表同步
  category_id: integer("category_id").references(() => categories.id),
  author_id: integer("author_id").references(() => authors.id), // 关联到作者表
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
  contents: text("contents"), // 课程目录，使用JSON格式
  faq_content: text("faq_content"), // 常见问题，使用Markdown格式
  // 新增资源链接和类型
  resource_url: text("resource_url"),
  resource_type: text("resource_type").default("baidu"), // baidu, aliyun
  resource_code: text("resource_code"), // 新增字段：资源提取码
  source_url: text("source_url"), // 新增字段：资源来源URL
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
export const insertAuthorSchema = createInsertSchema(authors).omit({
  id: true,
  created_at: true,
  updated_at: true
});

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
export type Author = typeof authors.$inferSelect;
export type InsertAuthor = z.infer<typeof insertAuthorSchema>;

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

// Admin Login Logs table
export const adminLoginLogs = pgTable("admin_login_logs", {
  id: serial("id").primaryKey(),
  admin_email: text("admin_email").notNull(),
  ip_address: text("ip_address").notNull(),
  login_time: timestamp("login_time").defaultNow(),
  user_agent: text("user_agent"),
  status: boolean("status").default(true) // true: 成功, false: 失败
});

export const insertAdminLoginLogSchema = createInsertSchema(adminLoginLogs).omit({
  id: true,
  login_time: true
});

// 用户购买记录表，记录用户购买的资源
export const userPurchases = pgTable("user_purchases", {
  id: serial("id").primaryKey(),
  user_id: integer("user_id").notNull().references(() => users.id),
  resource_id: integer("resource_id").notNull().references(() => resources.id),
  price: decimal("price", { precision: 10, scale: 2 }).default("0"),
  purchase_time: timestamp("purchase_time").defaultNow(),
});

export const insertUserPurchaseSchema = createInsertSchema(userPurchases).omit({
  id: true,
  purchase_time: true
});

export type AdminLoginLog = typeof adminLoginLogs.$inferSelect;
export type InsertAdminLoginLog = z.infer<typeof insertAdminLoginLogSchema>;

export type UserPurchase = typeof userPurchases.$inferSelect;
export type InsertUserPurchase = z.infer<typeof insertUserPurchaseSchema>;

// 菲菲网分类表
export const feifeiCategories = pgTable("feifei_categories", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(), // 分类标题
  url: text("url").notNull(), // 分类URL
  sort_order: integer("sort_order").default(0), // 排序顺序
  is_invalid: boolean("is_invalid").default(false), // 是否作废标记
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow()
});

export const insertFeifeiCategorySchema = createInsertSchema(feifeiCategories).omit({
  id: true,
  created_at: true,
  updated_at: true
});

export type FeifeiCategory = typeof feifeiCategories.$inferSelect;
export type InsertFeifeiCategory = z.infer<typeof insertFeifeiCategorySchema>;

// 菲菲网资源表
export const feifeiResources = pgTable("feifei_resources", {
  id: serial("id").primaryKey(),
  chinese_title: text("chinese_title").notNull(), // 中文标题 
  english_title: text("english_title"), // 英文标题（可选）
  url: text("url").notNull(), // 资源URL
  category_id: integer("category_id").notNull().references(() => feifeiCategories.id), // 所属分类
  icon: text("icon"), // 资源图标
  description: text("description"), // 资源描述
  image_url: text("image_url"), // 资源封面图片URL
  local_image_path: text("local_image_path"), // 本地保存的图片路径
  
  // 新增网页解析字段
  resource_category: text("resource_category"), // 资源分类
  popularity: text("popularity"), // 浏览热度
  publish_date: text("publish_date"), // 发布时间
  last_update: text("last_update"), // 最近更新
  content_info: text("content_info"), // 文件内容
  video_size: text("video_size"), // 视频尺寸
  file_size: text("file_size"), // 视频大小
  duration: text("duration"), // 课时
  language: text("language"), // 视频语言
  subtitle: text("subtitle"), // 视频字幕
  details: text("details"), // 详情介绍
  details_html: text("details_html"), // 详情介绍的HTML原始代码
  coin_price: text("coin_price"), // 普通用户金币价格
  course_html: text("course_html"), // 课程内容HTML原始代码
  preview_url: text("preview_url"), // 查看预览链接
  parsed_content: text("parsed_content"), // 存储解析后的JSON内容
  linked_resource_id: integer("linked_resource_id"), // 关联的资源系统中的资源ID，默认为null
  markdown_content: text("markdown_content"), // 存储从HTML转换来的Markdown格式内容
  
  // 新增网盘链接和提取码字段
  cloud_disk_url: text("cloud_disk_url"), // 网盘链接
  cloud_disk_code: text("cloud_disk_code"), // 提取码
  
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow()
});

export const insertFeifeiResourceSchema = createInsertSchema(feifeiResources).omit({
  id: true,
  created_at: true,
  updated_at: true
});

export type FeifeiResource = typeof feifeiResources.$inferSelect;
export type InsertFeifeiResource = z.infer<typeof insertFeifeiResourceSchema>;

// 菲菲网资源标签表
export const feifeiTags = pgTable("feifei_tags", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(), // 标签名称，例如"udemy"
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow()
});

export const insertFeifeiTagSchema = createInsertSchema(feifeiTags).omit({
  id: true,
  created_at: true,
  updated_at: true
});

export type FeifeiTag = typeof feifeiTags.$inferSelect;
export type InsertFeifeiTag = z.infer<typeof insertFeifeiTagSchema>;

// 菲菲网资源-标签关联表（多对多关系）
export const feifeiResourceTags = pgTable("feifei_resource_tags", {
  id: serial("id").primaryKey(),
  resource_id: integer("resource_id").notNull().references(() => feifeiResources.id),
  tag_id: integer("tag_id").notNull().references(() => feifeiTags.id),
  created_at: timestamp("created_at").defaultNow()
}, (table) => {
  return {
    // 创建联合唯一约束，防止重复关联
    resource_tag_unique: uniqueIndex("resource_tag_unique").on(table.resource_id, table.tag_id)
  };
});

export const insertFeifeiResourceTagSchema = createInsertSchema(feifeiResourceTags).omit({
  id: true,
  created_at: true
});

export type FeifeiResourceTag = typeof feifeiResourceTags.$inferSelect;
export type InsertFeifeiResourceTag = z.infer<typeof insertFeifeiResourceTagSchema>;

// 系统参数表，只有管理员可以管理
export const parameters = pgTable("parameters", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(), // 参数键（唯一）
  value: text("value").notNull(), // 参数值
  description: text("description"), // 参数描述
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow()
});

export const insertParameterSchema = createInsertSchema(parameters).omit({
  id: true,
  created_at: true,
  updated_at: true
});

export type Parameter = typeof parameters.$inferSelect;
export type InsertParameter = z.infer<typeof insertParameterSchema>;

// 用户收藏表，记录用户收藏的资源
export const userFavorites = pgTable("user_favorites", {
  id: serial("id").primaryKey(),
  user_id: integer("user_id").notNull().references(() => users.id),
  resource_id: integer("resource_id").notNull().references(() => resources.id),
  created_at: timestamp("created_at").defaultNow(),
}, (table) => {
  return {
    // 创建联合唯一约束，防止用户重复收藏同一资源
    user_resource_unique: uniqueIndex("user_favorite_unique").on(table.user_id, table.resource_id)
  };
});

export const insertUserFavoriteSchema = createInsertSchema(userFavorites).omit({
  id: true,
  created_at: true
});

export type UserFavorite = typeof userFavorites.$inferSelect;
export type InsertUserFavorite = z.infer<typeof insertUserFavoriteSchema>;

// 资源上架通知记录表
export const resourceNotifications = pgTable("resource_notifications", {
  id: serial("id").primaryKey(),
  user_id: integer("user_id").notNull().references(() => users.id),
  resource_id: integer("resource_id").notNull().references(() => resources.id),
  email_sent: boolean("email_sent").default(false), // 邮件是否已发送
  email_sent_at: timestamp("email_sent_at"), // 邮件发送时间
  created_at: timestamp("created_at").defaultNow(),
});

export const insertResourceNotificationSchema = createInsertSchema(resourceNotifications).omit({
  id: true,
  created_at: true
});

export type ResourceNotification = typeof resourceNotifications.$inferSelect;
export type InsertResourceNotification = z.infer<typeof insertResourceNotificationSchema>;

export type LoginCredentials = z.infer<typeof loginSchema>;
export type RegisterData = z.infer<typeof registerSchema>;
