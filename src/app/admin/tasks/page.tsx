
"use client";

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlusCircle, ClipboardList, AlertTriangle, RefreshCw, Trash2, CheckCircle, Circle, Store } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import LoadingSpinner from '@/components/LoadingSpinner';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

import { getFirebaseUsers, type FirebaseUserListItem } from '@/app/admin/users/actions';
import AddTaskDialog from '@/components/admin/AddTaskDialog';
import { getTasks, deleteTask, updateTaskStatus, type Task } from './actions';
import { getFranchises, type Franchise } from '../franchises/actions';
import { format, formatDistanceToNow } from 'date-fns';

export default function TaskManagementPage() {
  const { user: adminUser } = useAuth();
  const { toast } = useToast();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<FirebaseUserListItem[]>([]);
  const [franchises, setFranchises] = useState<Franchise[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<string | null>(null); // For individual row actions

  const [isAddTaskDialogOpen, setIsAddTaskDialogOpen] = useState(false);
  
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [tasksResult, usersResult, franchisesResult] = await Promise.all([
        getTasks(), 
        getFirebaseUsers(),
        getFranchises()
      ]);

      if (tasksResult.success && tasksResult.tasks) {
        setTasks(tasksResult.tasks);
      } else {
        throw new Error(tasksResult.message || "Failed to load tasks.");
      }

      if (usersResult.success && usersResult.users) {
        setUsers(usersResult.users);
      } else {
        throw new Error(usersResult.message || "Failed to load users.");
      }

      if (franchisesResult.success && franchisesResult.franchises) {
        setFranchises(franchisesResult.franchises);
      } else {
        throw new Error(franchisesResult.message || "Failed to load franchises.");
      }

    } catch (e: any) {
      setError(e.message);
      toast({ title: "Error", description: e.message, variant: "destructive", duration: 15000 });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);
  
  const handleTaskAdded = (newTask: Task) => {
    setTasks(prevTasks => [newTask, ...prevTasks]);
    fetchData();
  };
  
  const handleDeleteTask = async (taskId: string) => {
    if (!window.confirm("Are you sure you want to delete this task?")) return;
    setIsProcessing(taskId);
    const result = await deleteTask(taskId);
    if (result.success) {
      toast({ title: "Task Deleted", description: result.message });
      setTasks(prev => prev.filter(t => t.id !== taskId));
    } else {
      toast({ title: "Error", description: result.message, variant: "destructive" });
    }
    setIsProcessing(null);
  };

  const handleToggleStatus = async (task: Task) => {
    setIsProcessing(task.id);
    const newStatus = task.status === 'pending' ? 'completed' : 'pending';
    const result = await updateTaskStatus(task.id, newStatus);
    if (result.success) {
      toast({ title: "Status Updated", description: result.message });
      fetchData(); // Re-fetch to get updated list with correct timestamps
    } else {
      toast({ title: "Error", description: result.message, variant: "destructive" });
    }
    setIsProcessing(null);
  };

  return (
    <>
      <Card className="shadow-md">
        <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <CardTitle className="text-2xl flex items-center">
              <ClipboardList className="mr-3 h-6 w-6 text-primary" /> Task Management
            </CardTitle>
            <CardDescription>Assign and track tasks for all users.</CardDescription>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
             <Button variant="outline" size="sm" onClick={fetchData} disabled={isLoading}>
                <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
            </Button>
            <Button onClick={() => setIsAddTaskDialogOpen(true)} disabled={isLoading || !adminUser}>
              <PlusCircle className="mr-2 h-4 w-4" /> Add New Task
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <LoadingSpinner size={32} /><p className="ml-2 text-muted-foreground">Loading tasks and users...</p>
            </div>
          ) : error ? (
            <div className="p-4 my-4 text-sm text-destructive-foreground bg-destructive rounded-md flex items-center">
              <AlertTriangle className="h-5 w-5 mr-2" /> {error}
            </div>
          ) : tasks.length === 0 ? (
            <div className="mt-6 border border-dashed rounded-lg p-8 text-center">
              <p className="text-sm text-muted-foreground">No tasks found. Click "Add New Task" to get started.</p>
            </div>
          ) : (
            <ScrollArea className="h-[60vh] rounded-md border">
              <Table>
                <TableCaption>A list of all assigned tasks.</TableCaption>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow>
                    <TableHead>Task</TableHead>
                    <TableHead>Assigned To</TableHead>
                    <TableHead>Franchise</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Assigned By</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tasks.map(task => (
                    <TableRow key={task.id} className={isProcessing === task.id ? 'opacity-50' : ''}>
                      <TableCell className="font-medium max-w-sm truncate" title={task.title}>{task.title}</TableCell>
                      <TableCell>{task.assignedToName}</TableCell>
                       <TableCell className="text-xs">
                        <div className="flex items-center gap-2">
                           <Store className="h-3 w-3 text-muted-foreground" />
                           {task.franchiseName || 'N/A'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={task.status === 'completed' ? 'default' : 'secondary'}>
                          {task.status === 'completed' ? 'Completed' : 'Pending'}
                        </Badge>
                      </TableCell>
                      <TableCell>{task.assignedByName}</TableCell>
                      <TableCell title={format(new Date(task.createdAt), 'PPPpp')}>
                        {formatDistanceToNow(new Date(task.createdAt), { addSuffix: true })}
                      </TableCell>
                       <TableCell className="text-right">
                        {isProcessing === task.id ? <LoadingSpinner size={16} /> : (
                          <div className="flex justify-end gap-2">
                            <Button 
                              size="sm" 
                              variant="outline" 
                              onClick={() => handleToggleStatus(task)}
                              title={task.status === 'pending' ? "Mark as completed" : "Mark as pending"}
                              className="h-8 w-8 p-0"
                            >
                              {task.status === 'pending' ? <CheckCircle className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
                            </Button>
                            <Button 
                              size="sm" 
                              variant="destructive" 
                              onClick={() => handleDeleteTask(task.id)}
                              title="Delete task"
                              className="h-8 w-8 p-0"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
      {adminUser && (
        <AddTaskDialog
            isOpen={isAddTaskDialogOpen}
            setIsOpen={setIsAddTaskDialogOpen}
            onTaskAdded={handleTaskAdded}
            users={users}
            franchises={franchises}
            adminUser={{ uid: adminUser.uid, displayName: adminUser.displayName || adminUser.email! }}
        />
      )}
    </>
  );
}
