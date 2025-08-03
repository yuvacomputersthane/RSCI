
"use client";

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import AppHeader from '@/components/AppHeader';
import CreditBillingForm, { type TransformedBillingData } from '@/components/CreditBillingForm';
import { useToast } from '@/hooks/use-toast';
import { addInvoice } from '@/app/admin/invoices/actions';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function CreditBillingPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const [formKey, setFormKey] = useState(0);

  const { user } = useAuth();
  const router = useRouter();

  const handleSaveInvoice = useCallback(async (data: TransformedBillingData) => {
    setIsSubmitting(true);

    if (!user) {
      toast({
        title: "Authentication Error",
        description: "You must be logged in to create an invoice.",
        variant: "destructive",
      });
      setIsSubmitting(false);
      return;
    }

    const invoiceDataForAction = {
      ...data,
      createdByUid: user.uid,
      createdByName: user.displayName || user.email || "Unknown User",
    };

    try {
      const result = await addInvoice(invoiceDataForAction);
      if (result.success && result.invoice) {
        toast({
          title: "Credit Invoice Saved!",
          description: `Invoice ${result.invoice.id} has been saved to Firestore.`,
          action: (
             <Button variant="outline" size="sm" asChild>
                <Link href="/credit">View Credit History</Link>
            </Button>
          ),
        });
        setFormKey(prevKey => prevKey + 1); // Reset the form
        window.dispatchEvent(new CustomEvent('invoiceUpdated'));
        router.push('/credit');
      } else {
        throw new Error(result.message || "An unknown error occurred while saving the invoice.");
      }
    } catch (error: any) {
      console.error("Failed to save invoice:", error);
      toast({
        title: "Error Saving Invoice",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [user, toast, router]);

  return (
    <div className="flex flex-col min-h-screen bg-secondary/50">
      <AppHeader />
      <main className="flex-grow container mx-auto p-4 md:p-6 lg:p-8">
        <div className="mb-4">
            <Button asChild variant="outline">
                <Link href="/credit">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Credit Invoices
                </Link>
            </Button>
        </div>
        <CreditBillingForm
            key={formKey} 
            onSubmit={handleSaveInvoice}
            isSubmitting={isSubmitting}
        />
      </main>
      <footer className="py-6 text-center text-sm text-muted-foreground border-t">
        © {new Date().getFullYear()} Rising Sun Computers. All rights reserved.
      </footer>
    </div>
  );
}
