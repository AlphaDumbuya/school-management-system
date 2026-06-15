/**
 * Admission Types
 * Type definitions for the admissions workflow
 */

export enum ApplicationStatus {
  SUBMITTED = 'submitted',
  UNDER_REVIEW = 'under_review',
  INTERVIEW_SCHEDULED = 'interview_scheduled',
  INTERVIEWED = 'interviewed',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
  WAITLIST = 'waitlist',
  ENROLLED = 'enrolled'
}

export enum ApplicationSource {
  ONLINE = 'online',
  WALK_IN = 'walk_in',
  REFERRAL = 'referral',
  AGENT = 'agent',
  OTHER = 'other'
}

export enum DocumentType {
  BIRTH_CERTIFICATE = 'birth_certificate',
  REPORT_CARD = 'report_card',
  TRANSFER_CERTIFICATE = 'transfer_certificate',
  MEDICAL_CERTIFICATE = 'medical_certificate',
  PARENT_ID = 'parent_id',
  PHOTO = 'photo',
  PROOF_OF_RESIDENCE = 'proof_of_residence',
  OTHER = 'other'
}

export enum VerificationStatus {
  PENDING = 'pending',
  VERIFIED = 'verified',
  REJECTED = 'rejected'
}

export enum InterviewMode {
  IN_PERSON = 'in_person',
  VIDEO_CALL = 'video_call',
  PHONE = 'phone'
}

export enum InterviewStatus {
  SCHEDULED = 'scheduled',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  RESCHEDULED = 'rescheduled'
}

export enum InterviewRecommendation {
  STRONGLY_RECOMMEND = 'strongly_recommend',
  RECOMMEND = 'recommend',
  NEUTRAL = 'neutral',
  NOT_RECOMMEND = 'not_recommend'
}

export interface AdmissionApplication {
  id: string;
  application_number: string;
  
  // Applicant information
  first_name: string;
  last_name: string;
  date_of_birth?: Date;
  gender?: string;
  email?: string;
  phone_number?: string;
  
  // Parent/Guardian info
  parent_name?: string;
  parent_email?: string;
  parent_phone: string;
  address?: string;
  
  // Application details
  grade_id?: string;
  academic_year?: string;
  status: ApplicationStatus;
  application_source?: ApplicationSource;
  referral_source?: string;
  
  // Assignment and tracking
  assigned_to?: string;
  application_date: Date;
  decision_date?: Date;
  decision_notes?: string;
  application_score?: number;
  
  // Timestamps
  created_at: Date;
  updated_at: Date;
  created_by?: string;
  updated_by?: string;
}

export interface ApplicationDocument {
  id: string;
  application_id: string;
  document_type: DocumentType;
  
  file_name?: string;
  file_path?: string;
  file_size?: string;
  mime_type?: string;
  
  verification_status: VerificationStatus;
  verified_by?: string;
  verified_at?: Date;
  verification_notes?: string;
  
  created_at: Date;
  updated_at: Date;
  uploaded_by?: string;
}

export interface ApplicationInterview {
  id: string;
  application_id: string;
  
  interview_date: Date;
  interview_time?: string;
  interview_location?: string;
  interview_mode: InterviewMode;
  interview_link?: string;
  
  interviewer_id?: string;
  interview_notes?: string;
  interview_score?: number;
  recommendation?: InterviewRecommendation;
  
  status: InterviewStatus;
  completed_at?: Date;
  
  created_at: Date;
  updated_at: Date;
  created_by?: string;
}

export interface AdmissionRequirement {
  id: string;
  grade_id: string;
  
  min_age?: number;
  max_age?: number;
  required_documents?: string[];
  prerequisites?: string;
  special_requirements?: string;
  interview_required: boolean;
  application_fee?: number;
  
  created_at: Date;
  updated_at: Date;
}

export interface ApplicationTimeline {
  id: string;
  application_id: string;
  
  status_from?: string;
  status_to: string;
  notes?: string;
  changed_by?: string;
  changed_at: Date;
}

// DTOs for API requests
export interface CreateApplicationDTO {
  first_name: string;
  last_name: string;
  date_of_birth?: string;
  gender?: string;
  email?: string;
  phone_number?: string;
  
  parent_name?: string;
  parent_email?: string;
  parent_phone: string;
  address?: string;
  
  grade_id?: string;
  academic_year?: string;
  application_source?: ApplicationSource;
  referral_source?: string;
}

export interface UpdateApplicationDTO {
  first_name?: string;
  last_name?: string;
  date_of_birth?: string;
  gender?: string;
  email?: string;
  phone_number?: string;
  
  parent_name?: string;
  parent_email?: string;
  parent_phone?: string;
  address?: string;
  
  grade_id?: string;
  academic_year?: string;
  assigned_to?: string;
  application_score?: number;
}

export interface UpdateApplicationStatusDTO {
  status: ApplicationStatus;
  decision_notes?: string;
}

export interface ScheduleInterviewDTO {
  interview_date: string;
  interview_time?: string;
  interview_location?: string;
  interview_mode: InterviewMode;
  interview_link?: string;
  interviewer_id?: string;
}

export interface UpdateInterviewDTO {
  interview_notes?: string;
  interview_score?: number;
  recommendation?: InterviewRecommendation;
  status?: InterviewStatus;
}

export interface AdmissionStatistics {
  totalApplications: number;
  byStatus: Record<ApplicationStatus, number>;
  bySource: Record<ApplicationSource, number>;
  byGrade: Array<{ grade_name: string; count: number }>;
  averageScore?: number;
  interviewsPending: number;
  interviewsCompleted: number;
  acceptanceRate?: number;
}

export interface ApplicationListQuery {
  status?: ApplicationStatus;
  grade_id?: string;
  assigned_to?: string;
  date_from?: string;
  date_to?: string;
  search?: string;
  page?: number;
  limit?: number;
}
