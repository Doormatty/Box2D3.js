const fs = require("fs");
const path = require("path");
const { performance } = require("perf_hooks");

const Box2DV2Factory = require("./build/Box2D_v2.3.1_min.wasm.js");
const Box2DV3 = require("./box2d.v3.js");

const config = {
  repeats: readIntEnv("BENCH_REPEATS", 5),
  warmupSteps: readIntEnv("BENCH_WARMUP_STEPS", 60),
  measuredSteps: readIntEnv("BENCH_MEASURED_STEPS", 300),
  pyramidRows: readIntEnv("BENCH_PYRAMID_ROWS", 26),
  carWorlds: readIntEnv("BENCH_CAR_WORLDS", 24),
  v3SubStepCount: readIntEnv("BENCH_V3_SUBSTEPS", 1),
};

function readIntEnv(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

function summarize(values) {
  const sorted = values.slice().sort((a, b) => a - b);
  const total = values.reduce((sum, value) => sum + value, 0);
  const percentile = (p) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
  return {
    min: sorted[0],
    median: sorted[Math.floor(sorted.length / 2)],
    mean: total / values.length,
    p95: percentile(0.95),
    max: sorted[sorted.length - 1],
  };
}

function formatMs(value) {
  return value.toFixed(3);
}

function measureSteps(step, warmupSteps, measuredSteps) {
  for (let i = 0; i < warmupSteps; ++i) {
    step();
  }

  const start = performance.now();
  for (let i = 0; i < measuredSteps; ++i) {
    step();
  }
  const elapsed = performance.now() - start;

  return {
    totalMs: elapsed,
    msPerStep: elapsed / measuredSteps,
  };
}

async function loadV2() {
  const wasmBinary = fs.readFileSync(path.join(__dirname, "build", "Box2D_v2.3.1_min.wasm.wasm"));
  return Box2DV2Factory({ wasmBinary });
}

function createV2PyramidWorld(Box2D) {
  const gravity = new Box2D.b2Vec2(0, -10);
  const world = new Box2D.b2World(gravity);

  const groundDef = new Box2D.b2BodyDef();
  const ground = world.CreateBody(groundDef);
  const groundShape = new Box2D.b2EdgeShape();
  groundShape.Set(new Box2D.b2Vec2(-40, 0), new Box2D.b2Vec2(40, 0));
  ground.CreateFixture(groundShape, 0);

  const boxShape = new Box2D.b2PolygonShape();
  boxShape.SetAsBox(0.5, 0.5);

  let topBody = null;
  const x = new Box2D.b2Vec2(-7, 0.75);
  const y = new Box2D.b2Vec2();
  const deltaX = new Box2D.b2Vec2(0.5625, 1);
  const deltaY = new Box2D.b2Vec2(1.125, 0);

  for (let i = 0; i < config.pyramidRows; ++i) {
    y.set_x(x.get_x());
    y.set_y(x.get_y());

    for (let j = i; j < config.pyramidRows; ++j) {
      const bodyDef = new Box2D.b2BodyDef();
      bodyDef.set_type(Box2D.b2_dynamicBody);
      bodyDef.set_position(y);

      const body = world.CreateBody(bodyDef);
      body.CreateFixture(boxShape, 5);
      topBody = body;

      y.op_add(deltaY);
    }

    x.op_add(deltaX);
  }

  return {
    step: () => world.Step(1 / 60, 3, 3),
    checksum: () => {
      const position = topBody.GetPosition();
      return position.get_x() + position.get_y();
    },
  };
}

function createV3PyramidWorld(b2) {
  const world = b2.createWorld({ gravity: { x: 0, y: -10 } });
  const ground = b2.createBody(world, { type: b2.staticBody });
  b2.createSegmentShape(ground, { p1: { x: -40, y: 0 }, p2: { x: 40, y: 0 } });

  let topBody = null;
  let x = { x: -7, y: 0.75 };
  const deltaX = { x: 0.5625, y: 1 };
  const deltaY = { x: 1.125, y: 0 };

  for (let i = 0; i < config.pyramidRows; ++i) {
    let y = { x: x.x, y: x.y };

    for (let j = i; j < config.pyramidRows; ++j) {
      const body = b2.createBody(world, {
        type: b2.dynamicBody,
        position: y,
      });
      b2.createBoxShape(body, { hx: 0.5, hy: 0.5, density: 5 });
      topBody = body;
      y = { x: y.x + deltaY.x, y: y.y + deltaY.y };
    }

    x = { x: x.x + deltaX.x, y: x.y + deltaX.y };
  }

  return {
    step: () => b2.step(world, 1 / 60, config.v3SubStepCount),
    checksum: () => {
      const position = b2.getBodyPosition(topBody);
      return position.x + position.y;
    },
    destroy: () => b2.destroyWorld(world),
  };
}

function createV2SpherePyramidWorld(Box2D) {
  const gravity = new Box2D.b2Vec2(0, -10);
  const world = new Box2D.b2World(gravity);

  const groundDef = new Box2D.b2BodyDef();
  const ground = world.CreateBody(groundDef);
  const groundShape = new Box2D.b2EdgeShape();
  groundShape.Set(new Box2D.b2Vec2(-40, 0), new Box2D.b2Vec2(40, 0));
  ground.CreateFixture(groundShape, 0);

  const radius = 0.5;
  const circleShape = new Box2D.b2CircleShape();
  circleShape.set_m_radius(radius);

  let topBody = null;
  const x = new Box2D.b2Vec2(-0.5 * (config.pyramidRows - 1), radius);
  const y = new Box2D.b2Vec2();
  const deltaX = new Box2D.b2Vec2(radius, Math.sqrt(3) * radius);
  const deltaY = new Box2D.b2Vec2(2 * radius, 0);

  for (let i = 0; i < config.pyramidRows; ++i) {
    y.set_x(x.get_x());
    y.set_y(x.get_y());

    for (let j = i; j < config.pyramidRows; ++j) {
      const bodyDef = new Box2D.b2BodyDef();
      bodyDef.set_type(Box2D.b2_dynamicBody);
      bodyDef.set_position(y);

      const body = world.CreateBody(bodyDef);
      body.CreateFixture(circleShape, 5);
      topBody = body;

      y.op_add(deltaY);
    }

    x.op_add(deltaX);
  }

  return {
    step: () => world.Step(1 / 60, 3, 3),
    checksum: () => {
      const position = topBody.GetPosition();
      return position.get_x() + position.get_y();
    },
  };
}

function createV3SpherePyramidWorld(b2) {
  const world = b2.createWorld({ gravity: { x: 0, y: -10 } });
  const ground = b2.createBody(world, { type: b2.staticBody });
  b2.createSegmentShape(ground, { p1: { x: -40, y: 0 }, p2: { x: 40, y: 0 } });

  const radius = 0.5;
  let topBody = null;
  let x = { x: -0.5 * (config.pyramidRows - 1), y: radius };
  const deltaX = { x: radius, y: Math.sqrt(3) * radius };
  const deltaY = { x: 2 * radius, y: 0 };

  for (let i = 0; i < config.pyramidRows; ++i) {
    let y = { x: x.x, y: x.y };

    for (let j = i; j < config.pyramidRows; ++j) {
      const body = b2.createBody(world, {
        type: b2.dynamicBody,
        position: y,
      });
      b2.createCircleShape(body, { radius, density: 5 });
      topBody = body;
      y = { x: y.x + deltaY.x, y: y.y + deltaY.y };
    }

    x = { x: x.x + deltaX.x, y: x.y + deltaX.y };
  }

  return {
    step: () => b2.step(world, 1 / 60, config.v3SubStepCount),
    checksum: () => {
      const position = b2.getBodyPosition(topBody);
      return position.x + position.y;
    },
    destroy: () => b2.destroyWorld(world),
  };
}

function createV2PolygonShape(Box2D, vertices) {
  const shape = new Box2D.b2PolygonShape();
  const buffer = Box2D._malloc(vertices.length * 8);

  for (let i = 0; i < vertices.length; ++i) {
    Box2D.HEAPF32[(buffer + i * 8) >> 2] = vertices[i].x;
    Box2D.HEAPF32[(buffer + i * 8 + 4) >> 2] = vertices[i].y;
  }

  try {
    shape.Set(Box2D.wrapPointer(buffer, Box2D.b2Vec2), vertices.length);
  } finally {
    Box2D._free(buffer);
  }

  return shape;
}

const carCollisionGroup = -1;
const carSpacing = 30;

function createV2Fixture(Box2D, body, shape, density, friction, groupIndex) {
  const fixtureDef = new Box2D.b2FixtureDef();
  fixtureDef.set_shape(shape);
  fixtureDef.set_density(density);
  fixtureDef.set_friction(friction);

  const filter = new Box2D.b2Filter();
  filter.set_groupIndex(groupIndex);
  fixtureDef.set_filter(filter);

  return body.CreateFixture(fixtureDef);
}

function createV2Car(Box2D, world, offsetX) {
  const terrainDef = new Box2D.b2BodyDef();
  const terrain = world.CreateBody(terrainDef);
  const left = new Box2D.b2EdgeShape();
  left.Set(new Box2D.b2Vec2(offsetX - 12, 0), new Box2D.b2Vec2(offsetX, 0.15));
  terrain.CreateFixture(left, 0);
  const right = new Box2D.b2EdgeShape();
  right.Set(new Box2D.b2Vec2(offsetX, 0.15), new Box2D.b2Vec2(offsetX + 12, 0));
  terrain.CreateFixture(right, 0);

  const chassisDef = new Box2D.b2BodyDef();
  chassisDef.set_type(Box2D.b2_dynamicBody);
  chassisDef.set_position(new Box2D.b2Vec2(offsetX, 2.8));
  const chassis = world.CreateBody(chassisDef);
  const chassisShape = createV2PolygonShape(Box2D, [
    { x: -1.4, y: -0.35 },
    { x: 1.2, y: -0.35 },
    { x: 1.45, y: 0.15 },
    { x: -0.7, y: 0.45 },
  ]);
  createV2Fixture(Box2D, chassis, chassisShape, 1.2, 0.7, carCollisionGroup);

  const wheelShape = new Box2D.b2CircleShape();
  wheelShape.set_m_radius(0.35);

  function createWheel(x) {
    const worldX = offsetX + x;
    const wheelDef = new Box2D.b2BodyDef();
    wheelDef.set_type(Box2D.b2_dynamicBody);
    wheelDef.set_position(new Box2D.b2Vec2(worldX, 2.15));
    const wheel = world.CreateBody(wheelDef);
    createV2Fixture(Box2D, wheel, wheelShape, 1, 1, carCollisionGroup);

    const jointDef = new Box2D.b2RevoluteJointDef();
    jointDef.Initialize(chassis, wheel, new Box2D.b2Vec2(worldX, 2.15));
    jointDef.set_enableMotor(true);
    jointDef.set_motorSpeed(-8);
    jointDef.set_maxMotorTorque(25);
    jointDef.set_collideConnected(false);
    world.CreateJoint(jointDef);

    return wheel;
  }

  const wheelA = createWheel(-0.85);
  const wheelB = createWheel(0.85);
  return [chassis, wheelA, wheelB];
}

function createV2CarFleet(Box2D, readStateEachStep) {
  const gravity = new Box2D.b2Vec2(0, -10);
  const world = new Box2D.b2World(gravity);
  const bodies = [];

  for (let i = 0; i < config.carWorlds; ++i) {
    bodies.push(...createV2Car(Box2D, world, i * carSpacing));
  }

  const transforms = new Float32Array(bodies.length * 3);

  return {
    step: () => {
      world.Step(1 / 60, 3, 3);
      if (readStateEachStep) {
        readTransforms();
      }
    },
    checksum: () => {
      readTransforms();
      return transforms.reduce((sum, value) => sum + value, 0);
    },
  };

  function readTransforms() {
    for (let i = 0; i < bodies.length; ++i) {
      const position = bodies[i].GetPosition();
      transforms[i * 3] = position.get_x();
      transforms[i * 3 + 1] = position.get_y();
    }
  }
}

function createV3Car(b2, world, offsetX) {
  const terrain = b2.createBody(world, { type: b2.staticBody, position: { x: 0, y: 0 } });
  b2.createSegmentShape(terrain, { p1: { x: offsetX - 12, y: 0 }, p2: { x: offsetX, y: 0.15 } });
  b2.createSegmentShape(terrain, { p1: { x: offsetX, y: 0.15 }, p2: { x: offsetX + 12, y: 0 } });

  const chassis = b2.createBody(world, { type: b2.dynamicBody, position: { x: offsetX, y: 2.8 } });
  b2.createPolygonShape(chassis, {
    vertices: [
      { x: -1.4, y: -0.35 },
      { x: 1.2, y: -0.35 },
      { x: 1.45, y: 0.15 },
      { x: -0.7, y: 0.45 },
    ],
    density: 1.2,
    friction: 0.7,
    groupIndex: carCollisionGroup,
  });

  function createWheel(x) {
    const worldX = offsetX + x;
    const wheel = b2.createBody(world, { type: b2.dynamicBody, position: { x: worldX, y: 2.15 } });
    b2.createCircleShape(wheel, {
      radius: 0.35,
      density: 1,
      friction: 1,
      groupIndex: carCollisionGroup,
    });
    b2.createRevoluteJoint(world, chassis, wheel, {
      anchor: { x: worldX, y: 2.15 },
      enableMotor: true,
      motorSpeed: -8,
      maxMotorTorque: 25,
      collideConnected: false,
    });
    return wheel;
  }

  const wheelA = createWheel(-0.85);
  const wheelB = createWheel(0.85);
  return [chassis, wheelA, wheelB];
}

function createV3CarFleet(b2, readStateEachStep) {
  const world = b2.createWorld({ gravity: { x: 0, y: -10 } });
  const bodies = [];

  for (let i = 0; i < config.carWorlds; ++i) {
    bodies.push(...createV3Car(b2, world, i * carSpacing));
  }

  const transforms = new Float32Array(bodies.length * 3);

  return {
    step: () => {
      b2.step(world, 1 / 60, config.v3SubStepCount);
      if (readStateEachStep) {
        b2.readBodyTransforms(bodies, transforms);
      }
    },
    checksum: () => {
      b2.readBodyTransforms(bodies, transforms);
      return transforms.reduce((sum, value) => sum + value, 0);
    },
    destroy: () => b2.destroyWorld(world),
  };
}

function runBenchmark(name, createScenario) {
  const results = [];
  let checksum = 0;

  for (let repeat = 0; repeat < config.repeats; ++repeat) {
    const scenario = createScenario();
    const result = measureSteps(scenario.step, config.warmupSteps, config.measuredSteps);
    checksum += scenario.checksum();
    results.push(result.msPerStep);

    if (scenario.destroy) {
      scenario.destroy();
    }
  }

  return {
    name,
    results,
    stats: summarize(results),
    checksum,
  };
}

function printResult(result) {
  const stats = result.stats;
  console.log(
    `${result.name}: median ${formatMs(stats.median)} ms/step, mean ${formatMs(stats.mean)}, ` +
      `min ${formatMs(stats.min)}, p95 ${formatMs(stats.p95)}, max ${formatMs(stats.max)}`
  );
}

(async function main() {
  console.log("Box2D JS/Wasm benchmark");
  console.log(
    `config: repeats=${config.repeats}, warmupSteps=${config.warmupSteps}, ` +
      `measuredSteps=${config.measuredSteps}, pyramidRows=${config.pyramidRows}, ` +
      `carWorlds=${config.carWorlds}, v3SubStepCount=${config.v3SubStepCount}`
  );

  const Box2DV2 = await loadV2();
  const b2v3 = await Box2DV3();

  const benchmarks = [
    runBenchmark("v2 pyramid", () => createV2PyramidWorld(Box2DV2)),
    runBenchmark("v3 pyramid", () => createV3PyramidWorld(b2v3)),
    runBenchmark("v2 sphere pyramid", () => createV2SpherePyramidWorld(Box2DV2)),
    runBenchmark("v3 sphere pyramid", () => createV3SpherePyramidWorld(b2v3)),
    runBenchmark("v2 car fleet step only", () => createV2CarFleet(Box2DV2, false)),
    runBenchmark("v3 car fleet step only", () => createV3CarFleet(b2v3, false)),
    runBenchmark("v2 car fleet + reads", () => createV2CarFleet(Box2DV2, true)),
    runBenchmark("v3 car fleet + reads", () => createV3CarFleet(b2v3, true)),
  ];

  for (const benchmark of benchmarks) {
    printResult(benchmark);
  }

  const byName = Object.fromEntries(benchmarks.map((benchmark) => [benchmark.name, benchmark]));
  const pyramidRatio = byName["v2 pyramid"].stats.median / byName["v3 pyramid"].stats.median;
  const spherePyramidRatio = byName["v2 sphere pyramid"].stats.median / byName["v3 sphere pyramid"].stats.median;
  const carStepRatio = byName["v2 car fleet step only"].stats.median / byName["v3 car fleet step only"].stats.median;
  const carReadRatio = byName["v2 car fleet + reads"].stats.median / byName["v3 car fleet + reads"].stats.median;

  console.log(`v3 pyramid speedup vs v2: ${pyramidRatio.toFixed(2)}x`);
  console.log(`v3 sphere pyramid speedup vs v2: ${spherePyramidRatio.toFixed(2)}x`);
  console.log(`v3 car fleet step-only speedup vs v2: ${carStepRatio.toFixed(2)}x`);
  console.log(`v3 car fleet + reads speedup vs v2: ${carReadRatio.toFixed(2)}x`);
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
