
// generic kaplay information
uniform float u_width;
uniform float u_height;

// global light
uniform vec3 u_globalLightColor;
uniform float u_globalLightIntensity;

// lighting
uniform float u_lightStrength[MAX_LIGHTS];
uniform float u_lightNearRadius[MAX_LIGHTS];
uniform float u_lightFarRadius[MAX_LIGHTS];
uniform vec2 u_lightPos[MAX_LIGHTS];
uniform vec3 u_lightColor[MAX_LIGHTS];
uniform float u_direction[MAX_LIGHTS]; // beam direction angle in radians (for directional lights)
uniform float u_lightType[MAX_LIGHTS]; // 1 = directional light, 0 = point light
uniform float u_lightSpread[MAX_LIGHTS]; // beam spread angle for directional lights
uniform float u_widthMin[MAX_LIGHTS];
uniform float u_widthMax[MAX_LIGHTS];
uniform float u_lights;
uniform mat4 u_transformation;

// normal maps
uniform vec2 u_nm_min;
uniform vec2 u_nm_max;
uniform vec2 u_tex_min;
uniform vec2 u_tex_max;
uniform float u_useNormalMap;

vec2 normalizeCoords(vec2 pos) {
    pos.x *= u_width / u_height;
    return pos;
}

float map(float n, float min1, float max1, float min2, float max2) {
    return ((n - min1) / (max1 - min1)) * (max2 - min2) + min2;
}

vec2 map(vec2 n, vec2 min, vec2 max, vec2 min2, vec2 max2) {
    return vec2(map(n.x, min.x, max.x, min2.x, max2.x), map(n.y, min.y, max.y, min2.y, max2.y));
}

mat2 rotation(float angle) {
    float c = cos(angle), s = sin(angle);
    return mat2(c, -s, s, c);
}

vec3 rotateVector(vec3 v, float theta) {
    return vec3(rotation(theta) * v.xy, v.z);
}

// lighting shader
vec3 calculateLighting(vec2 pos, vec2 uv, sampler2D tex) {
    vec3 totalLight = u_globalLightColor * u_globalLightIntensity / 255.;
    bool hasNMap = u_useNormalMap > 0.;
    vec3 normal = hasNMap ? texture2D(tex, map(uv, u_tex_min, u_tex_max, u_nm_min, u_nm_max)).rgb * 2. - 1. : vec3(0., 0., 1.);

    for(int i = 0; i < MAX_LIGHTS; i++) {
        if(i >= int(u_lights))
            break;

        float lightStrength = u_lightStrength[i];
        float near = u_lightNearRadius[i] / u_height;
        float far = u_lightFarRadius[i] / u_height;
        vec2 lightPos = u_lightPos[i] / vec2(u_width, u_height);
        vec3 lightColor = u_lightColor[i] / 255.;

        lightPos.x *= (u_width / u_height);
        vec2 nPos = normalizeCoords(pos) / vec2(u_width, u_height);
        float dist = distance(lightPos, nPos);
        float distanceFalloff = near == far ? (dist > far ? 0. : 1.) : 1. - smoothstep(near, far, dist);
        // TODO: transform this instead of transforming the normal
        vec2 pixelVector = (u_transformation * vec4(lightPos - nPos, 0., 0.)).xy;
        float diffuse = hasNMap ? max(dot(normal, normalize(vec3(pixelVector, 0.))), 0.) : 1.;
        if(distanceFalloff <= 0.)
            continue;

        if(u_lightType[i] > 1.) {
            // Directional light
            totalLight += lightColor * diffuse * lightStrength;
        } else if(u_lightType[i] > 0.) {
            // Spot light (flashlight beam)
            float dir = u_direction[i], wm = u_widthMin[i] / u_height / 2., wx = u_widthMax[i] / u_height / 2., sh = u_lightSpread[i] / 2., beamFalloff = 1.;

            vec2 rPV = rotation(dir) * pixelVector;
            float localAngle = atan(rPV.y, rPV.x);

            if(abs(localAngle) >= sh) {
                vec2 d = rotation(localAngle < 0. ? -sh : sh) * rPV;
                float b = d.x < 0. ? length(d) : abs(d.y);
                beamFalloff = wm == wx ? (b > wx ? 0. : 1.) : 1. - smoothstep(wm, wx, b);
            }

            totalLight += lightColor * beamFalloff * distanceFalloff * diffuse * lightStrength;
        } else {
            // Point light

            totalLight += lightColor * distanceFalloff * diffuse * lightStrength;
        }
    }
    totalLight = max(totalLight, vec3(0.));
    return totalLight;
}

// lit_frag() will be inserted immediately before frag()

// to implement custom litShader code
vec4 frag(vec2 pos, vec2 uv, vec4 color, sampler2D tex) {
    vec4 lf = lit_frag(pos, uv, color, tex);

    vec3 lighting = calculateLighting(pos, uv, tex);

    return vec4(lf.rgb * lighting, lf.a);
}
