
"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { LogIn, LogOut, Clock, CheckCircle, Hourglass, RefreshCw } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { clockInOnServer, clockOutOnServer, getUserAttendanceRecords, getActiveSession } from '@/app/admin/attendance/actions';
import { format, isToday, differenceInMilliseconds, parseISO } from 'date-fns';
import type { AttendanceRecord } from '@/types/attendance';
import LoadingSpinner from './LoadingSpinner';

export default function UserAttendance() {
  const [activeSession, setActiveSession] = useState<AttendanceRecord | null>(null);
  const [todaysRecords, setTodaysRecords] = useState<AttendanceRecord[]>([]);
  const [todaysWorkDuration, setTodaysWorkDuration] = useState<string>('0h 0m');
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  const { user } = useAuth();
  const { toast } = useToast();
  
  const fetchAttendanceData = useCallback(async (userId: string) => {
    setIsLoading(true);
    const [activeSessionResult, allRecordsResult] = await Promise.all([
      getActiveSession(userId),
      getUserAttendanceRecords(userId),
    ]);

    if (activeSessionResult.success) {
      setActiveSession(activeSessionResult.record || null);
    } else {
       toast({ title: "Error", description: `Could not fetch active session: ${activeSessionResult.message}`, variant: "destructive" });
    }

    if (allRecordsResult.success && allRecordsResult.records) {
       const today = new Date();
       const filtered = allRecordsResult.records.filter(r => isToday(new Date(r.clockInTime)));
       setTodaysRecords(filtered);
    } else {
        toast({ title: "Error", description: `Could not fetch attendance records: ${allRecordsResult.message}`, variant: "destructive" });
    }
    
    setIsLoading(false);
  }, [toast]);


  useEffect(() => {
    if (user) {
      fetchAttendanceData(user.uid);
    }
  }, [user, fetchAttendanceData]);

  useEffect(() => {
    const calculateTodaysWorkHours = () => {
      if (!user) return;
      const now = new Date();
      let totalMsToday = 0;
      
      for (const record of todaysRecords) {
        const clockInTime = new Date(record.clockInTime);
        const endTime = record.status === 'clocked-in' ? now : (record.clockOutTime ? new Date(record.clockOutTime) : now);
        
        if (endTime < clockInTime) continue;
        
        const durationMs = differenceInMilliseconds(endTime, clockInTime);
        totalMsToday += durationMs;
      }
      
      if (totalMsToday > 0) {
        const totalSeconds = Math.floor(totalMsToday / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        setTodaysWorkDuration(`${hours}h ${minutes}m`);
      } else {
        setTodaysWorkDuration('0h 0m');
      }
    };

    calculateTodaysWorkHours();
    const intervalId = setInterval(calculateTodaysWorkHours, 60000);
    return () => clearInterval(intervalId);
  }, [todaysRecords, user]);
  
  const mostRecentRecord = useMemo(() => {
    if (todaysRecords.length === 0) return null;
    return todaysRecords[0];
  }, [todaysRecords]);


  const handleClockIn = () => {
    if (!user) return;
    setIsProcessing(true);
    toast({ title: "Getting Location", description: "Please allow location access to clock in." });

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        const result = await clockInOnServer(user.uid, user.displayName || user.email || 'Unknown User', { latitude, longitude });
        if (result.success && result.record) {
          toast({ title: "Clocked In!", description: `Your session started at ${format(new Date(result.record.clockInTime), 'p')}.` });
          await fetchAttendanceData(user.uid);
          window.dispatchEvent(new CustomEvent('attendanceUpdated'));
        } else {
           toast({ title: "Clock-In Failed", description: result.message, variant: "destructive" });
        }
        setIsProcessing(false);
      },
      (error) => {
        let errorMessage = "An unknown error occurred while getting your location.";
        switch(error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = "Location access was denied. Please enable it in your browser settings to clock in.";
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = "Location information is unavailable.";
            break;
          case error.TIMEOUT:
            errorMessage = "The request to get user location timed out.";
            break;
        }
        toast({ title: "Location Error", description: errorMessage, variant: "destructive" });
        setIsProcessing(false);
      }
    );
  };

  const handleClockOut = async () => {
    if (!user || !activeSession) return;
    setIsProcessing(true);
    const result = await clockOutOnServer(activeSession.id);
     if (result.success) {
       toast({ title: "Clocked Out!", description: result.message });
       await fetchAttendanceData(user.uid);
       window.dispatchEvent(new CustomEvent('attendanceUpdated'));
    } else {
      toast({ title: "Clock-Out Failed", description: result.message, variant: "destructive" });
    }
    setIsProcessing(false);
  };
  
  if (!user) return null;

  return (
    <Card className="shadow-md">
      <CardHeader className="p-4 flex flex-row items-center justify-between">
        <CardTitle className="text-lg flex items-center">
          <Clock className="mr-2 h-4 w-4 text-primary" /> My Attendance
        </CardTitle>
         <Button 
            variant="ghost" 
            size="sm" 
            className="h-7 w-7 p-0"
            onClick={() => user && fetchAttendanceData(user.uid)}
            disabled={isLoading || isProcessing}
         >
            <RefreshCw className={`h-4 w-4 ${isLoading || isProcessing ? 'animate-spin' : ''}`} />
        </Button>
      </CardHeader>
      <CardContent className="p-4 pt-0 space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center h-[104px]">
             <LoadingSpinner size={24} />
             <p className="ml-2 text-sm text-muted-foreground">Loading...</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={handleClockIn} disabled={!!activeSession || isProcessing} className="h-8 px-2 text-xs">
                  <LogIn className="mr-1.5 h-3 w-3" /> Clock In
              </Button>
              <Button onClick={handleClockOut} variant="destructive" disabled={!activeSession || isProcessing} className="h-8 px-2 text-xs">
                  <LogOut className="mr-1.5 h-3 w-3" /> Clock Out
              </Button>
            </div>
            
            <Separator />
            
            <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                    <p className="text-muted-foreground">Status</p>
                    {activeSession ? (
                        <Badge variant="default">
                            <Hourglass className="mr-1.5 h-3 w-3 animate-spin" />
                            Clocked In
                        </Badge>
                    ) : (
                        <Badge variant="secondary">
                            <CheckCircle className="mr-1.5 h-3 w-3" />
                            Clocked Out
                        </Badge>
                    )}
                </div>
                
                <div className="flex items-center justify-between">
                    <p className="text-muted-foreground">Hours Today</p>
                    <p className="font-semibold font-mono">{todaysWorkDuration}</p>
                </div>

                <div className="flex items-center justify-between">
                    <p className="text-muted-foreground">Last Clock-In</p>
                    <p className="text-muted-foreground">
                        {mostRecentRecord ? format(new Date(mostRecentRecord.clockInTime), 'p, MMM d') : 'N/A'}
                    </p>
                </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
