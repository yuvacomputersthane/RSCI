
"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LogIn, LogOut, CalendarClock, Archive, Users, MapPin, RefreshCw, UserSearch } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { clockInOnServer, clockOutOnServer, getAttendanceRecordsFromServer, getActiveSession, type AttendanceRecord } from './actions';
import { getFirebaseUsers, type FirebaseUserListItem } from '../users/actions';
import LoadingSpinner from '@/components/LoadingSpinner';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { format, formatDistanceToNow } from 'date-fns';
import { isToday, differenceInMilliseconds } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function AttendancePage() {
  const [allRecords, setAllRecords] = useState<AttendanceRecord[]>([]);
  const [allUsers, setAllUsers] = useState<FirebaseUserListItem[]>([]);
  const [currentUserActiveSession, setCurrentUserActiveSession] = useState<AttendanceRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [userFilter, setUserFilter] = useState<string>('all');
  const { user } = useAuth();
  const { toast } = useToast();
  const [todaysWorkDuration, setTodaysWorkDuration] = useState('0h 0m');

  const fetchData = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    const [allRecordsResult, activeSessionResult, usersResult] = await Promise.all([
        getAttendanceRecordsFromServer(),
        getActiveSession(user.uid),
        getFirebaseUsers()
    ]);

    if (allRecordsResult.success && allRecordsResult.records) {
        setAllRecords(allRecordsResult.records);
    } else {
        toast({ title: "Error", description: `Could not load attendance history: ${allRecordsResult.message}`, variant: "destructive" });
    }
    
    if (usersResult.success && usersResult.users) {
        setAllUsers(usersResult.users.filter(u => u.firestoreStatus === 'approved'));
    } else {
        toast({ title: "Error", description: `Could not load users: ${usersResult.message}`, variant: "destructive" });
    }

    if (activeSessionResult.success) {
        setCurrentUserActiveSession(activeSessionResult.record || null);
    } else {
        toast({ title: "Error", description: `Could not check your current status: ${activeSessionResult.message}`, variant: "destructive" });
    }
    
    setIsLoading(false);
  }, [user, toast]);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user, fetchData]);
  
  useEffect(() => {
    const calculateTodaysWorkHours = () => {
      if (!user) return;
      const now = new Date();
      let totalMsToday = 0;
      
      const userTodayRecords = allRecords.filter(r => r.userId === user.uid && isToday(new Date(r.clockInTime)));

      for (const record of userTodayRecords) {
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
    const intervalId = setInterval(calculateTodaysWorkHours, 60000); // update every minute
    return () => clearInterval(intervalId);
  }, [allRecords, currentUserActiveSession, user]); // Added currentUserActiveSession dependency

  const filteredRecords = useMemo(() => {
    if (userFilter === 'all') return allRecords;
    return allRecords.filter(record => record.userId === userFilter);
  }, [allRecords, userFilter]);

  const canClockIn = !currentUserActiveSession;
  const canClockOut = !!currentUserActiveSession;

  const handleClockIn = () => {
    if (!user) return;
    setIsProcessing(true);
    toast({ title: "Getting Location", description: "Please allow location access to clock in." });
    
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        const result = await clockInOnServer(user.uid, user.displayName || user.email || "Unknown User", { latitude, longitude });
        
        if (result.success && result.record) {
           toast({ title: "Clocked In!", description: `Your session started at ${format(new Date(result.record.clockInTime), 'p')}.` });
           await fetchData();
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
    if (!user || !currentUserActiveSession) return;
    setIsProcessing(true);
    const result = await clockOutOnServer(currentUserActiveSession.id);
    if (result.success) {
       toast({ title: "Clocked Out!", description: result.message });
       await fetchData();
    } else {
       toast({ title: "Clock-Out Failed", description: result.message, variant: "destructive" });
    }
    setIsProcessing(false);
  };

  if (isLoading && allRecords.length === 0) {
    return (
        <div className="flex items-center justify-center py-8">
        <LoadingSpinner size={32} />
        <p className="ml-2 text-muted-foreground">Loading attendance page...</p>
        </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="shadow-md">
        <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <CardTitle className="text-2xl flex items-center">
              <CalendarClock className="mr-3 h-6 w-6 text-primary" /> Attendance Management
            </CardTitle>
            <CardDescription>View all user records. Clock in/out for your own sessions.</CardDescription>
             <div className="text-sm text-muted-foreground pt-2">
                Your total hours today: <strong className="font-mono text-foreground">{todaysWorkDuration}</strong>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
             <Button onClick={handleClockIn} disabled={!canClockIn || isProcessing}>
                {isProcessing && !canClockIn ? <LoadingSpinner size={16} className="mr-2"/> : <LogIn className="mr-2 h-4 w-4" />}
                Clock In
            </Button>
            <Button onClick={handleClockOut} variant="destructive" disabled={!canClockOut || isProcessing}>
                {isProcessing && canClockOut ? <LoadingSpinner size={16} className="mr-2"/> : <LogOut className="mr-2 h-4 w-4" />}
                Clock Out
            </Button>
             <Button variant="outline" size="icon" onClick={fetchData} disabled={isLoading || isProcessing}>
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
            <div className="p-4 border rounded-lg bg-muted/30 mb-4">
                 <div className="max-w-sm">
                    <label htmlFor="user-filter" className="block text-sm font-medium mb-1 text-muted-foreground flex items-center">
                        <UserSearch className="h-4 w-4 mr-2" />
                        Filter by User
                    </label>
                    <Select value={userFilter} onValueChange={setUserFilter}>
                        <SelectTrigger id="user-filter">
                            <SelectValue placeholder="Select a user..." />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Users</SelectItem>
                            {allUsers.map(u => (
                                <SelectItem key={u.uid} value={u.uid}>{u.profileData?.fullName || u.email}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                 </div>
            </div>
          {isLoading && allRecords.length > 0 ? (
             <div className="flex items-center justify-center py-8">
                <LoadingSpinner size={24} />
                <p className="ml-2 text-muted-foreground">Refreshing records...</p>
            </div>
          ) : filteredRecords.length > 0 ? (
            <ScrollArea className="h-[50vh] rounded-md border">
              <Table>
                <TableCaption>A complete history of all user attendance from Firestore. Latest sessions are shown first.</TableCaption>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Clock In</TableHead>
                    <TableHead>Clock Out</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Location</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRecords.map((record) => (
                    <TableRow key={record.id} className={record.userId === user?.uid ? 'bg-primary/5' : ''}>
                       <TableCell className="font-medium flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground"/>
                        {record.userName}
                       </TableCell>
                       <TableCell>
                        <Badge variant={record.status === 'clocked-in' ? 'default' : 'secondary'}>
                          {record.status === 'clocked-in' ? 'Active' : 'Finished'}
                        </Badge>
                      </TableCell>
                      <TableCell title={format(new Date(record.clockInTime), 'PPpp')}>
                        {formatDistanceToNow(new Date(record.clockInTime), { addSuffix: true })}
                      </TableCell>
                      <TableCell title={record.clockOutTime ? format(new Date(record.clockOutTime), 'PPpp') : 'N/A'}>
                        {record.clockOutTime ? formatDistanceToNow(new Date(record.clockOutTime), { addSuffix: true }) : '—'}
                      </TableCell>
                      <TableCell>{record.duration || (record.status === 'clocked-in' ? 'In Progress' : '—')}</TableCell>
                      <TableCell>
                        {record.latitude && record.longitude ? (
                          <Button
                            variant="link"
                            className="p-0 h-auto font-normal text-xs"
                            asChild
                          >
                            <a
                              href={`https://www.openstreetmap.org/?mlat=${record.latitude}&mlon=${record.longitude}#map=16/${record.latitude}/${record.longitude}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              title={`View location for ${record.userName}'s clock-in`}
                            >
                              <MapPin className="mr-1 h-3 w-3" />
                              View Map
                            </a>
                          </Button>
                        ) : (
                          'N/A'
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          ) : (
            <div className="mt-6 border border-dashed rounded-lg p-8 text-center">
              <Archive className="mx-auto h-12 w-12 text-muted-foreground" />
              <p className="mt-4 text-sm text-muted-foreground">No attendance records found for the selected user.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
