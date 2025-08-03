
export interface AttendanceRecord {
  id: string;
  userId: string;
  userName: string;
  clockInTime: string; // ISO string
  clockOutTime?: string; // ISO string, optional
  status: 'clocked-in' | 'clocked-out';
  duration?: string;
  latitude?: number;
  longitude?: number;
}
