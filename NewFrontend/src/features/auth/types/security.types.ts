// Device Information Types
export interface DeviceInfo {
    fingerprint: string;
    userAgent: string;
    platform: string;
    language: string;
    timezone: string;
    screen: {
        width: number;
        height: number;
        colorDepth: number;
    };
    hardware: {
        cores: number;
        memory?: number;
        gpu?: string;
    };
    network?: {
        ip?: string;
        type?: string;
        downlink?: number;
    };
}

// Security Context Types
export type SecurityActionType = 
    | 'DEVICE_VERIFICATION'
    | 'PASSWORD_CHANGE_REQUIRED'
    | 'MFA_REQUIRED'
    | 'ACCOUNT_LOCKED'
    | 'SUSPICIOUS_ACTIVITY';

export type SecurityRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface SecurityContext {
    deviceTrusted: boolean;
    mfaEnabled: boolean;
    lastLoginAt?: Date;
    lastPasswordChange?: Date;
    requiresAction: boolean;
    action?: SecurityActionType;
    riskLevel: SecurityRiskLevel;
    suspiciousActivities?: SuspiciousActivity[];
    activeDevices?: number;
    sessionExpiry?: Date;
}

// Security Event Types
export interface SuspiciousActivity {
    type: string;
    timestamp: Date;
    deviceInfo: DeviceInfo;
    location?: GeoLocation;
    riskLevel: SecurityRiskLevel;
    description: string;
    resolved: boolean;
}

export interface GeoLocation {
    ip: string;
    country?: string;
    region?: string;
    city?: string;
    latitude?: number;
    longitude?: number;
    timezone?: string;
}

// Security Headers
export interface SecurityHeaders {
    'X-CSRF-Token': string;
    'X-Device-Fingerprint': string;
    'X-Request-ID'?: string;
    'X-Request-Start'?: string;
}

// Security Error Types
export type SecurityErrorType = 
    | 'CSRF_TOKEN_INVALID'
    | 'SESSION_EXPIRED'
    | 'DEVICE_NOT_TRUSTED'
    | 'INVALID_TOKEN'
    | 'MFA_REQUIRED'
    | 'ACCOUNT_LOCKED'
    | 'RATE_LIMIT_EXCEEDED'
    | 'SUSPICIOUS_ACTIVITY_DETECTED';

// Security Error Class
export class SecurityError extends Error {
    readonly type: SecurityErrorType;
    readonly code: string;
    readonly timestamp: Date;
    readonly context?: Record<string, any>;

    constructor(
        type: SecurityErrorType,
        message: string,
        code?: string,
        context?: Record<string, any>
    ) {
        super(message);
        this.name = 'SecurityError';
        this.type = type;
        this.code = code || type;
        this.timestamp = new Date();
        this.context = context;

        // Ensures proper prototype chain for instanceof checks
        Object.setPrototypeOf(this, SecurityError.prototype);
    }

    toJSON() {
        return {
            type: this.type,
            message: this.message,
            code: this.code,
            timestamp: this.timestamp,
            context: this.context
        };
    }
}

// Update the existing SecurityError interface to match the class
export interface ISecurityError {
    type: SecurityErrorType;
    message: string;
    code: string;
    timestamp: Date;
    context?: Record<string, any>;
}

// Security Settings
export interface SecuritySettings {
    mfaEnabled: boolean;
    mfaMethod?: 'APP' | 'SMS' | 'EMAIL';
    deviceTrustEnabled: boolean;
    loginNotifications: boolean;
    suspiciousActivityAlerts: boolean;
    passwordExpiryDays: number;
    ipWhitelist?: string[];
    deviceWhitelist?: string[];
}

// Security Verification
export interface VerificationRequest {
    type: 'EMAIL' | 'SMS' | 'APP';
    deviceInfo: DeviceInfo;
    timestamp: Date;
    expiresAt: Date;
    metadata?: Record<string, any>;
}

export interface VerificationResponse {
    verified: boolean;
    token?: string;
    expiresAt?: Date;
    requiresAdditionalStep?: boolean;
    nextStep?: SecurityActionType;
}

// Session Security
export interface SessionSecurityInfo {
    id: string;
    createdAt: Date;
    expiresAt: Date;
    lastActivity: Date;
    deviceInfo: DeviceInfo;
    location?: GeoLocation;
    active: boolean;
    riskLevel: SecurityRiskLevel;
}

// Security Audit
export interface SecurityAuditLog {
    eventType: string;
    timestamp: Date;
    userId: string;
    deviceInfo: DeviceInfo;
    location?: GeoLocation;
    details: Record<string, any>;
    riskLevel: SecurityRiskLevel;
}