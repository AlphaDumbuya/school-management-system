/**
 * Discipline & Conduct Module Type Definitions
 * Phase 2.3 - Discipline & Conduct Management
 */

// ==================== CONDUCT RULES ====================

export interface ConductRule {
  rule_id: string;
  tenant_id: string;
  name: string;
  description?: string;
  category: 'attendance' | 'academic' | 'behavior' | 'respect' | 'safety';
  severity_level: 'minor' | 'moderate' | 'serious' | 'critical';
  points_value: number;
  consequences: ConductConsequence[];
  requires_parent_notification: boolean;
  requires_documentation: boolean;
  active: boolean;
  created_by?: string;
  created_at: Date;
  updated_at: Date;
}

export interface ConductConsequence {
  occurrence_number: number;
  action_type: string;
  description?: string;
  duration?: number;
}

// ==================== INFRACTION TYPES ====================

export interface InfractionType {
  infraction_type_id: string;
  tenant_id: string;
  rule_id: string;
  name: string;
  description?: string;
  code: string;
  default_points: number;
  is_repeatable: boolean;
  max_occurrences_before_escalation: number;
  active: boolean;
  created_at: Date;
}

// ==================== INFRACTIONS ====================

export interface StudentInfraction {
  infraction_id: string;
  tenant_id: string;
  student_id: string;
  infraction_type_id: string;
  recorded_by: string;
  incident_date: Date;
  incident_description?: string;
  incident_location?: string;
  status: 'recorded' | 'acknowledged' | 'resolved' | 'appealed';
  severity_override?: number;
  notes?: string;
  parent_notified: boolean;
  parent_notification_date?: Date;
  evidence_type?: 'photo' | 'video' | 'document' | 'none';
  evidence_urls?: string[];
  is_confidential: boolean;
  class_id?: string;
  created_at: Date;
  updated_at: Date;
}

export interface InfractionCreateInput {
  student_id: string;
  infraction_type_id: string;
  recorded_by: string;
  incident_date: Date;
  incident_description?: string;
  incident_location?: string;
  severity_override?: number;
  notes?: string;
  evidence_type?: string;
  evidence_urls?: string[];
  is_confidential?: boolean;
  class_id?: string;
}

export interface InfractionQueryOptions {
  status?: string;
  severity?: string;
  date_from?: Date;
  date_to?: Date;
  page?: number;
  limit?: number;
}

// ==================== DISCIPLINE ACTIONS ====================

export interface DisciplineAction {
  action_id: string;
  tenant_id: string;
  student_id: string;
  infraction_id: string;
  action_type: 'warning' | 'detention' | 'suspension' | 'expulsion' | 'counseling';
  action_subtype?: string;
  assigned_by: string;
  action_description?: string;
  action_date: Date;
  start_date?: Date;
  end_date?: Date;
  duration_days?: number;
  status: 'active' | 'completed' | 'appealed' | 'cancelled';
  parent_notified: boolean;
  parent_notification_date?: Date;
  conditions?: string;
  requires_follow_up: boolean;
  follow_up_date?: Date;
  follow_up_assigned_to?: string;
  notes?: string;
  created_at: Date;
  updated_at: Date;
}

export interface DisciplineActionCreateInput {
  student_id: string;
  infraction_id: string;
  action_type: string;
  action_subtype?: string;
  assigned_by: string;
  action_description?: string;
  action_date: Date;
  start_date?: Date;
  end_date?: Date;
  duration_days?: number;
  conditions?: string;
  requires_follow_up?: boolean;
  follow_up_date?: Date;
  follow_up_assigned_to?: string;
  notes?: string;
}

// ==================== DETENTION ====================

export interface DetentionRecord {
  detention_id: string;
  tenant_id: string;
  action_id: string;
  student_id: string;
  detention_type: 'after_school' | 'weekend' | 'lunch' | 'before_school';
  scheduled_date: Date;
  start_time?: string;
  end_time?: string;
  location?: string;
  supervised_by?: string;
  status: 'scheduled' | 'attended' | 'absent' | 'incomplete' | 'rescheduled';
  attended_date?: Date;
  supervisor_notes?: string;
  parent_notified: boolean;
  created_at: Date;
}

export interface DetentionCreateInput {
  action_id: string;
  student_id: string;
  detention_type: string;
  scheduled_date: Date;
  start_time?: string;
  end_time?: string;
  location?: string;
  supervised_by?: string;
  parent_notified?: boolean;
}

// ==================== BEHAVIORAL NOTES ====================

export interface BehavioralNote {
  note_id: string;
  tenant_id: string;
  student_id: string;
  recorded_by: string;
  note_type: 'positive' | 'concern' | 'observation' | 'commendation';
  content?: string;
  category?: 'academic' | 'social' | 'emotional' | 'behavioral';
  rating?: number; // 1-5
  class_id?: string;
  note_date: Date;
  parent_notified: boolean;
  is_shared_with_student: boolean;
  is_confidential: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface BehavioralNoteCreateInput {
  student_id: string;
  recorded_by: string;
  note_type: string;
  content?: string;
  category?: string;
  rating?: number;
  class_id?: string;
  note_date?: Date;
  parent_notified?: boolean;
  is_shared_with_student?: boolean;
  is_confidential?: boolean;
}

// ==================== APPEALS ====================

export interface DisciplineAppeal {
  appeal_id: string;
  tenant_id: string;
  action_id: string;
  student_id: string;
  submitted_by: string;
  submitted_by_type: 'student' | 'parent' | 'guardian';
  appeal_reason?: string;
  status: 'pending' | 'under_review' | 'approved' | 'rejected' | 'escalated';
  evidence?: string; // JSON with evidence files
  submitted_date: Date;
  reviewed_by?: string;
  review_notes?: string;
  review_date?: Date;
  appeal_decision?: string;
  decision_type?: 'upheld' | 'reduced' | 'overturned';
  modified_action?: string;
  created_at: Date;
  updated_at: Date;
}

export interface AppealCreateInput {
  action_id: string;
  student_id: string;
  submitted_by: string;
  submitted_by_type: string;
  appeal_reason?: string;
  evidence?: string;
}

// ==================== REPORTS ====================

export interface ConductReport {
  report_id: string;
  tenant_id: string;
  student_id: string;
  generated_by?: string;
  report_period: 'term' | 'semester' | 'year' | 'custom';
  period_start_date?: Date;
  period_end_date?: Date;
  total_infractions: number;
  total_points: number;
  behavioral_rating?: number;
  strengths?: string;
  areas_for_improvement?: string;
  teacher_comments?: string;
  overall_assessment?: string;
  parent_shared: boolean;
  parent_share_date?: Date;
  parent_acknowledged: boolean;
  created_at: Date;
}

// ==================== ANALYTICS ====================

export interface ConductAnalytics {
  analytics_id: string;
  tenant_id: string;
  class_id?: string;
  analytics_date: Date;
  total_students: number;
  students_with_infractions: number;
  total_infractions: number;
  total_detentions: number;
  total_suspensions: number;
  infractions_by_type: Record<string, number>;
  infractions_by_severity: Record<string, number>;
  average_behavior_rating?: number;
  pending_appeals: number;
  created_at: Date;
}

// ==================== AUDIT LOGS ====================

export interface DisciplineAuditLog {
  log_id: string;
  tenant_id: string;
  entity_type: string;
  entity_id?: string;
  user_id?: string;
  action: 'created' | 'updated' | 'deleted' | 'approved';
  changes?: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
  timestamp: Date;
}

// ==================== QUERY OPTIONS ====================

export interface DisciplineQueryOptions {
  page?: number;
  limit?: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
  filters?: {
    status?: string;
    action_type?: string;
    date_from?: Date;
    date_to?: Date;
    severity?: string;
  };
}

// ==================== STATISTICS ====================

export interface StudentDisciplineStats {
  student_id: string;
  total_infractions: number;
  total_points: number;
  active_actions: number;
  pending_appeals: number;
  positive_notes: number;
  last_infraction_date?: Date;
  behavior_trend: 'improving' | 'stable' | 'declining';
  risk_level: 'low' | 'medium' | 'high' | 'critical';
}

export interface ClassDisciplineStats {
  class_id: string;
  students_count: number;
  students_with_infractions: number;
  total_infractions: number;
  common_infractions: string[];
  average_behavior_rating: number;
  most_common_action: string;
}

// ==================== NOTIFICATIONS ====================

export interface DisciplineNotification {
  type: 'infraction_recorded' | 'action_assigned' | 'detention_scheduled' | 'appeal_submitted';
  student_id: string;
  parent_id?: string;
  related_entity_id: string;
  message: string;
  priority: 'normal' | 'high' | 'urgent';
}

// ==================== CONFIGURATION ====================

export interface DisciplineConfig {
  tenant_id: string;
  points_for_suspension: number;
  points_for_expulsion: number;
  max_detentions_per_week: number;
  parent_notification_threshold: string; // infraction severity or action type
  enable_student_appeals: boolean;
  appeal_window_days: number;
  require_documentation: boolean;
  auto_escalate_on_points: boolean;
  attendance_infraction_enabled: boolean;
  created_at: Date;
  updated_at: Date;
}
