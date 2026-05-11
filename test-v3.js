const assert = require("assert");
const Box2D = require("./box2d.v3.js");

function assertFiniteVec2(value, message) {
  assert(Number.isFinite(value.x), `${message}.x should be finite`);
  assert(Number.isFinite(value.y), `${message}.y should be finite`);
}

function assertClose(actual, expected, tolerance, message) {
  assert(
    Math.abs(actual - expected) <= tolerance,
    `${message}: expected ${expected} +/- ${tolerance}, got ${actual}`
  );
}

function assertTransformMatchesPosition(transform, offset, position, message) {
  assertClose(transform[offset], position.x, 0.001, `${message} x`);
  assertClose(transform[offset + 1], position.y, 0.001, `${message} y`);
  assert(Number.isFinite(transform[offset + 2]), `${message} angle should be finite`);
}

function stepWorld(b2, world, count) {
  for (let i = 0; i < count; ++i) {
    b2.step(world, 1 / 60, 4);
  }
}

function testFallingBox(b2) {
  const world = b2.createWorld({ gravity: { x: 0, y: -10 } });
  const ground = b2.createBody(world, {
    type: b2.staticBody,
    position: { x: 0, y: 0 },
  });

  b2.createBoxShape(ground, { hx: 20, hy: 0.5, density: 0 });

  const body = b2.createBody(world, {
    type: b2.dynamicBody,
    position: { x: 0, y: 4 },
  });

  b2.createBoxShape(body, { hx: 0.5, hy: 0.5, density: 1 });
  assert(b2.getBodyMass(body) > 0, "box body should report positive mass");

  stepWorld(b2, world, 120);

  const position = b2.getBodyPosition(body);
  const velocity = b2.getBodyVelocity(body);
  const transform = b2.readBodyTransforms([body]);

  assertFiniteVec2(position, "box position");
  assertFiniteVec2(velocity, "box velocity");
  assert(position.y < 4, "dynamic body should fall");
  assert(position.y > 0.9 && position.y < 1.2, "dynamic body should settle on the ground");
  assertTransformMatchesPosition(transform, 0, position, "box transform");

  b2.destroyWorld(world);
  return position;
}

function testCoreCarShapes(b2) {
  const world = b2.createWorld({ gravity: { x: 0, y: -10 } });
  const terrain = b2.createBody(world, {
    type: b2.staticBody,
    position: { x: 0, y: 0 },
  });

  const leftTerrain = b2.createSegmentShape(terrain, {
    p1: { x: -12, y: 0 },
    p2: { x: 0, y: 0.15 },
  });
  const rightTerrain = b2.createSegmentShape(terrain, {
    p1: { x: 0, y: 0.15 },
    p2: { x: 12, y: 0 },
  });

  assert.strictEqual(leftTerrain.kind, "shape");
  assert.strictEqual(rightTerrain.kind, "shape");

  const chassis = b2.createBody(world, {
    type: b2.dynamicBody,
    position: { x: 0, y: 2.8 },
  });
  const chassisShape = b2.createPolygonShape(chassis, {
    vertices: [
      { x: -1.4, y: -0.35 },
      { x: 1.2, y: -0.35 },
      { x: 1.45, y: 0.15 },
      { x: -0.7, y: 0.45 },
    ],
    density: 1.2,
    friction: 0.7,
    groupIndex: -1,
  });

  assert.strictEqual(chassisShape.kind, "shape");
  assert(b2.getBodyMass(chassis) > 0, "polygon chassis should report positive mass");

  const wheelA = b2.createBody(world, {
    type: b2.dynamicBody,
    position: { x: -0.85, y: 2.15 },
  });
  const wheelB = b2.createBody(world, {
    type: b2.dynamicBody,
    position: { x: 0.85, y: 2.15 },
  });

  const wheelShapeA = b2.createCircleShape(wheelA, {
    radius: 0.35,
    density: 1,
    friction: 1,
    groupIndex: -1,
  });
  const wheelShapeB = b2.createCircleShape(wheelB, {
    radius: 0.35,
    density: 1,
    friction: 1,
    groupIndex: -1,
  });

  assert.strictEqual(wheelShapeA.kind, "shape");
  assert.strictEqual(wheelShapeB.kind, "shape");
  assert(b2.getBodyMass(wheelA) > 0, "first wheel should report positive mass");
  assert(b2.getBodyMass(wheelB) > 0, "second wheel should report positive mass");

  const jointA = b2.createRevoluteJoint(world, chassis, wheelA, {
    anchor: { x: -0.85, y: 2.15 },
    enableMotor: true,
    motorSpeed: -8,
    maxMotorTorque: 25,
    collideConnected: false,
  });
  const jointB = b2.createRevoluteJoint(world, chassis, wheelB, {
    anchor: { x: 0.85, y: 2.15 },
    enableMotor: true,
    motorSpeed: -8,
    maxMotorTorque: 25,
    collideConnected: false,
  });

  assert.strictEqual(jointA.kind, "joint");
  assert.strictEqual(jointB.kind, "joint");
  b2.setRevoluteJointMotor(jointA, { motorSpeed: -10, maxMotorTorque: 30 });
  b2.setRevoluteJointMotor(jointB, { motorSpeed: -10, maxMotorTorque: 30 });

  const initialChassisPosition = b2.getBodyPosition(chassis);
  const initialWheelVelocity = b2.getBodyVelocity(wheelA);
  assertFiniteVec2(initialChassisPosition, "initial chassis position");
  assertFiniteVec2(initialWheelVelocity, "initial wheel velocity");

  stepWorld(b2, world, 180);

  const chassisPosition = b2.getBodyPosition(chassis);
  const wheelAPosition = b2.getBodyPosition(wheelA);
  const wheelBPosition = b2.getBodyPosition(wheelB);
  const chassisVelocity = b2.getBodyVelocity(chassis);
  const transforms = b2.readBodyTransforms([chassis, wheelA, wheelB], new Float32Array(9));

  assertFiniteVec2(chassisPosition, "chassis position");
  assertFiniteVec2(wheelAPosition, "first wheel position");
  assertFiniteVec2(wheelBPosition, "second wheel position");
  assertFiniteVec2(chassisVelocity, "chassis velocity");
  assert(chassisPosition.y < initialChassisPosition.y, "chassis should respond to gravity");
  assert(wheelAPosition.y > 0.2, "first wheel should stay above the terrain");
  assert(wheelBPosition.y > 0.2, "second wheel should stay above the terrain");
  assertTransformMatchesPosition(transforms, 0, chassisPosition, "chassis transform");
  assertTransformMatchesPosition(transforms, 3, wheelAPosition, "first wheel transform");
  assertTransformMatchesPosition(transforms, 6, wheelBPosition, "second wheel transform");

  b2.destroyWorld(world);
  return chassisPosition;
}

function testDistanceAndRevoluteJointFeatures(b2) {
  const world = b2.createWorld({ gravity: { x: 0, y: 0 } });
  const ground = b2.createBody(world, { type: b2.staticBody, position: { x: 0, y: 0 } });
  const bodyA = b2.createBody(world, { type: b2.dynamicBody, position: { x: 0, y: 0 } });
  const bodyB = b2.createBody(world, { type: b2.dynamicBody, position: { x: 2, y: 0 } });
  const pendulum = b2.createBody(world, { type: b2.dynamicBody, position: { x: 0, y: -2 } });

  b2.createCircleShape(bodyA, { radius: 0.2, density: 1 });
  b2.createCircleShape(bodyB, { radius: 0.2, density: 1 });
  b2.createBoxShape(pendulum, { hx: 0.2, hy: 0.8, density: 1 });

  const distance = b2.createDistanceJoint(world, bodyA, bodyB, {
    anchorA: { x: 0, y: 0 },
    anchorB: { x: 2, y: 0 },
    enableSpring: true,
    hertz: 4,
    dampingRatio: 0.6,
    springForceRange: { lower: -10, upper: 20 },
    enableLimit: true,
    lengthRange: { min: 1.5, max: 2.5 },
    enableMotor: true,
    motorSpeed: 0.25,
    maxMotorForce: 12,
    constraintHertz: 30,
    constraintDampingRatio: 1.5,
    forceThreshold: 100,
    torqueThreshold: 50,
  });

  assert.strictEqual(distance.kind, "joint");
  assert.strictEqual(b2.getJointType(distance), b2.distanceJoint);
  assert(b2.isDistanceJointSpringEnabled(distance), "distance spring should be enabled");
  assert(b2.isDistanceJointLimitEnabled(distance), "distance limit should be enabled");
  assert(b2.isDistanceJointMotorEnabled(distance), "distance motor should be enabled");
  assertClose(b2.getDistanceJointLength(distance), 2, 0.01, "distance length");
  assertClose(b2.getDistanceJointSpringHertz(distance), 4, 0.001, "distance spring hertz");
  assertClose(b2.getDistanceJointSpringDampingRatio(distance), 0.6, 0.001, "distance damping ratio");
  assertClose(b2.getDistanceJointMinLength(distance), 1.5, 0.001, "distance min length");
  assertClose(b2.getDistanceJointMaxLength(distance), 2.5, 0.001, "distance max length");
  assertClose(b2.getDistanceJointMotorSpeed(distance), 0.25, 0.001, "distance motor speed");
  assertClose(b2.getDistanceJointMaxMotorForce(distance), 12, 0.001, "distance max motor force");

  b2.setDistanceJointLength(distance, 2.1);
  b2.setDistanceJointSpringForceRange(distance, -5, 15);
  b2.setDistanceJointSpringHertz(distance, 5);
  b2.setDistanceJointSpringDampingRatio(distance, 0.7);
  b2.setDistanceJointLengthRange(distance, 1.75, 2.25);
  b2.setDistanceJointMotorSpeed(distance, -0.5);
  b2.setDistanceJointMaxMotorForce(distance, 18);
  b2.enableDistanceJointMotor(distance, false);
  b2.enableDistanceJointMotor(distance, true);

  const springForceRange = b2.getDistanceJointSpringForceRange(distance);
  assertClose(b2.getDistanceJointLength(distance), 2.1, 0.001, "updated distance length");
  assertClose(springForceRange.lower, -5, 0.001, "distance lower spring force");
  assertClose(springForceRange.upper, 15, 0.001, "distance upper spring force");
  assertClose(b2.getDistanceJointSpringHertz(distance), 5, 0.001, "updated distance spring hertz");
  assertClose(b2.getDistanceJointSpringDampingRatio(distance), 0.7, 0.001, "updated distance damping ratio");
  assertClose(b2.getDistanceJointMinLength(distance), 1.75, 0.001, "updated distance min length");
  assertClose(b2.getDistanceJointMaxLength(distance), 2.25, 0.001, "updated distance max length");
  assertClose(b2.getDistanceJointMotorSpeed(distance), -0.5, 0.001, "updated distance motor speed");
  assertClose(b2.getDistanceJointMaxMotorForce(distance), 18, 0.001, "updated distance max motor force");

  const revolute = b2.createRevoluteJoint(world, ground, pendulum, {
    anchor: { x: 0, y: -1.2 },
    localAngleA: Math.PI / 2,
    enableSpring: true,
    targetAngle: 0.2,
    hertz: 3,
    dampingRatio: 0.8,
    enableLimit: true,
    lowerAngle: -0.5,
    upperAngle: 0.5,
    enableMotor: true,
    motorSpeed: 1.2,
    maxMotorTorque: 25,
    collideConnected: true,
  });

  assert.strictEqual(revolute.kind, "joint");
  assert.strictEqual(b2.getJointType(revolute), b2.revoluteJoint);
  assert(b2.isRevoluteJointSpringEnabled(revolute), "revolute spring should be enabled");
  assert(b2.isRevoluteJointLimitEnabled(revolute), "revolute limit should be enabled");
  assert(b2.isRevoluteJointMotorEnabled(revolute), "revolute motor should be enabled");
  assert(b2.getJointCollideConnected(revolute), "revolute collideConnected should be enabled");
  assertClose(b2.getRevoluteJointSpringHertz(revolute), 3, 0.001, "revolute spring hertz");
  assertClose(b2.getRevoluteJointSpringDampingRatio(revolute), 0.8, 0.001, "revolute damping ratio");
  assertClose(b2.getRevoluteJointTargetAngle(revolute), 0.2, 0.001, "revolute target angle");
  assertClose(b2.getRevoluteJointLowerLimit(revolute), -0.5, 0.001, "revolute lower limit");
  assertClose(b2.getRevoluteJointUpperLimit(revolute), 0.5, 0.001, "revolute upper limit");
  assertClose(b2.getRevoluteJointMotorSpeed(revolute), 1.2, 0.001, "revolute motor speed");
  assertClose(b2.getRevoluteJointMaxMotorTorque(revolute), 25, 0.001, "revolute max motor torque");

  b2.setRevoluteJointSpringHertz(revolute, 6);
  b2.setRevoluteJointSpringDampingRatio(revolute, 0.9);
  b2.setRevoluteJointTargetAngle(revolute, -0.1);
  b2.setRevoluteJointLimits(revolute, -0.25, 0.35);
  b2.setRevoluteJointMotorSpeed(revolute, -2);
  b2.setRevoluteJointMaxMotorTorque(revolute, 30);
  b2.setRevoluteJointMotor(revolute, { enabled: true, motorSpeed: 2, maxMotorTorque: 35 });
  b2.setJointConstraintTuning(revolute, { hertz: 20, dampingRatio: 1.25 });
  b2.setJointForceThreshold(revolute, 123);
  b2.setJointTorqueThreshold(revolute, 45);
  b2.setJointLocalFrameA(revolute, { position: { x: 0, y: -1.2 }, angle: Math.PI / 4 });
  b2.setJointLocalFrameB(revolute, { position: { x: 0, y: 0.8 }, angle: 0 });
  b2.wakeJointBodies(revolute);

  const tuning = b2.getJointConstraintTuning(revolute);
  const frameA = b2.getJointLocalFrameA(revolute);
  assertClose(b2.getRevoluteJointSpringHertz(revolute), 6, 0.001, "updated revolute spring hertz");
  assertClose(b2.getRevoluteJointSpringDampingRatio(revolute), 0.9, 0.001, "updated revolute damping ratio");
  assertClose(b2.getRevoluteJointTargetAngle(revolute), -0.1, 0.001, "updated revolute target angle");
  assertClose(b2.getRevoluteJointLowerLimit(revolute), -0.25, 0.001, "updated revolute lower limit");
  assertClose(b2.getRevoluteJointUpperLimit(revolute), 0.35, 0.001, "updated revolute upper limit");
  assertClose(b2.getRevoluteJointMotorSpeed(revolute), 2, 0.001, "updated revolute motor speed");
  assertClose(b2.getRevoluteJointMaxMotorTorque(revolute), 35, 0.001, "updated revolute max motor torque");
  assertClose(tuning.hertz, 20, 0.001, "joint constraint hertz");
  assertClose(tuning.dampingRatio, 1.25, 0.001, "joint constraint damping ratio");
  assertClose(b2.getJointForceThreshold(revolute), 123, 0.001, "joint force threshold");
  assertClose(b2.getJointTorqueThreshold(revolute), 45, 0.001, "joint torque threshold");
  assertClose(frameA.angle, Math.PI / 4, 0.001, "joint frame angle");

  stepWorld(b2, world, 10);

  assert(Number.isFinite(b2.getDistanceJointCurrentLength(distance)), "distance current length should be finite");
  assert(Number.isFinite(b2.getDistanceJointMotorForce(distance)), "distance motor force should be finite");
  assert(Number.isFinite(b2.getRevoluteJointAngle(revolute)), "revolute angle should be finite");
  assert(Number.isFinite(b2.getRevoluteJointMotorTorque(revolute)), "revolute motor torque should be finite");
  assertFiniteVec2(b2.getJointConstraintForce(distance), "distance constraint force");
  assert(Number.isFinite(b2.getJointConstraintTorque(revolute)), "revolute constraint torque should be finite");
  assert(Number.isFinite(b2.getJointLinearSeparation(revolute)), "revolute linear separation should be finite");
  assert(Number.isFinite(b2.getJointAngularSeparation(revolute)), "revolute angular separation should be finite");

  b2.destroyJoint(distance);
  b2.destroyJoint(revolute);
  b2.destroyWorld(world);
}

(async function main() {
  const b2 = await Box2D();

  const boxPosition = testFallingBox(b2);
  const chassisPosition = testCoreCarShapes(b2);
  testDistanceAndRevoluteJointFeatures(b2);

  console.log(
    `Box2D v3 tests passed: box at (${boxPosition.x.toFixed(3)}, ${boxPosition.y.toFixed(3)}), ` +
      `chassis at (${chassisPosition.x.toFixed(3)}, ${chassisPosition.y.toFixed(3)})`
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
