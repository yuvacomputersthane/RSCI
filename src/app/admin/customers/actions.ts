
'use server';

import { z } from 'zod';
import { db, adminSDKInitializationError } from '@/lib/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import type { Customer } from '@/types/customer';

// --- SCHEMAS ---

const customerSchema = z.object({
  fullName: z.string().min(2, { message: "Full name must be at least 2 characters." }),
  email: z.string().email({ message: "Invalid email format." }).optional().or(z.literal('')),
  phone: z.string().min(10, { message: "Phone number must be at least 10 digits." }),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  notes: z.string().optional(),
});

export type CustomerFormData = z.infer<typeof customerSchema>;

// --- RESULT TYPES ---

export interface CustomerActionResult {
  success: boolean;
  message: string;
  customer?: Customer;
}

export interface GetCustomersResult {
  success: boolean;
  customers?: Customer[];
  message?: string;
}

// --- ACTIONS ---

export async function addCustomer(data: CustomerFormData): Promise<CustomerActionResult> {
  if (adminSDKInitializationError) return { success: false, message: adminSDKInitializationError };
  
  const validation = customerSchema.safeParse(data);
  if (!validation.success) {
    const firstError = Object.values(validation.error.flatten().fieldErrors)[0]?.[0];
    return { success: false, message: firstError || 'Invalid data.' };
  }

  try {
    const now = Timestamp.now();
    const docRef = await db.collection('customers').add({
      ...validation.data,
      createdAt: now,
    });
    
    const newCustomer: Customer = { 
      id: docRef.id, 
      ...validation.data,
      phone: validation.data.phone, // Ensure phone is included
      createdAt: now.toDate().toISOString() 
    };

    return { success: true, message: `Customer "${validation.data.fullName}" created successfully.`, customer: newCustomer };
  } catch (error: any) {
    return { success: false, message: `Failed to create customer: ${error.message}` };
  }
}

export async function getCustomers(): Promise<GetCustomersResult> {
  if (adminSDKInitializationError) return { success: false, message: adminSDKInitializationError };

  try {
    const snapshot = await db.collection('customers').orderBy('createdAt', 'desc').get();
    const customers: Customer[] = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
            id: doc.id,
            fullName: data.fullName,
            email: data.email,
            phone: data.phone,
            address: data.address,
            city: data.city,
            state: data.state,
            zipCode: data.zipCode,
            notes: data.notes,
            createdAt: (data.createdAt as Timestamp).toDate().toISOString(),
        } as Customer;
    });
    return { success: true, customers };
  } catch (error: any) {
    if (error.code === 9) {
        return { success: false, message: `Firestore index for 'customers' collection is missing. Please check the server logs for a link to create it.` };
    }
    return { success: false, message: `Failed to get customers: ${error.message}` };
  }
}

export async function updateCustomer(customerId: string, data: CustomerFormData): Promise<CustomerActionResult> {
    if (adminSDKInitializationError) return { success: false, message: adminSDKInitializationError };
    
    const validation = customerSchema.safeParse(data);
    if (!validation.success) {
        const firstError = Object.values(validation.error.flatten().fieldErrors)[0]?.[0];
        return { success: false, message: firstError || 'Invalid data.' };
    }

    try {
        await db.collection('customers').doc(customerId).update(validation.data);
        return { success: true, message: 'Customer updated successfully.' };
    } catch (error: any) {
        return { success: false, message: `Failed to update customer: ${error.message}` };
    }
}

export async function deleteCustomer(customerId: string): Promise<CustomerActionResult> {
  if (adminSDKInitializationError) return { success: false, message: adminSDKInitializationError };

  try {
    await db.collection('customers').doc(customerId).delete();
    return { success: true, message: 'Customer deleted successfully.' };
  } catch (error: any) {
    return { success: false, message: `Failed to delete customer: ${error.message}` };
  }
}
