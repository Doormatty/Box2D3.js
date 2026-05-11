box2d-v3-wasm
==============

Box2D v3 compiled to WebAssembly with a small JavaScript wrapper for browser and Node.js projects.

The wrapper exposes practical Box2D v3 functionality through JavaScript definition objects and stable handle objects. It is not a compatibility layer for the older Box2D v2 `box2d.js` WebIDL API.

Documentation
-------------

- [API reference](docs/API_REFERENCE.md)
- [Wireframe helper](docs/WIREFRAME.md)
- [Tutorial 1: Falling box](tutorials/01-falling-box.md)
- [Tutorial 2: Shapes, queries, and events](tutorials/02-shapes-queries-events.md)
- [Tutorial 3: Canvas wireframe car](tutorials/03-wireframe-car.md)
- [Migration notes](MIGRATION_V3.md)

Install
-------

```sh
npm install box2d-v3-wasm
```

Node.js quick start
-------------------

```javascript
const Box2D = require("box2d-v3-wasm");

async function main() {
  const b2 = await Box2D();

  const world = b2.createWorld({ gravity: { x: 0, y: -10 } });
  const ground = b2.createBody(world, {
    type: b2.staticBody,
    position: { x: 0, y: 0 },
  });

  b2.createBoxShape(ground, { hx: 20, hy: 0.5, density: 0 });

  const box = b2.createBody(world, {
    type: b2.dynamicBody,
    position: { x: 0, y: 4 },
  });

  b2.createBoxShape(box, { hx: 0.5, hy: 0.5, density: 1 });

  for (let i = 0; i < 120; ++i) {
    b2.step(world, 1 / 60, 4);
  }

  console.log(b2.getBodyPosition(box));
  b2.destroyWorld(world);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
```

Browser quick start
-------------------

Serve the package files over HTTP so the browser can fetch the `.wasm` file with the correct MIME type. Opening the HTML file directly from disk is not reliable because Emscripten needs to load the wasm artifact.

```html
<canvas id="view" width="640" height="360"></canvas>
<script src="./node_modules/box2d-v3-wasm/build/Box2D_v3.1.1.js"></script>
<script src="./node_modules/box2d-v3-wasm/box2d.v3.js"></script>
<script>
  (async function () {
    const b2 = await Box2D();
    const world = b2.createWorld({ gravity: { x: 0, y: -10 } });
    const body = b2.createBody(world, {
      type: b2.dynamicBody,
      position: { x: 0, y: 4 },
    });

    b2.createCircleShape(body, { radius: 0.5, density: 1 });
    b2.step(world, 1 / 60, 4);

    console.log(b2.getBodyTransform(body));
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

Core concepts
-------------

### Async initialization

`Box2D()` returns a promise. The promise resolves after the Emscripten module and wasm binary are ready. Create worlds, bodies, shapes, and joints only after awaiting the wrapper.

### Handles

The wrapper returns frozen handle objects:

```javascript
{ kind: "world", handle: 1 }
{ kind: "body", handle: 12 }
{ kind: "shape", handle: 37 }
{ kind: "joint", handle: 9 }
```

Pass these handles back to wrapper calls. Most APIs also accept the raw numeric `handle` for lower-level integration, but handle objects are clearer and catch kind mismatches earlier.

Destroying a world invalidates the bodies, shapes, chains, and joints that belong to it. Destroying a body invalidates its attached shapes and joints. Keep app-level references in sync with those lifecycle operations.

### Units and coordinates

Use meters, radians, kilograms, and seconds. Canvas or DOM pixel conversion belongs in your renderer, not the physics wrapper. A common browser convention is `20` to `50` pixels per meter.

### Definition objects

The wrapper uses plain objects instead of raw C structs:

```javascript
const body = b2.createBody(world, {
  type: b2.dynamicBody,
  position: { x: 2, y: 6 },
  angle: Math.PI / 8,
});

const shape = b2.createBoxShape(body, {
  hx: 0.5,
  hy: 0.25,
  density: 1,
  friction: 0.7,
  restitution: 0.1,
  filter: {
    categoryBits: 0x0002,
    maskBits: 0x0004,
    groupIndex: 0,
  },
});
```

Shape options accept material fields directly or through `surfaceMaterial` / `material`. Filter fields can be provided directly or through `filter`.

Worlds
------

Create one or more worlds with `createWorld`. Step each world with a time step and sub-step count:

```javascript
const world = b2.createWorld({ gravity: { x: 0, y: -10 } });

function tick() {
  b2.step(world, 1 / 60, 4);
}
```

World-level APIs include:

- gravity get/set
- sleeping, continuous collision, and warm starting toggles
- restitution threshold, hit event threshold, contact recycle distance, maximum linear speed, and contact tuning
- awake body count
- optional friction and restitution material mix callbacks
- post-step body, contact, sensor, and joint events
- closest ray casts and AABB overlap queries

Bodies
------

Bodies are created in a world and then receive shapes:

```javascript
const body = b2.createBody(world, {
  type: b2.dynamicBody,
  position: { x: 0, y: 3 },
});

b2.createCircleShape(body, { radius: 0.35, density: 1 });
```

Body types are available as constants:

- `b2.staticBody`
- `b2.kinematicBody`
- `b2.dynamicBody`

Body APIs cover transforms, linear and angular velocity, mass reads, awake/enabled/bullet flags, gravity scale, damping, forces, torques, linear impulses, and angular impulses.

Shapes
------

Supported shape creation helpers:

- `createBoxShape(body, { hx, hy, ...options })`
- `createCircleShape(body, { center, radius, ...options })`
- `createCapsuleShape(body, { center1, center2, radius, ...options })`
- `createSegmentShape(body, { p1, p2, ...options })`
- `createPolygonShape(body, { vertices, ...options })`
- `createChain(body, { vertices, isLoop, ...options })`

Polygon vertices may be an array of `{ x, y }`, an array of `[x, y]`, or a flat numeric array. The current wrapper supports up to 8 polygon vertices, matching the Box2D v3 polygon limit.

Shape APIs cover density, friction, restitution, surface material fields, user material id, category/mask/group filters, sensor/contact/hit event toggles, point tests, shape ray casts, and AABB reads.

Joints
------

Supported joint creation helpers:

- `createDistanceJoint`
- `createRevoluteJoint`
- `createPrismaticJoint`
- `createWheelJoint`
- `createMotorJoint`
- `createFilterJoint`

Joint definitions accept world anchors via `anchor`, `anchorA`, and `anchorB`, or local anchors via `localAnchorA` and `localAnchorB`. Prismatic and wheel joints accept `axis` or `localAxis`.

```javascript
const joint = b2.createRevoluteJoint(world, chassis, wheel, {
  anchor: { x: -0.8, y: 1.2 },
  enableMotor: true,
  motorSpeed: -8,
  maxMotorTorque: 25,
  collideConnected: false,
});

b2.setRevoluteJointMotorSpeed(joint, -10);
```

Shared joint APIs cover type reads, destruction, collide-connected, local frames, constraint tuning, force and torque thresholds, constraint force and torque reads, and linear/angular separation reads.

Queries and events
------------------

Use ray casts and AABB overlaps to inspect the world:

```javascript
const hit = b2.castRayClosest(world, {
  origin: { x: -5, y: 2 },
  translation: { x: 10, y: 0 },
  maskBits: 0xffffffff,
});

const shapes = b2.overlapAABB(world, {
  lowerBound: { x: -1, y: -1 },
  upperBound: { x: 1, y: 1 },
  capacity: 32,
});
```

Read events after stepping the world:

```javascript
b2.step(world, 1 / 60, 4);

const bodyEvents = b2.getBodyEvents(world);
const contactEvents = b2.getContactEvents(world);
const sensorEvents = b2.getSensorEvents(world);
const jointEvents = b2.getJointEvents(world);
```

Enable the relevant event flags on shapes before expecting contact, hit, or sensor events.

Batched transforms
------------------

For render loops and simulation scoring, prefer `readBodyTransforms` over repeated `getBodyTransform` calls:

```javascript
const bodies = [chassis, wheelA, wheelB];
const transforms = new Float32Array(bodies.length * 3);

function frame() {
  b2.step(world, 1 / 60, 4);
  b2.readBodyTransforms(bodies, transforms);

  // Layout is x, y, angle for each body.
  const chassisX = transforms[0];
  const chassisY = transforms[1];
  const chassisAngle = transforms[2];
}
```

Reusing the output array avoids per-frame allocations.

Wireframe helper
----------------

The optional wireframe helper keeps app-owned render geometry beside the Box2D handles that were created from that geometry:

```javascript
const Box2D = require("box2d-v3-wasm");
const Wireframe = require("box2d-v3-wasm/wireframe");

const b2 = await Box2D();
const wire = Wireframe.createWireframe(b2);
const world = b2.createWorld({ gravity: { x: 0, y: -10 } });

wire.createWireBox(world, {
  id: "box",
  type: b2.dynamicBody,
  position: { x: 0, y: 4 },
  hx: 0.5,
  hy: 0.5,
  density: 1,
});

b2.step(world, 1 / 60, 4);
wire.syncTransforms();
```

See [docs/WIREFRAME.md](docs/WIREFRAME.md) and [tutorials/03-wireframe-car.md](tutorials/03-wireframe-car.md) for browser canvas usage.

TypeScript
----------

The package includes declarations for the main wrapper and the wireframe helper:

```typescript
import Box2D = require("box2d-v3-wasm");
import Wireframe = require("box2d-v3-wasm/wireframe");
```

Build and test
--------------

```powershell
npm run build
npm test
npm run test:types
npm run pack:check
```

`npm test` runs the Node wrapper tests, browser smoke tests, and wireframe tests.

Published files
---------------

The npm package runtime surface is intentionally small:

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
