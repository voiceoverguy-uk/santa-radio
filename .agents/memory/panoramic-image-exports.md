---
name: Panoramic image exports
description: Handling image-generation tools that ignore requested panoramic dimensions.
---
Check the actual image dimensions before relying on a requested panoramic composition. Both image editing with a wide source and high-resolution generation can still return square canvases.

**Why:** Wide aspect-ratio instructions and a wide outpainting guide both returned square images. Stretching those results would distort the scenery.

**How to apply:** If the tool cannot produce a wide canvas, request a complete letterboxed panoramic composition, then remove the black bars and proportionally resize/crop. Inspect the resulting full panorama and narrower sections. Be clear that the final export may be upscaled rather than native-resolution generation.

Generated landscape contact sheets can contain artificial straight vertical colour bands inside otherwise continuous strips, especially where prompts specify quiet woodland margins.

**Why:** A three-scene extension kept abrupt side-band transitions after an edit that explicitly requested their removal; correct export dimensions alone did not catch this.

**How to apply:** Inspect the entire width of each scene as well as the tile joins. Avoid treating edge areas as independent panels in generation prompts, and repair visible side bands before producing the final exports.
