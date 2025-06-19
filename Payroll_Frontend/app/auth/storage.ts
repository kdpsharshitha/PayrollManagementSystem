// storage.ts
import { Platform } from 'react-native';
import {
  setItemAsync,
  getItemAsync,
  deleteItemAsync,
} from 'expo-secure-store';

const isWeb = Platform.OS === 'web';

export const Storage = {
  set: async (key: string, value: string) => {
    if (isWeb) {
      window.localStorage.setItem(key, value);
    } else {
      await setItemAsync(key, value);
    }
  },

  get: async (key: string): Promise<string | null> => {
    if (isWeb) {
      return window.localStorage.getItem(key);
    } else {
      return await getItemAsync(key);
    }
  },

  delete: async (key: string) => {
    if (isWeb) {
      window.localStorage.removeItem(key);
    } else {
      await deleteItemAsync(key);
    }
  },
};