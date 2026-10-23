# Public resources checked on 23 October 2026

## Installable agent skills (verify content, license, and security before adding)

- Remotion Agent Skills (official): https://github.com/remotion-dev/skills  
  Documented installation: `npx skills add remotion-dev/skills`
- HyperFrames (official): https://github.com/heygen-com/hyperframes  
  Documented installation option: `npx skills add heygen-com/hyperframes` ; see its skills documentation for selective installations.
- Motion Graphics Skill Pack: https://github.com/charlie947/motion-graphics-skills  
  Includes `reference-to-motion` and production-oriented skills. `npx skills add charlie947/motion-graphics-skills`
- iart-ai Motion Skills: https://github.com/iart-ai/motion-skills  
  Collection of thematic skill packs, including kinetic typography, ad video, short-form, data, and WebGL.
- VisualxIntelligence motion tools and skills: https://github.com/VisualxIntelligence/motion-tools-and-skills  
  Includes several example skills and source projects; review individual upstream licenses.
- RFTaurus Motion Skill: https://github.com/RFTaurus/motion-skill  
  Browser-based motion graphics with a self-contained HTML output.
- Framesmith: https://github.com/Ar9av/framesmith  
  Python + FFmpeg templated motion videos, including brutalist/glass/promo types.

## Code examples and demos (not necessarily installable SKILL.md bundles)

- React Bits tools: https://www.reactbits.dev/tools
- React Bits source: https://github.com/DavidHDev/react-bits
- Codrops tutorials: https://tympanus.net/codrops/hub/tutorials/
- Motion examples: https://motion.dev/examples
- Motion Primitives source: https://github.com/ibelick/motion-primitives
- React Three Fiber: https://github.com/pmndrs/react-three-fiber

## Codex project-local instructions

A verified placement convention for a self-contained skill is:

```
project-root/
  .agents/
    skills/
      motion-style-director/
        SKILL.md
        references/
          style-catalog.md
          verified-sources.md
```

Extract the `motion-style-director/` folder into `.agents/skills/`, then open a new Codex task so it discovers the skill. Installation instructions differ across Codex variants and UIs; verify your environment. This skill is our newly authored guide, not a copy of any listed third-party skill.
