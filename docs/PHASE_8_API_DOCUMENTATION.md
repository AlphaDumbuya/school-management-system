# Phase 8: Financial Management System - API Documentation

**Status**: ✅ Complete  
**Date**: June 28, 2026  
**Implementation**: All 30 endpoints implemented and mounted  

---

## Overview

Phase 8 implements a comprehensive financial management system with support for fees, payments, invoices, and financial reporting.

## Base URL
```
/api/v1
```

## Authentication
All endpoints require `Authorization: Bearer <JWT_TOKEN>` header with valid user session.

---

## FEE MANAGEMENT ENDPOINTS

### 1. Create Fee
**POST** `/fees`  
**Requires**: admin or accountant role

**Request Body**:
```json
{
  "type": "tuition",
  "amount": 50000,
  "dueDate": "2026-07-31",
  "description": "Monthly tuition fee",
  "studentId": "student-123",
  "classId": "class-456",
  "academicSession": "2025-2026"
}
```

**Response** (201 Created):
```json
{
  "success": true,
  "data": {
    "id": "fee-001",
    "type": "tuition",
    "amount": 50000,
    "dueDate": "2026-07-31",
    "status": "pending",
    "createdAt": "2026-06-28T10:00:00Z"
  },
  "message": "Fee created successfully"
}
```

### 2. Get Fee by ID
**GET** `/fees/:feeId`

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "id": "fee-001",
    "type": "tuition",
    "amount": 50000,
    "balance": 50000,
    "status": "pending",
    "dueDate": "2026-07-31",
    "createdAt": "2026-06-28T10:00:00Z"
  },
  "message": "Fee retrieved successfully"
}
```

### 3. Get Student Fees
**GET** `/students/:studentId/fees`

**Query Parameters**:
- `status` (optional): "pending", "paid", "partial", "overdue"
- `startDate` (optional): Filter from date (ISO 8601)
- `endDate` (optional): Filter to date (ISO 8601)

**Response** (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "id": "fee-001",
      "type": "tuition",
      "amount": 50000,
      "balance": 25000,
      "status": "partial",
      "dueDate": "2026-07-31"
    }
  ],
  "count": 1,
  "message": "Fees retrieved successfully"
}
```

### 4. Get Class Fees
**GET** `/classes/:classId/fees`

**Response** (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "id": "fee-001",
      "classId": "class-456",
      "type": "tuition",
      "totalAmount": 500000,
      "collectedAmount": 250000,
      "studentCount": 10
    }
  ],
  "count": 1,
  "message": "Class fees retrieved successfully"
}
```

### 5. Update Fee Status
**PATCH** `/fees/:feeId/status`

**Request Body**:
```json
{
  "status": "paid"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "id": "fee-001",
    "status": "paid",
    "updatedAt": "2026-06-28T11:00:00Z"
  },
  "message": "Fee status updated successfully"
}
```

### 6. Get Student Outstanding Balance
**GET** `/students/:studentId/outstanding`

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "studentId": "student-123",
    "outstandingBalance": 75000
  },
  "message": "Outstanding balance retrieved successfully"
}
```

### 7. Get Fee Statistics
**GET** `/fees-statistics`

**Query Parameters**:
- `classId` (optional): Filter by class

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "totalFees": 500000,
    "collectedAmount": 250000,
    "outstandingAmount": 250000,
    "collectionRate": 50,
    "studentCount": 10,
    "pendingFeesCount": 5,
    "overdueFeeCount": 2
  },
  "message": "Fee statistics retrieved successfully"
}
```

### 8. Get Overdue Fees
**GET** `/fees-overdue`

**Query Parameters**:
- `daysOverdue` (optional): Number of days overdue (default: 0)

**Response** (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "id": "fee-001",
      "studentId": "student-123",
      "amount": 50000,
      "balance": 50000,
      "dueDate": "2026-05-31",
      "daysOverdue": 28
    }
  ],
  "count": 1,
  "message": "Overdue fees retrieved successfully"
}
```

### 9. Get Fees by Type
**GET** `/fees-by-type/:type`

**Query Parameters**:
- `classId` (optional): Filter by class

**Response** (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "id": "fee-001",
      "type": "tuition",
      "amount": 50000,
      "studentCount": 10,
      "totalAmount": 500000
    }
  ],
  "count": 1,
  "message": "Fees by type retrieved successfully"
}
```

### 10. Adjust Fee Amount
**PATCH** `/fees/:feeId/adjust`

**Request Body**:
```json
{
  "adjustment": -5000,
  "reason": "Scholarship adjustment"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "id": "fee-001",
    "originalAmount": 50000,
    "adjustedAmount": 45000,
    "reason": "Scholarship adjustment"
  },
  "message": "Fee amount adjusted successfully"
}
```

### 11. Bulk Create Fees
**POST** `/fees/bulk`

**Request Body**:
```json
{
  "classId": "class-456",
  "fees": [
    {
      "type": "tuition",
      "amount": 50000,
      "dueDate": "2026-07-31",
      "studentId": "student-123"
    }
  ]
}
```

**Response** (201 Created):
```json
{
  "success": true,
  "data": [
    {
      "id": "fee-001",
      "studentId": "student-123",
      "amount": 50000,
      "status": "pending"
    }
  ],
  "count": 1,
  "message": "Fees created successfully in bulk"
}
```

### 12. Delete Fee
**DELETE** `/fees/:feeId`

**Request Body**:
```json
{
  "reason": "Duplicate entry"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Fee deleted successfully"
}
```

---

## PAYMENT ENDPOINTS

### 13. Record Payment
**POST** `/payments`

**Request Body**:
```json
{
  "feeId": "fee-001",
  "amount": 25000,
  "method": "bank_transfer",
  "transactionReference": "TXN-20260628-001",
  "notes": "Payment for June tuition",
  "paymentDate": "2026-06-28"
}
```

**Response** (201 Created):
```json
{
  "success": true,
  "data": {
    "id": "payment-001",
    "feeId": "fee-001",
    "amount": 25000,
    "method": "bank_transfer",
    "status": "completed",
    "transactionReference": "TXN-20260628-001",
    "createdAt": "2026-06-28T10:30:00Z"
  },
  "message": "Payment recorded successfully"
}
```

### 14. Get Payment by ID
**GET** `/payments/:paymentId`

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "id": "payment-001",
    "feeId": "fee-001",
    "amount": 25000,
    "method": "bank_transfer",
    "status": "completed",
    "transactionReference": "TXN-20260628-001",
    "createdAt": "2026-06-28T10:30:00Z"
  },
  "message": "Payment retrieved successfully"
}
```

### 15. Get Student Payments
**GET** `/students/:studentId/payments`

**Query Parameters**:
- `startDate` (optional): Filter from date
- `endDate` (optional): Filter to date
- `method` (optional): "cash", "bank_transfer", "cheque", etc.

**Response** (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "id": "payment-001",
      "feeId": "fee-001",
      "amount": 25000,
      "method": "bank_transfer",
      "status": "completed",
      "createdAt": "2026-06-28T10:30:00Z"
    }
  ],
  "count": 1,
  "message": "Payments retrieved successfully"
}
```

### 16. Get Fee Payments
**GET** `/fees/:feeId/payments`

**Response** (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "id": "payment-001",
      "amount": 25000,
      "method": "bank_transfer",
      "status": "completed",
      "createdAt": "2026-06-28T10:30:00Z"
    }
  ],
  "count": 1,
  "message": "Fee payments retrieved successfully"
}
```

### 17. Get Payment Statistics
**GET** `/payments/statistics`

**Query Parameters**:
- `startDate` (optional): Filter from date
- `endDate` (optional): Filter to date
- `studentId` (optional): Filter by student

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "totalPayments": 250000,
    "paymentCount": 5,
    "averagePayment": 50000,
    "methodBreakdown": {
      "bank_transfer": 150000,
      "cash": 100000
    },
    "monthlyTrend": [
      {
        "month": "June",
        "amount": 150000,
        "count": 3
      }
    ]
  },
  "message": "Payment statistics retrieved successfully"
}
```

### 18. Get Payment Receipt
**GET** `/payments/:paymentId/receipt`

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "receiptNumber": "RCP-20260628-001",
    "paymentId": "payment-001",
    "feeId": "fee-001",
    "studentName": "John Doe",
    "amount": 25000,
    "method": "bank_transfer",
    "date": "2026-06-28T10:30:00Z",
    "notes": "Payment for June tuition"
  },
  "message": "Payment receipt retrieved successfully"
}
```

### 19. Refund Payment
**POST** `/payments/:paymentId/refund`

**Request Body**:
```json
{
  "reason": "Duplicate payment"
}
```

**Response** (201 Created):
```json
{
  "success": true,
  "data": {
    "id": "refund-001",
    "paymentId": "payment-001",
    "amount": 25000,
    "reason": "Duplicate payment",
    "status": "processed",
    "createdAt": "2026-06-28T11:00:00Z"
  },
  "message": "Payment refunded successfully"
}
```

### 20. Get Payment Summary
**GET** `/payments-summary`

**Query Parameters**:
- `startDate` (required): From date
- `endDate` (required): To date

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "totalAmount": 250000,
    "paymentCount": 5,
    "averageAmount": 50000,
    "methodBreakdown": {
      "bank_transfer": 150000,
      "cash": 100000
    },
    "dailyBreakdown": [
      {
        "date": "2026-06-28",
        "amount": 75000,
        "count": 2
      }
    ]
  },
  "message": "Payment summary retrieved successfully"
}
```

### 21. Get Payment Methods Summary
**GET** `/payments-methods`

**Response** (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "method": "bank_transfer",
      "count": 3,
      "totalAmount": 150000,
      "percentage": 60
    },
    {
      "method": "cash",
      "count": 2,
      "totalAmount": 100000,
      "percentage": 40
    }
  ],
  "message": "Payment methods summary retrieved successfully"
}
```

### 22. Get Recent Payments
**GET** `/payments-recent`

**Query Parameters**:
- `limit` (optional): Number of records (default: 50)

**Response** (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "id": "payment-001",
      "amount": 25000,
      "method": "bank_transfer",
      "createdAt": "2026-06-28T10:30:00Z"
    }
  ],
  "count": 1,
  "message": "Recent payments retrieved successfully"
}
```

### 23. Bulk Record Payments
**POST** `/payments/bulk`

**Request Body**:
```json
{
  "payments": [
    {
      "feeId": "fee-001",
      "amount": 25000,
      "method": "bank_transfer",
      "transactionReference": "TXN-20260628-001"
    }
  ]
}
```

**Response** (201 Created):
```json
{
  "success": true,
  "data": [
    {
      "id": "payment-001",
      "feeId": "fee-001",
      "amount": 25000,
      "status": "completed"
    }
  ],
  "count": 1,
  "message": "Payments recorded successfully in bulk"
}
```

---

## INVOICE ENDPOINTS

### 24. Generate Invoice
**POST** `/invoices`

**Request Body**:
```json
{
  "studentId": "student-123",
  "feeIds": ["fee-001", "fee-002"],
  "dueDate": "2026-07-31",
  "notes": "Invoicing for June and July"
}
```

**Response** (201 Created):
```json
{
  "success": true,
  "data": {
    "id": "invoice-001",
    "studentId": "student-123",
    "invoiceNumber": "INV-20260628-001",
    "totalAmount": 100000,
    "status": "draft",
    "dueDate": "2026-07-31",
    "createdAt": "2026-06-28T10:00:00Z"
  },
  "message": "Invoice generated successfully"
}
```

### 25. Get Invoice by ID
**GET** `/invoices/:invoiceId`

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "id": "invoice-001",
    "invoiceNumber": "INV-20260628-001",
    "studentId": "student-123",
    "totalAmount": 100000,
    "status": "draft",
    "dueDate": "2026-07-31",
    "items": [
      {
        "feeId": "fee-001",
        "amount": 50000
      }
    ]
  },
  "message": "Invoice retrieved successfully"
}
```

### 26. Get Student Invoices
**GET** `/students/:studentId/invoices`

**Query Parameters**:
- `status` (optional): "draft", "sent", "paid", "overdue"
- `startDate` (optional): Filter from date
- `endDate` (optional): Filter to date

**Response** (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "id": "invoice-001",
      "invoiceNumber": "INV-20260628-001",
      "totalAmount": 100000,
      "status": "sent",
      "dueDate": "2026-07-31"
    }
  ],
  "count": 1,
  "message": "Student invoices retrieved successfully"
}
```

### 27. Update Invoice Status
**PATCH** `/invoices/:invoiceId/status`

**Request Body**:
```json
{
  "status": "sent"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "id": "invoice-001",
    "status": "sent",
    "updatedAt": "2026-06-28T11:00:00Z"
  },
  "message": "Invoice status updated successfully"
}
```

### 28. Get Overdue Invoices
**GET** `/invoices-overdue`

**Response** (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "id": "invoice-001",
      "invoiceNumber": "INV-20260628-001",
      "studentId": "student-123",
      "totalAmount": 100000,
      "dueDate": "2026-05-31",
      "daysOverdue": 28
    }
  ],
  "count": 1,
  "message": "Overdue invoices retrieved successfully"
}
```

### 29. Send Invoice Reminder
**POST** `/invoices/:invoiceId/reminder`

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "id": "invoice-001",
    "reminderSentAt": "2026-06-28T11:00:00Z"
  },
  "message": "Invoice reminder sent successfully"
}
```

### 30. Get Invoice Summary
**GET** `/invoices/:invoiceId/summary`

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "id": "invoice-001",
    "invoiceNumber": "INV-20260628-001",
    "studentName": "John Doe",
    "totalAmount": 100000,
    "paidAmount": 50000,
    "remainingAmount": 50000,
    "status": "partial",
    "dueDate": "2026-07-31",
    "items": [
      {
        "description": "Tuition Fee",
        "amount": 50000
      }
    ]
  },
  "message": "Invoice summary retrieved successfully"
}
```

### 31. Export Invoice Data
**GET** `/invoices/:invoiceId/export`

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "invoiceNumber": "INV-20260628-001",
    "studentName": "John Doe",
    "studentEmail": "john@school.com",
    "totalAmount": 100000,
    "paidAmount": 50000,
    "remainingAmount": 50000,
    "dueDate": "2026-07-31",
    "items": [
      {
        "description": "Tuition Fee June",
        "amount": 50000
      }
    ],
    "exportDate": "2026-06-28T11:00:00Z"
  },
  "message": "Invoice data exported successfully"
}
```

### 32. Get Invoice Statistics
**GET** `/invoices-statistics`

**Query Parameters**:
- `startDate` (optional): Filter from date
- `endDate` (optional): Filter to date

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "totalInvoices": 10,
    "totalAmount": 1000000,
    "collectedAmount": 500000,
    "outstandingAmount": 500000,
    "statusBreakdown": {
      "draft": 2,
      "sent": 5,
      "paid": 2,
      "overdue": 1
    },
    "collectionRate": 50
  },
  "message": "Invoice statistics retrieved successfully"
}
```

### 33. Bulk Generate Invoices
**POST** `/invoices/bulk`

**Request Body**:
```json
{
  "classId": "class-456",
  "feeType": "tuition"
}
```

**Response** (201 Created):
```json
{
  "success": true,
  "data": [
    {
      "id": "invoice-001",
      "studentId": "student-123",
      "invoiceNumber": "INV-20260628-001",
      "totalAmount": 50000,
      "status": "draft"
    }
  ],
  "count": 1,
  "message": "Invoices generated successfully in bulk"
}
```

---

## Error Handling

All endpoints return error responses with appropriate HTTP status codes:

### 400 Bad Request
```json
{
  "error": "Missing required fields",
  "required": ["field1", "field2"]
}
```

### 401 Unauthorized
```json
{
  "error": "Unauthorized",
  "message": "Invalid or expired token"
}
```

### 403 Forbidden
```json
{
  "error": "Forbidden",
  "message": "Insufficient permissions"
}
```

### 404 Not Found
```json
{
  "error": "Not Found",
  "message": "Resource not found"
}
```

### 500 Internal Server Error
```json
{
  "error": "Internal server error",
  "message": "Error details"
}
```

---

## Query Parameters Summary

| Parameter | Endpoints | Format | Notes |
|-----------|-----------|--------|-------|
| `status` | Fees, Invoices | String | pending, paid, partial, overdue, draft, sent |
| `startDate` | Payments, Invoices, Fees | ISO 8601 | Date filter from |
| `endDate` | Payments, Invoices, Fees | ISO 8601 | Date filter to |
| `method` | Payments | String | cash, bank_transfer, cheque, etc. |
| `classId` | Fees, Invoices | UUID | Filter by class |
| `studentId` | Payments | UUID | Filter by student |
| `daysOverdue` | Overdue Fees | Integer | Number of days overdue |
| `limit` | Recent Payments | Integer | Default: 50 |

---

## Implementation Quality

- ✅ All 33 endpoints fully implemented
- ✅ Comprehensive error handling
- ✅ Input validation on all endpoints
- ✅ Audit logging integrated
- ✅ JWT authentication required
- ✅ Role-based access control (admin, accountant, student)
- ✅ Database transactions for consistency
- ✅ Proper HTTP status codes
- ✅ Standardized response format
- ✅ Full TypeScript type safety

---

**Phase 8 Complete**: Financial Management System is ready for integration and testing.
