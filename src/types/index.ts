export interface Resource {
  id: number;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
}

export interface CreateResourceInput {
  name: string;
  description: string;
}

export interface UpdateResourceInput {
  name?: string;
  description?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface Env {
  TURSO_DATABASE_URL: string;
  TURSO_AUTH_TOKEN: string;
  ENVIRONMENT?: string;
  CORS_DOMAINS?: string;
}

export interface User {
  id: number;
  username: string;
  role: string;
  created_at: string;
}

export interface Store {
  id: number;
  name: string;
  created_at: string;
}

export interface Ingredient {
  id: number;
  name: string;
  quantity: number;
  unit: string;
  store_id: number;
  created_at: string;
}

export interface Dish {
  id: number;
  name: string;
  store_id: number;
  created_at: string;
}

export interface DishIngredient {
  id: number;
  dish_id: number;
  ingredient_id: number;
  quantity: number;
}

export interface DishWithIngredients extends Dish {
  ingredients: Array<{
    id: number;
    name: string;
    unit: string;
    quantity: number;
  }>;
}

export interface OperationLog {
  id: number;
  operation_type: string;
  operation_time: string;
  user_id: number | null;
  store_id: number;
  details: string;
  is_revoked: number;
  revoked_time: string | null;
  revoked_by: number | null;
  user_name?: string;
  revoked_by_name?: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  message: string;
  user: {
    id: number;
    username: string;
    role: string;
  };
  token: string;
}

export interface ChangePasswordRequest {
  oldPassword: string;
  newPassword: string;
}

export interface CreateUserRequest {
  username: string;
  password: string;
  role?: 'admin' | 'user';
}

export interface CreateIngredientRequest {
  name: string;
  quantity: number;
  unit: string;
  store_id: number;
}

export interface UpdateIngredientRequest {
  quantity: number;
  unit: string;
}

export interface CreateDishRequest {
  name: string;
  ingredients: Array<{
    ingredient_id: number;
    quantity?: number;
  }>;
  store_id: number;
}

export interface BatchUseDishRequest {
  dishes: Array<{
    name: string;
    quantity: number;
  }>;
  store_id: number;
}

export interface IngredientConsumption {
  ingredient_id: number;
  ingredient_name: string;
  unit: string;
  total_quantity: number;
  use_count: number;
}
