
export interface Task {
  id: string;
  title: string;
  status: 'pending' | 'completed';
  assignedToUid: string;
  assignedToName: string;
  assignedByUid: string;
  assignedByName: string;
  createdAt: string; // ISO string
  completedAt?: string; // ISO string, optional
  franchiseId?: string;
  franchiseName?: string;
}
