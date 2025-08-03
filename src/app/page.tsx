
"use client";

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import AppHeader from '@/components/AppHeader';
import BillingForm, { type TransformedBillingData } from '@/components/BillingForm';
import InvoiceHistory from '@/components/InvoiceHistory';
import UserAttendance from '@/components/UserAttendance';
import UserTodoList from '@/components/UserTodoList'; // Import the new component
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { addInvoice } from '@/app/admin/invoices/actions';
import { useAuth } from '@/contexts/AuthContext';
import type { UserProfile } from '@/types/user';
import { useRouter } from 'next/navigation';
import LoadingSpinner from '@/components/LoadingSpinner';
import { Hourglass, AlertOctagon, UserCheck, FileText, LogOut } from 'lucide-react';

// Component to show when account status is not 'approved'
const AccountStatusView = ({ status }: { status: UserProfile['status'] }) => {
  const { signOut } = useAuth();
  const messages = {
    pending_approval: {
      Icon: Hourglass,
      title: "Account Pending Approval",
      description: "Your account registration has been submitted and is currently awaiting review by an administrator. You will be able to access the billing system once your account is approved.",
      color: "text-amber-600",
    },
    rejected: {
      Icon: AlertOctagon,
      title: "Account Rejected",
      description: "Unfortunately, your registration was not approved. If you believe this is an error, please contact the system administrator.",
      color: "text-destructive",
    }
  };
  const currentStatus = messages[status] || messages.pending_approval;

  return (
     <div className="flex flex-col min-h-screen bg-secondary/50">
      <AppHeader />
      <main className="flex-grow flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center shadow-lg">
          <CardHeader>
            <currentStatus.Icon className={`mx-auto h-12 w-12 ${currentStatus.color}`} />
            <CardTitle className={`pt-4 ${currentStatus.color}`}>{currentStatus.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">{currentStatus.description}</p>
            <Button onClick={signOut} className="mt-6 w-full">
              <LogOut className="mr-2 h-4 w-4" /> Log Out
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

// Component to show when user has auth but no profile document
const CompleteProfileReminder = () => {
    const { signOut } = useAuth();
    return (
     <div className="flex flex-col min-h-screen bg-secondary/50">
      <AppHeader />
      <main className="flex-grow flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center shadow-lg">
          <CardHeader>
            <FileText className="mx-auto h-12 w-12 text-primary" />
            <CardTitle className="pt-4">Profile Incomplete</CardTitle>
            <CardDescription>
                Your account exists, but your profile details are missing.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">Please complete your registration to continue.</p>
            <Button asChild className="w-full">
                <Link href="/complete-profile">
                    <UserCheck className="mr-2 h-4 w-4" /> Complete Profile
                </Link>
            </Button>
            <Button onClick={signOut} variant="outline" className="w-full">
               <LogOut className="mr-2 h-4 w-4" /> Log Out
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};


export default function HomePage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("create-invoice");
  const [mounted, setMounted] = useState(false);
  const [formKey, setFormKey] = useState(0);

  const { user, userProfile, loading: authLoading, isAdmin } = useAuth();
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && !authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router, mounted]);

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
          title: "Invoice Saved!",
          description: `Invoice ${result.invoice.id} has been saved to Firestore.`,
          action: (
            <Button variant="outline" size="sm" onClick={() => setActiveTab("invoice-history")}>
              View History
            </Button>
          ),
        });
        setFormKey(prevKey => prevKey + 1); // Reset the form
        // Dispatch custom event to notify other components to refetch invoices
        window.dispatchEvent(new CustomEvent('invoiceUpdated'));
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
  }, [user, toast]);

  if (!mounted || authLoading) {
    return (
      <div className="flex flex-col min-h-screen items-center justify-center bg-background">
        <LoadingSpinner size={48} />
        <p className="mt-4 text-lg text-foreground">Loading Rising Sun Computers...</p>
      </div>
    );
  }

  // Handle various user states after loading is complete
  if (user) {
    if (userProfile && userProfile.status !== 'approved' && !isAdmin) {
      return <AccountStatusView status={userProfile.status} />;
    }
    if (!userProfile && !isAdmin) {
       return <CompleteProfileReminder />;
    }
  } else {
    // This case is handled by the useEffect redirect, but this is a safeguard.
    return (
       <div className="flex flex-col min-h-screen items-center justify-center bg-background">
        <LoadingSpinner size={48} />
        <p className="mt-4 text-lg text-foreground">Redirecting to login...</p>
      </div>
    );
  }
  
  // If we reach here, user is authenticated and approved (or master user)
  return (
    <div className="flex flex-col min-h-screen bg-secondary/50">
      <AppHeader />
      <main className="flex-grow container mx-auto p-4 md:p-6 lg:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">
          <div className="lg:col-span-3">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-1 sm:grid-cols-2 mb-6 shadow-sm">
                <TabsTrigger value="create-invoice">Create Invoice</TabsTrigger>
                <TabsTrigger value="invoice-history">Invoice History</TabsTrigger>
              </TabsList>

              <TabsContent value="create-invoice">
                <BillingForm
                  key={formKey} 
                  onSubmit={handleSaveInvoice}
                  isSubmitting={isSubmitting}
                />
              </TabsContent>

              <TabsContent value="invoice-history">
                <InvoiceHistory />
              </TabsContent>
            </Tabs>
          </div>
          <div className="lg:col-span-1 space-y-8 lg:mt-[52px]">
            <UserAttendance />
            <UserTodoList />
          </div>
        </div>
      </main>
      <footer className="py-6 text-center text-sm text-muted-foreground border-t">
        © {new Date().getFullYear()} Rising Sun Computers. All rights reserved.
      </footer>
    </div>
  );
}
