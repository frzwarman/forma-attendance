import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import type { StorageAdapter } from "./storageAdapter";
export type { StorageAdapter } from "./storageAdapter";
export const storage: StorageAdapter = AsyncStorage;
// Production native auth can use this adapter. Demo identity is not an auth token.
export const tokenStorage: StorageAdapter =
  Platform.OS === "web"
    ? {
        getItem: async () => null,
        setItem: async () => {
          throw new Error(
            "Use secure HttpOnly server cookies for production web sessions.",
          );
        },
        removeItem: async () => {},
      }
    : {
        getItem: SecureStore.getItemAsync,
        setItem: SecureStore.setItemAsync,
        removeItem: SecureStore.deleteItemAsync,
      };
