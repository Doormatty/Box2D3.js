# Tutorial 3: Canvas Wireframe Car

This tutorial builds a small browser demo with terrain, a polygon chassis, two wheels, motorized revolute joints, and the wireframe helper.

## What You Will Use

- browser script loading
- `Box2DWireframe.createWireframe`
- `createWireChain`
- `createWirePolygon`
- `createWireCircle`
- `createRevoluteJoint`
- `wire.draw`

## Serve the Files

Browsers need to fetch the wasm file over HTTP. From a project with `box2d-v3-wasm` installed, use any static server:

```sh
npx http-server .
```

Then open the HTML page through the server URL.

## Complete HTML

Save this as `wireframe-car.html`.

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Box2D v3 Wireframe Car</title>
  <style>
    html,
    body {
      margin: 0;
      height: 100%;
      background: #f7f3ec;
      color: #1f2937;
      font-family: system-ui, sans-serif;
    }

    canvas {
      display: block;
      width: 100vw;
      height: 100vh;
      background: #fbfaf7;
    }
  </style>
</head>
<body>
  <canvas id="view"></canvas>

  <script src="./node_modules/box2d-v3-wasm/build/Box2D_v3.1.1.js"></script>
  <script src="./node_modules/box2d-v3-wasm/box2d.v3.js"></script>
  <script src="./node_modules/box2d-v3-wasm/box2d.v3.wireframe.js"></script>
  <script>
    (async function () {
      const canvas = document.getElementById("view");
      const ctx = canvas.getContext("2d");
      const b2 = await Box2D();
      const wire = Box2DWireframe.createWireframe(b2);
      const world = b2.createWorld({ gravity: { x: 0, y: -10 } });

      const wheelGroup = -1;

      function resize() {
        const dpr = window.devicePixelRatio || 1;
        canvas.width = Math.floor(canvas.clientWidth * dpr);
        canvas.height = Math.floor(canvas.clientHeight * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }

      window.addEventListener("resize", resize);
      resize();

      const terrain = wire.createWireChain(world, {
        id: "terrain",
        vertices: [
          { x: -12, y: 0 },
          { x: -8, y: 0.2 },
          { x: -4, y: 0.1 },
          { x: 0, y: 0.35 },
          { x: 4, y: 0 },
          { x: 8, y: 0.25 },
          { x: 12, y: 0.05 },
        ],
        friction: 0.9,
        style: {
          stroke: "#334155",
          lineWidth: 3,
        },
      });

      const chassis = wire.createWirePolygon(world, {
        id: "chassis",
        type: b2.dynamicBody,
        position: { x: -5, y: 2.4 },
        vertices: [
          { x: -1.35, y: -0.35 },
          { x: 1.2, y: -0.35 },
          { x: 1.45, y: 0.15 },
          { x: -0.75, y: 0.5 },
        ],
        density: 1.2,
        friction: 0.7,
        groupIndex: wheelGroup,
        style: {
          stroke: "#0f766e",
          fill: "rgba(20, 184, 166, 0.12)",
          lineWidth: 2,
        },
      });

      const rearWheel = wire.createWireCircle(world, {
        id: "rear-wheel",
        type: b2.dynamicBody,
        position: { x: -5.85, y: 1.75 },
        radius: 0.38,
        density: 1,
        friction: 1.2,
        groupIndex: wheelGroup,
        style: {
          stroke: "#be123c",
          lineWidth: 2,
        },
      });

      const frontWheel = wire.createWireCircle(world, {
        id: "front-wheel",
        type: b2.dynamicBody,
        position: { x: -4.15, y: 1.75 },
        radius: 0.38,
        density: 1,
        friction: 1.2,
        groupIndex: wheelGroup,
        style: {
          stroke: "#be123c",
          lineWidth: 2,
        },
      });

      const rearJoint = b2.createRevoluteJoint(world, chassis.body, rearWheel.body, {
        anchor: { x: -5.85, y: 1.75 },
        enableMotor: true,
        motorSpeed: -9,
        maxMotorTorque: 35,
        collideConnected: false,
      });

      const frontJoint = b2.createRevoluteJoint(world, chassis.body, frontWheel.body, {
        anchor: { x: -4.15, y: 1.75 },
        enableMotor: true,
        motorSpeed: -9,
        maxMotorTorque: 35,
        collideConnected: false,
      });

      function stepFixed() {
        for (let i = 0; i < 2; ++i) {
          b2.step(world, 1 / 120, 4);
        }
      }

      function draw() {
        ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);

        const chassisTransform = wire.getTransform(chassis);
        const cameraX = canvas.clientWidth / 2 - chassisTransform.x * 36;

        wire.draw(ctx, {
          pixelsPerMeter: 36,
          offsetX: cameraX,
          offsetY: canvas.clientHeight - 88,
        });
      }

      function frame() {
        stepFixed();
        draw();
        requestAnimationFrame(frame);
      }

      requestAnimationFrame(frame);

      window.addEventListener("beforeunload", function () {
        b2.destroyJoint(rearJoint);
        b2.destroyJoint(frontJoint);
        b2.destroyWorld(world);
      });
    })();
  </script>
</body>
</html>
```

## How It Works

### 1. Load the Runtime

```html
<script src="./node_modules/box2d-v3-wasm/build/Box2D_v3.1.1.js"></script>
<script src="./node_modules/box2d-v3-wasm/box2d.v3.js"></script>
<script src="./node_modules/box2d-v3-wasm/box2d.v3.wireframe.js"></script>
```

The generated Emscripten file provides `Box2DModule`, the wrapper provides `Box2D`, and the helper provides `Box2DWireframe`.

### 2. Create Physics and Render Geometry Together

```javascript
const chassis = wire.createWirePolygon(world, {
  type: b2.dynamicBody,
  vertices: chassisVertices,
  density: 1.2,
});
```

The helper creates the Box2D body and shape, then stores the local polygon vertices for drawing.

### 3. Use Collision Groups for Car Parts

```javascript
const wheelGroup = -1;
```

The chassis and wheels use the same negative `groupIndex` so they do not collide with each other. They still collide with the terrain.

### 4. Add Motorized Wheel Joints

```javascript
b2.createRevoluteJoint(world, chassis.body, rearWheel.body, {
  anchor: { x: -5.85, y: 1.75 },
  enableMotor: true,
  motorSpeed: -9,
  maxMotorTorque: 35,
});
```

The joint anchor is in world coordinates. Revolute motors rotate the wheel bodies relative to the chassis.

### 5. Draw After Stepping

```javascript
b2.step(world, 1 / 60, 4);
wire.draw(ctx, {
  pixelsPerMeter: 36,
  offsetX: canvas.width / 2,
  offsetY: canvas.height - 88,
});
```

`wire.draw` syncs body transforms and renders the stored local geometry with the current physics state.

## Next Changes

Try these changes:

- Replace the revolute joints with `createWheelJoint` for suspension.
- Add more chain points to make rougher terrain.
- Use `b2.getBodyVelocity(chassis.body)` to score distance or speed.
- Use `wire.removeDrawable(drawable)` plus `b2.destroyBody(drawable.body)` when removing objects.
