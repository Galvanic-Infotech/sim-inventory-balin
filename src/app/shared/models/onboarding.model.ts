export type OnboardingStepKey =
  | 'idle'
  | 'resolveEntityType'
  | 'createEntity'
  | 'createRole'
  | 'assignPermissions'
  | 'createUser'
  | 'done'
  | 'error';

export interface OnboardingStep {
  key: OnboardingStepKey;
  labelKey: string;
  status: 'pending' | 'active' | 'done' | 'error';
  detail?: string;
  error?: string;
}

export interface OnboardingRequest {
  entityName: string;
  firstName: string;
  lastName: string;
  email: string;
  mobile: string;
  password: string;
  entityTypeId: string;
  /** Admin role name (default Admin). */
  roleName?: string;
}

export interface OnboardingResult {
  entityId: string;
  entityName: string;
  roleId: string;
  roleName: string;
  userId?: string;
  email: string;
  mobile: string;
  password: string;
}
