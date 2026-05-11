# Tutorial 2: Shapes, Queries, and Events

This tutorial creates several shapes, runs ray and AABB queries, and reads contact plus sensor events after stepping the world.

## What You Will Use

- shape filters and material options
- `castRayClosest`
- `overlapAABB`
- `testShapePoint`
- `getContactEvents`
- `getSensorEvents`
- `getBodyEvents`

## Complete Script

Save this as `queries-and-events.js`.

```javascript
const Box2D = require("box2d-v3-wasm");

function sameHandle(a, b) {
  return a && b && a.kind === b.kind && a.handle === b.handle;
}

async function main() {
  const b2 = await Box2D();
  const world = b2.createWorld({ gravity: { x: 0, y: -10 } });

  const ground = b2.createBody(world, {
    type: b2.staticBody,
    position: { x: 0, y: 0 },
  });

  const groundShape = b2.createBoxShape(ground, {
    hx: 8,
    hy: 0.25,
    density: 0,
    friction: 0.9,
    userMaterialId: 10,
    enableContactEvents: true,
    enableHitEvents: true,
    filter: {
      categoryBits: 0x0001,
      maskBits: 0xffffffff,
    },
  });

  const falling = b2.createBody(world, {
    type: b2.dynamicBody,
    position: { x: 2, y: 5 },
  });

  const fallingShape = b2.createCircleShape(falling, {
    radius: 0.35,
    density: 1,
    restitution: 0.2,
    enableSensorEvents: true,
    enableContactEvents: true,
    enableHitEvents: true,
    filter: {
      categoryBits: 0x0002,
      maskBits: 0xffffffff,
    },
  });

  const sensorBody = b2.createBody(world, {
    type: b2.staticBody,
    position: { x: 2, y: 1.2 },
  });

  const sensorShape = b2.createCircleShape(sensorBody, {
    radius: 1,
    density: 0,
    isSensor: true,
    enableSensorEvents: true,
  });

  const rayHit = b2.castRayClosest(world, {
    origin: { x: -6, y: 0.5 },
    translation: { x: 12, y: 0 },
  });

  console.log("ray hit shape:", rayHit && rayHit.shape);

  const overlapping = b2.overlapAABB(world, {
    lowerBound: { x: -2, y: -1 },
    upperBound: { x: 2, y: 1 },
    capacity: 16,
  });

  console.log("initial overlap count:", overlapping.length);
  console.log("ground contains origin:", b2.testShapePoint(groundShape, { x: 0, y: 0 }));

  let sawContact = false;
  let sawHit = false;
  let sawSensor = false;

  for (let i = 0; i < 240; ++i) {
    b2.step(world, 1 / 60, 4);

    const bodyEvents = b2.getBodyEvents(world);
    const contactEvents = b2.getContactEvents(world);
    const sensorEvents = b2.getSensorEvents(world);

    if (bodyEvents.some((event) => sameHandle(event.body, falling))) {
      const position = b2.getBodyPosition(falling);
      if (i % 30 === 0) {
        console.log(`step ${i}: falling body y=${position.y.toFixed(2)}`);
      }
    }

    sawContact =
      sawContact ||
      contactEvents.begin.some(
        (event) =>
          (sameHandle(event.shapeA, groundShape) && sameHandle(event.shapeB, fallingShape)) ||
          (sameHandle(event.shapeA, fallingShape) && sameHandle(event.shapeB, groundShape))
      );

    sawHit = sawHit || contactEvents.hit.some((event) => event.approachSpeed > 0);

    sawSensor =
      sawSensor ||
      sensorEvents.begin.some(
        (event) =>
          (sameHandle(event.sensor, sensorShape) && sameHandle(event.visitor, fallingShape)) ||
          (sameHandle(event.sensor, fallingShape) && sameHandle(event.visitor, sensorShape))
      );

    if (sawContact && sawHit && sawSensor) {
      break;
    }
  }

  console.log({ sawContact, sawHit, sawSensor });

  b2.destroyWorld(world);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
```

Run it:

```sh
node queries-and-events.js
```

## Shape Options

Most shape helpers accept the same options:

```javascript
{
  density: 1,
  friction: 0.6,
  restitution: 0,
  userMaterialId: 10,
  isSensor: false,
  enableSensorEvents: false,
  enableContactEvents: false,
  enableHitEvents: false,
  filter: {
    categoryBits: 0x0001,
    maskBits: 0xffffffff,
    groupIndex: 0,
  },
}
```

Use `categoryBits` and `maskBits` for broad collision groups. Use `groupIndex` when a set of shapes should always collide or never collide with each other according to Box2D group rules.

## Ray Casts

`castRayClosest` returns the nearest hit in the world:

```javascript
const hit = b2.castRayClosest(world, {
  origin: { x: -6, y: 0.5 },
  translation: { x: 12, y: 0 },
  maxFraction: 1,
});
```

The result includes:

- `shape`
- `point`
- `normal`
- `fraction`
- `nodeVisits`
- `leafVisits`

For one shape, use `rayCastShape(shape, def)`.

## AABB Overlaps

Use `overlapAABB` when you need every shape inside a box:

```javascript
const shapes = b2.overlapAABB(world, {
  lowerBound: { x: -2, y: -1 },
  upperBound: { x: 2, y: 1 },
  capacity: 16,
});
```

You can pass filter fields on the query:

```javascript
const dynamicLayerShapes = b2.overlapAABB(world, {
  lowerBound: { x: -5, y: -5 },
  upperBound: { x: 5, y: 5 },
  maskBits: 0x0002,
});
```

## Contact and Hit Events

Contact events are post-step data:

```javascript
b2.step(world, 1 / 60, 4);
const events = b2.getContactEvents(world);
```

Enable contact events and hit events on the shapes:

```javascript
b2.createCircleShape(body, {
  radius: 0.5,
  density: 1,
  enableContactEvents: true,
  enableHitEvents: true,
});
```

`events.begin` and `events.end` contain shape pairs. `events.hit` contains shape pairs plus `point`, `normal`, and `approachSpeed`.

## Sensor Events

Sensors detect overlap without physical collision response:

```javascript
const sensorShape = b2.createCircleShape(sensorBody, {
  radius: 1,
  density: 0,
  isSensor: true,
  enableSensorEvents: true,
});
```

Read them after stepping:

```javascript
const sensorEvents = b2.getSensorEvents(world);
```

Each sensor event has:

- `sensor`
- `visitor`

## Material Mix Rules

For custom material behavior, assign `userMaterialId` to shapes and enable rule-based mix callbacks:

```javascript
b2.clearRestitutionMixRules();
b2.addRestitutionMixRule(10, 20, 0.8);
b2.enableWorldRestitutionCallback(world, true);
```

Do the same for friction:

```javascript
b2.clearFrictionMixRules();
b2.addFrictionMixRule(10, 20, 0.4);
b2.enableWorldFrictionCallback(world, true);
```

Clear rules when you no longer need them, especially in tests or apps that create multiple worlds.
