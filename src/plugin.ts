import type { Comp, GameObj, PosComp, ShaderComp, ShaderData, Tag, Uniform } from "kaplay";
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
    /** The intensity of the light. */
    strength: number;
    /** The radius of the light. */
    radius: number;
    pos: Vec2;
    /** The color of the light. */
    color: Color;
    /**
     * If not empty, only objects with at least one
     * of these tags will be lit by this light.
     */
    tags: Tag[];
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
    /** The intensity of the light. */
    strength?: number;
    /** The radius of the light. */
    radius?: number;
    /** The color of the light. */
    color?: Color;
    /**
     * If not empty, only objects with at least one
     * of these tags will be lit by this light.
     */
    tags?: Tag[];
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

export interface KAPLAYLightingPlugin {
    Light: LightStatic;
    GLOBAL_LIGHT: GlobalLight;
    loadLitShader: (name: string, vert: string | null, litFrag: string | null) => Asset<ShaderData>;
    getUVBounds: (spriteName: string, frame?: number) => UVBounds | null;
    getNormalMapInput: (spriteTexName: string, spriteNMName: string, options?: { rot?: number, uniforms?: Record<string, any> }) => LitShaderOpt;
    setGlobalLight: (options: { color?: Color, intensity?: number }) => GlobalLight;
    getGlobalLight: () => GlobalLight;
    litShader: (shaderName: string, opt?: LitShaderOpt) => LitShaderComp;
    lightSource: (opt?: LightCompOpt) => LightComp;
}


export default function kaplayLighting(k: KAPLAYCtx): KAPLAYLightingPlugin {
    /*
     * PLUGIN OPTIONS
     */

    /** Whether or not to load default shaders. */
    const LOAD_DEFAULT_SHADERS = true;
    /** The maximum amount of lights. */
    const MAX_LIGHTS = 200;

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


        constructor(
            public strength = .5,
            public radius = .5,
            public pos = k.vec2(0),
            public color = k.WHITE,
            public tags: Tag[] = [],
        ) {

            Light.addLight(this);
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
    }

    /**
     * Loads a 'litShader' using the lighting module.
     * 
     * @param name The name of the 'litShader'.
     * @param vert The vertex shader of the 'litShader'.
     * @param litFrag The fragment shader of the 'litShader'.
     */
    function loadLitShader(name: string, vert: string | null, litFrag: string | null) {
        return k.loadShader(name, vert, `\n#define MAX_LIGHTS ${MAX_LIGHTS}\n${litShaderTemplateBefore}${litFrag}${litShaderTemplateAfter}`);
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
        color = GLOBAL_LIGHT.color,
        intensity = GLOBAL_LIGHT.intensity
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
                    this.uniforms.u_nm_min = this.nm.min;
                    this.uniforms.u_nm_max = this.nm.max;
                    this.uniforms.u_tex_min = this.tex.min;
                    this.uniforms.u_tex_max = this.tex.max;
                    this.uniforms.u_useNormalMap = 1;
                    this.uniforms.u_rotation = this.rot;
                } else {
                    this.uniforms.u_useNormalMap = 0;
                }
                this.use(k.shader(shaderName, {}));
            },

            update(this: GameObj<ShaderComp | LitShaderComp>) {
                // global light color normalized to [0, 1]
                const global = getGlobalLight();
                const globalColor = new k.Color(
                    global.color.r / 255,
                    global.color.g / 255,
                    global.color.b / 255
                );
                const globalIntensity = global.intensity;

                const lightStrength: number[] = [];
                const lightRadius: number[] = [];
                const lightPos: Vec2[] = [];
                const lightColor: Color[] = [];
                // light color normalized to [0, 1]
                const lights = Light.lights;

                for (let i = 0; i < lights.length; i++) {
                    const { strength, radius, pos, color, tags } = Light.lights[i]!;
                    if (tags.length > 0 && !this.is(tags, "or")) continue;
                    lightStrength.push(strength);
                    lightRadius.push(radius);
                    lightPos.push(pos);
                    lightColor.push(color);
                }

                // attach these uniforms to the custom uniforms given by `litShader()` component
                Object.assign(this.uniform!, {
                    u_time: k.time(),
                    u_width: k.width(),
                    u_height: k.height(),
                    // convert to Mat4 from Mat23
                    u_camTransform: k.getCamTransform(),
                    u_globalLightColor: globalColor,
                    u_globalLightIntensity: globalIntensity,
                    u_lightStrength: lightStrength,
                    u_lightRadius: lightRadius,
                    u_lightPos: lightPos,
                    u_lightColor: lightColor,
                    u_lights: lights.length,
                }, typeof this.uniforms === "function" ? this.uniforms() : this.uniforms);
            }
        }
    }

    /**
     * Makes your object contain a light.
     */
    function lightSource({ strength = 1.0, radius = 0.5, color = k.WHITE, tags = [] }: LightCompOpt = {}): LightComp {
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
                    tags
                );
            },
            update(this: GameObj<PosComp | LightComp>) {
                const sp = this.screenPos();
                const l = this.light as Light;
                if (sp === null || l === null)
                    return;
                l.pos = k.toWorld(sp);
            },
            destroy(this: GameObj<PosComp | LightComp>) {
                const l = this.light as Light;
                if (l === null)
                    return;
                Light.removeLight(l);
                this.light = null;
            },
            inspect(this: GameObj<PosComp | LightComp>) {
                return "light: " + String(this.light);
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
        lightSource,
    }
}