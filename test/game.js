import kaplay from "kaplay";
import myPlugin from "../src/plugin";

const k = kaplay({
    plugins: [myPlugin]
});

// load sprites
k.loadSprite("steel", "test/steel.png");
k.loadSprite("steel-nm", "test/steel-nm.png");

// load shader
k.loadLitShader("test", null, `
    vec4 lit_frag(vec2 pos, vec2 uv, vec4 color, sampler2D tex) {
        vec4 d = def_frag();
        return vec4(d.x + pos.x, d.y + pos.y, d.z, d.a);
    }
`);

k.onLoad(() => {
    k.go("main");
})

k.scene("main", () => {
    let bg = k.add([
        k.pos(),
        k.rect(k.width(), k.height()),
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
            align: center
        })
    ])
    
    // test custom shader
    let csBlock = k.add([
        k.pos(3*k.width()/4, k.height()/2),
        k.sprite("steel"),
        k.anchor("center"),
        k.litShader("test"),
    ])

    let csText = csBlock.add([
        k.pos(0,-64),
        k.anchor("center"),
        k.text("Test Custom Shader", {
            align: "center",
        })
    ])

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

    /*
    *  LIGHTING
    */
    let light = new k.Light(2.0, 0.5, center());

    k.setGlobalLight({
        intensity: 0.4,
    })

    k.onUpdate(() => {
        light.pos = k.mousePos();
    })
})