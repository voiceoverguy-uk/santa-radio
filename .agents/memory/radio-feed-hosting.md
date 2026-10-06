---
name: Radio feed hosting
description: External hosting constraint for live track information.
---
The user’s radio automation uploads song metadata to the legacy Santa Radio web host through FTP. Keep that original host accessible when moving the public domain to a new deployment.

**Why:** The verified public metadata URLs use the same main domain as the website. Moving its DNS without preserving the feeds would make the metadata endpoint fetch the new website rather than the automation output.

**How to apply:** Before a domain cutover, establish a stable HTTPS address for the legacy metadata host or preserve routing for the feed paths. Do not promise exact audio synchronization: broadcast metadata may lead a listener’s buffered stream.
