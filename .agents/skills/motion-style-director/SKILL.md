---
name: motion-style-director
description: Plan and implement code-driven cinematic motion graphics using 20 visual styles, with inspected references, timeline choreography, rendering, and visual QA. For Codex, Claude Code, and agents that support SKILL.md.
---

# Motion Style Director

This is an ORIGINAL guidance skill inspired by a user's reference video showing 20 visual design styles. It is not the video's author's private Claude skill pack and does not contain that author's proprietary instructions.

## When to use
- A user provides a reference video and wants visual motion, a product promo, cinematic 2.5D sequence, typography reel, animated graphics, or branded reveal.
- A user asks for one of the 20 styles in `references/style-catalog.md`.
- Avoid using for simple static design unless motion is requested.

## Required workflow
1. **Inspect** uploaded/reference video before planning. Inspect at multiple timestamps; separate effects visibly demonstrated from assumptions.
2. **Classify** output: browser interaction, short motion graphic, or narrated/multi-scene video; select a compatible rendering system already used in the project.
3. **Choose one dominant style and at most two supporting styles** for a coherent visual language. Match the brand, not just the reference.
4. **Set a beat sheet**: for each scene define start/end frames, key message, assets, motion, easing, camera/depth, transition, and hold for legibility.
5. **Acquire assets legally** and preserve real persons' likenesses, labels, and names. Never invent faces/names or claim a synthetic face is a real participant.
6. **Build from known libraries and existing project conventions** before creating custom effects. Verify package APIs and relevant versions. Do not fabricate names of available plugins or SKILL.md files.
7. **Use frame-deterministic animation** for exported video, and duration-aware elements. For time-driven visual effects, ensure snapshots at a given frame render consistently; consider browser/WebGL availability in headless rendering.
8. **Preview, inspect, correct**: render frame grabs from the opening, signature motion, every transition, and final end card; watch the full sequence; verify text, clipping, timing, asset fidelity and smoothness.
9. **Verify delivered file** with a probe: codec, duration, dimensions, framerate and audible audio where audio was requested. Never claim sound, VO, or transitions are present without checking.
10. **Report honestly** which effects were implemented versus approximated, what software was used, and what QA was run. Do not automatically install unknown third-party scripts or skills without review.

## Animation craft defaults
- Readability wins: hold essential titles, avoid stacked overlapping titles and noisy transitions.
- Design with safe margins for 9:16, 1:1, and 16:9; avoid crucial information near app overlays.
- Use purposeful camera moves, staging, easing, object continuity, and selective motion blur, not random zooms or effects.
- If narrating, time typography and reveals to actual voice/audio waveforms, not guessed narration timing.
- For a multi-scene ad, create an actual story arc (hook → promise → demonstration → proof → CTA).
- For glass/gradients/neon, inspect contrast. For particles/liquids, budget GPU and prevent jarring drop frames.

## Engines, preferred uses
- **Remotion:** React-composed, frame-timed videos, caption systems, brand promos, social exports. Refer to official Remotion agent skills first.
- **HyperFrames + GSAP:** HTML-native animations, choreographed scenes and motion graphics with render/preview tooling. Use project/install-specific HyperFrames skills.
- **Three.js or React Three Fiber:** particles, 3D geometry, wireframe, isometric camera, lights, volumetric or shader-based treatments; integrate only as needed.
- **Blender:** demanding 3D models and photorealistic assets, when an appropriate 3D production workflow is available.
- **React Bits / Codrops / Motion:** visual references, web components and patterns, not substitutes for a full timed video pipeline.

See `references/style-catalog.md` for 20 styles; `references/verified-sources.md` for project links and install guidance. Source links are not an indication of automatic installation.
