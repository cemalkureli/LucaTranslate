import { Tabs } from 'expo-router';
import { Colors, BorderRadius } from '../../constants/theme';
import { LanguageIcon, CameraIcon, SettingsIcon } from '../../components/Icons';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#0A0A16',
          borderTopWidth: 1,
          borderTopColor: '#1A1A30',
          height: 68,
          paddingBottom: 10,
          paddingTop: 8,
        },
        tabBarShowLabel: true,
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
          letterSpacing: 0.5,
        },
        tabBarActiveTintColor: Colors.accent.primary,
        tabBarInactiveTintColor: Colors.text.muted,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarLabel: 'Translate',
          tabBarIcon: ({ focused, color }) => (
            <LanguageIcon size={24} color={color} strokeWidth={focused ? 2.5 : 1.8} />
          ),
        }}
      />
      <Tabs.Screen
        name="camera"
        options={{
          tabBarLabel: 'Camera',
          tabBarIcon: ({ focused, color }) => (
            <CameraIcon size={24} color={color} strokeWidth={focused ? 2.5 : 1.8} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings-tab"
        options={{
          tabBarLabel: 'Settings',
          tabBarIcon: ({ focused, color }) => (
            <SettingsIcon size={24} color={color} strokeWidth={focused ? 2.5 : 1.8} />
          ),
        }}
      />
    </Tabs>
  );
}
