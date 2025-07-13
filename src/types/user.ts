import type { DocumentData } from 'firebase/firestore';

export interface UserProfile extends DocumentData {
  status: 'approved' | 'pending_approval' | 'rejected';
  fullName: string;
  // other profile fields can be added here
}
