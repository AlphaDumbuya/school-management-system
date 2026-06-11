# Phase 9: Notifications System - API Documentation

**Last Updated**: July 1, 2026  
**Phase Status**: ✅ COMPLETE  
**API Version**: 1.0.0  
**Base URL**: `/api/v1`  

---

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Notification Endpoints](#notification-endpoints)
4. [In-App Notification Endpoints](#in-app-notification-endpoints)
5. [Preference Endpoints](#preference-endpoints)
6. [Template Management](#template-management)
7. [Error Handling](#error-handling)
8. [Examples](#examples)

---

## Overview

The Notifications System provides multi-channel notification delivery with support for:
- **Email**: Brevo integration for transactional emails
- **SMS**: Multi-provider support (Twilio, AWS SNS, Vonage)
- **In-App**: Real-time notifications via database

### Key Features

- Event-based triggers (grade, attendance, payment, schedule, enrollment)
- User preference management
- Template-based notifications
- Delivery tracking and retry logic
- Analytics and reporting

### Architecture

```
Trigger System
    ↓
Notification Service
    ├→ Email Service (Brevo)
    ├→ SMS Service (Twilio/AWS/Vonage)
    ├→ In-App Service (Database)
    └→ Delivery Tracking

User Preferences → Control Channels & Frequency
Templates → Content Management
```

---

## Authentication

All endpoints require JWT authentication via `Authorization` header:

```bash
Authorization: Bearer <access_token>
```

### User Roles

- **admin**: Full access to all endpoints, can manage templates and global settings
- **user**: Can view and manage own notifications and preferences
- **student**: Limited to viewing own notifications
- **parent**: Can view child notifications
- **teacher**: Can create notifications for students

---

## Notification Endpoints

### Create Notification

**Endpoint**: `POST /api/v1/notifications`  
**Access**: Private (Admin, Teacher)  
**Rate Limit**: 100/hour per user  

**Request Body**:
```json
{
  "notificationType": "grade|attendance|payment|schedule|enrollment",
  "recipientId": "uuid",
  "subject": "Notification Subject",
  "message": "Notification message content",
  "data": {
    "studentId": "uuid",
    "className": "10-A",
    "grade": 85
  },
  "channels": ["email", "sms", "in_app"],
  "sourceType": "grade|attendance|payment|schedule|enrollment",
  "sourceId": "uuid"
}
```

**Response** (201):
```json
{
  "message": "Notification created successfully",
  "data": {
    "id": "uuid",
    "notificationType": "grade",
    "recipientId": "uuid",
    "subject": "New Grade Posted",
    "message": "A new grade of 85/100 has been posted",
    "channels": ["email", "in_app"],
    "status": "pending",
    "createdAt": "2026-07-01T10:00:00Z",
    "updatedAt": "2026-07-01T10:00:00Z"
  }
}
```

---

### Get Notifications

**Endpoint**: `GET /api/v1/notifications`  
**Access**: Private  
**Query Parameters**:
- `notificationType` (optional): Filter by notification type
- `status` (optional): pending, sent, failed, read
- `isRead` (optional): true/false
- `limit` (default: 20): Number of results
- `offset` (default: 0): Pagination offset

**Response** (200):
```json
{
  "message": "Notifications retrieved successfully",
  "data": [
    {
      "id": "uuid",
      "notificationType": "grade",
      "recipientId": "uuid",
      "subject": "New Grade Posted",
      "message": "A new grade of 85/100 has been posted",
      "channels": ["email", "in_app"],
      "readAt": null,
      "status": "sent",
      "createdAt": "2026-07-01T10:00:00Z"
    }
  ],
  "total": 42,
  "limit": 20,
  "offset": 0
}
```

---

### Get Single Notification

**Endpoint**: `GET /api/v1/notifications/{notificationId}`  
**Access**: Private (Own or Admin)  

**Response** (200):
```json
{
  "message": "Notification retrieved successfully",
  "data": {
    "id": "uuid",
    "notificationType": "grade",
    "recipientId": "uuid",
    "subject": "New Grade Posted",
    "message": "A new grade of 85/100 has been posted in Mathematics",
    "data": {
      "studentId": "uuid",
      "grade": 85,
      "subject": "Mathematics"
    },
    "channels": ["email", "in_app"],
    "readAt": null,
    "status": "sent",
    "sourceType": "grade",
    "sourceId": "uuid",
    "createdAt": "2026-07-01T10:00:00Z",
    "updatedAt": "2026-07-01T10:00:00Z"
  }
}
```

---

### Mark Notification as Read

**Endpoint**: `PATCH /api/v1/notifications/{notificationId}/read`  
**Access**: Private (Own or Admin)  

**Response** (200):
```json
{
  "message": "Notification marked as read",
  "data": {
    "id": "uuid",
    "notificationType": "grade",
    "recipientId": "uuid",
    "subject": "New Grade Posted",
    "message": "A new grade of 85/100 has been posted",
    "readAt": "2026-07-01T10:05:00Z",
    "status": "read"
  }
}
```

---

### Mark All Notifications as Read

**Endpoint**: `PATCH /api/v1/notifications/mark-all-read`  
**Access**: Private  

**Response** (200):
```json
{
  "message": "All notifications marked as read",
  "markedCount": 15
}
```

---

### Delete Notification

**Endpoint**: `DELETE /api/v1/notifications/{notificationId}`  
**Access**: Private (Own or Admin)  

**Response** (200):
```json
{
  "message": "Notification deleted successfully"
}
```

---

### Get Unread Count

**Endpoint**: `GET /api/v1/notifications/unread/count`  
**Access**: Private  

**Response** (200):
```json
{
  "message": "Unread count retrieved",
  "unreadCount": 5
}
```

---

### Get Statistics

**Endpoint**: `GET /api/v1/notifications/statistics`  
**Access**: Private  

**Response** (200):
```json
{
  "message": "Notification statistics retrieved",
  "data": {
    "total": 156,
    "unread": 12,
    "byType": {
      "grade": 45,
      "attendance": 32,
      "payment": 28,
      "schedule": 35,
      "enrollment": 16
    },
    "byStatus": {
      "sent": 140,
      "pending": 5,
      "failed": 11
    },
    "byChannel": {
      "email": 80,
      "sms": 45,
      "in_app": 156
    }
  }
}
```

---

## In-App Notification Endpoints

### Get In-App Notifications

**Endpoint**: `GET /api/v1/in-app-notifications`  
**Access**: Private  
**Query Parameters**:
- `limit` (default: 50): Results per page
- `offset` (default: 0): Pagination offset
- `includeRead` (default: false): Include read notifications

**Response** (200):
```json
{
  "message": "In-app notifications retrieved successfully",
  "data": [
    {
      "id": "uuid",
      "notificationId": "uuid",
      "recipientId": "uuid",
      "title": "Grade Posted",
      "message": "You received a new grade",
      "icon": "https://example.com/icon.png",
      "actionUrl": "/grades/123",
      "priority": "high",
      "isRead": false,
      "readAt": null,
      "expiresAt": "2026-08-01T10:00:00Z",
      "createdAt": "2026-07-01T10:00:00Z",
      "updatedAt": "2026-07-01T10:00:00Z"
    }
  ],
  "total": 25,
  "unread": 5
}
```

---

### Mark In-App Notification as Read

**Endpoint**: `PATCH /api/v1/in-app-notifications/{notificationId}/read`  
**Access**: Private (Own)  

**Response** (200):
```json
{
  "message": "In-app notification marked as read",
  "data": {
    "id": "uuid",
    "isRead": true,
    "readAt": "2026-07-01T10:05:00Z"
  }
}
```

---

### Mark All In-App Notifications as Read

**Endpoint**: `PATCH /api/v1/in-app-notifications/mark-all-read`  
**Access**: Private  

**Response** (200):
```json
{
  "message": "All in-app notifications marked as read",
  "markedCount": 8
}
```

---

### Delete In-App Notification

**Endpoint**: `DELETE /api/v1/in-app-notifications/{notificationId}`  
**Access**: Private (Own)  

**Response** (200):
```json
{
  "message": "In-app notification deleted successfully"
}
```

---

### Get High Priority Notifications

**Endpoint**: `GET /api/v1/in-app-notifications/high-priority`  
**Access**: Private  
**Query Parameters**:
- `limit` (default: 10): Maximum results

**Response** (200):
```json
{
  "message": "High priority notifications retrieved",
  "data": [
    {
      "id": "uuid",
      "notificationId": "uuid",
      "title": "Urgent: Payment Overdue",
      "message": "Your payment is now overdue",
      "priority": "high",
      "isRead": false
    }
  ]
}
```

---

### Get In-App Statistics

**Endpoint**: `GET /api/v1/in-app-notifications/statistics`  
**Access**: Private  

**Response** (200):
```json
{
  "message": "In-app notification statistics retrieved",
  "data": {
    "total": 156,
    "unread": 12,
    "byPriority": {
      "low": 50,
      "medium": 80,
      "high": 26
    }
  }
}
```

---

## Preference Endpoints

### Get Preferences

**Endpoint**: `GET /api/v1/notification-preferences`  
**Access**: Private  

**Response** (200):
```json
{
  "message": "Notification preferences retrieved successfully",
  "data": {
    "id": "uuid",
    "userId": "uuid",
    "gradeNotifications": true,
    "attendanceNotifications": true,
    "paymentNotifications": true,
    "scheduleNotifications": true,
    "enrollmentNotifications": true,
    "emailPreference": true,
    "smsPreference": false,
    "inAppPreference": true,
    "frequencyPreference": "real_time",
    "unsubscribedAt": null,
    "updatedAt": "2026-07-01T10:00:00Z"
  }
}
```

---

### Update Preferences

**Endpoint**: `PATCH /api/v1/notification-preferences`  
**Access**: Private  

**Request Body**:
```json
{
  "gradeNotifications": true,
  "attendanceNotifications": false,
  "emailPreference": true,
  "smsPreference": true,
  "frequencyPreference": "daily"
}
```

**Response** (200):
```json
{
  "message": "Notification preferences updated successfully",
  "data": {
    "id": "uuid",
    "userId": "uuid",
    "gradeNotifications": true,
    "attendanceNotifications": false,
    "emailPreference": true,
    "smsPreference": true,
    "frequencyPreference": "daily",
    "updatedAt": "2026-07-01T10:05:00Z"
  }
}
```

---

### Reset Preferences to Default

**Endpoint**: `POST /api/v1/notification-preferences/reset`  
**Access**: Private  

**Response** (200):
```json
{
  "message": "Notification preferences reset to default",
  "data": {
    "id": "uuid",
    "userId": "uuid",
    "gradeNotifications": true,
    "attendanceNotifications": true,
    "paymentNotifications": true,
    "scheduleNotifications": true,
    "enrollmentNotifications": true,
    "emailPreference": true,
    "smsPreference": false,
    "inAppPreference": true,
    "frequencyPreference": "real_time"
  }
}
```

---

### Set Notification Type Preference

**Endpoint**: `PATCH /api/v1/notification-preferences/notification-type`  
**Access**: Private  

**Request Body**:
```json
{
  "notificationType": "grade|attendance|payment|schedule|enrollment",
  "enabled": true
}
```

**Response** (200):
```json
{
  "message": "Notification type preference updated",
  "data": {
    "gradeNotifications": true,
    "updatedAt": "2026-07-01T10:05:00Z"
  }
}
```

---

### Set Channel Preference

**Endpoint**: `PATCH /api/v1/notification-preferences/channel`  
**Access**: Private  

**Request Body**:
```json
{
  "channel": "email|sms|in_app",
  "enabled": true
}
```

**Response** (200):
```json
{
  "message": "Channel preference updated",
  "data": {
    "emailPreference": true,
    "updatedAt": "2026-07-01T10:05:00Z"
  }
}
```

---

### Set Frequency Preference

**Endpoint**: `PATCH /api/v1/notification-preferences/frequency`  
**Access**: Private  

**Request Body**:
```json
{
  "frequency": "real_time|daily|weekly"
}
```

**Response** (200):
```json
{
  "message": "Frequency preference updated",
  "data": {
    "frequencyPreference": "daily",
    "updatedAt": "2026-07-01T10:05:00Z"
  }
}
```

---

### Unsubscribe from All Notifications

**Endpoint**: `POST /api/v1/notification-preferences/unsubscribe`  
**Access**: Private  

**Request Body**:
```json
{
  "reason": "Too many notifications"
}
```

**Response** (200):
```json
{
  "message": "Successfully unsubscribed from all notifications",
  "data": {
    "unsubscribedAt": "2026-07-01T10:05:00Z",
    "unsubscribeReason": "Too many notifications"
  }
}
```

---

### Resubscribe to Notifications

**Endpoint**: `POST /api/v1/notification-preferences/resubscribe`  
**Access**: Private  

**Response** (200):
```json
{
  "message": "Successfully resubscribed to notifications",
  "data": {
    "gradeNotifications": true,
    "attendanceNotifications": true,
    "unsubscribedAt": null
  }
}
```

---

### Get Preferences Summary (Admin)

**Endpoint**: `GET /api/v1/notification-preferences/summary`  
**Access**: Private (Admin Only)  

**Response** (200):
```json
{
  "message": "Notification preferences summary retrieved",
  "data": {
    "totalUsers": 1250,
    "unsubscribedUsers": 45,
    "channels": {
      "email": 1120,
      "sms": 890,
      "inApp": 1200
    },
    "frequencyPreferences": {
      "real_time": 800,
      "daily": 350,
      "weekly": 95
    }
  }
}
```

---

## Template Management

### Email Templates

#### List Email Templates

**Endpoint**: `GET /api/v1/email-templates`  
**Access**: Private (Admin)  
**Query Parameters**:
- `notificationType` (optional): Filter by type

**Response** (200):
```json
{
  "message": "Email templates retrieved successfully",
  "data": [
    {
      "id": "uuid",
      "templateName": "grade_notification_email",
      "notificationType": "grade",
      "channel": "email",
      "subject": "New Grade Posted in {{subject}}",
      "body": "Dear {{studentName}},\n\nYou have received a new grade...",
      "variables": {"studentName": "", "subject": "", "grade": ""},
      "isActive": true,
      "createdAt": "2026-07-01T10:00:00Z"
    }
  ]
}
```

#### Create Email Template

**Endpoint**: `POST /api/v1/email-templates`  
**Access**: Private (Admin)  

**Request Body**:
```json
{
  "templateName": "payment_reminder_email",
  "notificationType": "payment",
  "subject": "Payment Reminder - {{amount}} Due",
  "body": "Your payment of {{amount}} is due on {{dueDate}}",
  "variables": {
    "amount": "",
    "dueDate": "",
    "studentName": ""
  },
  "isActive": true
}
```

**Response** (201):
```json
{
  "message": "Email template created successfully",
  "data": {
    "id": "uuid",
    "templateName": "payment_reminder_email",
    "notificationType": "payment",
    "channel": "email",
    "subject": "Payment Reminder - {{amount}} Due",
    "body": "Your payment of {{amount}} is due on {{dueDate}}",
    "isActive": true
  }
}
```

#### Update Email Template

**Endpoint**: `PATCH /api/v1/email-templates/{templateId}`  
**Access**: Private (Admin)  

**Request Body**:
```json
{
  "subject": "Important: Payment Reminder - {{amount}}",
  "body": "Updated template content..."
}
```

**Response** (200):
```json
{
  "message": "Email template updated successfully",
  "data": { ... }
}
```

#### Delete Email Template

**Endpoint**: `DELETE /api/v1/email-templates/{templateId}`  
**Access**: Private (Admin)  

**Response** (200):
```json
{
  "message": "Email template deleted successfully"
}
```

---

### SMS Templates

Same endpoints as email templates with `/sms-templates` instead of `/email-templates`

---

## Error Handling

### Standard Error Response

```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "timestamp": "2026-07-01T10:00:00Z"
}
```

### Common Error Codes

| Code | Status | Description |
|------|--------|-------------|
| INVALID_INPUT | 400 | Missing or invalid request parameters |
| UNAUTHORIZED | 401 | Invalid or missing authentication |
| FORBIDDEN | 403 | Access denied |
| NOT_FOUND | 404 | Resource not found |
| CONFLICT | 409 | Resource already exists |
| INTERNAL_ERROR | 500 | Server error |
| RATE_LIMITED | 429 | Too many requests |

### Error Examples

**Missing Required Field**:
```json
{
  "error": "Missing required fields: notificationType, recipientId, message",
  "code": "INVALID_INPUT"
}
```

**Unauthorized Access**:
```json
{
  "error": "Unauthorized",
  "code": "FORBIDDEN"
}
```

**Rate Limited**:
```json
{
  "error": "Too many requests - Rate limit exceeded",
  "code": "RATE_LIMITED"
}
```

---

## Examples

### Example 1: Create Grade Notification

```bash
curl -X POST http://localhost:3000/api/v1/notifications \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "notificationType": "grade",
    "recipientId": "student-uuid",
    "subject": "New Grade Posted in Mathematics",
    "message": "You received a grade of 85/100 in Mathematics",
    "data": {
      "grade": 85,
      "subject": "Mathematics",
      "className": "10-A"
    },
    "channels": ["email", "in_app"],
    "sourceType": "grade",
    "sourceId": "grade-uuid"
  }'
```

### Example 2: Get User Preferences

```bash
curl -X GET http://localhost:3000/api/v1/notification-preferences \
  -H "Authorization: Bearer <token>"
```

### Example 3: Update Preferences

```bash
curl -X PATCH http://localhost:3000/api/v1/notification-preferences \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "emailPreference": true,
    "smsPreference": false,
    "frequencyPreference": "daily"
  }'
```

### Example 4: Get In-App Notifications

```bash
curl -X GET "http://localhost:3000/api/v1/in-app-notifications?limit=20&offset=0" \
  -H "Authorization: Bearer <token>"
```

---

## Rate Limiting

- Default: 100 requests per hour per user
- Notifications creation: 100 per hour
- Preferences update: 50 per hour
- Template management: 20 per hour (admin)

---

## Best Practices

1. **Batch Operations**: Use bulk create endpoints for multiple notifications
2. **Template Usage**: Always use templates for consistency
3. **Preference Checking**: Respect user preferences before sending
4. **Retry Logic**: Implement exponential backoff for failed deliveries
5. **Archive Old**: Regularly archive old notifications to maintain performance
6. **Monitor Delivery**: Track delivery status for critical notifications

---

## Support

For API questions or issues:
- Check the [PHASE_9_COMPLETION_SUMMARY.md](./PHASE_9_COMPLETION_SUMMARY.md)
- Review implementation in `backend/src/routes/phase9NotificationRoutes.ts`
- Check service implementations in `backend/src/services/`

---

**Last Updated**: July 1, 2026  
**Status**: ✅ Complete and Production Ready

