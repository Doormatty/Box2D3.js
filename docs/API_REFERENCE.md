# Box2D v3 Wrapper API Reference

This document describes the JavaScript wrapper exported by `box2d-v3-wasm`. The TypeScript declarations in `box2d.v3.d.ts` are the final source of truth for signatures.

## Loading

```javascript
const Box2D = require("box2d-v3-wasm");

const b2 = await Box2D();
```

`Box2D(options)` returns a promise that resolves to a wrapper instance.

### Options

| Option | Purpose |
| --- | --- |
| `module` | Options passed to the Emscripten module factory. Use this for `locateFile`, `print`, `printErr`, and similar Emscripten options. |
| `moduleFactory` | Overrides the default generated Emscripten module factory. This is mainly useful for tests or custom bundling. |

Browser loading with a custom wasm URL:

```javascript
const b2 = await Box2D({
  module: {
    locateFile(path) {
      return `/vendor/box2d/${path}`;
    },
  },
});
```

## Handles

The wrapper hides Box2D v3 ID structs behind stable JavaScript handle objects.

| Handle | Example |
| --- | --- |
| `WorldHandle` | `{ kind: "world", handle: 1 }` |
| `BodyHandle` | `{ kind: "body", handle: 12 }` |
| `ShapeHandle` | `{ kind: "shape", handle: 27 }` |
| `ChainHandle` | `{ kind: "chain", handle: 4 }` |
| `JointHandle` | `{ kind: "joint", handle: 9 }` |

Pass handle objects back to wrapper functions:

```javascript
const world = b2.createWorld();
const body = b2.createBody(world);
b2.destroyBody(body);
```

Most APIs also accept the numeric `handle` value, but handle objects are preferred because the wrapper validates their `kind`.

## Constants

### Body Types

| Constant | Value |
| --- | --- |
| `b2.staticBody` | `0` |
| `b2.kinematicBody` | `1` |
| `b2.dynamicBody` | `2` |

### Shape Types

| Constant | Value |
| --- | --- |
| `b2.circleShape` | `0` |
| `b2.capsuleShape` | `1` |
| `b2.segmentShape` | `2` |
| `b2.polygonShape` | `3` |
| `b2.chainSegmentShape` | `4` |

### Joint Types

| Constant | Value |
| --- | --- |
| `b2.distanceJoint` | `0` |
| `b2.filterJoint` | `1` |
| `b2.motorJoint` | `2` |
| `b2.prismaticJoint` | `3` |
| `b2.revoluteJoint` | `4` |
| `b2.weldJoint` | `5` |
| `b2.wheelJoint` | `6` |

`weldJoint` is present as a Box2D type constant, but the current wrapper does not expose `createWeldJoint`.

## Common Types

### `Vec2`

```typescript
{ x: number; y: number }
```

Many vertex APIs also accept `[x, y]` pairs or flat arrays:

```javascript
[
  { x: -1, y: 0 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
]

[
  [-1, 0],
  [1, 0],
  [0, 1],
]

[-1, 0, 1, 0, 0, 1]
```

### `Filter`

```typescript
{
  categoryBits?: number;
  maskBits?: number;
  groupIndex?: number;
}
```

Filters can be nested under `filter` or supplied directly on shape, chain, ray, and AABB definitions.

### `SurfaceMaterial`

```typescript
{
  friction?: number;
  restitution?: number;
  rollingResistance?: number;
  tangentSpeed?: number;
  userMaterialId?: number;
  customColor?: number;
}
```

Material fields can be nested under `surfaceMaterial` / `material` or supplied directly on shape and chain definitions.

## Worlds

### Create and destroy

```javascript
const world = b2.createWorld({
  gravity: { x: 0, y: -10 },
});

b2.destroyWorld(world);
```

`createWorld` defaults to gravity `{ x: 0, y: -10 }`.

Destroying a world invalidates all bodies, shapes, chains, and joints created in it.

### Stepping

```javascript
b2.step(world, 1 / 60, 4);
```

The third argument is Box2D v3's sub-step count. `4` is a practical default for many games and demos.

### Gravity and simulation settings

| Method | Purpose |
| --- | --- |
| `setWorldGravity(world, gravity)` | Set gravity. |
| `getWorldGravity(world)` | Read gravity. |
| `enableWorldSleeping(world, enabled)` | Toggle sleeping. |
| `isWorldSleepingEnabled(world)` | Read sleeping flag. |
| `enableWorldContinuous(world, enabled)` | Toggle continuous collision. |
| `isWorldContinuousEnabled(world)` | Read continuous collision flag. |
| `enableWorldWarmStarting(world, enabled)` | Toggle warm starting. |
| `isWorldWarmStartingEnabled(world)` | Read warm starting flag. |
| `getWorldAwakeBodyCount(world)` | Read the current awake body count. |

### Contact tuning

| Method | Purpose |
| --- | --- |
| `setWorldRestitutionThreshold(world, value)` | Set the velocity threshold for restitution. |
| `getWorldRestitutionThreshold(world)` | Read restitution threshold. |
| `setWorldHitEventThreshold(world, value)` | Set the impact speed threshold for hit events. |
| `getWorldHitEventThreshold(world)` | Read hit event threshold. |
| `setWorldContactRecycleDistance(world, value)` | Set contact recycle distance. |
| `getWorldContactRecycleDistance(world)` | Read contact recycle distance. |
| `setWorldMaximumLinearSpeed(world, value)` | Set maximum linear speed. |
| `getWorldMaximumLinearSpeed(world)` | Read maximum linear speed. |
| `setWorldContactTuning(world, { hertz, dampingRatio, pushSpeed })` | Tune contact response. |

### Material mix callbacks

The wrapper includes rule-based friction and restitution mixing helpers.

```javascript
b2.clearFrictionMixRules();
b2.addFrictionMixRule(101, 202, 0.9);
b2.enableWorldFrictionCallback(world, true);

b2.clearRestitutionMixRules();
b2.addRestitutionMixRule(101, 202, 0.75);
b2.enableWorldRestitutionCallback(world, true);
```

Rules are keyed by `userMaterialId`. Clear rules and disable the callbacks when a world no longer needs custom mixing.

### World queries

#### Closest ray cast

```javascript
const hit = b2.castRayClosest(world, {
  origin: { x: -5, y: 2 },
  translation: { x: 10, y: 0 },
  maxFraction: 1,
  filter: {
    categoryBits: 0xffffffff,
    maskBits: 0xffffffff,
    groupIndex: 0,
  },
});

if (hit) {
  console.log(hit.shape, hit.point, hit.normal, hit.fraction);
}
```

`castRayClosest` returns `null` when nothing is hit.

#### AABB overlap

```javascript
const shapes = b2.overlapAABB(world, {
  lowerBound: { x: -2, y: -1 },
  upperBound: { x: 2, y: 1 },
  capacity: 32,
  maskBits: 0xffffffff,
});
```

`capacity` defaults to the wrapper's internal value. Set it when you know how many results you want to retain.

### Events

Read events after `step`.

```javascript
b2.step(world, 1 / 60, 4);

const bodyEvents = b2.getBodyEvents(world);
const contactEvents = b2.getContactEvents(world);
const sensorEvents = b2.getSensorEvents(world);
const jointEvents = b2.getJointEvents(world);
```

Event types:

| API | Result |
| --- | --- |
| `getBodyEvents(world)` | Array of `{ body, position, angle, fellAsleep }`. |
| `getContactEvents(world)` | `{ begin, end, hit }`. Begin/end events include `{ shapeA, shapeB }`; hit events also include `point`, `normal`, and `approachSpeed`. |
| `getSensorEvents(world)` | `{ begin, end }`, where each event has `{ sensor, visitor }`. |
| `getJointEvents(world)` | Array of `{ joint }`. |

Contact, hit, and sensor events require the relevant shape event flags to be enabled.

## Bodies

### Create and destroy

```javascript
const body = b2.createBody(world, {
  type: b2.dynamicBody,
  position: { x: 0, y: 4 },
  angle: 0,
});

b2.destroyBody(body);
```

`createBody` defaults to a static body at the origin.

### Transforms and velocity

| Method | Purpose |
| --- | --- |
| `setBodyTransform(body, { position, angle })` | Teleport body transform. |
| `getBodyTransform(body)` | Read `{ position, angle }`. |
| `getBodyPosition(body)` | Read only the position. |
| `setBodyVelocity(body, { linearVelocity, angularVelocity })` | Set linear and angular velocity together. |
| `setBodyLinearVelocity(body, velocity)` | Set linear velocity. |
| `setBodyAngularVelocity(body, angularVelocity)` | Set angular velocity. |
| `getBodyVelocity(body)` | Read linear velocity. |
| `getBodyAngularVelocity(body)` | Read angular velocity. |
| `readBodyTransforms(bodies, out?)` | Batch-read `[x, y, angle]` triples. |

### Body state and properties

| Method | Purpose |
| --- | --- |
| `getBodyType(body)` / `setBodyType(body, type)` | Read or set body type. |
| `getBodyMass(body)` | Read mass. |
| `setBodyAwake(body, awake)` / `isBodyAwake(body)` | Control awake state. |
| `setBodyEnabled(body, enabled)` / `isBodyEnabled(body)` | Enable or disable a body. |
| `setBodyBullet(body, bullet)` / `isBodyBullet(body)` | Control bullet mode. |
| `setBodyGravityScale(body, gravityScale)` / `getBodyGravityScale(body)` | Control gravity scale. |
| `setBodyDamping(body, { linearDamping, angularDamping })` / `getBodyDamping(body)` | Control damping. |

### Forces and impulses

| Method | Purpose |
| --- | --- |
| `applyForce(body, force, point, wake?)` | Apply force at a world point. |
| `applyForceToCenter(body, force, wake?)` | Apply force at the center of mass. |
| `applyTorque(body, torque, wake?)` | Apply torque. |
| `applyLinearImpulse(body, impulse, point, wake?)` | Apply impulse at a world point. |
| `applyLinearImpulseToCenter(body, impulse, wake?)` | Apply impulse at the center of mass. |
| `applyAngularImpulse(body, impulse, wake?)` | Apply angular impulse. |

## Shapes and Chains

### Shape options

All shape helpers accept common shape options:

```javascript
{
  density: 1,
  friction: 0.6,
  restitution: 0,
  rollingResistance: 0,
  tangentSpeed: 0,
  userMaterialId: 0,
  customColor: 0,
  isSensor: false,
  enableSensorEvents: false,
  enableContactEvents: false,
  enableHitEvents: false,
  filter: {
    categoryBits: 1,
    maskBits: 0xffffffff,
    groupIndex: 0,
  },
}
```

Segments default to density `0`. Other shapes default to density `1`.

### Box

```javascript
const shape = b2.createBoxShape(body, {
  hx: 0.5,
  hy: 0.25,
  density: 1,
});
```

Aliases: `halfWidth` for `hx`, `halfHeight` for `hy`.

### Circle

```javascript
const shape = b2.createCircleShape(body, {
  center: { x: 0, y: 0 },
  radius: 0.5,
  density: 1,
});
```

### Capsule

```javascript
const shape = b2.createCapsuleShape(body, {
  center1: { x: -0.5, y: 0 },
  center2: { x: 0.5, y: 0 },
  radius: 0.2,
  density: 1,
});
```

Aliases: `p1` for `center1`, `p2` for `center2`.

### Segment

```javascript
const shape = b2.createSegmentShape(body, {
  p1: { x: -4, y: 0 },
  p2: { x: 4, y: 0 },
});
```

Segment endpoints must be distinct.

### Polygon

```javascript
const shape = b2.createPolygonShape(body, {
  vertices: [
    { x: -1, y: -0.4 },
    { x: 1, y: -0.4 },
    { x: 0.8, y: 0.4 },
    { x: -0.8, y: 0.4 },
  ],
  density: 1,
});
```

Polygons require 3 to 8 vertices.

### Chain

```javascript
const chain = b2.createChain(staticBody, {
  vertices: [
    { x: -6, y: 0 },
    { x: -2, y: 0.25 },
    { x: 2, y: 0 },
    { x: 6, y: 0.25 },
  ],
  isLoop: false,
  friction: 0.8,
});
```

Aliases: `points` for `vertices`, `loop` for `isLoop`.

Chain helpers:

| Method | Purpose |
| --- | --- |
| `destroyChain(chain)` | Destroy chain. |
| `getChainSegmentCount(chain)` | Read segment count. |
| `getChainSegments(chain)` | Return shape handles for chain segments. |
| `getChainSurfaceMaterialCount(chain)` | Read material count. |
| `getChainSurfaceMaterial(chain, materialIndex)` | Read a chain material. |
| `setChainSurfaceMaterial(chain, materialIndex, def)` | Update a chain material. |

### Shape inspection and mutation

| Method | Purpose |
| --- | --- |
| `destroyShape(shape, updateBodyMass?)` | Destroy shape. |
| `getShapeType(shape)` | Read shape type constant. |
| `isShapeSensor(shape)` | Read sensor flag. |
| `setShapeDensity(shape, density, updateBodyMass?)` / `getShapeDensity(shape)` | Control density. |
| `setShapeFriction(shape, friction)` / `getShapeFriction(shape)` | Control friction. |
| `setShapeRestitution(shape, restitution)` / `getShapeRestitution(shape)` | Control restitution. |
| `setShapeSurfaceMaterial(shape, def)` / `getShapeSurfaceMaterial(shape)` | Control full surface material. |
| `setShapeUserMaterial(shape, userMaterialId)` / `getShapeUserMaterial(shape)` | Control user material id. |
| `setShapeFilter(shape, filter)` / `getShapeFilter(shape)` | Control category, mask, and group bits. |
| `enableShapeSensorEvents(shape, enabled)` / `areShapeSensorEventsEnabled(shape)` | Control sensor events. |
| `enableShapeContactEvents(shape, enabled)` / `areShapeContactEventsEnabled(shape)` | Control contact events. |
| `enableShapeHitEvents(shape, enabled)` / `areShapeHitEventsEnabled(shape)` | Control hit events. |
| `testShapePoint(shape, point)` | Test whether a world point overlaps the shape. |
| `rayCastShape(shape, def)` | Ray cast against one shape. |
| `getShapeAABB(shape)` | Read world AABB. |

## Joints

### Common joint definition fields

```javascript
{
  anchor: { x: 0, y: 0 },
  anchorA: { x: 0, y: 0 },
  anchorB: { x: 1, y: 0 },
  localAnchorA: { x: 0, y: 0 },
  localAnchorB: { x: 0, y: 0 },
  axis: { x: 1, y: 0 },
  localAxis: { x: 1, y: 0 },
  collideConnected: false,
  constraintHertz: 0,
  constraintDampingRatio: 0,
  forceThreshold: 0,
  torqueThreshold: 0,
}
```

If `localAnchorA` or `localAnchorB` is provided, anchors are treated as local anchors. Otherwise `anchor`, `anchorA`, and `anchorB` are treated as world anchors.

### Shared joint APIs

| Method | Purpose |
| --- | --- |
| `destroyJoint(joint, wakeAttached?)` | Destroy joint. |
| `getJointType(joint)` | Read joint type constant. |
| `wakeJointBodies(joint)` | Wake attached bodies. |
| `setJointCollideConnected(joint, shouldCollide)` / `getJointCollideConnected(joint)` | Control collide-connected. |
| `setJointLocalFrameA(joint, frame)` / `getJointLocalFrameA(joint)` | Control local frame A. |
| `setJointLocalFrameB(joint, frame)` / `getJointLocalFrameB(joint)` | Control local frame B. |
| `setJointConstraintTuning(joint, tuning)` / `getJointConstraintTuning(joint)` | Control constraint tuning. |
| `getJointConstraintForce(joint)` | Read constraint force. |
| `getJointConstraintTorque(joint)` | Read constraint torque. |
| `getJointLinearSeparation(joint)` | Read linear separation. |
| `getJointAngularSeparation(joint)` | Read angular separation. |
| `setJointForceThreshold(joint, threshold)` / `getJointForceThreshold(joint)` | Control force event threshold. |
| `setJointTorqueThreshold(joint, threshold)` / `getJointTorqueThreshold(joint)` | Control torque event threshold. |

### Distance joint

```javascript
const joint = b2.createDistanceJoint(world, bodyA, bodyB, {
  anchorA: { x: 0, y: 0 },
  anchorB: { x: 2, y: 0 },
  length: 2,
  enableSpring: true,
  hertz: 4,
  dampingRatio: 0.7,
  enableLimit: true,
  lengthRange: { min: 1.5, max: 2.5 },
  enableMotor: true,
  motorSpeed: 0.25,
  maxMotorForce: 12,
});
```

Distance joint APIs include length, spring, spring force range, limit, motor speed, max motor force, current length, and motor force getters/setters.

### Revolute joint

```javascript
const joint = b2.createRevoluteJoint(world, bodyA, bodyB, {
  anchor: { x: 0, y: 1 },
  enableLimit: true,
  lowerAngle: -0.5,
  upperAngle: 0.5,
  enableMotor: true,
  motorSpeed: 1,
  maxMotorTorque: 20,
});
```

Revolute joint APIs include spring tuning, target angle, current angle, limits, motor enable, motor speed, max motor torque, and motor torque reads. `setRevoluteJointMotor(joint, { enabled, motorSpeed, maxMotorTorque })` updates the motor in one call.

### Prismatic joint

```javascript
const joint = b2.createPrismaticJoint(world, bodyA, bodyB, {
  anchor: { x: 0, y: 0 },
  axis: { x: 1, y: 0 },
  enableLimit: true,
  lowerTranslation: -0.5,
  upperTranslation: 0.5,
  enableMotor: true,
  motorSpeed: 0.4,
  maxMotorForce: 20,
});
```

Prismatic joint APIs include spring tuning, target translation, limits, motor speed, max motor force, motor force reads, current translation, and current speed.

### Wheel joint

```javascript
const joint = b2.createWheelJoint(world, chassis, wheel, {
  anchor: { x: 0, y: 1 },
  axis: { x: 0, y: 1 },
  enableSpring: true,
  hertz: 4,
  dampingRatio: 0.8,
  enableMotor: true,
  motorSpeed: -8,
  maxMotorTorque: 25,
});
```

Wheel joint APIs include spring tuning, translation limits, motor speed, max motor torque, and motor torque reads.

### Motor joint

```javascript
const joint = b2.createMotorJoint(world, bodyA, bodyB, {
  linearVelocity: { x: 1, y: 0 },
  angularVelocity: 0.5,
  maxVelocityForce: 20,
  maxVelocityTorque: 10,
  linearHertz: 4,
  linearDampingRatio: 0.7,
  angularHertz: 3,
  angularDampingRatio: 0.6,
});
```

Motor joint APIs include linear/angular velocity, max velocity force/torque, linear/angular spring tuning, and max spring force/torque.

### Filter joint

```javascript
const joint = b2.createFilterJoint(world, bodyA, bodyB, {
  collideConnected: false,
});
```

Use a filter joint when you need the relationship semantics of a joint without a motion constraint.

## Batched Transform Reads

```javascript
const bodies = [bodyA, bodyB, bodyC];
const out = new Float32Array(bodies.length * 3);

b2.readBodyTransforms(bodies, out);
```

The output layout is:

```text
body 0: out[0] = x, out[1] = y, out[2] = angle
body 1: out[3] = x, out[4] = y, out[5] = angle
body 2: out[6] = x, out[7] = y, out[8] = angle
```

If `out` is omitted, the wrapper allocates and returns a new `Float32Array`. For render loops, pass and reuse your own array.

## Lifecycle Notes

- Destroy joints before destroying bodies if you manage joint lifetimes explicitly.
- Destroying a body invalidates attached shape and joint handles.
- Destroying a world invalidates all handles created in that world.
- Keep render/model data in your app. Box2D v3 is not intended to be queried every frame for all shape geometry.
- Use batched reads for per-frame state and event reads for post-step changes.
