declare function Box2D(options?: Box2D.Options): Promise<Box2D.Instance>;

declare namespace Box2D {
  type HandleInput<T extends Handle<string>> = T | number;
  type NumericOutputArray = {
    length: number;
    [index: number]: number;
    set?: (values: ArrayLike<number>, offset?: number) => void;
  };
  type Vec2Input = Vec2;
  type VertexInput = Vec2 | readonly [number, number];
  type VerticesInput = ArrayLike<number> | ReadonlyArray<VertexInput>;

  interface Options {
    module?: Record<string, unknown>;
    moduleFactory?: (options?: Record<string, unknown>) => Promise<unknown> | unknown;
  }

  interface Handle<K extends string> {
    readonly kind: K;
    readonly handle: number;
  }

  type WorldHandle = Handle<"world">;
  type BodyHandle = Handle<"body">;
  type ShapeHandle = Handle<"shape">;
  type ChainHandle = Handle<"chain">;
  type JointHandle = Handle<"joint">;

  interface Vec2 {
    x: number;
    y: number;
  }

  interface Transform {
    position: Vec2;
    angle: number;
  }

  interface Filter {
    categoryBits?: number;
    maskBits?: number;
    groupIndex?: number;
  }

  interface SurfaceMaterial {
    friction?: number;
    restitution?: number;
    rollingResistance?: number;
    tangentSpeed?: number;
    userMaterialId?: number;
    customColor?: number;
  }

  interface ShapeOptions extends SurfaceMaterial {
    density?: number;
    filter?: Filter;
    surfaceMaterial?: SurfaceMaterial;
    material?: SurfaceMaterial;
    categoryBits?: number;
    maskBits?: number;
    groupIndex?: number;
    isSensor?: boolean;
    enableSensorEvents?: boolean;
    enableContactEvents?: boolean;
    enableHitEvents?: boolean;
  }

  interface WorldDef {
    gravity?: Vec2Input;
  }

  interface BodyDef {
    type?: number;
    position?: Vec2Input;
    angle?: number;
  }

  interface BoxShapeDef extends ShapeOptions {
    hx?: number;
    hy?: number;
    halfWidth?: number;
    halfHeight?: number;
  }

  interface CircleShapeDef extends ShapeOptions {
    center?: Vec2Input;
    radius: number;
  }

  interface CapsuleShapeDef extends ShapeOptions {
    center1?: Vec2Input;
    center2?: Vec2Input;
    p1?: Vec2Input;
    p2?: Vec2Input;
    radius: number;
  }

  interface SegmentShapeDef extends ShapeOptions {
    p1: Vec2Input;
    p2: Vec2Input;
  }

  interface PolygonShapeDef extends ShapeOptions {
    vertices: VerticesInput;
  }

  interface ChainDef extends SurfaceMaterial, Filter {
    vertices?: VerticesInput;
    points?: VerticesInput;
    isLoop?: boolean;
    loop?: boolean;
    filter?: Filter;
    surfaceMaterial?: SurfaceMaterial;
    material?: SurfaceMaterial;
    enableSensorEvents?: boolean;
  }

  interface RayDef extends Filter {
    origin?: Vec2Input;
    translation?: Vec2Input;
    maxFraction?: number;
    filter?: Filter;
  }

  interface RayResult {
    shape: ShapeHandle | null;
    point: Vec2;
    normal: Vec2;
    fraction: number;
    nodeVisits: number;
    leafVisits: number;
  }

  interface ShapeRayResult {
    point: Vec2;
    normal: Vec2;
    fraction: number;
    iterations: number;
  }

  interface AABBDef extends Filter {
    lowerBound?: Vec2Input;
    upperBound?: Vec2Input;
    lower?: Vec2Input;
    upper?: Vec2Input;
    capacity?: number;
    filter?: Filter;
  }

  interface AABB {
    lowerBound: Vec2;
    upperBound: Vec2;
  }

  interface BodyVelocityDef {
    linearVelocity?: Vec2Input;
    velocity?: Vec2Input;
    angularVelocity?: number;
  }

  interface BodyDampingDef {
    linearDamping?: number;
    angularDamping?: number;
  }

  interface FrameDef {
    position?: Vec2Input;
    angle?: number;
  }

  interface JointDef {
    [key: string]: unknown;
    anchor?: Vec2Input;
    anchorA?: Vec2Input;
    anchorB?: Vec2Input;
    localAnchorA?: Vec2Input;
    localAnchorB?: Vec2Input;
    axis?: Vec2Input;
    localAxis?: Vec2Input;
    collideConnected?: boolean;
  }

  interface TuningDef {
    hertz?: number;
    dampingRatio?: number;
  }

  interface ContactTuningDef extends TuningDef {
    pushSpeed?: number;
  }

  interface PairEvent {
    shapeA: ShapeHandle | null;
    shapeB: ShapeHandle | null;
  }

  interface SensorEvent {
    sensor: ShapeHandle | null;
    visitor: ShapeHandle | null;
  }

  interface HitEvent extends PairEvent {
    point: Vec2;
    normal: Vec2;
    approachSpeed: number;
  }

  interface BodyEvent {
    body: BodyHandle | null;
    position: Vec2;
    angle: number;
    fellAsleep: boolean;
  }

  interface ContactEvents {
    begin: PairEvent[];
    end: PairEvent[];
    hit: HitEvent[];
  }

  interface SensorEvents {
    begin: SensorEvent[];
    end: SensorEvent[];
  }

  interface JointEvent {
    joint: JointHandle | null;
  }

  interface Instance {
    readonly staticBody: 0;
    readonly kinematicBody: 1;
    readonly dynamicBody: 2;
    readonly circleShape: 0;
    readonly capsuleShape: 1;
    readonly segmentShape: 2;
    readonly polygonShape: 3;
    readonly chainSegmentShape: 4;
    readonly distanceJoint: 0;
    readonly filterJoint: 1;
    readonly motorJoint: 2;
    readonly prismaticJoint: 3;
    readonly revoluteJoint: 4;
    readonly weldJoint: 5;
    readonly wheelJoint: 6;
    readonly module: unknown;
    [name: string]: unknown;

    createWorld(def?: WorldDef): WorldHandle;
    destroyWorld(world: HandleInput<WorldHandle>): void;
    createBody(world: HandleInput<WorldHandle>, def?: BodyDef): BodyHandle;
    destroyBody(body: HandleInput<BodyHandle>): void;
    getBodyType(body: HandleInput<BodyHandle>): number;
    setBodyType(body: HandleInput<BodyHandle>, type: number): void;
    setBodyTransform(body: HandleInput<BodyHandle>, def?: FrameDef): void;
    getBodyTransform(body: HandleInput<BodyHandle>): Transform;
    setBodyVelocity(body: HandleInput<BodyHandle>, def?: BodyVelocityDef): void;
    setBodyLinearVelocity(body: HandleInput<BodyHandle>, velocity?: Vec2Input): void;
    setBodyAngularVelocity(body: HandleInput<BodyHandle>, angularVelocity: number): void;
    getBodyVelocity(body: HandleInput<BodyHandle>): Vec2;
    getBodyAngularVelocity(body: HandleInput<BodyHandle>): number;
    getBodyPosition(body: HandleInput<BodyHandle>): Vec2;
    getBodyMass(body: HandleInput<BodyHandle>): number;
    setBodyAwake(body: HandleInput<BodyHandle>, awake: boolean): void;
    isBodyAwake(body: HandleInput<BodyHandle>): boolean;
    setBodyEnabled(body: HandleInput<BodyHandle>, enabled: boolean): void;
    isBodyEnabled(body: HandleInput<BodyHandle>): boolean;
    setBodyBullet(body: HandleInput<BodyHandle>, bullet: boolean): void;
    isBodyBullet(body: HandleInput<BodyHandle>): boolean;
    setBodyGravityScale(body: HandleInput<BodyHandle>, gravityScale: number): void;
    getBodyGravityScale(body: HandleInput<BodyHandle>): number;
    setBodyDamping(body: HandleInput<BodyHandle>, def?: BodyDampingDef): void;
    getBodyDamping(body: HandleInput<BodyHandle>): Required<BodyDampingDef>;
    applyForce(body: HandleInput<BodyHandle>, force?: Vec2Input, point?: Vec2Input, wake?: boolean): void;
    applyForceToCenter(body: HandleInput<BodyHandle>, force?: Vec2Input, wake?: boolean): void;
    applyTorque(body: HandleInput<BodyHandle>, torque: number, wake?: boolean): void;
    applyLinearImpulse(body: HandleInput<BodyHandle>, impulse?: Vec2Input, point?: Vec2Input, wake?: boolean): void;
    applyLinearImpulseToCenter(body: HandleInput<BodyHandle>, impulse?: Vec2Input, wake?: boolean): void;
    applyAngularImpulse(body: HandleInput<BodyHandle>, impulse: number, wake?: boolean): void;

    createBoxShape(body: HandleInput<BodyHandle>, def: BoxShapeDef): ShapeHandle;
    createCircleShape(body: HandleInput<BodyHandle>, def: CircleShapeDef): ShapeHandle;
    createCapsuleShape(body: HandleInput<BodyHandle>, def: CapsuleShapeDef): ShapeHandle;
    createSegmentShape(body: HandleInput<BodyHandle>, def: SegmentShapeDef): ShapeHandle;
    createPolygonShape(body: HandleInput<BodyHandle>, def: PolygonShapeDef): ShapeHandle;
    createChain(body: HandleInput<BodyHandle>, def: ChainDef): ChainHandle;
    destroyShape(shape: HandleInput<ShapeHandle>, updateBodyMass?: boolean): void;
    destroyChain(chain: HandleInput<ChainHandle>): void;
    getChainSegmentCount(chain: HandleInput<ChainHandle>): number;
    getChainSegments(chain: HandleInput<ChainHandle>): ShapeHandle[];
    getChainSurfaceMaterialCount(chain: HandleInput<ChainHandle>): number;
    getChainSurfaceMaterial(chain: HandleInput<ChainHandle>, materialIndex: number): Required<SurfaceMaterial> | null;
    setChainSurfaceMaterial(chain: HandleInput<ChainHandle>, materialIndex: number, def?: SurfaceMaterial): void;
    getShapeType(shape: HandleInput<ShapeHandle>): number;
    isShapeSensor(shape: HandleInput<ShapeHandle>): boolean;
    setShapeDensity(shape: HandleInput<ShapeHandle>, density: number, updateBodyMass?: boolean): void;
    getShapeDensity(shape: HandleInput<ShapeHandle>): number;
    setShapeFriction(shape: HandleInput<ShapeHandle>, friction: number): void;
    getShapeFriction(shape: HandleInput<ShapeHandle>): number;
    setShapeRestitution(shape: HandleInput<ShapeHandle>, restitution: number): void;
    getShapeRestitution(shape: HandleInput<ShapeHandle>): number;
    setShapeSurfaceMaterial(shape: HandleInput<ShapeHandle>, def?: SurfaceMaterial): void;
    getShapeSurfaceMaterial(shape: HandleInput<ShapeHandle>): Required<SurfaceMaterial> | null;
    setShapeUserMaterial(shape: HandleInput<ShapeHandle>, userMaterialId: number): void;
    getShapeUserMaterial(shape: HandleInput<ShapeHandle>): number;
    setShapeFilter(shape: HandleInput<ShapeHandle>, filterDef?: Filter): void;
    getShapeFilter(shape: HandleInput<ShapeHandle>): Required<Filter>;
    enableShapeSensorEvents(shape: HandleInput<ShapeHandle>, enabled: boolean): void;
    areShapeSensorEventsEnabled(shape: HandleInput<ShapeHandle>): boolean;
    enableShapeContactEvents(shape: HandleInput<ShapeHandle>, enabled: boolean): void;
    areShapeContactEventsEnabled(shape: HandleInput<ShapeHandle>): boolean;
    enableShapeHitEvents(shape: HandleInput<ShapeHandle>, enabled: boolean): void;
    areShapeHitEventsEnabled(shape: HandleInput<ShapeHandle>): boolean;
    testShapePoint(shape: HandleInput<ShapeHandle>, point?: Vec2Input): boolean;
    rayCastShape(shape: HandleInput<ShapeHandle>, def?: RayDef): ShapeRayResult | null;
    getShapeAABB(shape: HandleInput<ShapeHandle>): AABB | null;

    createDistanceJoint(world: HandleInput<WorldHandle>, bodyA: HandleInput<BodyHandle>, bodyB: HandleInput<BodyHandle>, def?: JointDef): JointHandle;
    createRevoluteJoint(world: HandleInput<WorldHandle>, bodyA: HandleInput<BodyHandle>, bodyB: HandleInput<BodyHandle>, def?: JointDef): JointHandle;
    createFilterJoint(world: HandleInput<WorldHandle>, bodyA: HandleInput<BodyHandle>, bodyB: HandleInput<BodyHandle>, def?: JointDef): JointHandle;
    createPrismaticJoint(world: HandleInput<WorldHandle>, bodyA: HandleInput<BodyHandle>, bodyB: HandleInput<BodyHandle>, def?: JointDef): JointHandle;
    createWheelJoint(world: HandleInput<WorldHandle>, bodyA: HandleInput<BodyHandle>, bodyB: HandleInput<BodyHandle>, def?: JointDef): JointHandle;
    createMotorJoint(world: HandleInput<WorldHandle>, bodyA: HandleInput<BodyHandle>, bodyB: HandleInput<BodyHandle>, def?: JointDef): JointHandle;
    destroyJoint(joint: HandleInput<JointHandle>, wakeAttached?: boolean): void;
    getJointType(joint: HandleInput<JointHandle>): number;
    wakeJointBodies(joint: HandleInput<JointHandle>): void;
    setJointCollideConnected(joint: HandleInput<JointHandle>, shouldCollide: boolean): void;
    getJointCollideConnected(joint: HandleInput<JointHandle>): boolean;
    setJointLocalFrameA(joint: HandleInput<JointHandle>, def?: FrameDef): void;
    setJointLocalFrameB(joint: HandleInput<JointHandle>, def?: FrameDef): void;
    getJointLocalFrameA(joint: HandleInput<JointHandle>): Transform;
    getJointLocalFrameB(joint: HandleInput<JointHandle>): Transform;
    setJointConstraintTuning(joint: HandleInput<JointHandle>, def?: TuningDef): void;
    getJointConstraintTuning(joint: HandleInput<JointHandle>): Required<TuningDef>;
    getJointConstraintForce(joint: HandleInput<JointHandle>): Vec2;
    getJointConstraintTorque(joint: HandleInput<JointHandle>): number;
    getJointLinearSeparation(joint: HandleInput<JointHandle>): number;
    getJointAngularSeparation(joint: HandleInput<JointHandle>): number;
    setJointForceThreshold(joint: HandleInput<JointHandle>, threshold: number): void;
    getJointForceThreshold(joint: HandleInput<JointHandle>): number;
    setJointTorqueThreshold(joint: HandleInput<JointHandle>, threshold: number): void;
    getJointTorqueThreshold(joint: HandleInput<JointHandle>): number;

    setDistanceJointLength(joint: HandleInput<JointHandle>, length: number): void;
    getDistanceJointLength(joint: HandleInput<JointHandle>): number;
    enableDistanceJointSpring(joint: HandleInput<JointHandle>, enabled: boolean): void;
    isDistanceJointSpringEnabled(joint: HandleInput<JointHandle>): boolean;
    setDistanceJointSpringForceRange(joint: HandleInput<JointHandle>, lowerForce: number, upperForce: number): void;
    getDistanceJointSpringForceRange(joint: HandleInput<JointHandle>): { lower: number; upper: number };
    setDistanceJointSpringHertz(joint: HandleInput<JointHandle>, hertz: number): void;
    getDistanceJointSpringHertz(joint: HandleInput<JointHandle>): number;
    setDistanceJointSpringDampingRatio(joint: HandleInput<JointHandle>, dampingRatio: number): void;
    getDistanceJointSpringDampingRatio(joint: HandleInput<JointHandle>): number;
    enableDistanceJointLimit(joint: HandleInput<JointHandle>, enabled: boolean): void;
    isDistanceJointLimitEnabled(joint: HandleInput<JointHandle>): boolean;
    setDistanceJointLengthRange(joint: HandleInput<JointHandle>, minLength: number, maxLength: number): void;
    getDistanceJointMinLength(joint: HandleInput<JointHandle>): number;
    getDistanceJointMaxLength(joint: HandleInput<JointHandle>): number;
    getDistanceJointCurrentLength(joint: HandleInput<JointHandle>): number;
    enableDistanceJointMotor(joint: HandleInput<JointHandle>, enabled: boolean): void;
    isDistanceJointMotorEnabled(joint: HandleInput<JointHandle>): boolean;
    setDistanceJointMotorSpeed(joint: HandleInput<JointHandle>, motorSpeed: number): void;
    getDistanceJointMotorSpeed(joint: HandleInput<JointHandle>): number;
    setDistanceJointMaxMotorForce(joint: HandleInput<JointHandle>, force: number): void;
    getDistanceJointMaxMotorForce(joint: HandleInput<JointHandle>): number;
    getDistanceJointMotorForce(joint: HandleInput<JointHandle>): number;

    setRevoluteJointMotor(joint: HandleInput<JointHandle>, def?: { enabled?: boolean; motorSpeed?: number; maxMotorTorque?: number }): void;
    enableRevoluteJointSpring(joint: HandleInput<JointHandle>, enabled: boolean): void;
    isRevoluteJointSpringEnabled(joint: HandleInput<JointHandle>): boolean;
    setRevoluteJointSpringHertz(joint: HandleInput<JointHandle>, hertz: number): void;
    getRevoluteJointSpringHertz(joint: HandleInput<JointHandle>): number;
    setRevoluteJointSpringDampingRatio(joint: HandleInput<JointHandle>, dampingRatio: number): void;
    getRevoluteJointSpringDampingRatio(joint: HandleInput<JointHandle>): number;
    setRevoluteJointTargetAngle(joint: HandleInput<JointHandle>, angle: number): void;
    getRevoluteJointTargetAngle(joint: HandleInput<JointHandle>): number;
    getRevoluteJointAngle(joint: HandleInput<JointHandle>): number;
    enableRevoluteJointLimit(joint: HandleInput<JointHandle>, enabled: boolean): void;
    isRevoluteJointLimitEnabled(joint: HandleInput<JointHandle>): boolean;
    getRevoluteJointLowerLimit(joint: HandleInput<JointHandle>): number;
    getRevoluteJointUpperLimit(joint: HandleInput<JointHandle>): number;
    setRevoluteJointLimits(joint: HandleInput<JointHandle>, lower: number, upper: number): void;
    enableRevoluteJointMotor(joint: HandleInput<JointHandle>, enabled: boolean): void;
    isRevoluteJointMotorEnabled(joint: HandleInput<JointHandle>): boolean;
    setRevoluteJointMotorSpeed(joint: HandleInput<JointHandle>, motorSpeed: number): void;
    getRevoluteJointMotorSpeed(joint: HandleInput<JointHandle>): number;
    getRevoluteJointMotorTorque(joint: HandleInput<JointHandle>): number;
    setRevoluteJointMaxMotorTorque(joint: HandleInput<JointHandle>, torque: number): void;
    getRevoluteJointMaxMotorTorque(joint: HandleInput<JointHandle>): number;

    enablePrismaticJointSpring(joint: HandleInput<JointHandle>, enabled: boolean): void;
    isPrismaticJointSpringEnabled(joint: HandleInput<JointHandle>): boolean;
    setPrismaticJointSpringHertz(joint: HandleInput<JointHandle>, hertz: number): void;
    getPrismaticJointSpringHertz(joint: HandleInput<JointHandle>): number;
    setPrismaticJointSpringDampingRatio(joint: HandleInput<JointHandle>, dampingRatio: number): void;
    getPrismaticJointSpringDampingRatio(joint: HandleInput<JointHandle>): number;
    setPrismaticJointTargetTranslation(joint: HandleInput<JointHandle>, translation: number): void;
    getPrismaticJointTargetTranslation(joint: HandleInput<JointHandle>): number;
    enablePrismaticJointLimit(joint: HandleInput<JointHandle>, enabled: boolean): void;
    isPrismaticJointLimitEnabled(joint: HandleInput<JointHandle>): boolean;
    getPrismaticJointLowerLimit(joint: HandleInput<JointHandle>): number;
    getPrismaticJointUpperLimit(joint: HandleInput<JointHandle>): number;
    setPrismaticJointLimits(joint: HandleInput<JointHandle>, lower: number, upper: number): void;
    enablePrismaticJointMotor(joint: HandleInput<JointHandle>, enabled: boolean): void;
    isPrismaticJointMotorEnabled(joint: HandleInput<JointHandle>): boolean;
    setPrismaticJointMotorSpeed(joint: HandleInput<JointHandle>, motorSpeed: number): void;
    getPrismaticJointMotorSpeed(joint: HandleInput<JointHandle>): number;
    setPrismaticJointMaxMotorForce(joint: HandleInput<JointHandle>, force: number): void;
    getPrismaticJointMaxMotorForce(joint: HandleInput<JointHandle>): number;
    getPrismaticJointMotorForce(joint: HandleInput<JointHandle>): number;
    getPrismaticJointTranslation(joint: HandleInput<JointHandle>): number;
    getPrismaticJointSpeed(joint: HandleInput<JointHandle>): number;

    enableWheelJointSpring(joint: HandleInput<JointHandle>, enabled: boolean): void;
    isWheelJointSpringEnabled(joint: HandleInput<JointHandle>): boolean;
    setWheelJointSpringHertz(joint: HandleInput<JointHandle>, hertz: number): void;
    getWheelJointSpringHertz(joint: HandleInput<JointHandle>): number;
    setWheelJointSpringDampingRatio(joint: HandleInput<JointHandle>, dampingRatio: number): void;
    getWheelJointSpringDampingRatio(joint: HandleInput<JointHandle>): number;
    enableWheelJointLimit(joint: HandleInput<JointHandle>, enabled: boolean): void;
    isWheelJointLimitEnabled(joint: HandleInput<JointHandle>): boolean;
    getWheelJointLowerLimit(joint: HandleInput<JointHandle>): number;
    getWheelJointUpperLimit(joint: HandleInput<JointHandle>): number;
    setWheelJointLimits(joint: HandleInput<JointHandle>, lower: number, upper: number): void;
    enableWheelJointMotor(joint: HandleInput<JointHandle>, enabled: boolean): void;
    isWheelJointMotorEnabled(joint: HandleInput<JointHandle>): boolean;
    setWheelJointMotorSpeed(joint: HandleInput<JointHandle>, motorSpeed: number): void;
    getWheelJointMotorSpeed(joint: HandleInput<JointHandle>): number;
    setWheelJointMaxMotorTorque(joint: HandleInput<JointHandle>, torque: number): void;
    getWheelJointMaxMotorTorque(joint: HandleInput<JointHandle>): number;
    getWheelJointMotorTorque(joint: HandleInput<JointHandle>): number;

    setMotorJointLinearVelocity(joint: HandleInput<JointHandle>, velocity?: Vec2Input): void;
    getMotorJointLinearVelocity(joint: HandleInput<JointHandle>): Vec2;
    setMotorJointAngularVelocity(joint: HandleInput<JointHandle>, velocity: number): void;
    getMotorJointAngularVelocity(joint: HandleInput<JointHandle>): number;
    setMotorJointMaxVelocityForce(joint: HandleInput<JointHandle>, force: number): void;
    getMotorJointMaxVelocityForce(joint: HandleInput<JointHandle>): number;
    setMotorJointMaxVelocityTorque(joint: HandleInput<JointHandle>, torque: number): void;
    getMotorJointMaxVelocityTorque(joint: HandleInput<JointHandle>): number;
    setMotorJointLinearHertz(joint: HandleInput<JointHandle>, hertz: number): void;
    getMotorJointLinearHertz(joint: HandleInput<JointHandle>): number;
    setMotorJointLinearDampingRatio(joint: HandleInput<JointHandle>, dampingRatio: number): void;
    getMotorJointLinearDampingRatio(joint: HandleInput<JointHandle>): number;
    setMotorJointAngularHertz(joint: HandleInput<JointHandle>, hertz: number): void;
    getMotorJointAngularHertz(joint: HandleInput<JointHandle>): number;
    setMotorJointAngularDampingRatio(joint: HandleInput<JointHandle>, dampingRatio: number): void;
    getMotorJointAngularDampingRatio(joint: HandleInput<JointHandle>): number;
    setMotorJointMaxSpringForce(joint: HandleInput<JointHandle>, force: number): void;
    getMotorJointMaxSpringForce(joint: HandleInput<JointHandle>): number;
    setMotorJointMaxSpringTorque(joint: HandleInput<JointHandle>, torque: number): void;
    getMotorJointMaxSpringTorque(joint: HandleInput<JointHandle>): number;

    setWorldGravity(world: HandleInput<WorldHandle>, gravity?: Vec2Input): void;
    getWorldGravity(world: HandleInput<WorldHandle>): Vec2;
    enableWorldSleeping(world: HandleInput<WorldHandle>, enabled: boolean): void;
    isWorldSleepingEnabled(world: HandleInput<WorldHandle>): boolean;
    enableWorldContinuous(world: HandleInput<WorldHandle>, enabled: boolean): void;
    isWorldContinuousEnabled(world: HandleInput<WorldHandle>): boolean;
    setWorldRestitutionThreshold(world: HandleInput<WorldHandle>, value: number): void;
    getWorldRestitutionThreshold(world: HandleInput<WorldHandle>): number;
    setWorldHitEventThreshold(world: HandleInput<WorldHandle>, value: number): void;
    getWorldHitEventThreshold(world: HandleInput<WorldHandle>): number;
    setWorldContactTuning(world: HandleInput<WorldHandle>, def?: ContactTuningDef): void;
    setWorldContactRecycleDistance(world: HandleInput<WorldHandle>, value: number): void;
    getWorldContactRecycleDistance(world: HandleInput<WorldHandle>): number;
    setWorldMaximumLinearSpeed(world: HandleInput<WorldHandle>, value: number): void;
    getWorldMaximumLinearSpeed(world: HandleInput<WorldHandle>): number;
    enableWorldWarmStarting(world: HandleInput<WorldHandle>, enabled: boolean): void;
    isWorldWarmStartingEnabled(world: HandleInput<WorldHandle>): boolean;
    getWorldAwakeBodyCount(world: HandleInput<WorldHandle>): number;
    enableWorldFrictionCallback(world: HandleInput<WorldHandle>, enabled: boolean): void;
    enableWorldRestitutionCallback(world: HandleInput<WorldHandle>, enabled: boolean): void;
    clearFrictionMixRules(): void;
    addFrictionMixRule(materialA: number, materialB: number, friction: number): boolean;
    clearRestitutionMixRules(): void;
    addRestitutionMixRule(materialA: number, materialB: number, restitution: number): boolean;
    castRayClosest(world: HandleInput<WorldHandle>, def?: RayDef): RayResult | null;
    overlapAABB(world: HandleInput<WorldHandle>, def?: AABBDef): ShapeHandle[];
    getBodyEvents(world: HandleInput<WorldHandle>): BodyEvent[];
    getContactEvents(world: HandleInput<WorldHandle>): ContactEvents;
    getSensorEvents(world: HandleInput<WorldHandle>): SensorEvents;
    getJointEvents(world: HandleInput<WorldHandle>): JointEvent[];
    step(world: HandleInput<WorldHandle>, timeStep: number, subStepCount?: number): void;
    readBodyTransforms(bodies: ArrayLike<HandleInput<BodyHandle>>): Float32Array;
    readBodyTransforms<T extends NumericOutputArray>(bodies: ArrayLike<HandleInput<BodyHandle>>, out: T): T;
  }
}

export = Box2D;
export as namespace Box2D;
