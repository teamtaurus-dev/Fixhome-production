export interface Category {
  id: string;
  name: string;
  description: string;
  image_url: string;
  created_at: string;
}

export interface Booking {
  request_id: string;
  service_type: string;
  mobile_number: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  landmark: string | null;
  additional_notes: string | null;
  status: "Pending" | "Assigned" | "In Progress" | "Completed";
  is_personal_data_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export interface AdminSession {
  token: string;
  mobile_number: string;
  loginTime: number;
}
