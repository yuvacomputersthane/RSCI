"use client";

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { LayoutDashboard, BarChart as BarChartIcon, Users, Settings2, AlertTriangle, UserCheck, BarChartHorizontalBig, TrendingUp } from 'lucide-react';
import LoadingSpinner from '@/components/LoadingSpinner';
import { getFirebaseUsers, type GetUsersResult } from './users/actions';
import { useToast } from '@/hooks/use-toast';
import { getServices as getFirestoreServices } from './services/actions';
import { getInvoices } from './invoices/actions';
import type { Invoice } from '@/types/invoice';
import { BarChart, Bar } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { format, parseISO, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';

const chartConfig = {
  sales: {
    label: "Sales",
    color: "hsl(var(--chart-1))",
  },
} satisfies ChartConfig;


export default function AdminDashboardPage() {
  const [userCount, setUserCount] = useState<number | null>(null);
  const [isLoadingUserCount, setIsLoadingUserCount] = useState(true);
  const [errorLoadingUserCount, setErrorLoadingUserCount] = useState<string | null>(null);

  const [serviceCount, setServiceCount] = useState<number | null>(null);
  const [isLoadingServiceCount, setIsLoadingServiceCount] = useState(true);
  const [errorLoadingServiceCount, setErrorLoadingServiceCount] = useState<string | null>(null);

  const [monthlySales, setMonthlySales] = useState<number | null>(null);
  const [isLoadingSales, setIsLoadingSales] = useState(true);
  const [errorLoadingSales, setErrorLoadingSales] = useState<string | null>(null);
  const [salesChartData, setSalesChartData] = useState<{ date: string; sales: number }[]>([]);


  const [pendingApprovalsCount, setPendingApprovalsCount] = useState<number>(0);
  const [isLoadingPendingApprovals, setIsLoadingPendingApprovals] = useState(true);

  const { toast } = useToast();

  const fetchUserCountAndPending = useCallback(async () => {
    setIsLoadingUserCount(true);
    setIsLoadingPendingApprovals(true);
    setErrorLoadingUserCount(null);
    try {
      const result: GetUsersResult = await getFirebaseUsers(1000);
      if (result.success && typeof result.totalUserCount === 'number' && result.users) {
        setUserCount(result.totalUserCount);
        const pending = result.users.filter(user => user.firestoreStatus === 'pending_approval').length;
        setPendingApprovalsCount(pending);
      } else {
        setUserCount(null);
        setPendingApprovalsCount(0);
        const message = result.message || "Failed to load user data.";
        setErrorLoadingUserCount(message);
        toast({
          title: "Error Loading User Data",
          description: message,
          variant: "destructive",
        });
      }
    } catch (error: any) {
      setUserCount(null);
      setPendingApprovalsCount(0);
      const message = error.message || "An unexpected error occurred while fetching user data.";
      setErrorLoadingUserCount(message);
      toast({
        title: "Error Fetching Users",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsLoadingUserCount(false);
      setIsLoadingPendingApprovals(false);
    }
  }, [toast]);

  const fetchServiceCount = useCallback(async () => {
    setIsLoadingServiceCount(true);
    setErrorLoadingServiceCount(null);
    try {
      const result = await getFirestoreServices();
      if (result.success && result.services) {
        setServiceCount(result.services.length);
      } else {
        setServiceCount(null);
        const message = result.message || "Failed to load service count.";
        setErrorLoadingServiceCount(message);
        toast({
          title: "Error Loading Service Count",
          description: message,
          variant: "destructive",
        });
      }
    } catch (error: any) {
      setServiceCount(null);
      const message = error.message || "An unexpected error occurred while fetching service count.";
      setErrorLoadingServiceCount(message);
       toast({
          title: "Error Fetching Services",
          description: message,
          variant: "destructive",
        });
    } finally {
      setIsLoadingServiceCount(false);
    }
  }, [toast]);

  const calculateMonthlySales = useCallback(async () => {
    setIsLoadingSales(true);
    setErrorLoadingSales(null);
    try {
      const invoicesResult = await getInvoices();
      if (!invoicesResult.success || !invoicesResult.invoices) {
        throw new Error(invoicesResult.message || "Could not fetch invoices.");
      }
      
      const invoices: Invoice[] = invoicesResult.invoices;
      const today = new Date();
      const monthStart = startOfMonth(today);
      const monthEnd = endOfMonth(today);
      const interval = { start: monthStart, end: monthEnd };

       const invoicesInCurrentMonth = invoices.filter(invoice => {
        const invoiceDate = parseISO(invoice.date);
        return isWithinInterval(invoiceDate, interval);
      });

      const salesForCurrentMonth = invoicesInCurrentMonth.reduce((sum, invoice) => sum + invoice.amount, 0);
      setMonthlySales(salesForCurrentMonth);

      // Process data for chart
      const dailySalesMap = new Map<string, number>();
      invoicesInCurrentMonth.forEach(invoice => {
        const formattedDate = format(parseISO(invoice.date), "yyyy-MM-dd");
        const dayTotal = dailySalesMap.get(formattedDate) || 0;
        dailySalesMap.set(formattedDate, dayTotal + invoice.amount);
      });

      const chartData = Array.from(dailySalesMap.entries())
        .map(([date, sales]) => ({ date, sales }))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
      setSalesChartData(chartData);

    } catch (error: any) {
      setMonthlySales(null);
      setSalesChartData([]); // clear chart data on error
      const message = error.message || "An unexpected error occurred while calculating sales.";
      setErrorLoadingSales(message);
      toast({
        title: "Error Calculating Sales",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsLoadingSales(false);
    }
  }, [toast]);


  useEffect(() => {
    fetchUserCountAndPending();
    fetchServiceCount();
    calculateMonthlySales();

    const handleUserListUpdated = () => fetchUserCountAndPending();
    window.addEventListener('userListUpdated', handleUserListUpdated);

    // Refresh sales when an invoice is added anywhere in the app
    window.addEventListener('invoiceUpdated', calculateMonthlySales);

    return () => {
      window.removeEventListener('userListUpdated', handleUserListUpdated);
      window.removeEventListener('invoiceUpdated', calculateMonthlySales);
    };
  }, [fetchUserCountAndPending, fetchServiceCount, calculateMonthlySales]);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
            <LayoutDashboard className="h-8 w-8 text-primary" />
            Admin Dashboard
        </h1>
        <p className="text-muted-foreground">
            Welcome to the Rising Sun Computers management panel. Here's a summary of your business.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Link href="/admin/users" className="block hover:shadow-lg transition-shadow duration-200 ease-in-out rounded-lg">
            <Card className="shadow-md h-full cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 bg-[hsl(var(--chart-1)/0.1)] rounded-t-lg">
                <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                <Users className="h-4 w-4 text-[hsl(var(--chart-1))]" />
            </CardHeader>
            <CardContent className="pt-4">
                {isLoadingUserCount ? (
                <LoadingSpinner size={24} />
                ) : errorLoadingUserCount ? (
                <div className="flex items-center text-destructive">
                    <AlertTriangle className="h-5 w-5 mr-1" />
                    <span className="text-sm">Error</span>
                </div>
                ) : (
                <div className="text-2xl font-bold">{userCount !== null ? userCount : 'N/A'}</div>
                )}
                <p className="text-xs text-muted-foreground">Total registered accounts</p>
            </CardContent>
            </Card>
        </Link>
        
        <Link href="/admin/sales-reports" className="block hover:shadow-lg transition-shadow duration-200 ease-in-out rounded-lg">
            <Card className="shadow-md h-full cursor-pointer">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 bg-[hsl(var(--chart-5)/0.1)] rounded-t-lg">
                <CardTitle className="text-sm font-medium">Sales (Current Month)</CardTitle>
                <BarChartIcon className="h-4 w-4 text-[hsl(var(--chart-5))]" />
              </CardHeader>
              <CardContent className="pt-4">
                {isLoadingSales ? (
                  <LoadingSpinner size={24} />
                ) : errorLoadingSales ? (
                  <div className="flex items-center text-destructive">
                    <AlertTriangle className="h-5 w-5 mr-1" />
                    <span className="text-sm">Error</span>
                  </div>
                ) : (
                  <>
                    <div className="text-2xl font-bold">₹{monthlySales !== null ? monthlySales.toFixed(2) : '0.00'}</div>
                    <p className="text-xs text-muted-foreground">Based on Firestore. Click for details.</p>
                     {salesChartData.length > 1 ? (
                      <div className="h-[60px] mt-4 -ml-2">
                        <ChartContainer config={chartConfig} className="h-full w-full">
                          <BarChart
                            accessibilityLayer
                            data={salesChartData}
                            margin={{
                              top: 5,
                              right: 5,
                              left: 5,
                              bottom: 0,
                            }}
                          >
                            <ChartTooltip
                              cursor={false}
                              content={<ChartTooltipContent hideLabel hideIndicator formatter={(value, name, item) => 
                                `${format(parseISO(item.payload.date), "MMM d")}: ₹${(value as number).toFixed(2)}`
                              } />}
                            />
                            <Bar
                              dataKey="sales"
                              fill="var(--color-sales)"
                              radius={2}
                            />
                          </BarChart>
                        </ChartContainer>
                      </div>
                    ) : (
                        <div className="h-[60px] mt-4 flex items-center justify-center">
                            <p className="text-xs text-muted-foreground">Not enough daily data to display chart.</p>
                        </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
        </Link>
        
        <Link href="/admin/users" className="block hover:shadow-lg transition-shadow duration-200 ease-in-out rounded-lg">
            <Card className="shadow-md h-full cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 bg-[hsl(var(--chart-3)/0.1)] rounded-t-lg">
                <CardTitle className="text-sm font-medium">Pending Approvals</CardTitle>
                <UserCheck className="h-4 w-4 text-[hsl(var(--chart-3))]" />
            </CardHeader>
            <CardContent className="pt-4">
                {isLoadingPendingApprovals ? ( // Uses isLoadingPendingApprovals
                <LoadingSpinner size={24} />
                ) : errorLoadingUserCount ? ( // Still relies on errorLoadingUserCount for error state
                <div className="flex items-center text-destructive">
                    <AlertTriangle className="h-5 w-5 mr-1" />
                    <span className="text-sm">Error</span>
                </div>
                ) : (
                <div className="text-2xl font-bold">{pendingApprovalsCount}</div>
                )}
                <p className="text-xs text-muted-foreground">User profiles awaiting review</p>
            </CardContent>
            </Card>
        </Link>

        <Link href="/admin/services" className="block hover:shadow-lg transition-shadow duration-200 ease-in-out rounded-lg">
          <Card className="shadow-md h-full cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 bg-[hsl(var(--chart-4)/0.1)] rounded-t-lg">
              <CardTitle className="text-sm font-medium">Total Services</CardTitle>
              <Settings2 className="h-4 w-4 text-[hsl(var(--chart-4))]" />
            </CardHeader>
            <CardContent className="pt-4">
             {isLoadingServiceCount ? (
                <LoadingSpinner size={24} />
                ) : errorLoadingServiceCount ? (
                <div className="flex items-center text-destructive">
                    <AlertTriangle className="h-5 w-5 mr-1" />
                    <span className="text-sm">Error</span>
                </div>
                ) : (
                <div className="text-2xl font-bold">{serviceCount !== null ? serviceCount : 'N/A'}</div>
                )}
              <p className="text-xs text-muted-foreground">Total services offered (from Firestore)</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/service-sales-report" className="block hover:shadow-lg transition-shadow duration-200 ease-in-out rounded-lg">
          <Card className="shadow-md h-full cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 bg-[hsl(var(--chart-2)/0.1)] rounded-t-lg">
              <CardTitle className="text-sm font-medium">Sales by Service</CardTitle>
              <BarChartHorizontalBig className="h-4 w-4 text-[hsl(var(--chart-2))]" />
            </CardHeader>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">View Report</div>
              <p className="text-xs text-muted-foreground">Breakdown of sales per service</p>
            </CardContent>
          </Card>
        </Link>
        
        <Link href="/admin/user-sales-report" className="block hover:shadow-lg transition-shadow duration-200 ease-in-out rounded-lg">
          <Card className="shadow-md h-full cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 bg-primary/10 rounded-t-lg">
              <CardTitle className="text-sm font-medium">Sales by User</CardTitle>
              <TrendingUp className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">View Report</div>
              <p className="text-xs text-muted-foreground">Track sales performance per user</p>
            </CardContent>
          </Card>
        </Link>

      </div>
    </div>
  );
}
