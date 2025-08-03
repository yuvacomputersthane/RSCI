
"use client";

import { useEffect, useState, useMemo, useCallback } from 'react';
import { getInvoices } from '@/app/admin/invoices/actions';
import type { Invoice } from '@/types/invoice';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Archive, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { isToday, parseISO } from 'date-fns';
import { Separator } from './ui/separator';
import LoadingSpinner from './LoadingSpinner';
import Link from 'next/link';

export default function InvoiceHistory() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  
  const fetchInvoices = useCallback(async () => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await getInvoices();
        if (result.success && result.invoices) {
            setInvoices(result.invoices);
        } else {
            setError(result.message || "Failed to load invoices.");
        }
      } catch (e: any) {
        setError(e.message);
      } finally {
        setIsLoading(false);
      }
  }, []);

  useEffect(() => {
    fetchInvoices();
    // Listen for custom event to refetch when a new invoice is added
    window.addEventListener('invoiceUpdated', fetchInvoices);
    return () => {
      window.removeEventListener('invoiceUpdated', fetchInvoices);
    };
  }, [fetchInvoices]);

  const filteredInvoices = useMemo(() => {
    if (!user) return [];
    // Only show invoices created by the currently logged-in user.
    return invoices.filter(invoice => invoice.createdByUid === user.uid);
  }, [invoices, user]);

  const todaysTotal = useMemo(() => {
    if (!user) return 0;
    // Use the already filtered invoices for performance
    return filteredInvoices
      .filter(invoice => isToday(parseISO(invoice.date)))
      .reduce((sum, invoice) => sum + invoice.amount, 0);
  }, [filteredInvoices, user]);

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="text-2xl">Invoice History</CardTitle>
        <CardDescription>
          Viewing your previously generated invoices from Firestore.
        </CardDescription>
         <div className="pt-4">
            <p className="text-sm font-medium text-muted-foreground">Your Total Sales Today</p>
            <p className="text-3xl font-bold">₹{todaysTotal.toFixed(2)}</p>
        </div>
        <Separator className="mt-4" />
      </CardHeader>
      <CardContent>
        {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <LoadingSpinner size={32} />
              <p className="ml-2 text-muted-foreground">Loading invoices...</p>
            </div>
        ) : error ? (
            <div className="p-4 my-4 text-sm text-destructive-foreground bg-destructive rounded-md flex items-center">
              <AlertTriangle className="h-5 w-5 mr-2" />
              {error}
            </div>
        ) : filteredInvoices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Archive className="h-16 w-16 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No invoices found.</p>
            <p className="text-sm text-muted-foreground">Create your first invoice to see it here.</p>
          </div>
        ) : (
          <ScrollArea className="h-[400px] rounded-md border">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  <TableHead className="w-[150px]">Invoice ID</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Customer Name</TableHead>
                  <TableHead>Services Taken</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInvoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-mono">
                       <Button variant="link" asChild className="p-0 h-auto font-normal">
                          <Link href={`/invoice/${invoice.id}`} title="View & Print Invoice" target="_blank">
                              {invoice.id.substring(0, 10)}...
                          </Link>
                      </Button>
                    </TableCell>
                    <TableCell>{new Date(invoice.date).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Badge variant={invoice.paymentStatus === 'Credit' ? 'destructive' : 'default'}>
                        {invoice.paymentStatus}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">₹{invoice.amount.toFixed(2)}</TableCell>
                    <TableCell>{invoice.customerName || 'N/A'}</TableCell>
                    <TableCell>
                      {invoice.selectedServices && invoice.selectedServices.length > 0 ? (
                        <ul className="list-disc list-inside text-xs">
                          {invoice.selectedServices.map((service, index) => (
                            <li key={`${service.id}-${index}`}>{service.name}</li>
                          ))}
                        </ul>
                      ) : (
                        'N/A'
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
