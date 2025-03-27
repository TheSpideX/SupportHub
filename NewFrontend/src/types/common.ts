export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'team_lead' | 'support' | 'technical' | 'customer';
}

export interface Ticket {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  assignedTo?: string;
  createdAt: string;
  updatedAt: string;
  subTickets?: number;
  sharedWith?: string[];
}

export interface Team {
  id: string;
  name: string;
  leadId: string;
  members: string[];
}
