import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useAuth } from '@context/AuthContext';
import { logger } from '@utils/logger';

/**
 * Dashboard Screen Component
 */
const DashboardScreen: React.FC = () => {
  const { user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setIsLoading(true);
      // TODO: Fetch dashboard data from API
      logger.info('Loading dashboard data for:', user?.role);
      
      // Mock data for now
      setData({
        totalStudents: 245,
        activeClasses: 12,
        avgAttendance: 94.2,
        pendingTasks: 5,
      });
    } catch (error) {
      logger.error('Error loading dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const onRefresh = async () => {
    setIsRefreshing(true);
    await loadDashboardData();
    setIsRefreshing(false);
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.greeting}>Welcome back, {user?.firstName}!</Text>
        <Text style={styles.subtitle}>{user?.role.charAt(0).toUpperCase() + user?.role.slice(1)}</Text>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563EB" />
        </View>
      ) : (
        <View style={styles.content}>
          {/* KPI Cards */}
          <View style={styles.cardsGrid}>
            {data && (
              <>
                <View style={styles.card}>
                  <Text style={styles.cardValue}>{data.totalStudents}</Text>
                  <Text style={styles.cardLabel}>Total Students</Text>
                </View>

                <View style={styles.card}>
                  <Text style={styles.cardValue}>{data.activeClasses}</Text>
                  <Text style={styles.cardLabel}>Active Classes</Text>
                </View>

                <View style={styles.card}>
                  <Text style={styles.cardValue}>{data.avgAttendance}%</Text>
                  <Text style={styles.cardLabel}>Avg. Attendance</Text>
                </View>

                <View style={styles.card}>
                  <Text style={styles.cardValue}>{data.pendingTasks}</Text>
                  <Text style={styles.cardLabel}>Pending Tasks</Text>
                </View>
              </>
            )}
          </View>

          {/* Recent Activity Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recent Activity</Text>
            <View style={styles.activityItem}>
              <Text style={styles.activityText}>No recent activity yet</Text>
            </View>
          </View>

          {/* Quick Actions Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Quick Actions</Text>
            <View style={styles.actionButtons}>
              <View style={styles.actionButton}>
                <Text style={styles.actionIcon}>📋</Text>
                <Text style={styles.actionLabel}>Attendance</Text>
              </View>
              <View style={styles.actionButton}>
                <Text style={styles.actionIcon}>📊</Text>
                <Text style={styles.actionLabel}>Grades</Text>
              </View>
              <View style={styles.actionButton}>
                <Text style={styles.actionIcon}>💰</Text>
                <Text style={styles.actionLabel}>Fees</Text>
              </View>
              <View style={styles.actionButton}>
                <Text style={styles.actionIcon}>📅</Text>
                <Text style={styles.actionLabel}>Schedule</Text>
              </View>
            </View>
          </View>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    backgroundColor: '#2563EB',
    padding: 20,
    paddingTop: 40,
    color: 'white',
  },
  greeting: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#93C5FD',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 200,
  },
  content: {
    padding: 16,
  },
  cardsGrid: {
    display: 'flex',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    width: '48%',
    borderLeftWidth: 4,
    borderLeftColor: '#2563EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  cardValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  cardLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  activityItem: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
  },
  activityText: {
    color: '#6B7280',
    fontSize: 14,
    textAlign: 'center',
  },
  actionButtons: {
    display: 'flex',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  actionButton: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
    width: '48%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  actionIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  actionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#111827',
  },
});

export default DashboardScreen;
