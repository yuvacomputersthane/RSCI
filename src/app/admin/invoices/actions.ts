
'use server';

import { z } from 'zod';
import { db, adminSDKInitializationError } from '@/lib/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import type { Invoice } from '@/types/invoice';

// This is the data structure we expect from the client for creating an invoice
const CreateInvoiceSchema = z.object({
  customerId: z.string().optional(),
  customerName: z.string().optional(),
  customerEmail: z.string().email().or(z.literal('')),
  customerNumber: z.string().optional(),
  selectedServices: z.array(z.object({
    id: z.string(),
    name: z.string(),
    price: z.number(),
  })),
  amount: z.number().nonnegative(),
  createdByUid: z.string(),
  createdByName: z.string(),
  paymentStatus: z.enum(['Paid', 'Credit']),
});

export interface AddInvoiceResult {
  success: boolean;
  message: string;
  invoice?: Invoice;
}

export async function addInvoice(data: z.infer<typeof CreateInvoiceSchema>): Promise<AddInvoiceResult> {
  if (adminSDKInitializationError) {
    return { success: false, message: adminSDKInitializationError };
  }

  const validation = CreateInvoiceSchema.safeParse(data);
  if (!validation.success) {
    console.error("Add Invoice Validation Errors:", validation.error.flatten().fieldErrors);
    const firstError = Object.values(validation.error.flatten().fieldErrors)[0]?.[0]
    return { success: false, message: firstError || 'Invalid invoice data provided to server action.' };
  }
  
  const validatedData = validation.data;
  
  // If customer name is empty or just whitespace, default it
  if (!validatedData.customerName || validatedData.customerName.trim() === '') {
      validatedData.customerName = 'Walk-in Customer';
  }


  try {
    const now = Timestamp.now();
    const newInvoiceRef = db.collection('invoices').doc(); // Auto-generate ID

    // We build the object that will be stored in Firestore, using the server-generated timestamp
    const invoiceDataForFirestore = {
      ...validatedData,
      date: now,
    };
    
    // Firestore doesn't like 'undefined' values, so we clean them up.
    if (typeof invoiceDataForFirestore.customerName === 'undefined') {
       invoiceDataForFirestore.customerName = '';
    }
     if (typeof invoiceDataForFirestore.customerEmail === 'undefined') {
       invoiceDataForFirestore.customerEmail = '';
    }
    if (typeof invoiceDataForFirestore.customerNumber === 'undefined') {
      delete invoiceDataForFirestore.customerNumber;
    }
     if (typeof (invoiceDataForFirestore as any).customerId === 'undefined') {
      delete (invoiceDataForFirestore as any).customerId;
    }

    await newInvoiceRef.set(invoiceDataForFirestore);

    // We build the object that is returned to the client, converting timestamp to string
    const newInvoiceForClient: Invoice = {
      id: newInvoiceRef.id,
      ...validatedData,
      date: now.toDate().toISOString(),
    };

    return { success: true, message: 'Invoice saved successfully to Firestore.', invoice: newInvoiceForClient };
  } catch (error: any) {
    console.error('Error adding invoice to Firestore:', error);
    return { success: false, message: `Failed to save invoice to Firestore: ${error.message}` };
  }
}

export interface GetInvoicesResult {
  success: boolean;
  invoices?: Invoice[];
  message?: string;
}

export async function getInvoices(): Promise<GetInvoicesResult> {
  if (adminSDKInitializationError) {
    return { success: false, message: adminSDKInitializationError };
  }
  
  try {
    const invoicesSnapshot = await db.collection('invoices').orderBy('date', 'desc').get();
    
    const invoicesList: Invoice[] = invoicesSnapshot.docs.map(doc => {
      const data = doc.data();
      const dateTimestamp = data.date as Timestamp;
      return {
        // Spread the original data, then explicitly overwrite fields for type safety
        ...data,
        id: doc.id,
        date: dateTimestamp.toDate().toISOString(),
        customerName: data.customerName || '',
        customerEmail: data.customerEmail || '',
        selectedServices: data.selectedServices || [],
        amount: data.amount || 0,
        createdByUid: data.createdByUid,
        createdByName: data.createdByName,
        customerId: data.customerId,
        paymentStatus: data.paymentStatus || 'Paid', // Default old invoices to 'Paid'
      } as Invoice;
    });

    return { success: true, invoices: invoicesList };
  } catch (error: any) {
    console.error('Error fetching invoices from Firestore:', error);
     if (error.code === 9 || (error.message && error.message.includes('FAILED_PRECONDITION'))) {
        return {
            success: false,
            message: `Firestore query failed due to a missing index for the 'invoices' collection. The error logs in your terminal should contain a direct link to create the required index in the Firebase Console. Click the link, create the index, and wait a few minutes for it to build. The query requires a descending index on the 'date' field. Error: ${error.message}`,
        };
    }
    return { success: false, message: `Failed to fetch invoices: ${error.message}` };
  }
}


export interface GetInvoiceResult {
  success: boolean;
  invoice?: Invoice;
  message?: string;
}

export async function getInvoiceById(invoiceId: string): Promise<GetInvoiceResult> {
    if (adminSDKInitializationError) {
        return { success: false, message: adminSDKInitializationError };
    }
    if (!invoiceId) {
        return { success: false, message: "Invoice ID is required." };
    }
    try {
        const invoiceDoc = await db.collection('invoices').doc(invoiceId).get();
        if (!invoiceDoc.exists) {
            return { success: false, message: "Invoice not found." };
        }
        const data = invoiceDoc.data()!;
        const dateTimestamp = data.date as Timestamp;
        const invoice: Invoice = {
            ...data,
            id: invoiceDoc.id,
            date: dateTimestamp.toDate().toISOString(),
            customerName: data.customerName || '',
            customerEmail: data.customerEmail || '',
            selectedServices: data.selectedServices || [],
            amount: data.amount || 0,
            createdByUid: data.createdByUid,
            createdByName: data.createdByName,
            customerId: data.customerId,
            paymentStatus: data.paymentStatus || 'Paid', // Default old invoices to 'Paid'
        } as Invoice;
        return { success: true, invoice };
    } catch (error: any) {
        console.error(`Error fetching invoice ${invoiceId} from Firestore:`, error);
        return { success: false, message: `Failed to fetch invoice: ${error.message}` };
    }
}
