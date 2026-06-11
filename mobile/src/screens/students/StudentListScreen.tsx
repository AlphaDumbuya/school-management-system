import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { logger } from '@utils/logger';

const StudentListScreen: React.FC = ({ navigation }: any) => {
  const [students, setStudents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadStudents();
  }, []);

  const loadStudents = async () => {
    try {
      // TODO: Fetch from API
      setStudents([]);
      logger.info('Students loaded');
    } catch (error) {
      logger.error('Error loading students:', error);
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
    <View style={styles.container}>
      {students.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No students found</Text>
        </View>
      ) : (
        <FlatList
          data={students}
          renderItem={({ item }: any) => (
            <TouchableOpacity
              style={styles.studentItem}
              onPress={() => navigation.navigate('StudentDetail', { studentId: item.id })}
            >
              <Text style={styles.studentName}>{item.name}</Text>
              <Text style={styles.studentId}>{item.id}</Text>
            </TouchableOpacity>
          )}
          keyExtractor={(item: any) => item.id}
        />
      )}
    </View>
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
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: '#6B7280',
    fontSize: 16,
  },
  studentItem: {
    backgroundColor: 'white',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  studentName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  studentId: {
    fontSize: 12,
    color: '#6B7280',
  },
});

export default StudentListScreen;
