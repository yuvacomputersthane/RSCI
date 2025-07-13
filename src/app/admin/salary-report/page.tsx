
"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePicker } from '@/components/ui/date-picker';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption, TableFooter } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import LoadingSpinner from '@/components/LoadingSpinner';
import { getAttendanceRecordsFromServer, type AttendanceRecord } from '../attendance/actions';
import { getFirebaseUsers, type FirebaseUserListItem } from '../users/actions';
import { AlertTriangle, DollarSign, Printer } from 'lucide-react';
import {
  startOfToday,
  startOfMonth,
  endOfMonth,
  subMonths,
  isWithinInterval,
  differenceInMilliseconds,
  parseISO,
} from 'date-fns';

type RangePreset = "this_month" | "last_month" | "custom";

interface SalaryReportData {
  userId: string;
  userName: string;
  hourlyRate: number;
  totalHours: number;
  payableAmount: number;
}

export default function SalaryReportPage() {
  const [allUsers, setAllUsers] = useState<FirebaseUserListItem[]>([]);
  const [allAttendance, setAllAttendance] = useState<AttendanceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedRangeType, setSelectedRangeType] = useState<RangePreset>("this_month");
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>(startOfMonth(new Date()));
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>(endOfMonth(new Date()));
  
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [usersResult, attendanceResult] = await Promise.all([
        getFirebaseUsers(),
        getAttendanceRecordsFromServer()
      ]);

      if (!usersResult.success || !usersResult.users) {
        throw new Error(usersResult.message || "Failed to load user data.");
      }
      setAllUsers(usersResult.users);

      if (!attendanceResult.success || !attendanceResult.records) {
        throw new Error(attendanceResult.message || "Failed to load attendance records.");
      }
      setAllAttendance(attendanceResult.records);

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
    const today = startOfToday();
    return {
      this_month: { start: startOfMonth(today), end: endOfMonth(today) },
      last_month: { start: startOfMonth(subMonths(today, 1)), end: endOfMonth(subMonths(today, 1)) },
    };
  }, []);

  const handleRangeChange = (value: string) => {
    const rangeType = value as RangePreset;
    setSelectedRangeType(rangeType);
    if (rangeType === "custom") {
        if (!customStartDate || !customEndDate) {
            setCustomStartDate(startOfMonth(new Date()));
            setCustomEndDate(endOfMonth(new Date()));
        }
    } else {
      setCustomStartDate(dateRanges[rangeType].start);
      setCustomEndDate(dateRanges[rangeType].end);
    }
  };

  const salaryReport = useMemo((): SalaryReportData[] => {
    if (isLoading || !customStartDate || !customEndDate) return [];

    const usersWithRate = allUsers.filter(user => typeof user.profileData?.hourlyRate === 'number' && user.profileData.hourlyRate > 0);
    const report: SalaryReportData[] = [];

    const interval = { start: customStartDate, end: new Date(customEndDate.getTime() + 86399999) }; // Include full end day

    for (const user of usersWithRate) {
      const userAttendance = allAttendance.filter(
        record =>
          record.userId === user.uid &&
          record.status === 'clocked-out' &&
          record.clockOutTime &&
          isWithinInterval(parseISO(record.clockInTime), interval)
      );

      let totalMilliseconds = 0;
      for (const record of userAttendance) {
        if (!record.clockOutTime) continue;
        totalMilliseconds += differenceInMilliseconds(parseISO(record.clockOutTime), parseISO(record.clockInTime));
      }

      if (totalMilliseconds > 0) {
        const totalHours = totalMilliseconds / (1000 * 60 * 60);
        const hourlyRate = user.profileData!.hourlyRate!;
        
        report.push({
          userId: user.uid,
          userName: user.profileData?.fullName || user.email || 'Unknown User',
          hourlyRate: hourlyRate,
          totalHours: totalHours,
          payableAmount: totalHours * hourlyRate,
        });
      }
    }
    return report;
  }, [allUsers, allAttendance, isLoading, customStartDate, customEndDate]);

  const formatHours = (hours: number): string => {
    const h = Math.floor(hours);
    const m = Math.floor((hours * 60) % 60);
    return `${h}h ${m}m`;
  };

  const handlePrint = () => window.print();
  
  const grandTotalPayable = useMemo(() => salaryReport.reduce((sum, item) => sum + item.payableAmount, 0), [salaryReport]);

  return (
    <Card className="shadow-md print:shadow-none print:border-none">
      <CardHeader className="print:hidden">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <CardTitle className="text-2xl flex items-center">
              <DollarSign className="mr-2 h-6 w-6 text-primary" /> Salary Report
            </CardTitle>
            <CardDescription>Calculate employee salaries based on worked hours from attendance records.</CardDescription>
          </div>
          <Button onClick={handlePrint} variant="outline" size="sm">
            <Printer className="mr-2 h-4 w-4" /> Print Report
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-col sm:flex-row gap-4 items-center p-4 border rounded-lg bg-muted/30 print:hidden">
          <div className="flex-1 w-full sm:w-auto">
            <label htmlFor="range-select" className="block text-sm font-medium mb-1">Select Time Range</label>
            <Select value={selectedRangeType} onValueChange={handleRangeChange}>
              <SelectTrigger id="range-select" className="w-full">
                <SelectValue placeholder="Select range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="this_month">This Month</SelectItem>
                <SelectItem value="last_month">Last Month</SelectItem>
                <SelectItem value="custom">Custom Range</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 w-full sm:w-auto">
            <label htmlFor="start-date" className="block text-sm font-medium mb-1">Start Date</label>
            <DatePicker date={customStartDate} setDate={setCustomStartDate} placeholder="Select start date" disabled={selectedRangeType !== 'custom'} />
          </div>
          <div className="flex-1 w-full sm:w-auto">
            <label htmlFor="end-date" className="block text-sm font-medium mb-1">End Date</label>
            <DatePicker date={customEndDate} setDate={setCustomEndDate} placeholder="Select end date" disabled={selectedRangeType !== 'custom'} />
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
                Salary calculations for the selected period. Only users with a set hourly rate are shown.
              </TableCaption>
              <TableHeader className="sticky top-0 bg-background z-10 print:static print:bg-transparent">
                <TableRow>
                  <TableHead>User Name</TableHead>
                  <TableHead className="text-right">Hourly Rate (₹)</TableHead>
                  <TableHead className="text-right">Total Hours Worked</TableHead>
                  <TableHead className="text-right">Payable Amount (₹)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {salaryReport.length > 0 ? (
                  salaryReport.map((row) => (
                    <TableRow key={row.userId}>
                      <TableCell className="font-medium">{row.userName}</TableCell>
                      <TableCell className="text-right">₹{row.hourlyRate.toFixed(2)}</TableCell>
                      <TableCell className="text-right">{formatHours(row.totalHours)}</TableCell>
                      <TableCell className="text-right font-semibold">₹{row.payableAmount.toFixed(2)}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                      No salary data to report for this period. Ensure users have hourly rates set and completed attendance records.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
              {salaryReport.length > 0 && (
                 <TableFooter className="print:bg-transparent">
                    <TableRow className="font-bold bg-muted/50 hover:bg-muted/60 print:bg-transparent text-base">
                        <TableCell colSpan={3}>Grand Total</TableCell>
                        <TableCell className="text-right">₹{grandTotalPayable.toFixed(2)}</TableCell>
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
