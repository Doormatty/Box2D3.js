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

  b2.step(world, 1 / 60, 4);

  const position: Box2D.Vec2 = b2.getBodyPosition(body);
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

  void shape;
  void position;
  void transform;
  void hull;
}

void smokeTestTypes;
