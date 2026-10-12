# Christmas app store checks

Checked **12 October 2026** using the public Apple and Amazon store pages, including the five original `itunes.apple.com` destinations. All ten original links returned the expected app identities. None was removed or replaced. Store page presence is not proof of successful purchase, installation or playback.

## Verified storefront information

Prices below are the download prices displayed by the **specific linked storefront**, not worldwide prices. Apple’s abbreviated rating counts are preserved verbatim; they are not converted into invented exact integers. Store ratings are reported separately, never combined across platforms.

| Catalogue app | Store / region | Current store identity | Download price | Rating / 5 | Displayed rating count | Store-listed developer | Source |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Santa Radio App | Apple / US | Santa Radio | Free | 4.6 | 1.1K | VoiceoverGuy | [Apple](https://apps.apple.com/us/app/santa-radio/id1021183593) |
| Santa Radio App | Amazon / US | Santa Radio | Free to download | 2.6 | 10 | App Style Ltd | [Amazon](https://www.amazon.com/App-Style-Ltd-Santa-Radio/dp/B0158MYRBM) |
| Santa Voicemail | Apple / US | Santa Voicemail | US$0.99; in-app purchases | 4.6 | 401 | VoiceoverGuy | [Apple](https://apps.apple.com/us/app/santa-voicemail/id586387813) |
| Santa Voicemail | Amazon / US | Santa Voicemail | Free to download | 3.4 | 14 | App Style Ltd | [Amazon](http://www.amazon.com/App-Style-Ltd-Santa-Voicemail/dp/B00QFP4B18) |
| Santa Messages | Apple / UK | Santa Messages | £0.99 | 4.6 | 545 | VoiceoverGuy | [Apple](https://apps.apple.com/gb/app/santa-messages/id1062532143) |
| Santa Messages | Amazon / UK | Santa Messages - Free Festive Fun | Free to download | 2.5 | 12 | VoiceoverGuy Ltd | [Amazon](http://www.amazon.co.uk/Santa-Messages-Free-Festive-Fun/dp/B019MRFDDK) |
| Christmas Radio | Apple / UK | Christmas Radio UK | £0.99 | 4.5 | 1.3k | VoiceoverGuy | [Apple](https://apps.apple.com/gb/app/christmas-radio-uk/id1157967613) |
| Christmas Radio | Amazon / UK | Christmas Radio | Free to download | 4.1 | 6 | VoiceoverGuy Ltd | [Amazon](https://www.amazon.co.uk/VoiceoverGuy-Ltd-Christmas-Radio/dp/B01M18XUXV) |
| Santa Text | Apple / UK | Santa Text | £0.99; in-app purchases | 4.4 | 785 | VoiceoverGuy | [Apple](https://apps.apple.com/gb/app/santa-text/id1024535991) |
| Santa Dash | Apple / UK | Santa Dash from Santa Guy | £0.99 | 5.0 | 2 | VoiceoverGuy | [Apple](https://apps.apple.com/gb/app/santa-dash-from-santa-guy/id1057048397) |

## Discrepancies and limitations

- Five Apple listings are paid downloads, contrary to the old “Free Christmas Apps” heading and free-download feature cards. Apple’s own legacy descriptions sometimes still call these apps free; the current store price takes precedence. The website heading, metadata and price-related feature text now reflect this.
- Santa Voicemail and Santa Text additionally advertise in-app purchases. This is disclosed next to their download prices.
- “Christmas Radio” and “Santa Dash” are abbreviated catalogue titles, not mismatched IDs: Apple lists the same IDs as “Christmas Radio UK” and “Santa Dash from Santa Guy”. Full store identities are visible alongside the preserved catalogue titles.
- The Amazon and Apple developer labels differ. They are shown per listing, not normalised into an invented shared publisher.
- Amazon’s public pages still show free download actions, but that is not a device availability guarantee. [Amazon’s official notice](https://developer.amazon.com/apps-and-games/blogs/2025/02/upcoming-changes-to-amazon-appstore-for-android-devices-and-coins-program) ended support on ordinary Android mobile devices on 20 August 2025 and states its Appstore continues on Fire devices. Installation and playback have not been tested. The website makes that distinction.
- Amazon Santa Radio’s page includes a customer report of broken internal playback (8 December 2024). This is a customer report, not an independently verified failure; it warrants device testing before claiming the app works.
- Legacy screenshots and feature descriptions are retained and labelled as historical; the Santa Radio feature summary now reflects its current iOS store description rather than the unrelated voicemail feature array. Platform features may differ.
- Sleeps til Santa remains excluded.
- No downloads were purchased, no accounts were accessed, and no production deployment was performed.

## Structured-data eligibility decision

Google’s [software-app guidance](https://developers.google.com/search/docs/appearance/structured-data/software-app), checked 12 October 2026 (page last updated 8 September 2026), requires `name`, `offers.price` and either an eligible `review` or `aggregateRating`.

That guidance explicitly references the [review snippet guidelines](https://developers.google.com/search/docs/appearance/structured-data/review-snippet#technical-guidelines), which say **“Don't aggregate reviews or ratings from other websites.”** Showing attributed public store ratings does not make them first-party Santa Radio ratings. No eligible first-party review collection was supplied.

Consequently, **none of these snapshots is suitable for an app rich-result candidate on this site**. Retain `CollectionPage`, `ItemList` and `BreadcrumbList`; do not emit `SoftwareApplication`, `MobileApplication`, copied `AggregateRating`, speculative availability or invented publishers. This is a deliberate eligibility decision, not an incomplete schema implementation. Real first-party reviews would need a separate collection/moderation policy before revisiting rich results.

## Rechecking

The website uses a checked-in editorial snapshot, with visible source links and the verification date. It does not fetch store data during page rendering or builds. Future refreshes must verify the same storefront, preserve rounded counts, report unavailable/mismatched identities before changing links, and update both the snapshot and its date. Prices/ratings may change after the check date.

Automated checks cover generated Apps HTML, all ten retained destinations, matching visible snapshot values, six item-list entries, contiguous breadcrumb positions and the exclusion of ineligible app/review markup.
