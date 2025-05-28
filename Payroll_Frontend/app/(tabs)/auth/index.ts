// auth/index.ts

import axios from "axios";
import * as SecureStore from "expo-secure-store";

const BASE_URL = "http://192.168.17.49:8000/api";

// 🔹 Function to Refresh Token
export const refreshToken = async (): Promise<string | null> => {
  try {
    const refreshToken = await SecureStore.getItemAsync("refresh_token");
    if (!refreshToken) {
      console.error("No refresh token found.");
      return null; // ✅ Ensure a return value here
    }

    const response = await axios.post<{ access: string }>(
      `${BASE_URL}/token/refresh/`,
      { refresh: refreshToken }
    );

    if (response.data.access) {
      await SecureStore.setItemAsync("access_token", response.data.access);
      return response.data.access; // ✅ Always return a string if successful
    }

    return null; // ✅ Ensure a return statement in case no access token is found
  } catch (error: any) {
    console.error("Token refresh failed:", error.response?.data || error.message);
    return null; // ✅ Explicitly return null in case of failure
  }
};

// 🔹 Function to Get Valid Token (Handles Expiry)
export const getAccessToken = async (): Promise<string | null> => {
  let accessToken = await SecureStore.getItemAsync("access_token");

  if (!accessToken) {
    accessToken = await refreshToken();
  }

  return accessToken;
};


const AuthScreen = () => null;
export default AuthScreen;