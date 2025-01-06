# KAPLAY Plugin Template

A minimal [**KAPLAY**](https://kaplayjs.com) plugin template for creating and
publishing plugins.

> If you're seeing the kaplay-hi-plugin on NPM, this is only a demo, this plugin
> will add a `hi()` function for log hi.

## Download template

You can download template using **"Donwload ZIP"** option in **GitHub**, 
you can also use GitHub:

```sh
git clone https://github.com/kaplayjs/kaplay-plugin-template
```

Enter to folder and install dependencies:

```sh
cd kaplay-plugin-template
npm install
```

## Creating your plugin

The plugin code is on `src/plugin.js`. For understand more about KAPLAY plugins 
[read this guide](https://kaplayjs.com/guides/plugins/).

## Testing and building

`test/game.js` file has a KAPLAY game with your plugin imported, you can test 
here how your plugin is working.

When you think you have finished your masterpiece, you can build it with:

```sh
npm run build
```

Then, after selecting a name (we recommend `kaplay-{pluginName}` form), you can
publish it using:

```sh
npm publish
```