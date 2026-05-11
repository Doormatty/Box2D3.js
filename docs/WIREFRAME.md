# Wireframe Helper

`box2d-v3-wasm/wireframe` is a small canvas-oriented helper for demos, debugging views, and simple games. It creates Box2D bodies/shapes and stores matching app-owned local geometry for drawing.

It is intentionally not a Box2D debug draw callback layer. The model is:

1. Create physics and render geometry together.
2. Keep local vertices, radii, and chain points in JavaScript.
3. Batch-read body transforms from Box2D.
4. Draw the stored local geometry through the current body transforms.

## Loading

```javascript
const Box2D = require("box2d-v3-wasm");
const Wireframe = require("box2d-v3-wasm/wireframe");

const b2 = await Box2D();
const wire = Wireframe.createWireframe(b2);
```

In a browser:

```html
<script src="./node_modules/box2d-v3-wasm/build/Box2D_v3.1.1.js"></script>
<script src="./node_modules/box2d-v3-wasm/box2d.v3.js"></script>
<script src="./node_modules/box2d-v3-wasm/box2d.v3.wireframe.js"></script>
<script>
  (async function () {
    const b2 = await Box2D();
    const wire = Box2DWireframe.createWireframe(b2);
  })();
</script>
```

## Manager

`createWireframe(b2)` returns a manager:

```typescript
{
  b2,
  drawables,
  bodies,
  transforms,
  createWireBox,
  createWirePolygon,
  createWireCircle,
  createWireCapsule,
  createWireSegmentBody,
  createWireChain,
  rebuildTransformList,
  syncTransforms,
  getTransform,
  removeDrawable,
  draw,
}
```

`drawables` contains app-level render records. `bodies` and `transforms` are the batched state used by `syncTransforms()` and `draw()`.

## Drawable Records

Each factory returns a drawable:

```javascript
{
  id: "box",
  body,
  world,
  transformIndex: 0,
  style: {
    stroke: "#111827",
    fill: null,
    lineWidth: 2,
  },
  shapes: [
    {
      type: "polygon",
      vertices: [
        { x: -0.5, y: -0.5 },
        { x: 0.5, y: -0.5 },
        { x: 0.5, y: 0.5 },
        { x: -0.5, y: 0.5 },
      ],
      shape,
    },
  ],
}
```

The stored geometry is local to the drawable body. Use it for rendering and keep the Box2D shape/chain handle for lifecycle, filtering, queries, and event setup.

## Common Factory Options

All factories accept body options and shape options.

```javascript
{
  id: "wheel",
  body,               // optional existing body
  bodyDef,            // optional full body definition
  type: b2.dynamicBody,
  position: { x: 0, y: 2 },
  angle: 0,
  density: 1,
  friction: 0.8,
  restitution: 0,
  filter: {
    categoryBits: 0x0002,
    maskBits: 0xffffffff,
    groupIndex: -1,
  },
  style: {
    stroke: "#111827",
    fill: null,
    lineWidth: 2,
  },
}
```

If `body` is provided, the factory attaches the shape to that body. Otherwise it creates a new body from `bodyDef`, or from `type`, `position`, and `angle`.

Default style:

```javascript
{
  stroke: "#111827",
  fill: null,
  lineWidth: 2,
}
```

## Factories

### Box

```javascript
const box = wire.createWireBox(world, {
  id: "box",
  type: b2.dynamicBody,
  position: { x: 0, y: 4 },
  hx: 0.5,
  hy: 0.5,
  density: 1,
});
```

Aliases: `halfWidth` for `hx`, `halfHeight` for `hy`. Defaults are `0.5` by `0.5`.

The drawable stores a polygon with four local vertices.

### Polygon

```javascript
const chassis = wire.createWirePolygon(world, {
  id: "chassis",
  type: b2.dynamicBody,
  position: { x: 0, y: 2.5 },
  vertices: [
    { x: -1.4, y: -0.35 },
    { x: 1.2, y: -0.35 },
    { x: 1.45, y: 0.15 },
    { x: -0.7, y: 0.45 },
  ],
  density: 1.2,
});
```

By default, `createWirePolygon` runs the input through `convexHull` and stores the normalized hull. Pass `normalizeHull: false` if your vertices are already a valid Box2D polygon and you need the exact order preserved.

The underlying wrapper supports 3 to 8 polygon vertices.

### Circle

```javascript
const circle = wire.createWireCircle(world, {
  id: "wheel",
  type: b2.dynamicBody,
  position: { x: 0, y: 2 },
  radius: 0.35,
  density: 1,
});
```

`center` defaults to `{ x: 0, y: 0 }`. `radius` defaults to `0.5`.

The renderer draws the circle and a radius line so rotation is visible.

### Capsule

```javascript
const capsule = wire.createWireCapsule(world, {
  id: "capsule",
  type: b2.dynamicBody,
  center1: { x: -0.4, y: 0 },
  center2: { x: 0.4, y: 0 },
  radius: 0.2,
  density: 1,
});
```

Aliases: `p1` for `center1`, `p2` for `center2`. Default centers are `{ x: 0, y: -0.5 }` and `{ x: 0, y: 0.5 }`. Default radius is `0.25`.

### Segment Body

```javascript
const segment = wire.createWireSegmentBody(world, {
  id: "ledge",
  p1: { x: -3, y: 1.25 },
  p2: { x: -2, y: 1.6 },
  friction: 0.4,
});
```

Segments default to a static body. Provide distinct `p1` and `p2` points.

### Chain

```javascript
const terrain = wire.createWireChain(world, {
  id: "terrain",
  vertices: [
    { x: -6, y: 0 },
    { x: -2, y: 0.1 },
    { x: 2, y: 0 },
    { x: 6, y: 0.1 },
  ],
  isLoop: false,
  friction: 0.8,
});
```

Aliases: `points` for `vertices`, `loop` for `isLoop`. Chains require at least 4 points and default to a static body.

## Transform Syncing

`syncTransforms()` reads all registered drawable body transforms in one call:

```javascript
b2.step(world, 1 / 60, 4);
wire.syncTransforms();

const transform = wire.getTransform(chassis);
console.log(transform.x, transform.y, transform.angle);
```

The transform buffer is a `Float32Array` with three floats per drawable:

```text
x, y, angle
```

`rebuildTransformList()` compacts `drawables`, `bodies`, and `transformIndex` values after additions/removals. The manager calls it automatically when needed.

## Drawing

Use `wire.draw(ctx, options)` after stepping:

```javascript
function frame() {
  b2.step(world, 1 / 60, 4);

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  wire.draw(ctx, {
    pixelsPerMeter: 32,
    offsetX: canvas.width / 2,
    offsetY: canvas.height - 48,
  });

  requestAnimationFrame(frame);
}
```

Draw options:

| Option | Default | Purpose |
| --- | --- | --- |
| `pixelsPerMeter` | `1` | Preferred scale option. |
| `scale` | `1` | Alias used when `pixelsPerMeter` is omitted. |
| `offsetX` | `0` | Canvas x offset before scaling. |
| `offsetY` | `0` | Canvas y offset before scaling. |
| `flipY` | `true` | Flip the y axis so positive Box2D y points upward. |

The standalone `drawWireframes(ctx, drawables, transforms, options)` function can draw an externally managed drawable list and transform buffer.

## Removing Drawables

```javascript
wire.removeDrawable(circle);
wire.rebuildTransformList();
```

`removeDrawable` only removes the drawable from the manager. It does not destroy the Box2D body, shapes, chains, or joints. Destroy physics objects explicitly when you own their lifetime:

```javascript
b2.destroyBody(circle.body);
wire.removeDrawable(circle);
```

If a drawable owns joints, destroy those joints before destroying the body.

## Convex Hull Utility

```javascript
const hull = Wireframe.convexHull([
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 0.25, y: 0.25 },
  { x: 0, y: 1 },
]);
```

`convexHull(points)` accepts the same vertex input styles as the main wrapper and returns `{ x, y }` points.

## Practical Pattern

Keep your app model separate from the physics engine:

```javascript
const car = {
  chassis: wire.createWirePolygon(world, chassisDef),
  wheels: [
    wire.createWireCircle(world, frontWheelDef),
    wire.createWireCircle(world, rearWheelDef),
  ],
  joints: [
    frontJoint,
    rearJoint,
  ],
};
```

Each frame:

1. Step the world.
2. Sync transforms.
3. Draw from app-owned geometry.
4. Read events or scores needed by the app.

Do not query Box2D for vertices during drawing. Store the local geometry you created and transform it through the body state.
