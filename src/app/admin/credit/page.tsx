
"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption, TableFooter } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import LoadingSpinner from '@/components/LoadingSpinner';
import { getInvoices } from '@/app/admin/invoices/actions';
import { getCustomers } from '@/app/admin/customers/actions';
import type { Invoice } from '@/types/invoice';
import type { Customer } from '@/types/customer';
import { AlertTriangle, BookUser, Printer, Search, PlusCircle, FilePlus, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import AddCustomerDialog from '@/components/admin/AddCustomerDialog';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';


export default function AdminCreditPage() {
  const [allInvoices, setAllInvoices] = useState<Invoice[]>([]);
  const [allCustomers, setAllCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddCustomerDialogOpen, setIsAddCustomerDialogOpen] = useState(false);
  const { isAdmin } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

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
      toast({ title: "Error", description: e.message, variant: "destructive"});
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const creditInvoices = useMemo(() => {
    let invoices = allInvoices.filter(invoice => invoice.paymentStatus === 'Credit');
    if (searchTerm) {
        const lowercasedFilter = searchTerm.toLowerCase();
        invoices = invoices.filter(invoice => 
            invoice.customerName.toLowerCase().includes(lowercasedFilter) ||
            invoice.id.toLowerCase().includes(lowercasedFilter)
        );
    }
    return invoices.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [allInvoices, searchTerm]);

  const totalCreditAmount = useMemo(() => {
    return creditInvoices.reduce((sum, invoice) => sum + invoice.amount, 0);
  }, [creditInvoices]);

  const handlePrint = () => {
    window.print();
  };
  
  const handleCustomerAdded = (newCustomer: Customer) => {
    toast({ title: "Customer Added", description: `${newCustomer.fullName} is now in your records.`});
    fetchData();
  };

  return (
    <>
      <Card className="shadow-md print:shadow-none print:border-none">
        <CardHeader className="print:hidden">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle className="text-2xl flex items-center">
                <BookUser className="mr-3 h-6 w-6 text-primary" /> Credit Invoices (Admin)
              </CardTitle>
              <CardDescription>
                Showing all invoices with an outstanding "Credit" balance from all users.
              </CardDescription>
            </div>
            <div className="flex w-full sm:w-auto items-center gap-2 flex-wrap justify-end">
               <div className="relative flex-1 sm:flex-initial">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                      type="search"
                      placeholder="Search by customer or ID..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-8 sm:w-[200px] md:w-[250px] h-9"
                  />
               </div>
              {isAdmin && (
                 <Button variant="outline" size="sm" onClick={() => router.push('/admin/customers')}>
                  <BookUser className="mr-2 h-4 w-4" /> Customer Mgt
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => setIsAddCustomerDialogOpen(true)}>
                <PlusCircle className="mr-2 h-4 w-4" /> Add Customer
              </Button>
               <Button size="sm" onClick={() => router.push('/')}>
                <FilePlus className="mr-2 h-4 w-4" /> New Invoice
              </Button>
              <Button onClick={handlePrint} variant="outline" size="sm">
                <Printer className="mr-2 h-4 w-4" /> Print
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
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
                  A list of all credit transactions.
                </TableCaption>
                <TableHeader className="sticky top-0 bg-background z-10 print:static print:bg-transparent">
                  <TableRow>
                    <TableHead>Invoice ID</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Issued By</TableHead>
                    <TableHead className="text-right">Amount (₹)</TableHead>
                    <TableHead className="text-center">Actions</TableHead>
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
                        <TableCell>{invoice.createdByName}</TableCell>
                        <TableCell className="text-right">₹{invoice.amount.toFixed(2)}</TableCell>
                        <TableCell className="text-center">
                            <Button variant="outline" size="sm" asChild>
                                <Link href={`/invoice/${invoice.id}`} title="View & Print Invoice" target="_blank">
                                    <ExternalLink className="mr-2 h-3 w-3" />
                                    View Invoice
                                </Link>
                            </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        No credit invoices found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
                {creditInvoices.length > 0 && (
                  <TableFooter className="print:bg-transparent">
                    <TableRow className="font-semibold bg-muted/50 hover:bg-muted/60 print:bg-transparent text-base">
                      <TableCell colSpan={4}>Total Outstanding Credit</TableCell>
                      <TableCell className="text-right" colSpan={2}>₹{totalCreditAmount.toFixed(2)}</TableCell>
                    </TableRow>
                  </TableFooter>
                )}
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
      <AddCustomerDialog
        isOpen={isAddCustomerDialogOpen}
        setIsOpen={setIsAddCustomerDialogOpen}
        onCustomerAdded={handleCustomerAdded}
      />
    </>
  );
}
