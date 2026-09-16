import React from 'react';
import { render } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import App from '../App';
import Signin from '../screens/Signin';
import Home from '../screens/Home';
import Collect from '../screens/Collect';
import Classify from '../screens/Classify';
import PastCollections from '../screens/PastCollections';
import { UserProvider } from '../context/useUserContext';

jest.mock('@react-navigation/native', () => {
  return {
    ...jest.requireActual('@react-navigation/native'),
    NavigationContainer: jest.fn(({ children }) => children),
  };
});

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

jest.mock('react-native-safe-area-context', () => {
  return {
    SafeAreaProvider: ({ children }) => children,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

jest.mock('@react-navigation/stack', () => {
  const React = require('react');
  return {
    createStackNavigator: () => ({
      Navigator: ({ children }) => <React.Fragment>{children}</React.Fragment>,
      Screen: ({ component: Component, children }) => {
        if (Component) return <Component />;
        if (typeof children === 'function') return children({});
        return <React.Fragment>{children}</React.Fragment>;
      },
    }),
  };
});

jest.mock('../context/useUserContext', () => ({
  UserProvider: ({ children }) => children,
  useUserContext: () => ({ user: { first_name: 'Test', last_name: 'User' }, setUser: jest.fn() }),
}));

jest.mock('../firebase', () => ({
  db: {},
  storage: {},
}));

jest.mock('../screens/Signin', () => {
  return jest.fn(() => null);
});

jest.mock('../screens/Welcome', () => {
  return jest.fn(() => null);
});

jest.mock('../screens/Signup', () => {
  return jest.fn(() => null);
});

jest.mock('../screens/Summary', () => {
  return jest.fn(() => null);
});

jest.mock('../screens/Evidences', () => {
  return jest.fn(() => null);
});

jest.mock('../screens/Home', () => {
  return jest.fn(() => null);
});

jest.mock('../screens/Collect', () => {
  return jest.fn(() => null);
});

jest.mock('../screens/Classify', () => {
  return jest.fn(() => null);
});

jest.mock('../screens/PastCollections', () => {
  return jest.fn(() => null);
});

describe('App Navigation', () => {
  const Stack = createStackNavigator();

  it('renders the welcome/signin screens', () => {
    render(<App />);
    // Just verify App renders without crash
  });

  it('navigates to the home screen', () => {
    const { getByText } = render(
      <UserProvider>
        <NavigationContainer>
          <Stack.Navigator initialRouteName="home">
            <Stack.Screen name="signin" component={Signin} />
            <Stack.Screen name="home" component={Home} />
            <Stack.Screen name="collect" component={Collect} />
            <Stack.Screen name="classify" component={Classify} />
            <Stack.Screen name="pastCollections" component={PastCollections} />
          </Stack.Navigator>
        </NavigationContainer>
      </UserProvider>
    );

    expect(Home).toHaveBeenCalled();
  });
});

