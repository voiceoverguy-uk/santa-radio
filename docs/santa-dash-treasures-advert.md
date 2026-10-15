# Santa Dash — Treasures screen advert

## Finished artwork

- File: `attached_assets/santa-dash-treasures-advert.png`
- Format: PNG, RGB, **2208 × 1242 pixels**, **16:9**
- This is a newly created advert, not a pixel-identical recovery of the missing image.
- Matches the native dimensions of the supplied full-screen `tres-hd_1792078128187.png` and `endN-hd_1792077386729.png`. The small `treasures-hd_1792077287682.png` is a separate 216 × 74 label, not the screen canvas.

## App Store region for Xcode

Coordinates use the **top-left of the source PNG as (0, 0)**. X increases rightwards; Y increases downwards.

| Property | Source-image pixels |
| --- | ---: |
| Left / X | 160 |
| Top / Y | 886 |
| Width | 600 |
| Height | 201 |
| Right edge | 760 |
| Bottom edge | 1087 |

Rectangle: **(x: 160, y: 886, width: 600, height: 201)**.
This is the badge's enclosing rectangular region, including its rounded-corner space. Its centre is **(460, 986.5)**.

Destination: **https://apps.apple.com/gb/app/santa-radio/id1021183593**

The PNG is static and contains no clickable link. Add the tappable region in Xcode. If the image is resized or letterboxed, transform the region with the same scale and offsets as the displayed image. For a bottom-left coordinate system, the rectangle's lower-left Y is **155** (`1242 - 886 - 201`).

## Artwork sources and checks

- Genuine supplied gold branding: `attached_assets/santa-radio-gold-logo_1791446660391.png`, transparent margins trimmed without changing the logo's aspect ratio.
- Genuine supplied app screen: `src/assets/apps/santa-radio-ios-radio.webp`, shown inside a decorative phone frame.
- Existing App Store badge: `public/images/download-on-the-app-store.svg`.
- Newly generated festive winter background; no invented app interface or unsupported promotional claims.
- Verified final PNG dimensions with ImageMagick and inspected the flattened artwork for clipping, branding, readable copy and badge appearance.
- No website, deployment or game-navigation changes were made.
