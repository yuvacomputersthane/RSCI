
"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Users, ShoppingCart, Settings, ListChecks, LayoutDashboard, BarChart3, BarChartHorizontalBig, TrendingUp, CalendarClock, ClipboardList, DollarSign, Wand2, HardDriveDownload, Building, BookUser, Store, HandCoins } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/contexts/AuthContext';
import type { PermissionModule } from '@/types/user';

interface NavItem {
    href: string;
    label: string;
    icon: React.ElementType;
    permission?: PermissionModule;
}

const navItems: NavItem[] = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/users', label: 'User Management', icon: Users, permission: 'user_management' },
  { href: '/admin/customers', label: 'Customer Management', icon: BookUser, permission: 'customer_management' },
  { href: '/admin/credit', label: 'Credit Invoices', icon: BookUser, permission: 'credit_invoices' },
  { href: '/admin/franchises', label: 'Franchise Management', icon: Store, permission: 'franchise_management' },
  { href: '/admin/products', label: 'Inventory Management', icon: ShoppingCart, permission: 'inventory_management' },
  { href: '/admin/services', label: 'Service Management', icon: Settings, permission: 'service_management' },
  { href: '/admin/categories', label: 'Category Management', icon: ListChecks, permission: 'category_management' },
  { href: '/admin/tasks', label: 'Task Management', icon: ClipboardList, permission: 'task_management' },
  { href: '/admin/attendance', label: 'Attendance Management', icon: CalendarClock, permission: 'attendance_management' },
  { href: '/admin/salary-advances', label: 'Salary Advances', icon: HandCoins, permission: 'salary_advances' },
  { href: '/admin/salary-report', label: 'Salary Report', icon: DollarSign, permission: 'salary_report' },
  { href: '/admin/sales-reports', label: 'Sales Reports (Overall)', icon: BarChart3, permission: 'sales_reports' },
  { href: '/admin/service-sales-report', label: 'Sales by Service', icon: BarChartHorizontalBig, permission: 'sales_reports' },
  { href: '/admin/user-sales-report', label: 'Sales by User', icon: TrendingUp, permission: 'sales_reports' },
  { href: '/admin/company-profile', label: 'Company Profile', icon: Building, permission: 'company_profile' },
  { href: '/admin/ai-sales-assistant', label: 'AI Sales Assistant', icon: Wand2, permission: 'ai_sales_assistant' },
  { href: '/admin/backup', label: 'Backup Data', icon: HardDriveDownload, permission: 'backup_data' },
];

interface AdminSidebarProps {
  className?: string;
}

export default function AdminSidebar({ className }: AdminSidebarProps) {
  const pathname = usePathname();
  const { userProfile, isAdmin } = useAuth();
  
  const masterUid = process.env.NEXT_PUBLIC_MASTER_USER_UID;
  const isMasterUser = userProfile?.userId === masterUid;

  const filteredNavItems = navItems.filter(item => {
    // The master user and admins with no specific permissions set (legacy admins) can see everything.
    if (isMasterUser || (isAdmin && !userProfile?.modulePermissions)) {
        return true;
    }
    // Dashboard is visible to all admins.
    if (item.href === '/admin') {
      return true;
    }
    // Check if the user has the specific permission for the item.
    if (item.permission) {
      return userProfile?.modulePermissions?.includes(item.permission);
    }
    // Fallback for items without a specific permission (should be rare)
    return false;
  });


  return (
      <ScrollArea className={cn("h-full w-64 flex-shrink-0 bg-card print:hidden", className)}>
          <nav className="flex flex-col space-y-1 p-2">
          {filteredNavItems.map((item) => (
              <Button
              key={item.label}
              variant={pathname.startsWith(item.href) && (item.href !== '/admin' || pathname === '/admin') ? 'default' : 'ghost'}
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
      </ScrollArea>
  );
}
