/**
 * SMS & WhatsApp Integration Types
 * Phase 2.4
 */

// ==================== PROVIDER CONFIGURATION ====================

export interface SMSWhatsAppProvider {
  provider_id: string;
  tenant_id: string;
  provider_name: 'twilio' | 'brevo' | 'messagebird' | 'custom';
  provider_type: 'sms' | 'whatsapp' | 'both';
  api_key?: string;
  api_secret?: string;
  account_sid?: string; // For Twilio
  auth_token?: string;
  phone_number: string;
  business_account_id?: string; // For WhatsApp Business
  webhook_url?: string;
  webhook_secret?: string;
  cost_per_sms: number;
  cost_per_whatsapp_message: number;
  is_primary: boolean;
  enabled: boolean;
  configuration?: Record<string, any>;
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

export interface CreateProviderRequest {
  provider_name: 'twilio' | 'brevo' | 'messagebird' | 'custom';
  provider_type: 'sms' | 'whatsapp' | 'both';
  is_primary?: boolean;
  enabled?: boolean;
  api_key?: string;
  api_secret?: string;
  account_sid?: string;
  auth_token?: string;
  phone_number: string;
  business_account_id?: string;
  webhook_url?: string;
  webhook_secret?: string;
  cost_per_sms?: number;
  cost_per_whatsapp_message?: number;
  configuration?: Record<string, any>;
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
  variables_required?: string[]; // e.g., ['student_name', 'date']
  message_prefix?: string;
  estimated_length: number;
  estimated_sms_parts: number;
  is_active: boolean;
  requires_approval: boolean;
  created_by: string;
  approved_by?: string;
  approved_at?: Date;
  created_at: Date;
  updated_at: Date;
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
  recipient_country_code?: string;
  channel: MessageChannel;
  message_content: string;
  message_type: MessageTemplateType;
  status: MessageStatus;
  provider_message_id?: string;
  message_parts: number;
  cost?: number;
  error_message?: string;
  error_code?: string;
  scheduled_at?: Date;
  sent_at?: Date;
  delivered_at?: Date;
  read_at?: Date;
  source_id?: string; // Related entity ID
  source_type?: string; // 'event', 'attendance', 'grade', 'discipline'
  metadata?: Record<string, any>;
  sent_by: string;
  created_at: Date;
  updated_at: Date;
}

export interface SendMessageRequest {
  recipient_id: string;
  template_id?: string;
  channel: MessageChannel;
  message_content?: string; // If not using template
  template_variables?: Record<string, any>;
  scheduled_at?: Date;
  source_id?: string;
  source_type?: string;
  metadata?: Record<string, any>;
}

export interface BulkSendRequest {
  recipient_ids: string[];
  template_id?: string;
  channel: MessageChannel;
  message_content?: string;
  template_variables?: Record<string, any>;
  scheduled_at?: Date;
  source_id?: string;
  source_type?: string;
}

// ==================== DELIVERY LOGS ====================

export interface DeliveryLog {
  log_id: string;
  message_id: string;
  status: MessageStatus;
  status_details?: string;
  error_code?: string;
  error_message?: string;
  retry_count: number;
  attempt_number: number;
  log_time: Date;
  webhook_payload?: Record<string, any>;
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
  verification_code_sent_at?: Date;
  verified_at?: Date;
  verification_attempts: number;
  active: boolean;
  verification_delivery_error?: string;
  metadata?: Record<string, any>;
  created_at: Date;
  updated_at: Date;
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

// ==================== MESSAGE SCHEDULING ====================

export type ScheduleType = 'once' | 'daily' | 'weekly' | 'monthly';

export interface MessageSchedule {
  schedule_id: string;
  tenant_id: string;
  template_id?: string;
  recipient_id: string;
  channel: MessageChannel;
  message_content?: string;
  recipient_variables?: Record<string, any>;
  schedule_type: ScheduleType;
  first_send_time: Date;
  next_send_time?: Date;
  recurrence_pattern?: string; // e.g., 'daily', 'every_monday', 'monthly_on_15'
  max_occurrences?: number;
  occurrences_sent: number;
  end_date?: Date;
  status: 'active' | 'paused' | 'completed' | 'cancelled';
  metadata?: Record<string, any>;
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

export interface CreateScheduleRequest {
  recipient_id: string;
  template_id?: string;
  channel: MessageChannel;
  message_content?: string;
  template_variables?: Record<string, any>;
  schedule_type: ScheduleType;
  first_send_time: Date;
  recurrence_pattern?: string;
  max_occurrences?: number;
  end_date?: Date;
  metadata?: Record<string, any>;
}

// ==================== OPT-OUTS ====================

export interface OptOut {
  optout_id: string;
  tenant_id: string;
  user_id: string;
  channel: 'sms' | 'whatsapp' | 'both';
  reason?: string;
  status: 'active' | 'removed';
  notes?: string;
  processed_by?: string;
  created_at: Date;
  updated_at: Date;
}

export interface CreateOptOutRequest {
  user_id: string;
  channel: 'sms' | 'whatsapp' | 'both';
  reason?: string;
  notes?: string;
}

// ==================== ANALYTICS ====================

export interface MessagingAnalytics {
  analytics_id: string;
  tenant_id: string;
  analytics_date: Date;
  channel: MessageChannel;
  provider_name?: string;
  messages_sent: number;
  messages_delivered: number;
  messages_failed: number;
  messages_bounced: number;
  total_cost: number;
  average_delivery_time_seconds?: number;
  distinct_recipients: number;
  message_types_breakdown?: Record<string, number>;
  error_summary?: Record<string, number>;
  created_at: Date;
  updated_at: Date;
}

export interface UserMessagingStats {
  stat_id: string;
  tenant_id: string;
  user_id: string;
  total_sms_sent: number;
  total_sms_delivered: number;
  total_whatsapp_sent: number;
  total_whatsapp_delivered: number;
  total_cost_sms: number;
  total_cost_whatsapp: number;
  last_sms_sent_at?: Date;
  last_whatsapp_sent_at?: Date;
  sms_opted_out: boolean;
  whatsapp_opted_out: boolean;
  created_at: Date;
  updated_at: Date;
}

// ==================== RESPONSES ====================

export interface SendMessageResponse {
  message_id: string;
  status: MessageStatus;
  provider_message_id?: string;
  scheduled_at?: Date;
  estimated_cost?: number;
  error?: string;
}

export interface MessageStatusResponse {
  message_id: string;
  status: MessageStatus;
  provider_message_id?: string;
  sent_at?: Date;
  delivered_at?: Date;
  read_at?: Date;
  error_code?: string;
  error_message?: string;
  delivery_logs: DeliveryLog[];
}

export interface ProviderStatusResponse {
  provider_id: string;
  provider_name: string;
  is_primary: boolean;
  enabled: boolean;
  phone_number: string;
  status: 'connected' | 'error' | 'testing';
  last_tested_at?: Date;
  error_message?: string;
  balance?: number; // For prepaid providers
}

// ==================== WEBHOOK PAYLOADS ====================

export interface WebhookPayload {
  message_id: string;
  provider_message_id: string;
  status: MessageStatus;
  timestamp: Date;
  error_code?: string;
  error_message?: string;
  retry_count?: number;
}

// ==================== REQUEST FILTERS ====================

export interface MessageFilterRequest {
  status?: MessageStatus;
  channel?: MessageChannel;
  recipient_id?: string;
  source_type?: string;
  source_id?: string;
  date_from?: Date;
  date_to?: Date;
  limit?: number;
  offset?: number;
}

export interface AnalyticsFilterRequest {
  channel?: MessageChannel;
  provider_name?: string;
  date_from?: Date;
  date_to?: Date;
  group_by?: 'day' | 'week' | 'month';
}
