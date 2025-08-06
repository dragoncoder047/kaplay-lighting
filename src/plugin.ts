import type { Comp, GameObj, PosComp, ShaderComp, ShaderData, Uniform } from "kaplay";
import { Asset, Color, KAPLAYCtx, SpriteData, Vec2 } from "kaplay";
import lightingOnly from "./lighting-only.glsl";
import litShaderTemplate from "./lit.glsl";

const frag_i = litShaderTemplate.indexOf("vec4 frag");
const litShaderTemplateBefore = litShaderTemplate.slice(0, frag_i);
const litShaderTemplateAfter = litShaderTemplate.slice(frag_i);

export type UVBounds = {
    min: Vec2,
    max: Vec2
}

export type GlobalLight = {
    color: Color,
    intensity: number,
}

export interface ILight {
    strength: number;
    radius: number;
    pos: Vec2;
    color: Color;
}

export interface LitShaderOpt {
    uniforms?: Uniform | (() => Uniform) | null,
    tex?: UVBounds | null,
    nm?: UVBounds | null,
    rot?: number | null
}

export interface LitShaderComp extends Comp {
    uniforms: Uniform | (() => Uniform),
    tex?: UVBounds | null,
    nm?: UVBounds | null,
    rot: number
}

export interface LightCompOpt {
    strength?: number;
    radius?: number;
    color?: Color;
}

export interface LightComp extends Comp {
    light: ILight | null;
}

export interface LightStatic {
    new(
        strength?: number,
        radius?: number,
        pos?: Vec2,
        color?: Color
    ): ILight;
    totalLights: number;
    lights: ILight[];
    addLight(light: ILight): void;
    removeLight(light: ILight): void;
    clearLights(): void;
    createLightingUniforms(otherUniforms?: Record<string, any>): Record<string, any>;
}

export interface LightingPluginReturn {
    Light: LightStatic;
    GLOBAL_LIGHT: GlobalLight;
    loadLitShader: (name: string, vert: string | null, litFrag: string | null) => Asset<ShaderData>;
    getUVBounds: (spriteName: string, frame?: number) => UVBounds | null;
    getNormalMapInput: (spriteTexName: string, spriteNMName: string, options?: { rot?: number, uniforms?: Record<string, any> }) => LitShaderOpt;
    setGlobalLight: (options: { color?: Color, intensity?: number }) => GlobalLight;
    getGlobalLight: () => GlobalLight;
    litShader: (shaderName: string, opt?: LitShaderOpt) => LitShaderComp;
    light: (opt?: LightCompOpt) => LightComp;
}


export default function LightingPlugin(k: KAPLAYCtx): LightingPluginReturn {
    /*
     * PLUGIN OPTIONS
     */

    /** Whether or not to load default shaders. */
    const LOAD_DEFAULT_SHADERS = true;
    /** The maximum amount of lights. */
    const MAX_LIGHTS = 200;
    /** Whether or not to introduce the plugin "globally". */
    //const GLOBAL_PLUGIN = true; // DOESN'T WORK

    /*
     * PLUGIN OPTIONS END
     */

    /** The game's Global Light. */
    let GLOBAL_LIGHT: GlobalLight = {
        color: new k.Color(255, 255, 255),
        intensity: 0.0,
    }

    /**
     * Creates a light that passes its information onto any 'litShader'.
     */
    class Light implements ILight {
        /** The total lights active in the game. */
        static totalLights: number = 0;
        /** The stored Light objects. */
        static lights: Light[] = []; // Static array to store all lights

        /** The intensity of the Light. */
        strength: number;
        /** The radius of the Light. */
        radius: number;
        /** The position of the Light. */
        pos: Vec2;
        /** The color of the Light. */
        color: Color;

        constructor(
            strength: number = 0.5,
            radius: number = 0.5,
            pos: Vec2 = k.vec2(0),
            color: Color = k.Color.fromArray([255, 255, 255])
        ) {
            this.strength = strength;
            this.radius = radius;
            this.pos = pos;
            this.color = color;

            Light.lights.push(this);
            Light.totalLights++;
        }

        /**
         * Add back a light to the lights array.
         */
        static addLight(light: Light) {
            Light.lights.push(light);
            Light.totalLights++;
        }

        /**
         * Remove a light from the lights array.
         */
        static removeLight(light: Light) {
            const index = Light.lights.indexOf(light);
            if (index !== -1) {
                Light.lights.splice(index, 1);
                Light.totalLights--;
            }
        }

        /**
         * Removes all lights from the lights array.
         */
        static clearLights() {
            Light.lights = [];
        }

        /**
         * Creates uniforms for the lighting post effect shader.
         * 
         * @param otherUniforms - Extra uniforms to add to a 'litShader'.
         * 
         * @returns An object containing lighting uniforms and extra uniforms added via 'otherUniforms'.
         */
        static createLightingUniforms(otherUniforms: Uniform | (() => Uniform) = {}) {

            // global light color normalized to [0, 1]
            const globalColor = new k.Color(
                getGlobalLight().color.r / 255,
                getGlobalLight().color.g / 255,
                getGlobalLight().color.b / 255
            );
            const globalIntensity = getGlobalLight().intensity;

            const lightStrength = Light.lights.map(light => light.strength);
            const lightRadius = Light.lights.map(light => light.radius);
            const lightPos = Light.lights.map(light => light.pos);
            // light color normalized to [0, 1]
            const lightColor = Light.lights.map(light => light.color);

            let uniforms = {
                "u_time": k.time(),
                "u_width": k.width(),
                "u_height": k.height(),
                // convert to Mat4 from Mat23
                "u_camTransform": k.getCamTransform(),
                "u_globalLightColor": globalColor,
                "u_globalLightIntensity": globalIntensity,
                "u_lightStrength": lightStrength,
                "u_lightRadius": lightRadius,
                "u_lightPos": lightPos,
                "u_lightColor": lightColor,
                "u_lights": Light.lights.length,
            }

            // attach these uniforms to the custom uniforms given by `litShader()` component
            Object.assign(uniforms, typeof otherUniforms === "function" ? otherUniforms() : otherUniforms);

            return uniforms;
        }
    }

    /**
     * Loads a 'litShader' using the lighting module.
     * 
     * @param name The name of the 'litShader'.
     * @param vert The vertex shader of the 'litShader'.
     * @param litFrag The fragment shader of the 'litShader'.
     */
    function loadLitShader(name: string, vert: string | null, litFrag: string | null) {
        return k.loadShader(name, vert, `\n#define NUM_LIGHTS ${MAX_LIGHTS}\n${litShaderTemplateBefore}${litFrag}${litShaderTemplateAfter}`);
    }

    /**
     * Gets the UV coordinates of the given sprite and frame for shader usage.
     * 
     * @param spriteName The given sprite.
     * @param frame The frame of the sprite.
     * 
     * @returns A {min, max} for the UV bounds.
     */
    function getUVBounds(spriteName: string, frame: number = 0): UVBounds | null {
        let sprite: Asset<SpriteData> | null = k.getSprite(spriteName);
        if (sprite == null)
            return null;
        if (sprite.data == null)
            return null;
        return {
            min: k.vec2(
                sprite.data.frames[frame].x,
                sprite.data.frames[frame].y
            ),
            max: k.vec2(
                sprite.data.frames[frame].x + sprite.data.frames[frame].w,
                sprite.data.frames[frame].y + sprite.data.frames[frame].h
            )
        }
    }

    /**
     * Gets the input for applying normal maps for a 'litShader'.
     * 
     * @param spriteTexName The sprite used for display.
     * @param spriteNMName The sprite's normal map.
     * 
     * @returns {LitShaderOpt} An input for `litShader()` component options.
     */
    function getNormalMapInput(spriteTexName: string, spriteNMName: string, { rot = 0, uniforms = {} } = {}) {
        return {
            uniforms: uniforms,
            tex: getUVBounds(spriteTexName),
            nm: getUVBounds(spriteNMName),
            rot: rot
        }
    }

    /**
     * Sets the global light of the game.
     */
    function setGlobalLight({
        color = getGlobalLight().color,
        intensity = getGlobalLight().intensity
    }) {
        GLOBAL_LIGHT = {
            color: color,
            intensity: intensity
        }
        return GLOBAL_LIGHT;
    }

    /**
     * Gets the global light of the game.
     */
    function getGlobalLight() {
        return GLOBAL_LIGHT;
    }

    /**
     * Custom Lit Shader.
     */
    function litShader(shaderName: string, opt: LitShaderOpt = {}): LitShaderComp {
        return {
            id: "litShader",
            require: [],

            uniforms: opt.uniforms ?? {},
            tex: opt.tex ?? null,
            nm: opt.nm ?? null,
            rot: opt.rot ?? 0,
            add(this: GameObj) {
                // apply normal maps
                if (this.nm != null && this.tex != null) {
                    this.uniforms["u_nm_min"] = this.nm.min;
                    this.uniforms["u_nm_max"] = this.nm.max;
                    this.uniforms["u_tex_min"] = this.tex.min;
                    this.uniforms["u_tex_max"] = this.tex.max;
                    this.uniforms["u_useNormalMap"] = 1;
                    this.uniforms["u_rotation"] = this.rot;
                } else {
                    this.uniforms["u_useNormalMap"] = 0;
                }
                this.use(k.shader(shaderName, Light.createLightingUniforms(this.uniforms)));
            },

            update(this: GameObj<ShaderComp>) {
                // @ts-ignore
                this.uniform = Light.createLightingUniforms(this.uniforms);
            }
        }
    }

    /**
     * Makes your object contain a light.
     */
    function light({ strength = 1.0, radius = 0.5, color = new k.Color(255, 255, 255) }: LightCompOpt = {}): LightComp {
        return {
            id: "light",
            require: ["pos"],
            light: null,
            add(this: GameObj<PosComp | LightComp>) {
                this.light = new Light(
                    strength,
                    radius,
                    this.pos,
                    color,
                );
            },
            update(this: GameObj<PosComp | LightComp>) {
                let sp = this.screenPos();
                let l = this.light;
                if (sp === null || l === null)
                    return;
                l.pos = k.toWorld(sp);
            },
            destroy(this: GameObj<PosComp | LightComp>) {
                let l = this.light;
                if (l === null)
                    return;
                Light.removeLight(l);
                this.light = null;
            },
            inspect(this: GameObj<PosComp | LightComp>) {
                return "" + this.light;
            }
        }
    }

    // LOAD DEFAULTS
    if (LOAD_DEFAULT_SHADERS)
        initializeDefaults();

    /**
     * Loads the basic shader samples.
     */
    function initializeDefaults() {
        loadLitShader("litSprite", null, lightingOnly);
    }

    return {
        Light: Light as unknown as LightStatic,
        GLOBAL_LIGHT,
        loadLitShader,
        getUVBounds,
        getNormalMapInput,
        setGlobalLight,
        getGlobalLight,
        litShader,
        light,
    }
}