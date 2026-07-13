# Phase 2.4 Quick Reference - SMS & WhatsApp Integration

## 🚀 Quick Start

### 1. Setup Provider
```bash
curl -X POST http://localhost:3000/api/v1/sms-whatsapp/providers \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "provider_name": "twilio",
    "provider_type": "sms",
    "api_key": "AC...",
    "api_secret": "token...",
    "account_sid": "ACxxxxx",
    "auth_token": "token...",
    "phone_number": "+1234567890"
  }'
```

### 2. Create Template
```bash
curl -X POST http://localhost:3000/api/v1/sms-whatsapp/templates \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "template_name": "Event Reminder",
    "template_type": "event_reminder",
    "channel": "sms",
    "sms_content": "Reminder: {{event_name}} on {{date}} at {{time}}"
  }'
```

### 3. Send Message
```bash
curl -X POST http://localhost:3000/api/v1/sms-whatsapp/messages/send \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "recipient_id": "user-uuid",
    "template_id": "template-uuid",
    "channel": "sms",
    "template_variables": {
      "event_name": "Mathematics Class",
      "date": "2026-07-15",
      "time": "10:00 AM"
    }
  }'
```

---

## 📋 Key Files

| File | Purpose | Lines |
|------|---------|-------|
| `026_phase2_4_sms_whatsapp.ts` | Database migration (9 tables) | 400+ |
| `smsWhatsAppProviderService.ts` | Provider management | 280 |
| `smsWhatsAppService.ts` | Message sending & tracking | 380 |
| `phoneNumberService.ts` | Phone number verification | 320 |
| `smsWhatsAppTemplateService.ts` | Message templates | 340 |
| `smsWhatsAppSchedulingService.ts` | Scheduling & analytics | 380 |
| `smsWhatsAppRoutes.ts` | 44 API endpoints | 550 |
| `sms-whatsapp.ts` | TypeScript types | 400+ |

---

## 🎯 Core Concepts

### Message Channels
- **SMS**: Text messages (160 chars/part)
- **WhatsApp**: WhatsApp Business API messages

### Message Status Flow
```
pending → sent → delivered → (optionally: read)
         ↘ failed/bounced (retry possible)
```

### Template Types
1. `event_reminder` - Event notifications
2. `attendance_alert` - Attendance updates
3. `grade_notification` - Grade reports
4. `payment_reminder` - Fee reminders
5. `disciplinary_action` - Discipline notifications
6. `enrollment_confirmation` - Enrollment confirmations
7. `schedule_update` - Schedule changes
8. `general` - General purpose messages

### Providers Supported
- **Twilio** - SMS/WhatsApp via Twilio API
- **Brevo** - SMS/Email platform
- **MessageBird** - Global SMS provider
- **Custom** - Custom provider integration

---

## 📊 Database Tables (9 tables)

```
sms_whatsapp_providers
├── Provider configurations (Twilio, Brevo, etc.)

sms_whatsapp_templates
├── Message templates with variables

sms_whatsapp_messages
├── Sent messages with status tracking

sms_whatsapp_delivery_logs
├── Detailed delivery status history

phone_numbers
├── User phone number management

message_schedules
├── Scheduled & recurring messages

sms_whatsapp_opt_outs
├── User opt-out preferences

messaging_analytics
├── Daily aggregated statistics

messaging_user_stats
└── Per-user statistics
```

---

## 🔌 API Endpoints Summary

### Providers (8)
- `POST /providers` - Create
- `GET /providers` - List
- `GET /providers/:id` - Get details
- `PATCH /providers/:id` - Update
- `PATCH /providers/:id/toggle` - Toggle status
- `PUT /providers/:id/set-primary` - Set primary
- `POST /providers/:id/test` - Test connection
- `DELETE /providers/:id` - Delete

### Templates (5)
- `POST /templates` - Create
- `GET /templates` - List
- `GET /templates/:id` - Get
- `PATCH /templates/:id` - Update
- `GET /templates/:id/stats` - Statistics

### Messages (5)
- `POST /messages/send` - Send
- `POST /messages/bulk-send` - Bulk send
- `GET /messages` - List
- `GET /messages/:id` - Get status
- `POST /messages/:id/retry` - Retry

### Phone Numbers (5)
- `POST /phone-numbers` - Add
- `GET /phone-numbers` - List
- `POST /phone-numbers/:id/verify` - Verify
- `POST /phone-numbers/:id/resend-code` - Resend OTP
- `DELETE /phone-numbers/:id` - Delete

### Schedules & Analytics (6)
- `POST /schedules` - Create schedule
- `GET /schedules` - List
- `PATCH /schedules/:id` - Update
- `DELETE /schedules/:id` - Delete
- `GET /analytics` - Get analytics
- `GET /user-stats/:userId` - User stats

---

## 🔐 Security Checklist

✅ Credentials encrypted with AES-256  
✅ Opt-out status enforced before sending  
✅ Phone number verification required  
✅ Role-based access control  
✅ Webhook payload validation needed  
✅ Attempt limiting on verification  

---

## 📈 Usage Statistics

### Message Tracking
- Total messages sent (per provider, channel, date)
- Delivery rate calculation
- Cost tracking

### Query Example
```typescript
GET /api/v1/sms-whatsapp/analytics
  ?channel=sms
  &date_from=2026-07-01
  &date_to=2026-07-31

Response:
{
  "success": true,
  "data": [
    {
      "analytics_date": "2026-07-13",
      "channel": "sms",
      "provider_name": "twilio",
      "messages_sent": 1500,
      "messages_delivered": 1485,
      "messages_failed": 15,
      "total_cost": 15.00,
      "delivery_rate": "99%"
    }
  ]
}
```

---

## 🔄 Integration with Other Phases

### Phase 2.2 - Events
- Event reminders via SMS/WhatsApp
- Automatic notifications for event updates

### Phase 2.3 - Discipline
- Disciplinary action notifications
- Parent notifications for infractions
- Appeal status updates

### Phase 9 - Notifications
- SMS/WhatsApp as alternative channels
- Unified notification preferences

### Phase 18 - Audit
- Message delivery audit logs
- Cost tracking
- Failed message logging

---

## 🛠️ Troubleshooting

### Provider Connection Failed
```bash
POST /api/v1/sms-whatsapp/providers/{id}/test
```
Check API credentials in database (encrypted).

### Message Failed to Send
1. Check provider is enabled
2. Verify recipient phone number is verified
3. Check opt-out status
4. Review provider delivery logs

### Template Variables Not Replacing
Ensure template has `{{variable}}` format and variables provided in request.

### Scheduled Message Not Sending
Check `message_schedules.next_send_time` is in the past and status is 'active'.

---

## 📝 Common Requests

### Send Event Reminder
```json
POST /api/v1/sms-whatsapp/messages/send
{
  "recipient_id": "student-uuid",
  "template_id": "event_reminder_template",
  "channel": "sms",
  "template_variables": {
    "event_name": "Science Fair",
    "date": "2026-07-20",
    "location": "Main Hall"
  },
  "source_type": "event",
  "source_id": "event-uuid"
}
```

### Schedule Daily Reminder
```json
POST /api/v1/sms-whatsapp/schedules
{
  "recipient_id": "parent-uuid",
  "template_id": "attendance_alert_template",
  "channel": "whatsapp",
  "schedule_type": "daily",
  "first_send_time": "2026-07-14T09:00:00Z",
  "recurrence_pattern": "daily",
  "max_occurrences": 30
}
```

### Bulk Send to Class
```json
POST /api/v1/sms-whatsapp/messages/bulk-send
{
  "recipient_ids": ["student1", "student2", "student3"],
  "template_id": "grade_notification",
  "channel": "sms",
  "template_variables": {
    "subject": "Mathematics",
    "grade": "A",
    "term": "Term 2"
  }
}
```

---

## 🚀 Performance Tips

1. **Batch Messages** - Use bulk-send for multiple recipients
2. **Schedule Off-Peak** - Send notifications during off-hours if possible
3. **Template Reuse** - Create reusable templates for common messages
4. **Monitor Costs** - Track spending via analytics endpoint
5. **Clean Old Data** - Archive messages after 90 days

---

## 📞 Support Contacts

### Twilio
- Docs: https://www.twilio.com/docs
- API Reference: https://www.twilio.com/docs/sms/api

### Brevo
- Docs: https://developers.brevo.com
- API Reference: https://developers.brevo.com/docs

### MessageBird
- Docs: https://developers.messagebird.com
- API Reference: https://developers.messagebird.com/api

---

**Last Updated**: July 13, 2026  
**Status**: Production Ready
