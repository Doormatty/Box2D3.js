const assert = require("assert");
const Box2D = require("./box2d.v3.js");
const Wireframe = require("./box2d.v3.wireframe.js");
const PackageWireframe = require("box2d-v3-wasm/wireframe");

assert.strictEqual(
  PackageWireframe.createWireframe,
  Wireframe.createWireframe,
  "package self-reference should resolve the wireframe helper"
);

function assertClose(actual, expected, tolerance, message) {
  assert(
    Math.abs(actual - expected) <= tolerance,
    `${message}: expected ${expected} +/- ${tolerance}, got ${actual}`
  );
}

function assertFiniteTransform(transform, message) {
  assert(Number.isFinite(transform.x), `${message}.x should be finite`);
  assert(Number.isFinite(transform.y), `${message}.y should be finite`);
  assert(Number.isFinite(transform.angle), `${message}.angle should be finite`);
}

function stepWorld(b2, world, count) {
  for (let i = 0; i < count; ++i) {
    b2.step(world, 1 / 60, 4);
  }
}

function createRecordingContext() {
  const calls = [];
  const state = {};
  const ctx = {
    calls,
    save() {
      calls.push(["save"]);
    },
    restore() {
      calls.push(["restore"]);
    },
    translate(x, y) {
      calls.push(["translate", x, y]);
    },
    scale(x, y) {
      calls.push(["scale", x, y]);
    },
    rotate(angle) {
      calls.push(["rotate", angle]);
    },
    beginPath() {
      calls.push(["beginPath"]);
    },
    moveTo(x, y) {
      calls.push(["moveTo", x, y]);
    },
    lineTo(x, y) {
      calls.push(["lineTo", x, y]);
    },
    closePath() {
      calls.push(["closePath"]);
    },
    arc(x, y, radius, start, end) {
      calls.push(["arc", x, y, radius, start, end]);
    },
    fill() {
      calls.push(["fill"]);
    },
    stroke() {
      calls.push(["stroke"]);
    },
  };

  for (const property of ["lineWidth", "strokeStyle", "fillStyle"]) {
    Object.defineProperty(ctx, property, {
      get() {
        return state[property];
      },
      set(value) {
        state[property] = value;
        calls.push([property, value]);
      },
    });
  }

  return ctx;
}

async function testWireframeFactoriesAndTransforms() {
  const b2 = await Box2D();
  const wire = Wireframe.createWireframe(b2);
  const world = b2.createWorld({ gravity: { x: 0, y: -10 } });

  const terrain = wire.createWireChain(world, {
    id: "terrain",
    vertices: [
      { x: -6, y: 0 },
      { x: -2, y: 0.1 },
      { x: 2, y: 0 },
      { x: 6, y: 0.1 },
    ],
    friction: 0.8,
  });

  const segment = wire.createWireSegmentBody(world, {
    id: "segment",
    p1: { x: -3, y: 1.25 },
    p2: { x: -2, y: 1.6 },
    friction: 0.4,
  });

  const box = wire.createWireBox(world, {
    id: "box",
    type: b2.dynamicBody,
    position: { x: -1.5, y: 3 },
    hx: 0.4,
    hy: 0.3,
    density: 1,
    style: { stroke: "#2255aa", fill: "#aaccee", lineWidth: 4 },
  });

  const polygon = wire.createWirePolygon(world, {
    id: "polygon",
    type: b2.dynamicBody,
    position: { x: 0, y: 4 },
    vertices: [
      { x: -0.6, y: -0.25 },
      { x: 0.7, y: -0.2 },
      { x: 0.3, y: 0.45 },
      { x: -0.4, y: 0.35 },
    ],
    density: 1,
  });

  const circle = wire.createWireCircle(world, {
    id: "circle",
    type: b2.dynamicBody,
    position: { x: 1.4, y: 3 },
    radius: 0.35,
    density: 1,
  });

  const capsule = wire.createWireCapsule(world, {
    id: "capsule",
    type: b2.dynamicBody,
    position: { x: 2.4, y: 4 },
    center1: { x: -0.25, y: 0 },
    center2: { x: 0.25, y: 0 },
    radius: 0.2,
    density: 1,
  });

  assert.strictEqual(wire.drawables.length, 6, "six drawables should be registered");
  assert.strictEqual(terrain.shapes[0].type, "chain");
  assert.strictEqual(terrain.shapes[0].points.length, 4);
  assert.strictEqual(segment.shapes[0].type, "segment");
  assert.strictEqual(box.shapes[0].vertices.length, 4);
  assert.strictEqual(polygon.shapes[0].type, "polygon");
  assert.strictEqual(circle.shapes[0].radius, 0.35);
  assert.strictEqual(capsule.shapes[0].type, "capsule");

  assert.strictEqual(b2.getShapeType(box.shapes[0].shape), b2.polygonShape);
  assert.strictEqual(b2.getShapeType(segment.shapes[0].shape), b2.segmentShape);
  assert.strictEqual(b2.getShapeType(polygon.shapes[0].shape), b2.polygonShape);
  assert.strictEqual(b2.getShapeType(circle.shapes[0].shape), b2.circleShape);
  assert.strictEqual(b2.getShapeType(capsule.shapes[0].shape), b2.capsuleShape);
  assert(b2.getChainSegmentCount(terrain.shapes[0].chain) > 0, "terrain chain should create segments");
  assertFiniteTransform(wire.getTransform(circle), "unsynced circle transform");

  stepWorld(b2, world, 90);
  const transforms = wire.syncTransforms();
  assert(transforms instanceof Float32Array, "transforms should be a Float32Array");
  assert(transforms.length >= wire.drawables.length * 3, "transform buffer should fit drawables");

  for (const drawable of wire.drawables) {
    assertFiniteTransform(wire.getTransform(drawable), drawable.id);
  }

  const circleTransform = wire.getTransform(circle);
  const circleBodyTransform = b2.getBodyTransform(circle.body);
  assertClose(circleTransform.x, circleBodyTransform.position.x, 0.001, "circle transform x");
  assertClose(circleTransform.y, circleBodyTransform.position.y, 0.001, "circle transform y");
  assertClose(circleTransform.angle, circleBodyTransform.angle, 0.001, "circle transform angle");

  const ctx = createRecordingContext();
  wire.draw(ctx, { pixelsPerMeter: 20, offsetX: 320, offsetY: 220 });
  assert(ctx.calls.some((call) => call[0] === "arc"), "draw should issue arc calls for circles/capsules");
  assert(ctx.calls.some((call) => call[0] === "lineTo"), "draw should issue line calls for polygons/chains");
  assert(ctx.calls.some((call) => call[0] === "fill"), "draw should fill styled wire shapes");
  assert(ctx.calls.some((call) => call[0] === "strokeStyle" && call[1] === "#2255aa"), "draw should apply drawable stroke style");
  assert(ctx.calls.some((call) => call[0] === "lineWidth" && Math.abs(call[1] - 0.2) < 0.0001), "draw should scale line width by pixels per meter");
  assert(ctx.calls.filter((call) => call[0] === "stroke").length >= 5, "draw should stroke all wire shapes");

  wire.removeDrawable(circle);
  wire.rebuildTransformList();
  assert.strictEqual(wire.drawables.length, 5, "removeDrawable should remove the drawable");
  assert(!wire.bodies.includes(circle.body), "removed body should leave transform batch");
  assert.throws(
    () => wire.getTransform(circle),
    /not registered/,
    "removed drawables should not return stale transforms"
  );

  b2.destroyWorld(world);
}

async function testWireframeHullDrawingAndReuse() {
  const hull = Wireframe.convexHull(new Float32Array([0, 0, 1, 0, 0.5, 0.25, 1, 1, 0, 1, 0, 0]));
  assert.deepStrictEqual(
    hull.map((point) => [point.x, point.y]),
    [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ],
    "convexHull should drop duplicate and interior typed-array points"
  );

  const b2 = await Box2D();
  const wire = Wireframe.createWireframe(b2);
  const world = b2.createWorld({ gravity: { x: 0, y: 0 } });
  const body = b2.createBody(world, {
    type: b2.dynamicBody,
    position: { x: 2, y: 2 },
    angle: 0.5,
  });

  const reused = wire.createWireBox(world, {
    id: 123,
    body,
    halfWidth: 0.75,
    halfHeight: 0.25,
    style: { stroke: "#0f172a", fill: "#c7d2fe", lineWidth: 5 },
  });
  assert.strictEqual(reused.id, "123", "numeric drawable ids should be stringified");
  assert.strictEqual(reused.body, body, "wire drawable should reuse provided bodies");
  assert.strictEqual(reused.shapes[0].vertices[2].x, 0.75, "halfWidth alias should create local box vertices");

  const normalized = wire.createWirePolygon(world, {
    id: "normalized",
    type: b2.staticBody,
    vertices: new Float32Array([0, 0, 1, 0, 0.5, 0.25, 1, 1, 0, 1, 0, 0]),
    density: 0,
  });
  assert.strictEqual(normalized.shapes[0].vertices.length, 4, "wire polygons should normalize noisy point sets by default");

  const bodies = wire.rebuildTransformList();
  assert.strictEqual(bodies.length, 2, "rebuildTransformList should track each drawable body");
  assert.strictEqual(reused.transformIndex, 0, "rebuildTransformList should refresh transform indices");
  assert.strictEqual(normalized.transformIndex, 1, "rebuildTransformList should refresh later transform indices");

  const ctx = createRecordingContext();
  wire.draw(ctx, { scale: 10, flipY: false, offsetX: 5, offsetY: 7 });
  assert(ctx.calls.some((call) => call[0] === "scale" && call[1] === 10 && call[2] === 10), "flipY false should preserve positive y scale");
  assert(ctx.calls.some((call) => call[0] === "translate" && call[1] === 5 && call[2] === 7), "draw options should apply canvas offsets");
  assert(ctx.calls.some((call) => call[0] === "fillStyle" && call[1] === "#c7d2fe"), "draw should apply fill style");
  assert(ctx.calls.some((call) => call[0] === "lineWidth" && Math.abs(call[1] - 0.5) < 0.0001), "draw should scale custom line width");

  b2.destroyWorld(world);
}

async function testWireframeValidation() {
  const b2 = await Box2D();
  const wire = Wireframe.createWireframe(b2);
  const world = b2.createWorld({ gravity: { x: 0, y: 0 } });
  const ctx = createRecordingContext();

  assert.throws(
    () => Wireframe.createWireframe({}),
    /Box2D v3 wrapper instance/,
    "createWireframe should reject incompatible wrapper objects"
  );
  assert.throws(
    () => Wireframe.convexHull([0, 0, 1]),
    /x\/y pairs/,
    "odd-length flat point arrays should be rejected"
  );
  assert.throws(
    () => wire.createWireCircle(world, { radius: 0 }),
    /circle\.radius/,
    "non-positive wire circle radius should be rejected"
  );
  assert.throws(
    () => wire.createWireSegmentBody(world, { p1: { x: 0, y: 0 }, p2: { x: 0, y: 0 } }),
    /segment endpoints/,
    "zero-length wire segment should be rejected"
  );
  assert.throws(
    () => wire.createWirePolygon(world, { vertices: [{ x: 0, y: 0 }, { x: 1, y: 0 }] }),
    /polygon requires at least 3 points/,
    "undersized wire polygon should be rejected"
  );
  assert.throws(
    () => wire.createWireChain(world, { vertices: [0, 0, 1, 0, 2, 0] }),
    /chain requires at least 4 points/,
    "undersized wire chain should be rejected"
  );
  assert.throws(
    () => Wireframe.drawWireframes(ctx, [], new Float32Array(0), { scale: 0 }),
    /scale/,
    "non-positive draw scale should be rejected"
  );
  assert.throws(
    () =>
      Wireframe.drawWireframes(
        ctx,
        [{ transformIndex: 0, style: { stroke: "#000", fill: null, lineWidth: 1 }, shapes: [{ type: "unknown" }] }],
        new Float32Array([0, 0, 0])
      ),
    /Unknown wire shape type/,
    "unknown wire shape types should be rejected during drawing"
  );

  b2.destroyWorld(world);
}

(async function main() {
  await testWireframeFactoriesAndTransforms();
  await testWireframeHullDrawingAndReuse();
  await testWireframeValidation();
  console.log("Box2D v3 wireframe tests passed");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
