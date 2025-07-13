
"use client";

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import AppHeader from '@/components/AppHeader';
import { useAuth } from '@/contexts/AuthContext';
import LoadingSpinner from '@/components/LoadingSpinner';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Menu, Users, ShoppingCart, Settings, ListChecks, LayoutDashboard, BarChart3, BarChartHorizontalBig, TrendingUp, CalendarClock, ClipboardList, DollarSign, Wand2, HardDriveDownload, Building, BookUser } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

const navItems = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/users', label: 'User Management', icon: Users },
  { href: '/admin/customers', label: 'Customer Management', icon: BookUser },
  { href: '/admin/products', label: 'Inventory Management', icon: ShoppingCart },
  { href: '/admin/services', label: 'Service Management', icon: Settings },
  { href: '/admin/categories', label: 'Category Management', icon: ListChecks },
  { href: '/admin/tasks', label: 'Task Management', icon: ClipboardList },
  { href: '/admin/attendance', label: 'Attendance Management', icon: CalendarClock },
  { href: '/admin/salary-report', label: 'Salary Report', icon: DollarSign },
  { href: '/admin/sales-reports', label: 'Sales Reports (Overall)', icon: BarChart3 },
  { href: '/admin/service-sales-report', label: 'Sales by Service', icon: BarChartHorizontalBig },
  { href: '/admin/user-sales-report', label: 'Sales by User', icon: TrendingUp },
  { href: '/admin/company-profile', label: 'Company Profile', icon: Building },
  { href: '/admin/ai-sales-assistant', label: 'AI Sales Assistant', icon: Wand2 },
  { href: '/admin/backup', label: 'Backup Data', icon: HardDriveDownload },
];

const AdminNav = () => {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-1 p-2">
      {navItems.map((item) => (
        <Button
          key={item.label}
          variant={pathname.startsWith(item.href) && (item.href !== '/admin' || pathname === '/admin') ? 'secondary' : 'ghost'}
          className="w-full justify-start"
          asChild
        >
          <Link href={item.href}>
            <item.icon className="mr-2 h-4 w-4" />
            {item.label}
          </Link>
        </Button>
      ))}
    </nav>
  );
};


export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isMasterUser, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // If auth state is loaded and the user is not the master user, redirect.
    if (!loading && !isMasterUser) {
      router.push('/');
    }
  }, [isMasterUser, loading, router]);

  // While checking auth, show a loading state
  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <LoadingSpinner size={48} />
        <p className="ml-4 text-lg text-foreground">Verifying admin access...</p>
      </div>
    );
  }

  // If not master user, show a loading/redirecting state while useEffect redirects
  if (!isMasterUser) {
    return (
       <div className="flex h-screen w-full items-center justify-center bg-background">
        <LoadingSpinner size={48} />
        <p className="ml-4 text-lg text-foreground">Access Denied. Redirecting...</p>
      </div>
    );
  }

  // If checks pass, render the full admin layout
  return (
    <div className="flex flex-col min-h-screen">
      <AppHeader className="print:hidden" />
      <div className="flex-1 grid md:grid-cols-[260px_1fr]">
        <aside className="hidden md:block h-full bg-background border-r print:hidden">
          <ScrollArea className="h-[calc(100vh-4rem)]">
            <AdminNav />
          </ScrollArea>
        </aside>
        <div className="flex flex-col bg-secondary/50">
          <main className="flex-1 p-4 sm:p-6">
            <div className="md:hidden mb-4">
              <Sheet>
                  <SheetTrigger asChild>
                      <Button variant="outline"><Menu className="mr-2 h-4 w-4" /> Admin Menu</Button>
                  </SheetTrigger>
                  <SheetContent side="left" className="p-0 pt-10 w-72">
                      <AdminNav />
                  </SheetContent>
              </Sheet>
            </div>
            {children}
          </main>
           <footer className="py-4 text-center text-xs text-muted-foreground border-t print:hidden">
              © {new Date().getFullYear()} Rising Sun Computers - Admin Panel
            </footer>
        </div>
      </div>
    </div>
  );
}
