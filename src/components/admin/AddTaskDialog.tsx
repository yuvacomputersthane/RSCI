
"use client";

import { useState, type Dispatch, type SetStateAction } from 'react';
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import LoadingSpinner from '@/components/LoadingSpinner';
import { PlusCircle, ClipboardList } from 'lucide-react';
import { type FirebaseUserListItem } from '@/app/admin/users/actions';
import { addTask, type AddTaskResult } from '@/app/admin/tasks/actions';
import type { Task } from '@/types/task';

const addTaskFormSchema = z.object({
  title: z.string().min(3, { message: "Task description must be at least 3 characters." }),
  assignedToUid: z.string({ required_error: "Please select a user to assign the task to." }),
});

type AddTaskFormValues = z.infer<typeof addTaskFormSchema>;

interface AddTaskDialogProps {
  isOpen: boolean;
  setIsOpen: Dispatch<SetStateAction<boolean>>;
  onTaskAdded: (task: Task) => void;
  users: FirebaseUserListItem[];
  adminUser: { uid: string; displayName: string };
}

export default function AddTaskDialog({ isOpen, setIsOpen, onTaskAdded, users, adminUser }: AddTaskDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const form = useForm<AddTaskFormValues>({
    resolver: zodResolver(addTaskFormSchema),
    defaultValues: { title: "" },
  });

  const onSubmit = async (values: AddTaskFormValues) => {
    setIsSubmitting(true);
    const selectedUser = users.find(u => u.uid === values.assignedToUid);
    if (!selectedUser) {
        toast({ title: "Error", description: "Selected user not found.", variant: "destructive" });
        setIsSubmitting(false);
        return;
    }

    const taskData = {
        title: values.title,
        assignedToUid: selectedUser.uid,
        assignedToName: selectedUser.profileData?.fullName || selectedUser.email || 'Unknown User',
        assignedByUid: adminUser.uid,
        assignedByName: adminUser.displayName,
    };

    const result: AddTaskResult = await addTask(taskData);

    if (result.success && result.task) {
      toast({ title: "Task Assigned", description: result.message });
      onTaskAdded(result.task);
      form.reset();
      setIsOpen(false);
    } else {
      toast({ title: "Error", description: result.message, variant: "destructive" });
    }
    setIsSubmitting(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <ClipboardList className="mr-2 h-5 w-5 text-primary" /> Assign New Task
          </DialogTitle>
          <DialogDescription>
            Select a user and describe the task. It will appear on their dashboard.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="assignedToUid"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Assign To</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value} disabled={users.length === 0}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={users.length > 0 ? "Select a user..." : "No users available"} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {users.map(user => (
                        <SelectItem key={user.uid} value={user.uid}>
                          {user.profileData?.fullName || user.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Task Description</FormLabel>
                  <FormControl>
                    <Textarea placeholder="e.g., 'Follow up with customer XYZ about their recent repair.'" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline" disabled={isSubmitting}>Cancel</Button>
              </DialogClose>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <LoadingSpinner size={16} className="mr-2" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                {isSubmitting ? "Assigning..." : "Assign Task"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
