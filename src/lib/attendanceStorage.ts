
"use client";

import type { AttendanceRecord } from '@/types/attendance';
import { formatDistance } from 'date-fns';

const ATTENDANCE_KEY = 'risingSunAttendanceRecords';

export function getAttendanceRecords(): AttendanceRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const recordsJson = localStorage.getItem(ATTENDANCE_KEY);
    const records = recordsJson ? JSON.parse(recordsJson) : [];
    // Sort by clockInTime descending
    return records.sort((a: AttendanceRecord, b: AttendanceRecord) => new Date(b.clockInTime).getTime() - new Date(a.clockInTime).getTime());
  } catch (error) {
    console.error("Failed to parse attendance records from localStorage", error);
    return [];
  }
}

function saveAttendanceRecords(records: AttendanceRecord[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(ATTENDANCE_KEY, JSON.stringify(records));
    window.dispatchEvent(new CustomEvent('attendanceUpdated'));
  } catch (error) {
    console.error("Failed to save attendance records to localStorage", error);
  }
}

export function clockIn(
  userId: string,
  userName: string,
  location: { latitude: number; longitude: number }
): AttendanceRecord {
  const records = getAttendanceRecords();
  const newRecord: AttendanceRecord = {
    id: `ATT-${new Date().getTime()}`,
    userId,
    userName,
    clockInTime: new Date().toISOString(),
    status: 'clocked-in',
    latitude: location.latitude,
    longitude: location.longitude,
  };
  const updatedRecords = [newRecord, ...records];
  saveAttendanceRecords(updatedRecords);
  return newRecord;
}

export function clockOut(recordId: string): AttendanceRecord | undefined {
    const records = getAttendanceRecords();
    const recordIndex = records.findIndex(r => r.id === recordId);
    if (recordIndex > -1) {
        const clockInDate = new Date(records[recordIndex].clockInTime);
        const clockOutDate = new Date();
        const duration = formatDistance(clockOutDate, clockInDate);

        const updatedRecord: AttendanceRecord = {
            ...records[recordIndex],
            clockOutTime: clockOutDate.toISOString(),
            status: 'clocked-out',
            duration,
        };
        records[recordIndex] = updatedRecord;
        saveAttendanceRecords(records);
        return updatedRecord;
    }
    return undefined;
}
