// auth/index.ts

import axios from 'axios';
import { jwtDecode } from 'jwt-decode';     // default import
import { Storage } from './storage';  // adjust the path

const BASE_URL = 'http://192.168.1.7:8000/api/employee';

interface JwtPayload {
  exp: number;
  // any other claims you expect...
}

// Checks if the token is expired by comparing current time with exp claim.
const isTokenExpired = (token: string): boolean => {
  try {
    const decoded: JwtPayload = jwtDecode(token);
    const now = Date.now() / 1000; // seconds
    return decoded.exp < now;
  } catch (error) {
    console.error('Error decoding token:', error);
    return true;
  }
};

// 🔹 Function to Refresh Token
export const refreshToken = async (): Promise<string | null> => {
  try {
    const refreshToken = await Storage.get('refresh_token');
    if (!refreshToken) {
      console.error('No refresh token found.');
      return null;
    }

    const response = await axios.post<{ access: string }>(
      `${BASE_URL}/token/refresh/`,
      { refresh: refreshToken },
      { headers: { 'Content-Type': 'application/json' } }
    );

    const newAccess = response.data.access;
    if (newAccess) {
      await Storage.set('access_token', newAccess);
      return newAccess;
    }
    return null;
  } catch (error: any) {
    console.error('Token refresh failed:', error.response?.data || error.message);
    return null;
  }
};

// 🔹 Function to Get Valid Token (Handles Expiry)
export const getAccessToken = async (): Promise<string | null> => {
  let accessToken = await Storage.get('access_token');

  // If there's a token but it's expired, refresh it
  if (accessToken && isTokenExpired(accessToken)) {
    accessToken = await refreshToken();
  }

  // If there's no token at all, try to refresh
  if (!accessToken) {
    accessToken = await refreshToken();
  }
  return accessToken;
};

const AuthScreen = () => null;
export default AuthScreen;