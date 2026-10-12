// Editorial snapshot of public store pages, not a live feed. Keep storefronts
// separate and preserve abbreviated counts exactly as displayed by Apple.
export const storeCheckedAt = '2026-10-12';
export const storeCheckedLabel = '12 October 2026';
export const amazonDeviceSource = 'https://developer.amazon.com/apps-and-games/blogs/2025/02/upcoming-changes-to-amazon-appstore-for-android-devices-and-coins-program';

const apple = (name, region, id, slug, price, rating, ratingCount, minimumIOS, inAppPurchases = false) => ({
  platform: 'iOS', name, region, source: `https://apps.apple.com/${region === 'US' ? 'us' : 'gb'}/app/${slug}/id${id}`,
  developer: 'VoiceoverGuy', price, rating, ratingCount, minimumIOS, inAppPurchases,
});
const amazon = (name, region, path, developer, rating, ratingCount) => ({
  platform: 'Amazon', name, region, source: `https://www.amazon.${region === 'US' ? 'com' : 'co.uk'}/${path}`,
  developer, price: 'Free to download', rating, ratingCount,
});

export const appStoreVerification = {
  santaradio: [
    apple('Santa Radio', 'US', '1021183593', 'santa-radio', 'Free', '4.6', '1.1K', '16.4'),
    amazon('Santa Radio', 'US', 'App-Style-Ltd-Santa-Radio/dp/B0158MYRBM', 'App Style Ltd', '2.6', '10'),
  ],
  santavoicemail: [
    apple('Santa Voicemail', 'US', '586387813', 'santa-voicemail', 'US$0.99', '4.6', '401', '12.0', true),
    amazon('Santa Voicemail', 'US', 'App-Style-Ltd-Santa-Voicemail/dp/B00QFP4B18', 'App Style Ltd', '3.4', '14'),
  ],
  santamessages: [
    apple('Santa Messages', 'UK', '1062532143', 'santa-messages', '£0.99', '4.6', '545', '9.0'),
    amazon('Santa Messages - Free Festive Fun', 'UK', 'Santa-Messages-Free-Festive-Fun/dp/B019MRFDDK', 'VoiceoverGuy Ltd', '2.5', '12'),
  ],
  christmasradio: [
    apple('Christmas Radio UK', 'UK', '1157967613', 'christmas-radio-uk', '£0.99', '4.5', '1.3k', '13.0'),
    amazon('Christmas Radio', 'UK', 'VoiceoverGuy-Ltd-Christmas-Radio/dp/B01M18XUXV', 'VoiceoverGuy Ltd', '4.1', '6'),
  ],
  santatext: [
    apple('Santa Text', 'UK', '1024535991', 'santa-text', '£0.99', '4.4', '785', '9.0', true),
  ],
  santadash: [
    apple('Santa Dash from Santa Guy', 'UK', '1057048397', 'santa-dash-from-santa-guy', '£0.99', '5.0', '2', '14.0'),
  ],
};
