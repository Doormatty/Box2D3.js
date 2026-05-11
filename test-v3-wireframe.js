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

async function testWireframeValidation() {
  const b2 = await Box2D();
  const wire = Wireframe.createWireframe(b2);
  const world = b2.createWorld({ gravity: { x: 0, y: 0 } });
  const ctx = createRecordingContext();

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

  b2.destroyWorld(world);
}

(async function main() {
  await testWireframeFactoriesAndTransforms();
  await testWireframeValidation();
  console.log("Box2D v3 wireframe tests passed");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
