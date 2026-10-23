import AsyncStorage from '@react-native-async-storage/async-storage';
import { GoogleSignin } from '@react-native-google-signin/google-signin';

const SESSION_KEY = 'qtalk.session';

export async function restoreSession() {
  const raw = await AsyncStorage.getItem(SESSION_KEY);
  return raw ? JSON.parse(raw) : null;
}

export async function signInWithEmail(apiUrl, email, password, displayName) {
  const response = await fetch(`${apiUrl}/auth/email`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: email.trim().toLowerCase(), password, displayName: displayName?.trim() || email.split('@')[0] })
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'E-posta girişi başarısız.');
  await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(body));
  return body;
}

export async function signOut() {
  try { await GoogleSignin.signOut(); } catch {}
  await AsyncStorage.removeItem(SESSION_KEY);
}

export async function saveProfile(session, profile) {
  const next = { ...session, user: { ...session.user, ...profile } };
  await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(next));
  return next;
}

export async function signInWithGoogle() {
  GoogleSignin.configure({ offlineAccess: false });
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const result = await GoogleSignin.signIn();
  const user = result?.data?.user || result?.user;
  if (!user?.email) throw new Error('Google hesabı bilgisi alınamadı.');
  const session = { token: result?.data?.idToken || result?.idToken || `google-local-${Date.now()}`, provider: 'google', user: { id: user.id, name: user.name || user.givenName || user.email.split('@')[0], email: user.email, avatarUrl: user.photo || null } };
  await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}
