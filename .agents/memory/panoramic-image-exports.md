---
name: Panoramic image exports
description: Handling image-generation tools that ignore requested panoramic dimensions.
---
Check the actual image dimensions before relying on a requested panoramic composition. Both image editing with a wide source and high-resolution generation can still return square canvases.

**Why:** Wide aspect-ratio instructions and a wide outpainting guide both returned square images. Stretching those results would distort the scenery.

**How to apply:** If the tool cannot produce a wide canvas, request a complete letterboxed panoramic composition, then remove the black bars and proportionally resize/crop. Inspect the resulting full panorama and narrower sections. Be clear that the final export may be upscaled rather than native-resolution generation.
