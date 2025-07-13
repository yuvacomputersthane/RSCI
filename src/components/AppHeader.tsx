"use client";

import { LogIn, LogOut, Shield, CreditCard, Clock, Sun, Moon, Monitor } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuPortal,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';
import { useTheme } from "next-themes";

interface AppHeaderProps {
  className?: string;
}

export default function AppHeader({ className }: AppHeaderProps) {
  const { user, signOut, loading, isMasterUser } = useAuth();
  const [dateTime, setDateTime] = useState<Date | null>(null);
  const { setTheme } = useTheme();

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
          {isMasterUser && (
            <>
              <Button variant="outline" asChild className="hidden sm:flex">
                <Link href="/">
                  <CreditCard className="mr-2 h-4 w-4" />
                  Billing
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/admin">
                  <Shield className="mr-2 h-4 w-4" />
                  Admin
                </Link>
              </Button>
            </>
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
                  <DropdownMenuContent className="w-56" align="end" forceMount>
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
