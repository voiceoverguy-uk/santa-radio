import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { File, Directory, Paths } from 'expo-file-system';
import { ApiError, request } from './api';
import { purchaseSdk, storePackages, purchaseFailure } from './purchases';
import type { Catalogue, Clip, Entitlement, NameResult, StudioChoices } from './contracts';

type Connection = { token: string; customerId: string; expiresAt: number };
const locked: Entitlement = { verified: false, permanent: false, credits: 0 };
const key = 'santa-radio-native-connection';
const audioDirectory = () => new Directory(Paths.cache, 'santa-session-audio');
const clearAudio = () => { if (Platform.OS === 'web') return; try { const dir = audioDirectory(); if (dir.exists) dir.delete(); } catch { /* Cache may already have been evicted by iOS. */ } };
function useMobileState() {
  const connection = useRef<Connection | null>(null);
  const starting = useRef<Promise<Connection> | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [freeStatus, setFreeStatus] = useState({ authorized: false, availableAt: 0 });
  const [entitlement, setEntitlement] = useState<Entitlement>(locked);
  const [prices, setPrices] = useState<{ permanent: string | null; single: string | null }>({ permanent: null, single: null });
  const purchaseBusy = useRef(false);

  const connect = async (): Promise<Connection> => {
    if (connection.current && connection.current.expiresAt > Date.now()) return connection.current;
    if (starting.current) return starting.current;
    starting.current = (async () => {
      if (Platform.OS === 'web') throw new Error('Open the iPhone build to use protected recordings and Apple purchases.');
      const saved = await SecureStore.getItemAsync(key);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (/^[A-Za-z0-9_-]{43}$/.test(parsed.token) && /^sr_[a-f0-9]{48}$/.test(parsed.customerId) && parsed.expiresAt > Date.now()) {
            connection.current = parsed; return parsed;
          }
        } catch { /* Discard malformed local credentials; never use as authority. */ }
      }
      const session: Connection = await (await request('session', undefined, {})).json();
      if (!/^[A-Za-z0-9_-]{43}$/.test(session.token) || !/^sr_[a-f0-9]{48}$/.test(session.customerId)) throw new Error('The app connection response was invalid.');
      await SecureStore.setItemAsync(key, JSON.stringify(session), { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
      connection.current = session;
      return session;
    })();
    try { return await starting.current; } finally { starting.current = null; }
  };
  const call = async (action: string, body?: unknown, requestId?: string) => {
    const session = await connect();
    try { return await request(action, session.token, body, requestId); }
    catch (failure) {
      if (failure instanceof ApiError && failure.status === 401) {
        // Signup-required is not necessarily an expired connection. Only reset
        // a session when the native endpoint explicitly identifies expiration.
        if (/connection|reconnect/.test(failure.message)) {
          connection.current = null; await SecureStore.deleteItemAsync(key);
        }
        setFreeStatus({ authorized: false, availableAt: 0 });
      }
      if (failure instanceof ApiError && failure.availableAt) setFreeStatus(s => ({ ...s, availableAt: failure.availableAt }));
      throw failure;
    }
  };
  const refresh = async () => {
    setError('');
    setEntitlement(locked); // No stale access while verification is in flight.
    try {
      const data = await (await call('status')).json();
      if (typeof data.freeStatus?.authorized !== 'boolean' || typeof data.entitlement?.verified !== 'boolean') throw new Error('The access response was invalid.');
      setFreeStatus(data.freeStatus);
      setEntitlement(data.entitlement);
      if (data.purchaseError) setError(data.purchaseError);
      setReady(true);
      const session = await connect();
      try {
        const packages = await storePackages(session.customerId);
        setPrices({ permanent: packages.permanent?.product.priceString || null, single: packages.single?.product.priceString || null });
      } catch { setPrices({ permanent: null, single: null }); }
    } catch (failure) {
      setReady(true);
      const message = failure instanceof Error ? failure.message : 'Santa’s service could not be reached.';
      setError(message); throw failure;
    }
  };
  useEffect(() => {
    clearAudio();
    refresh().catch(() => {});
    let awayAt = 0;
    const subscription = AppState.addEventListener('change', state => {
      if (state !== 'active') { awayAt = Date.now(); setEntitlement(locked); }
      else {
        // Recordings are request/session-local, never a persistent library.
        if (awayAt && Date.now() - awayAt > 30 * 60000) clearAudio();
        refresh().catch(() => {});
      }
    });
    return () => { subscription.remove(); clearAudio(); };
  }, []);
  const signup = async (fields: { FIRSTNAME: string; LASTNAME: string; EMAIL: string }) => {
    await call('signup', { ...fields, email_address_check: '' });
    await refresh();
  };
  const lookup = async (query: string, studio = false): Promise<NameResult[]> => {
    const data = await (await call('names', { query, studio })).json();
    if (!Array.isArray(data.records) || data.records.length > 10) throw new Error('The recorded name search returned an invalid response.');
    return data.records;
  };
  const receiveClip = async (response: Response, name: string): Promise<Clip> => {
    if (!response.headers.get('content-type')?.startsWith('audio/mpeg')) throw new Error('Santa’s recording was not received. Please retry.');
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (!bytes.length || bytes.length > 40 * 1024 * 1024) throw new Error('Santa’s recording was incomplete or too large.');
    const dir = new Directory(audioDirectory(), `${Date.now()}-${Math.random().toString(16).slice(2)}`);
    dir.create({ intermediates: true, idempotent: true });
    const safe = name.normalize('NFKC').replace(/[^\p{L}\p{N} '-]/gu, '').trim().slice(0, 80) || 'you';
    const file = new File(dir, `santa-recorded-message-for-${safe}.mp3`);
    file.write(bytes);
    return { uri: file.uri, name: file.name };
  };
  const createFree = async (name: NameResult) => {
    try {
      return await receiveClip(await call('free', { name: name.id, selectionToken: name.token, outro: 1 }), name.name);
    } finally { refresh().catch(() => {}); }
  };
  const loadCatalogue = async (): Promise<Catalogue> => {
    const data = await (await call('catalogue')).json();
    if (!data.categories || ['age', 'activity', 'achievement', 'treat', 'place'].some(k => !Array.isArray(data.categories[k]) || !data.categories[k].length)) {
      throw new Error('Santa’s recorded choices are incomplete. Please retry.');
    }
    data.categories.sports ||= []; data.categories.funny ||= []; data.regionalGroups ||= {};
    return data;
  };
  const createStudio = async (choices: StudioChoices, recipientName = 'you') => {
    // New deliberate render gets a new id. The server rejects replay of any
    // completed id and never charges twice or keeps an MP3 for recovery.
    const id = Array.from({ length: 36 }, (_, i) => [8, 13, 18, 23].includes(i) ? '-' : Math.floor(Math.random() * 16).toString(16)).join('');
    try { return await receiveClip(await call('studio', choices, id), recipientName); }
    finally { refresh().catch(() => {}); }
  };
  const purchase = async (kind: 'permanent' | 'single') => {
    if (purchaseBusy.current) return;
    purchaseBusy.current = true;
    setEntitlement(locked);
    try {
      const session = await connect();
      const packages = await storePackages(session.customerId);
      const selected = packages[kind];
      if (!selected) throw new Error('This Apple product is not configured yet.');
      try { await (await purchaseSdk(session.customerId)).purchasePackage(selected); }
      catch (failure) { throw purchaseFailure(failure); }
      // Ignore CustomerInfo; only server verification can update access.
      await refresh();
    } finally { purchaseBusy.current = false; }
  };
  const restore = async () => {
    if (purchaseBusy.current) return;
    purchaseBusy.current = true; setEntitlement(locked);
    try {
      const session = await connect();
      await (await purchaseSdk(session.customerId)).restorePurchases();
      await refresh();
    } finally { purchaseBusy.current = false; }
  };
  return { ready, error, freeStatus, entitlement, prices, signup, lookup, createFree, loadCatalogue, createStudio, refresh, purchase, restore };
}
type AppStateValue = ReturnType<typeof useMobileState>;
const Context = createContext<AppStateValue | null>(null);
export function SantaAppProvider({ children }: { children: React.ReactNode }) {
  return <Context.Provider value={useMobileState()}>{children}</Context.Provider>;
}
export function useSantaApp() {
  const context = useContext(Context);
  if (!context) throw new Error('SantaAppProvider is required');
  return context;
}
