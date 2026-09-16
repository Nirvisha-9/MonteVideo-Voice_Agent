import 'react-native-gesture-handler';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { UserProvider } from './context/useUserContext';
import Classify from './screens/Classify';
import ClassifyEntry from './screens/ClassifyEntry';
import PastCollections from './screens/PastCollections';
import Collect from './screens/Collect';
import Home from './screens/Home';
import Welcome from './screens/Welcome';
import Summary from './screens/Summary';
import Signin from './screens/Signin';
import Signup from './screens/Signup';
import EvidencesNavigator from './screens/Evidences';
import { subscribeLanguage, getLanguage } from './localization/dictionary';

// Id's when updating / creating new collections / classifications
// Add who picks up things (For the profile picture)
// Force to add count

// Create a stack navigator instance
const Stack = createStackNavigator();
const App = () => {
    const [lang, setLang] = React.useState(getLanguage());

    React.useEffect(() => {
        const unsub = subscribeLanguage(setLang);
        return unsub;
    }, []);

    /**
     * ScreenNames - An object containing the names of the screens.
     * 
     * These names are used throughout the app for navigation.
     */
    const ScreenNames = {
        WELCOME: 'welcome',
        SIGNIN: 'signin',
        SIGNUP: 'signup',
        HOME: 'home',
        COLLECT: 'collect',
        CLASSIFY: 'classify',
        PAST_COLLECTIONS: 'pastCollections',
        SUMMARY: 'summary',
        EVIDENCES: 'evidences'
    };

    return (
        <SafeAreaProvider>
            <NavigationContainer>
                <UserProvider>
                    <Stack.Navigator initialRouteName={ScreenNames.WELCOME}>
                        <Stack.Screen
                            name={ScreenNames.WELCOME}
                            options={{ headerShown: false }}
                        >
                            {(props) => <Welcome {...props} screenNames={ScreenNames} />}
                        </Stack.Screen>
                        <Stack.Screen
                            name={ScreenNames.HOME}
                            options={{ headerShown: false }}
                        >
                            {(props) => <Home {...props} screenNames={ScreenNames} />}
                        </Stack.Screen>
                        <Stack.Screen
                            name={ScreenNames.COLLECT}
                            options={{ headerShown: false }}
                        >
                            {(props) => <Collect {...props} screenNames={ScreenNames} />}
                        </Stack.Screen>
                        <Stack.Screen
                            name={ScreenNames.CLASSIFY}
                            options={{ headerShown: false }}
                        >
                            {(props) => <ClassifyEntry {...props} screenNames={ScreenNames} />}
                        </Stack.Screen>
                        <Stack.Screen
                            name={ScreenNames.PAST_COLLECTIONS}
                            options={{ headerShown: false }}
                        >
                            {(props) => <PastCollections {...props} screenNames={ScreenNames} />}
                        </Stack.Screen>
                        <Stack.Screen
                            name={ScreenNames.SUMMARY}
                            options={{ headerShown: false }}
                            >
                            {(props) => <Summary {...props} screenNames={ScreenNames} />}
                        </Stack.Screen>
                        <Stack.Screen
                            name={ScreenNames.SIGNIN}
                            options={{ headerShown: false }}
                        >
                            {(props) => <Signin {...props} screenNames={ScreenNames} />}
                        </Stack.Screen>
                        <Stack.Screen
                            name={ScreenNames.SIGNUP}
                            options={{ headerShown: false }}
                            >
                            {(props) => <Signup {...props} screenNames={ScreenNames} />}
                        </Stack.Screen>
                        <Stack.Screen
                            name={ScreenNames.EVIDENCES}
                            options={{ headerShown: false }}
                        >
                            {(props) => <EvidencesNavigator {...props} screenNames={ScreenNames} />}
                        </Stack.Screen>
                    </Stack.Navigator>
                </UserProvider>
            </NavigationContainer>
        </SafeAreaProvider>
    );
};

export default App;