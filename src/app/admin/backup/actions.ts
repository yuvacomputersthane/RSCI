
'use server';

import { getServices, type GetServicesResult } from '@/app/admin/services/actions';
import { getProducts, type GetProductsResult } from '@/app/admin/products/actions';
import { getFirebaseUsers, type GetUsersResult } from '@/app/admin/users/actions';
import { getTasks, type GetTasksResult } from '@/app/admin/tasks/actions';
import { getInvoices, type GetInvoicesResult } from '@/app/admin/invoices/actions';
import { getAttendanceRecordsFromServer, type GetAttendanceResult } from '@/app/admin/attendance/actions';
import { getCategories, type GetCategoriesResult } from '@/app/admin/categories/actions';
import { getCompanyProfile, type GetCompanyProfileResult } from '@/app/admin/company-profile/actions';
import { getCustomers, type GetCustomersResult } from '@/app/admin/customers/actions';
import { getSalaryAdvances, type GetAdvancesResult } from '@/app/admin/salary-advances/actions';

export interface FirestoreBackupData {
  services: GetServicesResult;
  products: GetProductsResult;
  users: GetUsersResult;
  tasks: GetTasksResult;
  invoices: GetInvoicesResult;
  attendance: GetAttendanceResult;
  categories: GetCategoriesResult;
  companyProfile: GetCompanyProfileResult;
  customers: GetCustomersResult;
  salaryAdvances: GetAdvancesResult;
}

export interface BackupActionResult {
  success: boolean;
  message?: string;
  data?: FirestoreBackupData;
}

export async function getFirestoreBackupData(): Promise<BackupActionResult> {
  try {
    const [servicesResult, productsResult, usersResult, tasksResult, invoicesResult, attendanceResult, categoriesResult, companyProfileResult, customersResult, salaryAdvancesResult] = await Promise.all([
      getServices(),
      getProducts(),
      getFirebaseUsers(),
      getTasks(),
      getInvoices(),
      getAttendanceRecordsFromServer(),
      getCategories(),
      getCompanyProfile(),
      getCustomers(),
      getSalaryAdvances()
    ]);

    const backupData: FirestoreBackupData = {
      services: servicesResult,
      products: productsResult,
      users: usersResult,
      tasks: tasksResult,
      invoices: invoicesResult,
      attendance: attendanceResult,
      categories: categoriesResult,
      companyProfile: companyProfileResult,
      customers: customersResult,
      salaryAdvances: salaryAdvancesResult,
    };
    
    const errors = [servicesResult, productsResult, usersResult, tasksResult, invoicesResult, attendanceResult, categoriesResult, companyProfileResult, customersResult, salaryAdvancesResult].filter(r => !r.success).map(r => r.message);
    if (errors.length > 0) {
        console.warn("Partial backup failure. Errors:", errors);
        return {
            success: true, // partial success
            message: `Backup partially generated. The following errors occurred: ${errors.join('; ')}`,
            data: backupData
        };
    }

    return {
      success: true,
      data: backupData,
    };

  } catch (error: any) {
    console.error('Error generating Firestore backup data:', error);
    return {
      success: false,
      message: `Failed to generate backup: ${error.message || 'Unknown server error'}`,
    };
  }
}
