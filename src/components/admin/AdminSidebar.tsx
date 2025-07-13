
"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Users, ShoppingCart, Settings, ListChecks, LayoutDashboard, BarChart3, BarChartHorizontalBig, TrendingUp, CalendarClock, ClipboardList, DollarSign, Wand2, HardDriveDownload, Building } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

const navItems = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/users', label: 'User Management', icon: Users },
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

interface AdminSidebarProps {
  className?: string;
}

export default function AdminSidebar({ className }: AdminSidebarProps) {
  const pathname = usePathname();

  return (
    <Card className={cn("h-full w-64 p-4 shadow-lg rounded-r-lg rounded-l-none border-l-0 print:hidden", className)}>
      <CardContent className="p-2">
        <nav className="flex flex-col space-y-2">
          {navItems.map((item) => (
            <Button
              key={item.label}
              variant={pathname.startsWith(item.href) && (item.href !== '/admin' || pathname === '/admin') ? 'default' : 'ghost'}
              className={cn(
                "w-full justify-start transition-all duration-200 ease-in-out hover:shadow-lg hover:scale-[1.02] hover:bg-secondary",
                pathname.startsWith(item.href) && (item.href !== '/admin' || pathname === '/admin') && "bg-primary text-primary-foreground hover:bg-primary/90"
              )}
              asChild
            >
              <Link href={item.href}>
                <item.icon className="mr-2 h-4 w-4" />
                {item.label}
              </Link>
            </Button>
          ))}
        </nav>
      </CardContent>
    </Card>
  );
}
