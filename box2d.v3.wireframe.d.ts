import Box2D = require("./box2d.v3");

declare namespace Box2DWireframe {
  type Vec2 = Box2D.Vec2;
  type Vec2Input = Box2D.Vec2Input;
  type VerticesInput = Box2D.VerticesInput;

  interface CanvasLikeContext {
    lineWidth: number;
    strokeStyle: unknown;
    fillStyle: unknown;
    save(): void;
    restore(): void;
    translate(x: number, y: number): void;
    scale(x: number, y: number): void;
    rotate(angle: number): void;
    beginPath(): void;
    moveTo(x: number, y: number): void;
    lineTo(x: number, y: number): void;
    closePath(): void;
    arc(x: number, y: number, radius: number, startAngle: number, endAngle: number): void;
    fill(): void;
    stroke(): void;
  }

  interface Style {
    stroke?: unknown;
    fill?: unknown;
    lineWidth?: number;
  }

  interface DrawOptions {
    pixelsPerMeter?: number;
    scale?: number;
    offsetX?: number;
    offsetY?: number;
    flipY?: boolean;
  }

  interface BodyOptions {
    body?: Box2D.BodyHandle;
    bodyDef?: Box2D.BodyDef;
    type?: number;
    position?: Vec2Input;
    angle?: number;
  }

  interface DrawableOptions extends BodyOptions, Box2D.ShapeOptions {
    id?: string | number;
    style?: Style;
  }

  interface WireBoxDef extends DrawableOptions {
    hx?: number;
    hy?: number;
    halfWidth?: number;
    halfHeight?: number;
  }

  interface WirePolygonDef extends DrawableOptions {
    vertices: VerticesInput;
    normalizeHull?: boolean;
  }

  interface WireCircleDef extends DrawableOptions {
    center?: Vec2Input;
    radius?: number;
  }

  interface WireCapsuleDef extends DrawableOptions {
    center1?: Vec2Input;
    center2?: Vec2Input;
    p1?: Vec2Input;
    p2?: Vec2Input;
    radius?: number;
  }

  interface WireSegmentDef extends DrawableOptions {
    p1?: Vec2Input;
    p2?: Vec2Input;
  }

  interface WireChainDef extends DrawableOptions {
    vertices?: VerticesInput;
    points?: VerticesInput;
    isLoop?: boolean;
    loop?: boolean;
  }

  interface WireShapeBase {
    type: string;
  }

  interface WirePolygonShape extends WireShapeBase {
    type: "polygon";
    vertices: Vec2[];
    shape: Box2D.ShapeHandle;
  }

  interface WireCircleShape extends WireShapeBase {
    type: "circle";
    center: Vec2;
    radius: number;
    shape: Box2D.ShapeHandle;
  }

  interface WireCapsuleShape extends WireShapeBase {
    type: "capsule";
    center1: Vec2;
    center2: Vec2;
    radius: number;
    shape: Box2D.ShapeHandle;
  }

  interface WireSegmentShape extends WireShapeBase {
    type: "segment";
    p1: Vec2;
    p2: Vec2;
    shape: Box2D.ShapeHandle;
  }

  interface WireChainShape extends WireShapeBase {
    type: "chain";
    points: Vec2[];
    isLoop: boolean;
    chain: Box2D.ChainHandle;
  }

  type WireShape = WirePolygonShape | WireCircleShape | WireCapsuleShape | WireSegmentShape | WireChainShape;

  interface Drawable {
    id: string;
    body: Box2D.BodyHandle;
    world?: Box2D.WorldHandle;
    transformIndex: number;
    style: Required<Style>;
    shapes: WireShape[];
  }

  interface DrawableTransform {
    x: number;
    y: number;
    angle: number;
  }

  interface WireframeManager {
    b2: Box2D.Instance;
    drawables: Drawable[];
    bodies: Box2D.BodyHandle[];
    transforms: Float32Array;
    createWireBox(world: Box2D.HandleInput<Box2D.WorldHandle>, def?: WireBoxDef): Drawable;
    createWirePolygon(world: Box2D.HandleInput<Box2D.WorldHandle>, def: WirePolygonDef): Drawable;
    createWireCircle(world: Box2D.HandleInput<Box2D.WorldHandle>, def?: WireCircleDef): Drawable;
    createWireCapsule(world: Box2D.HandleInput<Box2D.WorldHandle>, def?: WireCapsuleDef): Drawable;
    createWireSegmentBody(world: Box2D.HandleInput<Box2D.WorldHandle>, def?: WireSegmentDef): Drawable;
    createWireChain(world: Box2D.HandleInput<Box2D.WorldHandle>, def: WireChainDef): Drawable;
    rebuildTransformList(): Box2D.BodyHandle[];
    syncTransforms(): Float32Array;
    getTransform(drawable: Drawable): DrawableTransform;
    removeDrawable(drawable: Drawable): void;
    draw(ctx: CanvasLikeContext, options?: DrawOptions): void;
  }

  function createWireframe(b2: Box2D.Instance): WireframeManager;
  function convexHull(points: VerticesInput): Vec2[];
  function drawWireframes(
    ctx: CanvasLikeContext,
    drawables: readonly Drawable[],
    transforms: ArrayLike<number>,
    options?: DrawOptions
  ): void;
}

export = Box2DWireframe;
export as namespace Box2DWireframe;
