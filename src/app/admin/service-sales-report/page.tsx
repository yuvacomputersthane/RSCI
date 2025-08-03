
"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption, TableFooter } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import LoadingSpinner from '@/components/LoadingSpinner';
import { getInvoices } from '@/app/admin/invoices/actions';
import type { Invoice } from '@/types/invoice';
import { getServices, type Service } from '@/app/admin/services/actions';
import { AlertTriangle, BarChartHorizontalBig, Printer, ArrowDownUp } from 'lucide-react';

interface ServiceSaleData {
  id: string;
  name: string;
  totalAmount: number;
  count: number;
}

type SortKey = "name" | "totalAmount" | "count";
type SortDirection = "asc" | "desc";

export default function ServiceSalesReportPage() {
  const [allInvoices, setAllInvoices] = useState<Invoice[]>([]);
  const [allServices, setAllServices] = useState<Service[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection }>({ key: 'totalAmount', direction: 'desc' });

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Fetch both from their respective sources in parallel
      const [invoicesResult, servicesResult] = await Promise.all([
        getInvoices(),
        getServices()
      ]);

      if (!invoicesResult.success || !invoicesResult.invoices) {
        throw new Error(invoicesResult.message || 'Failed to load invoices from the database.');
      }
       if (!servicesResult.success || !servicesResult.services) {
        throw new Error(servicesResult.message || 'Failed to load the master list of services from the database.');
      }
      
      setAllInvoices(invoicesResult.invoices);
      setAllServices(servicesResult.services);

    } catch (e: any) {
      setError("Failed to load report data: " + e.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);


  const serviceSalesData = useMemo(() => {
    if (isLoading) return [];

    const serviceAggregates = new Map<string, ServiceSaleData>();

    // First, seed the map with all available services from Firestore.
    // This ensures every service is in the report, even if it has no sales.
    allServices.forEach(service => {
      serviceAggregates.set(service.id, {
        id: service.id,
        name: service.name,
        totalAmount: 0,
        count: 0,
      });
    });

    // Then, process invoices to accumulate sales data.
    allInvoices.forEach(invoice => {
      if (invoice.selectedServices && Array.isArray(invoice.selectedServices)) {
        invoice.selectedServices.forEach(service => {
          const existing = serviceAggregates.get(service.id);
          if (existing) {
            existing.totalAmount += service.price;
            existing.count += 1;
          } else {
            // This handles services in invoices that no longer exist in the master Firestore list.
            serviceAggregates.set(service.id, {
              id: service.id,
              name: `${service.name} (Archived)`,
              totalAmount: service.price,
              count: 1,
            });
          }
        });
      }
    });

    const dataArray = Array.from(serviceAggregates.values());

    // Sort the comprehensive list
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

  }, [allInvoices, allServices, isLoading, sortConfig]);

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
  
  const grandTotalAmount = useMemo(() => serviceSalesData.reduce((sum, item) => sum + item.totalAmount, 0), [serviceSalesData]);
  const grandTotalCount = useMemo(() => serviceSalesData.reduce((sum, item) => sum + item.count, 0), [serviceSalesData]);

  return (
    <Card className="shadow-md print:shadow-none print:border-none">
      <CardHeader className="print:hidden">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <CardTitle className="text-2xl flex items-center">
              <BarChartHorizontalBig className="mr-2 h-6 w-6 text-primary" /> Service-wise Sales Report
            </CardTitle>
            <CardDescription>A complete analysis of sales for every available service, including those with zero sales.</CardDescription>
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
            <p className="ml-2 text-muted-foreground">Loading services and sales data...</p>
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
                A complete list of all services and their sales performance. Click headers to sort.
                {serviceSalesData.length === 0 && " No services found in the database."}
              </TableCaption>
              <TableHeader className="sticky top-0 bg-background z-10 print:static print:bg-transparent">
                <TableRow>
                  <TableHead 
                    className="w-[300px] cursor-pointer hover:bg-muted/50"
                    onClick={() => requestSort('name')}
                  >
                    Service Name <ArrowDownUp className={`inline ml-1 h-3 w-3 ${sortConfig.key === 'name' ? '' : 'opacity-30'}`} />
                  </TableHead>
                  <TableHead 
                    className="text-right cursor-pointer hover:bg-muted/50"
                    onClick={() => requestSort('count')}
                  >
                    Times Sold <ArrowDownUp className={`inline ml-1 h-3 w-3 ${sortConfig.key === 'count' ? '' : 'opacity-30'}`} />
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
                {serviceSalesData.length > 0 ? (
                  serviceSalesData.map((service) => (
                    <TableRow key={service.id} data-testid={`service-row-${service.id}`}>
                      <TableCell className="font-medium">{service.name}</TableCell>
                      <TableCell className="text-right">{service.count}</TableCell>
                      <TableCell className="text-right">₹{service.totalAmount.toFixed(2)}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                      No services are defined in your Firestore database. Please add some in Service Management.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
               {grandTotalCount > 0 && (
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
         {grandTotalCount > 0 && (
             <div className="mt-4 p-4 border rounded-lg bg-secondary/30 print:border-none print:bg-transparent print:p-0 print:mt-2">
                <p className="text-lg font-semibold text-right print:text-base">
                  Overall Total Collection from Services: ₹{grandTotalAmount.toFixed(2)} ({grandTotalCount} services rendered across all invoices)
                </p>
             </div>
        )}
      </CardContent>
    </Card>
  );
}
