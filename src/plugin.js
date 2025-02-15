function LightingPlugin(k) {
    /*
     * PLUGIN OPTIONS
     */

    /** Whether or not to load default shaders. */
    const LOAD_DEFAULT_SHADERS = true;
    /** The maximum amount of lights. */
    const MAX_LIGHTS = 200;
    /** Whether or not to introduce the plugin "globally". */
    const GLOBAL_PLUGIN = true; // DOESN'T WORK

    /*
     * PLUGIN OPTIONS END
     */

    /** The game's Global Light. */
    let GLOBAL_LIGHT = {
        color: new k.Color(255,255,255),
        intensity: 0.0,
    }

    /**
     * Creates a light that passes its information onto any 'litShader'.
     * 
     * @typedef Light
     */
    class Light {
        static totalLights = 0;
        static lights = []; // Static array to store all lights

        constructor(
            strength = 0.5,
            radius = 0.5,
            pos = k.vec2(0),
            color = k.Color.fromArray([255, 255, 255])
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
        static addLight(light) {
            Light.lights.push(light);
            Light.totalLights++;
        }

        /**
         * Remove a light from the lights array.
         */
        static removeLight(light) {
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
        static createLightingUniforms(otherUniforms={}) {
            const camTransform = k.getCamTransform();
            const aspectRatio = k.width() / k.height();

            // global light color normalized to [0, 1]
            const globalColor = new k.Color(
                getGlobalLight().color.r/255,
                getGlobalLight().color.g/255,
                getGlobalLight().color.b/255
            );
            const globalIntensity = getGlobalLight().intensity;

            const lightStrength = Light.lights.map(light => light.strength);
            const lightRadius = Light.lights.map(light => light.radius);
            const lightPos = Light.lights.map(light => light.pos);
            // light color normalized to [0, 1]
            const lightColor = Light.lights.map(light => new k.Color(light.color.r / 255, light.color.g / 255, light.color.b / 255));

            let uniforms = {
                "u_time": k.time(),
                "u_width": k.width(),
                "u_height": k.height(),
                "u_aspectRatio": aspectRatio,
                // convert to Mat4 from Mat23
                "u_camTransform": new Mat4([
                    camTransform.a, camTransform.b, 0, 0,
                    camTransform.c, camTransform.d, 0, 0,
                    0, 0, 1, 0,
                    camTransform.e, camTransform.f, 0, 1
                ]),
                "u_globalLightColor": globalColor,
                "u_globalLightIntensity": globalIntensity,
                "u_lightStrength": lightStrength,
                "u_lightRadius": lightRadius,
                "u_lightPos": lightPos,
                "u_lightColor": lightColor,
                "u_lights": Light.lights.length,
            }

            // attach these uniforms to the custom uniforms given by `litShader()` component
            Object.assign(uniforms, otherUniforms);

            return uniforms;
        }
    }

    /**
     * Loads a shader using the lighting module.
     * 
     * @function loadLitShader
     */
    function loadLitShader(name, vert, litFrag) {
        return k.loadShader(name, vert, `
            #define NUM_LIGHTS ${MAX_LIGHTS}

            // generic kaplay information
            uniform float u_time;
            uniform float u_width;
            uniform float u_height;
            uniform float u_aspectRatio;
            uniform mat4 u_camTransform;

            // global light
            uniform vec3 u_globalLightColor;
            uniform float u_globalLightIntensity;

            // lighting
            uniform float u_lightStrength[NUM_LIGHTS];
            uniform float u_lightRadius[NUM_LIGHTS];
            uniform vec2 u_lightPos[NUM_LIGHTS];
            uniform vec3 u_lightColor[NUM_LIGHTS];
            uniform float u_lights;

            // normal maps
            uniform vec2 u_nm_min;
            uniform vec2 u_nm_max;
            uniform vec2 u_tex_min;
            uniform vec2 u_tex_max;
            uniform float u_useNormalMap;
            uniform float u_rotation; // in radians

            vec2 normalizeCoords(vec2 pos) {
                pos.x *= u_width / u_height;
                return pos;
            }

            float map(float n, float min1, float max1, float min2, float max2) {
                return ((n - min1) / (max1 - min1)) * (max2 - min2) + min2;
            }

            vec2 map(vec2 n, vec2 min, vec2 max, vec2 min2, vec2 max2) {
                return vec2(
                    map(n.x, min.x, max.x, min2.x, max2.x),
                    map(n.y, min.y, max.y, min2.y, max2.y)
                );
            }

            // basically just map but wanted it simpler so
            vec2 rescaleUV(vec2 uv, vec2 minUV, vec2 maxUV) {
                return vec2(
                    map(uv.x, minUV.x, maxUV.x, 0.0, 1.0),
                    map(uv.y, minUV.y, maxUV.y, 0.0, 1.0)
                );
            }

            // rotates the normal "map" to a given angle
            vec3 rotateNormal(vec3 normal, float angle) {
                // creates a 2D rot matrix
                float cosTheta = cos(angle);
                float sinTheta = sin(angle);
                mat2 rotationMatrix = mat2(
                    cosTheta, -sinTheta,
                    sinTheta,  cosTheta
                );

                // apply rotation to the normal
                vec2 rotatedNormalXY = rotationMatrix * normal.xy;
                return vec3(rotatedNormalXY, normal.z);
            }

            // lighting shader
            vec3 calculateLighting(vec2 pos, vec2 uv, vec4 color, sampler2D tex) {
                vec3 totalLight = u_globalLightColor * u_globalLightIntensity;

                vec3 normal = vec3(0.0, 0.0, 1.0);
                if (u_useNormalMap > 0.0) {
                    vec2 uv_nm = map(uv, u_tex_min, u_tex_max, u_nm_min, u_nm_max);
                    normal = texture2D(tex, uv_nm).rgb * 2.0 - 1.0;

                    normal = rotateNormal(normal, u_rotation);
                }

                for (int i = 0; i < NUM_LIGHTS; i++) {
                    if (i >= int(u_lights)) break;

                    float lightStrength = u_lightStrength[i];
                    float lightRadius = u_lightRadius[i];
                    vec2 lightPos = u_lightPos[i];
                    vec3 lightColor = u_lightColor[i];

                    vec4 transformedLightPos = u_camTransform * vec4(lightPos.xy, 0.0, 1.0);
                    transformedLightPos.x = (transformedLightPos.x * 2.0 / u_width - 1.0) * u_aspectRatio;
                    transformedLightPos.y = 1.0 - (transformedLightPos.y * 2.0 / u_height);
                    vec2 nPos = normalizeCoords(pos);
                    float dist = distance(transformedLightPos.xy, nPos);
                    float sdf = 1.0 - smoothstep(0.0, lightRadius, dist);

                    if (u_useNormalMap > 0.0) {
                        vec3 lightDir = normalize(vec3(transformedLightPos.xy - nPos, 0.0));
                        float diffuse = max(dot(normal, lightDir), 0.0);
                        sdf *= diffuse;
                    }

                    totalLight += lightColor * sdf * lightStrength;
                }
                return totalLight;
            }

            // where the custom lit shader code goes
            ${litFrag}

            // to implement custom litShader code
            vec4 frag(vec2 pos, vec2 uv, vec4 color, sampler2D tex) {
                vec4 lf = lit_frag(pos, uv, color, tex);

                vec3 lighting = calculateLighting(pos, uv, color, tex);

                return vec4(lf.rgb * lighting, lf.a);
            }
        `);
    }

    /**
     * Gets the UV coordinates of the given sprite and frame for shader usage.
     * 
     * @param {string} spriteName The given sprite.
     * @param {number} frame The frame of the sprite.
     * 
     * @returns {{min: Vec2, max: Vec2}} A {min, max} for the UV bounds.
     */
    function getUVBounds(spriteName, frame=0) {
        return {
            min: k.vec2(
                k.getSprite(spriteName).data.frames[frame].x,
                k.getSprite(spriteName).data.frames[frame].y
            ),
            max: k.vec2(
                k.getSprite(spriteName).data.frames[frame].x + k.getSprite(spriteName).data.frames[frame].w,
                k.getSprite(spriteName).data.frames[frame].y + k.getSprite(spriteName).data.frames[frame].h
            )
        }
    }

    /**
     * Gets the input for applying normal maps for a 'litShader'.
     * 
     * @param {string} spriteTexName The sprite used for display.
     * @param {string} spriteNMName The sprite's normal map.
     * 
     * @returns {LitShaderOpt} An input for `litShader()` component options.
     */
    function getNormalMapInput(spriteTexName, spriteNMName, {rot=0, uniforms={}} = {}) {
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
     * 
     * @returns {LitShaderComp}
     */
    function litShader(shaderName, {uniforms={}, nm=null, tex=null, rot=0} = {}) {
        return {
            id: "litShader",
            require: [],

            add() {
                this.uniforms = uniforms;
                this.nm = nm;
                this.tex = tex;
                this.rot = rot;

                // apply normal maps
                if (this.nm != null && this.tex != null) {
                    this.uniforms["u_nm_min"] = nm.min;
                    this.uniforms["u_nm_max"] = nm.max;
                    this.uniforms["u_tex_min"] = tex.min;
                    this.uniforms["u_tex_max"] = tex.max;
                    this.uniforms["u_useNormalMap"] = 1;
                    this.uniforms["u_rotation"] = rot;
                } else {
                    this.uniforms["u_useNormalMap"] = 0;
                }

                this.use(k.shader(shaderName), Light.createLightingUniforms(this.uniforms));
            },

            update() {
                this.uniform = Light.createLightingUniforms(this.uniforms);
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
        loadLitShader("litSprite", null, `
            vec4 lit_frag(vec2 pos, vec2 uv, vec4 color, sampler2D tex) {
                return def_frag();
            }
        `);
    }
    
    // defining types LitShaderOpt, LitShaderComp
    /**
     * @typedef LitShaderOpt
     * @type {object}
     * @property {} uniforms - An object containing uniforms to pass to the 'litShader'. 
     * @property {Vec2} tex - UV Bounds of the sprite's texture.
     * @property {Vec2} nm - UV Bounds of the sprite's normal map.
     * @property {number} rot - The rotation of the object.
     */

    /**
     * @typedef LitShaderComp
     * @type {object}
     * @property {string} id
     * @property {string[]} require
     * @property {() => {}} add
     * @property {() => {}} update
     */

    // assign to window for global access?
    if (GLOBAL_PLUGIN) {
        window.Light = Light;
        window.GLOBAL_LIGHT = GLOBAL_LIGHT;
        window.loadLitShader = loadLitShader;
        window.getUVBounds = getUVBounds;
        window.getNormalMapInput = getNormalMapInput;
        window.setGlobalLight = setGlobalLight;
        window.getGlobalLight = getGlobalLight;
        window.litShader = litShader;
        /**
         * @type {LitShaderOpt}
         * @description The type definition for the options object used in 'litShader()'.
         */
        window.LitShaderOpt = null;
    }

    return {
        Light: Light,
        GLOBAL_LIGHT: GLOBAL_LIGHT,
        loadLitShader: loadLitShader,
        getUVBounds: getUVBounds,
        getNormalMapInput: getNormalMapInput,
        setGlobalLight: setGlobalLight,
        getGlobalLight: getGlobalLight,
        litShader: litShader,
        /**
         * @type {LitShaderOpt}
         * @description The type definition for the options object used in 'litShader()'.
         */
        LitShaderOpt: null,
    };
}

export default LightingPlugin;