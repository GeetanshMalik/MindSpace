import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { LoginSignUpScreen } from '../screens/auth/LoginSignUpScreen';

export type AuthStackParamList = {
  LoginSignUp: undefined;
};

const Stack = createStackNavigator<AuthStackParamList>();

export const AuthNavigator = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="LoginSignUp" component={LoginSignUpScreen} />
    </Stack.Navigator>
  );
};
