# KAPLAY Lighting Plugin

A lighting plugin for your KAPLAY games!

## Features
- Basic Light Types: Point Light, Global Light (Doesn't have directional light yet, just lights the entire screen equally)
- Normal Map Support
- Lit Shaders that apply custom shader code combined with the lighting effect.

## Usage

1. Install kaplay-lighting with `npm i kaplay-lighting`
2. Import kaplay-lighting into your project with `import LightingPlugin from "kaplay-lighting"`
3. Add `LightingPlugin` as a plugin to kaplay.

```js
import kaplay from "kaplay";
import LightingPlugin from "kaplay-lighting";

// Initialize KAPLAY with the Lighting plugin
const k = kaplay({
    plugins: [LightingPlugin]
});

// Your game code here
```
