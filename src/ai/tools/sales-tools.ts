
'use server';
/**
 * @fileOverview Defines tools for the AI Assistant to query Firestore data.
 * - getAllServicesTool: Retrieves all available services.
 * - getAllUsersTool: Retrieves all registered users.
 * - getAllProductsTool: Retrieves all inventory items (products and assets).
 * - getAllTasksTool: Retrieves all tasks.
 * - getAllAttendanceRecordsTool: Retrieves all attendance records.
 * - getAllCustomersTool: Retrieves all customer profiles.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { getServices } from '@/app/admin/services/actions';
import { getFirebaseUsers } from '@/app/admin/users/actions';
import { getProducts } from '@/app/admin/products/actions';
import { getTasks } from '@/app/admin/tasks/actions';
import { getAttendanceRecordsFromServer } from '@/app/admin/attendance/actions';
import { getCustomers } from '@/app/admin/customers/actions';

// --- ZOD SCHEMAS FOR TOOL OUTPUTS ---

const ServiceSchema = z.object({
  id: z.string(),
  name: z.string(),
  price: z.number(),
  createdAt: z.string(),
  categoryId: z.string().optional(),
  categoryName: z.string().optional(),
});

const UserSchema = z.object({
  uid: z.string(),
  email: z.string().optional(),
  creationTime: z.string(),
  lastSignInTime: z.string(),
  emailVerified: z.boolean(),
  disabled: z.boolean(),
  firestoreStatus: z.string().optional(),
  profileData: z.object({
    fullName: z.string().optional(),
    hourlyRate: z.number().optional(),
  }).optional(),
});

const ProductSchema = z.object({
  id: z.string(),
  name: z.string(),
  price: z.number(),
  purchasePrice: z.number().optional(),
  description: z.string(),
  createdAt: z.string(),
  itemType: z.enum(['Stock', 'Asset']),
  quantity: z.number(),
  categoryId: z.string().optional(),
  categoryName: z.string().optional(),
});

const TaskSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: z.enum(['pending', 'completed']),
  assignedToUid: z.string(),
  assignedToName: z.string(),
  assignedByUid: z.string(),
  assignedByName: z.string(),
  createdAt: z.string(),
  completedAt: z.string().optional(),
});

const AttendanceRecordSchema = z.object({
  id: z.string(),
  userId: z.string(),
  userName: z.string(),
  clockInTime: z.string(),
  clockOutTime: z.string().optional(),
  status: z.enum(['clocked-in', 'clocked-out']),
  duration: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});

const CustomerSchema = z.object({
  id: z.string(),
  fullName: z.string(),
  email: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  notes: z.string().optional(),
  createdAt: z.string(),
});

// --- TOOL DEFINITIONS ---

export const getAllServicesTool = ai.defineTool(
  {
    name: 'getAllServices',
    description: 'Returns a complete list of all services the company offers, sourced from the Firestore database. Use this to find services that may not be present in a given list of invoices, for example, to identify unsold services.',
    outputSchema: z.array(ServiceSchema),
  },
  async () => {
    const result = await getServices();
    if (result.success && result.services) {
      return result.services;
    }
    console.error("Tool getAllServices failed:", result.message);
    return [];
  }
);

export const getAllUsersTool = ai.defineTool(
  {
    name: 'getAllUsers',
    description: 'Returns a complete list of all registered users (employees/salespeople). Use this to get information about users who may not have made any sales in a given period.',
    outputSchema: z.array(UserSchema),
  },
  async () => {
    const result = await getFirebaseUsers();
     if (result.success && result.users) {
      return result.users;
    }
    console.error("Tool getAllUsers failed:", result.message);
    return [];
  }
);


export const getAllProductsTool = ai.defineTool(
  {
    name: 'getAllProducts',
    description: 'Returns a complete list of all inventory items (both Stock and Assets) from the Firestore database. Use this to analyze product sales, profitability (by comparing purchasePrice and price), and stock levels.',
    outputSchema: z.array(ProductSchema),
  },
  async () => {
    const result = await getProducts();
    if (result.success && result.products) {
      return result.products;
    }
    console.error("Tool getAllProducts failed:", result.message);
    return [];
  }
);

export const getAllTasksTool = ai.defineTool(
  {
    name: 'getAllTasks',
    description: 'Returns a complete list of all assigned tasks from Firestore. Use this to analyze employee productivity, see completed vs. pending tasks, etc.',
    outputSchema: z.array(TaskSchema),
  },
  async () => {
    const result = await getTasks();
    if (result.success && result.tasks) {
      return result.tasks;
    }
    console.error("Tool getAllTasks failed:", result.message);
    return [];
  }
);

export const getAllAttendanceRecordsTool = ai.defineTool(
  {
    name: 'getAllAttendanceRecords',
    description: 'Returns a complete list of all attendance records from Firestore. Use this to analyze employee work hours, check who is currently clocked in, etc.',
    outputSchema: z.array(AttendanceRecordSchema),
  },
  async () => {
    const result = await getAttendanceRecordsFromServer();
    if (result.success && result.records) {
      return result.records;
    }
    console.error("Tool getAllAttendanceRecords failed:", result.message);
    return [];
  }
);

export const getAllCustomersTool = ai.defineTool(
  {
    name: 'getAllCustomers',
    description: 'Returns a complete list of all customer profiles from Firestore. Use this to get information about customers, such as their contact details or notes.',
    outputSchema: z.array(CustomerSchema),
  },
  async () => {
    const result = await getCustomers();
    if (result.success && result.customers) {
      return result.customers;
    }
    console.error("Tool getAllCustomers failed:", result.message);
    return [];
  }
);
