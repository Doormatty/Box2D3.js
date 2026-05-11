import Box2D = require("./box2d.v3");
import Box2DWireframe = require("./box2d.v3.wireframe");

async function smokeTestTypes(): Promise<void> {
  const b2 = await Box2D();
  const world = b2.createWorld({ gravity: { x: 0, y: -10 } });
  const body = b2.createBody(world, {
    type: b2.dynamicBody,
    position: { x: 0, y: 4 },
    angle: 0,
  });

  const shape = b2.createBoxShape(body, {
    hx: 1,
    hy: 1,
    density: 1,
    friction: 0.4,
  });
  const capsule = b2.createCapsuleShape(body, {
    p1: { x: -0.5, y: 0 },
    p2: { x: 0.5, y: 0 },
    radius: 0.2,
    surfaceMaterial: { friction: 0.2, restitution: 0.1, userMaterialId: 12 },
  });
  const polygon = b2.createPolygonShape(body, {
    vertices: new Float32Array([-0.5, -0.5, 0.5, -0.5, 0.5, 0.5, -0.5, 0.5]),
    filter: { categoryBits: 2, maskBits: 4 },
  });

  b2.setBodyType(body, b2.kinematicBody);
  b2.setBodyLinearVelocity(body, { x: 1, y: 0 });
  b2.applyForce(body, { x: 0, y: 1 }, { x: 0, y: 0 }, true);
  b2.enableShapeContactEvents(shape, true);
  b2.enableShapeHitEvents(shape, true);
  b2.enableShapeSensorEvents(shape, true);
  b2.step(world, 1 / 60, 4);

  const position: Box2D.Vec2 = b2.getBodyPosition(body);
  const transformBuffer: Float32Array = b2.readBodyTransforms([body]);
  const queryHits: Box2D.ShapeHandle[] = b2.overlapAABB(world, {
    lowerBound: { x: -2, y: -2 },
    upperBound: { x: 2, y: 6 },
    capacity: 8,
  });
  const ray: Box2D.RayResult | null = b2.castRayClosest(world, {
    origin: { x: -2, y: 4 },
    translation: { x: 4, y: 0 },
    maskBits: 4,
  });
  const shapeRay: Box2D.ShapeRayResult | null = b2.rayCastShape(shape, {
    origin: { x: -2, y: 4 },
    translation: { x: 4, y: 0 },
    maxFraction: 1,
  });
  const manager = Box2DWireframe.createWireframe(b2);
  const drawable = manager.createWireBox(world, {
    body,
    hx: 1,
    hy: 1,
    style: { stroke: "#333", fill: "transparent", lineWidth: 1 },
  });

  const transform: Box2DWireframe.DrawableTransform = manager.getTransform(drawable);
  const hull: Box2D.Vec2[] = Box2DWireframe.convexHull([
    [0, 0],
    [1, 0],
    [0, 1],
  ]);
  const wireCircle = manager.createWireCircle(world, {
    body,
    radius: 0.5,
    style: { stroke: "#333", fill: "#eee", lineWidth: 2 },
  });

  void shape;
  void capsule;
  void polygon;
  void position;
  void transformBuffer;
  void queryHits;
  void ray;
  void shapeRay;
  void transform;
  void hull;
  void wireCircle;
}

void smokeTestTypes;
