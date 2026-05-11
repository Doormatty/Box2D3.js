# Box2D v3.1.1 JS/Wasm Migration Notes

This repository currently contains the old `box2d.js` port of Box2D v2.3.1. The goal is not to preserve the old API exactly. The goal is to build a practical Box2D v3.1.1 wasm package that can be used by upcoming browser projects, starting with a remake of `HTML5_Genetic_Cars`.

## Current State

- The existing port builds Box2D v2.3.1 C++ sources through Emscripten.
- The existing JS API is generated with Emscripten's WebIDL binder from `Box2D_v2.3.1.idl`.
- The current `Makefile` is C++/WebIDL oriented and lists individual v2 `.cpp` files.
- Existing demos and helpers assume v2 concepts such as C++ classes, fixtures, and body fixture traversal.
- Box2D v3.1.1 is present under `Box2D_v3.1.1`.
- Box2D v3.1.1 already has CMake support and Emscripten-specific build handling.
- A separate v3 wrapper path now exists and does not use the old WebIDL binder.
- `build-v3.ps1` builds `build/Box2D_v3.1.1.js` and `build/Box2D_v3.1.1.wasm` with Emscripten.
- `v3/box2d_v3_shim.c` provides a focused C shim with wasm-side handle tables for worlds, bodies, shapes, and joints.
- `box2d.v3.js` exposes an initial ergonomic JavaScript wrapper over the shim.
- `test-v3.js` verifies the first vertical slice by creating a world, ground body, dynamic box, stepping the simulation, and reading the body position and batched transform data.

## Important v3 Changes

Box2D v3 is not a small API update from v2. It is a rewrite with different binding needs.

- Box2D moved from C++ to C17.
- Public objects are opaque IDs/handles, not class pointers.
- `b2WorldId`, `b2BodyId`, `b2ShapeId`, `b2JointId`, and related IDs are passed by value.
- Fixtures are gone. v3 uses shapes attached to bodies.
- World/body/shape iteration is intentionally reduced.
- Most contact callbacks are gone. Contact, sensor, body, and joint events are read after stepping the world.
- `b2World_Step` now uses a sub-step count instead of velocity/position iteration counts.
- Gear and pulley joints were removed, and friction joint behavior is covered by motor joint functionality.

These changes mean the old WebIDL class binding should not be treated as the migration path.

## Binding Direction

Use a thin v3-oriented binding instead of recreating the v2 JavaScript API.

Preferred shape:

- Compile Box2D v3.1.1 to wasm.
- Export the useful public C API.
- Add a small C shim only where wasm/JS interop needs help.
- Add JS helpers for structs, IDs, arrays, callbacks, and common workflows.
- Keep the native C naming available where useful.
- Add ergonomic JS helpers selectively for project needs.

Avoid:

- Rebuilding the old v2 class hierarchy.
- Emulating fixture traversal.
- Exposing every one of the public `B2_API` functions before proving the core use case.
- Making thousands of tiny JS-to-wasm calls per frame in performance-sensitive paths.

## First Milestone API

The first useful wrapper should prove a full vertical slice. This slice is now implemented in `box2d.v3.js` and covered by `test-v3.js`:

```js
const b2 = await Box2D();

const world = b2.createWorld({ gravity: { x: 0, y: -10 } });
const ground = b2.createBody(world, {
  type: b2.staticBody,
  position: { x: 0, y: 0 }
});

b2.createBoxShape(ground, { hx: 20, hy: 0.5 });

const body = b2.createBody(world, {
  type: b2.dynamicBody,
  position: { x: 0, y: 4 }
});

b2.createBoxShape(body, { hx: 0.5, hy: 0.5, density: 1 });
b2.step(world, 1 / 60, 4);

console.log(b2.getBodyPosition(body));
```

This confirms the important pieces:

- wasm module loads: verified
- structs can be passed correctly: verified for world/body/shape/joint definitions handled by the shim
- IDs round-trip correctly: verified through integer JS handles backed by wasm-side ID tables
- bodies and shapes can be created: verified for box shapes in the smoke test
- simulation steps: verified
- transform/position data can be read back: verified for single-body position reads and batched transform reads

The current wrapper also includes initial support beyond the smoke test:

- circle shapes
- segment shapes
- convex polygon shapes from JS vertex arrays
- revolute joints with motors
- body velocity reads
- body mass reads
- batched body transform reads into `Float32Array`

## Genetic Cars Target

The first real consumer is expected to be a remake of `red42/HTML5_Genetic_Cars`. That project needs a narrow Box2D surface:

- worlds
- dynamic bodies
- static terrain bodies
- polygon chassis shapes
- circular wheels
- revolute joints with motors
- shape filters/group indexes
- body mass
- body position
- body velocity
- body transform
- stepping many simulations repeatedly

It likely does not need the full Box2D v3 public API at first.

## App Model vs Physics State

For the car project, do not depend on Box2D for render geometry introspection.

The old app inspects fixtures and shapes after creation to draw cars and terrain. In v3, fixtures are gone and object iteration is not the intended workflow. The remake should keep its own JS model for design-time/render data and use Box2D only for runtime physics state.

App-owned state:

- genome values
- chassis local vertices
- chassis local triangles
- wheel radii
- wheel attachment points
- terrain points
- colors and render metadata
- ancestry, score, health, replay data

Box2D-owned state:

- world IDs
- body IDs
- shape IDs
- joint IDs
- position and rotation
- velocities
- contacts/events

In practice:

```js
const car = {
  chassis: {
    bodyId,
    localVertices,
    localTriangles
  },
  wheels: [
    { bodyId, radius, localAnchor },
    { bodyId, radius, localAnchor }
  ],
  joints: [
    { jointId, wheelIndex: 0 },
    { jointId, wheelIndex: 1 }
  ]
};
```

Each frame, ask Box2D for changing data such as body transforms. Draw using the JS-owned geometry transformed by the current physics transform.

This is similar to a caching layer, but more accurately it makes JS the source of truth for model/render data and Box2D the source of truth for physics state.

## Performance Guidance

The v3 wasm port should have a good chance of outperforming the old 12-year-old style port, but only if the wrapper avoids excessive crossing between JS and wasm.

Design for:

- one world step call per simulation tick
- batched transform reads where possible
- batched event reads where possible
- JS-owned render geometry
- minimal per-frame engine introspection

Avoid:

- calling into wasm for every vertex
- querying shapes back from Box2D to draw them
- exposing a v2-like object graph that encourages many small calls

For Genetic Cars specifically, performance should prioritize repeated headless simulation and scoring over debug rendering.

## ID Handling

Box2D v3 IDs are value structs, not pointers.

- `b2WorldId` stores two `uint16_t` fields and can be packed into a `uint32_t`.
- `b2BodyId`, `b2ShapeId`, `b2ChainId`, and `b2JointId` store an index, world, and generation.
- Native helper functions such as `b2StoreWorldId`, `b2LoadWorldId`, `b2StoreBodyId`, and `b2LoadBodyId` exist in `id.h`.

The JS wrapper should hide this detail behind stable JS handles. Possible implementation strategies:

- use `WASM_BIGINT` and expose packed 64-bit IDs directly
- split IDs into two 32-bit values
- store native IDs in wasm-side handle tables and expose small JS integer handles

The handle-table option is often the most ergonomic for a focused JS wrapper.

Current implementation:

- The v3 shim uses wasm-side handle tables and exposes small integer handles to JavaScript.
- JavaScript wraps those integers in frozen typed handle objects such as `{ kind: "body", handle }`.
- Destroying a world invalidates known body, shape, and joint slots for that world.
- Destroying a body invalidates known shape and joint slots attached to that body.
- Direct native ID packing with `WASM_BIGINT` is not currently used.

## Struct Handling

Most v3 API calls pass or return structs by value or by pointer. The wrapper needs reliable helpers for:

- `b2Vec2`
- `b2Rot`
- `b2Transform`
- `b2WorldDef`
- `b2BodyDef`
- `b2ShapeDef`
- `b2Circle`
- `b2Capsule`
- `b2Polygon`
- `b2Segment`
- joint definition structs
- event structs

Default definition helpers such as `b2DefaultWorldDef`, `b2DefaultBodyDef`, `b2DefaultShapeDef`, and joint defaults should be used rather than zero-initializing complex definitions by hand.

## Callbacks and Events

Callbacks should be added after the basic simulation path works.

Priority order:

1. No callbacks: create bodies/shapes/joints, step, read positions.
2. Post-step events: body movement and contact/sensor events.
3. Ray/overlap callbacks for queries.
4. Debug draw callbacks.
5. Custom filter and pre-solve callbacks if a project needs them.

Contact events should be read after `b2World_Step`. This fits v3 better than trying to recreate v2 listener behavior.

## Build Notes

Emscripten is installed at:

```text
C:\Users\matt\emsdk
```

The requested interactive setup entrypoint is:

```text
C:\Users\matt\emsdk\emcmdprompt.bat
```

However, `emcmdprompt.bat` contains `cmd /k`, so it opens an interactive shell and is awkward for scripted Codex commands. For non-interactive build commands, use:

```text
call C:\Users\matt\emsdk\emsdk_env.bat
```

The SDK was activated manually with:

```text
C:\Users\matt\emsdk\emsdk.bat activate latest
```

Verified tool state:

- Emscripten works: `emcc 5.0.7`.
- CMake is installed: `cmake 4.0.3`.
- Node is installed.
- Ninja is installed: `ninja 1.13.2`.

In the current Codex app process, `ninja` is not yet visible by name on `PATH`, likely because Ninja was installed after Codex started. The installed binary works at:

```text
C:\Users\matt\AppData\Local\Microsoft\WinGet\Packages\Ninja-build.Ninja_Microsoft.Winget.Source_8wekyb3d8bbwe\ninja.exe
```

Until Codex is restarted and picks up the refreshed `PATH`, use this absolute Ninja path in CMake commands:

```text
emcmake cmake -S Box2D_v3.1.1 -B build-v3-wasm -G Ninja -DCMAKE_MAKE_PROGRAM=C:\Users\matt\AppData\Local\Microsoft\WinGet\Packages\Ninja-build.Ninja_Microsoft.Winget.Source_8wekyb3d8bbwe\ninja.exe -DBOX2D_UNIT_TESTS=OFF -DBOX2D_SAMPLES=OFF
cmake --build build-v3-wasm
```

Because `emsdk` lives outside the workspace writable roots, setup or build commands that write under `C:\Users\matt\emsdk` may need Codex approval.

Current v3 build command:

```powershell
.\build-v3.ps1
```

The script currently invokes `emcc` directly rather than using CMake. It compiles Box2D v3 sources plus `v3/box2d_v3_shim.c`, exports only the shim functions needed by the wrapper, and writes:

```text
build/Box2D_v3.1.1.js
build/Box2D_v3.1.1.wasm
```

Important build details discovered during implementation:

- Windows paths in the Emscripten response file must be normalized to forward slashes.
- Box2D's Emscripten build needs SIMD/SSE compatibility flags: `-msimd128` and `-msse2`.
- `timer.c` requires a GNU C dialect under this toolchain, so the script uses `-std=gnu17`.
- The JS wrapper needs `HEAP32` and `HEAPF32` exported to pass vertex arrays and handle arrays into wasm memory.

Current v3 test commands:

```powershell
node test-v3.js
node test-v3-browser.js
```

Latest verified results:

```text
Box2D v3 tests passed: box at (-0.009, 1.000), chassis at (7.955, 1.047)
Box2D v3 browser smoke test passed
```

## Implementation Status

Completed:

1. Added a separate v3 build script instead of overloading the old v2 WebIDL path.
2. Built a minimal wasm module with focused shim exports.
3. Added a C shim for ID and struct interop using wasm-side handle tables.
4. Added JS helpers for world, body, shape, and revolute joint creation.
5. Added a JS smoke test that creates a falling box and reads its position after stepping.
6. Added support for the Genetic Cars core shape needs: polygon chassis shapes, circular wheels, terrain segments, and revolute motor joints.
7. Added batched transform reads for rendering and scoring.
8. Documented the initial v3 wrapper usage in `README.markdown`.
9. Accepted `build-v3.ps1` as the current main v3 build path.
10. Added broader JS tests for circle shapes, polygon chassis shapes, terrain segments, revolute motor joints, body velocity, body mass, and batched transform reads.
11. Added a small browser smoke test that verifies the generated module through a local HTTP server and headless browser.

Still required:

1. Add shape filter coverage beyond `groupIndex` if the car project needs category and mask bits.
2. Add wheel-specific helper functions if the car project wants a higher-level helper than `createCircleShape` plus `createRevoluteJoint`.
3. Add lifecycle APIs for destroying shapes and joints directly, if consumers need fine-grained cleanup without destroying bodies/worlds.
4. Add post-step event support for body/contact/sensor events when the first consumer needs it.
5. Add ray/overlap query support if needed for gameplay, terrain checks, or editor tools.
6. Add debug draw support only after the runtime wrapper is stable.
7. Add packaging decisions: CommonJS/ESM shape, npm package metadata if needed, browser loading examples, and generated artifact policy.
8. Add performance benchmarks against the old v2 wasm build and against expected Genetic Cars workloads.
9. Document the final supported wrapper API with examples once the first consumer stabilizes.

## Feasibility

The honest feasibility estimate is good for a useful v3 wasm port and lower for a full old-API replacement.

- Compiling v3 to wasm and calling a useful subset from JS should be very achievable.
- A focused wrapper for the Genetic Cars remake is realistic.
- Recreating the old v2 API or exposing the entire v3 API cleanly is much more work and is not the current goal.
