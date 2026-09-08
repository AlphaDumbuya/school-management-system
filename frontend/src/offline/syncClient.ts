/**
 * syncClient — thin wrapper over the teacher offline sync API.
 *   pull(since?)  → teacher-scoped changed rows
 *   push(items)   → batch apply queued local writes (per-item result)
 */
import apiClient from '../lib/apiClient';

export interface SyncPullData {
  serverTime: string;
  classes: any[];
  students: any[];
  subjects: any[];
  timetable: any[];
  attendance: any[];
  grades: any[];
  assignments: any[];
}

export interface PushItem {
  entity: 'attendance' | 'grade' | 'assignment';
  op: 'create' | 'update';
  clientId: string;
  payload: any;
}

export interface PushResult {
  clientId: string;
  result: 'applied' | 'duplicate' | 'rejected';
  reason?: string;
  serverId?: string;
}

export const syncClient = {
  async pull(since?: string) {
    return apiClient.get<{ success: boolean; data: SyncPullData }>('/api/v1/sync/pull', {
      params: since ? { since } : undefined,
    });
  },
  async push(items: PushItem[]) {
    return apiClient.post<{ success: boolean; data: PushResult[] }>('/api/v1/sync/push', { items });
  },
};

export default syncClient;
