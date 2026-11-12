# 20 motion styles: implementation reference

Observed titles from Mohammed Farshan's “20 crazy Claude animation styles” social clip. The recommendations below are our own implementation ideas, not his private skill files.

| # | Style | Visual objective | Useful code techniques | QA focus |
|---|---|---|---|---|
| 1 | Particles | Sparks/nodes that arrange and disperse | GPU points, Canvas, Three.js buffer geometry | density, fps, message visibility |
| 2 | Liquid morph | Fluid merging, blob-to-shape | SVG filters, displacement shaders, GLSL | smooth topology, no flickering edges |
| 3 | Holographic | Iridescent/scan-lit card | gradient shaders, reflection/specular, layered glow | avoid blown-out text |
| 4 | Neon glow | Bright lit outlines | CSS/SVG glows, bloom postprocess, blur | readable core, bloom limits |
| 5 | Wireframe 3D | Animated line meshes | Three.js WireframeGeometry, camera tween | geometry and aliasing |
| 6 | Glass morphism | Frosted layers | backdrop blur, masks, shadows, highlights | legibility, depth hierarchy |
| 7 | Kinetic type | Energetic typography | GSAP staggers, glyph masks, Remotion interpolate | spelling, timing and safe area |
| 8 | Isometric | 3D-like diagram | ortho camera, 2.5D layers, procedural shapes | believable dimensions |
| 9 | Clay 3D | Soft miniature shapes | 3D material, soft key lights, ambient occlusion | shadows, edges, plasticity |
| 10 | ASCII art | Pixels re-expressed in glyphs | luminance sampling, glyph grid, canvas | density and brand legibility |
| 11 | Gradient mesh | Smooth colored light pools | CSS gradients, shader planes, mesh gradient | banding, contrast |
| 12 | Comic book | Panels and comic reveals | halftone fills, ink outlines, bold wipes | visual hierarchy |
| 13 | Split flap | Physical flipping characters | CSS 3D transforms, split glyph layers, frame control | character sync, seam visibility |
| 14 | Retro VHS | Analog video treatment | scanlines, RGB shift, chroma separation, noise | restrained noise and readable copy |
| 15 | Halftone | Printed dot matrices | stipple/dot shader, Canvas pattern | moiré/aliasing at export size |
| 16 | Bauhaus | Geometric modernist motion | strict grid, circles/rectangles, typography | balanced geometry |
| 17 | Pixel art | Low-res image or sprites | nearest-neighbor render, sprite sheets | crisp edges, pixel consistency |
| 18 | Blueprint | Technical wire diagrams | SVG lines/path drawing, grids, annotations | dimension label correctness |
| 19 | Art Deco | Radial lines and luxe geometry | SVG path trim, gold/black graphic design | symmetry, line spacing |
| 20 | Neo-brutalism | Harsh flat blocks, graphic punch | bold outlines, high contrast, abrupt but intentional moves | avoid unreadable clutter |

## Recommended combinations
- High-end product: glass morphism + gradient mesh + restrained neon.
- Tech launch / dashboard: kinetic type + wireframe 3D + blueprint.
- Youth/social event: kinetic type + isometric + limited particle hits.
- Retro music poster: VHS + split flap + halftone.
- Explainer: Bauhaus + isometric + kinetic type.

Implement only those styles supported by the available renderer and inspect the result at final output size. Do not assume every style requires paid tools or any particular AI model.
