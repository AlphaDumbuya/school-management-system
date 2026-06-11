import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { logger } from '@utils/logger';

const StudentDetailScreen: React.FC = ({ route }: any) => {
  const { studentId } = route.params;
  const [student, setStudent] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadStudentDetails();
  }, [studentId]);

  const loadStudentDetails = async () => {
    try {
      // TODO: Fetch from API
      logger.info('Loading student details for:', studentId);
    } catch (error) {
      logger.error('Error loading student details:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.studentName}>{student?.name || 'Student Details'}</Text>
        <Text style={styles.studentId}>{student?.id || studentId}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Information</Text>
        <View style={styles.infoItem}>
          <Text style={styles.label}>Email</Text>
          <Text style={styles.value}>{student?.email || 'N/A'}</Text>
        </View>
        <View style={styles.infoItem}>
          <Text style={styles.label}>Class</Text>
          <Text style={styles.value}>{student?.class || 'N/A'}</Text>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    backgroundColor: '#2563EB',
    padding: 20,
    color: 'white',
  },
  studentName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 4,
  },
  studentId: {
    fontSize: 14,
    color: '#93C5FD',
  },
  section: {
    padding: 16,
    backgroundColor: 'white',
    marginTop: 12,
    marginHorizontal: 12,
    borderRadius: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  infoItem: {
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingVertical: 12,
  },
  label: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  value: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
  },
});

export default StudentDetailScreen;
