import { Resource, Category, User } from "@shared/schema";

export type ResourceWithCategory = Resource & {
  category?: Category;
};

export type SortOrder = "newest" | "popular" | "price-low" | "price-high";

export type FilterType = "all" | "free" | "paid";

export type AdminTabType = "resources" | "upload" | "categories" | "users" | "stats";

export type UserRole = "user" | "admin";

export interface AuthUser extends User {
  role: UserRole;
}
