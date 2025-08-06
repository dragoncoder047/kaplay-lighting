import kaplay from "kaplay";
import LightingPlugin from "../src/plugin"

const k = kaplay({
    plugins: [LightingPlugin]
});

// load sprites
k.loadSprite("steel", "test/steel.png");
k.loadSprite("steel-nm", "test/steel-nm.png");
k.loadSprite("sb", "test/stone-brick-top.png");
k.loadSprite("sb-nm", "test/stone-brick-top-nm.png");

k.loadSpriteAtlas("test/tilemap.png", {
    "sb-tl": {
        x: 0,
        y: 0,
        width: 16,
        height: 16,
    },
    "sb-tp": {
        x: 16,
        y: 0,
        width: 16,
        height: 16,
    },
    "sb-tr": {
        x: 32,
        y: 0,
        width: 16,
        height: 16,
    },
});

k.loadSpriteAtlas("test/tilemap-nm.png", {
    "sb-tl-nm": {
        x: 0,
        y: 0,
        width: 16,
        height: 16,
    },
    "sb-tp-nm": {
        x: 16,
        y: 0,
        width: 16,
        height: 16,
    },
    "sb-tr-nm": {
        x: 32,
        y: 0,
        width: 16,
        height: 16,
    },
});

k.loadSpriteAtlas("test/torch.png", {
    "torch": {
        x: 0,
        y: 0,
        width: 16,
        height: 32,
    }
})

k.loadSpriteAtlas("test/torch.png", {
    "torch-nm": {
        x: 0,
        y: 0,
        width: 16,
        height: 32,
    }
})

// load shader
k.loadLitShader("test", null, `
    vec4 lit_frag(vec2 pos, vec2 uv, vec4 color, sampler2D tex) {
        vec4 d = def_frag();
        pos /= vec2(1920., 1080.);
        return vec4(d.x + pos.x, d.y + pos.y, d.z, d.a);
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
        k.color(20, 20, 20),
        k.litShader("litSprite"),
    ])

    for (let i = 0; i < k.width() / 32; i++) {
        k.add([
            k.pos(i * 32, k.height()),
            k.sprite("sb"),
            k.scale(2),
            k.anchor("botleft"),
            k.litShader("litSprite", k.getNormalMapInput("sb", "sb-nm")),
        ])
    }

    let level = k.addLevel([
        "[---]",
    ], {
        tileHeight: 32,
        tileWidth: 32,
        tiles: {
            "[": () => [
                k.pos(),
                k.sprite("sb-tl"),
                k.area(),
                k.body({ isStatic: true }),
                k.scale(2),
                k.litShader("litSprite", k.getNormalMapInput("sb-tl", "sb-tl-nm")),
            ],
            "-": () => [
                k.pos(),
                k.sprite("sb-tp"),
                k.area(),
                k.body({ isStatic: true }),
                k.scale(2),
                k.litShader("litSprite", k.getNormalMapInput("sb-tp", "sb-tp-nm")),
            ],
            "]": () => [
                k.pos(),
                k.sprite("sb-tr"),
                k.area(),
                k.body({ isStatic: true }),
                k.scale(2),
                k.litShader("litSprite", k.getNormalMapInput("sb-tr", "sb-tr-nm")),
            ]
        }
    })

    level.pos = k.vec2(k.width() / 2 - 80, k.height() - 64);

    let torch = k.add([
        k.pos(k.width() / 2, k.height() - 56),
        k.sprite("torch"),
        k.anchor("bot"),
        k.litShader("litSprite", k.getNormalMapInput("torch", "torch-nm")),
    ])

    let torchlight = torch.add([
        k.pos(0, -32),
        k.light({ radius: 0.2, color: new k.Color(255, 140, 0) }),
        {
            update() {
                this.light.strength = k.wave(0.5, 2, k.time() * 2 + k.wave(-2, 2, k.time() * 7));
                this.light.radius = k.wave(0.1, 0.2, k.time() * 3 + k.wave(-.2, .2, k.time() * 8));
            }
        },
    ])

    console.log(torchlight)

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
        k.pos(k.width() / 2, 64),
        k.anchor("center"),
        k.text("Press 'T' to toggle background being lit.", {
            align: "center",
        })
    ])

    // test custom shader
    let csBlock = k.add([
        k.pos(3 * k.width() / 4, k.height() / 2),
        k.sprite("steel"),
        k.anchor("center"),
        k.litShader("test"),
    ])

    let csText = csBlock.add([
        k.pos(0, -64),
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
        k.pos(k.width() / 4, k.height() / 2),
        k.sprite("steel"),
        k.anchor("center"),
        k.litShader("litSprite", k.getNormalMapInput("steel", "steel-nm")),
    ])

    let nmText = nmBlock.add([
        k.pos(0, -64),
        k.anchor("center"),
        k.text("Test Normal Maps", {
            align: "center",
        })
    ])

    // test both
    let bothBlock = k.add([
        k.pos(k.width() / 2, k.height() / 2),
        k.sprite("steel"),
        k.anchor("center"),
        k.litShader("test", k.getNormalMapInput("steel", "steel-nm")),
    ])

    let bothText = bothBlock.add([
        k.pos(0, -64),
        k.anchor("center"),
        k.text("Testing Both", {
            align: "center",
        })
    ])

    // test alpha 16
    let speed = 16;
    k.onKeyDown("w", () => {
        k.setCamPos(k.getCamPos().add(0, -speed));
    })

    k.onKeyDown("s", () => {
        k.setCamPos(k.getCamPos().add(0, speed));
    })

    k.onKeyDown("a", () => {
        k.setCamPos(k.getCamPos().add(-speed, 0));
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
    let mouseLight = new k.Light(1.0, 0.25, k.center());

    k.setGlobalLight({
        intensity: 0.5,
    })

    k.onUpdate(() => {
        mouseLight.pos = k.toWorld(k.mousePos());
    })
})