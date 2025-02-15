import kaplay from "kaplay";
import LightingPlugin from "kaplay-lighting"

const k = kaplay({
    plugins: [LightingPlugin]
});

// load sprites
k.loadSprite("steel", "test/steel.png");
k.loadSprite("steel-nm", "test/steel-nm.png");

// load shader
k.loadShader("test", null, `
    vec4 frag(vec2 pos, vec2 uv, vec4 color, sampler2D tex) {
        vec4 d = def_frag();
        pos /= vec2(1920., 1080.);
        return vec4(d.x + pos.x, d.y + pos.y, d.z, d.a);
    }
`);

k.loadShader("test16", `
    vec4 vert(vec2 pos, vec2 uv, vec4 color) {
        return def_vert();
    }    
`, `

    vec2 normalizeCoords(vec2 pos) {
        pos.x *= 1920. / 1080.;
        return pos;
    }

    vec4 frag(vec2 pos, vec2 uv, vec4 color, sampler2D tex) {
        pos /= vec2(1920., 1080.);
        vec2 nPos = normalizeCoords(pos);

        vec2 lightPos = vec2(1.0, 1.0);
        float lightRadius = 0.5;
        vec3 lightColor = vec3(1.0,1.0,1.0);
        float lightStrength = 4.;

        float dist = distance(lightPos.xy, nPos);
        float sdf = 1.0 - smoothstep(0.0, lightRadius, dist);

        vec3 light = lightColor * sdf * lightStrength;
        return vec4(def_frag().rgb * light, def_frag().a);
    }
`);

k.onLoad(() => {
    k.go("main");
})

k.scene("main", () => {
    let bg = k.add([
        k.pos(),
        k.rect(k.width() * 100, k.height() * 100),
        k.anchor("center"),
        k.color(20,20,20),
        k.litShader("litSprite"),
    ])

    let ground = k.add([
        k.pos(0, k.height()),
        k.anchor("botleft"),
        k.rect(k.width(), 32),
        k.color(35, 35, 35),
        k.litShader("litSprite")
    ])

    // test unlit background
    let bgLit = true;
    k.onKeyPress("t", () => {
        if (bgLit) {
            bg.unuse("litShader");
            bg.unuse("shader");
        } else {
            bg.use(k.litShader("litSprite"));
        }
        bgLit = !bgLit;
    })

    let bgText = k.add([
        k.pos(k.width()/2, 64),
        k.anchor("center"),
        k.text("Press 'T' to toggle background being lit.", {
            align: "center",
        })
    ])
    
    // test custom shader
    let csBlock = k.add([
        k.pos(3*k.width()/4, k.height()/2),
        k.sprite("steel"),
        k.anchor("center"),
        k.litShader("litSprite"),
    ])

    let csText = csBlock.add([
        k.pos(0,-64),
        k.anchor("center"),
        k.text("Test Custom Shader", {
            align: "center",
        })
    ])

    k.onKeyDown("left", () => {
        csBlock.pos.x -= 8
    })

    k.onKeyDown("right", () => {
        csBlock.pos.x += 8
    })

    k.onKeyDown("up", () => {
        csBlock.pos.y -= 8
    })

    k.onKeyDown("down", () => {
        csBlock.pos.y += 8
    })

    // test normal maps
    let nmBlock = k.add([
        k.pos(k.width()/4, k.height()/2),
        k.sprite("steel"),
        k.anchor("center"),
        k.litShader("litSprite", k.getNormalMapInput("steel", "steel-nm")),
    ])

    let nmText = nmBlock.add([
        k.pos(0,-64),
        k.anchor("center"),
        k.text("Test Normal Maps", {
            align: "center",
        })
    ])

    // test alpha 16
    let speed = 16;
    k.onKeyDown("w", () => {
        k.setCamPos(k.getCamPos().add(0,-speed));
    })

    k.onKeyDown("s", () => {
        k.setCamPos(k.getCamPos().add(0,speed));
    })

    k.onKeyDown("a", () => {
        k.setCamPos(k.getCamPos().add(-speed,0));
    })

    k.onKeyDown("d", () => {
        k.setCamPos(k.getCamPos().add(speed, 0));
    })

    let max = 30;
    let min = 3;
    k.onScroll((d) => {
        k.setCamScale(k.clamp(k.getCamScale().y - d.y / 1000, 1 / max, min), k.clamp(k.getCamScale().y - d.y / 1000, 1 / max, min));
    })

    /*
    *  LIGHTING
    */
    let light = new k.Light(2.0, k.width()/2, k.center().scale(100));

    k.setGlobalLight({
        intensity: 0.4,
    })

    k.onUpdate(() => {
        light.pos = k.mousePos();

        //k.usePostEffect("test16");
    })
})