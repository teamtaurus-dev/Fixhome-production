export interface SubCategoryItem {
  name: string;
  price: number;
}

export interface Category {
  id: string;
  name: string;
  description: string;
  image_url: string;
  subcategories?: (string | SubCategoryItem)[];
  created_at: string;
}

export interface Worker {
  id: string;
  name: string;
  phone_number: string;
  category: string;
  photo_url: string;
  assigned_jobs: number;
  completed_jobs: number;
  created_at: string;
}

export interface Offer {
  id: string;
  title: string;
  description: string;
  discount_percentage: number;
  discount_type?: "percent" | "flat";
  discount_value?: number;
  is_festival_offer: boolean;
  min_bookings_required?: number;
  code?: string;
  is_active: boolean;
  created_at: string;
}

export interface Booking {
  request_id: string;
  service_type: string;
  mobile_number: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  google_maps_url?: string | null;
  landmark: string | null;
  additional_notes: string | null;
  status: "Pending" | "Assigned" | "In Progress" | "Completed" | "Cancelled";
  is_personal_data_deleted: boolean;
  assigned_worker_id?: string | null;
  assigned_worker_name?: string | null;
  assigned_worker_phone?: string | null;
  assigned_worker_photo?: string | null;
  customer_user_phone?: string | null;
  amount?: number;
  discount_applied?: number;
  final_amount?: number;
  created_at: string;
  updated_at: string;
}

export interface AdminSession {
  token: string;
  mobile_number: string;
  loginTime: number;
}

export interface UserProfile {
  id?: string;
  name: string;
  mobile_number: string;
  password?: string;
  created_at?: string;
  updated_at?: string;
}

export interface FCMNotification {
  id: string;
  title: string;
  body: string;
  timestamp: string;
  read: boolean;
  type?: "booking" | "promo" | "system" | "admin";
  data?: Record<string, string>;
}

