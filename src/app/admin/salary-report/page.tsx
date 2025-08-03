
"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption, TableFooter } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import LoadingSpinner from '@/components/LoadingSpinner';
import { getFirebaseUsers, type FirebaseUserListItem } from '../users/actions';
import { getUserAttendanceRecords, type AttendanceRecord } from '../attendance/actions';
import { getSalaryAdvances, type SalaryAdvance } from '../salary-advances/actions';
import { AlertTriangle, DollarSign, Printer, User, CalendarClock } from 'lucide-react';
import {
  startOfMonth,
  endOfMonth,
  subMonths,
  isWithinInterval,
  parseISO,
  differenceInMilliseconds,
  format,
} from 'date-fns';
import { useRouter } from 'next/navigation';

type RangePreset = "this_month" | "last_month";

interface SalaryReportData {
  userId: string;
  userName: string;
  monthlySalary: number;
  totalHours: string;
  advancesTotal: number;
  netPayable: number;
}

export default function SalaryReportPage() {
  const [allUsers, setAllUsers] = useState<FirebaseUserListItem[]>([]);
  const [allAttendance, setAllAttendance] = useState<AttendanceRecord[]>([]);
  const [allAdvances, setAllAdvances] = useState<SalaryAdvance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedRangeType, setSelectedRangeType] = useState<RangePreset>("this_month");
  const [selectedUserId, setSelectedUserId] = useState<string>('all');
  const router = useRouter();
  
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [usersResult, attendanceResult, advancesResult] = await Promise.all([
        getFirebaseUsers(),
        getUserAttendanceRecords(), // Gets all records for all users
        getSalaryAdvances()
      ]);

      if (!usersResult.success || !usersResult.users) {
        throw new Error(usersResult.message || "Failed to load user data.");
      }
      setAllUsers(usersResult.users.filter(u => u.firestoreStatus === 'approved'));
      
      if (!attendanceResult.success || !attendanceResult.records) {
        throw new Error(attendanceResult.message || "Failed to load attendance data.");
      }
      setAllAttendance(attendanceResult.records);

      if (!advancesResult.success || !advancesResult.advances) {
        throw new Error(advancesResult.message || "Failed to load salary advance data.");
      }
      setAllAdvances(advancesResult.advances);

    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const dateRanges = useMemo(() => {
    const today = new Date();
    return {
      this_month: { start: startOfMonth(today), end: endOfMonth(today) },
      last_month: { start: startOfMonth(subMonths(today, 1)), end: endOfMonth(subMonths(today, 1)) },
    };
  }, []);
  
  const usersWithSalaries = useMemo(() => {
    return allUsers.filter(user => 
        user.profileData && typeof user.profileData.monthlySalary === 'number' && user.profileData.monthlySalary > 0
    );
  }, [allUsers]);

  const salaryReport = useMemo((): SalaryReportData[] => {
    if (isLoading) return [];

    let usersToReport = usersWithSalaries;

    if (selectedUserId !== 'all') {
        usersToReport = usersToReport.filter(user => user.uid === selectedUserId);
    }
    
    const selectedRange = dateRanges[selectedRangeType];

    const report: SalaryReportData[] = usersToReport.map(user => {
      const userAttendance = allAttendance.filter(r => r.userId === user.uid && isWithinInterval(parseISO(r.clockInTime), selectedRange));
      const userAdvances = allAdvances.filter(a => a.userId === user.uid && isWithinInterval(parseISO(a.date), selectedRange));
      
      const totalMs = userAttendance.reduce((sum, record) => {
        const clockIn = parseISO(record.clockInTime);
        const clockOut = record.clockOutTime ? parseISO(record.clockOutTime) : selectedRange.end;
        return sum + differenceInMilliseconds(clockOut, clockIn);
      }, 0);

      const totalSeconds = Math.floor(totalMs / 1000);
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      
      const advancesTotal = userAdvances.reduce((sum, advance) => sum + advance.amount, 0);
      const monthlySalary = user.profileData!.monthlySalary!;
      const netPayable = monthlySalary - advancesTotal;

      return {
        userId: user.uid,
        userName: user.profileData?.fullName || user.email || 'Unknown User',
        monthlySalary,
        totalHours: `${hours}h ${minutes}m`,
        advancesTotal,
        netPayable,
      };
    });
    
    return report;
  }, [usersWithSalaries, allAttendance, allAdvances, isLoading, selectedUserId, selectedRangeType, dateRanges]);


  const handlePrint = () => window.print();
  
  const grandTotals = useMemo(() => salaryReport.reduce((acc, item) => {
    acc.salary += item.monthlySalary;
    acc.advances += item.advancesTotal;
    acc.net += item.netPayable;
    return acc;
  }, { salary: 0, advances: 0, net: 0 }), [salaryReport]);

  const selectedRange = dateRanges[selectedRangeType];

  return (
    <Card className="shadow-md print:shadow-none print:border-none">
      <CardHeader className="print:hidden">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <CardTitle className="text-2xl flex items-center">
              <DollarSign className="mr-2 h-6 w-6 text-primary" /> Salary Report
            </CardTitle>
            <CardDescription>Review employee monthly salaries including hours worked and advances.</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={() => router.push('/admin/salary-advances')} variant="secondary" size="sm">Manage Advances</Button>
            <Button onClick={handlePrint} variant="outline" size="sm">
              <Printer className="mr-2 h-4 w-4" /> Print Report
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-col sm:flex-row gap-4 items-center p-4 border rounded-lg bg-muted/30 print:hidden">
          <div className="flex-1 w-full sm:w-auto">
            <label htmlFor="range-select" className="block text-sm font-medium mb-1">Select Report Month</label>
            <Select value={selectedRangeType} onValueChange={(value) => setSelectedRangeType(value as RangePreset)}>
              <SelectTrigger id="range-select" className="w-full">
                <SelectValue placeholder="Select range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="this_month">This Month ({format(dateRanges.this_month.start, 'MMM yyyy')})</SelectItem>
                <SelectItem value="last_month">Last Month ({format(dateRanges.last_month.start, 'MMM yyyy')})</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 w-full sm:w-auto">
            <label htmlFor="user-select" className="block text-sm font-medium mb-1 flex items-center"><User className="mr-2 h-4 w-4"/>Select User</label>
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger id="user-select" className="w-full">
                <SelectValue placeholder="Select a user" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Users with Salary</SelectItem>
                {usersWithSalaries.map(user => (
                    <SelectItem key={user.uid} value={user.uid}>
                        {user.profileData?.fullName || user.email}
                    </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <LoadingSpinner size={32} /><p className="ml-2 text-muted-foreground">Loading data...</p>
          </div>
        ) : error ? (
          <div className="p-4 my-4 text-sm text-destructive-foreground bg-destructive rounded-md flex items-center">
            <AlertTriangle className="h-5 w-5 mr-2" /> {error}
          </div>
        ) : (
          <ScrollArea className="h-[60vh] rounded-md border print:h-auto print:overflow-visible print:border-none">
            <Table>
              <TableCaption className="print:text-xs print:mt-2">
                Salaries for {selectedRangeType === 'this_month' ? 'this month' : 'last month'}. Only users with a set monthly salary are shown.
              </TableCaption>
              <TableHeader className="sticky top-0 bg-background z-10 print:static print:bg-transparent">
                <TableRow>
                  <TableHead>User Name</TableHead>
                  <TableHead>Hours Worked</TableHead>
                  <TableHead className="text-right">Base Salary (₹)</TableHead>
                  <TableHead className="text-right">Advances (₹)</TableHead>
                  <TableHead className="text-right">Net Payable (₹)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {salaryReport.length > 0 ? (
                  salaryReport.map((row) => (
                    <TableRow key={row.userId}>
                      <TableCell className="font-medium">{row.userName}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <CalendarClock className="h-4 w-4 text-muted-foreground" />
                          {row.totalHours}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">₹{row.monthlySalary.toFixed(2)}</TableCell>
                      <TableCell className="text-right text-destructive">₹{row.advancesTotal.toFixed(2)}</TableCell>
                      <TableCell className="text-right font-semibold">₹{row.netPayable.toFixed(2)}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      {selectedUserId === 'all' 
                        ? "No users with a monthly salary have been set up." 
                        : "Selected user does not have a salary set."}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
              {salaryReport.length > 1 && (
                 <TableFooter className="print:bg-transparent">
                    <TableRow className="font-bold bg-muted/50 hover:bg-muted/60 print:bg-transparent text-base">
                        <TableCell colSpan={2}>Grand Total</TableCell>
                        <TableCell className="text-right">₹{grandTotals.salary.toFixed(2)}</TableCell>
                        <TableCell className="text-right text-destructive">₹{grandTotals.advances.toFixed(2)}</TableCell>
                        <TableCell className="text-right">₹{grandTotals.net.toFixed(2)}</TableCell>
                    </TableRow>
                 </TableFooter>
              )}
            </Table>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
