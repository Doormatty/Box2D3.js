#include <box2d/box2d.h>
#include <emscripten/emscripten.h>

#include <math.h>
#include <stdbool.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>

typedef struct WorldSlot
{
	bool used;
	b2WorldId id;
} WorldSlot;

typedef struct BodySlot
{
	bool used;
	int worldHandle;
	b2BodyId id;
} BodySlot;

typedef struct ShapeSlot
{
	bool used;
	int worldHandle;
	int bodyHandle;
	b2ShapeId id;
} ShapeSlot;

typedef struct JointSlot
{
	bool used;
	int worldHandle;
	int bodyHandleA;
	int bodyHandleB;
	int type;
	b2JointId id;
} JointSlot;

static WorldSlot* worlds = NULL;
static BodySlot* bodies = NULL;
static ShapeSlot* shapes = NULL;
static JointSlot* joints = NULL;
static int worldCapacity = 0;
static int bodyCapacity = 0;
static int shapeCapacity = 0;
static int jointCapacity = 0;
static const float b2js_minLength = 0.005f;

static bool grow_slots( void** slots, int* capacity, int slotSize )
{
	int oldCapacity = *capacity;
	int newCapacity = oldCapacity == 0 ? 16 : oldCapacity * 2;
	void* newSlots = realloc( *slots, (size_t)newCapacity * (size_t)slotSize );
	if ( newSlots == NULL )
	{
		return false;
	}

	memset( (char*)newSlots + (size_t)oldCapacity * (size_t)slotSize, 0, (size_t)( newCapacity - oldCapacity ) * (size_t)slotSize );
	*slots = newSlots;
	*capacity = newCapacity;
	return true;
}

static int alloc_world_slot( b2WorldId id )
{
	for ( int i = 1; i < worldCapacity; ++i )
	{
		if ( worlds[i].used == false )
		{
			worlds[i] = (WorldSlot){ true, id };
			return i;
		}
	}

	if ( grow_slots( (void**)&worlds, &worldCapacity, (int)sizeof( WorldSlot ) ) == false )
	{
		return 0;
	}

	worlds[worldCapacity / 2] = (WorldSlot){ true, id };
	return worldCapacity / 2;
}

static int alloc_body_slot( int worldHandle, b2BodyId id )
{
	for ( int i = 1; i < bodyCapacity; ++i )
	{
		if ( bodies[i].used == false )
		{
			bodies[i] = (BodySlot){ true, worldHandle, id };
			return i;
		}
	}

	if ( grow_slots( (void**)&bodies, &bodyCapacity, (int)sizeof( BodySlot ) ) == false )
	{
		return 0;
	}

	bodies[bodyCapacity / 2] = (BodySlot){ true, worldHandle, id };
	return bodyCapacity / 2;
}

static int alloc_shape_slot( int worldHandle, int bodyHandle, b2ShapeId id )
{
	for ( int i = 1; i < shapeCapacity; ++i )
	{
		if ( shapes[i].used == false )
		{
			shapes[i] = (ShapeSlot){ true, worldHandle, bodyHandle, id };
			return i;
		}
	}

	if ( grow_slots( (void**)&shapes, &shapeCapacity, (int)sizeof( ShapeSlot ) ) == false )
	{
		return 0;
	}

	shapes[shapeCapacity / 2] = (ShapeSlot){ true, worldHandle, bodyHandle, id };
	return shapeCapacity / 2;
}

static int alloc_joint_slot( int worldHandle, int bodyHandleA, int bodyHandleB, int type, b2JointId id )
{
	for ( int i = 1; i < jointCapacity; ++i )
	{
		if ( joints[i].used == false )
		{
			joints[i] = (JointSlot){ true, worldHandle, bodyHandleA, bodyHandleB, type, id };
			return i;
		}
	}

	if ( grow_slots( (void**)&joints, &jointCapacity, (int)sizeof( JointSlot ) ) == false )
	{
		return 0;
	}

	joints[jointCapacity / 2] = (JointSlot){ true, worldHandle, bodyHandleA, bodyHandleB, type, id };
	return jointCapacity / 2;
}

static b2WorldId* get_world( int handle )
{
	if ( handle <= 0 || handle >= worldCapacity || worlds[handle].used == false )
	{
		return NULL;
	}

	return &worlds[handle].id;
}

static b2BodyId* get_body( int handle )
{
	if ( handle <= 0 || handle >= bodyCapacity || bodies[handle].used == false )
	{
		return NULL;
	}

	return &bodies[handle].id;
}

static b2JointId* get_joint( int handle )
{
	if ( handle <= 0 || handle >= jointCapacity || joints[handle].used == false )
	{
		return NULL;
	}

	return &joints[handle].id;
}

static b2JointId* get_joint_of_type( int handle, b2JointType type )
{
	b2JointId* joint = get_joint( handle );
	if ( joint == NULL || joints[handle].type != (int)type )
	{
		return NULL;
	}

	return joint;
}

static void set_joint_base_options( b2JointDef* def, float constraintHertz, float constraintDampingRatio, float forceThreshold,
									float torqueThreshold, float drawScale )
{
	if ( isfinite( constraintHertz ) && constraintHertz >= 0.0f )
	{
		def->constraintHertz = constraintHertz;
	}

	if ( isfinite( constraintDampingRatio ) && constraintDampingRatio >= 0.0f )
	{
		def->constraintDampingRatio = constraintDampingRatio;
	}

	if ( isfinite( forceThreshold ) && forceThreshold >= 0.0f )
	{
		def->forceThreshold = forceThreshold;
	}

	if ( isfinite( torqueThreshold ) && torqueThreshold >= 0.0f )
	{
		def->torqueThreshold = torqueThreshold;
	}

	if ( isfinite( drawScale ) && drawScale > 0.0f )
	{
		def->drawScale = drawScale;
	}
}

static b2ShapeDef make_shape_def( float density, float friction, int groupIndex )
{
	b2ShapeDef def = b2DefaultShapeDef();

	if ( isfinite( density ) && density >= 0.0f )
	{
		def.density = density;
	}

	if ( isfinite( friction ) && friction >= 0.0f )
	{
		def.material.friction = friction;
	}

	def.filter.groupIndex = groupIndex;
	return def;
}

EMSCRIPTEN_KEEPALIVE int b2js_create_world( float gravityX, float gravityY )
{
	b2WorldDef def = b2DefaultWorldDef();
	def.gravity = (b2Vec2){ gravityX, gravityY };
	def.workerCount = 1;

	b2WorldId id = b2CreateWorld( &def );
	int handle = alloc_world_slot( id );
	if ( handle == 0 )
	{
		b2DestroyWorld( id );
	}

	return handle;
}

EMSCRIPTEN_KEEPALIVE void b2js_destroy_world( int worldHandle )
{
	b2WorldId* world = get_world( worldHandle );
	if ( world == NULL )
	{
		return;
	}

	b2DestroyWorld( *world );
	worlds[worldHandle].used = false;

	for ( int i = 1; i < bodyCapacity; ++i )
	{
		if ( bodies[i].worldHandle == worldHandle )
		{
			bodies[i].used = false;
		}
	}

	for ( int i = 1; i < shapeCapacity; ++i )
	{
		if ( shapes[i].worldHandle == worldHandle )
		{
			shapes[i].used = false;
		}
	}

	for ( int i = 1; i < jointCapacity; ++i )
	{
		if ( joints[i].worldHandle == worldHandle )
		{
			joints[i].used = false;
		}
	}
}

EMSCRIPTEN_KEEPALIVE int b2js_create_body( int worldHandle, int type, float x, float y, float angle )
{
	b2WorldId* world = get_world( worldHandle );
	if ( world == NULL )
	{
		return 0;
	}

	if ( type < b2_staticBody || type >= b2_bodyTypeCount || isfinite( x ) == false || isfinite( y ) == false || isfinite( angle ) == false )
	{
		return 0;
	}

	b2BodyDef def = b2DefaultBodyDef();
	def.type = (b2BodyType)type;
	def.position = (b2Vec2){ x, y };
	def.rotation = b2MakeRot( angle );

	b2BodyId id = b2CreateBody( *world, &def );
	int handle = alloc_body_slot( worldHandle, id );
	if ( handle == 0 )
	{
		b2DestroyBody( id );
	}

	return handle;
}

EMSCRIPTEN_KEEPALIVE void b2js_destroy_body( int bodyHandle )
{
	b2BodyId* body = get_body( bodyHandle );
	if ( body == NULL )
	{
		return;
	}

	b2DestroyBody( *body );
	bodies[bodyHandle].used = false;

	for ( int i = 1; i < shapeCapacity; ++i )
	{
		if ( shapes[i].bodyHandle == bodyHandle )
		{
			shapes[i].used = false;
		}
	}

	for ( int i = 1; i < jointCapacity; ++i )
	{
		if ( joints[i].bodyHandleA == bodyHandle || joints[i].bodyHandleB == bodyHandle )
		{
			joints[i].used = false;
		}
	}
}

EMSCRIPTEN_KEEPALIVE int b2js_create_box_shape( int bodyHandle, float halfWidth, float halfHeight, float density, float friction, int groupIndex )
{
	b2BodyId* body = get_body( bodyHandle );
	if ( body == NULL || isfinite( halfWidth ) == false || isfinite( halfHeight ) == false || halfWidth <= 0.0f || halfHeight <= 0.0f )
	{
		return 0;
	}

	b2Polygon box = b2MakeBox( halfWidth, halfHeight );
	b2ShapeDef def = make_shape_def( density, friction, groupIndex );
	b2ShapeId id = b2CreatePolygonShape( *body, &def, &box );
	int handle = alloc_shape_slot( bodies[bodyHandle].worldHandle, bodyHandle, id );
	if ( handle == 0 )
	{
		b2DestroyShape( id, true );
	}

	return handle;
}

EMSCRIPTEN_KEEPALIVE int b2js_create_circle_shape( int bodyHandle, float centerX, float centerY, float radius, float density, float friction, int groupIndex )
{
	b2BodyId* body = get_body( bodyHandle );
	if ( body == NULL || isfinite( centerX ) == false || isfinite( centerY ) == false || isfinite( radius ) == false || radius <= 0.0f )
	{
		return 0;
	}

	b2Circle circle = { { centerX, centerY }, radius };
	b2ShapeDef def = make_shape_def( density, friction, groupIndex );
	b2ShapeId id = b2CreateCircleShape( *body, &def, &circle );
	int handle = alloc_shape_slot( bodies[bodyHandle].worldHandle, bodyHandle, id );
	if ( handle == 0 )
	{
		b2DestroyShape( id, true );
	}

	return handle;
}

EMSCRIPTEN_KEEPALIVE int b2js_create_segment_shape( int bodyHandle, float x1, float y1, float x2, float y2, float friction, int groupIndex )
{
	b2BodyId* body = get_body( bodyHandle );
	if ( body == NULL )
	{
		return 0;
	}

	if ( isfinite( x1 ) == false || isfinite( y1 ) == false || isfinite( x2 ) == false || isfinite( y2 ) == false )
	{
		return 0;
	}

	b2Segment segment = { { x1, y1 }, { x2, y2 } };
	b2ShapeDef def = make_shape_def( 0.0f, friction, groupIndex );
	b2ShapeId id = b2CreateSegmentShape( *body, &def, &segment );
	int handle = alloc_shape_slot( bodies[bodyHandle].worldHandle, bodyHandle, id );
	if ( handle == 0 )
	{
		b2DestroyShape( id, true );
	}

	return handle;
}

EMSCRIPTEN_KEEPALIVE int b2js_create_polygon_shape( int bodyHandle, const float* vertices, int vertexCount, float density, float friction, int groupIndex )
{
	b2BodyId* body = get_body( bodyHandle );
	if ( body == NULL || vertices == NULL || vertexCount < 3 || vertexCount > B2_MAX_POLYGON_VERTICES )
	{
		return 0;
	}

	b2Vec2 points[B2_MAX_POLYGON_VERTICES];
	for ( int i = 0; i < vertexCount; ++i )
	{
		points[i] = (b2Vec2){ vertices[i * 2], vertices[i * 2 + 1] };
		if ( isfinite( points[i].x ) == false || isfinite( points[i].y ) == false )
		{
			return 0;
		}
	}

	b2Hull hull = b2ComputeHull( points, vertexCount );
	if ( hull.count == 0 )
	{
		return 0;
	}

	b2Polygon polygon = b2MakePolygon( &hull, 0.0f );
	b2ShapeDef def = make_shape_def( density, friction, groupIndex );
	b2ShapeId id = b2CreatePolygonShape( *body, &def, &polygon );
	int handle = alloc_shape_slot( bodies[bodyHandle].worldHandle, bodyHandle, id );
	if ( handle == 0 )
	{
		b2DestroyShape( id, true );
	}

	return handle;
}

EMSCRIPTEN_KEEPALIVE int b2js_create_distance_joint( int worldHandle, int bodyHandleA, int bodyHandleB, int useLocalAnchors, float anchorAX,
													 float anchorAY, float anchorBX, float anchorBY, float length, int enableSpring,
													 float lowerSpringForce, float upperSpringForce, float hertz, float dampingRatio,
													 int enableLimit, float minLength, float maxLength, int enableMotor,
													 float maxMotorForce, float motorSpeed, int collideConnected, float constraintHertz,
													 float constraintDampingRatio, float forceThreshold, float torqueThreshold, float drawScale )
{
	b2WorldId* world = get_world( worldHandle );
	b2BodyId* bodyA = get_body( bodyHandleA );
	b2BodyId* bodyB = get_body( bodyHandleB );
	if ( world == NULL || bodyA == NULL || bodyB == NULL )
	{
		return 0;
	}

	if ( isfinite( anchorAX ) == false || isfinite( anchorAY ) == false || isfinite( anchorBX ) == false ||
		 isfinite( anchorBY ) == false )
	{
		return 0;
	}

	b2DistanceJointDef def = b2DefaultDistanceJointDef();
	def.base.bodyIdA = *bodyA;
	def.base.bodyIdB = *bodyB;
	def.base.collideConnected = collideConnected != 0;
	set_joint_base_options( &def.base, constraintHertz, constraintDampingRatio, forceThreshold, torqueThreshold, drawScale );

	b2Vec2 pointA = { anchorAX, anchorAY };
	b2Vec2 pointB = { anchorBX, anchorBY };
	if ( useLocalAnchors != 0 )
	{
		def.base.localFrameA.p = pointA;
		def.base.localFrameB.p = pointB;
		pointA = b2Body_GetWorldPoint( *bodyA, def.base.localFrameA.p );
		pointB = b2Body_GetWorldPoint( *bodyB, def.base.localFrameB.p );
	}
	else
	{
		def.base.localFrameA.p = b2Body_GetLocalPoint( *bodyA, pointA );
		def.base.localFrameB.p = b2Body_GetLocalPoint( *bodyB, pointB );
	}

	if ( isfinite( length ) && length > 0.0f )
	{
		def.length = length;
	}
	else
	{
		def.length = b2MaxFloat( b2Distance( pointA, pointB ), b2js_minLength );
	}

	def.enableSpring = enableSpring != 0;
	if ( isfinite( lowerSpringForce ) && isfinite( upperSpringForce ) && lowerSpringForce <= upperSpringForce )
	{
		def.lowerSpringForce = lowerSpringForce;
		def.upperSpringForce = upperSpringForce;
	}

	if ( isfinite( hertz ) && hertz >= 0.0f )
	{
		def.hertz = hertz;
	}

	if ( isfinite( dampingRatio ) && dampingRatio >= 0.0f )
	{
		def.dampingRatio = dampingRatio;
	}

	def.enableLimit = enableLimit != 0;
	if ( isfinite( minLength ) && isfinite( maxLength ) && minLength > 0.0f && maxLength > 0.0f )
	{
		def.minLength = b2MinFloat( minLength, maxLength );
		def.maxLength = b2MaxFloat( minLength, maxLength );
	}

	def.enableMotor = enableMotor != 0;
	if ( isfinite( maxMotorForce ) && maxMotorForce >= 0.0f )
	{
		def.maxMotorForce = maxMotorForce;
	}

	if ( isfinite( motorSpeed ) )
	{
		def.motorSpeed = motorSpeed;
	}

	b2JointId id = b2CreateDistanceJoint( *world, &def );
	int handle = alloc_joint_slot( worldHandle, bodyHandleA, bodyHandleB, b2_distanceJoint, id );
	if ( handle == 0 )
	{
		b2DestroyJoint( id, true );
	}

	return handle;
}

EMSCRIPTEN_KEEPALIVE int b2js_create_revolute_joint( int worldHandle, int bodyHandleA, int bodyHandleB, int useLocalAnchors,
													 float anchorAX, float anchorAY, float anchorBX, float anchorBY, float localAngleA,
													 float localAngleB, float targetAngle, int enableSpring, float hertz,
													 float dampingRatio, int enableLimit, float lowerAngle, float upperAngle,
													 int enableMotor, float motorSpeed, float maxMotorTorque, int collideConnected,
													 float constraintHertz, float constraintDampingRatio, float forceThreshold,
													 float torqueThreshold, float drawScale )
{
	b2WorldId* world = get_world( worldHandle );
	b2BodyId* bodyA = get_body( bodyHandleA );
	b2BodyId* bodyB = get_body( bodyHandleB );
	if ( world == NULL || bodyA == NULL || bodyB == NULL )
	{
		return 0;
	}

	if ( isfinite( anchorAX ) == false || isfinite( anchorAY ) == false || isfinite( anchorBX ) == false ||
		 isfinite( anchorBY ) == false || isfinite( localAngleA ) == false || isfinite( localAngleB ) == false )
	{
		return 0;
	}

	b2RevoluteJointDef def = b2DefaultRevoluteJointDef();
	def.base.bodyIdA = *bodyA;
	def.base.bodyIdB = *bodyB;
	if ( useLocalAnchors != 0 )
	{
		def.base.localFrameA.p = (b2Vec2){ anchorAX, anchorAY };
		def.base.localFrameB.p = (b2Vec2){ anchorBX, anchorBY };
	}
	else
	{
		def.base.localFrameA.p = b2Body_GetLocalPoint( *bodyA, (b2Vec2){ anchorAX, anchorAY } );
		def.base.localFrameB.p = b2Body_GetLocalPoint( *bodyB, (b2Vec2){ anchorBX, anchorBY } );
	}

	def.base.localFrameA.q = b2MakeRot( localAngleA );
	def.base.localFrameB.q = b2MakeRot( localAngleB );
	def.base.collideConnected = collideConnected != 0;
	set_joint_base_options( &def.base, constraintHertz, constraintDampingRatio, forceThreshold, torqueThreshold, drawScale );
	if ( isfinite( targetAngle ) )
	{
		def.targetAngle = targetAngle;
	}

	def.enableSpring = enableSpring != 0;
	if ( isfinite( hertz ) && hertz >= 0.0f )
	{
		def.hertz = hertz;
	}

	if ( isfinite( dampingRatio ) && dampingRatio >= 0.0f )
	{
		def.dampingRatio = dampingRatio;
	}

	def.enableLimit = enableLimit != 0;
	if ( isfinite( lowerAngle ) && isfinite( upperAngle ) && lowerAngle >= -0.99f * B2_PI && lowerAngle <= 0.99f * B2_PI &&
		 upperAngle >= -0.99f * B2_PI && upperAngle <= 0.99f * B2_PI )
	{
		def.lowerAngle = b2MinFloat( lowerAngle, upperAngle );
		def.upperAngle = b2MaxFloat( lowerAngle, upperAngle );
	}

	def.enableMotor = enableMotor != 0;
	if ( isfinite( motorSpeed ) )
	{
		def.motorSpeed = motorSpeed;
	}

	if ( isfinite( maxMotorTorque ) && maxMotorTorque >= 0.0f )
	{
		def.maxMotorTorque = maxMotorTorque;
	}

	b2JointId id = b2CreateRevoluteJoint( *world, &def );
	int handle = alloc_joint_slot( worldHandle, bodyHandleA, bodyHandleB, b2_revoluteJoint, id );
	if ( handle == 0 )
	{
		b2DestroyJoint( id, true );
	}

	return handle;
}

EMSCRIPTEN_KEEPALIVE void b2js_revolute_joint_set_motor( int jointHandle, int enabled, float motorSpeed, float maxMotorTorque )
{
	b2JointId* joint = get_joint_of_type( jointHandle, b2_revoluteJoint );
	if ( joint == NULL || isfinite( motorSpeed ) == false || isfinite( maxMotorTorque ) == false || maxMotorTorque < 0.0f )
	{
		return;
	}

	b2RevoluteJoint_EnableMotor( *joint, enabled != 0 );
	b2RevoluteJoint_SetMotorSpeed( *joint, motorSpeed );
	b2RevoluteJoint_SetMaxMotorTorque( *joint, maxMotorTorque );
}

EMSCRIPTEN_KEEPALIVE void b2js_destroy_joint( int jointHandle, int wakeAttached )
{
	b2JointId* joint = get_joint( jointHandle );
	if ( joint == NULL )
	{
		return;
	}

	b2DestroyJoint( *joint, wakeAttached != 0 );
	joints[jointHandle].used = false;
}

EMSCRIPTEN_KEEPALIVE int b2js_joint_get_type( int jointHandle )
{
	return get_joint( jointHandle ) == NULL ? -1 : joints[jointHandle].type;
}

EMSCRIPTEN_KEEPALIVE void b2js_joint_wake_bodies( int jointHandle )
{
	b2JointId* joint = get_joint( jointHandle );
	if ( joint != NULL )
	{
		b2Joint_WakeBodies( *joint );
	}
}

EMSCRIPTEN_KEEPALIVE void b2js_joint_set_collide_connected( int jointHandle, int shouldCollide )
{
	b2JointId* joint = get_joint( jointHandle );
	if ( joint != NULL )
	{
		b2Joint_SetCollideConnected( *joint, shouldCollide != 0 );
	}
}

EMSCRIPTEN_KEEPALIVE int b2js_joint_get_collide_connected( int jointHandle )
{
	b2JointId* joint = get_joint( jointHandle );
	return joint == NULL ? 0 : b2Joint_GetCollideConnected( *joint );
}

EMSCRIPTEN_KEEPALIVE void b2js_joint_set_local_frame_a( int jointHandle, float x, float y, float angle )
{
	b2JointId* joint = get_joint( jointHandle );
	if ( joint == NULL || isfinite( x ) == false || isfinite( y ) == false || isfinite( angle ) == false )
	{
		return;
	}

	b2Joint_SetLocalFrameA( *joint, (b2Transform){ { x, y }, b2MakeRot( angle ) } );
}

EMSCRIPTEN_KEEPALIVE void b2js_joint_set_local_frame_b( int jointHandle, float x, float y, float angle )
{
	b2JointId* joint = get_joint( jointHandle );
	if ( joint == NULL || isfinite( x ) == false || isfinite( y ) == false || isfinite( angle ) == false )
	{
		return;
	}

	b2Joint_SetLocalFrameB( *joint, (b2Transform){ { x, y }, b2MakeRot( angle ) } );
}

static b2Transform get_local_frame_or_nan( int jointHandle, bool frameA )
{
	b2JointId* joint = get_joint( jointHandle );
	if ( joint == NULL )
	{
		return (b2Transform){ { NAN, NAN }, { NAN, NAN } };
	}

	return frameA ? b2Joint_GetLocalFrameA( *joint ) : b2Joint_GetLocalFrameB( *joint );
}

EMSCRIPTEN_KEEPALIVE float b2js_joint_get_local_frame_a_x( int jointHandle )
{
	return get_local_frame_or_nan( jointHandle, true ).p.x;
}

EMSCRIPTEN_KEEPALIVE float b2js_joint_get_local_frame_a_y( int jointHandle )
{
	return get_local_frame_or_nan( jointHandle, true ).p.y;
}

EMSCRIPTEN_KEEPALIVE float b2js_joint_get_local_frame_a_angle( int jointHandle )
{
	return b2Rot_GetAngle( get_local_frame_or_nan( jointHandle, true ).q );
}

EMSCRIPTEN_KEEPALIVE float b2js_joint_get_local_frame_b_x( int jointHandle )
{
	return get_local_frame_or_nan( jointHandle, false ).p.x;
}

EMSCRIPTEN_KEEPALIVE float b2js_joint_get_local_frame_b_y( int jointHandle )
{
	return get_local_frame_or_nan( jointHandle, false ).p.y;
}

EMSCRIPTEN_KEEPALIVE float b2js_joint_get_local_frame_b_angle( int jointHandle )
{
	return b2Rot_GetAngle( get_local_frame_or_nan( jointHandle, false ).q );
}

EMSCRIPTEN_KEEPALIVE void b2js_joint_set_constraint_tuning( int jointHandle, float hertz, float dampingRatio )
{
	b2JointId* joint = get_joint( jointHandle );
	if ( joint == NULL || isfinite( hertz ) == false || isfinite( dampingRatio ) == false || hertz < 0.0f || dampingRatio < 0.0f )
	{
		return;
	}

	b2Joint_SetConstraintTuning( *joint, hertz, dampingRatio );
}

EMSCRIPTEN_KEEPALIVE float b2js_joint_get_constraint_hertz( int jointHandle )
{
	b2JointId* joint = get_joint( jointHandle );
	if ( joint == NULL )
	{
		return NAN;
	}

	float hertz = NAN;
	float dampingRatio = NAN;
	b2Joint_GetConstraintTuning( *joint, &hertz, &dampingRatio );
	return hertz;
}

EMSCRIPTEN_KEEPALIVE float b2js_joint_get_constraint_damping_ratio( int jointHandle )
{
	b2JointId* joint = get_joint( jointHandle );
	if ( joint == NULL )
	{
		return NAN;
	}

	float hertz = NAN;
	float dampingRatio = NAN;
	b2Joint_GetConstraintTuning( *joint, &hertz, &dampingRatio );
	return dampingRatio;
}

EMSCRIPTEN_KEEPALIVE void b2js_joint_set_force_threshold( int jointHandle, float threshold )
{
	b2JointId* joint = get_joint( jointHandle );
	if ( joint != NULL && isfinite( threshold ) && threshold >= 0.0f )
	{
		b2Joint_SetForceThreshold( *joint, threshold );
	}
}

EMSCRIPTEN_KEEPALIVE float b2js_joint_get_force_threshold( int jointHandle )
{
	b2JointId* joint = get_joint( jointHandle );
	return joint == NULL ? NAN : b2Joint_GetForceThreshold( *joint );
}

EMSCRIPTEN_KEEPALIVE void b2js_joint_set_torque_threshold( int jointHandle, float threshold )
{
	b2JointId* joint = get_joint( jointHandle );
	if ( joint != NULL && isfinite( threshold ) && threshold >= 0.0f )
	{
		b2Joint_SetTorqueThreshold( *joint, threshold );
	}
}

EMSCRIPTEN_KEEPALIVE float b2js_joint_get_torque_threshold( int jointHandle )
{
	b2JointId* joint = get_joint( jointHandle );
	return joint == NULL ? NAN : b2Joint_GetTorqueThreshold( *joint );
}

static b2Vec2 get_constraint_force_or_nan( int jointHandle )
{
	b2JointId* joint = get_joint( jointHandle );
	return joint == NULL ? (b2Vec2){ NAN, NAN } : b2Joint_GetConstraintForce( *joint );
}

EMSCRIPTEN_KEEPALIVE float b2js_joint_get_constraint_force_x( int jointHandle )
{
	return get_constraint_force_or_nan( jointHandle ).x;
}

EMSCRIPTEN_KEEPALIVE float b2js_joint_get_constraint_force_y( int jointHandle )
{
	return get_constraint_force_or_nan( jointHandle ).y;
}

EMSCRIPTEN_KEEPALIVE float b2js_joint_get_constraint_torque( int jointHandle )
{
	b2JointId* joint = get_joint( jointHandle );
	return joint == NULL ? NAN : b2Joint_GetConstraintTorque( *joint );
}

EMSCRIPTEN_KEEPALIVE float b2js_joint_get_linear_separation( int jointHandle )
{
	b2JointId* joint = get_joint( jointHandle );
	return joint == NULL ? NAN : b2Joint_GetLinearSeparation( *joint );
}

EMSCRIPTEN_KEEPALIVE float b2js_joint_get_angular_separation( int jointHandle )
{
	b2JointId* joint = get_joint( jointHandle );
	return joint == NULL ? NAN : b2Joint_GetAngularSeparation( *joint );
}

EMSCRIPTEN_KEEPALIVE void b2js_distance_joint_set_length( int jointHandle, float length )
{
	b2JointId* joint = get_joint_of_type( jointHandle, b2_distanceJoint );
	if ( joint != NULL && isfinite( length ) && length > 0.0f )
	{
		b2DistanceJoint_SetLength( *joint, length );
	}
}

EMSCRIPTEN_KEEPALIVE float b2js_distance_joint_get_length( int jointHandle )
{
	b2JointId* joint = get_joint_of_type( jointHandle, b2_distanceJoint );
	return joint == NULL ? NAN : b2DistanceJoint_GetLength( *joint );
}

EMSCRIPTEN_KEEPALIVE void b2js_distance_joint_enable_spring( int jointHandle, int enabled )
{
	b2JointId* joint = get_joint_of_type( jointHandle, b2_distanceJoint );
	if ( joint != NULL )
	{
		b2DistanceJoint_EnableSpring( *joint, enabled != 0 );
	}
}

EMSCRIPTEN_KEEPALIVE int b2js_distance_joint_is_spring_enabled( int jointHandle )
{
	b2JointId* joint = get_joint_of_type( jointHandle, b2_distanceJoint );
	return joint == NULL ? 0 : b2DistanceJoint_IsSpringEnabled( *joint );
}

EMSCRIPTEN_KEEPALIVE void b2js_distance_joint_set_spring_force_range( int jointHandle, float lowerForce, float upperForce )
{
	b2JointId* joint = get_joint_of_type( jointHandle, b2_distanceJoint );
	if ( joint != NULL && isfinite( lowerForce ) && isfinite( upperForce ) && lowerForce <= upperForce )
	{
		b2DistanceJoint_SetSpringForceRange( *joint, lowerForce, upperForce );
	}
}

EMSCRIPTEN_KEEPALIVE float b2js_distance_joint_get_lower_spring_force( int jointHandle )
{
	b2JointId* joint = get_joint_of_type( jointHandle, b2_distanceJoint );
	if ( joint == NULL )
	{
		return NAN;
	}

	float lowerForce = NAN;
	float upperForce = NAN;
	b2DistanceJoint_GetSpringForceRange( *joint, &lowerForce, &upperForce );
	return lowerForce;
}

EMSCRIPTEN_KEEPALIVE float b2js_distance_joint_get_upper_spring_force( int jointHandle )
{
	b2JointId* joint = get_joint_of_type( jointHandle, b2_distanceJoint );
	if ( joint == NULL )
	{
		return NAN;
	}

	float lowerForce = NAN;
	float upperForce = NAN;
	b2DistanceJoint_GetSpringForceRange( *joint, &lowerForce, &upperForce );
	return upperForce;
}

EMSCRIPTEN_KEEPALIVE void b2js_distance_joint_set_spring_hertz( int jointHandle, float hertz )
{
	b2JointId* joint = get_joint_of_type( jointHandle, b2_distanceJoint );
	if ( joint != NULL && isfinite( hertz ) && hertz >= 0.0f )
	{
		b2DistanceJoint_SetSpringHertz( *joint, hertz );
	}
}

EMSCRIPTEN_KEEPALIVE float b2js_distance_joint_get_spring_hertz( int jointHandle )
{
	b2JointId* joint = get_joint_of_type( jointHandle, b2_distanceJoint );
	return joint == NULL ? NAN : b2DistanceJoint_GetSpringHertz( *joint );
}

EMSCRIPTEN_KEEPALIVE void b2js_distance_joint_set_spring_damping_ratio( int jointHandle, float dampingRatio )
{
	b2JointId* joint = get_joint_of_type( jointHandle, b2_distanceJoint );
	if ( joint != NULL && isfinite( dampingRatio ) && dampingRatio >= 0.0f )
	{
		b2DistanceJoint_SetSpringDampingRatio( *joint, dampingRatio );
	}
}

EMSCRIPTEN_KEEPALIVE float b2js_distance_joint_get_spring_damping_ratio( int jointHandle )
{
	b2JointId* joint = get_joint_of_type( jointHandle, b2_distanceJoint );
	return joint == NULL ? NAN : b2DistanceJoint_GetSpringDampingRatio( *joint );
}

EMSCRIPTEN_KEEPALIVE void b2js_distance_joint_enable_limit( int jointHandle, int enabled )
{
	b2JointId* joint = get_joint_of_type( jointHandle, b2_distanceJoint );
	if ( joint != NULL )
	{
		b2DistanceJoint_EnableLimit( *joint, enabled != 0 );
	}
}

EMSCRIPTEN_KEEPALIVE int b2js_distance_joint_is_limit_enabled( int jointHandle )
{
	b2JointId* joint = get_joint_of_type( jointHandle, b2_distanceJoint );
	return joint == NULL ? 0 : b2DistanceJoint_IsLimitEnabled( *joint );
}

EMSCRIPTEN_KEEPALIVE void b2js_distance_joint_set_length_range( int jointHandle, float minLength, float maxLength )
{
	b2JointId* joint = get_joint_of_type( jointHandle, b2_distanceJoint );
	if ( joint != NULL && isfinite( minLength ) && isfinite( maxLength ) && minLength > 0.0f && maxLength > 0.0f )
	{
		b2DistanceJoint_SetLengthRange( *joint, minLength, maxLength );
	}
}

EMSCRIPTEN_KEEPALIVE float b2js_distance_joint_get_min_length( int jointHandle )
{
	b2JointId* joint = get_joint_of_type( jointHandle, b2_distanceJoint );
	return joint == NULL ? NAN : b2DistanceJoint_GetMinLength( *joint );
}

EMSCRIPTEN_KEEPALIVE float b2js_distance_joint_get_max_length( int jointHandle )
{
	b2JointId* joint = get_joint_of_type( jointHandle, b2_distanceJoint );
	return joint == NULL ? NAN : b2DistanceJoint_GetMaxLength( *joint );
}

EMSCRIPTEN_KEEPALIVE float b2js_distance_joint_get_current_length( int jointHandle )
{
	b2JointId* joint = get_joint_of_type( jointHandle, b2_distanceJoint );
	return joint == NULL ? NAN : b2DistanceJoint_GetCurrentLength( *joint );
}

EMSCRIPTEN_KEEPALIVE void b2js_distance_joint_enable_motor( int jointHandle, int enabled )
{
	b2JointId* joint = get_joint_of_type( jointHandle, b2_distanceJoint );
	if ( joint != NULL )
	{
		b2DistanceJoint_EnableMotor( *joint, enabled != 0 );
	}
}

EMSCRIPTEN_KEEPALIVE int b2js_distance_joint_is_motor_enabled( int jointHandle )
{
	b2JointId* joint = get_joint_of_type( jointHandle, b2_distanceJoint );
	return joint == NULL ? 0 : b2DistanceJoint_IsMotorEnabled( *joint );
}

EMSCRIPTEN_KEEPALIVE void b2js_distance_joint_set_motor_speed( int jointHandle, float motorSpeed )
{
	b2JointId* joint = get_joint_of_type( jointHandle, b2_distanceJoint );
	if ( joint != NULL && isfinite( motorSpeed ) )
	{
		b2DistanceJoint_SetMotorSpeed( *joint, motorSpeed );
	}
}

EMSCRIPTEN_KEEPALIVE float b2js_distance_joint_get_motor_speed( int jointHandle )
{
	b2JointId* joint = get_joint_of_type( jointHandle, b2_distanceJoint );
	return joint == NULL ? NAN : b2DistanceJoint_GetMotorSpeed( *joint );
}

EMSCRIPTEN_KEEPALIVE void b2js_distance_joint_set_max_motor_force( int jointHandle, float force )
{
	b2JointId* joint = get_joint_of_type( jointHandle, b2_distanceJoint );
	if ( joint != NULL && isfinite( force ) && force >= 0.0f )
	{
		b2DistanceJoint_SetMaxMotorForce( *joint, force );
	}
}

EMSCRIPTEN_KEEPALIVE float b2js_distance_joint_get_max_motor_force( int jointHandle )
{
	b2JointId* joint = get_joint_of_type( jointHandle, b2_distanceJoint );
	return joint == NULL ? NAN : b2DistanceJoint_GetMaxMotorForce( *joint );
}

EMSCRIPTEN_KEEPALIVE float b2js_distance_joint_get_motor_force( int jointHandle )
{
	b2JointId* joint = get_joint_of_type( jointHandle, b2_distanceJoint );
	return joint == NULL ? NAN : b2DistanceJoint_GetMotorForce( *joint );
}

EMSCRIPTEN_KEEPALIVE void b2js_revolute_joint_enable_spring( int jointHandle, int enabled )
{
	b2JointId* joint = get_joint_of_type( jointHandle, b2_revoluteJoint );
	if ( joint != NULL )
	{
		b2RevoluteJoint_EnableSpring( *joint, enabled != 0 );
	}
}

EMSCRIPTEN_KEEPALIVE int b2js_revolute_joint_is_spring_enabled( int jointHandle )
{
	b2JointId* joint = get_joint_of_type( jointHandle, b2_revoluteJoint );
	return joint == NULL ? 0 : b2RevoluteJoint_IsSpringEnabled( *joint );
}

EMSCRIPTEN_KEEPALIVE void b2js_revolute_joint_set_spring_hertz( int jointHandle, float hertz )
{
	b2JointId* joint = get_joint_of_type( jointHandle, b2_revoluteJoint );
	if ( joint != NULL && isfinite( hertz ) && hertz >= 0.0f )
	{
		b2RevoluteJoint_SetSpringHertz( *joint, hertz );
	}
}

EMSCRIPTEN_KEEPALIVE float b2js_revolute_joint_get_spring_hertz( int jointHandle )
{
	b2JointId* joint = get_joint_of_type( jointHandle, b2_revoluteJoint );
	return joint == NULL ? NAN : b2RevoluteJoint_GetSpringHertz( *joint );
}

EMSCRIPTEN_KEEPALIVE void b2js_revolute_joint_set_spring_damping_ratio( int jointHandle, float dampingRatio )
{
	b2JointId* joint = get_joint_of_type( jointHandle, b2_revoluteJoint );
	if ( joint != NULL && isfinite( dampingRatio ) && dampingRatio >= 0.0f )
	{
		b2RevoluteJoint_SetSpringDampingRatio( *joint, dampingRatio );
	}
}

EMSCRIPTEN_KEEPALIVE float b2js_revolute_joint_get_spring_damping_ratio( int jointHandle )
{
	b2JointId* joint = get_joint_of_type( jointHandle, b2_revoluteJoint );
	return joint == NULL ? NAN : b2RevoluteJoint_GetSpringDampingRatio( *joint );
}

EMSCRIPTEN_KEEPALIVE void b2js_revolute_joint_set_target_angle( int jointHandle, float angle )
{
	b2JointId* joint = get_joint_of_type( jointHandle, b2_revoluteJoint );
	if ( joint != NULL && isfinite( angle ) )
	{
		b2RevoluteJoint_SetTargetAngle( *joint, angle );
	}
}

EMSCRIPTEN_KEEPALIVE float b2js_revolute_joint_get_target_angle( int jointHandle )
{
	b2JointId* joint = get_joint_of_type( jointHandle, b2_revoluteJoint );
	return joint == NULL ? NAN : b2RevoluteJoint_GetTargetAngle( *joint );
}

EMSCRIPTEN_KEEPALIVE float b2js_revolute_joint_get_angle( int jointHandle )
{
	b2JointId* joint = get_joint_of_type( jointHandle, b2_revoluteJoint );
	return joint == NULL ? NAN : b2RevoluteJoint_GetAngle( *joint );
}

EMSCRIPTEN_KEEPALIVE void b2js_revolute_joint_enable_limit( int jointHandle, int enabled )
{
	b2JointId* joint = get_joint_of_type( jointHandle, b2_revoluteJoint );
	if ( joint != NULL )
	{
		b2RevoluteJoint_EnableLimit( *joint, enabled != 0 );
	}
}

EMSCRIPTEN_KEEPALIVE int b2js_revolute_joint_is_limit_enabled( int jointHandle )
{
	b2JointId* joint = get_joint_of_type( jointHandle, b2_revoluteJoint );
	return joint == NULL ? 0 : b2RevoluteJoint_IsLimitEnabled( *joint );
}

EMSCRIPTEN_KEEPALIVE float b2js_revolute_joint_get_lower_limit( int jointHandle )
{
	b2JointId* joint = get_joint_of_type( jointHandle, b2_revoluteJoint );
	return joint == NULL ? NAN : b2RevoluteJoint_GetLowerLimit( *joint );
}

EMSCRIPTEN_KEEPALIVE float b2js_revolute_joint_get_upper_limit( int jointHandle )
{
	b2JointId* joint = get_joint_of_type( jointHandle, b2_revoluteJoint );
	return joint == NULL ? NAN : b2RevoluteJoint_GetUpperLimit( *joint );
}

EMSCRIPTEN_KEEPALIVE void b2js_revolute_joint_set_limits( int jointHandle, float lower, float upper )
{
	b2JointId* joint = get_joint_of_type( jointHandle, b2_revoluteJoint );
	if ( joint != NULL && isfinite( lower ) && isfinite( upper ) && lower <= upper && lower >= -0.99f * B2_PI && upper <= 0.99f * B2_PI )
	{
		b2RevoluteJoint_SetLimits( *joint, lower, upper );
	}
}

EMSCRIPTEN_KEEPALIVE void b2js_revolute_joint_enable_motor( int jointHandle, int enabled )
{
	b2JointId* joint = get_joint_of_type( jointHandle, b2_revoluteJoint );
	if ( joint != NULL )
	{
		b2RevoluteJoint_EnableMotor( *joint, enabled != 0 );
	}
}

EMSCRIPTEN_KEEPALIVE int b2js_revolute_joint_is_motor_enabled( int jointHandle )
{
	b2JointId* joint = get_joint_of_type( jointHandle, b2_revoluteJoint );
	return joint == NULL ? 0 : b2RevoluteJoint_IsMotorEnabled( *joint );
}

EMSCRIPTEN_KEEPALIVE void b2js_revolute_joint_set_motor_speed( int jointHandle, float motorSpeed )
{
	b2JointId* joint = get_joint_of_type( jointHandle, b2_revoluteJoint );
	if ( joint != NULL && isfinite( motorSpeed ) )
	{
		b2RevoluteJoint_SetMotorSpeed( *joint, motorSpeed );
	}
}

EMSCRIPTEN_KEEPALIVE float b2js_revolute_joint_get_motor_speed( int jointHandle )
{
	b2JointId* joint = get_joint_of_type( jointHandle, b2_revoluteJoint );
	return joint == NULL ? NAN : b2RevoluteJoint_GetMotorSpeed( *joint );
}

EMSCRIPTEN_KEEPALIVE float b2js_revolute_joint_get_motor_torque( int jointHandle )
{
	b2JointId* joint = get_joint_of_type( jointHandle, b2_revoluteJoint );
	return joint == NULL ? NAN : b2RevoluteJoint_GetMotorTorque( *joint );
}

EMSCRIPTEN_KEEPALIVE void b2js_revolute_joint_set_max_motor_torque( int jointHandle, float torque )
{
	b2JointId* joint = get_joint_of_type( jointHandle, b2_revoluteJoint );
	if ( joint != NULL && isfinite( torque ) && torque >= 0.0f )
	{
		b2RevoluteJoint_SetMaxMotorTorque( *joint, torque );
	}
}

EMSCRIPTEN_KEEPALIVE float b2js_revolute_joint_get_max_motor_torque( int jointHandle )
{
	b2JointId* joint = get_joint_of_type( jointHandle, b2_revoluteJoint );
	return joint == NULL ? NAN : b2RevoluteJoint_GetMaxMotorTorque( *joint );
}

EMSCRIPTEN_KEEPALIVE void b2js_step( int worldHandle, float timeStep, int subStepCount )
{
	b2WorldId* world = get_world( worldHandle );
	if ( world == NULL )
	{
		return;
	}

	b2World_Step( *world, timeStep, subStepCount );
}

EMSCRIPTEN_KEEPALIVE float b2js_body_get_position_x( int bodyHandle )
{
	b2BodyId* body = get_body( bodyHandle );
	return body == NULL ? NAN : b2Body_GetPosition( *body ).x;
}

EMSCRIPTEN_KEEPALIVE float b2js_body_get_position_y( int bodyHandle )
{
	b2BodyId* body = get_body( bodyHandle );
	return body == NULL ? NAN : b2Body_GetPosition( *body ).y;
}

EMSCRIPTEN_KEEPALIVE float b2js_body_get_angle( int bodyHandle )
{
	b2BodyId* body = get_body( bodyHandle );
	return body == NULL ? NAN : b2Rot_GetAngle( b2Body_GetRotation( *body ) );
}

EMSCRIPTEN_KEEPALIVE float b2js_body_get_velocity_x( int bodyHandle )
{
	b2BodyId* body = get_body( bodyHandle );
	return body == NULL ? NAN : b2Body_GetLinearVelocity( *body ).x;
}

EMSCRIPTEN_KEEPALIVE float b2js_body_get_velocity_y( int bodyHandle )
{
	b2BodyId* body = get_body( bodyHandle );
	return body == NULL ? NAN : b2Body_GetLinearVelocity( *body ).y;
}

EMSCRIPTEN_KEEPALIVE float b2js_body_get_mass( int bodyHandle )
{
	b2BodyId* body = get_body( bodyHandle );
	return body == NULL ? NAN : b2Body_GetMass( *body );
}

EMSCRIPTEN_KEEPALIVE int b2js_read_body_transforms( const int* bodyHandles, int count, float* outTransforms )
{
	if ( bodyHandles == NULL || outTransforms == NULL || count < 0 )
	{
		return 0;
	}

	for ( int i = 0; i < count; ++i )
	{
		b2BodyId* body = get_body( bodyHandles[i] );
		if ( body == NULL )
		{
			outTransforms[i * 3] = NAN;
			outTransforms[i * 3 + 1] = NAN;
			outTransforms[i * 3 + 2] = NAN;
			continue;
		}

		b2Transform transform = b2Body_GetTransform( *body );
		outTransforms[i * 3] = transform.p.x;
		outTransforms[i * 3 + 1] = transform.p.y;
		outTransforms[i * 3 + 2] = b2Rot_GetAngle( transform.q );
	}

	return count;
}
