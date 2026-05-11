box2d-v3-wasm
==============

Box2D v3 compiled to WebAssembly with a small JavaScript wrapper for browser and Node.js projects.

Install
-------

```sh
npm install box2d-v3-wasm
```

Basic usage
-----------

```javascript
const Box2D = require("box2d-v3-wasm");

const b2 = await Box2D();
const world = b2.createWorld({ gravity: { x: 0, y: -10 } });
const body = b2.createBody(world, {
  type: b2.dynamicBody,
  position: { x: 0, y: 4 },
});

b2.createBoxShape(body, { hx: 0.5, hy: 0.5, density: 1 });
b2.step(world, 1 / 60, 4);

console.log(b2.getBodyPosition(body));
b2.destroyWorld(world);
```

The package includes TypeScript declarations for the main wrapper and the optional wireframe helper:

```javascript
const Wireframe = require("box2d-v3-wasm/wireframe");
```

Browser usage
-------------

Serve the package files over HTTP so the browser can fetch the `.wasm` file with the correct MIME type.

```html
<script src="./node_modules/box2d-v3-wasm/build/Box2D_v3.1.1.js"></script>
<script src="./node_modules/box2d-v3-wasm/box2d.v3.js"></script>
<script>
  (async function () {
    const b2 = await Box2D();
    const world = b2.createWorld({ gravity: { x: 0, y: -10 } });
    console.log(b2.getWorldGravity(world));
    b2.destroyWorld(world);
  })();
</script>
```

If your app serves the `.wasm` file from a different directory, pass Emscripten's `locateFile` option through the wrapper:

```javascript
const b2 = await Box2D({
  module: {
    locateFile(path) {
      return `/assets/box2d/${path}`;
    },
  },
});
```

Published files
---------------

The npm package intentionally contains only the runtime artifacts:

```text
box2d.v3.js
box2d.v3.d.ts
box2d.v3.wireframe.js
box2d.v3.wireframe.d.ts
build/Box2D_v3.1.1.js
build/Box2D_v3.1.1.wasm
```

License
-------

This package includes zlib-licensed wrapper code and MIT-licensed Box2D code.
