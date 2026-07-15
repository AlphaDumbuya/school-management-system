import React from 'react';
import { useAuth } from '@hooks/useAuth';

export type RoleGuardRole = 'super_admin' | 'principal' | 'teacher' | 'student' | 'parent' | 'accountant' | 'admissions_officer';

export interface RoleGuardProps {
  roles: RoleGuardRole[];
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export const RoleGuard: React.FC<RoleGuardProps> = ({ roles, fallback = null, children }) => {
  const { canAccess } = useAuth();
  return <>{canAccess(roles as any) ? children : fallback}</>;
};

export default RoleGuard;
