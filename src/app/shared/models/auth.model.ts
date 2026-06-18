export type LoginSearchBy = 'mobile' | 'email';

export interface LoginRequest {
  searchBy: LoginSearchBy;
  password: string;
  mobile: string;
}

export interface LoginResponse {
  success: boolean;
  statusCode: number;
  message: string;
  data: LoginData;
}

export interface LoginData {
  token: string;
  firstName: string;
  lastName: string;
  entityType: string;
}

export interface ForgotPasswordInitiateRequest {
  mobileNumber: string;
}

export interface ForgotPasswordOtpResponse {
  success: boolean;
  statusCode: number;
  message: string;
  data: { requestId: string };
}

export interface ForgotPasswordVerifyRequest {
  requestId: string;
  otp: string;
}

export interface ForgotPasswordResetRequest {
  requestId: string;
  newPassword: string;
}

export interface ApiResponse {
  success: boolean;
  statusCode: number;
  message: string;
  data: unknown;
}

export interface ChangePasswordRequest {
  oldPassword: string;
  newPassword: string;
}

export interface UserProfile {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  mobileNumber: string;
  role: { id: string; name: string };
  entity: {
    id: string;
    name: string;
    entityType: { id: string; name: string; description: string | null; menuName?: string | null };
  };
}

export interface TokenPayload {
  'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier': string;
  entityId: string;
  roleId: string;
  exp: number;
  iss: string;
  aud: string;
}
