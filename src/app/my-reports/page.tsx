
"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import AppHeader from '@/components/AppHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import LoadingSpinner from '@/components/LoadingSpinner';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { getUserAttendanceRecords, type AttendanceRecord } from '@/app/admin/attendance/actions';
import { AlertTriangle, Calendar, DollarSign, UserCheck } from 'lucide-react';
import { format, formatDistance, isSameMonth, parseISO } from 'date-fns';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function MyReportsPage() {
  const { user, userProfile, loading: authLoading } = useAuth();
  const { toast } = useToast();
  
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMyData = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    setError(null);
    try {
      const attendanceResult = await getUserAttendanceRecords(user.uid);
      if (attendanceResult.success && attendanceResult.records) {
        setAttendanceRecords(attendanceResult.records);
      } else {
        throw new Error(attendanceResult.message || "Failed to load your attendance data.");
      }
    } catch (e: any) {
      setError(e.message);
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    if (!authLoading && user) {
      fetchMyData();
    }
  }, [authLoading, user, fetchMyData]);

  const monthlyRecords = useMemo(() => {
    const now = new Date();
    return attendanceRecords.filter(r => isSameMonth(parseISO(r.clockInTime), now));
  }, [attendanceRecords]);

  if (authLoading || isLoading) {
    return (
      <div className="flex flex-col min-h-screen items-center justify-center bg-background">
        <LoadingSpinner size={48} />
        <p className="mt-4 text-lg text-foreground">Loading your reports...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-secondary/50">
      <AppHeader />
      <main className="flex-grow container mx-auto p-4 md:p-6 lg:p-8">
        <div className="space-y-2 mb-6">
            <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
                <UserCheck className="h-8 w-8 text-primary" />
                My Reports
            </h1>
            <p className="text-muted-foreground">
                Your personal attendance and salary information for this month.
            </p>
        </div>
        <Tabs defaultValue="attendance" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="attendance"><Calendar className="mr-2 h-4 w-4"/>Monthly Attendance</TabsTrigger>
            <TabsTrigger value="salary"><DollarSign className="mr-2 h-4 w-4"/>My Salary</TabsTrigger>
          </TabsList>
          
          <TabsContent value="attendance" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>My Attendance - {format(new Date(), 'MMMM yyyy')}</CardTitle>
                <CardDescription>A log of your clock-in and clock-out activities for the current month.</CardDescription>
              </CardHeader>
              <CardContent>
                {error ? (
                  <div className="p-4 my-4 text-sm text-destructive-foreground bg-destructive rounded-md flex items-center">
                    <AlertTriangle className="h-5 w-5 mr-2" />
                    {error}
                  </div>
                ) : (
                  <ScrollArea className="h-[60vh] rounded-md border">
                    <Table>
                      <TableCaption>Your attendance records.</TableCaption>
                      <TableHeader className="sticky top-0 bg-background z-10">
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Clock In</TableHead>
                          <TableHead>Clock Out</TableHead>
                          <TableHead>Duration</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {monthlyRecords.length > 0 ? (
                          monthlyRecords.map((record) => (
                            <TableRow key={record.id}>
                              <TableCell>{format(parseISO(record.clockInTime), 'PPP')}</TableCell>
                              <TableCell>{format(parseISO(record.clockInTime), 'p')}</TableCell>
                              <TableCell>{record.clockOutTime ? format(parseISO(record.clockOutTime), 'p') : '—'}</TableCell>
                              <TableCell>{record.duration || 'Active'}</TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={4} className="h-24 text-center">No attendance records for this month.</TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="salary" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>My Salary Information</CardTitle>
                <CardDescription>Your current monthly salary information on record.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {userProfile?.monthlySalary && userProfile.monthlySalary > 0 ? (
                    <div className="border rounded-lg p-6 flex items-center justify-between bg-green-50 dark:bg-green-900/20">
                        <div>
                            <p className="text-sm text-green-800 dark:text-green-300">Your current monthly salary is:</p>
                            <p className="text-4xl font-bold text-green-700 dark:text-green-400">₹{userProfile.monthlySalary.toFixed(2)}</p>
                        </div>
                        <DollarSign className="h-16 w-16 text-green-600/30 dark:text-green-500/30" />
                    </div>
                ) : (
                    <div className="border rounded-lg p-6 text-center bg-muted/50">
                        <DollarSign className="h-12 w-12 text-muted-foreground mx-auto mb-4"/>
                        <p className="font-semibold">No Salary Information</p>
                        <p className="text-sm text-muted-foreground">Your monthly salary has not been set by an administrator yet.</p>
                    </div>
                )}
                 <p className="text-xs text-muted-foreground text-center pt-4">This information is confidential. Please contact an admin if you believe there is a discrepancy.</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
      <footer className="py-6 text-center text-sm text-muted-foreground border-t">
        © {new Date().getFullYear()} Rising Sun Computers. All rights reserved.
      </footer>
    </div>
  );
}
