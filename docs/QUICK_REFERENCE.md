# Quick Reference - School Management System

## Project Status
- **Overall**: 31% Complete (Phase 1-3 of 24)
- **Last Updated**: June 3, 2026
- **Team Size**: 1 developer (Kiro AI)
- **Schedule**: ✅ On Target

## Quick Stats
| Metric | Value |
|--------|-------|
| API Endpoints | 50+ |
| Database Tables | 16 |
| Service Methods | 49+ |
| Lines of Code | 8,500+ |
| Test Cases | 29+ |
| Duration | 4 weeks |

## Key Commands
```bash
npm install              # Install dependencies
npm run migrate          # Run database migrations
npm run test            # Run tests
npm run build           # Build TypeScript
npm run dev             # Start development server
npm run lint            # Run ESLint
npm run format          # Format with Prettier
docker-compose up       # Start Docker services
```

## API Base URL
`http://localhost:3000/api/v1`

## Authentication
```bash
# Get token
POST /auth/login
{ "email": "user@school.com", "password": "Password123!" }

# Use token
Authorization: Bearer {token}
```

## Main Resources
| Resource | Endpoints | Status |
|----------|-----------|--------|
| Students | 9 | ✅ Complete |
| Guardians | 5 | ✅ Complete |
| Classes | 7 | ✅ Complete |
| Subjects | 6 | ✅ Complete |
| Enrollments | 5 | ✅ Complete |
| Auth | 6 | ✅ Complete (Phase 2) |
| Users | 6 | ✅ Complete (Phase 2) |
| RBAC | 4 | ✅ Complete (Phase 2) |

## File Structure
```
backend/src/
├── services/     Business logic
├── routes/       HTTP handlers
├── middleware/   Auth, logging, errors
├── types/        TypeScript interfaces
└── utils/        Helpers
```

## Recent Completions
- ✅ Phase 1: Infrastructure (Week 1-2)
- ✅ Phase 2: Authentication (Week 3-4)
- ✅ Phase 3: Data Models (Week 4)

## Next Phases
| Phase | Task | Duration | Start |
|-------|------|----------|-------|
| 4 | Enrollment Workflows | 1 week | June 10 |
| 5 | Grades | 1 week | June 17 |
| 6 | Attendance | 1 week | June 24 |
| 7-24 | Features & UI | 20 weeks | July 1 |

## Important Documents
- `MASTER_STATUS.md` - Overall project status
- `docs/PHASE_3_SUMMARY.md` - Latest phase details
- `IMPLEMENTATION_GUIDE.md` - Setup instructions

## Database Connection
- **Host**: localhost (dev) or Neon (prod)
- **Port**: 5432
- **Database**: school_management
- **User**: school_admin

## Key Roles
- Admin: Full system access
- Principal: School management
- Teacher: Class & grade management
- Student: View own records
- Parent: View child records

## Security Features
- ✅ JWT authentication
- ✅ RBAC authorization
- ✅ Input validation
- ✅ SQL injection prevention
- ✅ Audit logging
- ✅ Soft delete support

## Testing
```bash
npm run test                                    # All tests
npm run test -- studentService.test.ts         # Specific test
npm run test:coverage                          # Coverage report
npm run test:watch                             # Watch mode
```

## Current Team Focus
Building Phase 4: Student Enrollment and Management
- Enrollment request workflow
- Bulk import/export
- Audit trails
- Notifications

## Contact Points
- Main entry: `backend/src/index.ts`
- Auth pattern: `backend/src/middleware/authMiddleware.ts`
- Service example: `backend/src/services/studentService.ts`
- Route example: `backend/src/routes/studentRoutes.ts`

## Deployment
- Development: `npm run dev`
- Production: `npm start`
- Docker: `docker-compose up`
- Database: Automatic migrations on startup

## Next Checkpoint
- **Date**: June 14, 2026
- **Milestone**: Phase 4 Complete
- **Deliverables**: Enrollment workflows, bulk import, export

---

**For detailed information, see `MASTER_STATUS.md` or phase-specific documents in `docs/`**

