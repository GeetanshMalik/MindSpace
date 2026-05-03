import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { useAuthStore } from '../store/authStore';
import { View, ActivityIndicator } from 'react-native';
import { useColors } from '../theme/useColors';
import { AuthNavigator } from './AuthNavigator';
import { MainTabNavigator } from './MainTabNavigator';
import { PostDetailScreen } from '../screens/community/PostDetailScreen';

export type AppStackParamList = {
  MainTabs: undefined;
  PostDetail: { postId: string; highlightCommentId?: string };
};

const AppStack = createStackNavigator<AppStackParamList>();

const linking: any = {
  prefixes: ['mindspace://', ''],
  config: {
    screens: {
      MainTabs: {
        screens: {
          HomeTab: 'home',
          CommunityTab: 'community',
          ChatTab: 'chat',
          ProfileTab: 'profile',
        },
      },
      PostDetail: 'post/:postId',
    },
  },
};

const AppStackNavigator = () => (
  <AppStack.Navigator screenOptions={{ headerShown: false }}>
    <AppStack.Screen name="MainTabs" component={MainTabNavigator} />
    <AppStack.Screen name="PostDetail" component={PostDetailScreen} />
  </AppStack.Navigator>
);

export const AppNavigator = () => {
  const { user, isInitialized } = useAuthStore();
  const C = useColors();

  if (!isInitialized) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.surface }}>
        <ActivityIndicator size="large" color={C.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer linking={linking}>
      {user ? <AppStackNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
};
