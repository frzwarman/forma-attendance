import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { withBrowserStorageLock, type StorageAdapter } from "./storageAdapter";
import { createChunkedStorage } from "./chunkedStorage";
export type { StorageAdapter } from "./storageAdapter";
const dataStorage = Platform.OS === "web" ? AsyncStorage : createChunkedStorage(AsyncStorage);
export const storage: StorageAdapter = {
  getItem: (key) => dataStorage.getItem(key),
  setItem: (key, value) => dataStorage.setItem(key, value),
  removeItem: (key) => dataStorage.removeItem(key),
  withLock: (key, action, mode) => Platform.OS === "web"
    ? withBrowserStorageLock(globalThis.navigator?.locks, key, action, mode)
    : action(),
};
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
