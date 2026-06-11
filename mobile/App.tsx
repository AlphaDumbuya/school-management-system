import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import { NavigationContainer } from '@react-navigation/native';
import { AuthContext, AuthProvider } from './src/context/AuthContext';
import { RootNavigator } from './src/navigation/RootNavigator';
import { logger } from './src/utils/logger';

// Configure notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Main App Component
 * Entry point for the mobile application
 */
export default function App() {
  useEffect(() => {
    // Request notification permissions
    const requestNotificationPermissions = async () => {
      try {
        const { status } = await Notifications.requestPermissionsAsync();
        if (status !== 'granted') {
          logger.warn('Notification permissions not granted');
        }
      } catch (error) {
        logger.error('Error requesting notification permissions:', error);
      }
    };

    requestNotificationPermissions();

    // Listen for notifications
    const subscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        logger.info('Notification received:', response.notification.request.content);
      }
    );

    return () => {
      subscription.remove();
    };
  }, []);

  return (
    <AuthProvider>
      <NavigationContainer>
        <RootNavigator />
      </NavigationContainer>
      <StatusBar barStyle="dark-content" />
    </AuthProvider>
  );
}
