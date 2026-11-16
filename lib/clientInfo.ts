import { Platform } from 'react-native';
import * as Application from 'expo-application';

/**
 * Who is calling. Sent with every API request so the backend can tell which app and which version is in use
 * (the API address itself is read by the server from the request). Nothing personal: the platform and the
 * installed version, for example "1.1.7+22" (version and build number). Reading the version can never throw,
 * because this also runs in the background capture task.
 */
function readVersion(): string {
  try { return [Application.nativeApplicationVersion, Application.nativeBuildVersion].filter(Boolean).join('+'); } catch { return ''; }
}
const version = readVersion();
export const CLIENT_HEADERS: Record<string, string> = {
  'X-Seshat-Client': Platform.OS === 'ios' ? 'ios' : 'android',
  ...(version ? { 'X-Seshat-Version': version } : {}),
};
