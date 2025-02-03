import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Initialize Supabase with environment variables
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}


class SupabaseStorage {
  async getItem(key: string) {
    if (Platform.OS === "web") {
      if (typeof localStorage === "undefined") {
        return null;
      }
      return localStorage.getItem(key);
    }
    return AsyncStorage.getItem(key);
  }
  async removeItem(key: string) {
    if (Platform.OS === "web") {
      return localStorage.removeItem(key);
    }
    return AsyncStorage.removeItem(key);
  }
  async setItem(key: string, value: string) {
    if (Platform.OS === "web") {
      return localStorage.setItem(key, value);
    }
    return AsyncStorage.setItem(key, value);
  }
}
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: new SupabaseStorage(),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false
  }
});
