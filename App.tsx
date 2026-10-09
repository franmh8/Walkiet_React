import React from 'react';
import { View, ActivityIndicator, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { RadioProvider } from './src/context/RadioContext';
import { ChatProvider } from './src/context/ChatContext';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { LoginScreen } from './src/screens/LoginScreen';
import { PttScreen } from './src/screens/PttScreen';
import { ChannelsScreen } from './src/screens/ChannelsScreen';
import { ChatScreen } from './src/screens/ChatScreen';
import { ContactsScreen } from './src/screens/ContactsScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { Mic, Users, MessageSquare, BookOpen, User } from 'lucide-react-native';

const Tab = createBottomTabNavigator();

function MainNavigator() {
  const { user, loading } = useAuth();
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  // En iPhone con barra de inicio (home indicator slider), insets.bottom es ~34px.
  // Nos aseguramos de tener al menos 28px en iOS para separar los botones del slider de cierre.
  const safeBottom = Math.max(insets.bottom, Platform.OS === 'ios' ? 28 : 10);

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.background,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // Si no hay usuario logueado, muestra la pantalla de Login limpia y minimalista
  if (!user) {
    return (
      <>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <LoginScreen />
      </>
    );
  }

  const navTheme = {
    ...(isDark ? DarkTheme : DefaultTheme),
    colors: {
      ...(isDark ? DarkTheme.colors : DefaultTheme.colors),
      background: colors.background,
      card: colors.tabBarBackground,
      border: colors.tabBarBorder,
      text: colors.text,
    },
  };

  // Si el usuario está autenticado, muestra la app con las 5 pestañas limpias idénticas a Web
  return (
    <RadioProvider>
      <ChatProvider>
        <NavigationContainer theme={navTheme}>
          <StatusBar style={isDark ? 'light' : 'dark'} />
          <Tab.Navigator
            screenOptions={{
              headerShown: false,
              tabBarStyle: {
                backgroundColor: colors.tabBarBackground,
                borderTopColor: colors.tabBarBorder,
                borderTopWidth: 1,
                height: 56 + safeBottom,
                paddingBottom: safeBottom + 2,
                paddingTop: 8,
                elevation: 8,
                shadowColor: '#000000',
                shadowOffset: { width: 0, height: -2 },
                shadowOpacity: isDark ? 0.2 : 0.04,
                shadowRadius: 6,
              },
              tabBarActiveTintColor: colors.activeTab,
              tabBarInactiveTintColor: colors.inactiveTab,
              tabBarLabelStyle: {
                fontSize: 11,
                fontWeight: '600',
                marginTop: 2,
              },
            }}
          >
            {/* 1. PTT */}
            <Tab.Screen
              name="PTT"
              component={PttScreen}
              options={{
                tabBarLabel: 'PTT',
                tabBarIcon: ({ color, size }) => (
                  <Mic color={color} size={size - 1} strokeWidth={2} />
                ),
              }}
            />

            {/* 2. Grupos */}
            <Tab.Screen
              name="Grupos"
              component={ChannelsScreen}
              options={{
                tabBarLabel: 'Grupos',
                tabBarIcon: ({ color, size }) => (
                  <Users color={color} size={size - 1} strokeWidth={2} />
                ),
              }}
            />

            {/* 3. Chat */}
            <Tab.Screen
              name="Chat"
              component={ChatScreen}
              options={{
                tabBarLabel: 'Chat',
                tabBarIcon: ({ color, size }) => (
                  <MessageSquare color={color} size={size - 1} strokeWidth={2} />
                ),
              }}
            />

            {/* 4. Contactos */}
            <Tab.Screen
              name="Contactos"
              component={ContactsScreen}
              options={{
                tabBarLabel: 'Contactos',
                tabBarIcon: ({ color, size }) => (
                  <BookOpen color={color} size={size - 1} strokeWidth={2} />
                ),
              }}
            />

            {/* 5. Perfil */}
            <Tab.Screen
              name="Perfil"
              component={ProfileScreen}
              options={{
                tabBarLabel: 'Perfil',
                tabBarIcon: ({ color, size }) => (
                  <User color={color} size={size - 1} strokeWidth={2} />
                ),
              }}
            />
          </Tab.Navigator>
        </NavigationContainer>
      </ChatProvider>
    </RadioProvider>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <MainNavigator />
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
