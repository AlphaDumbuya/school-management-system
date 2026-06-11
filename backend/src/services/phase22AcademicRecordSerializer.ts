import { AppError } from '@middleware/errorHandler';
import { logger } from '@utils/logger';

/**
 * Phase 22.2: Academic Record Serializer
 * 
 * Provides JSON serialization for academic records with:
 * - Pretty printing with proper formatting
 * - Filtered export by date range, class, or student
 * - CSV export support
 * - Bulk serialization
 */

export interface AcademicRecord {
  studentId: string;
  classId: string;
  academicYear: string;
  term: string;
  grades: Array<{
    subjectId: string;
    subject: string;
    marks: number;
    maxMarks: number;
    grade: string;
    gradePoints: number;
  }>;
  gpa: number;
  attendance: number;
  behaviorRating?: string;
  comments?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SerializeOptions {
  prettyPrint?: boolean;
  indent?: number;
  excludeFields?: string[];
  dateFormat?: 'iso' | 'local' | 'timestamp';
  filterByDateRange?: { start: Date; end: Date };
  filterByClass?: string;
  filterByStudent?: string;
}

export class AcademicRecordSerializer {
  /**
   * Serializes single record to JSON
   * @param record - Academic record
   * @param options - Serialization options
   */
  static serializeRecord(record: AcademicRecord, options: SerializeOptions = {}): string {
    const processed = this.processRecord(record, options);
    const indent = options.prettyPrint !== false ? (options.indent || 2) : undefined;
    
    return JSON.stringify(processed, null, indent);
  }

  /**
   * Serializes array of records to JSON
   * @param records - Academic records
   * @param options - Serialization options
   */
  static serializeRecords(records: AcademicRecord[], options: SerializeOptions = {}): string {
    const filtered = this.filterRecords(records, options);
    const processed = filtered.map((r) => this.processRecord(r, options));
    const indent = options.prettyPrint !== false ? (options.indent || 2) : undefined;

    return JSON.stringify(processed, null, indent);
  }

  /**
   * Serializes records to CSV format
   * @param records - Academic records
   * @param options - Serialization options
   */
  static serializeToCSV(records: AcademicRecord[], options: SerializeOptions = {}): string {
    const filtered = this.filterRecords(records, options);

    if (filtered.length === 0) {
      return '';
    }

    // CSV headers
    const headers = [
      'Student ID',
      'Class ID',
      'Academic Year',
      'Term',
      'Subject',
      'Marks',
      'Max Marks',
      'Grade',
      'GPA',
      'Attendance',
      'Behavior Rating',
      'Comments',
      'Created At',
      'Updated At',
    ];

    const rows: string[][] = [];

    for (const record of filtered) {
      if (record.grades.length === 0) {
        rows.push([
          this.escapeCSV(record.studentId),
          this.escapeCSV(record.classId),
          record.academicYear,
          record.term,
          '',
          '',
          '',
          '',
          record.gpa.toString(),
          record.attendance.toString(),
          this.escapeCSV(record.behaviorRating || ''),
          this.escapeCSV(record.comments || ''),
          this.formatDate(record.createdAt, options.dateFormat),
          this.formatDate(record.updatedAt, options.dateFormat),
        ]);
      } else {
        for (const grade of record.grades) {
          rows.push([
            this.escapeCSV(record.studentId),
            this.escapeCSV(record.classId),
            record.academicYear,
            record.term,
            this.escapeCSV(grade.subject),
            grade.marks.toString(),
            grade.maxMarks.toString(),
            grade.grade,
            record.gpa.toString(),
            record.attendance.toString(),
            this.escapeCSV(record.behaviorRating || ''),
            this.escapeCSV(record.comments || ''),
            this.formatDate(record.createdAt, options.dateFormat),
            this.formatDate(record.updatedAt, options.dateFormat),
          ]);
        }
      }
    }

    const lines = [headers.join(','), ...rows.map((r) => r.join(','))];
    return lines.join('\n');
  }

  /**
   * Processes record with options
   * @param record - Record to process
   * @param options - Serialization options
   */
  private static processRecord(record: AcademicRecord, options: SerializeOptions): any {
    const processed: any = {
      studentId: record.studentId,
      classId: record.classId,
      academicYear: record.academicYear,
      term: record.term,
      grades: record.grades.map((g) => ({
        subjectId: g.subjectId,
        subject: g.subject,
        marks: g.marks,
        maxMarks: g.maxMarks,
        grade: g.grade,
        gradePoints: g.gradePoints,
      })),
      gpa: record.gpa,
      attendance: record.attendance,
    };

    if (record.behaviorRating && !options.excludeFields?.includes('behaviorRating')) {
      processed.behaviorRating = record.behaviorRating;
    }

    if (record.comments && !options.excludeFields?.includes('comments')) {
      processed.comments = record.comments;
    }

    if (!options.excludeFields?.includes('createdAt')) {
      processed.createdAt = this.formatDate(record.createdAt, options.dateFormat);
    }

    if (!options.excludeFields?.includes('updatedAt')) {
      processed.updatedAt = this.formatDate(record.updatedAt, options.dateFormat);
    }

    return processed;
  }

  /**
   * Filters records based on options
   * @param records - Records to filter
   * @param options - Filter options
   */
  private static filterRecords(
    records: AcademicRecord[],
    options: SerializeOptions
  ): AcademicRecord[] {
    let filtered = [...records];

    // Filter by date range
    if (options.filterByDateRange) {
      const { start, end } = options.filterByDateRange;
      filtered = filtered.filter((r) => {
        const created = new Date(r.createdAt);
        return created >= start && created <= end;
      });
    }

    // Filter by class
    if (options.filterByClass) {
      filtered = filtered.filter((r) => r.classId === options.filterByClass);
    }

    // Filter by student
    if (options.filterByStudent) {
      filtered = filtered.filter((r) => r.studentId === options.filterByStudent);
    }

    return filtered;
  }

  /**
   * Formats date based on format option
   * @param date - Date string
   * @param format - Format type
   */
  private static formatDate(date: string, format?: string): string {
    const dateObj = new Date(date);

    if (format === 'timestamp') {
      return dateObj.getTime().toString();
    }

    if (format === 'local') {
      return dateObj.toLocaleString();
    }

    return dateObj.toISOString();
  }

  /**
   * Escapes CSV special characters
   * @param value - Value to escape
   */
  private static escapeCSV(value: string): string {
    if (!value) return '';

    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }

    return value;
  }

  /**
   * Serializes with compact format
   * @param records - Records to serialize
   */
  static serializeCompact(records: AcademicRecord[]): string {
    return JSON.stringify(
      records.map((r) => ({
        sid: r.studentId,
        cid: r.classId,
        year: r.academicYear,
        term: r.term,
        g: r.grades.map((gr) => ({
          id: gr.subjectId,
          m: gr.marks,
          gp: gr.gradePoints,
        })),
        gpa: r.gpa,
        att: r.attendance,
      }))
    );
  }

  /**
   * Deserializes compact format
   * @param json - Compact JSON string
   */
  static deserializeCompact(json: string): AcademicRecord[] {
    const data = JSON.parse(json);

    return data.map((item: any) => ({
      studentId: item.sid,
      classId: item.cid,
      academicYear: item.year,
      term: item.term,
      grades: item.g.map((gr: any) => ({
        subjectId: gr.id,
        subject: '',
        marks: gr.m,
        maxMarks: 100,
        grade: '',
        gradePoints: gr.gp,
      })),
      gpa: item.gpa,
      attendance: item.att,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));
  }

  /**
   * Gets serialization statistics
   * @param records - Records to analyze
   */
  static getStatistics(records: AcademicRecord[]): {
    totalRecords: number;
    totalGrades: number;
    averageGPA: number;
    averageAttendance: number;
    classDistribution: Record<string, number>;
    dateRange: { earliest: string; latest: string };
  } {
    if (records.length === 0) {
      return {
        totalRecords: 0,
        totalGrades: 0,
        averageGPA: 0,
        averageAttendance: 0,
        classDistribution: {},
        dateRange: { earliest: '', latest: '' },
      };
    }

    const totalGrades = records.reduce((sum, r) => sum + r.grades.length, 0);
    const averageGPA = records.reduce((sum, r) => sum + r.gpa, 0) / records.length;
    const averageAttendance = records.reduce((sum, r) => sum + r.attendance, 0) / records.length;

    const classDistribution: Record<string, number> = {};
    records.forEach((r) => {
      classDistribution[r.classId] = (classDistribution[r.classId] || 0) + 1;
    });

    const dates = records.map((r) => new Date(r.createdAt));
    const earliest = new Date(Math.min(...dates.map((d) => d.getTime()))).toISOString();
    const latest = new Date(Math.max(...dates.map((d) => d.getTime()))).toISOString();

    return {
      totalRecords: records.length,
      totalGrades,
      averageGPA: Math.round(averageGPA * 100) / 100,
      averageAttendance: Math.round(averageAttendance * 100) / 100,
      classDistribution,
      dateRange: { earliest, latest },
    };
  }
}

export default AcademicRecordSerializer;
