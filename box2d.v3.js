(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("./build/Box2D_v3.1.1.js"));
  } else {
    root.Box2D = factory(root.Box2DModule);
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function (defaultModuleFactory) {
  "use strict";

  function readVec2(value, fallbackX, fallbackY) {
    value = value || {};
    return {
      x: Number(value.x == null ? fallbackX : value.x),
      y: Number(value.y == null ? fallbackY : value.y),
    };
  }

  function readNumber(value, fallback) {
    return Number(value == null ? fallback : value);
  }

  function hasOwn(value, key) {
    return Object.prototype.hasOwnProperty.call(value || {}, key);
  }

  function handleValue(value, kind) {
    if (typeof value === "number") {
      return value;
    }

    if (!value || value.kind !== kind || typeof value.handle !== "number") {
      throw new TypeError("Expected a Box2D " + kind + " handle");
    }

    return value.handle;
  }

  function makeHandle(kind, handle) {
    if (!handle) {
      throw new Error("Box2D failed to create " + kind);
    }

    return Object.freeze({ kind: kind, handle: handle });
  }

  function normalizeVertices(vertices) {
    if (!Array.isArray(vertices) && !ArrayBuffer.isView(vertices)) {
      throw new TypeError("vertices must be an array");
    }

    if (ArrayBuffer.isView(vertices)) {
      if (vertices.length % 2 !== 0) {
        throw new Error("flat vertex arrays must contain x/y pairs");
      }

      return Float32Array.from(vertices);
    }

    if (vertices.length === 0) {
      return new Float32Array();
    }

    if (typeof vertices[0] === "number") {
      if (vertices.length % 2 !== 0) {
        throw new Error("flat vertex arrays must contain x/y pairs");
      }

      return Float32Array.from(vertices);
    }

    var flat = new Float32Array(vertices.length * 2);
    for (var i = 0; i < vertices.length; ++i) {
      var vertex = vertices[i];
      if (Array.isArray(vertex)) {
        flat[i * 2] = Number(vertex[0]);
        flat[i * 2 + 1] = Number(vertex[1]);
      } else {
        flat[i * 2] = Number(vertex.x);
        flat[i * 2 + 1] = Number(vertex.y);
      }
    }

    return flat;
  }

  async function Box2D(options) {
    options = options || {};

    var moduleFactory = options.moduleFactory || defaultModuleFactory;
    if (typeof moduleFactory !== "function") {
      throw new Error("Box2D v3 wasm module factory is not available");
    }

    var moduleOptions = Object.assign({}, options.module || {});
    var Module = await moduleFactory(moduleOptions);

    function createWorld(def) {
      def = def || {};
      var gravity = readVec2(def.gravity, 0, -10);
      return makeHandle("world", Module._b2js_create_world(gravity.x, gravity.y));
    }

    function createBody(world, def) {
      def = def || {};
      var position = readVec2(def.position, 0, 0);
      var angle = Number(def.angle == null ? 0 : def.angle);
      var type = Number(def.type == null ? api.staticBody : def.type);

      return makeHandle("body", Module._b2js_create_body(handleValue(world, "world"), type, position.x, position.y, angle));
    }

    function createBoxShape(body, def) {
      def = def || {};
      return makeHandle(
        "shape",
        Module._b2js_create_box_shape(
          handleValue(body, "body"),
          Number(def.hx),
          Number(def.hy),
          Number(def.density == null ? 1 : def.density),
          Number(def.friction == null ? 0.6 : def.friction),
          Number(def.groupIndex == null ? 0 : def.groupIndex)
        )
      );
    }

    function createCircleShape(body, def) {
      def = def || {};
      var center = readVec2(def.center, 0, 0);
      return makeHandle(
        "shape",
        Module._b2js_create_circle_shape(
          handleValue(body, "body"),
          center.x,
          center.y,
          Number(def.radius),
          Number(def.density == null ? 1 : def.density),
          Number(def.friction == null ? 0.6 : def.friction),
          Number(def.groupIndex == null ? 0 : def.groupIndex)
        )
      );
    }

    function createSegmentShape(body, def) {
      def = def || {};
      var p1 = readVec2(def.p1, 0, 0);
      var p2 = readVec2(def.p2, 0, 0);
      return makeHandle(
        "shape",
        Module._b2js_create_segment_shape(
          handleValue(body, "body"),
          p1.x,
          p1.y,
          p2.x,
          p2.y,
          Number(def.friction == null ? 0.6 : def.friction),
          Number(def.groupIndex == null ? 0 : def.groupIndex)
        )
      );
    }

    function createPolygonShape(body, def) {
      def = def || {};
      var vertices = normalizeVertices(def.vertices);
      var count = vertices.length / 2;
      var ptr = Module._malloc(vertices.byteLength);

      try {
        Module.HEAPF32.set(vertices, ptr >> 2);
        return makeHandle(
          "shape",
          Module._b2js_create_polygon_shape(
            handleValue(body, "body"),
            ptr,
            count,
            Number(def.density == null ? 1 : def.density),
            Number(def.friction == null ? 0.6 : def.friction),
            Number(def.groupIndex == null ? 0 : def.groupIndex)
          )
        );
      } finally {
        Module._free(ptr);
      }
    }

    function readJointAnchors(def) {
      def = def || {};
      if (def.localAnchorA || def.localAnchorB) {
        return {
          local: true,
          a: readVec2(def.localAnchorA, 0, 0),
          b: readVec2(def.localAnchorB, 0, 0),
        };
      }

      if (def.anchorA || def.anchorB) {
        return {
          local: false,
          a: readVec2(def.anchorA, 0, 0),
          b: readVec2(def.anchorB, 0, 0),
        };
      }

      var anchor = readVec2(def.anchor, 0, 0);
      return { local: false, a: anchor, b: anchor };
    }

    function createDistanceJoint(world, bodyA, bodyB, def) {
      def = def || {};
      var anchors = readJointAnchors(def);
      var range = def.lengthRange || {};
      var springForceRange = def.springForceRange || {};
      return makeHandle(
        "joint",
        Module._b2js_create_distance_joint(
          handleValue(world, "world"),
          handleValue(bodyA, "body"),
          handleValue(bodyB, "body"),
          anchors.local ? 1 : 0,
          anchors.a.x,
          anchors.a.y,
          anchors.b.x,
          anchors.b.y,
          readNumber(def.length, NaN),
          def.enableSpring ? 1 : 0,
          readNumber(def.lowerSpringForce == null ? springForceRange.lower : def.lowerSpringForce, NaN),
          readNumber(def.upperSpringForce == null ? springForceRange.upper : def.upperSpringForce, NaN),
          readNumber(def.hertz, 0),
          readNumber(def.dampingRatio, 0),
          def.enableLimit ? 1 : 0,
          readNumber(def.minLength == null ? range.min : def.minLength, NaN),
          readNumber(def.maxLength == null ? range.max : def.maxLength, NaN),
          def.enableMotor ? 1 : 0,
          readNumber(def.maxMotorForce, 0),
          readNumber(def.motorSpeed, 0),
          def.collideConnected ? 1 : 0,
          readNumber(def.constraintHertz, NaN),
          readNumber(def.constraintDampingRatio, NaN),
          readNumber(def.forceThreshold, NaN),
          readNumber(def.torqueThreshold, NaN),
          readNumber(def.drawScale, NaN)
        )
      );
    }

    function createRevoluteJoint(world, bodyA, bodyB, def) {
      def = def || {};
      var anchors = readJointAnchors(def);
      var referenceAngle = readNumber(def.referenceAngle, 0);
      var localAngleA = readNumber(def.localAngleA, 0);
      var localAngleB = hasOwn(def, "localAngleB") ? readNumber(def.localAngleB, 0) : -referenceAngle;
      return makeHandle(
        "joint",
        Module._b2js_create_revolute_joint(
          handleValue(world, "world"),
          handleValue(bodyA, "body"),
          handleValue(bodyB, "body"),
          anchors.local ? 1 : 0,
          anchors.a.x,
          anchors.a.y,
          anchors.b.x,
          anchors.b.y,
          localAngleA,
          localAngleB,
          readNumber(def.targetAngle, 0),
          def.enableSpring ? 1 : 0,
          readNumber(def.hertz, 0),
          readNumber(def.dampingRatio, 0),
          def.enableLimit ? 1 : 0,
          readNumber(def.lowerAngle, 0),
          readNumber(def.upperAngle, 0),
          def.enableMotor ? 1 : 0,
          readNumber(def.motorSpeed, 0),
          readNumber(def.maxMotorTorque, 0),
          def.collideConnected ? 1 : 0,
          readNumber(def.constraintHertz, NaN),
          readNumber(def.constraintDampingRatio, NaN),
          readNumber(def.forceThreshold, NaN),
          readNumber(def.torqueThreshold, NaN),
          readNumber(def.drawScale, NaN)
        )
      );
    }

    function setRevoluteJointMotor(joint, def) {
      def = def || {};
      Module._b2js_revolute_joint_set_motor(
        handleValue(joint, "joint"),
        def.enabled === false ? 0 : 1,
        Number(def.motorSpeed == null ? 0 : def.motorSpeed),
        Number(def.maxMotorTorque == null ? 0 : def.maxMotorTorque)
      );
    }

    function jointHandle(joint) {
      return handleValue(joint, "joint");
    }

    function readFrame(def) {
      def = def || {};
      var position = readVec2(def.position || def.p, 0, 0);
      return {
        x: position.x,
        y: position.y,
        angle: readNumber(def.angle, 0),
      };
    }

    function getJointLocalFrame(joint, suffix) {
      var handle = jointHandle(joint);
      return {
        position: {
          x: Module["_b2js_joint_get_local_frame_" + suffix + "_x"](handle),
          y: Module["_b2js_joint_get_local_frame_" + suffix + "_y"](handle),
        },
        angle: Module["_b2js_joint_get_local_frame_" + suffix + "_angle"](handle),
      };
    }

    function step(world, timeStep, subStepCount) {
      Module._b2js_step(handleValue(world, "world"), Number(timeStep), subStepCount == null ? 4 : Number(subStepCount));
    }

    function getBodyPosition(body) {
      var handle = handleValue(body, "body");
      return {
        x: Module._b2js_body_get_position_x(handle),
        y: Module._b2js_body_get_position_y(handle),
      };
    }

    function getBodyVelocity(body) {
      var handle = handleValue(body, "body");
      return {
        x: Module._b2js_body_get_velocity_x(handle),
        y: Module._b2js_body_get_velocity_y(handle),
      };
    }

    function getBodyTransform(body) {
      var handle = handleValue(body, "body");
      return {
        position: {
          x: Module._b2js_body_get_position_x(handle),
          y: Module._b2js_body_get_position_y(handle),
        },
        angle: Module._b2js_body_get_angle(handle),
      };
    }

    function readBodyTransforms(bodies, out) {
      if (!Array.isArray(bodies) && !ArrayBuffer.isView(bodies)) {
        throw new TypeError("bodies must be an array");
      }

      var count = bodies.length;
      var handles = new Int32Array(count);
      for (var i = 0; i < count; ++i) {
        handles[i] = handleValue(bodies[i], "body");
      }

      var output = out || new Float32Array(count * 3);
      if (output.length < count * 3) {
        throw new Error("output array is too small");
      }

      var handlesPtr = Module._malloc(handles.byteLength);
      var outputPtr = Module._malloc(count * 3 * Float32Array.BYTES_PER_ELEMENT);

      try {
        Module.HEAP32.set(handles, handlesPtr >> 2);
        Module._b2js_read_body_transforms(handlesPtr, count, outputPtr);
        output.set(Module.HEAPF32.subarray(outputPtr >> 2, (outputPtr >> 2) + count * 3));
        return output;
      } finally {
        Module._free(handlesPtr);
        Module._free(outputPtr);
      }
    }

    var api = {
      staticBody: 0,
      kinematicBody: 1,
      dynamicBody: 2,
      module: Module,
      createWorld: createWorld,
      destroyWorld: function (world) {
        Module._b2js_destroy_world(handleValue(world, "world"));
      },
      createBody: createBody,
      destroyBody: function (body) {
        Module._b2js_destroy_body(handleValue(body, "body"));
      },
      createBoxShape: createBoxShape,
      createCircleShape: createCircleShape,
      createSegmentShape: createSegmentShape,
      createPolygonShape: createPolygonShape,
      distanceJoint: 0,
      filterJoint: 1,
      motorJoint: 2,
      prismaticJoint: 3,
      revoluteJoint: 4,
      weldJoint: 5,
      wheelJoint: 6,
      createDistanceJoint: createDistanceJoint,
      createRevoluteJoint: createRevoluteJoint,
      setRevoluteJointMotor: setRevoluteJointMotor,
      destroyJoint: function (joint, wakeAttached) {
        Module._b2js_destroy_joint(jointHandle(joint), wakeAttached === false ? 0 : 1);
      },
      getJointType: function (joint) {
        return Module._b2js_joint_get_type(jointHandle(joint));
      },
      wakeJointBodies: function (joint) {
        Module._b2js_joint_wake_bodies(jointHandle(joint));
      },
      setJointCollideConnected: function (joint, shouldCollide) {
        Module._b2js_joint_set_collide_connected(jointHandle(joint), shouldCollide ? 1 : 0);
      },
      getJointCollideConnected: function (joint) {
        return !!Module._b2js_joint_get_collide_connected(jointHandle(joint));
      },
      setJointLocalFrameA: function (joint, def) {
        var frame = readFrame(def);
        Module._b2js_joint_set_local_frame_a(jointHandle(joint), frame.x, frame.y, frame.angle);
      },
      setJointLocalFrameB: function (joint, def) {
        var frame = readFrame(def);
        Module._b2js_joint_set_local_frame_b(jointHandle(joint), frame.x, frame.y, frame.angle);
      },
      getJointLocalFrameA: function (joint) {
        return getJointLocalFrame(joint, "a");
      },
      getJointLocalFrameB: function (joint) {
        return getJointLocalFrame(joint, "b");
      },
      setJointConstraintTuning: function (joint, def) {
        def = def || {};
        Module._b2js_joint_set_constraint_tuning(
          jointHandle(joint),
          readNumber(def.hertz, 0),
          readNumber(def.dampingRatio, 0)
        );
      },
      getJointConstraintTuning: function (joint) {
        var handle = jointHandle(joint);
        return {
          hertz: Module._b2js_joint_get_constraint_hertz(handle),
          dampingRatio: Module._b2js_joint_get_constraint_damping_ratio(handle),
        };
      },
      setJointForceThreshold: function (joint, threshold) {
        Module._b2js_joint_set_force_threshold(jointHandle(joint), Number(threshold));
      },
      getJointForceThreshold: function (joint) {
        return Module._b2js_joint_get_force_threshold(jointHandle(joint));
      },
      setJointTorqueThreshold: function (joint, threshold) {
        Module._b2js_joint_set_torque_threshold(jointHandle(joint), Number(threshold));
      },
      getJointTorqueThreshold: function (joint) {
        return Module._b2js_joint_get_torque_threshold(jointHandle(joint));
      },
      getJointConstraintForce: function (joint) {
        var handle = jointHandle(joint);
        return {
          x: Module._b2js_joint_get_constraint_force_x(handle),
          y: Module._b2js_joint_get_constraint_force_y(handle),
        };
      },
      getJointConstraintTorque: function (joint) {
        return Module._b2js_joint_get_constraint_torque(jointHandle(joint));
      },
      getJointLinearSeparation: function (joint) {
        return Module._b2js_joint_get_linear_separation(jointHandle(joint));
      },
      getJointAngularSeparation: function (joint) {
        return Module._b2js_joint_get_angular_separation(jointHandle(joint));
      },
      setDistanceJointLength: function (joint, length) {
        Module._b2js_distance_joint_set_length(jointHandle(joint), Number(length));
      },
      getDistanceJointLength: function (joint) {
        return Module._b2js_distance_joint_get_length(jointHandle(joint));
      },
      enableDistanceJointSpring: function (joint, enabled) {
        Module._b2js_distance_joint_enable_spring(jointHandle(joint), enabled ? 1 : 0);
      },
      isDistanceJointSpringEnabled: function (joint) {
        return !!Module._b2js_distance_joint_is_spring_enabled(jointHandle(joint));
      },
      setDistanceJointSpringForceRange: function (joint, lowerForce, upperForce) {
        Module._b2js_distance_joint_set_spring_force_range(jointHandle(joint), Number(lowerForce), Number(upperForce));
      },
      getDistanceJointSpringForceRange: function (joint) {
        var handle = jointHandle(joint);
        return {
          lower: Module._b2js_distance_joint_get_lower_spring_force(handle),
          upper: Module._b2js_distance_joint_get_upper_spring_force(handle),
        };
      },
      setDistanceJointSpringHertz: function (joint, hertz) {
        Module._b2js_distance_joint_set_spring_hertz(jointHandle(joint), Number(hertz));
      },
      getDistanceJointSpringHertz: function (joint) {
        return Module._b2js_distance_joint_get_spring_hertz(jointHandle(joint));
      },
      setDistanceJointSpringDampingRatio: function (joint, dampingRatio) {
        Module._b2js_distance_joint_set_spring_damping_ratio(jointHandle(joint), Number(dampingRatio));
      },
      getDistanceJointSpringDampingRatio: function (joint) {
        return Module._b2js_distance_joint_get_spring_damping_ratio(jointHandle(joint));
      },
      enableDistanceJointLimit: function (joint, enabled) {
        Module._b2js_distance_joint_enable_limit(jointHandle(joint), enabled ? 1 : 0);
      },
      isDistanceJointLimitEnabled: function (joint) {
        return !!Module._b2js_distance_joint_is_limit_enabled(jointHandle(joint));
      },
      setDistanceJointLengthRange: function (joint, minLength, maxLength) {
        Module._b2js_distance_joint_set_length_range(jointHandle(joint), Number(minLength), Number(maxLength));
      },
      getDistanceJointMinLength: function (joint) {
        return Module._b2js_distance_joint_get_min_length(jointHandle(joint));
      },
      getDistanceJointMaxLength: function (joint) {
        return Module._b2js_distance_joint_get_max_length(jointHandle(joint));
      },
      getDistanceJointCurrentLength: function (joint) {
        return Module._b2js_distance_joint_get_current_length(jointHandle(joint));
      },
      enableDistanceJointMotor: function (joint, enabled) {
        Module._b2js_distance_joint_enable_motor(jointHandle(joint), enabled ? 1 : 0);
      },
      isDistanceJointMotorEnabled: function (joint) {
        return !!Module._b2js_distance_joint_is_motor_enabled(jointHandle(joint));
      },
      setDistanceJointMotorSpeed: function (joint, motorSpeed) {
        Module._b2js_distance_joint_set_motor_speed(jointHandle(joint), Number(motorSpeed));
      },
      getDistanceJointMotorSpeed: function (joint) {
        return Module._b2js_distance_joint_get_motor_speed(jointHandle(joint));
      },
      setDistanceJointMaxMotorForce: function (joint, force) {
        Module._b2js_distance_joint_set_max_motor_force(jointHandle(joint), Number(force));
      },
      getDistanceJointMaxMotorForce: function (joint) {
        return Module._b2js_distance_joint_get_max_motor_force(jointHandle(joint));
      },
      getDistanceJointMotorForce: function (joint) {
        return Module._b2js_distance_joint_get_motor_force(jointHandle(joint));
      },
      enableRevoluteJointSpring: function (joint, enabled) {
        Module._b2js_revolute_joint_enable_spring(jointHandle(joint), enabled ? 1 : 0);
      },
      isRevoluteJointSpringEnabled: function (joint) {
        return !!Module._b2js_revolute_joint_is_spring_enabled(jointHandle(joint));
      },
      setRevoluteJointSpringHertz: function (joint, hertz) {
        Module._b2js_revolute_joint_set_spring_hertz(jointHandle(joint), Number(hertz));
      },
      getRevoluteJointSpringHertz: function (joint) {
        return Module._b2js_revolute_joint_get_spring_hertz(jointHandle(joint));
      },
      setRevoluteJointSpringDampingRatio: function (joint, dampingRatio) {
        Module._b2js_revolute_joint_set_spring_damping_ratio(jointHandle(joint), Number(dampingRatio));
      },
      getRevoluteJointSpringDampingRatio: function (joint) {
        return Module._b2js_revolute_joint_get_spring_damping_ratio(jointHandle(joint));
      },
      setRevoluteJointTargetAngle: function (joint, angle) {
        Module._b2js_revolute_joint_set_target_angle(jointHandle(joint), Number(angle));
      },
      getRevoluteJointTargetAngle: function (joint) {
        return Module._b2js_revolute_joint_get_target_angle(jointHandle(joint));
      },
      getRevoluteJointAngle: function (joint) {
        return Module._b2js_revolute_joint_get_angle(jointHandle(joint));
      },
      enableRevoluteJointLimit: function (joint, enabled) {
        Module._b2js_revolute_joint_enable_limit(jointHandle(joint), enabled ? 1 : 0);
      },
      isRevoluteJointLimitEnabled: function (joint) {
        return !!Module._b2js_revolute_joint_is_limit_enabled(jointHandle(joint));
      },
      getRevoluteJointLowerLimit: function (joint) {
        return Module._b2js_revolute_joint_get_lower_limit(jointHandle(joint));
      },
      getRevoluteJointUpperLimit: function (joint) {
        return Module._b2js_revolute_joint_get_upper_limit(jointHandle(joint));
      },
      setRevoluteJointLimits: function (joint, lower, upper) {
        Module._b2js_revolute_joint_set_limits(jointHandle(joint), Number(lower), Number(upper));
      },
      enableRevoluteJointMotor: function (joint, enabled) {
        Module._b2js_revolute_joint_enable_motor(jointHandle(joint), enabled ? 1 : 0);
      },
      isRevoluteJointMotorEnabled: function (joint) {
        return !!Module._b2js_revolute_joint_is_motor_enabled(jointHandle(joint));
      },
      setRevoluteJointMotorSpeed: function (joint, motorSpeed) {
        Module._b2js_revolute_joint_set_motor_speed(jointHandle(joint), Number(motorSpeed));
      },
      getRevoluteJointMotorSpeed: function (joint) {
        return Module._b2js_revolute_joint_get_motor_speed(jointHandle(joint));
      },
      getRevoluteJointMotorTorque: function (joint) {
        return Module._b2js_revolute_joint_get_motor_torque(jointHandle(joint));
      },
      setRevoluteJointMaxMotorTorque: function (joint, torque) {
        Module._b2js_revolute_joint_set_max_motor_torque(jointHandle(joint), Number(torque));
      },
      getRevoluteJointMaxMotorTorque: function (joint) {
        return Module._b2js_revolute_joint_get_max_motor_torque(jointHandle(joint));
      },
      step: step,
      getBodyPosition: getBodyPosition,
      getBodyVelocity: getBodyVelocity,
      getBodyTransform: getBodyTransform,
      getBodyMass: function (body) {
        return Module._b2js_body_get_mass(handleValue(body, "body"));
      },
      readBodyTransforms: readBodyTransforms,
    };

    return api;
  }

  Box2D.default = Box2D;
  return Box2D;
});
