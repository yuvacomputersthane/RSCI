
"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import AppHeader from '@/components/AppHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption, TableFooter } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import LoadingSpinner from '@/components/LoadingSpinner';
import { getInvoices } from '@/app/admin/invoices/actions';
import { getCustomers } from '@/app/admin/customers/actions';
import type { Invoice } from '@/types/invoice';
import type { Customer } from '@/types/customer';
import { AlertTriangle, BookUser, Printer, PlusCircle, FilePlus, Users, PackageSearch } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import AddCustomerDialog from '@/components/admin/AddCustomerDialog';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';


export default function CreditPage() {
  const [allInvoices, setAllInvoices] = useState<Invoice[]>([]);
  const [allCustomers, setAllCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user, isAdmin, loading: authLoading } = useAuth();
  const [isAddCustomerDialogOpen, setIsAddCustomerDialogOpen] = useState(false);
  const router = useRouter();
  const { toast } = useToast();
  
  const invoicesReportRef = useRef<HTMLDivElement>(null);
  const customersReportRef = useRef<HTMLDivElement>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [invoicesResult, customersResult] = await Promise.all([
        getInvoices(),
        getCustomers()
      ]);

      if (invoicesResult.success && invoicesResult.invoices) {
        setAllInvoices(invoicesResult.invoices);
      } else {
        throw new Error(invoicesResult.message || "Failed to load invoice data.");
      }

       if (customersResult.success && customersResult.customers) {
        setAllCustomers(customersResult.customers);
      } else {
        throw new Error(customersResult.message || "Failed to load customer data.");
      }

    } catch (e: any) {
      setError("Failed to load page data: " + e.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading) {
        fetchData();
    }
  }, [fetchData, authLoading]);

  const creditInvoices = useMemo(() => {
    if (!user) return [];
    const filtered = allInvoices.filter(invoice => 
        invoice.paymentStatus === 'Credit' && (isAdmin || invoice.createdByUid === user.uid)
    );
    return filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [allInvoices, user, isAdmin]);

  const totalCreditAmount = useMemo(() => {
    return creditInvoices.reduce((sum, invoice) => sum + invoice.amount, 0);
  }, [creditInvoices]);
  
  const customerCreditTotals = useMemo(() => {
    const totals = new Map<string, number>();
    creditInvoices.forEach(invoice => {
        const customerId = invoice.customerId || invoice.customerName; // Fallback to name if ID is missing
        const currentTotal = totals.get(customerId) || 0;
        totals.set(customerId, currentTotal + invoice.amount);
    });
    return totals;
  }, [creditInvoices]);

  const handlePrint = (reportRef: React.RefObject<HTMLDivElement>) => {
    if (!reportRef.current) return;

    const printContents = reportRef.current.innerHTML;
    const originalContents = document.body.innerHTML;
    document.body.innerHTML = printContents;
    window.print();
    document.body.innerHTML = originalContents;
    // We need to re-attach event listeners after replacing body content. A simple reload does this.
    // In a more complex SPA, you'd re-initialize your app state.
    window.location.reload();
  };

  const handleCustomerAdded = (newCustomer: Customer) => {
    toast({ title: "Customer Added", description: `${newCustomer.fullName} can now be selected in the billing form.`});
    fetchData(); // Re-fetch all data to update lists
  };

  return (
    <>
      <div className="flex flex-col min-h-screen bg-secondary/50 print:bg-white">
          <AppHeader />
          <main className="flex-grow container mx-auto p-4 md:p-6 lg:p-8">
            <Card className="shadow-md print:shadow-none print:border-none">
              <CardHeader className="print:hidden">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <CardTitle className="text-2xl flex items-center">
                      <BookUser className="mr-3 h-6 w-6 text-primary" /> Customer Credit Invoice & Customers
                    </CardTitle>
                    <CardDescription>
                      Manage your credit invoices and view your customer list.
                    </CardDescription>
                  </div>
                  <div className="flex w-full sm:w-auto items-center gap-2 flex-wrap justify-end">
                    <Button variant="outline" size="sm" onClick={() => setIsAddCustomerDialogOpen(true)}>
                      <PlusCircle className="mr-2 h-4 w-4" /> Add Customer
                    </Button>
                    <Button size="sm" onClick={() => router.push('/credit/bill')}>
                      <FilePlus className="mr-2 h-4 w-4" /> New Credit Invoice
                    </Button>
                     <Button size="sm" variant="default" onClick={() => router.push('/')}>
                      <FilePlus className="mr-2 h-4 w-4" /> New Invoice
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="invoices" className="w-full">
                    <TabsList className="grid w-full grid-cols-2 print:hidden">
                        <TabsTrigger value="invoices">Credit Invoices</TabsTrigger>
                        <TabsTrigger value="customers">Customer Balances</TabsTrigger>
                    </TabsList>
                    <TabsContent value="invoices" className="mt-4">
                        <div className="flex justify-end mb-4 print:hidden">
                             <Button onClick={() => handlePrint(invoicesReportRef)} variant="outline" size="sm">
                                <Printer className="mr-2 h-4 w-4" /> Print Invoices List
                            </Button>
                        </div>
                        <div ref={invoicesReportRef}>
                          {isLoading ? (
                          <div className="flex items-center justify-center py-8">
                              <LoadingSpinner size={32} />
                              <p className="ml-2 text-muted-foreground">Loading credit data...</p>
                          </div>
                          ) : error ? (
                          <div className="p-4 my-4 text-sm text-destructive-foreground bg-destructive rounded-md flex items-center">
                              <AlertTriangle className="h-5 w-5 mr-2" />
                              {error}
                          </div>
                          ) : (
                          <ScrollArea className="h-[60vh] rounded-md border print:h-auto print:overflow-visible print:border-none">
                              <Table>
                              <TableCaption className="print:text-xs print:mt-2">
                                  A list of all your credit transactions.
                              </TableCaption>
                              <TableHeader className="sticky top-0 bg-background z-10 print:static print:bg-transparent">
                                  <TableRow>
                                  <TableHead>Invoice ID</TableHead>
                                  <TableHead>Date</TableHead>
                                  <TableHead>Customer</TableHead>
                                  <TableHead className="text-right">Amount (₹)</TableHead>
                                  </TableRow>
                              </TableHeader>
                              <TableBody>
                                  {creditInvoices.length > 0 ? (
                                  creditInvoices.map((invoice) => (
                                      <TableRow key={invoice.id}>
                                      <TableCell className="font-mono">
                                          <Button variant="link" asChild className="p-0 h-auto font-normal">
                                          <Link href={`/invoice/${invoice.id}`} title="View & Print Invoice" target="_blank">
                                              {invoice.id}
                                          </Link>
                                          </Button>
                                      </TableCell>
                                      <TableCell>{format(new Date(invoice.date), "PPP")}</TableCell>
                                      <TableCell>{invoice.customerName}</TableCell>
                                      <TableCell className="text-right">₹{invoice.amount.toFixed(2)}</TableCell>
                                      </TableRow>
                                  ))
                                  ) : (
                                  <TableRow>
                                      <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                                      You have no credit invoices.
                                      </TableCell>
                                  </TableRow>
                                  )}
                              </TableBody>
                              {creditInvoices.length > 0 && (
                                  <TableFooter className="print:bg-transparent">
                                  <TableRow className="font-semibold bg-muted/50 hover:bg-muted/60 print:bg-transparent text-base">
                                      <TableCell colSpan={3}>Your Total Outstanding Credit</TableCell>
                                      <TableCell className="text-right">₹{totalCreditAmount.toFixed(2)}</TableCell>
                                  </TableRow>
                                  </TableFooter>
                              )}
                              </Table>
                          </ScrollArea>
                          )}
                        </div>
                    </TabsContent>
                    <TabsContent value="customers" className="mt-4">
                        <div className="flex justify-end mb-4 print:hidden">
                             <Button onClick={() => handlePrint(customersReportRef)} variant="outline" size="sm">
                                <Printer className="mr-2 h-4 w-4" /> Print Customer Report
                            </Button>
                        </div>
                        <div ref={customersReportRef}>
                          {isLoading ? (
                          <div className="flex items-center justify-center py-8">
                              <LoadingSpinner size={32} />
                              <p className="ml-2 text-muted-foreground">Loading customers...</p>
                          </div>
                          ) : error ? (
                          <div className="p-4 my-4 text-sm text-destructive-foreground bg-destructive rounded-md flex items-center">
                              <AlertTriangle className="h-5 w-5 mr-2" />
                              {error}
                          </div>
                          ) : (
                              <ScrollArea className="h-[60vh] rounded-md border print:h-auto print:overflow-visible print:border-none">
                                  <Table>
                                      <TableCaption>A list of all customers and their outstanding credit balances.</TableCaption>
                                      <TableHeader className="print:bg-transparent sticky top-0 bg-background z-10">
                                          <TableRow>
                                              <TableHead>Full Name</TableHead>
                                              <TableHead>Contact</TableHead>
                                              <TableHead className="text-right">Outstanding Credit (₹)</TableHead>
                                          </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                          {allCustomers.length > 0 ? (
                                              allCustomers.map((customer) => (
                                                  <TableRow key={customer.id}>
                                                      <TableCell className="font-medium">{customer.fullName}</TableCell>
                                                      <TableCell>
                                                          <div className="text-sm">{customer.phone}</div>
                                                          <div className="text-xs text-muted-foreground">{customer.email}</div>
                                                      </TableCell>
                                                      <TableCell className="text-right font-semibold">
                                                        ₹{(customerCreditTotals.get(customer.id) || 0).toFixed(2)}
                                                      </TableCell>
                                                  </TableRow>
                                              ))
                                          ) : (
                                              <TableRow>
                                                  <TableCell colSpan={3} className="h-24 text-center">
                                                      <div className="mt-6 border border-dashed rounded-lg p-8 text-center">
                                                          <PackageSearch className="mx-auto h-12 w-12 text-muted-foreground" />
                                                          <p className="mt-4 text-sm text-muted-foreground">No customers found.</p>
                                                          <p className="text-xs text-muted-foreground">
                                                              Click "Add Customer" to create your first one.
                                                          </p>
                                                      </div>
                                                  </TableCell>
                                              </TableRow>
                                          )}
                                      </TableBody>
                                      {allCustomers.length > 0 && customerCreditTotals.size > 0 && (
                                          <TableFooter className="print:bg-transparent">
                                              <TableRow className="font-bold bg-muted/50 text-base">
                                                  <TableCell colSpan={2}>Grand Total Outstanding</TableCell>
                                                  <TableCell className="text-right">₹{totalCreditAmount.toFixed(2)}</TableCell>
                                              </TableRow>
                                          </TableFooter>
                                      )}
                                  </Table>
                              </ScrollArea>
                          )}
                        </div>
                    </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </main>
        </div>
        <AddCustomerDialog
          isOpen={isAddCustomerDialogOpen}
          setIsOpen={setIsAddCustomerDialogOpen}
          onCustomerAdded={handleCustomerAdded}
        />
    </>
  );
}
