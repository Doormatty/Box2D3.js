(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.Box2DWireframe = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var DEFAULT_STYLE = Object.freeze({
    stroke: "#111827",
    fill: null,
    lineWidth: 2,
  });

  function readNumber(value, fallback) {
    return Number(value == null ? fallback : value);
  }

  function readVec2(value, fallbackX, fallbackY) {
    value = value || {};
    return {
      x: readNumber(value.x, fallbackX),
      y: readNumber(value.y, fallbackY),
    };
  }

  function cloneVec2(value) {
    return { x: Number(value.x), y: Number(value.y) };
  }

  function cloneVec2Array(points) {
    if (!Array.isArray(points) && !ArrayBuffer.isView(points)) {
      throw new TypeError("points must be an array");
    }

    if (ArrayBuffer.isView(points) || typeof points[0] === "number") {
      if (points.length % 2 !== 0) {
        throw new Error("flat point arrays must contain x/y pairs");
      }

      var flatPoints = [];
      for (var i = 0; i < points.length; i += 2) {
        flatPoints.push({ x: Number(points[i]), y: Number(points[i + 1]) });
      }
      return flatPoints;
    }

    return points.map(function (point) {
      return Array.isArray(point)
        ? { x: Number(point[0]), y: Number(point[1]) }
        : cloneVec2(point);
    });
  }

  function cross(origin, a, b) {
    return (a.x - origin.x) * (b.y - origin.y) - (a.y - origin.y) * (b.x - origin.x);
  }

  function convexHull(points) {
    var sorted = cloneVec2Array(points).sort(function (a, b) {
      return a.x === b.x ? a.y - b.y : a.x - b.x;
    });
    var unique = [];

    for (var i = 0; i < sorted.length; ++i) {
      var point = sorted[i];
      var previous = unique[unique.length - 1];
      if (!previous || previous.x !== point.x || previous.y !== point.y) {
        unique.push(point);
      }
    }

    if (unique.length < 3) {
      return unique;
    }

    var lower = [];
    for (var li = 0; li < unique.length; ++li) {
      while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], unique[li]) <= 0) {
        lower.pop();
      }
      lower.push(unique[li]);
    }

    var upper = [];
    for (var ui = unique.length - 1; ui >= 0; --ui) {
      while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], unique[ui]) <= 0) {
        upper.pop();
      }
      upper.push(unique[ui]);
    }

    lower.pop();
    upper.pop();
    return lower.concat(upper);
  }

  function mergeStyle(style) {
    style = style || {};
    return {
      stroke: style.stroke == null ? DEFAULT_STYLE.stroke : style.stroke,
      fill: style.fill == null ? DEFAULT_STYLE.fill : style.fill,
      lineWidth: readNumber(style.lineWidth, DEFAULT_STYLE.lineWidth),
    };
  }

  function createBody(b2, world, def) {
    def = def || {};
    if (def.body) {
      return def.body;
    }

    var bodyDef = def.bodyDef || {
      type: def.type,
      position: def.position,
      angle: def.angle,
    };

    return b2.createBody(world, bodyDef);
  }

  function createDrawable(manager, world, def, shapes) {
    def = def || {};
    var drawable = {
      id: def.id == null ? "drawable-" + manager.drawables.length : String(def.id),
      body: shapes.body,
      transformIndex: manager.drawables.length,
      style: mergeStyle(def.style),
      shapes: shapes.shapes,
    };

    if (world) {
      drawable.world = world;
    }

    manager.drawables.push(drawable);
    manager._transformsDirty = true;
    return drawable;
  }

  function makeBoxVertices(hx, hy) {
    return [
      { x: -hx, y: -hy },
      { x: hx, y: -hy },
      { x: hx, y: hy },
      { x: -hx, y: hy },
    ];
  }

  function createWireframe(b2) {
    if (!b2 || typeof b2.createBody !== "function" || typeof b2.readBodyTransforms !== "function") {
      throw new TypeError("A Box2D v3 wrapper instance is required");
    }

    var manager = {
      b2: b2,
      drawables: [],
      bodies: [],
      transforms: new Float32Array(0),
      _transformsDirty: true,

      createWireBox: function (world, def) {
        def = def || {};
        var body = createBody(b2, world, def);
        var hx = readNumber(def.hx == null ? def.halfWidth : def.hx, 0.5);
        var hy = readNumber(def.hy == null ? def.halfHeight : def.hy, 0.5);
        var shape = b2.createBoxShape(body, Object.assign({}, def, { hx: hx, hy: hy }));

        return createDrawable(this, world, def, {
          body: body,
          shapes: [{ type: "polygon", vertices: makeBoxVertices(hx, hy), shape: shape }],
        });
      },

      createWirePolygon: function (world, def) {
        def = def || {};
        var body = createBody(b2, world, def);
        var vertices = def.normalizeHull === false ? cloneVec2Array(def.vertices) : convexHull(def.vertices);
        var shape = b2.createPolygonShape(body, Object.assign({}, def, { vertices: vertices }));

        return createDrawable(this, world, def, {
          body: body,
          shapes: [{ type: "polygon", vertices: vertices, shape: shape }],
        });
      },

      createWireCircle: function (world, def) {
        def = def || {};
        var body = createBody(b2, world, def);
        var center = readVec2(def.center, 0, 0);
        var radius = readNumber(def.radius, 0.5);
        var shape = b2.createCircleShape(body, Object.assign({}, def, { center: center, radius: radius }));

        return createDrawable(this, world, def, {
          body: body,
          shapes: [{ type: "circle", center: center, radius: radius, shape: shape }],
        });
      },

      createWireCapsule: function (world, def) {
        def = def || {};
        var body = createBody(b2, world, def);
        var center1 = readVec2(def.center1 || def.p1, 0, -0.5);
        var center2 = readVec2(def.center2 || def.p2, 0, 0.5);
        var radius = readNumber(def.radius, 0.25);
        var shape = b2.createCapsuleShape(body, Object.assign({}, def, {
          center1: center1,
          center2: center2,
          radius: radius,
        }));

        return createDrawable(this, world, def, {
          body: body,
          shapes: [{ type: "capsule", center1: center1, center2: center2, radius: radius, shape: shape }],
        });
      },

      createWireSegmentBody: function (world, def) {
        def = def || {};
        var body = createBody(b2, world, Object.assign({ type: b2.staticBody }, def));
        var p1 = readVec2(def.p1, 0, 0);
        var p2 = readVec2(def.p2, 0, 0);
        var shape = b2.createSegmentShape(body, Object.assign({}, def, { p1: p1, p2: p2 }));

        return createDrawable(this, world, def, {
          body: body,
          shapes: [{ type: "segment", p1: p1, p2: p2, shape: shape }],
        });
      },

      createWireChain: function (world, def) {
        def = def || {};
        var body = createBody(b2, world, Object.assign({ type: b2.staticBody }, def));
        var points = cloneVec2Array(def.points || def.vertices);
        var chain = b2.createChain(body, Object.assign({}, def, { vertices: points }));

        return createDrawable(this, world, def, {
          body: body,
          shapes: [{ type: "chain", points: points, isLoop: !!(def.isLoop || def.loop), chain: chain }],
        });
      },

      rebuildTransformList: function () {
        for (var i = 0; i < this.drawables.length; ++i) {
          this.drawables[i].transformIndex = i;
          this.bodies[i] = this.drawables[i].body;
        }
        this.bodies.length = this.drawables.length;

        if (this.transforms.length < this.drawables.length * 3) {
          this.transforms = new Float32Array(this.drawables.length * 3);
        }

        this._transformsDirty = false;
        return this.bodies;
      },

      syncTransforms: function () {
        if (this._transformsDirty) {
          this.rebuildTransformList();
        }

        if (this.bodies.length === 0) {
          return this.transforms;
        }

        return b2.readBodyTransforms(this.bodies, this.transforms);
      },

      getTransform: function (drawable) {
        var index = drawable.transformIndex * 3;
        return {
          x: this.transforms[index],
          y: this.transforms[index + 1],
          angle: this.transforms[index + 2],
        };
      },

      removeDrawable: function (drawable) {
        var index = this.drawables.indexOf(drawable);
        if (index !== -1) {
          this.drawables.splice(index, 1);
          this._transformsDirty = true;
        }
      },

      draw: function (ctx, options) {
        options = options || {};
        this.syncTransforms();
        drawWireframes(ctx, this.drawables, this.transforms, options);
      },
    };

    return manager;
  }

  function drawWireframes(ctx, drawables, transforms, options) {
    options = options || {};
    var scale = readNumber(options.pixelsPerMeter || options.scale, 1);
    var offsetX = readNumber(options.offsetX, 0);
    var offsetY = readNumber(options.offsetY, 0);
    var flipY = options.flipY !== false;

    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, flipY ? -scale : scale);

    for (var i = 0; i < drawables.length; ++i) {
      drawDrawable(ctx, drawables[i], transforms, i, scale);
    }

    ctx.restore();
  }

  function drawDrawable(ctx, drawable, transforms, fallbackIndex, scale) {
    var transformIndex = drawable.transformIndex == null ? fallbackIndex : drawable.transformIndex;
    var offset = transformIndex * 3;
    var style = drawable.style || DEFAULT_STYLE;

    ctx.save();
    ctx.translate(transforms[offset], transforms[offset + 1]);
    ctx.rotate(transforms[offset + 2]);
    ctx.lineWidth = style.lineWidth / scale;
    ctx.strokeStyle = style.stroke;
    if (style.fill) {
      ctx.fillStyle = style.fill;
    }

    for (var i = 0; i < drawable.shapes.length; ++i) {
      drawLocalShape(ctx, drawable.shapes[i], !!style.fill);
    }

    ctx.restore();
  }

  function drawLocalShape(ctx, shape, fill) {
    switch (shape.type) {
      case "polygon":
        drawWirePolygon(ctx, shape.vertices, fill);
        break;
      case "circle":
        drawWireCircle(ctx, shape.center, shape.radius, fill);
        break;
      case "segment":
        drawWireSegment(ctx, shape.p1, shape.p2);
        break;
      case "chain":
        drawWireChain(ctx, shape.points, shape.isLoop);
        break;
      case "capsule":
        drawWireCapsule(ctx, shape.center1, shape.center2, shape.radius, fill);
        break;
      default:
        throw new Error("Unknown wire shape type: " + shape.type);
    }
  }

  function drawWirePolygon(ctx, vertices, fill) {
    if (!vertices.length) {
      return;
    }

    ctx.beginPath();
    ctx.moveTo(vertices[0].x, vertices[0].y);
    for (var i = 1; i < vertices.length; ++i) {
      ctx.lineTo(vertices[i].x, vertices[i].y);
    }
    ctx.closePath();
    if (fill) {
      ctx.fill();
    }
    ctx.stroke();
  }

  function drawWireCircle(ctx, center, radius, fill) {
    ctx.beginPath();
    ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
    if (fill) {
      ctx.fill();
    }
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(center.x, center.y);
    ctx.lineTo(center.x + radius, center.y);
    ctx.stroke();
  }

  function drawWireSegment(ctx, p1, p2) {
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
  }

  function drawWireChain(ctx, points, isLoop) {
    if (!points.length) {
      return;
    }

    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (var i = 1; i < points.length; ++i) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    if (isLoop) {
      ctx.closePath();
    }
    ctx.stroke();
  }

  function drawWireCapsule(ctx, center1, center2, radius, fill) {
    var dx = center2.x - center1.x;
    var dy = center2.y - center1.y;
    var length = Math.sqrt(dx * dx + dy * dy);

    if (length <= 0) {
      drawWireCircle(ctx, center1, radius, fill);
      return;
    }

    var nx = -dy / length;
    var ny = dx / length;
    var angle = Math.atan2(dy, dx);

    ctx.beginPath();
    ctx.moveTo(center1.x + nx * radius, center1.y + ny * radius);
    ctx.lineTo(center2.x + nx * radius, center2.y + ny * radius);
    ctx.arc(center2.x, center2.y, radius, angle + Math.PI / 2, angle - Math.PI / 2);
    ctx.lineTo(center1.x - nx * radius, center1.y - ny * radius);
    ctx.arc(center1.x, center1.y, radius, angle - Math.PI / 2, angle + Math.PI / 2);
    ctx.closePath();
    if (fill) {
      ctx.fill();
    }
    ctx.stroke();
  }

  return {
    createWireframe: createWireframe,
    convexHull: convexHull,
    drawWireframes: drawWireframes,
  };
});
