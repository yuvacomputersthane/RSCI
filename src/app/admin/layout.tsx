
"use client";

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import AppHeader from '@/components/AppHeader';
import { useAuth } from '@/contexts/AuthContext';
import LoadingSpinner from '@/components/LoadingSpinner';
import { Button } from '@/components/ui/button';
import { Users, ShoppingCart, Settings, ListChecks, LayoutDashboard, BarChart3, BarChartHorizontalBig, TrendingUp, CalendarClock, ClipboardList, DollarSign, Wand2, HardDriveDownload, Building, BookUser, Store } from 'lucide-react';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { ScrollArea } from '@/components/ui/scroll-area';

const AdminLayout = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const { isAdmin, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !isAdmin) {
      router.push('/');
    }
  }, [isAdmin, loading, router]);

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <LoadingSpinner size={48} />
        <p className="ml-4 text-lg text-foreground">Verifying admin access...</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
       <div className="flex h-screen w-full items-center justify-center bg-background">
        <LoadingSpinner size={48} />
        <p className="ml-4 text-lg text-foreground">Access Denied. Redirecting...</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col">
        <AppHeader className="print:hidden z-50" />
        <div className="flex flex-1 overflow-hidden pt-16">
             <AdminSidebar />
             <ScrollArea className="flex-1">
                <main className="flex-1 p-4 sm:p-6 bg-secondary/50">
                    {children}
                </main>
                <footer className="py-4 text-center text-xs text-muted-foreground border-t print:hidden">
                    © {new Date().getFullYear()} Rising Sun Computers - Admin Panel
                </footer>
             </ScrollArea>
        </div>
    </div>
  );
}

export default AdminLayout;
