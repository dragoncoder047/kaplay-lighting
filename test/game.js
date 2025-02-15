import kaplay from "kaplay";
import myPlugin from "../src/plugin";

const k = kaplay({
    plugins: [myPlugin]
});

// load sprites
k.loadSprite("steel", "test/steel.png");
k.loadSprite("steel-nm", "test/steel-nm.png");

k.onLoad(() => {
    k.go("main");
})

k.scene("main", () => {
    // unlit background (shouldn't be affected by lighting)
    let bg = add([
        pos(),
        rect(width(), height()),
        color(20,20,20),
        //k.litShader("litSprite"),
    ])

    let ground = add([
        pos(0,height()),
        anchor("botleft"),
        rect(width(), 32),
        color(35, 35, 35),
        k.litShader("litSprite")
    ])

    // test normal maps
    let block = add([
        pos(center()),
        sprite("steel"),
        k.litShader("litSprite", k.getNormalMapInput("steel", "steel-nm")),
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