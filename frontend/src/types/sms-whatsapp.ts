/**
 * SMS & WhatsApp Integration Types (Frontend)
 * Phase 2.4
 * 
 * These types mirror the backend types for frontend components
 */

// ==================== PROVIDER CONFIGURATION ====================

export interface SMSWhatsAppProvider {
  provider_id: string;
  tenant_id: string;
  provider_name: 'twilio' | 'brevo' | 'messagebird' | 'custom';
  provider_type: 'sms' | 'whatsapp' | 'both';
  api_key?: string;
  phone_number: string;
  is_primary: boolean;
  enabled: boolean;
  created_at: string;
}

export interface CreateProviderRequest {
  provider_name: 'twilio' | 'brevo' | 'messagebird' | 'custom';
  provider_type: 'sms' | 'whatsapp' | 'both';
  api_key: string;
  api_secret?: string;
  account_sid?: string;
  auth_token?: string;
  phone_number: string;
  business_account_id?: string;
  cost_per_sms?: number;
  cost_per_whatsapp_message?: number;
}

// ==================== TEMPLATES ====================

export type MessageTemplateType =
  | 'event_reminder'
  | 'attendance_alert'
  | 'grade_notification'
  | 'payment_reminder'
  | 'disciplinary_action'
  | 'enrollment_confirmation'
  | 'schedule_update'
  | 'general';

export type MessageChannel = 'sms' | 'whatsapp';

export interface SMSWhatsAppTemplate {
  template_id: string;
  tenant_id: string;
  template_name: string;
  description?: string;
  template_type: MessageTemplateType;
  channel: MessageChannel;
  sms_content: string;
  whatsapp_content?: string;
  variables_required?: string[];
  message_prefix?: string;
  estimated_length: number;
  estimated_sms_parts: number;
  is_active: boolean;
  requires_approval: boolean;
  created_by: string;
  approved_by?: string;
  approved_at?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateTemplateRequest {
  template_name: string;
  description?: string;
  template_type: MessageTemplateType;
  channel: MessageChannel;
  sms_content: string;
  whatsapp_content?: string;
  variables_required?: string[];
  message_prefix?: string;
}

// ==================== MESSAGES ====================

export type MessageStatus =
  | 'pending'
  | 'sent'
  | 'delivered'
  | 'failed'
  | 'bounced'
  | 'read';

export interface SMSWhatsAppMessage {
  message_id: string;
  tenant_id: string;
  provider_id: string;
  template_id?: string;
  recipient_id: string;
  recipient_phone_number: string;
  channel: MessageChannel;
  message_content: string;
  message_type: MessageTemplateType;
  status: MessageStatus;
  provider_message_id?: string;
  message_parts: number;
  cost?: number;
  error_message?: string;
  sent_at?: string;
  delivered_at?: string;
  read_at?: string;
  source_id?: string;
  source_type?: string;
  created_at: string;
  updated_at: string;
}

export interface SendMessageRequest {
  recipient_id: string;
  template_id?: string;
  channel: MessageChannel;
  message_content?: string;
  template_variables?: Record<string, any>;
  scheduled_at?: string;
  source_id?: string;
  source_type?: string;
}

export interface BulkSendRequest {
  recipient_ids: string[];
  template_id?: string;
  channel: MessageChannel;
  message_content?: string;
  template_variables?: Record<string, any>;
}

// ==================== PHONE NUMBERS ====================

export type PhoneType = 'personal' | 'home' | 'work' | 'emergency';

export interface PhoneNumber {
  phone_id: string;
  tenant_id: string;
  user_id: string;
  phone_number: string;
  country_code: string;
  phone_type: PhoneType;
  is_primary: boolean;
  sms_enabled: boolean;
  whatsapp_enabled: boolean;
  verified: boolean;
  verification_code?: string;
  verification_attempts: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AddPhoneNumberRequest {
  phone_number: string;
  country_code: string;
  phone_type: PhoneType;
  is_primary?: boolean;
  sms_enabled?: boolean;
  whatsapp_enabled?: boolean;
}

export interface VerifyPhoneRequest {
  phone_id: string;
  verification_code: string;
}

// ==================== SCHEDULING ====================

export type ScheduleType = 'once' | 'daily' | 'weekly' | 'monthly';

export interface MessageSchedule {
  schedule_id: string;
  tenant_id: string;
  template_id?: string;
  recipient_id: string;
  channel: MessageChannel;
  message_content?: string;
  schedule_type: ScheduleType;
  first_send_time: string;
  next_send_time?: string;
  recurrence_pattern?: string;
  max_occurrences?: number;
  occurrences_sent: number;
  status: 'active' | 'paused' | 'completed' | 'cancelled';
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface CreateScheduleRequest {
  recipient_id: string;
  template_id?: string;
  channel: MessageChannel;
  message_content?: string;
  template_variables?: Record<string, any>;
  schedule_type: ScheduleType;
  first_send_time: string;
  recurrence_pattern?: string;
  max_occurrences?: number;
  end_date?: string;
}

// ==================== ANALYTICS ====================

export interface MessagingAnalytics {
  analytics_id: string;
  tenant_id: string;
  analytics_date: string;
  channel: MessageChannel;
  provider_name?: string;
  messages_sent: number;
  messages_delivered: number;
  messages_failed: number;
  messages_bounced: number;
  total_cost: number;
  average_delivery_time_seconds?: number;
  distinct_recipients: number;
  delivery_rate?: string;
  created_at: string;
  updated_at: string;
}

// ==================== RESPONSES ====================

export interface SendMessageResponse {
  message_id: string;
  status: MessageStatus;
  provider_message_id?: string;
  scheduled_at?: string;
  estimated_cost?: number;
  error?: string;
}

export interface MessageStatusResponse {
  message_id: string;
  status: MessageStatus;
  provider_message_id?: string;
  sent_at?: string;
  delivered_at?: string;
  read_at?: string;
  error_code?: string;
  error_message?: string;
}

export interface ProviderStatusResponse {
  provider_id: string;
  provider_name: string;
  is_primary: boolean;
  enabled: boolean;
  phone_number: string;
  status: 'connected' | 'error' | 'testing';
  last_tested_at?: string;
  error_message?: string;
}

// ==================== API RESPONSES ====================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  total?: number;
}
