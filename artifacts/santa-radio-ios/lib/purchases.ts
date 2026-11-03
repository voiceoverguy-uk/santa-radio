import { Platform } from 'react-native';
import Constants from 'expo-constants';
import type { PurchasesPackage } from 'react-native-purchases';

const ids = { permanent: 'uk.co.santaradio.studio.permanent', single: 'uk.co.santaradio.studio.single' };
let sdk: typeof import('react-native-purchases').default | undefined;
let configuredFor: string | undefined;
export async function purchaseSdk(customerId: string) {
  if (Platform.OS !== 'ios' || Constants.executionEnvironment === 'storeClient') {
    throw new Error('Use an Xcode development build for verified Apple sandbox purchases. Expo Go and web previews cannot grant Studio access.');
  }
  if (process.env.EXPO_PUBLIC_SANTA_IAP_SANDBOX !== 'true') {
    throw new Error('Purchases are not activated. Configure the Apple sandbox products and enable sandbox testing in the documented Xcode setup.');
  }
  const apiKey = process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY;
  if (!apiKey?.startsWith('appl_')) throw new Error('The RevenueCat Apple public SDK key is not configured.');
  sdk ||= (await import('react-native-purchases')).default;
  if (configuredFor && configuredFor !== customerId) {
    await sdk.logIn(customerId);
  } else if (!configuredFor) sdk.configure({ apiKey, appUserID: customerId, diagnosticsEnabled: false });
  configuredFor = customerId;
  return sdk;
}
export async function storePackages(customerId: string) {
  const purchases = await purchaseSdk(customerId);
  const offering = (await purchases.getOfferings()).current;
  if (offering?.identifier !== 'santa_studio_ios') throw new Error('The Santa Studio iPhone offering is not configured.');
  return Object.fromEntries(Object.entries(ids).map(([kind, id]) => [
    kind, offering.availablePackages.find(p => p.product.identifier === id) || null,
  ])) as Record<'permanent' | 'single', PurchasesPackage | null>;
}
export function purchaseFailure(error: unknown): Error {
  const failure = error as { userCancelled?: boolean; message?: string; code?: string };
  if (failure?.userCancelled) return new Error('Purchase cancelled. No access was granted and no message was used.');
  return new Error('Apple has not confirmed this purchase. It may be pending or unavailable. Retry verification or restore purchases; do not buy again just to retry verification.');
}
