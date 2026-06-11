# Phase 22: Data Serialization & Parsing - API Reference

**Version**: 1.0.0  
**Status**: ✅ Production Ready  
**Last Updated**: June 9, 2026

---

## Overview

Phase 22 provides comprehensive REST API endpoints for parsing, serializing, and exporting academic records in multiple formats. All endpoints require authentication and support multi-tenant operations.

**Base URL**: `/api/v1/data`  
**Authentication**: Bearer Token (JWT)  
**Content-Type**: application/json (except CSV exports)

---

## Endpoints

### 1. Parse Single Record

**Endpoint**: `POST /api/v1/data/parse/record`

Parses a single academic record from a JSON string with full schema validation.

**Request**:
```bash
curl -X POST http://localhost:3000/api/v1/data/parse/record \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonString": "{\"studentId\": \"student-123\", \"classId\": \"class-456\", \"grade\": 85.5, \"attendance\": 92, \"status\": \"approved\"}"
  }'
```

**Request Body**:
```json
{
  "jsonString": "string (required) - JSON string containing academic record"
}
```

**Response (Success)**:
```json
{
  "success": true,
  "data": {
    "studentId": "student-123",
    "classId": "class-456",
    "academicYear": "2026",
    "term": "Q1",
    "grades": [],
    "gpa": 0,
    "attendance": 92,
    "createdAt": "2026-06-09T10:30:00Z",
    "updatedAt": "2026-06-09T10:30:00Z"
  },
  "errors": [],
  "warnings": [],
  "lineCount": 1
}
```

**Response (Validation Error)**:
```json
{
  "success": false,
  "data": null,
  "errors": [
    {
      "field": "grade",
      "message": "Grade must be between 0 and 100",
      "lineNumber": 1,
      "suggestion": "Check the grade value in your JSON"
    }
  ],
  "warnings": [],
  "lineCount": 1
}
```

**Status Codes**:
- `200 OK` - Successful parse (may contain errors)
- `400 Bad Request` - Missing jsonString parameter
- `401 Unauthorized` - Invalid or missing authentication
- `500 Internal Server Error` - Server error

---

### 2. Parse Multiple Records

**Endpoint**: `POST /api/v1/data/parse/records`

Parses an array of academic records from a JSON string.

**Request**:
```bash
curl -X POST http://localhost:3000/api/v1/data/parse/records \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonString": "[{\"studentId\": \"s1\", \"classId\": \"c1\", \"grade\": 85}, {\"studentId\": \"s2\", \"classId\": \"c1\", \"grade\": 90}]"
  }'
```

**Request Body**:
```json
{
  "jsonString": "string (required) - JSON string containing array of records"
}
```

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "studentId": "s1",
      "classId": "c1",
      "attendance": 85,
      "createdAt": "2026-06-09T10:30:00Z"
    },
    {
      "studentId": "s2",
      "classId": "c1",
      "attendance": 90,
      "createdAt": "2026-06-09T10:30:00Z"
    }
  ],
  "errors": [],
  "warnings": [
    "Record 2: Missing academicYear, using default"
  ],
  "lineCount": 2,
  "recordCount": 2
}
```

---

### 3. Validate Records

**Endpoint**: `POST /api/v1/data/validate`

Validates JSON without full parsing. Use this for quick validation checks.

**Request**:
```bash
curl -X POST http://localhost:3000/api/v1/data/validate \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonString": "[{...}, {...}]"
  }'
```

**Request Body**:
```json
{
  "jsonString": "string (required) - JSON to validate"
}
```

**Response**:
```json
{
  "success": true,
  "recordCount": 150,
  "errorCount": 3,
  "warningCount": 5,
  "errors": [
    "Row 5: Invalid grade value (must be 0-100)",
    "Row 12: Missing required field 'classId'",
    "Row 28: Invalid date format"
  ],
  "summary": "Validation passed with warnings"
}
```

---

### 4. Serialize Single Record

**Endpoint**: `POST /api/v1/data/serialize/record`

Serializes a single record to JSON format with options.

**Request**:
```bash
curl -X POST http://localhost:3000/api/v1/data/serialize/record \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "record": {
      "studentId": "s1",
      "classId": "c1",
      "attendance": 92,
      "gpa": 3.8
    },
    "options": {
      "prettyPrint": true,
      "indent": 2,
      "dateFormat": "iso"
    }
  }'
```

**Request Body**:
```json
{
  "record": {
    "studentId": "string",
    "classId": "string",
    "attendance": "number",
    "gpa": "number"
  },
  "options": {
    "prettyPrint": "boolean (default: true)",
    "indent": "number (default: 2)",
    "excludeFields": ["array of field names to exclude"],
    "dateFormat": "string (iso|formatted|timestamp, default: iso)"
  }
}
```

**Response**:
```json
{
  "success": true,
  "data": "{\n  \"studentId\": \"s1\",\n  \"classId\": \"c1\",\n  \"attendance\": 92,\n  \"gpa\": 3.8,\n  \"createdAt\": \"2026-06-09T10:30:00Z\"\n}",
  "format": "json"
}
```

---

### 5. Serialize Multiple Records

**Endpoint**: `POST /api/v1/data/serialize/records`

Serializes multiple records with optional filtering.

**Request**:
```bash
curl -X POST http://localhost:3000/api/v1/data/serialize/records \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "records": [
      {"studentId": "s1", "classId": "c1", "attendance": 92},
      {"studentId": "s2", "classId": "c1", "attendance": 88}
    ],
    "options": {
      "prettyPrint": true,
      "dateRange": {
        "start": "2026-01-01",
        "end": "2026-12-31"
      },
      "classId": "c1"
    }
  }'
```

**Request Body**:
```json
{
  "records": "array (required) - Array of academic records",
  "options": {
    "prettyPrint": "boolean (default: true)",
    "indent": "number (default: 2)",
    "excludeFields": "array",
    "dateFormat": "string (default: iso)",
    "dateRange": {
      "start": "ISO 8601 date string",
      "end": "ISO 8601 date string"
    },
    "classId": "string (optional) - Filter by class",
    "studentId": "string (optional) - Filter by student"
  }
}
```

**Response**:
```json
{
  "success": true,
  "data": "[{...}, {...}]",
  "format": "json",
  "statistics": {
    "totalRecords": 150,
    "averageGPA": 3.45,
    "averageAttendance": 88.5,
    "classDistribution": {"c1": 50, "c2": 60, "c3": 40}
  }
}
```

---

### 6. Export to CSV

**Endpoint**: `POST /api/v1/data/serialize/csv`

Exports records to CSV format (downloadable).

**Request**:
```bash
curl -X POST http://localhost:3000/api/v1/data/serialize/csv \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "records": [...],
    "options": {
      "dateRange": {
        "start": "2026-01-01",
        "end": "2026-12-31"
      }
    }
  }' \
  -o records.csv
```

**Request Body**:
```json
{
  "records": "array (required)",
  "options": {
    "dateFormat": "string (default: iso)",
    "dateRange": "object (optional)",
    "classId": "string (optional)",
    "studentId": "string (optional)"
  }
}
```

**Response**:
```
Student ID,Class ID,Academic Year,Term,Subject,Marks,Max Marks,Grade,GPA,Attendance,Behavior Rating,Comments,Created At,Updated At
student-1,class-1,2026,Q1,Math,85,100,A,3.8,92,,Good performance,2026-06-09T10:30:00Z,2026-06-09T10:30:00Z
student-2,class-1,2026,Q1,Math,78,100,B,3.5,88,,Average,2026-06-09T10:30:00Z,2026-06-09T10:30:00Z
```

**Response Headers**:
- `Content-Type: text/csv`
- `Content-Disposition: attachment; filename="academic-records.csv"`

---

### 7. Serialize to Compact Format

**Endpoint**: `POST /api/v1/data/serialize/compact`

Serializes records to compact format (~60% size reduction).

**Request**:
```bash
curl -X POST http://localhost:3000/api/v1/data/serialize/compact \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "records": [...]
  }'
```

**Request Body**:
```json
{
  "records": "array (required) - Records to compact"
}
```

**Response**:
```json
{
  "success": true,
  "data": "[{\"sid\":\"s1\",\"cid\":\"c1\",\"year\":\"2026\",\"term\":\"Q1\",\"g\":[{\"id\":\"subj1\",\"m\":85,\"gp\":3.8}],\"gpa\":3.8,\"att\":92}]",
  "format": "compact",
  "compressionRatio": "62%"
}
```

---

### 8. Deserialize Compact Format

**Endpoint**: `POST /api/v1/data/deserialize/compact`

Decompresses compact format back to full records.

**Request**:
```bash
curl -X POST http://localhost:3000/api/v1/data/deserialize/compact \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "compactJson": "[{\"sid\":\"s1\",\"cid\":\"c1\",...}]"
  }'
```

**Request Body**:
```json
{
  "compactJson": "string (required) - Compact JSON format"
}
```

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "studentId": "s1",
      "classId": "c1",
      "academicYear": "2026",
      "term": "Q1",
      "grades": [...],
      "gpa": 3.8,
      "attendance": 92
    }
  ],
  "recordCount": 1
}
```

---

### 9. Get Statistics

**Endpoint**: `POST /api/v1/data/statistics`

Calculates statistics for a set of records.

**Request**:
```bash
curl -X POST http://localhost:3000/api/v1/data/statistics \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "records": [...]
  }'
```

**Request Body**:
```json
{
  "records": "array (required) - Records to analyze"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "totalRecords": 150,
    "totalGrades": 450,
    "averageGPA": 3.45,
    "averageAttendance": 88.5,
    "classDistribution": {
      "class-1": 50,
      "class-2": 60,
      "class-3": 40
    },
    "dateRange": {
      "earliest": "2026-01-01T00:00:00Z",
      "latest": "2026-12-31T23:59:59Z"
    }
  }
}
```

---

## Request/Response Examples

### Complete Parse Example

**Scenario**: Parse a batch of student grades and get statistics.

**Request**:
```bash
curl -X POST http://localhost:3000/api/v1/data/parse/records \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d @- << 'EOF'
{
  "jsonString": "[
    {
      \"studentId\": \"STU001\",
      \"classId\": \"CLS001\",
      \"academicYear\": \"2026\",
      \"term\": \"Q1\",
      \"grades\": [
        {\"subjectId\": \"MATH\", \"marks\": 85, \"maxMarks\": 100},
        {\"subjectId\": \"ENG\", \"marks\": 78, \"maxMarks\": 100}
      ],
      \"attendance\": 92
    }
  ]"
}
EOF
```

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "studentId": "STU001",
      "classId": "CLS001",
      "academicYear": "2026",
      "term": "Q1",
      "grades": [
        {"subjectId": "MATH", "subject": "", "marks": 85, "maxMarks": 100, "grade": "", "gradePoints": 0},
        {"subjectId": "ENG", "subject": "", "marks": 78, "maxMarks": 100, "grade": "", "gradePoints": 0}
      ],
      "gpa": 0,
      "attendance": 92
    }
  ],
  "errors": [],
  "warnings": [],
  "recordCount": 1,
  "lineCount": 8
}
```

---

## Error Responses

### Invalid JSON
```json
{
  "error": "Malformed JSON",
  "message": "JSON.parse() error at line 1, column 5",
  "timestamp": "2026-06-09T10:30:00Z"
}
```

### Missing Required Field
```json
{
  "error": "Validation Error",
  "message": "jsonString (string) required",
  "timestamp": "2026-06-09T10:30:00Z"
}
```

### Authentication Error
```json
{
  "error": "Unauthorized",
  "message": "No authorization header provided",
  "timestamp": "2026-06-09T10:30:00Z"
}
```

### Server Error
```json
{
  "error": "Internal Server Error",
  "message": "An unexpected error occurred while processing your request",
  "timestamp": "2026-06-09T10:30:00Z"
}
```

---

## Query Parameters

All endpoints support optional query parameters:

- `tenant_id` (optional) - Multi-tenant filtering
- `user_id` (optional) - User context for audit logging

---

## Rate Limiting

No explicit rate limiting in Phase 22. Consider adding:
- Per-user: 1000 requests/hour
- Per-endpoint: 100 requests/minute
- Payload size: 10MB maximum

---

## Authentication

All endpoints require JWT bearer token:

```bash
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Token obtained from `/api/v1/auth/login` endpoint.

---

## Data Types

### AcademicRecord
```typescript
interface AcademicRecord {
  studentId: string;
  classId: string;
  academicYear: string;
  term: string;
  grades: Grade[];
  gpa: number;
  attendance: number;
  behaviorRating?: string;
  comments?: string;
  createdAt: string;
  updatedAt: string;
}
```

### Grade
```typescript
interface Grade {
  subjectId: string;
  subject: string;
  marks: number;
  maxMarks: number;
  grade: string;
  gradePoints: number;
}
```

### SerializeOptions
```typescript
interface SerializeOptions {
  prettyPrint?: boolean;
  indent?: number;
  excludeFields?: string[];
  dateFormat?: 'iso' | 'formatted' | 'timestamp';
  filterByDateRange?: { start: Date; end: Date };
  filterByClass?: string;
  filterByStudent?: string;
}
```

---

## Performance Tips

1. **Use Compact Format** for large datasets (60% smaller)
2. **Add Date Range Filters** to reduce data volume
3. **Parse in Batches** of 1000+ records
4. **Cache Results** using serialization_configs table
5. **Use CSV Export** for external systems

---

## Changelog

### Version 1.0.0 (June 9, 2026)
- Initial release with 9 endpoints
- Support for JSON, CSV, and Compact formats
- Full validation and error reporting
- Multi-tenant support
- Comprehensive statistics

---

## Support & Issues

For issues or questions:
1. Check error messages and suggestions
2. Verify request format matches examples
3. Ensure authentication token is valid
4. Check server logs for detailed errors

---

**Last Updated**: June 9, 2026  
**API Version**: 1.0.0  
**Status**: Production Ready ✅
