
// generic kaplay information
uniform float u_width;
uniform float u_height;

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
    return vec2(map(n.x, min.x, max.x, min2.x, max2.x), map(n.y, min.y, max.y, min2.y, max2.y));
}

            // basically just map but wanted it simpler so
vec2 rescaleUV(vec2 uv, vec2 minUV, vec2 maxUV) {
    return vec2(map(uv.x, minUV.x, maxUV.x, 0.0, 1.0), map(uv.y, minUV.y, maxUV.y, 0.0, 1.0));
}

            // rotates the normal "map" to a given angle
vec3 rotateNormal(vec3 normal, float angle) {
                // creates a 2D rot matrix
    float cosTheta = cos(angle);
    float sinTheta = sin(angle);
    mat2 rotationMatrix = mat2(cosTheta, -sinTheta, sinTheta, cosTheta);

                // apply rotation to the normal
    vec2 rotatedNormalXY = rotationMatrix * normal.xy;
    return vec3(rotatedNormalXY, normal.z);
}

            // lighting shader
vec3 calculateLighting(vec2 pos, vec2 uv, vec4 color, sampler2D tex) {
    vec3 totalLight = u_globalLightColor * u_globalLightIntensity;

    vec3 normal = vec3(0.0, 0.0, 1.0);
    if(u_useNormalMap > 0.0) {
        vec2 uv_nm = map(uv, u_tex_min, u_tex_max, u_nm_min, u_nm_max);
        normal = texture2D(tex, uv_nm).rgb * 2.0 - 1.0;

        normal = rotateNormal(normal, u_rotation);
    }

    for(int i = 0; i < NUM_LIGHTS; i++) {
        if(i >= int(u_lights))
            break;

        float lightStrength = u_lightStrength[i];
        float lightRadius = u_lightRadius[i];
        vec2 lightPos = u_lightPos[i] / vec2(u_width, u_height);
        vec3 lightColor = u_lightColor[i] / 255.0;

        lightPos.x *= (u_width / u_height);
        vec4 transformedLightPos = vec4(lightPos.xy, 0.0, 1.0);
        vec2 nPos = normalizeCoords(pos) / vec2(u_width, u_height);
        float dist = distance(transformedLightPos.xy, nPos);
        float sdf = 1.0 - smoothstep(0.0, lightRadius, dist);

        if(u_useNormalMap > 0.0) {
            vec3 lightDir = normalize(vec3(transformedLightPos.xy - nPos, 0.0));
            float diffuse = max(dot(normal, lightDir), 0.0);
            sdf *= diffuse;
        }

        totalLight += lightColor * sdf * lightStrength;
    }
    return totalLight;
}

// lit_frag() will be inserted immediately before frag()

// to implement custom litShader code
vec4 frag(vec2 pos, vec2 uv, vec4 color, sampler2D tex) {
    vec4 lf = lit_frag(pos, uv, color, tex);

    vec3 lighting = calculateLighting(pos, uv, color, tex);

    return vec4(lf.rgb * lighting, lf.a);
}
