
import type { DocumentData } from 'firebase/firestore';

export const PERMISSION_MODULES = {
  user_management: 'User Management',
  customer_management: 'Customer Management',
  credit_invoices: 'Credit Invoices',
  franchise_management: 'Franchise Management',
  inventory_management: 'Inventory Management',
  service_management: 'Service Management',
  category_management: 'Category Management',
  task_management: 'Task Management',
  attendance_management: 'Attendance Management',
  salary_advances: 'Salary Advances',
  salary_report: 'Salary Report',
  sales_reports: 'Sales Reports (All)',
  company_profile: 'Company Profile',
  ai_sales_assistant: 'AI Sales Assistant',
  backup_data: 'Backup Data',
} as const;

export type PermissionModule = keyof typeof PERMISSION_MODULES;

export interface UserProfile extends DocumentData {
  userId: string; // Add userId to the profile
  status: 'approved' | 'pending_approval' | 'rejected';
  fullName: string;
  role?: 'admin' | 'user';
  dateOfBirth?: string; // ISO string
  monthlySalary?: number;
  franchiseId?: string;
  franchiseName?: string;
  modulePermissions?: PermissionModule[];
}
