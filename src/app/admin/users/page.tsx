
"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useForm, type SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { PlusCircle, Users, Mail, Lock, AlertTriangle, RefreshCw, Trash2, UserCog, CheckCircle, XCircle, MoreHorizontal, UserCheck, UserX, ThumbsUp, ThumbsDown, Hourglass, Edit, Search, User, DollarSign, Store, KeyRound, Shield, ListChecks } from 'lucide-react';
import { 
  createUserInFirebase, type CreateUserResult, 
  getFirebaseUsers, type FirebaseUserListItem, type GetUsersResult, 
  deleteFirebaseUser, toggleUserDisabledStatus, type UserActionResult,
  updateUserProfileStatus 
} from './actions';
import { getAttendanceRecordsFromServer } from '../attendance/actions';
import { getFranchises, type Franchise } from '../franchises/actions';
import { type PermissionModule, PERMISSION_MODULES } from '@/types/user';
import LoadingSpinner from '@/components/LoadingSpinner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from '@/contexts/AuthContext';
import EditUserDialog from '@/components/admin/EditUserDialog';
import ChangePasswordDialog from '@/components/admin/ChangePasswordDialog';
import { isToday, differenceInMilliseconds, parseISO } from 'date-fns';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';


const createUserSchema = z.object({
  fullName: z.string().min(2, { message: "Full name must be at least 2 characters." }),
  email: z.string().email({ message: "Invalid email address." }),
  password: z.string().min(6, { message: "Password must be at least 6 characters." }),
  confirmPassword: z.string().min(6, { message: "Password must be at least 6 characters." }),
  role: z.enum(['admin', 'user'], { required_error: "Please select a user role."}),
  monthlySalary: z.preprocess(
    (val) => (val === "" || val === null || val === undefined ? undefined : parseFloat(String(val))),
    z.number().nonnegative({ message: "Monthly salary must be 0 or a positive number." }).optional()
  ),
  franchiseId: z.string().optional(),
  modulePermissions: z.array(z.string()).optional(),
}).refine(data => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
});


type CreateUserFormValues = z.infer<typeof createUserSchema>;

export default function UserManagementPage() {
  const [isSubmittingCreate, setIsSubmittingCreate] = useState(false);
  const { toast } = useToast();
  const { user: currentUser } = useAuth(); 

  const [allUsers, setAllUsers] = useState<FirebaseUserListItem[]>([]);
  const [allAttendance, setAllAttendance] = useState<Awaited<ReturnType<typeof getAttendanceRecordsFromServer>>['records']>([]);
  const [franchises, setFranchises] = useState<Franchise[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorLoading, setErrorLoading] = useState<string | null>(null);

  const [isProcessingAction, setIsProcessingAction] = useState<string | null>(null); 
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<FirebaseUserListItem | null>(null);

  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [userToEdit, setUserToEdit] = useState<FirebaseUserListItem | null>(null);

  const [isChangePasswordDialogOpen, setIsChangePasswordDialogOpen] = useState(false);
  const [userToChangePassword, setUserToChangePassword] = useState<FirebaseUserListItem | null>(null);
  
  const [todaysWorkHours, setTodaysWorkHours] = useState<Map<string, number>>(new Map());
  const [searchTerm, setSearchTerm] = useState('');


  const form = useForm<CreateUserFormValues>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      fullName: "",
      email: "",
      password: "",
      confirmPassword: "",
      role: "user",
      monthlySalary: undefined,
      franchiseId: "head_branch",
      modulePermissions: [],
    },
  });
  
  const selectedRole = form.watch("role");

  const fetchUsersAndAttendance = useCallback(async () => {
    setIsLoading(true);
    setErrorLoading(null);
    try {
      const [usersResult, attendanceResult, franchisesResult] = await Promise.all([
        getFirebaseUsers(),
        getAttendanceRecordsFromServer(),
        getFranchises(),
      ]);

      if (usersResult.success && usersResult.users) {
        setAllUsers(usersResult.users);
        window.dispatchEvent(new CustomEvent('userListUpdated'));
      } else {
        const message = usersResult.message || "Failed to load users.";
        setErrorLoading(message);
        toast({ title: "Error Loading Users", description: message, variant: "destructive" });
      }

      if (attendanceResult.success && attendanceResult.records) {
        setAllAttendance(attendanceResult.records);
      } else {
        toast({ title: "Warning", description: `Could not load attendance data: ${attendanceResult.message}`, variant: "destructive" });
      }

      if (franchisesResult.success && franchisesResult.franchises) {
        setFranchises(franchisesResult.franchises);
      } else {
        toast({ title: "Warning", description: `Could not load franchises for assignment: ${franchisesResult.message}`, variant: "destructive" });
      }

    } catch (error: any) {
      setErrorLoading(error.message || "An unexpected error occurred.");
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);
  

  useEffect(() => {
    fetchUsersAndAttendance();
    window.addEventListener('attendanceUpdated', fetchUsersAndAttendance);

    return () => {
      window.removeEventListener('attendanceUpdated', fetchUsersAndAttendance);
    };
  }, [fetchUsersAndAttendance]);
  
  useEffect(() => {
    const calculateHours = () => {
        if (!allAttendance || allAttendance.length === 0) return;
        
        const now = new Date();
        const dailyHoursMap = new Map<string, number>();
        const todayRecords = allAttendance.filter(r => isToday(parseISO(r.clockInTime)));

        for (const record of todayRecords) {
            const clockInTime = parseISO(record.clockInTime);
            const endTime = record.status === 'clocked-in' ? now : (record.clockOutTime ? parseISO(record.clockOutTime) : now);
            
            if (endTime < clockInTime) continue;
            
            const durationMs = differenceInMilliseconds(endTime, clockInTime);
            const currentTotal = dailyHoursMap.get(record.userId) || 0;
            dailyHoursMap.set(record.userId, currentTotal + durationMs);
        }
        setTodaysWorkHours(dailyHoursMap);
    };

    calculateHours(); // Initial calculation
    const intervalId = setInterval(calculateHours, 60000); // Recalculate every minute for live update

    return () => clearInterval(intervalId);
  }, [allAttendance]);

  const filteredUsers = useMemo(() => {
    if (!searchTerm) {
      return allUsers;
    }
    const lowercasedFilter = searchTerm.toLowerCase();
    return allUsers.filter(user =>
      (user.profileData?.fullName?.toLowerCase().includes(lowercasedFilter)) ||
      (user.email?.toLowerCase().includes(lowercasedFilter))
    );
  }, [allUsers, searchTerm]);
  
  const totalTodaysWorkHours = useMemo(() => {
      return Array.from(todaysWorkHours.values()).reduce((acc, val) => acc + val, 0);
  }, [todaysWorkHours]);


  const formatDuration = (ms: number): string => {
    if (!ms || ms <= 0) return '—';
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  const onSubmitCreateUser: SubmitHandler<CreateUserFormValues> = async (data) => {
    setIsSubmittingCreate(true);
    try {
        const selectedFranchise = data.franchiseId === 'head_branch' 
            ? { id: 'head_branch', name: 'Head Branch' }
            : franchises.find(f => f.id === data.franchiseId);

        const dataToSend = {
            ...data,
            franchiseId: selectedFranchise?.id,
            franchiseName: selectedFranchise?.name,
            modulePermissions: data.role === 'admin' ? data.modulePermissions : [],
        };

      const result: CreateUserResult = await createUserInFirebase(dataToSend);
      if (result.success) {
        toast({
          title: "User Creation Successful",
          description: result.message,
        });
        form.reset();
        await fetchUsersAndAttendance();
      } else {
        toast({
          title: "User Creation Failed",
          description: result.message,
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error("Create user error:", error);
      toast({
        title: "Error",
        description: error.message || "An unexpected error occurred.",
        variant: "destructive",
      });
    } finally {
      setIsSubmittingCreate(false);
    }
  };

  const handleDeleteConfirmation = (user: FirebaseUserListItem) => {
    if (user.uid === currentUser?.uid) {
      toast({
        title: "Action Denied",
        description: "You cannot delete your own account.",
        variant: "destructive",
      });
      return;
    }
    setUserToDelete(user);
    setIsDeleteDialogOpen(true);
  };

  const executeDeleteUser = async () => {
    if (!userToDelete) return;
    setIsProcessingAction(userToDelete.uid);
    try {
      const result: UserActionResult = await deleteFirebaseUser(userToDelete.uid);
      if (result.success) {
        toast({
          title: "User Deleted",
          description: result.message,
        });
        await fetchUsersAndAttendance();
      } else {
        toast({
          title: "Deletion Failed",
          description: result.message,
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "An unexpected error occurred during deletion.",
        variant: "destructive",
      });
    } finally {
      setIsProcessingAction(null);
      setIsDeleteDialogOpen(false);
      setUserToDelete(null);
    }
  };

  const handleToggleDisable = async (user: FirebaseUserListItem) => {
    if (user.uid === currentUser?.uid && !user.disabled) {
       toast({
        title: "Action Denied",
        description: "You cannot disable your own active account.",
        variant: "destructive",
      });
      return;
    }
    setIsProcessingAction(user.uid);
    try {
      const result = await toggleUserDisabledStatus(user.uid, user.disabled);
      if (result.success) {
        toast({
          title: "User Status Updated",
          description: result.message,
        });
        await fetchUsersAndAttendance();
      } else {
        toast({
          title: "Update Failed",
          description: result.message,
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "An unexpected error occurred while updating status.",
        variant: "destructive",
      });
    } finally {
      setIsProcessingAction(null);
    }
  };

  const handleUpdateProfileStatus = async (userId: string, newStatus: 'approved' | 'rejected') => {
    setIsProcessingAction(userId);
    try {
      const result = await updateUserProfileStatus(userId, newStatus);
      if (result.success) {
        toast({
          title: "Profile Status Updated",
          description: result.message,
        });
        await fetchUsersAndAttendance();
      } else {
        toast({
          title: "Profile Update Failed",
          description: result.message,
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "An unexpected error occurred while updating profile status.",
        variant: "destructive",
      });
    } finally {
      setIsProcessingAction(null);
    }
  };

  const handleEditUser = (user: FirebaseUserListItem) => {
    setUserToEdit(user);
    setIsEditDialogOpen(true);
  };
  
  const handleChangePassword = (user: FirebaseUserListItem) => {
    setUserToChangePassword(user);
    setIsChangePasswordDialogOpen(true);
  };

  const getProfileStatusBadgeVariant = (status?: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case 'approved':
        return 'default';
      case 'pending_approval':
        return 'secondary';
      case 'rejected':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  const getProfileStatusText = (status?: string): string => {
    switch (status) {
      case 'approved':
        return 'Approved';
      case 'pending_approval':
        return 'Pending Approval';
      case 'rejected':
        return 'Rejected';
      default:
        return 'No Profile / N/A';
    }
  };


  return (
    <div className="space-y-6">
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle className="text-2xl flex items-center"><UserCog className="mr-2 h-6 w-6 text-primary"/>User Management</CardTitle>
          <CardDescription>Create new employee accounts for Rising Sun Computers. All fields are required.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmitCreateUser)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="fullName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center"><User className="mr-2 h-4 w-4 text-muted-foreground"/>Full Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Jane Doe" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                 <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center"><Mail className="mr-2 h-4 w-4 text-muted-foreground"/>Login Email</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="new.user@example.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                    control={form.control}
                    name="role"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center"><Shield className="mr-2 h-4 w-4 text-muted-foreground" />User Role</FormLabel>
                         <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a role" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="user">Basic Billing User</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
              </div>

               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center"><Lock className="mr-2 h-4 w-4 text-muted-foreground"/>Password</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="••••••••" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                 <FormField
                    control={form.control}
                    name="confirmPassword"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel className="flex items-center"><Lock className="mr-2 h-4 w-4 text-muted-foreground"/>Confirm Password</FormLabel>
                        <FormControl>
                            <Input type="password" placeholder="••••••••" {...field} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                 />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-start">
                 <FormField
                    control={form.control}
                    name="monthlySalary"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center"><DollarSign className="mr-2 h-4 w-4 text-muted-foreground" />Monthly Salary (₹)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number"
                            step="0.01"
                            placeholder="e.g., 50000.00"
                            {...field}
                            value={field.value ?? ''}
                            onChange={(e) => field.onChange(e.target.value === '' ? undefined : parseFloat(e.target.value))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                <FormField
                  control={form.control}
                  name="franchiseId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center"><Store className="mr-2 h-4 w-4 text-muted-foreground" />Franchise Assignment</FormLabel>
                       <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a franchise" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="head_branch">Head Branch</SelectItem>
                          {franchises.map(franchise => (
                            <SelectItem key={franchise.id} value={franchise.id}>
                              {franchise.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

               {selectedRole === 'admin' && (
                  <FormField
                    control={form.control}
                    name="modulePermissions"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center"><ListChecks className="mr-2 h-4 w-4" /> Module Permissions</FormLabel>
                        <div className="p-4 border rounded-md grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                          {(Object.keys(PERMISSION_MODULES) as PermissionModule[]).map((moduleKey) => (
                            <FormField
                              key={moduleKey}
                              control={form.control}
                              name="modulePermissions"
                              render={({ field }) => {
                                return (
                                  <FormItem
                                    key={moduleKey}
                                    className="flex flex-row items-start space-x-3 space-y-0"
                                  >
                                    <FormControl>
                                      <Checkbox
                                        checked={field.value?.includes(moduleKey)}
                                        onCheckedChange={(checked) => {
                                          return checked
                                            ? field.onChange([...(field.value || []), moduleKey])
                                            : field.onChange(
                                                field.value?.filter(
                                                  (value) => value !== moduleKey
                                                )
                                              )
                                        }}
                                      />
                                    </FormControl>
                                    <FormLabel className="text-sm font-normal">
                                      {PERMISSION_MODULES[moduleKey]}
                                    </FormLabel>
                                  </FormItem>
                                )
                              }}
                            />
                          ))}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}


              <div className="pt-2">
                <Button type="submit" disabled={isSubmittingCreate}>
                  {isSubmittingCreate ? <LoadingSpinner size={16} className="mr-2" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                  {isSubmittingCreate ? "Creating User..." : "Create User"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
      
      <Separator />

      <Card className="shadow-md">
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-xl flex items-center"><Users className="mr-2 h-5 w-5 text-primary"/>Existing Users</CardTitle>
            <CardDescription>List of all registered users and their profile status.</CardDescription>
            <div className="flex items-center text-sm text-muted-foreground pt-2">
              <Hourglass className="mr-2 h-4 w-4" />
              <span>Total Hours Today: <strong>{formatDuration(totalTodaysWorkHours)}</strong></span>
            </div>
          </div>
          <div className="flex w-full sm:w-auto items-center gap-2">
             <div className="relative flex-1 sm:flex-initial">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                type="search"
                placeholder="Search by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 sm:w-[200px] md:w-[250px] h-9"
                />
            </div>
            <Button variant="outline" size="sm" onClick={fetchUsersAndAttendance} disabled={isLoading || !!isProcessingAction}>
              <RefreshCw className={`mr-2 h-4 w-4 ${(isLoading || !!isProcessingAction) ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <LoadingSpinner size={32} />
              <p className="ml-2 text-muted-foreground">Loading users...</p>
            </div>
          ) : errorLoading ? (
            <div className="p-4 my-4 text-sm text-destructive-foreground bg-destructive rounded-md flex items-center">
              <AlertTriangle className="h-5 w-5 mr-2" />
              {errorLoading}
            </div>
          ) : filteredUsers.length === 0 ? (
             <div className="flex flex-col items-center justify-center py-12 text-center">
                <Users className="h-16 w-16 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No users found{searchTerm ? " matching your search" : ""}.</p>
                <p className="text-sm text-muted-foreground">{searchTerm ? "Try a different search term." : "Create a user to see them here."}</p>
              </div>
          ) : (
            <Table>
              <TableCaption>A list of registered users. For more details, refer to Firebase console.</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Franchise</TableHead>
                  <TableHead>Auth Status</TableHead>
                  <TableHead>Profile Status</TableHead>
                  <TableHead>Today's Hours</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => (
                  <TableRow key={user.uid} className={isProcessingAction === user.uid ? 'opacity-50' : ''}>
                    <TableCell className="font-medium">
                      <div className="font-semibold">{user.profileData?.fullName || 'N/A'}</div>
                      <div className="text-xs text-muted-foreground">{user.email || 'N/A'}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.profileData?.role === 'admin' ? 'destructive' : 'secondary'} className="capitalize">
                        {user.profileData?.role || 'user'}
                      </Badge>
                    </TableCell>
                     <TableCell className="text-xs text-muted-foreground">
                      {user.profileData?.franchiseName || 'N/A'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.disabled ? "destructive" : "default"}>
                        {user.disabled ? <XCircle className="inline h-3 w-3 mr-1"/> : <CheckCircle className="inline h-3 w-3 mr-1"/>}
                        {user.disabled ? 'Disabled' : 'Enabled'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getProfileStatusBadgeVariant(user.firestoreStatus)}>
                        {user.firestoreStatus === 'pending_approval' && <Hourglass className="inline h-3 w-3 mr-1"/>}
                        {user.firestoreStatus === 'approved' && <ThumbsUp className="inline h-3 w-3 mr-1"/>}
                        {user.firestoreStatus === 'rejected' && <ThumbsDown className="inline h-3 w-3 mr-1"/>}
                        {getProfileStatusText(user.firestoreStatus)}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {formatDuration(todaysWorkHours.get(user.uid) || 0)}
                    </TableCell>
                    <TableCell className="text-right">
                       {isProcessingAction === user.uid ? (
                        <LoadingSpinner size={16} />
                      ) : (
                        <div className="flex items-center justify-end gap-2">
                          {user.firestoreStatus === 'pending_approval' && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 border-green-500 text-green-600 hover:bg-green-50 hover:text-green-700 dark:border-green-600 dark:text-green-500 dark:hover:bg-green-950 dark:hover:text-green-400"
                                onClick={() => handleUpdateProfileStatus(user.uid, 'approved')}
                              >
                                <ThumbsUp className="mr-2 h-4 w-4" /> Approve
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 border-destructive text-destructive hover:bg-destructive/10"
                                onClick={() => handleUpdateProfileStatus(user.uid, 'rejected')}
                              >
                                <ThumbsDown className="mr-2 h-4 w-4" /> Reject
                              </Button>
                            </>
                          )}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <MoreHorizontal className="h-4 w-4" />
                                <span className="sr-only">Open menu for {user.email}</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>User Actions</DropdownMenuLabel>
                              <DropdownMenuItem onSelect={() => handleEditUser(user)}>
                                <Edit className="mr-2 h-4 w-4" />
                                Edit User Details
                              </DropdownMenuItem>
                              <DropdownMenuItem onSelect={() => handleChangePassword(user)}>
                                <KeyRound className="mr-2 h-4 w-4" />
                                Change Password
                              </DropdownMenuItem>
                              
                              {user.firestoreStatus !== 'pending_approval' && (
                                <DropdownMenuItem
                                  onClick={() => handleToggleDisable(user)}
                                  disabled={user.uid === currentUser?.uid && !user.disabled}
                                >
                                  {user.disabled ? (
                                    <CheckCircle className="mr-2 h-4 w-4" />
                                  ) : (
                                    <XCircle className="mr-2 h-4 w-4" />
                                  )}
                                  {user.disabled ? 'Enable Auth' : 'Disable Auth'}
                                </DropdownMenuItem>
                              )}
                              
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => handleDeleteConfirmation(user)}
                                className="text-destructive focus:text-destructive focus:bg-destructive/10"
                                disabled={user.uid === currentUser?.uid}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete User & Profile
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {userToDelete && (
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the user account for <span className="font-semibold">{userToDelete.email || userToDelete.uid}</span> and their associated profile data from Firestore.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setUserToDelete(null)}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={executeDeleteUser}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete User
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      <EditUserDialog
        user={userToEdit}
        isOpen={isEditDialogOpen}
        setIsOpen={setIsEditDialogOpen}
        onUserUpdated={() => {
          fetchUsersAndAttendance();
          setUserToEdit(null);
        }}
        franchises={franchises}
      />
      
      <ChangePasswordDialog
        user={userToChangePassword}
        isOpen={isChangePasswordDialogOpen}
        setIsOpen={setIsChangePasswordDialogOpen}
      />
    </div>
  );
}
