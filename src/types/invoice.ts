export interface Invoice {
  id: string;
  customerId?: string;
  customerName: string;
  customerEmail: string;
  customerNumber?: string;
  selectedServices: Array<{ id: string; name: string; price: number }>; // Changed from serviceDescription
  amount: number;
  date: string; // ISO string date
  createdByUid: string;
  createdByName: string;
  paymentStatus: 'Paid' | 'Credit';
}
