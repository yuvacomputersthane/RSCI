
"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption, TableFooter } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import LoadingSpinner from '@/components/LoadingSpinner';
import { getInvoices } from '@/app/admin/invoices/actions';
import type { Invoice } from '@/types/invoice';
import { AlertTriangle, TrendingUp, Printer, ArrowDownUp } from 'lucide-react';

interface UserSaleData {
  uid: string;
  name: string;
  totalAmount: number;
  invoiceCount: number;
}

type SortKey = "name" | "totalAmount" | "invoiceCount";
type SortDirection = "asc" | "desc";

export default function UserSalesReportPage() {
  const [allInvoices, setAllInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection }>({ key: 'totalAmount', direction: 'desc' });
  const router = useRouter();

  const fetchInvoices = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await getInvoices();
      if (result.success && result.invoices) {
        setAllInvoices(result.invoices);
      } else {
        throw new Error(result.message || "Failed to load invoice data.");
      }
    } catch (e: any) {
      setError("Failed to load invoice data: " + e.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  const userSalesData = useMemo(() => {
    if (isLoading || !allInvoices.length) return [];

    const userAggregates = new Map<string, UserSaleData>();

    allInvoices.forEach(invoice => {
      // Ensure invoice has a createdByUid to be included in this report
      if (invoice.createdByUid) {
        const existing = userAggregates.get(invoice.createdByUid);
        if (existing) {
          existing.totalAmount += invoice.amount;
          existing.invoiceCount += 1;
        } else {
          userAggregates.set(invoice.createdByUid, {
            uid: invoice.createdByUid,
            name: invoice.createdByName || "Unknown User",
            totalAmount: invoice.amount,
            invoiceCount: 1,
          });
        }
      }
    });

    const dataArray = Array.from(userAggregates.values());

    dataArray.sort((a, b) => {
      let comparison = 0;
      if (a[sortConfig.key] < b[sortConfig.key]) {
        comparison = -1;
      } else if (a[sortConfig.key] > b[sortConfig.key]) {
        comparison = 1;
      }
      return sortConfig.direction === 'desc' ? comparison * -1 : comparison;
    });
    
    return dataArray;

  }, [allInvoices, isLoading, sortConfig]);

  const requestSort = (key: SortKey) => {
    let direction: SortDirection = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const handlePrint = () => {
    window.print();
  };
  
  const grandTotalAmount = useMemo(() => userSalesData.reduce((sum, item) => sum + item.totalAmount, 0), [userSalesData]);
  const grandTotalCount = useMemo(() => userSalesData.reduce((sum, item) => sum + item.invoiceCount, 0), [userSalesData]);

  const handleUserRowClick = (userData: UserSaleData) => {
    router.push(`/admin/user-sales-report/${userData.uid}?name=${encodeURIComponent(userData.name)}`);
  };

  return (
    <>
      <Card className="shadow-md print:shadow-none print:border-none">
        <CardHeader className="print:hidden">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle className="text-2xl flex items-center">
                <TrendingUp className="mr-2 h-6 w-6 text-primary" /> User-wise Sales Report
              </CardTitle>
              <CardDescription>Analyze sales performance for each user. Click a row for details. Data from Firestore.</CardDescription>
            </div>
            <Button onClick={handlePrint} variant="outline" size="sm">
              <Printer className="mr-2 h-4 w-4" /> Print Report
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <LoadingSpinner size={32} />
              <p className="ml-2 text-muted-foreground">Loading sales data...</p>
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
                  Sales data aggregated by user. Click a row for detailed transactions.
                </TableCaption>
                <TableHeader className="sticky top-0 bg-background z-10 print:static print:bg-transparent">
                  <TableRow>
                    <TableHead 
                      className="w-[300px] cursor-pointer hover:bg-muted/50"
                      onClick={() => requestSort('name')}
                    >
                      User Name <ArrowDownUp className={`inline ml-1 h-3 w-3 ${sortConfig.key === 'name' ? '' : 'opacity-30'}`} />
                    </TableHead>
                    <TableHead 
                      className="text-right cursor-pointer hover:bg-muted/50"
                      onClick={() => requestSort('invoiceCount')}
                    >
                      Invoices Generated <ArrowDownUp className={`inline ml-1 h-3 w-3 ${sortConfig.key === 'invoiceCount' ? '' : 'opacity-30'}`} />
                    </TableHead>
                    <TableHead 
                      className="text-right cursor-pointer hover:bg-muted/50"
                      onClick={() => requestSort('totalAmount')}
                    >
                      Total Collection (₹) <ArrowDownUp className={`inline ml-1 h-3 w-3 ${sortConfig.key === 'totalAmount' ? '' : 'opacity-30'}`} />
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {userSalesData.length > 0 ? (
                    userSalesData.map((user) => (
                      <TableRow 
                        key={user.uid}
                        onClick={() => handleUserRowClick(user)}
                        className="cursor-pointer hover:bg-muted/50"
                      >
                        <TableCell className="font-medium">{user.name}</TableCell>
                        <TableCell className="text-right">{user.invoiceCount}</TableCell>
                        <TableCell className="text-right">₹{user.totalAmount.toFixed(2)}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                        No sales data available for any user.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
                 {userSalesData.length > 0 && (
                   <TableFooter className="print:bg-transparent">
                      <TableRow className="font-semibold bg-muted/50 hover:bg-muted/60 print:bg-transparent">
                          <TableCell>Overall Total</TableCell>
                          <TableCell className="text-right">{grandTotalCount}</TableCell>
                          <TableCell className="text-right">₹{grandTotalAmount.toFixed(2)}</TableCell>
                      </TableRow>
                   </TableFooter>
                )}
              </Table>
            </ScrollArea>
          )}
           {userSalesData.length > 0 && (
               <div className="mt-4 p-4 border rounded-lg bg-secondary/30 print:border-none print:bg-transparent print:p-0 print:mt-2">
                  <p className="text-lg font-semibold text-right print:text-base">
                    Overall Total Collection from All Users: ₹{grandTotalAmount.toFixed(2)} ({grandTotalCount} total invoices)
                  </p>
               </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
