
'use server';

import { z } from 'zod';
import { db, adminSDKInitializationError } from '@/lib/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import type { Task } from '@/types/task';

// --- SCHEMAS AND TYPES ---

const addTaskSchema = z.object({
  title: z.string().min(3, { message: "Task title must be at least 3 characters." }),
  assignedToUid: z.string().min(1, { message: "You must select a user." }),
  assignedToName: z.string().min(1),
  assignedByUid: z.string().min(1),
  assignedByName: z.string().min(1),
  franchiseId: z.string().optional(),
  franchiseName: z.string().optional(),
});

export interface AddTaskResult {
  success: boolean;
  message: string;
  task?: Task;
}

export interface GetTasksResult {
  success: boolean;
  tasks?: Task[];
  message?: string;
}

export interface TaskActionResult {
  success: boolean;
  message: string;
}

// --- ACTIONS ---

export async function addTask(data: z.infer<typeof addTaskSchema>): Promise<AddTaskResult> {
  if (adminSDKInitializationError) {
    return { success: false, message: adminSDKInitializationError };
  }

  const validation = addTaskSchema.safeParse(data);
  if (!validation.success) {
    const errorMessage = validation.error.flatten().fieldErrors.title?.[0] || 
                         validation.error.flatten().fieldErrors.assignedToUid?.[0] || 
                         "Invalid data provided.";
    return { success: false, message: errorMessage };
  }

  const { title, assignedToUid, assignedToName, assignedByUid, assignedByName, franchiseId, franchiseName } = validation.data;

  try {
    const now = Timestamp.now();
    const taskData: Omit<Task, 'id' | 'createdAt' | 'completedAt'> & { createdAt: Timestamp; completedAt: null } = {
      title,
      assignedToUid,
      assignedToName,
      assignedByUid,
      assignedByName,
      status: 'pending',
      createdAt: now,
      completedAt: null,
      franchiseId: franchiseId || 'head_branch',
      franchiseName: franchiseName || 'Head Branch',
    };

    const taskRef = await db.collection('tasks').add(taskData);

    const newTask: Task = {
      id: taskRef.id,
      title,
      assignedToUid,
      assignedToName,
      assignedByUid,
      assignedByName,
      status: 'pending',
      createdAt: now.toDate().toISOString(),
      franchiseId: taskData.franchiseId,
      franchiseName: taskData.franchiseName,
    };

    return { success: true, message: 'Task added successfully.', task: newTask };
  } catch (error: any) {
    return { success: false, message: `Failed to add task: ${error.message}` };
  }
}

function docToTask(doc: FirebaseFirestore.DocumentSnapshot): Task {
  const data = doc.data()!;
  const createdAtTimestamp = data.createdAt as Timestamp;
  const completedAtTimestamp = data.completedAt as Timestamp | null;

  return {
    id: doc.id,
    title: data.title,
    status: data.status,
    assignedToUid: data.assignedToUid,
    assignedToName: data.assignedToName,
    assignedByUid: data.assignedByUid,
    assignedByName: data.assignedByName,
    createdAt: createdAtTimestamp.toDate().toISOString(),
    completedAt: completedAtTimestamp ? completedAtTimestamp.toDate().toISOString() : undefined,
    franchiseId: data.franchiseId,
    franchiseName: data.franchiseName,
  };
}

export async function getTasks(): Promise<GetTasksResult> {
  if (adminSDKInitializationError) {
    return { success: false, message: adminSDKInitializationError };
  }
  try {
    // Fetch without ordering to avoid needing a composite index.
    const snapshot = await db.collection('tasks').get();
    const tasks = snapshot.docs.map(docToTask);
    
    // Manually sort by date descending in code.
    tasks.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return { success: true, tasks };
  } catch (error: any) {
    // Keep general permission error handling, but the index-specific one is no longer needed.
    if (error.code === 7 || (error.message && error.message.includes('PERMISSION_DENIED'))) {
        return {
            success: false,
            message: `Firestore permission denied. The service account does not have permission to read from the 'tasks' collection. **FIX: Grant the 'Cloud Datastore User' role to your service account in the Google Cloud Console -> IAM.**`,
        };
    }
    return { success: false, message: `Failed to get tasks: ${error.message}` };
  }
}

export async function getTasksForUser(userId: string): Promise<GetTasksResult> {
    if (adminSDKInitializationError) {
        return { success: false, message: adminSDKInitializationError };
    }
    if (!userId) {
        return { success: false, message: 'User ID is required.' };
    }
    try {
        // This now calls the more robust getTasks function that sorts in memory.
        const allTasksResult = await getTasks();

        if (!allTasksResult.success || !allTasksResult.tasks) {
            // Propagate the error message from getTasks() if it fails.
            return { success: false, message: allTasksResult.message || "Failed to retrieve the main task list." };
        }

        // Now, filter the tasks for the specific user in our code.
        const userTasks = allTasksResult.tasks.filter(task => task.assignedToUid === userId);

        return { success: true, tasks: userTasks };
    } catch (error: any) {
        // This is a fallback catch block.
        return { success: false, message: `Failed to get tasks for user: ${error.message}` };
    }
}

export async function updateTaskStatus(taskId: string, newStatus: 'pending' | 'completed'): Promise<TaskActionResult> {
  if (adminSDKInitializationError) {
    return { success: false, message: adminSDKInitializationError };
  }
  try {
    const taskRef = db.collection('tasks').doc(taskId);
    await taskRef.update({
      status: newStatus,
      completedAt: newStatus === 'completed' ? Timestamp.now() : null,
    });
    return { success: true, message: `Task status updated to ${newStatus}.` };
  } catch (error: any) {
    return { success: false, message: `Failed to update task status: ${error.message}` };
  }
}

export async function deleteTask(taskId: string): Promise<TaskActionResult> {
  if (adminSDKInitializationError) {
    return { success: false, message: adminSDKInitializationError };
  }
  try {
    await db.collection('tasks').doc(taskId).delete();
    return { success: true, message: 'Task deleted successfully.' };
  } catch (error: any) {
    return { success: false, message: `Failed to delete task: ${error.message}` };
  }
}
