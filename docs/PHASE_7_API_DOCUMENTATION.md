# Phase 7: Reporting & Analytics API Documentation

**Date**: June 28, 2026  
**Version**: 1.0.0  
**Status**: Production Ready ✅

---

## 📚 Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Report Generation Endpoints](#report-generation-endpoints)
4. [Analytics Endpoints](#analytics-endpoints)
5. [Error Handling](#error-handling)
6. [Rate Limiting](#rate-limiting)
7. [Examples](#examples)

---

## Overview

Phase 7 introduces comprehensive reporting and analytics capabilities to the School Management System. The API provides endpoints for:

- Generating various types of reports (grades, attendance, performance)
- Retrieving system-wide and entity-specific analytics
- Accessing historical report data
- Managing report lifecycle (creation, retrieval, deletion)

### Base URL

```
http://localhost:3000/api/v1
```

### API Version

```
1.0.0
```

---

## Authentication

All endpoints require JWT authentication via the `Authorization` header.

### Header Format

```
Authorization: Bearer <JWT_TOKEN>
```

### Token Generation

Tokens are obtained through the authentication endpoint:

```
POST /api/v1/auth/login
```

### Token Claims

Tokens include:
- `userId`: User identifier
- `email`: User email
- `role`: User role (admin, teacher, manager, student, etc.)
- `permissions`: Array of permission strings
- `iat`: Issued at timestamp
- `exp`: Expiration timestamp (24 hours from issue)

### Role-Based Access

| Endpoint | Admin | Teacher | Manager | Student | Guardian |
|----------|-------|---------|---------|---------|----------|
| Generate Reports | ✅ | ✅ | ✅ | ✅ | ❌ |
| View Analytics | ✅ | ✅ | ✅ | ✅* | ❌ |
| Report History | ✅ | ✅ | ✅ | ❌ | ❌ |
| System Health | ✅ | ❌ | ❌ | ❌ | ❌ |

*Students can only view their own analytics

---

## Report Generation Endpoints

### 1. Generate Grade Report

**Endpoint**: `POST /api/v1/reports/grades`

**Description**: Generate a comprehensive grade report for a class

**Authentication**: Required  
**Rate Limit**: 100 requests/hour

#### Request Body

```json
{
  "classId": "class-123",
  "startDate": "2026-06-01",
  "endDate": "2026-06-28",
  "format": "json"
}
```

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| classId | string | Yes | ID of the class |
| startDate | string (ISO 8601) | No | Report start date |
| endDate | string (ISO 8601) | No | Report end date |
| format | enum | No | Output format (json, csv, pdf) - default: json |

#### Response (Success)

**Status Code**: 200 OK

```json
{
  "success": true,
  "data": {
    "reportId": "grade-class-123-1719576000000",
    "classId": "class-123",
    "className": "Mathematics 101",
    "studentCount": 45,
    "averageGPA": 82.5,
    "highestGPA": 98,
    "lowestGPA": 62,
    "distribution": {
      "A": 15,
      "B": 20,
      "C": 8,
      "D": 2,
      "F": 0
    },
    "generatedAt": "2026-06-28T10:00:00Z",
    "generatedBy": "user-123"
  },
  "message": "Grade report generated successfully"
}
```

#### Response (Error)

**Status Code**: 400/500

```json
{
  "error": "Error message",
  "message": "Detailed error description"
}
```

#### Example Request

```bash
curl -X POST "http://localhost:3000/api/v1/reports/grades" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "classId": "class-123",
    "startDate": "2026-06-01",
    "endDate": "2026-06-28"
  }'
```

---

### 2. Generate Attendance Report

**Endpoint**: `POST /api/v1/reports/attendance`

**Description**: Generate an attendance report for a class

**Authentication**: Required  
**Rate Limit**: 100 requests/hour

#### Request Body

```json
{
  "classId": "class-123",
  "startDate": "2026-06-01",
  "endDate": "2026-06-28"
}
```

#### Response (Success)

**Status Code**: 200 OK

```json
{
  "success": true,
  "data": {
    "reportId": "attendance-class-123-1719576000000",
    "classId": "class-123",
    "className": "Mathematics 101",
    "studentCount": 45,
    "averageAttendance": 89.5,
    "absentDays": 156,
    "lateDays": 42,
    "excellentAttendance": 38,
    "poorAttendance": 3,
    "generatedAt": "2026-06-28T10:00:00Z",
    "generatedBy": "user-123"
  },
  "message": "Attendance report generated successfully"
}
```

---

### 3. Generate Performance Report

**Endpoint**: `POST /api/v1/reports/performance`

**Description**: Generate a performance report for an individual student

**Authentication**: Required  
**Rate Limit**: 100 requests/hour

#### Request Body

```json
{
  "studentId": "student-123"
}
```

#### Response (Success)

**Status Code**: 200 OK

```json
{
  "success": true,
  "data": {
    "reportId": "performance-student-123-1719576000000",
    "studentId": "student-123",
    "studentName": "John Doe",
    "enrolledClasses": 6,
    "averageGPA": 85.3,
    "attendancePercentage": 92.5,
    "improvementTrend": "improving",
    "strengths": [
      "Outstanding academic performance",
      "Excellent attendance"
    ],
    "areasForImprovement": [],
    "generatedAt": "2026-06-28T10:00:00Z"
  },
  "message": "Performance report generated successfully"
}
```

---

### 4. Generate Class Performance Report

**Endpoint**: `POST /api/v1/reports/class-performance`

**Description**: Generate comprehensive class performance analysis

**Authentication**: Required  
**Rate Limit**: 100 requests/hour

#### Request Body

```json
{
  "classId": "class-123"
}
```

#### Response (Success)

**Status Code**: 200 OK

```json
{
  "success": true,
  "data": {
    "reportId": "class-perf-class-123-1719576000000",
    "classId": "class-123",
    "className": "Mathematics 101",
    "totalEnrolled": 45,
    "averageGPA": 82.5,
    "averageAttendance": 89.5,
    "topPerformers": [
      {
        "studentId": "s-1",
        "name": "Alice Johnson",
        "gpa": 98
      },
      {
        "studentId": "s-2",
        "name": "Bob Smith",
        "gpa": 96
      }
    ],
    "needsSupport": [
      {
        "studentId": "s-44",
        "name": "Eve Wilson",
        "gpa": 65
      }
    ],
    "generatedAt": "2026-06-28T10:00:00Z"
  },
  "message": "Class performance report generated successfully"
}
```

---

### 5. Generate Schedule Utilization Report

**Endpoint**: `POST /api/v1/reports/schedule-utilization`

**Description**: Analyze schedule efficiency and resource utilization

**Authentication**: Required  
**Rate Limit**: 50 requests/hour

#### Request Body

```json
{
  "academicPeriod": "2026-spring"
}
```

#### Response (Success)

**Status Code**: 200 OK

```json
{
  "success": true,
  "data": {
    "reportId": "schedule-util-2026-spring-1719576000000",
    "academicPeriod": "2026-spring",
    "totalScheduledClasses": 156,
    "averageClassSize": 32,
    "roomUtilization": 87.5,
    "peakHours": [
      "09:00",
      "10:00",
      "14:00"
    ],
    "conflicts": 0,
    "generatedAt": "2026-06-28T10:00:00Z"
  },
  "message": "Schedule utilization report generated successfully"
}
```

---

## Analytics Endpoints

### 1. Get Dashboard Analytics

**Endpoint**: `GET /api/v1/analytics/dashboard`

**Description**: Retrieve system-wide analytics and insights

**Authentication**: Required  
**Rate Limit**: 60 requests/hour

#### Query Parameters

None

#### Response (Success)

**Status Code**: 200 OK

```json
{
  "success": true,
  "data": {
    "dashboardId": "dashboard-1719576000000",
    "timestamp": "2026-06-28T10:00:00Z",
    "metrics": {
      "totalStudents": 450,
      "totalClasses": 15,
      "totalTeachers": 25,
      "averageGPA": 82.8,
      "averageAttendance": 88.5,
      "enrollmentTrend": 85
    },
    "rankings": {
      "topClasses": [
        {
          "classId": "c-1",
          "name": "AP Calculus",
          "averageGPA": 88.5
        }
      ],
      "topStudents": [
        {
          "studentId": "s-1",
          "name": "Alice Johnson",
          "gpa": 98
        }
      ],
      "needsSupport": [
        {
          "studentId": "s-44",
          "name": "Eve Wilson",
          "gpa": 65
        }
      ]
    },
    "insights": {
      "enrollmentStatus": "Strong enrollment growth",
      "academicHealth": "Excellent academic performance",
      "attendanceHealth": "Good attendance",
      "recommendations": []
    }
  },
  "message": "Dashboard analytics retrieved successfully"
}
```

#### Example Request

```bash
curl -X GET "http://localhost:3000/api/v1/analytics/dashboard" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

### 2. Get Student Analytics

**Endpoint**: `GET /api/v1/analytics/students/:studentId`

**Description**: Retrieve student-specific analytics and performance trends

**Authentication**: Required  
**Rate Limit**: 100 requests/hour

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| studentId | string | Student identifier |

#### Response (Success)

**Status Code**: 200 OK

```json
{
  "success": true,
  "data": {
    "studentId": "student-123",
    "studentName": "John Doe",
    "enrolledClasses": 6,
    "averageGPA": 85.3,
    "attendancePercentage": 92.5,
    "gradeDistribution": {
      "A": 8,
      "B": 12,
      "C": 4,
      "D": 0,
      "F": 0
    },
    "trend": {
      "last30Days": [82, 84, 85, 87, 88],
      "trend": "improving",
      "changePercentage": 7.3
    }
  },
  "message": "Student analytics retrieved successfully"
}
```

---

### 3. Get Class Analytics

**Endpoint**: `GET /api/v1/analytics/classes/:classId`

**Description**: Retrieve class-specific analytics and performance metrics

**Authentication**: Required  
**Rate Limit**: 100 requests/hour

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| classId | string | Class identifier |

#### Response (Success)

**Status Code**: 200 OK

```json
{
  "success": true,
  "data": {
    "classId": "class-123",
    "className": "Mathematics 101",
    "enrollmentCount": 45,
    "averageGPA": 82.5,
    "averageAttendance": 89.5,
    "totalSessions": 48,
    "completedSessions": 47,
    "cancellations": 1,
    "students": {
      "excellent": 15,
      "good": 20,
      "fair": 8,
      "poor": 2
    }
  },
  "message": "Class analytics retrieved successfully"
}
```

---

### 4. Get Enrollment Analytics

**Endpoint**: `GET /api/v1/analytics/enrollment`

**Description**: Retrieve enrollment trends and processing metrics

**Authentication**: Required  
**Rate Limit**: 60 requests/hour

#### Response (Success)

**Status Code**: 200 OK

```json
{
  "success": true,
  "data": {
    "totalEnrolled": 450,
    "totalRequests": 520,
    "approvalRate": 86.5,
    "rejectionRate": 8.5,
    "pendingRequests": 5,
    "averageProcessingTime": 2.3,
    "trendsLastMonth": {
      "week1": 45,
      "week2": 52,
      "week3": 48,
      "week4": 41
    }
  },
  "message": "Enrollment analytics retrieved successfully"
}
```

---

### 5. Get System Health Metrics

**Endpoint**: `GET /api/v1/analytics/health`

**Description**: Retrieve overall system health and performance indicators

**Authentication**: Required (Admin only)  
**Rate Limit**: 30 requests/hour

#### Response (Success)

**Status Code**: 200 OK

```json
{
  "success": true,
  "data": {
    "timestamp": "2026-06-28T10:00:00Z",
    "systemStatus": "healthy",
    "dataQualityScore": 95,
    "errorRate": 0.5,
    "metrics": {
      "totalUsers": 550,
      "totalClasses": 15,
      "totalEnrollments": 450,
      "totalGrades": 2250,
      "totalAuditLogs": 5000
    }
  },
  "message": "System health metrics retrieved successfully"
}
```

---

## Additional Endpoints

### Get Report History

**Endpoint**: `GET /api/v1/reports/history`

**Description**: Retrieve history of generated reports

**Authentication**: Required  
**Rate Limit**: 100 requests/hour

#### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| limit | integer | 50 | Number of records to return |
| offset | integer | 0 | Number of records to skip |

#### Response

```json
{
  "success": true,
  "data": [
    {
      "entity_type": "report",
      "entity_id": "report-123",
      "action": "generate",
      "performed_by": "user-123",
      "details": {
        "type": "grade_report",
        "classId": "class-123"
      },
      "timestamp": "2026-06-28T10:00:00Z"
    }
  ],
  "pagination": {
    "limit": 50,
    "offset": 0,
    "total": 245
  },
  "message": "Report history retrieved successfully"
}
```

---

### Get Stored Report

**Endpoint**: `GET /api/v1/reports/:reportId`

**Description**: Retrieve a previously generated report

**Authentication**: Required  
**Rate Limit**: 100 requests/hour

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| reportId | string | Report identifier |

#### Response

```json
{
  "success": true,
  "data": {
    "id": "grade-class-123-1719576000000",
    "type": "grade",
    "name": "Grade Report - Mathematics 101",
    "created_by": "user-123",
    "class_id": "class-123",
    "filters": {
      "startDate": "2026-06-01",
      "endDate": "2026-06-28"
    },
    "data": { /* report data */ },
    "status": "generated",
    "generated_at": "2026-06-28T10:00:00Z",
    "created_at": "2026-06-28T10:00:00Z"
  },
  "message": "Report retrieved successfully"
}
```

---

### Delete Report

**Endpoint**: `DELETE /api/v1/reports/:reportId`

**Description**: Delete a report (report creator or admin only)

**Authentication**: Required  
**Rate Limit**: 50 requests/hour

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| reportId | string | Report identifier |

#### Response

```json
{
  "success": true,
  "message": "Report deleted successfully"
}
```

---

## Error Handling

### Error Response Format

All errors follow a consistent format:

```json
{
  "error": "Error code",
  "message": "Human-readable error description"
}
```

### HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 400 | Bad Request (missing/invalid parameters) |
| 401 | Unauthorized (missing/invalid token) |
| 403 | Forbidden (insufficient permissions) |
| 404 | Not Found (resource doesn't exist) |
| 500 | Internal Server Error |

### Common Error Responses

#### Missing Required Parameter
```json
{
  "error": "Missing required parameter",
  "message": "classId is required"
}
```

#### Invalid Token
```json
{
  "error": "Unauthorized",
  "message": "Invalid or expired token"
}
```

#### Insufficient Permissions
```json
{
  "error": "Forbidden",
  "message": "You do not have permission to access this resource"
}
```

#### Resource Not Found
```json
{
  "error": "Not Found",
  "message": "Report not found"
}
```

---

## Rate Limiting

All endpoints implement rate limiting to prevent abuse.

### Rate Limit Headers

Responses include rate limit information:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 85
X-RateLimit-Reset: 1719576600
```

### Rate Limit Tiers

| Endpoint Type | Limit | Window |
|---------------|-------|--------|
| Report Generation | 100 | 1 hour |
| Analytics Retrieval | 100 | 1 hour |
| Report History | 100 | 1 hour |
| System Health | 30 | 1 hour |

### Rate Limit Exceeded

```json
{
  "error": "Rate limit exceeded",
  "message": "Too many requests. Please try again later.",
  "retryAfter": 3600
}
```

---

## Examples

### Example 1: Generate Grade Report for Class

```bash
#!/bin/bash

# Set variables
CLASS_ID="class-123"
TOKEN="your_jwt_token_here"
API_URL="http://localhost:3000/api/v1"

# Generate grade report
curl -X POST "${API_URL}/reports/grades" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "classId": "'${CLASS_ID}'",
    "startDate": "2026-06-01",
    "endDate": "2026-06-28"
  }'
```

### Example 2: Get Dashboard Analytics

```bash
#!/bin/bash

TOKEN="your_jwt_token_here"
API_URL="http://localhost:3000/api/v1"

# Get dashboard analytics
curl -X GET "${API_URL}/analytics/dashboard" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json"
```

### Example 3: Get Student Analytics

```bash
#!/bin/bash

STUDENT_ID="student-123"
TOKEN="your_jwt_token_here"
API_URL="http://localhost:3000/api/v1"

# Get student analytics
curl -X GET "${API_URL}/analytics/students/${STUDENT_ID}" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json"
```

### Example 4: Retrieve Report History with Pagination

```bash
#!/bin/bash

TOKEN="your_jwt_token_here"
API_URL="http://localhost:3000/api/v1"

# Get report history (first 25 records, skip first 50)
curl -X GET "${API_URL}/reports/history?limit=25&offset=50" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json"
```

---

## Best Practices

### 1. Error Handling
- Always check the response status code
- Parse error messages for user-friendly feedback
- Implement exponential backoff for retries

### 2. Performance
- Cache analytics results when appropriate
- Use pagination for large datasets
- Generate reports asynchronously for large datasets

### 3. Security
- Never hardcode API tokens
- Use environment variables for sensitive data
- Validate all user inputs client-side before submission

### 4. Monitoring
- Log all API requests and responses
- Monitor rate limit usage
- Alert on error rate spikes

---

## Support & Contact

For API support or issues:
- Email: api-support@school-management.local
- Documentation: /api/docs
- Status Page: /api/status

---

**Version**: 1.0.0  
**Last Updated**: June 28, 2026  
**Status**: Production Ready ✅
