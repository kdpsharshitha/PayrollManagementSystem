// auth/logout.ts
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const isWeb = Platform.OS === 'web';

export const logoutUser = async () => {
  if (isWeb) {
    window.localStorage.removeItem('access_token');
    window.localStorage.removeItem('refresh_token');
  } else {
    await SecureStore.deleteItemAsync('access_token');
    await SecureStore.deleteItemAsync('refresh_token');
  }

  await AsyncStorage.removeItem('currentUser');
};
