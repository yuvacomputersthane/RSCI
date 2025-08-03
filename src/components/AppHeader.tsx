
"use client";

import { LogIn, LogOut, Shield, CreditCard, Clock, Sun, Moon, Monitor, BookUser, FilePlus, Hourglass, CheckCircle, UserCheck } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuPortal,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { cn } from '@/lib/utils';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTheme } from "next-themes";
import { getActiveSession, getUserAttendanceRecords, type AttendanceRecord } from '@/app/admin/attendance/actions';
import { isToday, differenceInMilliseconds, parseISO } from 'date-fns';

interface AppHeaderProps {
  className?: string;
}

export default function AppHeader({ className }: AppHeaderProps) {
  const { user, signOut, loading, isAdmin, userProfile } = useAuth();
  const [dateTime, setDateTime] = useState<Date | null>(null);
  const { setTheme } = useTheme();

  const [activeSession, setActiveSession] = useState<AttendanceRecord | null>(null);
  const [todaysRecords, setTodaysRecords] = useState<AttendanceRecord[]>([]);
  const [todaysWorkDuration, setTodaysWorkDuration] = useState<string>('0h 0m');
  const [isAttendanceLoading, setIsAttendanceLoading] = useState(false);

  const fetchAttendanceData = useCallback(async (userId: string) => {
    setIsAttendanceLoading(true);
    const [activeSessionResult, allRecordsResult] = await Promise.all([
      getActiveSession(userId),
      getUserAttendanceRecords(userId),
    ]);

    if (activeSessionResult.success) {
      setActiveSession(activeSessionResult.record || null);
    }

    if (allRecordsResult.success && allRecordsResult.records) {
       const today = new Date();
       const filtered = allRecordsResult.records.filter(r => isToday(parseISO(r.clockInTime)));
       setTodaysRecords(filtered);
    }
    setIsAttendanceLoading(false);
  }, []);

  useEffect(() => {
    if (user && !isAttendanceLoading) {
      fetchAttendanceData(user.uid);
    }
     // Don't include isAttendanceLoading in dependency array to avoid re-fetching while loading
     // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, fetchAttendanceData]);
  
  useEffect(() => {
    const calculateTodaysWorkHours = () => {
      if (!user) return;
      const now = new Date();
      let totalMsToday = 0;
      
      for (const record of todaysRecords) {
        const clockInTime = parseISO(record.clockInTime);
        const endTime = record.status === 'clocked-in' ? now : (record.clockOutTime ? parseISO(record.clockOutTime) : now);
        
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
    
    // Listen for attendance updates from other components
    const handleAttendanceUpdate = () => {
        if (user) fetchAttendanceData(user.uid);
    };
    window.addEventListener('attendanceUpdated', handleAttendanceUpdate);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener('attendanceUpdated', handleAttendanceUpdate);
    };
  }, [todaysRecords, user, fetchAttendanceData]);


  useEffect(() => {
    // Set initial time on client mount to avoid hydration mismatch
    setDateTime(new Date());

    const timer = setInterval(() => {
      setDateTime(new Date()); // Update every second
    }, 1000);

    return () => {
      clearInterval(timer); // Cleanup interval on component unmount
    };
  }, []); // Empty dependency array ensures this runs only on the client side

  const getInitials = (name?: string | null, email?: string | null) => {
    if (name) {
      const names = name.split(' ');
      if (names.length > 1) {
        return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
      }
      return name.substring(0, 2).toUpperCase();
    }
    if (email) {
      return email.substring(0, 2).toUpperCase();
    }
    return "U";
  };


  return (
    <header className={cn(
      "sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur-sm",
      className
      )}>
      <div className="container mx-auto flex h-16 items-center justify-between space-x-4 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2 sm:gap-4">
           <Link href="/" className="flex items-center gap-2 font-semibold text-foreground">
              <CreditCard className="h-6 w-6 text-primary" />
              <h1 className="text-lg sm:text-xl font-bold tracking-tight">Rising Sun Computers</h1>
          </Link>
        </div>
        
        <div className="flex flex-1 items-center justify-end space-x-4">
          
          {dateTime && (
             <div className="hidden lg:flex items-start gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4 mt-1 shrink-0" />
              <div className="flex flex-col leading-tight">
                <span>
                  {dateTime.toLocaleDateString(undefined, {
                    weekday: 'short',
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
                <span className="text-xs text-muted-foreground/90">
                  {dateTime.toLocaleTimeString()}
                </span>
              </div>
            </div>
          )}
          {user && (isAdmin || userProfile?.status === 'approved') && (
            <>
              <Button variant="outline" asChild>
                  <Link href="/">
                      <FilePlus className="mr-2 h-4 w-4" />
                      New Invoice
                  </Link>
              </Button>
              {!isAdmin && (
                <Button variant="outline" asChild>
                    <Link href="/credit">
                        <BookUser className="mr-2 h-4 w-4" />
                        Customer Credit Invoice
                    </Link>
                </Button>
              )}
            </>
          )}

          {isAdmin && (
              <Button variant="outline" asChild>
                <Link href="/admin">
                  <Shield className="mr-2 h-4 w-4" />
                  Admin Panel
                </Link>
              </Button>
          )}

          {loading ? (
            <div className="h-10 w-10 animate-pulse bg-muted rounded-full"></div>
          ) : user ? (
             <div className="flex items-center space-x-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                      <Avatar className="h-9 w-9">
                        {user.photoURL && <AvatarImage src={user.photoURL} alt={user.displayName || user.email || 'User Avatar'} />}
                        <AvatarFallback className="bg-primary text-primary-foreground font-semibold">
                          {getInitials(user.displayName, user.email)}
                        </AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-64" align="end" forceMount>
                    <DropdownMenuLabel className="font-normal">
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none">
                          {user.displayName || user.email?.split('@')[0]}
                        </p>
                        <p className="text-xs leading-none text-muted-foreground">
                          {user.email}
                        </p>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                     <div className="px-2 py-1.5 text-xs text-muted-foreground space-y-1.5">
                       <div className="flex items-center justify-between">
                            <span className="flex items-center gap-2"><Clock className="h-3 w-3" /> Status</span>
                            {activeSession ? (
                                <span className="font-semibold text-green-600 flex items-center gap-1.5"><Hourglass className="h-3 w-3 animate-spin"/> Clocked In</span>
                            ) : (
                                <span className="font-semibold flex items-center gap-1.5"><CheckCircle className="h-3 w-3"/> Clocked Out</span>
                            )}
                       </div>
                       <div className="flex items-center justify-between">
                           <span className="flex items-center gap-2"><Clock className="h-3 w-3" /> Hours Today</span>
                           <span className="font-semibold font-mono">{todaysWorkDuration}</span>
                       </div>
                     </div>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                        <Link href="/my-reports">
                            <UserCheck className="mr-2 h-4 w-4" />
                            <span>My Reports</span>
                        </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger>
                        <Sun className="mr-2 h-4 w-4" />
                        <span>Theme</span>
                      </DropdownMenuSubTrigger>
                      <DropdownMenuPortal>
                        <DropdownMenuSubContent>
                          <DropdownMenuItem onClick={() => setTheme("light")}>
                            <Sun className="mr-2 h-4 w-4" />
                            Light
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setTheme("dark")}>
                            <Moon className="mr-2 h-4 w-4" />
                            Dark
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setTheme("system")}>
                            <Monitor className="mr-2 h-4 w-4" />
                            System
                          </DropdownMenuItem>
                        </DropdownMenuSubContent>
                      </DropdownMenuPortal>
                    </DropdownMenuSub>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={signOut}>
                      <LogOut className="mr-2 h-4 w-4" />
                      Log out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
          ) : (
            <div className="flex items-center space-x-4">
              <Button variant="default" asChild>
                <Link href="/login">
                  <LogIn className="mr-2 h-4 w-4" />
                  Login
                </Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
