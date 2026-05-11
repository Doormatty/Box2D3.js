const assert = require("assert");
const Box2D = require("./box2d.v3.js");
const PackageBox2D = require("box2d-v3-wasm");

assert.strictEqual(PackageBox2D, Box2D, "package self-reference should resolve the main wrapper");

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

function assertMaterial(actual, expected, message) {
  assertClose(actual.friction, expected.friction, 0.001, `${message} friction`);
  assertClose(actual.restitution, expected.restitution, 0.001, `${message} restitution`);
  assertClose(actual.rollingResistance, expected.rollingResistance, 0.001, `${message} rolling resistance`);
  assertClose(actual.tangentSpeed, expected.tangentSpeed, 0.001, `${message} tangent speed`);
  assert.strictEqual(actual.userMaterialId, expected.userMaterialId, `${message} user material`);
  assert.strictEqual(actual.customColor, expected.customColor, `${message} custom color`);
}

function assertTransformMatchesPosition(transform, offset, position, message) {
  assertClose(transform[offset], position.x, 0.001, `${message} x`);
  assertClose(transform[offset + 1], position.y, 0.001, `${message} y`);
  assert(Number.isFinite(transform[offset + 2]), `${message} angle should be finite`);
}

function sameHandle(a, b) {
  return a && b && a.kind === b.kind && a.handle === b.handle;
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

function testBodyControlsAndShapeQueries(b2) {
  const world = b2.createWorld({ gravity: { x: 0, y: 0 } });
  assertClose(b2.getWorldGravity(world).y, 0, 0.001, "initial gravity");
  b2.setWorldGravity(world, { x: 0, y: -2 });
  assertClose(b2.getWorldGravity(world).y, -2, 0.001, "updated gravity");

  const body = b2.createBody(world, {
    type: b2.dynamicBody,
    position: { x: 0, y: 0 },
  });
  const shape = b2.createBoxShape(body, {
    hx: 0.5,
    hy: 0.5,
    density: 2,
    friction: 0.25,
    restitution: 0.4,
    filter: { categoryBits: 0x0002, maskBits: 0x0004, groupIndex: -3 },
  });

  assert.strictEqual(b2.getBodyType(body), b2.dynamicBody);
  assert.strictEqual(b2.getShapeType(shape), b2.polygonShape);
  assertClose(b2.getShapeDensity(shape), 2, 0.001, "shape density");
  assertClose(b2.getShapeFriction(shape), 0.25, 0.001, "shape friction");
  assertClose(b2.getShapeRestitution(shape), 0.4, 0.001, "shape restitution");
  assert.deepStrictEqual(b2.getShapeFilter(shape), { categoryBits: 2, maskBits: 4, groupIndex: -3 });

  b2.setShapeDensity(shape, 3);
  b2.setShapeFriction(shape, 0.8);
  b2.setShapeRestitution(shape, 0.1);
  b2.setShapeFilter(shape, { categoryBits: 0x0008, maskBits: 0xffffffff, groupIndex: 0 });
  assertClose(b2.getShapeDensity(shape), 3, 0.001, "updated shape density");
  assertClose(b2.getShapeFriction(shape), 0.8, 0.001, "updated shape friction");
  assertClose(b2.getShapeRestitution(shape), 0.1, 0.001, "updated shape restitution");
  assert.strictEqual(b2.getShapeFilter(shape).categoryBits, 8);

  b2.setBodyTransform(body, { position: { x: 2, y: 3 }, angle: 0.25 });
  const transformed = b2.getBodyTransform(body);
  assertClose(transformed.position.x, 2, 0.001, "teleported body x");
  assertClose(transformed.position.y, 3, 0.001, "teleported body y");
  assert(b2.testShapePoint(shape, { x: 2, y: 3 }), "shape should contain its body origin");

  const aabb = b2.getShapeAABB(shape);
  assert(aabb.lowerBound.x < 2 && aabb.upperBound.x > 2, "shape AABB should contain x position");
  assert(aabb.lowerBound.y < 3 && aabb.upperBound.y > 3, "shape AABB should contain y position");

  const overlap = b2.overlapAABB(world, {
    lowerBound: { x: 1, y: 2 },
    upperBound: { x: 3, y: 4 },
    maskBits: 0x0008,
  });
  assert(overlap.some((item) => sameHandle(item, shape)), "overlap query should return the box shape");

  const ray = b2.castRayClosest(world, {
    origin: { x: -1, y: 3 },
    translation: { x: 5, y: 0 },
    maskBits: 0x0008,
  });
  assert(ray && sameHandle(ray.shape, shape), "ray cast should hit the box shape");
  assert(ray.fraction > 0 && ray.fraction < 1, "ray fraction should be clipped to the hit");

  const shapeRay = b2.rayCastShape(shape, {
    origin: { x: -1, y: 3 },
    translation: { x: 5, y: 0 },
  });
  assert(shapeRay && shapeRay.fraction > 0 && shapeRay.fraction < 1, "shape ray cast should hit");

  b2.setBodyVelocity(body, { linearVelocity: { x: 1, y: 0 }, angularVelocity: 2 });
  assertClose(b2.getBodyVelocity(body).x, 1, 0.001, "set body linear velocity");
  assertClose(b2.getBodyAngularVelocity(body), 2, 0.001, "set body angular velocity");
  b2.applyLinearImpulseToCenter(body, { x: 1, y: 0 });
  b2.applyAngularImpulse(body, 0.1);
  b2.applyForceToCenter(body, { x: 0, y: 1 });
  b2.applyTorque(body, 0.1);
  stepWorld(b2, world, 1);
  assert(b2.getBodyVelocity(body).x > 1, "linear impulse should increase velocity");

  b2.setBodyBullet(body, true);
  assert(b2.isBodyBullet(body), "body bullet flag should be enabled");
  b2.setBodyGravityScale(body, 0.5);
  assertClose(b2.getBodyGravityScale(body), 0.5, 0.001, "body gravity scale");
  b2.setBodyDamping(body, { linearDamping: 0.2, angularDamping: 0.3 });
  assertClose(b2.getBodyDamping(body).linearDamping, 0.2, 0.001, "linear damping");
  assertClose(b2.getBodyDamping(body).angularDamping, 0.3, 0.001, "angular damping");

  b2.setBodyEnabled(body, false);
  assert(!b2.isBodyEnabled(body), "body should be disabled");
  b2.setBodyEnabled(body, true);
  assert(b2.isBodyEnabled(body), "body should be re-enabled");

  b2.destroyShape(shape);
  b2.destroyWorld(world);
}

function testWrapperInputValidation(b2) {
  const world = b2.createWorld({ gravity: { x: 0, y: 0 } });
  const body = b2.createBody(world, { type: b2.dynamicBody, position: { x: 0, y: 0 } });
  const shape = b2.createCircleShape(body, { radius: 0.5, density: 1 });

  assert.throws(
    () => b2.createWorld({ gravity: { x: Number.NaN, y: 0 } }),
    /world\.gravity\.x/,
    "invalid gravity should be rejected before reaching wasm"
  );
  assert.throws(
    () => b2.createBody(world, { type: 99 }),
    /body\.type/,
    "invalid body type should be rejected"
  );
  assert.throws(
    () => b2.createBoxShape(body, { hx: 1 }),
    /box\.hy/,
    "missing box dimension should be rejected"
  );
  assert.throws(
    () => b2.createCircleShape(body, { radius: 0 }),
    /circle\.radius/,
    "non-positive circle radius should be rejected"
  );
  assert.throws(
    () => b2.createSegmentShape(body, { p1: { x: 0, y: 0 }, p2: { x: 0, y: 0 } }),
    /segment endpoints/,
    "zero-length segment should be rejected"
  );
  assert.throws(
    () => b2.createPolygonShape(body, { vertices: [{ x: 0, y: 0 }, { x: 1, y: 0 }] }),
    /polygon requires at least 3 vertices/,
    "undersized polygon should be rejected"
  );
  assert.throws(
    () =>
      b2.createPolygonShape(body, {
        vertices: [
          { x: 1, y: 0 },
          { x: 0.7, y: 0.7 },
          { x: 0, y: 1 },
          { x: -0.7, y: 0.7 },
          { x: -1, y: 0 },
          { x: -0.7, y: -0.7 },
          { x: 0, y: -1 },
          { x: 0.7, y: -0.7 },
          { x: 1.1, y: 0 },
        ],
      }),
    /polygon supports at most 8 vertices/,
    "oversized polygon should be rejected"
  );
  assert.throws(
    () => b2.createChain(body, { vertices: [0, 0, 1, 0, 2, 0] }),
    /chain requires at least 4 vertices/,
    "undersized chain should be rejected"
  );
  assert.throws(
    () => b2.setShapeFriction(shape, -1),
    /shape\.friction/,
    "negative material values should be rejected"
  );
  assert.throws(
    () => b2.overlapAABB(world, { capacity: 0 }),
    /overlapAABB\.capacity/,
    "invalid query capacity should be rejected"
  );
  assert.throws(
    () => b2.castRayClosest(world, { origin: { x: Number.NaN, y: 0 } }),
    /ray\.origin\.x/,
    "invalid ray input should be rejected"
  );

  const emptyTransforms = [];
  assert.strictEqual(b2.readBodyTransforms([], emptyTransforms), emptyTransforms);

  const transformArray = new Array(3);
  assert.strictEqual(b2.readBodyTransforms([body], transformArray), transformArray);
  assert(Number.isFinite(transformArray[0]), "plain array transform x should be populated");
  assert(Number.isFinite(transformArray[1]), "plain array transform y should be populated");
  assert(Number.isFinite(transformArray[2]), "plain array transform angle should be populated");

  b2.destroyWorld(world);
}

function testSurfaceMaterialsWorldTuningAndMixing(b2) {
  const world = b2.createWorld({ gravity: { x: 0, y: -10 } });

  b2.enableWorldSleeping(world, false);
  assert(!b2.isWorldSleepingEnabled(world), "world sleeping should be disabled");
  b2.enableWorldSleeping(world, true);
  assert(b2.isWorldSleepingEnabled(world), "world sleeping should be enabled");
  b2.enableWorldContinuous(world, false);
  assert(!b2.isWorldContinuousEnabled(world), "continuous collision should be disabled");
  b2.enableWorldContinuous(world, true);
  assert(b2.isWorldContinuousEnabled(world), "continuous collision should be enabled");
  b2.enableWorldWarmStarting(world, false);
  assert(!b2.isWorldWarmStartingEnabled(world), "warm starting should be disabled");
  b2.enableWorldWarmStarting(world, true);
  assert(b2.isWorldWarmStartingEnabled(world), "warm starting should be enabled");

  b2.setWorldRestitutionThreshold(world, 0.125);
  b2.setWorldHitEventThreshold(world, 0.75);
  b2.setWorldContactRecycleDistance(world, 0.02);
  b2.setWorldMaximumLinearSpeed(world, 150);
  b2.setWorldContactTuning(world, { hertz: 40, dampingRatio: 8, pushSpeed: 2 });
  assertClose(b2.getWorldRestitutionThreshold(world), 0.125, 0.001, "world restitution threshold");
  assertClose(b2.getWorldHitEventThreshold(world), 0.75, 0.001, "world hit event threshold");
  assertClose(b2.getWorldContactRecycleDistance(world), 0.02, 0.001, "world contact recycle distance");
  assertClose(b2.getWorldMaximumLinearSpeed(world), 150, 0.001, "world maximum linear speed");
  assert(Number.isInteger(b2.getWorldAwakeBodyCount(world)), "awake body count should be an integer");

  const ground = b2.createBody(world, { type: b2.staticBody, position: { x: 0, y: 0 } });
  const groundShape = b2.createBoxShape(ground, {
    hx: 8,
    hy: 0.25,
    density: 0,
    friction: 0.3,
    restitution: 0,
    rollingResistance: 0.05,
    tangentSpeed: 1.25,
    userMaterialId: 101,
    customColor: 0xff336699,
  });

  assertMaterial(
    b2.getShapeSurfaceMaterial(groundShape),
    {
      friction: 0.3,
      restitution: 0,
      rollingResistance: 0.05,
      tangentSpeed: 1.25,
      userMaterialId: 101,
      customColor: 0xff336699,
    },
    "created shape surface material"
  );
  assert.strictEqual(b2.getShapeUserMaterial(groundShape), 101);

  b2.setShapeSurfaceMaterial(groundShape, {
    friction: 0.4,
    restitution: 0.1,
    rollingResistance: 0.2,
    tangentSpeed: -0.5,
    userMaterialId: 102,
    customColor: 0xff224466,
  });
  assertMaterial(
    b2.getShapeSurfaceMaterial(groundShape),
    {
      friction: 0.4,
      restitution: 0.1,
      rollingResistance: 0.2,
      tangentSpeed: -0.5,
      userMaterialId: 102,
      customColor: 0xff224466,
    },
    "updated shape surface material"
  );
  b2.setShapeUserMaterial(groundShape, 101);
  assert.strictEqual(b2.getShapeUserMaterial(groundShape), 101);

  const chain = b2.createChain(ground, {
    vertices: [
      { x: -4, y: 1 },
      { x: -2, y: 1.2 },
      { x: 0, y: 1 },
      { x: 2, y: 1.2 },
    ],
    friction: 0.55,
    restitution: 0.05,
    rollingResistance: 0.03,
    tangentSpeed: 0.75,
    userMaterialId: 303,
    customColor: 0xff112233,
  });
  assert(b2.getChainSurfaceMaterialCount(chain) >= 1, "chain should expose at least one surface material");
  assertMaterial(
    b2.getChainSurfaceMaterial(chain, 0),
    {
      friction: 0.55,
      restitution: 0.05,
      rollingResistance: 0.03,
      tangentSpeed: 0.75,
      userMaterialId: 303,
      customColor: 0xff112233,
    },
    "created chain material"
  );
  b2.setChainSurfaceMaterial(chain, 0, {
    friction: 0.65,
    restitution: 0.15,
    rollingResistance: 0.08,
    tangentSpeed: -0.25,
    userMaterialId: 304,
    customColor: 0xff445566,
  });
  assertMaterial(
    b2.getChainSurfaceMaterial(chain, 0),
    {
      friction: 0.65,
      restitution: 0.15,
      rollingResistance: 0.08,
      tangentSpeed: -0.25,
      userMaterialId: 304,
      customColor: 0xff445566,
    },
    "updated chain material"
  );

  b2.clearFrictionMixRules();
  b2.clearRestitutionMixRules();
  assert(b2.addFrictionMixRule(101, 202, 0.9), "friction mix rule should be accepted");
  assert(b2.addRestitutionMixRule(101, 202, 0.9), "restitution mix rule should be accepted");
  b2.enableWorldFrictionCallback(world, true);
  b2.enableWorldRestitutionCallback(world, true);

  const ball = b2.createBody(world, { type: b2.dynamicBody, position: { x: 0, y: 4 } });
  b2.createCircleShape(ball, {
    radius: 0.25,
    density: 1,
    friction: 0,
    restitution: 0,
    userMaterialId: 202,
  });

  let sawDownwardApproach = false;
  let sawCallbackBounce = false;
  for (let i = 0; i < 180; ++i) {
    b2.step(world, 1 / 60, 4);
    const velocity = b2.getBodyVelocity(ball);
    const position = b2.getBodyPosition(ball);
    sawDownwardApproach = sawDownwardApproach || velocity.y < -1;
    sawCallbackBounce = sawCallbackBounce || (sawDownwardApproach && position.y < 1.1 && velocity.y > 1);
    if (sawCallbackBounce) {
      break;
    }
  }
  assert(sawCallbackBounce, "material restitution callback should make the zero-restitution ball bounce");

  b2.enableWorldFrictionCallback(world, false);
  b2.enableWorldRestitutionCallback(world, false);
  b2.clearFrictionMixRules();
  b2.clearRestitutionMixRules();
  b2.destroyWorld(world);
}

function testWorldEvents(b2) {
  const world = b2.createWorld({ gravity: { x: 0, y: -10 } });
  const ground = b2.createBody(world, { type: b2.staticBody, position: { x: 0, y: 0 } });
  const groundShape = b2.createBoxShape(ground, {
    hx: 10,
    hy: 0.5,
    density: 0,
    enableContactEvents: true,
    enableHitEvents: true,
  });
  const falling = b2.createBody(world, { type: b2.dynamicBody, position: { x: 0, y: 6 } });
  const fallingShape = b2.createCircleShape(falling, {
    radius: 0.35,
    density: 1,
    enableContactEvents: true,
    enableHitEvents: true,
  });

  let sawBodyMove = false;
  let sawContactBegin = false;
  let sawHit = false;
  for (let i = 0; i < 240; ++i) {
    b2.step(world, 1 / 60, 4);
    sawBodyMove = sawBodyMove || b2.getBodyEvents(world).some((event) => sameHandle(event.body, falling));
    const contacts = b2.getContactEvents(world);
    sawContactBegin =
      sawContactBegin ||
      contacts.begin.some(
        (event) =>
          (sameHandle(event.shapeA, groundShape) && sameHandle(event.shapeB, fallingShape)) ||
          (sameHandle(event.shapeA, fallingShape) && sameHandle(event.shapeB, groundShape))
      );
    sawHit = sawHit || contacts.hit.some((event) => event.approachSpeed > 0);
    if (sawBodyMove && sawContactBegin && sawHit) {
      break;
    }
  }

  assert(sawBodyMove, "body move events should report simulated motion");
  assert(sawContactBegin, "contact begin events should report collision pairs");
  assert(sawHit, "contact hit events should report impact speed");
  b2.destroyWorld(world);

  const sensorWorld = b2.createWorld({ gravity: { x: 0, y: 0 } });
  const sensorBody = b2.createBody(sensorWorld, { type: b2.staticBody, position: { x: 0, y: 0 } });
  const sensorShape = b2.createCircleShape(sensorBody, {
    radius: 1.5,
    density: 0,
    isSensor: true,
    enableSensorEvents: true,
  });
  assert(b2.isShapeSensor(sensorShape), "sensor shape should report sensor status");
  assert(b2.areShapeSensorEventsEnabled(sensorShape), "sensor events should be enabled");

  const visitor = b2.createBody(sensorWorld, { type: b2.dynamicBody, position: { x: -3, y: 0 } });
  const visitorShape = b2.createCircleShape(visitor, {
    radius: 0.25,
    density: 1,
    enableSensorEvents: true,
  });
  b2.setBodyLinearVelocity(visitor, { x: 2, y: 0 });

  let sawSensorBegin = false;
  let sawSensorEnd = false;
  for (let i = 0; i < 240; ++i) {
    b2.step(sensorWorld, 1 / 60, 4);
    const events = b2.getSensorEvents(sensorWorld);
    sawSensorBegin =
      sawSensorBegin ||
      events.begin.some((event) => sameHandle(event.sensor, sensorShape) && sameHandle(event.visitor, visitorShape));
    sawSensorEnd =
      sawSensorEnd ||
      events.end.some((event) => sameHandle(event.sensor, sensorShape) && sameHandle(event.visitor, visitorShape));
    if (sawSensorBegin && sawSensorEnd) {
      break;
    }
  }

  assert(sawSensorBegin, "sensor begin events should report overlap entry");
  assert(sawSensorEnd, "sensor end events should report overlap exit");
  b2.destroyWorld(sensorWorld);
}

function testP1WrapperConcepts(b2) {
  const world = b2.createWorld({ gravity: { x: 0, y: -10 } });
  const ground = b2.createBody(world, { type: b2.staticBody, position: { x: 0, y: 0 } });
  const chain = b2.createChain(ground, {
    vertices: [
      { x: -4, y: 0 },
      { x: 4, y: 0 },
      { x: 4, y: 3 },
      { x: -4, y: 3 },
    ],
    isLoop: true,
    friction: 0.8,
  });
  assert.strictEqual(chain.kind, "chain");
  assert.strictEqual(b2.getChainSegmentCount(chain), 4, "loop chain should have four segments");
  const segments = b2.getChainSegments(chain);
  assert.strictEqual(segments.length, 4, "chain segment handles should be returned");
  assert(segments.every((shape) => shape && shape.kind === "shape"), "chain segments should be shape handles");
  assert.strictEqual(b2.getShapeType(segments[0]), b2.chainSegmentShape);

  const capsuleBody = b2.createBody(world, { type: b2.dynamicBody, position: { x: 0, y: 4 } });
  const capsule = b2.createCapsuleShape(capsuleBody, {
    center1: { x: -0.4, y: 0 },
    center2: { x: 0.4, y: 0 },
    radius: 0.25,
    density: 1,
    friction: 0.5,
  });
  assert.strictEqual(capsule.kind, "shape");
  assert.strictEqual(b2.getShapeType(capsule), b2.capsuleShape);
  assert(b2.getBodyMass(capsuleBody) > 0, "capsule should contribute body mass");

  const chassis = b2.createBody(world, { type: b2.dynamicBody, position: { x: 0, y: 6 } });
  const wheel = b2.createBody(world, { type: b2.dynamicBody, position: { x: 0, y: 5.2 } });
  b2.createBoxShape(chassis, { hx: 1, hy: 0.25, density: 1, groupIndex: -7 });
  b2.createCircleShape(wheel, { radius: 0.35, density: 1, groupIndex: -7 });

  const wheelJoint = b2.createWheelJoint(world, chassis, wheel, {
    anchor: { x: 0, y: 5.2 },
    axis: { x: 0, y: 1 },
    enableSpring: true,
    hertz: 4,
    dampingRatio: 0.7,
    enableLimit: true,
    lowerTranslation: -0.4,
    upperTranslation: 0.2,
    enableMotor: true,
    motorSpeed: 2,
    maxMotorTorque: 12,
    forceThreshold: 0.001,
  });
  assert.strictEqual(b2.getJointType(wheelJoint), b2.wheelJoint);
  assert(b2.isWheelJointSpringEnabled(wheelJoint), "wheel spring should be enabled");
  assert(b2.isWheelJointLimitEnabled(wheelJoint), "wheel limit should be enabled");
  assert(b2.isWheelJointMotorEnabled(wheelJoint), "wheel motor should be enabled");
  assertClose(b2.getWheelJointSpringHertz(wheelJoint), 4, 0.001, "wheel hertz");
  assertClose(b2.getWheelJointSpringDampingRatio(wheelJoint), 0.7, 0.001, "wheel damping");
  assertClose(b2.getWheelJointLowerLimit(wheelJoint), -0.4, 0.001, "wheel lower limit");
  assertClose(b2.getWheelJointUpperLimit(wheelJoint), 0.2, 0.001, "wheel upper limit");
  assertClose(b2.getWheelJointMotorSpeed(wheelJoint), 2, 0.001, "wheel motor speed");
  assertClose(b2.getWheelJointMaxMotorTorque(wheelJoint), 12, 0.001, "wheel max motor torque");
  b2.setWheelJointSpringHertz(wheelJoint, 5);
  b2.setWheelJointSpringDampingRatio(wheelJoint, 0.8);
  b2.setWheelJointLimits(wheelJoint, -0.3, 0.3);
  b2.setWheelJointMotorSpeed(wheelJoint, 3);
  b2.setWheelJointMaxMotorTorque(wheelJoint, 15);
  assertClose(b2.getWheelJointSpringHertz(wheelJoint), 5, 0.001, "updated wheel hertz");
  assertClose(b2.getWheelJointSpringDampingRatio(wheelJoint), 0.8, 0.001, "updated wheel damping");
  assertClose(b2.getWheelJointMotorSpeed(wheelJoint), 3, 0.001, "updated wheel motor speed");
  assertClose(b2.getWheelJointMaxMotorTorque(wheelJoint), 15, 0.001, "updated wheel max motor torque");

  const sliderBase = b2.createBody(world, { type: b2.staticBody, position: { x: 3, y: 3 } });
  const slider = b2.createBody(world, { type: b2.dynamicBody, position: { x: 3, y: 3 } });
  b2.createBoxShape(slider, { hx: 0.2, hy: 0.2, density: 1 });
  const prismatic = b2.createPrismaticJoint(world, sliderBase, slider, {
    anchor: { x: 3, y: 3 },
    axis: { x: 1, y: 0 },
    enableSpring: true,
    hertz: 6,
    dampingRatio: 0.9,
    targetTranslation: 0.1,
    enableLimit: true,
    lowerTranslation: -0.5,
    upperTranslation: 0.5,
    enableMotor: true,
    motorSpeed: 0.4,
    maxMotorForce: 20,
  });
  assert.strictEqual(b2.getJointType(prismatic), b2.prismaticJoint);
  assert(b2.isPrismaticJointSpringEnabled(prismatic), "prismatic spring should be enabled");
  assert(b2.isPrismaticJointLimitEnabled(prismatic), "prismatic limit should be enabled");
  assert(b2.isPrismaticJointMotorEnabled(prismatic), "prismatic motor should be enabled");
  assertClose(b2.getPrismaticJointSpringHertz(prismatic), 6, 0.001, "prismatic hertz");
  assertClose(b2.getPrismaticJointSpringDampingRatio(prismatic), 0.9, 0.001, "prismatic damping");
  assertClose(b2.getPrismaticJointTargetTranslation(prismatic), 0.1, 0.001, "prismatic target");
  assertClose(b2.getPrismaticJointLowerLimit(prismatic), -0.5, 0.001, "prismatic lower limit");
  assertClose(b2.getPrismaticJointUpperLimit(prismatic), 0.5, 0.001, "prismatic upper limit");
  assertClose(b2.getPrismaticJointMotorSpeed(prismatic), 0.4, 0.001, "prismatic motor speed");
  assertClose(b2.getPrismaticJointMaxMotorForce(prismatic), 20, 0.001, "prismatic max motor force");
  b2.setPrismaticJointSpringHertz(prismatic, 7);
  b2.setPrismaticJointSpringDampingRatio(prismatic, 0.6);
  b2.setPrismaticJointTargetTranslation(prismatic, -0.1);
  b2.setPrismaticJointLimits(prismatic, -0.4, 0.6);
  b2.setPrismaticJointMotorSpeed(prismatic, -0.3);
  b2.setPrismaticJointMaxMotorForce(prismatic, 25);
  assertClose(b2.getPrismaticJointSpringHertz(prismatic), 7, 0.001, "updated prismatic hertz");
  assertClose(b2.getPrismaticJointSpringDampingRatio(prismatic), 0.6, 0.001, "updated prismatic damping");
  assertClose(b2.getPrismaticJointTargetTranslation(prismatic), -0.1, 0.001, "updated prismatic target");
  assertClose(b2.getPrismaticJointMotorSpeed(prismatic), -0.3, 0.001, "updated prismatic motor speed");
  assert(Number.isFinite(b2.getPrismaticJointTranslation(prismatic)), "prismatic translation should be finite");
  assert(Number.isFinite(b2.getPrismaticJointSpeed(prismatic)), "prismatic speed should be finite");

  const motorA = b2.createBody(world, { type: b2.staticBody, position: { x: -3, y: 3 } });
  const motorB = b2.createBody(world, { type: b2.dynamicBody, position: { x: -2, y: 3 } });
  b2.createCircleShape(motorB, { radius: 0.25, density: 1 });
  const motor = b2.createMotorJoint(world, motorA, motorB, {
    linearVelocity: { x: 0.5, y: 0 },
    angularVelocity: 0.25,
    maxVelocityForce: 10,
    maxVelocityTorque: 4,
    linearHertz: 3,
    linearDampingRatio: 0.7,
    maxSpringForce: 8,
    angularHertz: 2,
    angularDampingRatio: 0.5,
    maxSpringTorque: 6,
  });
  assert.strictEqual(b2.getJointType(motor), b2.motorJoint);
  assertClose(b2.getMotorJointLinearVelocity(motor).x, 0.5, 0.001, "motor linear velocity");
  assertClose(b2.getMotorJointAngularVelocity(motor), 0.25, 0.001, "motor angular velocity");
  assertClose(b2.getMotorJointMaxVelocityForce(motor), 10, 0.001, "motor max velocity force");
  assertClose(b2.getMotorJointMaxVelocityTorque(motor), 4, 0.001, "motor max velocity torque");
  assertClose(b2.getMotorJointLinearHertz(motor), 3, 0.001, "motor linear hertz");
  assertClose(b2.getMotorJointLinearDampingRatio(motor), 0.7, 0.001, "motor linear damping");
  assertClose(b2.getMotorJointMaxSpringForce(motor), 8, 0.001, "motor max spring force");
  assertClose(b2.getMotorJointAngularHertz(motor), 2, 0.001, "motor angular hertz");
  assertClose(b2.getMotorJointAngularDampingRatio(motor), 0.5, 0.001, "motor angular damping");
  assertClose(b2.getMotorJointMaxSpringTorque(motor), 6, 0.001, "motor max spring torque");
  b2.setMotorJointLinearVelocity(motor, { x: -0.25, y: 0.1 });
  b2.setMotorJointAngularVelocity(motor, -0.5);
  b2.setMotorJointMaxVelocityForce(motor, 11);
  b2.setMotorJointMaxVelocityTorque(motor, 5);
  b2.setMotorJointLinearHertz(motor, 4);
  b2.setMotorJointLinearDampingRatio(motor, 0.8);
  b2.setMotorJointMaxSpringForce(motor, 9);
  b2.setMotorJointAngularHertz(motor, 2.5);
  b2.setMotorJointAngularDampingRatio(motor, 0.6);
  b2.setMotorJointMaxSpringTorque(motor, 7);
  assertClose(b2.getMotorJointLinearVelocity(motor).x, -0.25, 0.001, "updated motor linear velocity");
  assertClose(b2.getMotorJointAngularVelocity(motor), -0.5, 0.001, "updated motor angular velocity");
  assertClose(b2.getMotorJointLinearHertz(motor), 4, 0.001, "updated motor linear hertz");
  assertClose(b2.getMotorJointAngularHertz(motor), 2.5, 0.001, "updated motor angular hertz");

  const filteredA = b2.createBody(world, { type: b2.dynamicBody, position: { x: 5, y: 4 } });
  const filteredB = b2.createBody(world, { type: b2.dynamicBody, position: { x: 5.2, y: 4 } });
  b2.createCircleShape(filteredA, { radius: 0.2, density: 1 });
  b2.createCircleShape(filteredB, { radius: 0.2, density: 1 });
  const filter = b2.createFilterJoint(world, filteredA, filteredB);
  assert.strictEqual(b2.getJointType(filter), b2.filterJoint);

  let sawJointEvent = false;
  for (let i = 0; i < 60; ++i) {
    b2.step(world, 1 / 60, 4);
    sawJointEvent = sawJointEvent || b2.getJointEvents(world).some((event) => sameHandle(event.joint, wheelJoint));
    if (sawJointEvent) {
      break;
    }
  }
  assert(sawJointEvent, "joint events should include joints over their force threshold");
  assert(Number.isFinite(b2.getWheelJointMotorTorque(wheelJoint)), "wheel motor torque should be finite");
  assert(Number.isFinite(b2.getPrismaticJointMotorForce(prismatic)), "prismatic motor force should be finite");

  b2.destroyChain(chain);
  b2.destroyWorld(world);
}

(async function main() {
  const b2 = await Box2D();

  const boxPosition = testFallingBox(b2);
  const chassisPosition = testCoreCarShapes(b2);
  testDistanceAndRevoluteJointFeatures(b2);
  testBodyControlsAndShapeQueries(b2);
  testWrapperInputValidation(b2);
  testSurfaceMaterialsWorldTuningAndMixing(b2);
  testWorldEvents(b2);
  testP1WrapperConcepts(b2);

  console.log(
    `Box2D v3 tests passed: box at (${boxPosition.x.toFixed(3)}, ${boxPosition.y.toFixed(3)}), ` +
      `chassis at (${chassisPosition.x.toFixed(3)}, ${chassisPosition.y.toFixed(3)})`
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
