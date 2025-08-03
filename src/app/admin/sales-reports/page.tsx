
"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePicker } from '@/components/ui/date-picker';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption, TableFooter } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import LoadingSpinner from '@/components/LoadingSpinner';
import { getInvoices } from '@/app/admin/invoices/actions';
import type { Invoice } from '@/types/invoice';
import { AlertTriangle, CalendarDays, BarChart3, Printer } from 'lucide-react';
import {
  startOfToday,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  subMonths,
  format,
  isWithinInterval,
  parseISO,
} from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Badge } from '@/components/ui/badge';


type RangePreset = "today" | "this_week" | "this_month" | "last_3_months" | "last_6_months" | "last_12_months" | "custom";
type StatusFilter = "all" | "paid" | "credit";


interface DailySale {
  date: string; // Formatted date string e.g., "2023-10-26"
  totalAmount: number;
  invoiceCount: number;
}

const chartConfig = {
  sales: {
    label: "Sales",
    color: "hsl(var(--chart-1))",
  },
} satisfies ChartConfig;

export default function SalesReportPage() {
  const [allInvoices, setAllInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedRangeType, setSelectedRangeType] = useState<RangePreset>("this_month");
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>(undefined);
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>(undefined);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

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

  const dateRanges = useMemo(() => {
    const today = startOfToday();
    return {
      today: { start: today, end: today },
      this_week: { start: startOfWeek(today, { weekStartsOn: 1 }), end: endOfWeek(today, { weekStartsOn: 1 }) }, // Mon-Sun
      this_month: { start: startOfMonth(today), end: endOfMonth(today) },
      last_3_months: { start: startOfMonth(subMonths(today, 2)), end: endOfMonth(today) },
      last_6_months: { start: startOfMonth(subMonths(today, 5)), end: endOfMonth(today) },
      last_12_months: { start: startOfMonth(subMonths(today, 11)), end: endOfMonth(today) },
    };
  }, []);

  const filteredReportData = useMemo(() => {
    if (isLoading || !allInvoices.length) return { dailySales: [], periodTotal: 0, periodInvoiceCount: 0 };

    let startDate: Date;
    let endDate: Date;

    if (selectedRangeType === "custom") {
      if (!customStartDate || !customEndDate) return { dailySales: [], periodTotal: 0, periodInvoiceCount: 0 };
      startDate = customStartDate;
      endDate = customEndDate;
    } else {
      startDate = dateRanges[selectedRangeType].start;
      endDate = dateRanges[selectedRangeType].end;
    }
    
    const effectiveEndDate = new Date(endDate);
    effectiveEndDate.setHours(23, 59, 59, 999);


    const invoicesInPeriod = allInvoices.filter(invoice => {
      const invoiceDate = parseISO(invoice.date);
      const isDateMatch = isWithinInterval(invoiceDate, { start: startDate, end: effectiveEndDate });
      if (!isDateMatch) return false;
      if (statusFilter === 'all') return true;
      if (statusFilter === 'paid') return invoice.paymentStatus === 'Paid';
      if (statusFilter === 'credit') return invoice.paymentStatus === 'Credit';
      return false;
    });

    const dailySalesMap = new Map<string, { totalAmount: number; invoiceCount: number }>();
    let periodTotal = 0;
    let periodInvoiceCount = 0;

    invoicesInPeriod.forEach(invoice => {
      const formattedDate = format(parseISO(invoice.date), "yyyy-MM-dd");
      const dayData = dailySalesMap.get(formattedDate) || { totalAmount: 0, invoiceCount: 0 };
      dayData.totalAmount += invoice.amount;
      dayData.invoiceCount += 1;
      dailySalesMap.set(formattedDate, dayData);
      periodTotal += invoice.amount;
      periodInvoiceCount +=1;
    });

    const dailySalesArray: DailySale[] = Array.from(dailySalesMap.entries())
      .map(([date, data]) => ({ ...data, date }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return { dailySales: dailySalesArray, periodTotal, periodInvoiceCount, allInvoicesInPeriod: invoicesInPeriod };

  }, [allInvoices, isLoading, selectedRangeType, customStartDate, customEndDate, dateRanges, statusFilter]);


  const handleRangeChange = (value: string) => {
    setSelectedRangeType(value as RangePreset);
    if (value !== "custom") {
      setCustomStartDate(undefined);
      setCustomEndDate(undefined);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <Card className="shadow-md print:shadow-none print:border-none">
      <CardHeader className="print:hidden">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <CardTitle className="text-2xl flex items-center">
              <BarChart3 className="mr-2 h-6 w-6 text-primary" /> Detailed Sales Report
            </CardTitle>
            <CardDescription>Analyze sales performance based on selected time periods. Data from Firestore.</CardDescription>
          </div>
          <Button onClick={handlePrint} variant="outline" size="sm">
            <Printer className="mr-2 h-4 w-4" /> Print Report
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-col sm:flex-row gap-4 items-center p-4 border rounded-lg bg-muted/30 print:hidden">
          <div className="flex-1 w-full sm:w-auto">
            <label htmlFor="range-select" className="block text-sm font-medium mb-1">Time Range</label>
            <Select value={selectedRangeType} onValueChange={handleRangeChange}>
              <SelectTrigger id="range-select" className="w-full">
                <SelectValue placeholder="Select range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="this_week">This Week</SelectItem>
                <SelectItem value="this_month">This Month</SelectItem>
                <SelectItem value="last_3_months">Last 3 Months</SelectItem>
                <SelectItem value="last_6_months">Last 6 Months</SelectItem>
                <SelectItem value="last_12_months">Last 12 Months</SelectItem>
                <SelectItem value="custom">Custom Range</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {selectedRangeType === "custom" && (
            <>
              <div className="flex-1 w-full sm:w-auto">
                <label htmlFor="start-date" className="block text-sm font-medium mb-1">Start Date</label>
                <DatePicker date={customStartDate} setDate={setCustomStartDate} placeholder="Select start date" />
              </div>
              <div className="flex-1 w-full sm:w-auto">
                <label htmlFor="end-date" className="block text-sm font-medium mb-1">End Date</label>
                <DatePicker date={customEndDate} setDate={setCustomEndDate} placeholder="Select end date" />
              </div>
            </>
          )}

          <div className="flex-1 w-full sm:w-auto">
            <label htmlFor="status-filter" className="block text-sm font-medium mb-1">Status</label>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
                <SelectTrigger id="status-filter" className="w-full">
                    <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="credit">Credit</SelectItem>
                </SelectContent>
            </Select>
          </div>
        </div>

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
          <>
            {filteredReportData.dailySales.length > 0 && (
               <Card className="print:hidden">
                <CardHeader>
                  <CardTitle>Sales Overview</CardTitle>
                  <CardDescription>Daily sales for the selected period.</CardDescription>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={chartConfig} className="min-h-[200px] w-full">
                    <BarChart accessibilityLayer data={filteredReportData.dailySales}>
                      <CartesianGrid vertical={false} />
                      <XAxis
                        dataKey="date"
                        tickLine={false}
                        tickMargin={10}
                        axisLine={false}
                        tickFormatter={(value) => format(parseISO(value), "MMM d")}
                      />
                      <YAxis
                         tickFormatter={(value) => `₹${value}`}
                      />
                      <ChartTooltip
                        cursor={false}
                        content={<ChartTooltipContent indicator="line" labelFormatter={(label, payload) => {
                          return format(parseISO(payload[0].payload.date), "PPP")
                        }}/>}
                      />
                      <Bar
                        dataKey="totalAmount"
                        fill="var(--color-sales)"
                        radius={4}
                      />
                    </BarChart>
                  </ChartContainer>
                </CardContent>
              </Card>
            )}
           
            <ScrollArea className="h-[450px] rounded-md border print:h-auto print:overflow-visible print:border-none">
              <Table>
                <TableCaption className="print:text-xs print:mt-2">
                  Sales data for the selected period.
                  {filteredReportData.allInvoicesInPeriod?.length === 0 && " No sales found for this period."}
                </TableCaption>
                <TableHeader className="sticky top-0 bg-background z-10 print:static print:bg-transparent">
                  <TableRow>
                    <TableHead>Invoice ID</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Amount (₹)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredReportData.allInvoicesInPeriod && filteredReportData.allInvoicesInPeriod.length > 0 ? (
                    filteredReportData.allInvoicesInPeriod.map((invoice) => (
                      <TableRow key={invoice.id}>
                         <TableCell className="font-mono">
                            <Button variant="link" asChild className="p-0 h-auto font-normal">
                                <Link href={`/invoice/${invoice.id}`} title="View & Print Invoice" target="_blank">
                                    {invoice.id}
                                </Link>
                            </Button>
                        </TableCell>
                        <TableCell>{format(parseISO(invoice.date), "PPP")}</TableCell>
                        <TableCell>{invoice.customerName}</TableCell>
                         <TableCell>
                          <Badge variant={invoice.paymentStatus === 'Credit' ? 'destructive' : 'default'}>
                            {invoice.paymentStatus}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">₹{invoice.amount.toFixed(2)}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        No sales data available for the selected period.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
                {filteredReportData.allInvoicesInPeriod && filteredReportData.allInvoicesInPeriod.length > 0 && (
                   <TableFooter className="print:bg-transparent">
                      <TableRow className="font-semibold bg-muted/50 hover:bg-muted/60 print:bg-transparent">
                          <TableCell colSpan={4}>Total for Period</TableCell>
                          <TableCell className="text-right">₹{filteredReportData.periodTotal.toFixed(2)}</TableCell>
                      </TableRow>
                   </TableFooter>
                )}
              </Table>
            </ScrollArea>
             {filteredReportData.allInvoicesInPeriod && filteredReportData.allInvoicesInPeriod.length > 0 && (
               <div className="mt-4 p-4 border rounded-lg bg-secondary/30 print:border-none print:bg-transparent print:p-0 print:mt-2">
                  <p className="text-lg font-semibold text-right print:text-base">
                    Grand Total for Selected Period: ₹{filteredReportData.periodTotal.toFixed(2)} ({filteredReportData.periodInvoiceCount} invoices)
                  </p>
               </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
