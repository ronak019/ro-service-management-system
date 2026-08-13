// App.js
import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { getAccessToken } from './lib/api';

import LoginScreen from './screens/LoginScreen';
import JobsListScreen from './screens/JobsListScreen';
import JobDetailScreen from './screens/JobDetailScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  const [initialRoute, setInitialRoute] = useState(null);

  useEffect(() => {
    getAccessToken().then((token) => setInitialRoute(token ? 'JobsList' : 'Login'));
  }, []);

  if (!initialRoute) return null; // brief splash while we check for a stored session

  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName={initialRoute}>
        <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        <Stack.Screen
          name="JobsList"
          component={JobsListScreen}
          options={{ title: 'My Jobs / मेरे काम' }}
        />
        <Stack.Screen
          name="JobDetail"
          component={JobDetailScreen}
          options={{ title: 'Job Detail / काम का विवरण' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
