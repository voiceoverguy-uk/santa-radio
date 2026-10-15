// Independent regression baseline: preserve the catalogue's original destinations.
export const appDownloads = [
  { id: 'santaradio', title: 'Santa Radio App', apple: 'https://apps.apple.com/us/app/santa-radio/id1021183593', amazon: 'https://www.amazon.com/App-Style-Ltd-Santa-Radio/dp/B0158MYRBM' },
  { id: 'santavoicemail', title: 'Santa Voicemail', apple: 'https://itunes.apple.com/us/app/santa-voicemail/id586387813', amazon: 'http://www.amazon.com/App-Style-Ltd-Santa-Voicemail/dp/B00QFP4B18' },
  { id: 'santamessages', title: 'Santa Messages', apple: 'https://itunes.apple.com/gb/app/santa-messages/id1062532143', amazon: 'http://www.amazon.co.uk/Santa-Messages-Free-Festive-Fun/dp/B019MRFDDK' },
  { id: 'christmasradio', title: 'Christmas Radio', apple: 'https://itunes.apple.com/gb/app/christmas-radio-uk/id1157967613', amazon: 'https://www.amazon.co.uk/VoiceoverGuy-Ltd-Christmas-Radio/dp/B01M18XUXV' },
  { id: 'santatext', title: 'Santa Text', apple: 'https://itunes.apple.com/gb/app/santa-text/id1024535991' },
  { id: 'santadash', title: 'Santa Dash', apple: 'https://itunes.apple.com/gb/app/santa-dash-from-santa-guy/id1057048397' },
];

export const obsoleteStoreCopy = /Current store details have not been verified|Verified store details|Store details checked|Store rating:|Developer:|Requires iOS|Source: Apple App Store|Source: Amazon Appstore|Public listing verified|not reviews collected by Santa Radio|verified store details above|store’s price below|Store Prices &amp; Ratings|prices and store ratings|£0\.99/;
