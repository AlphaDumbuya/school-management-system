import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { logger } from '@utils/logger';
import dashboardService from '@services/dashboardService';
import { JWTService } from '@services/jwtService';

/**
 * WebSocket Service for Real-time Dashboard Updates
 * Manages real-time metric updates, alerts, and notifications
 *
 * SECURITY:
 *  - Every connection is authenticated on the HANDSHAKE via a verified JWT.
 *    The client cannot claim a userId/role/tenant — those are read from the
 *    token server-side only.
 *  - All rooms are namespaced by tenant (`tenant:{id}:…`) so a broadcast can
 *    never cross a school boundary.
 */

interface UserSession {
  userId: string;
  role: string;
  tenantId: string;
  socket: Socket;
  connectedAt: Date;
}

// Room-name builders — the ONLY place room names are constructed, always
// tenant-prefixed so cross-tenant delivery is impossible by construction.
const userRoom = (tenantId: string, userId: string) => `tenant:${tenantId}:user:${userId}`;
const roleRoom = (tenantId: string, role: string) => `tenant:${tenantId}:role:${role}`;

interface DashboardSubscription {
  userId: string;
  dashboardType: 'admin' | 'teacher' | 'student' | 'parent' | 'accountant' | 'admissions';
  refreshInterval: number;
}

class WebSocketService {
  private io: SocketIOServer | null = null;
  private userSessions: Map<string, UserSession> = new Map();
  private subscriptions: Map<string, DashboardSubscription> = new Map();
  private refreshIntervals: Map<string, NodeJS.Timer> = new Map();

  /**
   * Initialize WebSocket server
   */
  initialize(httpServer: HTTPServer) {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: process.env.FRONTEND_URL || 'http://localhost:5173',
        methods: ['GET', 'POST'],
        credentials: true,
      },
      transports: ['websocket', 'polling'],
    });

    // HANDSHAKE AUTH — reject any connection without a valid access token.
    // The identity (userId/role/tenant) comes ONLY from the verified token +
    // a live DB lookup — never from client-sent handshake fields. Resolving the
    // tenant/role/status from the DB (like attachUserContext does for HTTP)
    // means a suspended/moved user can't hold a socket on a stale token.
    this.io.use(async (socket, next) => {
      try {
        const token =
          (socket.handshake.auth && (socket.handshake.auth as any).token) ||
          (socket.handshake.headers['authorization'] as string | undefined)?.replace(/^Bearer\s+/i, '');
        if (!token) return next(new Error('unauthorized'));

        const payload = JWTService.verifyAccessToken(token);

        const { db } = await import('@utils/database');
        const user = await db('users')
          .where({ id: payload.userId })
          .select('id', 'role', 'tenant_id', 'status')
          .first();
        if (!user) return next(new Error('unauthorized'));
        if (String(user.status || '').trim().toLowerCase() !== 'active') {
          return next(new Error('unauthorized: inactive'));
        }
        if (!user.tenant_id) return next(new Error('unauthorized: no tenant'));

        // Stash verified identity on the socket — never trust client-sent values.
        socket.data.userId = user.id;
        socket.data.role = user.role;
        socket.data.tenantId = user.tenant_id;
        next();
      } catch {
        next(new Error('unauthorized'));
      }
    });

    this.io.on('connection', (socket) => this.handleConnection(socket));

    logger.info('WebSocket server initialized');
    return this.io;
  }

  /**
   * Handle new WebSocket connection. Identity is already verified on the
   * handshake, so we bind rooms immediately and server-side.
   */
  private handleConnection(socket: Socket) {
    const userId = socket.data.userId as string;
    const role = socket.data.role as string;
    const tenantId = socket.data.tenantId as string;

    const session: UserSession = { userId, role, tenantId, socket, connectedAt: new Date() };
    this.userSessions.set(socket.id, session);

    // Server assigns rooms — always tenant-namespaced.
    socket.join(userRoom(tenantId, userId));
    socket.join(roleRoom(tenantId, role));

    socket.emit('auth-success', { message: 'Authenticated', userId, role });
    logger.info(`Socket connected: ${socket.id} (user ${userId}, tenant ${tenantId})`);

    // Event handlers. We keep a no-op 'auth' handler for backward compatibility
    // with older clients, but it does NOT change identity (that's handshake-only).
    socket.on('auth', () => socket.emit('auth-success', { message: 'Authenticated', userId, role }));
    socket.on('subscribe-dashboard', (data) => this.handleSubscribeDashboard(socket, data));
    socket.on('unsubscribe-dashboard', (data) => this.handleUnsubscribeDashboard(socket, data));
    socket.on('request-refresh', (data) => this.handleRefreshRequest(socket, data));
    socket.on('disconnect', () => this.handleDisconnect(socket));
  }

  /**
   * Handle dashboard subscription
   */
  private async handleSubscribeDashboard(
    socket: Socket,
    data: { dashboardType: string; refreshInterval?: number }
  ) {
    try {
      const session = this.userSessions.get(socket.id);
      if (!session) {
        socket.emit('error', { message: 'Not authenticated' });
        return;
      }

      const subscriptionKey = `${session.userId}-${data.dashboardType}`;
      const refreshInterval = data.refreshInterval || 30000; // 30 seconds default

      const subscription: DashboardSubscription = {
        userId: session.userId,
        dashboardType: data.dashboardType as any,
        refreshInterval,
      };

      this.subscriptions.set(subscriptionKey, subscription);

      // Clear any existing interval
      if (this.refreshIntervals.has(subscriptionKey)) {
        clearInterval(this.refreshIntervals.get(subscriptionKey)!);
      }

      // Start refresh interval
      const interval = setInterval(async () => {
        await this.sendDashboardUpdate(socket, subscription);
      }, refreshInterval);

      this.refreshIntervals.set(subscriptionKey, interval);

      // Send initial update
      await this.sendDashboardUpdate(socket, subscription);

      socket.emit('subscription-success', {
        message: `Subscribed to ${data.dashboardType} dashboard`,
        dashboardType: data.dashboardType,
        refreshInterval,
      });

      logger.info(`User ${session.userId} subscribed to ${data.dashboardType} dashboard`);
    } catch (error) {
      logger.error(`Subscription error: ${error}`);
      socket.emit('subscription-error', { message: 'Failed to subscribe' });
    }
  }

  /**
   * Handle dashboard unsubscription
   */
  private handleUnsubscribeDashboard(socket: Socket, data: { dashboardType: string }) {
    try {
      const session = this.userSessions.get(socket.id);
      if (!session) return;

      const subscriptionKey = `${session.userId}-${data.dashboardType}`;

      // Clear interval
      if (this.refreshIntervals.has(subscriptionKey)) {
        clearInterval(this.refreshIntervals.get(subscriptionKey)!);
        this.refreshIntervals.delete(subscriptionKey);
      }

      // Remove subscription
      this.subscriptions.delete(subscriptionKey);

      socket.emit('unsubscription-success', {
        message: `Unsubscribed from ${data.dashboardType} dashboard`,
      });

      logger.info(`User ${session.userId} unsubscribed from ${data.dashboardType} dashboard`);
    } catch (error) {
      logger.error(`Unsubscription error: ${error}`);
    }
  }

  /**
   * Handle manual refresh request
   */
  private async handleRefreshRequest(socket: Socket, data: { dashboardType: string }) {
    try {
      const session = this.userSessions.get(socket.id);
      if (!session) {
        socket.emit('error', { message: 'Not authenticated' });
        return;
      }

      const subscription: DashboardSubscription = {
        userId: session.userId,
        dashboardType: data.dashboardType as any,
        refreshInterval: 30000,
      };

      await this.sendDashboardUpdate(socket, subscription);
    } catch (error) {
      logger.error(`Refresh error: ${error}`);
      socket.emit('error', { message: 'Refresh failed' });
    }
  }

  /**
   * Send dashboard update to socket
   */
  private async sendDashboardUpdate(socket: Socket, subscription: DashboardSubscription) {
    try {
      switch (subscription.dashboardType) {
        case 'admin':
          const adminData = await dashboardService.getCompleteDashboard();
          socket.emit('dashboard-update', {
            dashboardType: 'admin',
            data: adminData,
            timestamp: new Date().toISOString(),
          });
          break;

        case 'teacher':
          // Teacher dashboard data
          socket.emit('dashboard-update', {
            dashboardType: 'teacher',
            data: { /* teacher-specific data */ },
            timestamp: new Date().toISOString(),
          });
          break;

        case 'student':
          // Student dashboard data
          socket.emit('dashboard-update', {
            dashboardType: 'student',
            data: { /* student-specific data */ },
            timestamp: new Date().toISOString(),
          });
          break;

        default:
          logger.warn(`Unknown dashboard type: ${subscription.dashboardType}`);
      }
    } catch (error) {
      logger.error(`Error sending dashboard update: ${error}`);
      socket.emit('error', { message: 'Failed to get update' });
    }
  }

  /**
   * Handle disconnection
   */
  private handleDisconnect(socket: Socket) {
    const session = this.userSessions.get(socket.id);
    if (session) {
      logger.info(`User disconnected: ${session.userId}`);
      this.userSessions.delete(socket.id);

      // Clear all subscriptions for this user
      const keysToDelete: string[] = [];
      this.subscriptions.forEach((sub, key) => {
        if (sub.userId === session.userId) {
          keysToDelete.push(key);
          if (this.refreshIntervals.has(key)) {
            clearInterval(this.refreshIntervals.get(key)!);
            this.refreshIntervals.delete(key);
          }
        }
      });
      keysToDelete.forEach((key) => this.subscriptions.delete(key));
    }
  }

  /**
   * Broadcast an alert to a role WITHIN a specific tenant. tenantId is required
   * so an alert can never fan out across schools.
   */
  broadcastAlert(tenantId: string, role: string, alert: any) {
    if (this.io && tenantId) {
      this.io.to(roleRoom(tenantId, role)).emit('new-alert', {
        alert,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Broadcast a notification to a specific user WITHIN a tenant.
   */
  broadcastUserNotification(tenantId: string, userId: string, notification: any) {
    if (this.io && tenantId) {
      this.io.to(userRoom(tenantId, userId)).emit('new-notification', {
        notification,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Get active user count
   */
  getActiveUserCount(): number {
    return this.userSessions.size;
  }

  /**
   * Get session info
   */
  getSessionInfo(socketId: string): UserSession | undefined {
    return this.userSessions.get(socketId);
  }
}

export const websocketService = new WebSocketService();
