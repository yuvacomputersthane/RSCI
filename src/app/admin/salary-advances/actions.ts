
'use server';

import { z } from 'zod';
import { db, adminSDKInitializationError } from '@/lib/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';

// --- TYPES AND SCHEMAS ---

export interface SalaryAdvance {
    id: string;
    userId: string;
    userName: string;
    amount: number;
    date: string; // ISO String
    notes?: string;
    recordedByUid: string;
    recordedByName: string;
}

const addAdvanceSchema = z.object({
  userId: z.string().min(1),
  userName: z.string().min(1),
  amount: z.number().positive(),
  notes: z.string().optional(),
  recordedByUid: z.string().min(1),
  recordedByName: z.string().min(1),
});

export interface AddAdvanceResult {
  success: boolean;
  message: string;
  advance?: SalaryAdvance;
}

export interface GetAdvancesResult {
  success: boolean;
  advances?: SalaryAdvance[];
  message?: string;
}

export interface AdvanceActionResult {
  success: boolean;
  message: string;
}

// --- ACTIONS ---

export async function addSalaryAdvance(data: z.infer<typeof addAdvanceSchema>): Promise<AddAdvanceResult> {
  if (adminSDKInitializationError) return { success: false, message: adminSDKInitializationError };

  const validation = addAdvanceSchema.safeParse(data);
  if (!validation.success) {
    const firstError = Object.values(validation.error.flatten().fieldErrors)[0]?.[0];
    return { success: false, message: firstError || 'Invalid data provided.' };
  }

  try {
    const now = Timestamp.now();
    const advanceRef = await db.collection('salary_advances').add({
        ...validation.data,
        date: now,
    });

    const newAdvance: SalaryAdvance = {
      id: advanceRef.id,
      ...validation.data,
      date: now.toDate().toISOString(),
    };

    return { success: true, message: "Salary advance recorded.", advance: newAdvance };
  } catch (error: any) {
    return { success: false, message: `Failed to record advance: ${error.message}` };
  }
}

export async function getSalaryAdvances(userId?: string): Promise<GetAdvancesResult> {
  if (adminSDKInitializationError) return { success: false, message: adminSDKInitializationError };
  
  try {
    let query: FirebaseFirestore.Query = db.collection('salary_advances');
    if (userId) {
        query = query.where('userId', '==', userId);
    }
    
    const snapshot = await query.orderBy('date', 'desc').get();
    
    const advances: SalaryAdvance[] = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        userId: data.userId,
        userName: data.userName,
        amount: data.amount,
        date: (data.date as Timestamp).toDate().toISOString(),
        notes: data.notes,
        recordedByUid: data.recordedByUid,
        recordedByName: data.recordedByName,
      }
    });
    
    return { success: true, advances };

  } catch (error: any) {
    if (error.code === 9) { // FAILED_PRECONDITION for missing index
      return { 
        success: false, 
        message: "Firestore index for 'salary_advances' is missing. Please check the server logs for a link to create it. It needs a descending index on 'date'." 
      };
    }
    return { success: false, message: `Failed to get salary advances: ${error.message}` };
  }
}

export async function deleteSalaryAdvance(advanceId: string): Promise<AdvanceActionResult> {
  if (adminSDKInitializationError) return { success: false, message: adminSDKInitializationError };

  try {
    await db.collection('salary_advances').doc(advanceId).delete();
    return { success: true, message: "Salary advance record deleted." };
  } catch (error: any) {
    return { success: false, message: `Failed to delete record: ${error.message}` };
  }
}
