import { Stack } from 'expo-router';
import { Drawer } from 'expo-router/drawer';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

export default function AppLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Drawer>
        <Drawer.Screen
          name="home" // This is the name of the page and must match the url from root
          options={{
            drawerLabel: 'Home',
            title: 'Home',
          }}
        />
        <Drawer.Screen
          name="settings" // This is the name of the page and must match the url from root
          options={{
            drawerLabel: 'Settings',
            title: 'Settings',
          }}
        />
      </Drawer>
    </GestureHandlerRootView>
  );
}
