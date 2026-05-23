export interface User {
  id: string;
  name: string;
  nickname: string;
  deviceId: string;
  morningDeadline: string;
  afternoonDeadline: string;
}

export interface AttendanceRecord {
  id: string;
  userId: string;
  date: string;
  checkIn: string | null;
  checkOut: string | null;
  checkInPhoto: string | null;
  checkOutPhoto: string | null;
  status: 'unchecked' | 'checked' | 'late' | 'leave' | 'vacation';
}

export interface LeaveRecord {
  id: string;
  userId: string;
  type: 'annual' | 'sick' | 'personal' | 'other';
  startDate: string;
  endDate: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}

export interface MonthlyStatistics {
  month: string;
  workDays: number;
  attendDays: number;
  lateCount: number;
  earlyCount: number;
  absentCount: number;
  leaveDays: number;
  vacationDays: number;
}

export type LeaveType = 'annual' | 'sick' | 'personal' | 'other';
export type AttendanceStatus = 'unchecked' | 'checked' | 'late' | 'leave' | 'vacation';
export type LeaveStatus = 'pending' | 'approved' | 'rejected';
