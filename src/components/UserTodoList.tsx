
"use client";

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { getTasksForUser, updateTaskStatus, type Task } from '@/app/admin/tasks/actions';
import LoadingSpinner from './LoadingSpinner';
import { ClipboardCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { format, formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';


export default function UserTodoList() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchTasks = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    const result = await getTasksForUser(user.uid);
    if (result.success && result.tasks) {
      setTasks(result.tasks);
    } else {
      toast({
        title: "Error Loading Tasks",
        description: result.message,
        variant: "destructive",
        duration: 15000,
      });
    }
    setIsLoading(false);
  }, [user, toast]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const handleTaskToggle = async (task: Task) => {
    const newStatus = task.status === 'pending' ? 'completed' : 'pending';
    // Optimistically update UI
    setTasks(currentTasks => 
        currentTasks.map(t => t.id === task.id ? {...t, status: newStatus} : t)
    );

    const result = await updateTaskStatus(task.id, newStatus);
    if (!result.success) {
      // Revert on failure
      setTasks(currentTasks => 
        currentTasks.map(t => t.id === task.id ? {...t, status: task.status} : t)
      );
      toast({ title: "Error", description: result.message, variant: "destructive" });
    } else {
        toast({ title: `Task ${newStatus === 'completed' ? 'Completed' : 'Pending' }`, description: `"${task.title}"` });
    }
  };
  
  if (!user) return null;

  return (
    <Card className="shadow-md">
      <CardHeader className="p-4">
        <CardTitle className="text-lg flex items-center">
          <ClipboardCheck className="mr-2 h-4 w-4 text-primary" /> Today's Work
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <LoadingSpinner size={24} />
            <p className="ml-2 text-sm text-muted-foreground">Loading tasks...</p>
          </div>
        ) : tasks.length === 0 ? (
          <div className="text-center py-10 px-4">
            <ClipboardCheck className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <p className="mt-4 text-sm text-muted-foreground">No tasks assigned for today.</p>
            <p className="text-xs text-muted-foreground">When an admin assigns you a task, it will appear here.</p>
            <div className="mt-4 border-t pt-4">
                <p className="text-xs font-semibold text-muted-foreground mb-2">FOR EXAMPLE:</p>
                <div className="flex items-start gap-3 p-3 rounded-md bg-muted/50 text-left">
                    <Checkbox id="demo-task" disabled />
                    <label
                        htmlFor="demo-task"
                        className="text-sm font-medium leading-none text-muted-foreground/80 cursor-not-allowed flex-1"
                    >
                        Follow up with customer XYZ about their recent repair.
                    </label>
                </div>
            </div>
          </div>
        ) : (
          <ScrollArea className="h-64">
            <div className="space-y-4 pr-3">
              {tasks.map(task => (
                <Dialog key={`dialog-${task.id}`}>
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id={`task-${task.id}`}
                      checked={task.status === 'completed'}
                      onCheckedChange={() => handleTaskToggle(task)}
                      className="mt-1"
                      aria-label={`Mark task "${task.title}" as ${task.status === 'completed' ? 'pending' : 'completed'}`}
                    />
                    <DialogTrigger asChild>
                      <label
                        className={cn(
                          "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex-1 hover:text-primary cursor-pointer",
                          task.status === 'completed' && 'line-through text-muted-foreground hover:text-primary/80'
                        )}
                        // The label is clickable for the dialog, but not associated with an input, so we remove htmlFor.
                        // The checkbox handles its own state.
                      >
                        {task.title}
                      </label>
                    </DialogTrigger>
                  </div>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>Task Details</DialogTitle>
                      <DialogDescription className="pt-2 text-base">
                        {task.title}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4 text-sm">
                      <div className="grid grid-cols-[100px_1fr] items-center gap-4">
                        <span className="text-muted-foreground font-semibold">Status</span>
                        <Badge variant={task.status === 'completed' ? 'default' : 'secondary'} className="w-fit">
                          {task.status === 'completed' ? 'Completed' : 'Pending'}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-[100px_1fr] items-center gap-4">
                        <span className="text-muted-foreground font-semibold">Assigned By</span>
                        <span>{task.assignedByName}</span>
                      </div>
                      <div className="grid grid-cols-[100px_1fr] items-center gap-4">
                        <span className="text-muted-foreground font-semibold">Assigned On</span>
                        <span title={format(new Date(task.createdAt), 'PPPpp')}>
                          {formatDistanceToNow(new Date(task.createdAt), { addSuffix: true })}
                        </span>
                      </div>
                      {task.completedAt && (
                        <div className="grid grid-cols-[100px_1fr] items-center gap-4">
                          <span className="text-muted-foreground font-semibold">Completed On</span>
                          <span title={format(new Date(task.completedAt), 'PPPpp')}>
                            {formatDistanceToNow(new Date(task.completedAt), { addSuffix: true })}
                          </span>
                        </div>
                      )}
                    </div>
                  </DialogContent>
                </Dialog>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
