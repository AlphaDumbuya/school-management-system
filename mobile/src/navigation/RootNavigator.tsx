import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '@context/AuthContext';

// Import screens
import LoginScreen from '@screens/auth/LoginScreen';
import RegisterScreen from '@screens/auth/RegisterScreen';
import DashboardScreen from '@screens/dashboard/DashboardScreen';
import StudentListScreen from '@screens/students/StudentListScreen';
import StudentDetailScreen from '@screens/students/StudentDetailScreen';
import MessagesScreen from '@screens/messages/MessagesScreen';
import NotificationsScreen from '@screens/notifications/NotificationsScreen';
import ProfileScreen from '@screens/profile/ProfileScreen';

export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  Home: undefined;
};

export type DashboardStackParamList = {
  DashboardHome: undefined;
};

export type StudentStackParamList = {
  StudentList: undefined;
  StudentDetail: { studentId: string };
};

export type MessageStackParamList = {
  MessageList: undefined;
  MessageDetail: { conversationId: string };
};

const RootStack = createNativeStackNavigator<RootStackParamList>();
const DashboardStack = createNativeStackNavigator();
const StudentStack = createNativeStackNavigator();
const MessageStack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

/**
 * Auth Stack Navigator
 * Shows login and register screens
 */
const AuthStack = () => {
  return (
    <RootStack.Navigator
      screenOptions={{
        headerShown: false,
        animationEnabled: true,
      }}
    >
      <RootStack.Screen name="Login" component={LoginScreen} />
      <RootStack.Screen name="Register" component={RegisterScreen} />
    </RootStack.Navigator>
  );
};

/**
 * Dashboard Stack Navigator
 */
const DashboardStackNavigator = () => {
  return (
    <DashboardStack.Navigator
      screenOptions={{
        headerTitleStyle: {
          fontWeight: '600',
          fontSize: 18,
        },
        headerTintColor: '#2563EB',
      }}
    >
      <DashboardStack.Screen
        name="DashboardHome"
        component={DashboardScreen}
        options={{ title: 'Dashboard' }}
      />
    </DashboardStack.Navigator>
  );
};

/**
 * Student Stack Navigator
 */
const StudentStackNavigator = () => {
  return (
    <StudentStack.Navigator
      screenOptions={{
        headerTitleStyle: {
          fontWeight: '600',
          fontSize: 18,
        },
        headerTintColor: '#2563EB',
      }}
    >
      <StudentStack.Screen
        name="StudentList"
        component={StudentListScreen}
        options={{ title: 'Students' }}
      />
      <StudentStack.Screen
        name="StudentDetail"
        component={StudentDetailScreen}
        options={{ title: 'Student Details' }}
      />
    </StudentStack.Navigator>
  );
};

/**
 * Message Stack Navigator
 */
const MessageStackNavigator = () => {
  return (
    <MessageStack.Navigator
      screenOptions={{
        headerTitleStyle: {
          fontWeight: '600',
          fontSize: 18,
        },
        headerTintColor: '#2563EB',
      }}
    >
      <MessageStack.Screen
        name="MessageList"
        component={MessagesScreen}
        options={{ title: 'Messages' }}
      />
    </MessageStack.Navigator>
  );
};

/**
 * App Stack Navigator (Tab Navigator)
 * Shows main app screens
 */
const AppStack = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: string;

          if (route.name === 'DashboardTab') {
            iconName = focused ? '📊' : '📊';
          } else if (route.name === 'StudentsTab') {
            iconName = focused ? '👨‍🎓' : '👨‍🎓';
          } else if (route.name === 'MessagesTab') {
            iconName = focused ? '💬' : '💬';
          } else if (route.name === 'NotificationsTab') {
            iconName = focused ? '🔔' : '🔔';
          } else if (route.name === 'ProfileTab') {
            iconName = focused ? '👤' : '👤';
          }

          return <View style={{ fontSize: size }}>{iconName}</View>;
        },
        tabBarActiveTintColor: '#2563EB',
        tabBarInactiveTintColor: '#9CA3AF',
        headerShown: false,
      })}
    >
      <Tab.Screen
        name="DashboardTab"
        component={DashboardStackNavigator}
        options={{ title: 'Dashboard' }}
      />
      <Tab.Screen
        name="StudentsTab"
        component={StudentStackNavigator}
        options={{ title: 'Students' }}
      />
      <Tab.Screen
        name="MessagesTab"
        component={MessageStackNavigator}
        options={{ title: 'Messages' }}
      />
      <Tab.Screen
        name="NotificationsTab"
        component={NotificationsScreen}
        options={{ title: 'Notifications' }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileScreen}
        options={{ title: 'Profile' }}
      />
    </Tab.Navigator>
  );
};

/**
 * Root Navigator
 * Main entry point that switches between auth and app stacks
 */
export const RootNavigator = () => {
  const { isSignedIn, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  return (
    <RootStack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      {isSignedIn ? (
        <RootStack.Screen
          name="Home"
          component={AppStack}
          options={{
            animationEnabled: false,
          }}
        />
      ) : (
        <RootStack.Screen
          name="Auth"
          component={AuthStack}
          options={{
            animationEnabled: false,
          }}
        />
      )}
    </RootStack.Navigator>
  );
};

export default RootNavigator;
