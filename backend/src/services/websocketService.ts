import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { logger } from '@utils/logger';
import dashboardService from '@services/dashboardService';

/**
 * WebSocket Service for Real-time Dashboard Updates
 * Manages real-time metric updates, alerts, and notifications
 */

interface UserSession {
  userId: string;
  role: string;
  socket: Socket;
  connectedAt: Date;
}

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

    this.io.on('connection', (socket) => this.handleConnection(socket));

    logger.info('WebSocket server initialized');
    return this.io;
  }

  /**
   * Handle new WebSocket connection
   */
  private handleConnection(socket: Socket) {
    logger.info(`User connected: ${socket.id}`);

    // Event handlers
    socket.on('auth', (data) => this.handleAuth(socket, data));
    socket.on('subscribe-dashboard', (data) => this.handleSubscribeDashboard(socket, data));
    socket.on('unsubscribe-dashboard', (data) => this.handleUnsubscribeDashboard(socket, data));
    socket.on('request-refresh', (data) => this.handleRefreshRequest(socket, data));
    socket.on('disconnect', () => this.handleDisconnect(socket));
  }

  /**
   * Handle authentication
   */
  private handleAuth(socket: Socket, data: { userId: string; role: string; token: string }) {
    try {
      // Verify JWT token (simplified - in production, use proper JWT verification)
      const { userId, role } = data;

      const session: UserSession = {
        userId,
        role,
        socket,
        connectedAt: new Date(),
      };

      this.userSessions.set(socket.id, session);
      socket.join(`user-${userId}`);
      socket.join(`role-${role}`);

      socket.emit('auth-success', {
        message: 'Authenticated successfully',
        userId,
        role,
      });

      logger.info(`User authenticated: ${userId} (${role})`);
    } catch (error) {
      logger.error(`Authentication error: ${error}`);
      socket.emit('auth-error', { message: 'Authentication failed' });
    }
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
   * Broadcast alert to specific role
   */
  broadcastAlert(role: string, alert: any) {
    if (this.io) {
      this.io.to(`role-${role}`).emit('new-alert', {
        alert,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Broadcast notification to specific user
   */
  broadcastUserNotification(userId: string, notification: any) {
    if (this.io) {
      this.io.to(`user-${userId}`).emit('new-notification', {
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
