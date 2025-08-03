
"use client";

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { LayoutDashboard, BarChart as BarChartIcon, Users, Settings2, AlertTriangle, UserCheck, BarChartHorizontalBig, TrendingUp, Store, ClipboardList, ShoppingCart, BookUser, CalendarClock, DollarSign, Award, Trophy, Cake } from 'lucide-react';
import LoadingSpinner from '@/components/LoadingSpinner';
import { getFirebaseUsers, type GetUsersResult } from './users/actions';
import { useToast } from '@/hooks/use-toast';
import { getServices as getFirestoreServices, type Service } from './services/actions';
import { getInvoices } from './invoices/actions';
import { getFranchises, getFranchiseConfig } from './franchises/actions';
import { getTasks } from './tasks/actions';
import { getProducts } from './products/actions';
import { getAttendanceRecordsFromServer } from './attendance/actions';
import type { Invoice } from '@/types/invoice';
import type { UserProfile } from '@/types/user';
import { BarChart, Bar } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { format, parseISO, startOfMonth, endOfMonth, isWithinInterval, differenceInCalendarDays, addYears } from 'date-fns';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';

const chartConfig = {
  sales: {
    label: "Sales",
    color: "hsl(var(--chart-1))",
  },
} satisfies ChartConfig;

interface TopSalesUser {
    uid: string;
    name: string;
    totalSales: number;
}

interface TopService {
    id: string;
    name: string;
    count: number;
}

interface UpcomingBirthday {
    name: string;
    daysUntil: number;
    date: string;
}

export default function AdminDashboardPage() {
  const { hasPermission } = useAuth();
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
  
  const [topServices, setTopServices] = useState<TopService[]>([]);
  const [topSalesUsers, setTopSalesUsers] = useState<TopSalesUser[]>([]);
  const [upcomingBirthdays, setUpcomingBirthdays] = useState<UpcomingBirthday[]>([]);

  const [franchiseCount, setFranchiseCount] = useState<number | null>(null);
  const [targetFranchises, setTargetFranchises] = useState<number | null>(null);
  const [isLoadingFranchiseCount, setIsLoadingFranchiseCount] = useState(true);
  const [errorLoadingFranchiseCount, setErrorLoadingFranchiseCount] = useState<string | null>(null);
  
  const [pendingTasksCount, setPendingTasksCount] = useState<number | null>(null);
  const [isLoadingTasks, setIsLoadingTasks] = useState(true);
  const [errorLoadingTasks, setErrorLoadingTasks] = useState<string | null>(null);

  const [inventoryCount, setInventoryCount] = useState<number | null>(null);
  const [isLoadingInventory, setIsLoadingInventory] = useState(true);
  const [errorLoadingInventory, setErrorLoadingInventory] = useState<string | null>(null);
  
  const [creditTotal, setCreditTotal] = useState<number | null>(null);
  const [isLoadingCredit, setIsLoadingCredit] = useState(true);
  const [errorLoadingCredit, setErrorLoadingCredit] = useState<string | null>(null);

  const [clockedInCount, setClockedInCount] = useState<number | null>(null);
  const [isLoadingAttendance, setIsLoadingAttendance] = useState(true);
  const [errorLoadingAttendance, setErrorLoadingAttendance] = useState<string | null>(null);


  const [pendingApprovalsCount, setPendingApprovalsCount] = useState<number>(0);
  const [isLoadingPendingApprovals, setIsLoadingPendingApprovals] = useState(true);

  const { toast } = useToast();

  const fetchAllData = useCallback(async () => {
    setIsLoadingUserCount(true);
    setIsLoadingPendingApprovals(true);
    setIsLoadingServiceCount(true);
    setIsLoadingSales(true);
    setIsLoadingFranchiseCount(true);
    setIsLoadingTasks(true);
    setIsLoadingInventory(true);
    setIsLoadingCredit(true);
    setIsLoadingAttendance(true);

    try {
        const [
            usersResult, 
            servicesResult, 
            invoicesResult, 
            franchisesResult, 
            franchiseConfigResult, 
            tasksResult,
            productsResult,
            attendanceResult
        ] = await Promise.all([
            getFirebaseUsers(1000),
            getFirestoreServices(),
            getInvoices(),
            getFranchises(),
            getFranchiseConfig(),
            getTasks(),
            getProducts(),
            getAttendanceRecordsFromServer()
        ]);

        // Users and Pending Approvals
        if (usersResult.success && typeof usersResult.totalUserCount === 'number' && usersResult.users) {
            setUserCount(usersResult.totalUserCount);
            const pending = usersResult.users.filter(user => user.firestoreStatus === 'pending_approval').length;
            setPendingApprovalsCount(pending);

            // Calculate Upcoming Birthdays
            const today = new Date();
            today.setHours(0, 0, 0, 0); 
            const birthdays: UpcomingBirthday[] = [];
            usersResult.users.forEach(user => {
                const profile = user.profileData as (UserProfile | undefined);
                if (user.firestoreStatus === 'approved' && profile?.dateOfBirth) {
                    const dob = parseISO(profile.dateOfBirth as unknown as string);
                    let nextBirthday = new Date(today.getFullYear(), dob.getMonth(), dob.getDate());
                    if (nextBirthday < today) {
                        nextBirthday = addYears(nextBirthday, 1);
                    }
                    const daysUntil = differenceInCalendarDays(nextBirthday, today);
                    if (daysUntil >= 0 && daysUntil <= 30) {
                        birthdays.push({
                            name: profile.fullName || user.email || 'Unknown User',
                            daysUntil,
                            date: format(nextBirthday, 'do MMMM')
                        });
                    }
                }
            });
            setUpcomingBirthdays(birthdays.sort((a,b) => a.daysUntil - b.daysUntil));

        } else {
            setErrorLoadingUserCount(usersResult.message || "Failed to load user data.");
        }
        setIsLoadingUserCount(false);
        setIsLoadingPendingApprovals(false);

        // Services
        if (servicesResult.success && servicesResult.services) {
            setServiceCount(servicesResult.services.length);
        } else {
            setErrorLoadingServiceCount(servicesResult.message || "Failed to load service count.");
        }
        setIsLoadingServiceCount(false);

        // Sales and Credit
        if (invoicesResult.success && invoicesResult.invoices) {
            const invoices = invoicesResult.invoices;
            const today = new Date();
            const monthStart = startOfMonth(today);
            const monthEnd = endOfMonth(today);
            const interval = { start: monthStart, end: monthEnd };

            const invoicesInCurrentMonth = invoices.filter(invoice => isWithinInterval(parseISO(invoice.date), interval));
            const salesForCurrentMonth = invoicesInCurrentMonth.reduce((sum, invoice) => sum + invoice.amount, 0);
            setMonthlySales(salesForCurrentMonth);
            
            const totalCredit = invoices.filter(i => i.paymentStatus === 'Credit').reduce((sum, i) => sum + i.amount, 0);
            setCreditTotal(totalCredit);

            const dailySalesMap = new Map<string, number>();
            invoicesInCurrentMonth.forEach(invoice => {
                const formattedDate = format(parseISO(invoice.date), "yyyy-MM-dd");
                const dayTotal = dailySalesMap.get(formattedDate) || 0;
                dailySalesMap.set(formattedDate, dayTotal + invoice.amount);
            });
            const chartData = Array.from(dailySalesMap.entries()).map(([date, sales]) => ({ date, sales })).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
            setSalesChartData(chartData);

            // Calculate Top Services
            if (servicesResult.success && servicesResult.services) {
                const serviceCounts = new Map<string, { id: string; name: string; count: number }>();
                invoices.forEach(invoice => {
                    invoice.selectedServices?.forEach(service => {
                    const current = serviceCounts.get(service.id) || { id: service.id, name: service.name, count: 0 };
                    current.count += 1;
                    serviceCounts.set(service.id, current);
                    });
                });
                
                if (serviceCounts.size > 0) {
                    const sortedServices = Array.from(serviceCounts.values())
                    .sort((a, b) => b.count - a.count)
                    .slice(0, 3);
                    setTopServices(sortedServices);
                } else {
                    setTopServices([]);
                }
            }
            
            // Calculate Top Sales Users
            const userSales = new Map<string, { name: string, totalSales: number }>();
            invoices.forEach(invoice => {
                if (invoice.createdByUid) {
                    const current = userSales.get(invoice.createdByUid) || { name: invoice.createdByName, totalSales: 0 };
                    current.totalSales += invoice.amount;
                    userSales.set(invoice.createdByUid, current);
                }
            });

            const sortedUsers = Array.from(userSales.entries())
                .map(([uid, data]) => ({ uid, ...data }))
                .sort((a, b) => b.totalSales - a.totalSales);
            
            setTopSalesUsers(sortedUsers.slice(0, 3));


        } else {
            setErrorLoadingSales(invoicesResult.message || "Could not fetch invoices.");
            setErrorLoadingCredit(invoicesResult.message || "Could not fetch invoices for credit calculation.");
        }
        setIsLoadingSales(false);
        setIsLoadingCredit(false);
        
        // Franchises
        if (franchisesResult.success && franchisesResult.franchises) {
            setFranchiseCount(franchisesResult.franchises.length);
        } else {
            setErrorLoadingFranchiseCount(franchisesResult.message || "Failed to load franchises.");
        }
        if (franchiseConfigResult.success && franchiseConfigResult.config) {
            setTargetFranchises(franchiseConfigResult.config.targetFranchises);
        } else {
            setErrorLoadingFranchiseCount(prev => (prev ? prev + '; ' : '') + (franchiseConfigResult.message || "Failed to load franchise config."));
        }
        setIsLoadingFranchiseCount(false);

        // Tasks
        if (tasksResult.success && tasksResult.tasks) {
            const pendingCount = tasksResult.tasks.filter(t => t.status === 'pending').length;
            setPendingTasksCount(pendingCount);
        } else {
            setErrorLoadingTasks(tasksResult.message || "Failed to load task data.");
        }
        setIsLoadingTasks(false);

        // Inventory
        if (productsResult.success && productsResult.products) {
            setInventoryCount(productsResult.products.length);
        } else {
            setErrorLoadingInventory(productsResult.message || "Failed to load inventory data.");
        }
        setIsLoadingInventory(false);

        // Attendance
        if (attendanceResult.success && attendanceResult.records) {
            const currentlyClockedIn = attendanceResult.records.filter(r => r.status === 'clocked-in').length;
            setClockedInCount(currentlyClockedIn);
        } else {
            setErrorLoadingAttendance(attendanceResult.message || "Failed to load attendance data.");
        }
        setIsLoadingAttendance(false);

    } catch (error: any) {
        const message = error.message || "An unexpected error occurred while fetching dashboard data.";
        toast({ title: "Error Fetching Data", description: message, variant: "destructive" });
        setErrorLoadingUserCount(message);
        setErrorLoadingServiceCount(message);
        setErrorLoadingSales(message);
        setErrorLoadingFranchiseCount(message);
        setErrorLoadingTasks(message);
        setErrorLoadingInventory(message);
        setErrorLoadingCredit(message);
        setErrorLoadingAttendance(message);
    }
  }, [toast]);


  useEffect(() => {
    fetchAllData();
    const handleUserListUpdated = () => fetchAllData();
    window.addEventListener('userListUpdated', handleUserListUpdated);
    window.addEventListener('invoiceUpdated', fetchAllData);
    return () => {
      window.removeEventListener('userListUpdated', handleUserListUpdated);
      window.removeEventListener('invoiceUpdated', fetchAllData);
    };
  }, [fetchAllData]);
  
  const getInitials = (name?: string | null) => {
    if (name) {
      const names = name.split(' ');
      if (names.length > 1) {
        return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
      }
      return name.substring(0, 2).toUpperCase();
    }
    return "U";
  };


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
        {hasPermission('sales_reports') && (
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
        )}
        
        {hasPermission('sales_reports') && (
            <Link href="/admin/service-sales-report" className="block hover:shadow-lg transition-shadow duration-200 ease-in-out rounded-lg">
                <Card className="shadow-md h-full cursor-pointer">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 bg-[hsl(var(--chart-1)/0.1)] rounded-t-lg">
                    <CardTitle className="text-sm font-medium">Top Services Sold</CardTitle>
                    <BarChartHorizontalBig className="h-4 w-4 text-[hsl(var(--chart-1))]" />
                    </CardHeader>
                    <CardContent className="pt-4 space-y-2">
                    {isLoadingSales ? (
                        <LoadingSpinner size={24} />
                    ) : topServices.length > 0 ? (
                        topServices.map((service, index) => (
                        <div key={service.id} className="flex items-center space-x-2">
                            <Trophy className={`h-4 w-4 ${index === 0 ? 'text-amber-400' : index === 1 ? 'text-slate-400' : 'text-amber-800'}`} />
                            <div className="flex-1">
                            <p className="text-sm font-medium leading-none truncate" title={service.name}>{service.name}</p>
                            <p className="text-xs text-muted-foreground">Sold {service.count} times</p>
                            </div>
                        </div>
                        ))
                    ) : (
                        <p className="text-xs text-muted-foreground text-center py-4">No sales data to rank services.</p>
                    )}
                    {topServices.length > 0 && (
                       <p className="text-xs text-muted-foreground pt-1 text-center">Click to view the full report.</p>
                    )}
                    </CardContent>
                </Card>
            </Link>
        )}
        
        {hasPermission('sales_reports') && (
             <Card className="shadow-md h-full">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 bg-[hsl(var(--chart-2)/0.1)] rounded-t-lg">
                <CardTitle className="text-sm font-medium">Top Sales Performers</CardTitle>
                <TrendingUp className="h-4 w-4 text-[hsl(var(--chart-2))]" />
                </CardHeader>
                <CardContent className="pt-4 space-y-2">
                {isLoadingSales ? (
                    <LoadingSpinner size={24} />
                ) : topSalesUsers.length > 0 ? (
                    topSalesUsers.map((user, index) => (
                    <div key={user.uid} className="flex items-center space-x-2">
                        <Trophy className={`h-4 w-4 ${index === 0 ? 'text-amber-400' : index === 1 ? 'text-slate-400' : 'text-amber-800'}`} />
                        <Avatar className="h-6 w-6">
                        <AvatarFallback className="text-xs bg-muted">{getInitials(user.name)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                        <p className="text-sm font-medium leading-none truncate" title={user.name}>{user.name.split(' ')[0]}</p>
                        <p className="text-xs text-muted-foreground">₹{user.totalSales.toFixed(2)}</p>
                        </div>
                        <Button variant="link" size="sm" asChild className="p-0 h-auto text-xs">
                            <Link href={`/admin/user-sales-report/${user.uid}?name=${encodeURIComponent(user.name)}`}>
                                Details
                            </Link>
                        </Button>
                    </div>
                    ))
                ) : (
                    <p className="text-xs text-muted-foreground text-center py-4">No sales data to rank users.</p>
                )}
                {topSalesUsers.length > 0 && (
                    <p className="text-xs text-muted-foreground pt-1 text-center">Click "Details" or <Link href="/admin/user-sales-report" className="underline">view the full report</Link>.</p>
                )}
                </CardContent>
            </Card>
        )}

        {hasPermission('credit_invoices') && (
            <Link href="/admin/credit" className="block hover:shadow-lg transition-shadow duration-200 ease-in-out rounded-lg">
                <Card className="shadow-md h-full cursor-pointer">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 bg-[hsl(var(--chart-3)/0.1)] rounded-t-lg">
                    <CardTitle className="text-sm font-medium">Outstanding Credit</CardTitle>
                    <BookUser className="h-4 w-4 text-[hsl(var(--chart-3))]" />
                </CardHeader>
                <CardContent className="pt-4">
                    {isLoadingCredit ? (
                    <LoadingSpinner size={24} />
                    ) : errorLoadingCredit ? (
                    <div className="flex items-center text-destructive">
                        <AlertTriangle className="h-5 w-5 mr-1" />
                        <span className="text-sm">Error</span>
                    </div>
                    ) : (
                    <div className="text-2xl font-bold">₹{creditTotal !== null ? creditTotal.toFixed(2) : '0.00'}</div>
                    )}
                    <p className="text-xs text-muted-foreground">Total amount in credit invoices</p>
                </CardContent>
                </Card>
            </Link>
        )}
        
        {hasPermission('user_management') && (
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
        )}
        
        {hasPermission('attendance_management') && (
            <Link href="/admin/attendance" className="block hover:shadow-lg transition-shadow duration-200 ease-in-out rounded-lg">
                <Card className="shadow-md h-full cursor-pointer">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 bg-[hsl(var(--chart-4)/0.1)] rounded-t-lg">
                    <CardTitle className="text-sm font-medium">Currently Clocked In</CardTitle>
                    <CalendarClock className="h-4 w-4 text-[hsl(var(--chart-4))]" />
                </CardHeader>
                <CardContent className="pt-4">
                    {isLoadingAttendance ? (
                    <LoadingSpinner size={24} />
                    ) : errorLoadingAttendance ? (
                    <div className="flex items-center text-destructive">
                        <AlertTriangle className="h-5 w-5 mr-1" />
                        <span className="text-sm">Error</span>
                    </div>
                    ) : (
                    <div className="text-2xl font-bold">{clockedInCount !== null ? clockedInCount : 'N/A'}</div>
                    )}
                    <p className="text-xs text-muted-foreground">Users with active sessions</p>
                </CardContent>
                </Card>
            </Link>
        )}
        
        {hasPermission('franchise_management') && (
            <Link href="/admin/franchises" className="block hover:shadow-lg transition-shadow duration-200 ease-in-out rounded-lg">
                <Card className="shadow-md h-full cursor-pointer">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 bg-[hsl(var(--chart-2)/0.1)] rounded-t-lg">
                    <CardTitle className="text-sm font-medium">Franchise Growth</CardTitle>
                    <Store className="h-4 w-4 text-[hsl(var(--chart-2))]" />
                </CardHeader>
                <CardContent className="pt-4">
                    {isLoadingFranchiseCount ? (
                    <LoadingSpinner size={24} />
                    ) : errorLoadingFranchiseCount ? (
                    <div className="flex items-center text-destructive">
                        <AlertTriangle className="h-5 w-5 mr-1" />
                        <span className="text-sm">Error</span>
                    </div>
                    ) : (
                    <div className="text-2xl font-bold">
                        {franchiseCount !== null ? franchiseCount : 'N/A'} / {targetFranchises !== null ? targetFranchises : 'N/A'}
                    </div>
                    )}
                    <p className="text-xs text-muted-foreground">Current vs. Target Franchises</p>
                </CardContent>
                </Card>
            </Link>
        )}

        {hasPermission('task_management') && (
            <Link href="/admin/tasks" className="block hover:shadow-lg transition-shadow duration-200 ease-in-out rounded-lg">
                <Card className="shadow-md h-full cursor-pointer">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 bg-primary/10 rounded-t-lg">
                    <CardTitle className="text-sm font-medium">Pending Tasks</CardTitle>
                    <ClipboardList className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent className="pt-4">
                    {isLoadingTasks ? (
                    <LoadingSpinner size={24} />
                    ) : errorLoadingTasks ? (
                    <div className="flex items-center text-destructive">
                        <AlertTriangle className="h-5 w-5 mr-1" />
                        <span className="text-sm">Error</span>
                    </div>
                    ) : (
                    <div className="text-2xl font-bold">{pendingTasksCount !== null ? pendingTasksCount : 'N/A'}</div>
                    )}
                    <p className="text-xs text-muted-foreground">Total open tasks for all users</p>
                </CardContent>
                </Card>
            </Link>
        )}

        {hasPermission('inventory_management') && (
            <Link href="/admin/products" className="block hover:shadow-lg transition-shadow duration-200 ease-in-out rounded-lg">
                <Card className="shadow-md h-full cursor-pointer">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 bg-[hsl(var(--chart-2)/0.1)] rounded-t-lg">
                    <CardTitle className="text-sm font-medium">Inventory Items</CardTitle>
                    <ShoppingCart className="h-4 w-4 text-[hsl(var(--chart-2))]" />
                </CardHeader>
                <CardContent className="pt-4">
                    {isLoadingInventory ? (
                    <LoadingSpinner size={24} />
                    ) : errorLoadingInventory ? (
                    <div className="flex items-center text-destructive">
                        <AlertTriangle className="h-5 w-5 mr-1" />
                        <span className="text-sm">Error</span>
                    </div>
                    ) : (
                    <div className="text-2xl font-bold">{inventoryCount !== null ? inventoryCount : 'N/A'}</div>
                    )}
                    <p className="text-xs text-muted-foreground">Total products and assets</p>
                </CardContent>
                </Card>
            </Link>
        )}
        
        {hasPermission('salary_report') && (
            <Link href="/admin/salary-report" className="block hover:shadow-lg transition-shadow duration-200 ease-in-out rounded-lg">
                <Card className="shadow-md h-full cursor-pointer flex flex-col justify-center items-center">
                    <CardHeader className="items-center pb-2">
                        <DollarSign className="h-8 w-8 text-primary" />
                    </CardHeader>
                    <CardContent className="text-center">
                        <p className="text-sm font-semibold">Salary Report</p>
                        <p className="text-xs text-muted-foreground">Calculate employee salaries</p>
                    </CardContent>
                </Card>
            </Link>
        )}
        
        {hasPermission('user_management') && (
            <Card className="shadow-md h-full">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 bg-[hsl(var(--chart-4)/0.1)] rounded-t-lg">
                    <CardTitle className="text-sm font-medium">Birthday Reminders (30 Days)</CardTitle>
                    <Cake className="h-4 w-4 text-[hsl(var(--chart-4))]" />
                </CardHeader>
                <CardContent className="pt-4 space-y-2">
                    {isLoadingUserCount ? (
                        <LoadingSpinner size={24} />
                    ) : upcomingBirthdays.length > 0 ? (
                        upcomingBirthdays.map((b, index) => (
                            <div key={index} className="flex items-center space-x-2">
                            <Cake className="h-4 w-4 text-muted-foreground" />
                            <div className="flex-1">
                                <p className="text-sm font-medium leading-none truncate" title={b.name}>{b.name.split(' ')[0]}</p>
                                <p className="text-xs text-muted-foreground">{b.date}</p>
                            </div>
                            <span className="text-xs font-semibold text-primary">
                                {b.daysUntil === 0 ? 'Today!' : b.daysUntil === 1 ? 'Tomorrow' : `in ${b.daysUntil} days`}
                            </span>
                            </div>
                        ))
                    ) : (
                        <p className="text-xs text-muted-foreground text-center py-4">No upcoming birthdays in the next 30 days.</p>
                    )}
                </CardContent>
            </Card>
        )}
        
        {hasPermission('user_management') && (
            <Link href="/admin/users" className="block hover:shadow-lg transition-shadow duration-200 ease-in-out rounded-lg">
                <Card className="shadow-md h-full cursor-pointer">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 bg-[hsl(var(--chart-3)/0.1)] rounded-t-lg">
                    <CardTitle className="text-sm font-medium">Pending Approvals</CardTitle>
                    <UserCheck className="h-4 w-4 text-[hsl(var(--chart-3))]" />
                </CardHeader>
                <CardContent className="pt-4">
                    {isLoadingPendingApprovals ? ( 
                    <LoadingSpinner size={24} />
                    ) : errorLoadingUserCount ? ( 
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
        )}

        {hasPermission('service_management') && (
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
        )}
      </div>
    </div>
  );
}
