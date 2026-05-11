# Tutorial 1: Falling Box

This tutorial creates a world, adds a static floor and a dynamic box, steps the simulation, and reads the box position.

## What You Will Use

- `Box2D()` async initialization
- `createWorld`
- `createBody`
- `createBoxShape`
- `step`
- `getBodyPosition`
- `readBodyTransforms`
- `destroyWorld`

## Complete Script

Save this as `falling-box.js` in a project that has `box2d-v3-wasm` installed.

```javascript
const Box2D = require("box2d-v3-wasm");

async function main() {
  const b2 = await Box2D();

  const world = b2.createWorld({
    gravity: { x: 0, y: -10 },
  });

  const ground = b2.createBody(world, {
    type: b2.staticBody,
    position: { x: 0, y: 0 },
  });

  b2.createBoxShape(ground, {
    hx: 8,
    hy: 0.25,
    density: 0,
    friction: 0.8,
  });

  const box = b2.createBody(world, {
    type: b2.dynamicBody,
    position: { x: 0, y: 5 },
  });

  b2.createBoxShape(box, {
    hx: 0.5,
    hy: 0.5,
    density: 1,
    friction: 0.6,
  });

  for (let i = 0; i < 120; ++i) {
    b2.step(world, 1 / 60, 4);
  }

  const position = b2.getBodyPosition(box);
  const transforms = b2.readBodyTransforms([box]);

  console.log("box position:", position);
  console.log("box transform:", {
    x: transforms[0],
    y: transforms[1],
    angle: transforms[2],
  });

  b2.destroyWorld(world);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
```

Run it:

```sh
node falling-box.js
```

The final `y` position should be near the floor after the box settles.

## Step by Step

### 1. Initialize Box2D

```javascript
const b2 = await Box2D();
```

The wrapper loads the generated Emscripten module and wasm file asynchronously. Create physics objects only after the promise resolves.

### 2. Create a World

```javascript
const world = b2.createWorld({
  gravity: { x: 0, y: -10 },
});
```

Box2D uses meters and seconds. A gravity of `-10` meters per second squared is a practical default for examples.

### 3. Create the Floor

```javascript
const ground = b2.createBody(world, {
  type: b2.staticBody,
  position: { x: 0, y: 0 },
});

b2.createBoxShape(ground, {
  hx: 8,
  hy: 0.25,
  density: 0,
  friction: 0.8,
});
```

`hx` and `hy` are half extents, so this floor is 16 meters wide and 0.5 meters tall.

### 4. Create the Dynamic Box

```javascript
const box = b2.createBody(world, {
  type: b2.dynamicBody,
  position: { x: 0, y: 5 },
});

b2.createBoxShape(box, {
  hx: 0.5,
  hy: 0.5,
  density: 1,
});
```

Dynamic bodies respond to gravity, contacts, forces, and impulses. A shape with positive density gives the body mass.

### 5. Step the Simulation

```javascript
for (let i = 0; i < 120; ++i) {
  b2.step(world, 1 / 60, 4);
}
```

The second argument is the time step in seconds. The third argument is the Box2D v3 sub-step count.

### 6. Read State

```javascript
const position = b2.getBodyPosition(box);
const transform = b2.getBodyTransform(box);
```

Use `getBodyPosition` or `getBodyTransform` for one-off reads. For render loops, batch several body reads:

```javascript
const bodies = [box];
const transforms = new Float32Array(bodies.length * 3);

b2.readBodyTransforms(bodies, transforms);
```

The output layout is `x`, `y`, `angle` for each body.

### 7. Clean Up

```javascript
b2.destroyWorld(world);
```

Destroying the world releases the Box2D objects created in that world and invalidates their handles.

## Common Changes

Try these adjustments:

- Increase gravity to `{ x: 0, y: -20 }`.
- Change the box to a circle with `createCircleShape(box, { radius: 0.5, density: 1 })`.
- Set the box's initial angle with `angle: Math.PI / 6`.
- Apply an impulse before stepping:

```javascript
b2.applyLinearImpulseToCenter(box, { x: 2, y: 0 }, true);
```
