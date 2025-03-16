export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'team_lead' | 'support' | 'technical';
}

export interface Ticket {
  id: string;
  title: string;
  description: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high';
  assignedTo?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Team {
  id: string;
  name: string;
  leadId: string;
  members: string[];
}
