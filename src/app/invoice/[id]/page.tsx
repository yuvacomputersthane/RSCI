
"use client";

import { useEffect, useState } from 'react';
import { getInvoiceById } from '@/app/admin/invoices/actions';
import { getCompanyProfile } from '@/app/admin/company-profile/actions';
import type { Invoice } from '@/types/invoice';
import type { CompanyProfile } from '@/types/company';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { AlertTriangle, Printer, ArrowLeft } from 'lucide-react';
import LoadingSpinner from '@/components/LoadingSpinner';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';


export default function InvoicePage({ params }: { params: { id: string } }) {
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { isAdmin } = useAuth();


  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      setError(null);
      try {
        const [invoiceResult, companyProfileResult] = await Promise.all([
          getInvoiceById(params.id),
          getCompanyProfile()
        ]);

        if (!invoiceResult.success) {
          throw new Error(invoiceResult.message || 'Failed to load invoice.');
        }
        setInvoice(invoiceResult.invoice!);

        if (companyProfileResult.success) {
          setCompanyProfile(companyProfileResult.profile);
        } else {
          // Non-fatal, we can still show the invoice
          console.warn('Could not load company profile:', companyProfileResult.message);
        }

      } catch (e: any) {
        setError(e.message);
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, [params.id]);


  if (isLoading) {
    return (
       <div className="flex items-center justify-center min-h-screen bg-secondary/30">
        <div className="flex items-center gap-3 text-muted-foreground">
          <LoadingSpinner size={32} />
          <p className="text-lg">Loading Invoice...</p>
        </div>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-secondary/30">
        <Card className="w-full max-w-lg text-center shadow-lg">
            <CardHeader><AlertTriangle className="mx-auto h-12 w-12 text-destructive" /></CardHeader>
            <CardContent>
                <h1 className="text-xl font-bold text-destructive">Error Loading Invoice</h1>
                <p className="text-muted-foreground">{error || "The requested invoice could not be found."}</p>
                <Button asChild variant="link" className="mt-4"><Link href="/"><ArrowLeft className="mr-2 h-4 w-4"/>Go Back</Link></Button>
            </CardContent>
        </Card>
      </div>
    );
  }
  
  const subtotal = invoice.selectedServices.reduce((sum, item) => sum + item.price, 0);
  const backLink = isAdmin ? "/admin/credit" : "/credit";

  return (
    <div className="bg-secondary/30 min-h-screen p-4 sm:p-8 flex items-start justify-center print:bg-white print:p-0">
      <div className="w-full max-w-4xl space-y-4">
        <div className="flex justify-center gap-4 print:hidden">
            <Button onClick={() => window.print()}>
              <Printer className="mr-2 h-4 w-4" /> Print Invoice
            </Button>
            <Button asChild variant="outline"><Link href={backLink}>Back to Credit Page</Link></Button>
        </div>
        <Card className="shadow-lg print:shadow-none print:border-none print:rounded-none">
            <CardHeader className="p-6 sm:p-8">
                <div className="flex justify-between items-start flex-wrap gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-primary">{companyProfile?.companyName || 'Rising Sun Computers'}</h1>
                        <p className="text-sm text-muted-foreground">{companyProfile?.address}</p>
                        <p className="text-sm text-muted-foreground">{companyProfile?.city}{companyProfile?.city && companyProfile?.state ? ', ' : ''}{companyProfile?.state} {companyProfile?.zipCode}</p>
                    </div>
                    <div className="text-left sm:text-right">
                        <h2 className="text-3xl font-bold tracking-tight">INVOICE</h2>
                        <p className="text-muted-foreground"># {invoice.id}</p>
                    </div>
                </div>
                 <div className="mt-2 flex justify-between items-start flex-wrap gap-4 text-sm">
                     <div>
                        {companyProfile?.email && <p className="text-muted-foreground">Email: {companyProfile.email}</p>}
                        {companyProfile?.phone && <p className="text-muted-foreground">Phone: {companyProfile.phone}</p>}
                     </div>
                     <div className="text-left sm:text-right">
                        {companyProfile?.taxId && <p className="text-muted-foreground">Tax ID/GST: {companyProfile.taxId}</p>}
                     </div>
                 </div>
            </CardHeader>
            <Separator />
            <CardContent className="p-6 sm:p-8">
                <div className="flex justify-between items-start flex-wrap gap-4 mb-8">
                    <div>
                        <h3 className="font-semibold mb-1">Bill To</h3>
                        <p>{invoice.customerName || 'Walk-in Customer'}</p>
                        <p className="text-muted-foreground">{invoice.customerEmail}</p>
                        <p className="text-muted-foreground">{invoice.customerNumber}</p>
                    </div>
                    <div className="text-left sm:text-right">
                        <div className="flex items-center gap-2 justify-end">
                            <span className="font-semibold text-muted-foreground">Status:</span>
                            <Badge variant={invoice.paymentStatus === 'Credit' ? 'destructive' : 'default'}>
                                {invoice.paymentStatus}
                            </Badge>
                        </div>
                        <p><span className="font-semibold text-muted-foreground">Invoice Date:</span> {new Date(invoice.date).toLocaleDateString()}</p>
                        <p><span className="font-semibold text-muted-foreground">Issued By:</span> {invoice.createdByName}</p>
                    </div>
                </div>

                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[60%]">Description</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {invoice.selectedServices.map((item, index) => (
                            <TableRow key={`${item.id}-${index}`}>
                                <TableCell className="font-medium">{item.name}</TableCell>
                                <TableCell className="text-right">₹{item.price.toFixed(2)}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                    <TableFooter>
                        <TableRow className="font-semibold">
                            <TableCell>Subtotal</TableCell>
                            <TableCell className="text-right">₹{subtotal.toFixed(2)}</TableCell>
                        </TableRow>
                        <TableRow className="font-extrabold text-lg bg-muted/50">
                            <TableCell>Total</TableCell>
                            <TableCell className="text-right">₹{invoice.amount.toFixed(2)}</TableCell>
                        </TableRow>
                    </TableFooter>
                </Table>

                {invoice.paymentStatus === 'Credit' && (
                    <div className="mt-8 p-4 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 rounded-lg border border-amber-200 dark:border-amber-900 text-center">
                        <p className="font-bold">This is a credit invoice. Payment is due at a later date.</p>
                    </div>
                )}
            </CardContent>
            <CardFooter className="p-6 sm:p-8 flex flex-col items-center gap-4 border-t">
                 <p className="text-xs text-muted-foreground text-center">Thank you for your business!</p>
            </CardFooter>
        </Card>
      </div>
    </div>
  );
}
