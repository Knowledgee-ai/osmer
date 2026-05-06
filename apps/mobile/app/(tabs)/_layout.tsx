import { Tabs } from 'expo-router';
import { Platform } from 'react-native';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#c2683f',
        tabBarInactiveTintColor: '#7b6043',
        tabBarStyle: { backgroundColor: '#fafaf7', borderTopColor: '#e8e3d8' },
        headerStyle: { backgroundColor: '#fafaf7' },
        headerTitleStyle: { color: '#2d2a26', fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }) },
      }}
    >
      <Tabs.Screen name="ask" options={{ title: 'Ask' }} />
      <Tabs.Screen name="conversations" options={{ title: 'Chats' }} />
      <Tabs.Screen name="employees" options={{ title: 'Employees' }} />
    </Tabs>
  );
}
