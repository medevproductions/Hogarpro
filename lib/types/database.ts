export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type UserRole = 'owner' | 'seller' | 'client';
export type AccountStatus = 'available' | 'assigned' | 'expired' | 'suspended' | 'maintenance';
export type CodeType = 'access_code' | 'temp_code' | 'household_update' | 'verification' | 'reset_password';
export type CodeStatus = 'pending' | 'received' | 'expired';
export type TransactionType = 'income' | 'expense' | 'commission';

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          phone: string | null;
          role: UserRole;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          phone?: string | null;
          role?: UserRole;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
      };
      streaming_services: {
        Row: {
          id: string;
          name: string;
          slug: string;
          logo_url: string | null;
          color_hex: string;
          default_profiles_count: number;
          retail_price: number;
          cost_price: number;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          logo_url?: string | null;
          color_hex?: string;
          default_profiles_count?: number;
          retail_price?: number;
          cost_price?: number;
          is_active?: boolean;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['streaming_services']['Insert']>;
      };
      streaming_accounts: {
        Row: {
          id: string;
          service_id: string;
          account_email: string;
          account_password: string;
          max_profiles: number;
          available_profiles: number;
          assigned_seller_id: string | null;
          status: AccountStatus;
          purchase_date: string;
          expiration_date: string;
          monthly_cost: number;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          service_id: string;
          account_email: string;
          account_password: string;
          max_profiles?: number;
          available_profiles?: number;
          assigned_seller_id?: string | null;
          status?: AccountStatus;
          purchase_date?: string;
          expiration_date: string;
          monthly_cost?: number;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['streaming_accounts']['Insert']>;
      };
      code_requests: {
        Row: {
          id: string;
          account_id: string | null;
          account_email: string;
          seller_id: string | null;
          request_type: CodeType;
          extracted_code: string | null;
          raw_email_subject: string | null;
          raw_email_body: string | null;
          status: CodeStatus;
          expires_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          account_id?: string | null;
          account_email: string;
          seller_id?: string | null;
          request_type?: CodeType;
          extracted_code?: string | null;
          raw_email_subject?: string | null;
          raw_email_body?: string | null;
          status?: CodeStatus;
          expires_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['code_requests']['Insert']>;
      };
      financial_transactions: {
        Row: {
          id: string;
          account_id: string | null;
          seller_id: string | null;
          type: TransactionType;
          amount: number;
          description: string;
          category: string | null;
          transaction_date: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          account_id?: string | null;
          seller_id?: string | null;
          type: TransactionType;
          amount: number;
          description: string;
          category?: string | null;
          transaction_date?: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['financial_transactions']['Insert']>;
      };
      payment_methods: {
        Row: {
          id: string;
          title: string;
          type: string;
          instructions: string;
          qr_image_url: string | null;
          is_active: boolean;
          display_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          type: string;
          instructions: string;
          qr_image_url?: string | null;
          is_active?: boolean;
          display_order?: number;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['payment_methods']['Insert']>;
      };
    };
  };
}
