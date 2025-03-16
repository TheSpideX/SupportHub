import { UserRole } from '../types';

export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  admin: ['*'], // All permissions
  team_lead: [
    'view:dashboard',
    'view:team',
    'manage:team',
    'view:tickets',
    'manage:tickets',
    'view:reports'
  ],
  technical: [
    'view:dashboard',
    'view:tickets',
    'update:tickets',
    'view:knowledge'
  ],
  support: [
    'view:dashboard',
    'view:tickets',
    'update:tickets',
    'create:tickets'
  ],
  customer: [
    'view:dashboard',
    'view:my_tickets',
    'create:tickets',
    'comment:tickets'
  ]
};

export const ROLE_REDIRECTS: Record<UserRole, string> = {
  admin: '/dashboard',
  team_lead: '/dashboard',
  technical: '/tickets',
  support: '/tickets',
  customer: '/my-tickets'
};