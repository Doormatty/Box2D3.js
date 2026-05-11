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

typedef struct ChainSlot
{
	bool used;
	int worldHandle;
	int bodyHandle;
	b2ChainId id;
} ChainSlot;

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
static ChainSlot* chains = NULL;
static JointSlot* joints = NULL;
static int worldCapacity = 0;
static int bodyCapacity = 0;
static int shapeCapacity = 0;
static int chainCapacity = 0;
static int jointCapacity = 0;
static const float b2js_minLength = 0.005f;
static const int b2js_maxMixRules = 128;

typedef struct MixRule
{
	uint64_t materialA;
	uint64_t materialB;
	float value;
} MixRule;

static MixRule frictionMixRules[128];
static MixRule restitutionMixRules[128];
static int frictionMixRuleCount = 0;
static int restitutionMixRuleCount = 0;

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

static int alloc_chain_slot( int worldHandle, int bodyHandle, b2ChainId id )
{
	for ( int i = 1; i < chainCapacity; ++i )
	{
		if ( chains[i].used == false )
		{
			chains[i] = (ChainSlot){ true, worldHandle, bodyHandle, id };
			return i;
		}
	}

	if ( grow_slots( (void**)&chains, &chainCapacity, (int)sizeof( ChainSlot ) ) == false )
	{
		return 0;
	}

	chains[chainCapacity / 2] = (ChainSlot){ true, worldHandle, bodyHandle, id };
	return chainCapacity / 2;
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

static b2ShapeId* get_shape( int handle )
{
	if ( handle <= 0 || handle >= shapeCapacity || shapes[handle].used == false )
	{
		return NULL;
	}

	return &shapes[handle].id;
}

static b2ChainId* get_chain( int handle )
{
	if ( handle <= 0 || handle >= chainCapacity || chains[handle].used == false )
	{
		return NULL;
	}

	return &chains[handle].id;
}

static int find_body_handle( b2BodyId id )
{
	for ( int i = 1; i < bodyCapacity; ++i )
	{
		if ( bodies[i].used && B2_ID_EQUALS( bodies[i].id, id ) )
		{
			return i;
		}
	}

	return 0;
}

static int find_shape_handle( b2ShapeId id )
{
	for ( int i = 1; i < shapeCapacity; ++i )
	{
		if ( shapes[i].used && B2_ID_EQUALS( shapes[i].id, id ) )
		{
			return i;
		}
	}

	return 0;
}

static int find_joint_handle( b2JointId id )
{
	for ( int i = 1; i < jointCapacity; ++i )
	{
		if ( joints[i].used && B2_ID_EQUALS( joints[i].id, id ) )
		{
			return i;
		}
	}

	return 0;
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

static b2QueryFilter make_query_filter( uint32_t categoryBits, uint32_t maskBits )
{
	b2QueryFilter filter = b2DefaultQueryFilter();
	filter.categoryBits = (uint64_t)categoryBits;
	filter.maskBits = (uint64_t)maskBits;
	return filter;
}

static b2SurfaceMaterial make_surface_material( float friction, float restitution, float rollingResistance, float tangentSpeed,
												uint32_t userMaterialId, uint32_t customColor )
{
	b2SurfaceMaterial material = b2DefaultSurfaceMaterial();

	if ( isfinite( friction ) && friction >= 0.0f )
	{
		material.friction = friction;
	}

	if ( isfinite( restitution ) && restitution >= 0.0f )
	{
		material.restitution = restitution;
	}

	if ( isfinite( rollingResistance ) && rollingResistance >= 0.0f )
	{
		material.rollingResistance = rollingResistance;
	}

	if ( isfinite( tangentSpeed ) )
	{
		material.tangentSpeed = tangentSpeed;
	}

	material.userMaterialId = (uint64_t)userMaterialId;
	material.customColor = customColor;
	return material;
}

static void write_surface_material( b2SurfaceMaterial material, float* outFloats, uint32_t* outInts )
{
	outFloats[0] = material.friction;
	outFloats[1] = material.restitution;
	outFloats[2] = material.rollingResistance;
	outFloats[3] = material.tangentSpeed;
	outInts[0] = (uint32_t)material.userMaterialId;
	outInts[1] = material.customColor;
}

static bool mix_rule_matches( MixRule rule, uint64_t materialA, uint64_t materialB )
{
	return ( rule.materialA == materialA && rule.materialB == materialB ) ||
		   ( rule.materialA == materialB && rule.materialB == materialA );
}

static float b2js_friction_callback( float frictionA, uint64_t userMaterialIdA, float frictionB, uint64_t userMaterialIdB )
{
	for ( int i = 0; i < frictionMixRuleCount; ++i )
	{
		if ( mix_rule_matches( frictionMixRules[i], userMaterialIdA, userMaterialIdB ) )
		{
			return frictionMixRules[i].value;
		}
	}

	return sqrtf( frictionA * frictionB );
}

static float b2js_restitution_callback( float restitutionA, uint64_t userMaterialIdA, float restitutionB, uint64_t userMaterialIdB )
{
	for ( int i = 0; i < restitutionMixRuleCount; ++i )
	{
		if ( mix_rule_matches( restitutionMixRules[i], userMaterialIdA, userMaterialIdB ) )
		{
			return restitutionMixRules[i].value;
		}
	}

	return b2MaxFloat( restitutionA, restitutionB );
}

static b2ShapeDef make_shape_def( float density, float friction, float restitution, float rollingResistance, float tangentSpeed,
								  uint32_t userMaterialId, uint32_t customColor, int groupIndex, uint32_t categoryBits,
								  uint32_t maskBits, int isSensor, int enableSensorEvents, int enableContactEvents, int enableHitEvents )
{
	b2ShapeDef def = b2DefaultShapeDef();

	if ( isfinite( density ) && density >= 0.0f )
	{
		def.density = density;
	}

	def.material = make_surface_material( friction, restitution, rollingResistance, tangentSpeed, userMaterialId, customColor );

	def.filter.groupIndex = groupIndex;
	def.filter.categoryBits = (uint64_t)categoryBits;
	def.filter.maskBits = (uint64_t)maskBits;

	def.isSensor = isSensor != 0;
	def.enableSensorEvents = enableSensorEvents != 0;
	def.enableContactEvents = enableContactEvents != 0;
	def.enableHitEvents = enableHitEvents != 0;
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

	for ( int i = 1; i < chainCapacity; ++i )
	{
		if ( chains[i].worldHandle == worldHandle )
		{
			chains[i].used = false;
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

	for ( int i = 1; i < chainCapacity; ++i )
	{
		if ( chains[i].bodyHandle == bodyHandle )
		{
			chains[i].used = false;
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

EMSCRIPTEN_KEEPALIVE int b2js_body_get_type( int bodyHandle )
{
	b2BodyId* body = get_body( bodyHandle );
	return body == NULL ? -1 : (int)b2Body_GetType( *body );
}

EMSCRIPTEN_KEEPALIVE void b2js_body_set_type( int bodyHandle, int type )
{
	b2BodyId* body = get_body( bodyHandle );
	if ( body != NULL && type >= b2_staticBody && type < b2_bodyTypeCount )
	{
		b2Body_SetType( *body, (b2BodyType)type );
	}
}

EMSCRIPTEN_KEEPALIVE void b2js_body_set_transform( int bodyHandle, float x, float y, float angle )
{
	b2BodyId* body = get_body( bodyHandle );
	if ( body != NULL && isfinite( x ) && isfinite( y ) && isfinite( angle ) )
	{
		b2Body_SetTransform( *body, (b2Vec2){ x, y }, b2MakeRot( angle ) );
	}
}

EMSCRIPTEN_KEEPALIVE void b2js_body_set_velocity( int bodyHandle, float vx, float vy, float angularVelocity )
{
	b2BodyId* body = get_body( bodyHandle );
	if ( body != NULL && isfinite( vx ) && isfinite( vy ) && isfinite( angularVelocity ) )
	{
		b2Body_SetLinearVelocity( *body, (b2Vec2){ vx, vy } );
		b2Body_SetAngularVelocity( *body, angularVelocity );
	}
}

EMSCRIPTEN_KEEPALIVE void b2js_body_set_linear_velocity( int bodyHandle, float vx, float vy )
{
	b2BodyId* body = get_body( bodyHandle );
	if ( body != NULL && isfinite( vx ) && isfinite( vy ) )
	{
		b2Body_SetLinearVelocity( *body, (b2Vec2){ vx, vy } );
	}
}

EMSCRIPTEN_KEEPALIVE void b2js_body_set_angular_velocity( int bodyHandle, float angularVelocity )
{
	b2BodyId* body = get_body( bodyHandle );
	if ( body != NULL && isfinite( angularVelocity ) )
	{
		b2Body_SetAngularVelocity( *body, angularVelocity );
	}
}

EMSCRIPTEN_KEEPALIVE float b2js_body_get_angular_velocity( int bodyHandle )
{
	b2BodyId* body = get_body( bodyHandle );
	return body == NULL ? NAN : b2Body_GetAngularVelocity( *body );
}

EMSCRIPTEN_KEEPALIVE void b2js_body_apply_force( int bodyHandle, float fx, float fy, float px, float py, int wake )
{
	b2BodyId* body = get_body( bodyHandle );
	if ( body != NULL && isfinite( fx ) && isfinite( fy ) && isfinite( px ) && isfinite( py ) )
	{
		b2Body_ApplyForce( *body, (b2Vec2){ fx, fy }, (b2Vec2){ px, py }, wake != 0 );
	}
}

EMSCRIPTEN_KEEPALIVE void b2js_body_apply_force_to_center( int bodyHandle, float fx, float fy, int wake )
{
	b2BodyId* body = get_body( bodyHandle );
	if ( body != NULL && isfinite( fx ) && isfinite( fy ) )
	{
		b2Body_ApplyForceToCenter( *body, (b2Vec2){ fx, fy }, wake != 0 );
	}
}

EMSCRIPTEN_KEEPALIVE void b2js_body_apply_torque( int bodyHandle, float torque, int wake )
{
	b2BodyId* body = get_body( bodyHandle );
	if ( body != NULL && isfinite( torque ) )
	{
		b2Body_ApplyTorque( *body, torque, wake != 0 );
	}
}

EMSCRIPTEN_KEEPALIVE void b2js_body_apply_linear_impulse( int bodyHandle, float ix, float iy, float px, float py, int wake )
{
	b2BodyId* body = get_body( bodyHandle );
	if ( body != NULL && isfinite( ix ) && isfinite( iy ) && isfinite( px ) && isfinite( py ) )
	{
		b2Body_ApplyLinearImpulse( *body, (b2Vec2){ ix, iy }, (b2Vec2){ px, py }, wake != 0 );
	}
}

EMSCRIPTEN_KEEPALIVE void b2js_body_apply_linear_impulse_to_center( int bodyHandle, float ix, float iy, int wake )
{
	b2BodyId* body = get_body( bodyHandle );
	if ( body != NULL && isfinite( ix ) && isfinite( iy ) )
	{
		b2Body_ApplyLinearImpulseToCenter( *body, (b2Vec2){ ix, iy }, wake != 0 );
	}
}

EMSCRIPTEN_KEEPALIVE void b2js_body_apply_angular_impulse( int bodyHandle, float impulse, int wake )
{
	b2BodyId* body = get_body( bodyHandle );
	if ( body != NULL && isfinite( impulse ) )
	{
		b2Body_ApplyAngularImpulse( *body, impulse, wake != 0 );
	}
}

EMSCRIPTEN_KEEPALIVE void b2js_body_set_awake( int bodyHandle, int awake )
{
	b2BodyId* body = get_body( bodyHandle );
	if ( body != NULL )
	{
		b2Body_SetAwake( *body, awake != 0 );
	}
}

EMSCRIPTEN_KEEPALIVE int b2js_body_is_awake( int bodyHandle )
{
	b2BodyId* body = get_body( bodyHandle );
	return body == NULL ? 0 : b2Body_IsAwake( *body );
}

EMSCRIPTEN_KEEPALIVE void b2js_body_set_enabled( int bodyHandle, int enabled )
{
	b2BodyId* body = get_body( bodyHandle );
	if ( body == NULL )
	{
		return;
	}

	if ( enabled != 0 )
	{
		b2Body_Enable( *body );
	}
	else
	{
		b2Body_Disable( *body );
	}
}

EMSCRIPTEN_KEEPALIVE int b2js_body_is_enabled( int bodyHandle )
{
	b2BodyId* body = get_body( bodyHandle );
	return body == NULL ? 0 : b2Body_IsEnabled( *body );
}

EMSCRIPTEN_KEEPALIVE void b2js_body_set_bullet( int bodyHandle, int bullet )
{
	b2BodyId* body = get_body( bodyHandle );
	if ( body != NULL )
	{
		b2Body_SetBullet( *body, bullet != 0 );
	}
}

EMSCRIPTEN_KEEPALIVE int b2js_body_is_bullet( int bodyHandle )
{
	b2BodyId* body = get_body( bodyHandle );
	return body == NULL ? 0 : b2Body_IsBullet( *body );
}

EMSCRIPTEN_KEEPALIVE void b2js_body_set_gravity_scale( int bodyHandle, float gravityScale )
{
	b2BodyId* body = get_body( bodyHandle );
	if ( body != NULL && isfinite( gravityScale ) )
	{
		b2Body_SetGravityScale( *body, gravityScale );
	}
}

EMSCRIPTEN_KEEPALIVE float b2js_body_get_gravity_scale( int bodyHandle )
{
	b2BodyId* body = get_body( bodyHandle );
	return body == NULL ? NAN : b2Body_GetGravityScale( *body );
}

EMSCRIPTEN_KEEPALIVE void b2js_body_set_damping( int bodyHandle, float linearDamping, float angularDamping )
{
	b2BodyId* body = get_body( bodyHandle );
	if ( body != NULL && isfinite( linearDamping ) && linearDamping >= 0.0f && isfinite( angularDamping ) && angularDamping >= 0.0f )
	{
		b2Body_SetLinearDamping( *body, linearDamping );
		b2Body_SetAngularDamping( *body, angularDamping );
	}
}

EMSCRIPTEN_KEEPALIVE float b2js_body_get_linear_damping( int bodyHandle )
{
	b2BodyId* body = get_body( bodyHandle );
	return body == NULL ? NAN : b2Body_GetLinearDamping( *body );
}

EMSCRIPTEN_KEEPALIVE float b2js_body_get_angular_damping( int bodyHandle )
{
	b2BodyId* body = get_body( bodyHandle );
	return body == NULL ? NAN : b2Body_GetAngularDamping( *body );
}

EMSCRIPTEN_KEEPALIVE int b2js_create_box_shape( int bodyHandle, float halfWidth, float halfHeight, float density, float friction,
												float restitution, float rollingResistance, float tangentSpeed, uint32_t userMaterialId,
												uint32_t customColor, int groupIndex, uint32_t categoryBits, uint32_t maskBits,
												int isSensor, int enableSensorEvents, int enableContactEvents, int enableHitEvents )
{
	b2BodyId* body = get_body( bodyHandle );
	if ( body == NULL || isfinite( halfWidth ) == false || isfinite( halfHeight ) == false || halfWidth <= 0.0f || halfHeight <= 0.0f )
	{
		return 0;
	}

	b2Polygon box = b2MakeBox( halfWidth, halfHeight );
	b2ShapeDef def = make_shape_def( density, friction, restitution, rollingResistance, tangentSpeed, userMaterialId, customColor,
									 groupIndex, categoryBits, maskBits, isSensor, enableSensorEvents, enableContactEvents,
									 enableHitEvents );
	b2ShapeId id = b2CreatePolygonShape( *body, &def, &box );
	int handle = alloc_shape_slot( bodies[bodyHandle].worldHandle, bodyHandle, id );
	if ( handle == 0 )
	{
		b2DestroyShape( id, true );
	}

	return handle;
}

EMSCRIPTEN_KEEPALIVE int b2js_create_circle_shape( int bodyHandle, float centerX, float centerY, float radius, float density, float friction,
												   float restitution, float rollingResistance, float tangentSpeed,
												   uint32_t userMaterialId, uint32_t customColor, int groupIndex,
												   uint32_t categoryBits, uint32_t maskBits, int isSensor, int enableSensorEvents,
												   int enableContactEvents, int enableHitEvents )
{
	b2BodyId* body = get_body( bodyHandle );
	if ( body == NULL || isfinite( centerX ) == false || isfinite( centerY ) == false || isfinite( radius ) == false || radius <= 0.0f )
	{
		return 0;
	}

	b2Circle circle = { { centerX, centerY }, radius };
	b2ShapeDef def = make_shape_def( density, friction, restitution, rollingResistance, tangentSpeed, userMaterialId, customColor,
									 groupIndex, categoryBits, maskBits, isSensor, enableSensorEvents, enableContactEvents,
									 enableHitEvents );
	b2ShapeId id = b2CreateCircleShape( *body, &def, &circle );
	int handle = alloc_shape_slot( bodies[bodyHandle].worldHandle, bodyHandle, id );
	if ( handle == 0 )
	{
		b2DestroyShape( id, true );
	}

	return handle;
}

EMSCRIPTEN_KEEPALIVE int b2js_create_capsule_shape( int bodyHandle, float center1X, float center1Y, float center2X, float center2Y,
													float radius, float density, float friction, float restitution,
													float rollingResistance, float tangentSpeed, uint32_t userMaterialId,
													uint32_t customColor, int groupIndex, uint32_t categoryBits, uint32_t maskBits,
													int isSensor, int enableSensorEvents, int enableContactEvents,
													int enableHitEvents )
{
	b2BodyId* body = get_body( bodyHandle );
	if ( body == NULL || isfinite( center1X ) == false || isfinite( center1Y ) == false || isfinite( center2X ) == false ||
		 isfinite( center2Y ) == false || isfinite( radius ) == false || radius <= 0.0f )
	{
		return 0;
	}

	b2Capsule capsule = { { center1X, center1Y }, { center2X, center2Y }, radius };
	b2ShapeDef def = make_shape_def( density, friction, restitution, rollingResistance, tangentSpeed, userMaterialId, customColor,
									 groupIndex, categoryBits, maskBits, isSensor, enableSensorEvents, enableContactEvents,
									 enableHitEvents );
	b2ShapeId id = b2CreateCapsuleShape( *body, &def, &capsule );
	if ( B2_IS_NULL( id ) )
	{
		return 0;
	}

	int handle = alloc_shape_slot( bodies[bodyHandle].worldHandle, bodyHandle, id );
	if ( handle == 0 )
	{
		b2DestroyShape( id, true );
	}

	return handle;
}

EMSCRIPTEN_KEEPALIVE int b2js_create_segment_shape( int bodyHandle, float x1, float y1, float x2, float y2, float friction,
													float restitution, float rollingResistance, float tangentSpeed,
													uint32_t userMaterialId, uint32_t customColor, int groupIndex,
													uint32_t categoryBits, uint32_t maskBits, int isSensor, int enableSensorEvents,
													int enableContactEvents, int enableHitEvents )
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
	b2ShapeDef def = make_shape_def( 0.0f, friction, restitution, rollingResistance, tangentSpeed, userMaterialId, customColor,
									 groupIndex, categoryBits, maskBits, isSensor, enableSensorEvents, enableContactEvents,
									 enableHitEvents );
	b2ShapeId id = b2CreateSegmentShape( *body, &def, &segment );
	int handle = alloc_shape_slot( bodies[bodyHandle].worldHandle, bodyHandle, id );
	if ( handle == 0 )
	{
		b2DestroyShape( id, true );
	}

	return handle;
}

EMSCRIPTEN_KEEPALIVE int b2js_create_polygon_shape( int bodyHandle, const float* vertices, int vertexCount, float density, float friction,
													float restitution, float rollingResistance, float tangentSpeed,
													uint32_t userMaterialId, uint32_t customColor, int groupIndex,
													uint32_t categoryBits, uint32_t maskBits, int isSensor, int enableSensorEvents,
													int enableContactEvents, int enableHitEvents )
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
	b2ShapeDef def = make_shape_def( density, friction, restitution, rollingResistance, tangentSpeed, userMaterialId, customColor,
									 groupIndex, categoryBits, maskBits, isSensor, enableSensorEvents, enableContactEvents,
									 enableHitEvents );
	b2ShapeId id = b2CreatePolygonShape( *body, &def, &polygon );
	int handle = alloc_shape_slot( bodies[bodyHandle].worldHandle, bodyHandle, id );
	if ( handle == 0 )
	{
		b2DestroyShape( id, true );
	}

	return handle;
}

EMSCRIPTEN_KEEPALIVE int b2js_create_chain( int bodyHandle, const float* vertices, int vertexCount, int isLoop, float friction,
											float restitution, float rollingResistance, float tangentSpeed, uint32_t userMaterialId,
											uint32_t customColor, int groupIndex, uint32_t categoryBits, uint32_t maskBits,
											int enableSensorEvents )
{
	b2BodyId* body = get_body( bodyHandle );
	if ( body == NULL || vertices == NULL || vertexCount < 4 )
	{
		return 0;
	}

	b2Vec2* points = (b2Vec2*)malloc( (size_t)vertexCount * sizeof( b2Vec2 ) );
	if ( points == NULL )
	{
		return 0;
	}

	for ( int i = 0; i < vertexCount; ++i )
	{
		points[i] = (b2Vec2){ vertices[i * 2], vertices[i * 2 + 1] };
		if ( isfinite( points[i].x ) == false || isfinite( points[i].y ) == false )
		{
			free( points );
			return 0;
		}
	}

	b2SurfaceMaterial material = make_surface_material( friction, restitution, rollingResistance, tangentSpeed, userMaterialId, customColor );

	b2ChainDef def = b2DefaultChainDef();
	def.points = points;
	def.count = vertexCount;
	def.materials = &material;
	def.materialCount = 1;
	def.isLoop = isLoop != 0;
	def.enableSensorEvents = enableSensorEvents != 0;
	def.filter.groupIndex = groupIndex;
	def.filter.categoryBits = (uint64_t)categoryBits;
	def.filter.maskBits = (uint64_t)maskBits;

	b2ChainId id = b2CreateChain( *body, &def );
	free( points );

	if ( B2_IS_NULL( id ) )
	{
		return 0;
	}

	int handle = alloc_chain_slot( bodies[bodyHandle].worldHandle, bodyHandle, id );
	if ( handle == 0 )
	{
		b2DestroyChain( id );
	}

	return handle;
}

EMSCRIPTEN_KEEPALIVE void b2js_destroy_chain( int chainHandle )
{
	b2ChainId* chain = get_chain( chainHandle );
	if ( chain == NULL )
	{
		return;
	}

	for ( int i = 1; i < shapeCapacity; ++i )
	{
		if ( shapes[i].used && B2_ID_EQUALS( b2Shape_GetParentChain( shapes[i].id ), *chain ) )
		{
			shapes[i].used = false;
		}
	}

	b2DestroyChain( *chain );
	chains[chainHandle].used = false;
}

EMSCRIPTEN_KEEPALIVE int b2js_chain_get_segment_count( int chainHandle )
{
	b2ChainId* chain = get_chain( chainHandle );
	return chain == NULL ? 0 : b2Chain_GetSegmentCount( *chain );
}

EMSCRIPTEN_KEEPALIVE int b2js_chain_get_segments( int chainHandle, int* outShapeHandles, int capacity )
{
	b2ChainId* chain = get_chain( chainHandle );
	if ( chain == NULL || outShapeHandles == NULL || capacity <= 0 )
	{
		return 0;
	}

	int count = b2Chain_GetSegmentCount( *chain );
	b2ShapeId* segmentIds = (b2ShapeId*)malloc( (size_t)count * sizeof( b2ShapeId ) );
	if ( segmentIds == NULL )
	{
		return 0;
	}

	int filled = b2Chain_GetSegments( *chain, segmentIds, count );
	int resultCount = b2MinInt( filled, capacity );
	for ( int i = 0; i < resultCount; ++i )
	{
		int shapeHandle = find_shape_handle( segmentIds[i] );
		if ( shapeHandle == 0 )
		{
			shapeHandle = alloc_shape_slot( chains[chainHandle].worldHandle, chains[chainHandle].bodyHandle, segmentIds[i] );
		}
		outShapeHandles[i] = shapeHandle;
	}

	free( segmentIds );
	return resultCount;
}

EMSCRIPTEN_KEEPALIVE int b2js_chain_get_surface_material_count( int chainHandle )
{
	b2ChainId* chain = get_chain( chainHandle );
	return chain == NULL ? 0 : b2Chain_GetSurfaceMaterialCount( *chain );
}

EMSCRIPTEN_KEEPALIVE void b2js_chain_set_surface_material( int chainHandle, int materialIndex, float friction, float restitution,
														   float rollingResistance, float tangentSpeed, uint32_t userMaterialId,
														   uint32_t customColor )
{
	b2ChainId* chain = get_chain( chainHandle );
	if ( chain == NULL || materialIndex < 0 )
	{
		return;
	}

	int count = b2Chain_GetSurfaceMaterialCount( *chain );
	if ( materialIndex >= count )
	{
		return;
	}

	b2SurfaceMaterial material = make_surface_material( friction, restitution, rollingResistance, tangentSpeed, userMaterialId, customColor );
	b2Chain_SetSurfaceMaterial( *chain, &material, materialIndex );
}

EMSCRIPTEN_KEEPALIVE int b2js_chain_get_surface_material( int chainHandle, int materialIndex, float* outFloats, uint32_t* outInts )
{
	b2ChainId* chain = get_chain( chainHandle );
	if ( chain == NULL || outFloats == NULL || outInts == NULL || materialIndex < 0 )
	{
		return 0;
	}

	int count = b2Chain_GetSurfaceMaterialCount( *chain );
	if ( materialIndex >= count )
	{
		return 0;
	}

	write_surface_material( b2Chain_GetSurfaceMaterial( *chain, materialIndex ), outFloats, outInts );
	return 1;
}

EMSCRIPTEN_KEEPALIVE void b2js_destroy_shape( int shapeHandle, int updateBodyMass )
{
	b2ShapeId* shape = get_shape( shapeHandle );
	if ( shape == NULL )
	{
		return;
	}

	b2DestroyShape( *shape, updateBodyMass != 0 );
	shapes[shapeHandle].used = false;
}

EMSCRIPTEN_KEEPALIVE int b2js_shape_get_type( int shapeHandle )
{
	b2ShapeId* shape = get_shape( shapeHandle );
	return shape == NULL ? -1 : (int)b2Shape_GetType( *shape );
}

EMSCRIPTEN_KEEPALIVE int b2js_shape_is_sensor( int shapeHandle )
{
	b2ShapeId* shape = get_shape( shapeHandle );
	return shape == NULL ? 0 : b2Shape_IsSensor( *shape );
}

EMSCRIPTEN_KEEPALIVE void b2js_shape_set_density( int shapeHandle, float density, int updateBodyMass )
{
	b2ShapeId* shape = get_shape( shapeHandle );
	if ( shape != NULL && isfinite( density ) && density >= 0.0f )
	{
		b2Shape_SetDensity( *shape, density, updateBodyMass != 0 );
	}
}

EMSCRIPTEN_KEEPALIVE float b2js_shape_get_density( int shapeHandle )
{
	b2ShapeId* shape = get_shape( shapeHandle );
	return shape == NULL ? NAN : b2Shape_GetDensity( *shape );
}

EMSCRIPTEN_KEEPALIVE void b2js_shape_set_friction( int shapeHandle, float friction )
{
	b2ShapeId* shape = get_shape( shapeHandle );
	if ( shape != NULL && isfinite( friction ) && friction >= 0.0f )
	{
		b2Shape_SetFriction( *shape, friction );
	}
}

EMSCRIPTEN_KEEPALIVE float b2js_shape_get_friction( int shapeHandle )
{
	b2ShapeId* shape = get_shape( shapeHandle );
	return shape == NULL ? NAN : b2Shape_GetFriction( *shape );
}

EMSCRIPTEN_KEEPALIVE void b2js_shape_set_restitution( int shapeHandle, float restitution )
{
	b2ShapeId* shape = get_shape( shapeHandle );
	if ( shape != NULL && isfinite( restitution ) && restitution >= 0.0f )
	{
		b2Shape_SetRestitution( *shape, restitution );
	}
}

EMSCRIPTEN_KEEPALIVE float b2js_shape_get_restitution( int shapeHandle )
{
	b2ShapeId* shape = get_shape( shapeHandle );
	return shape == NULL ? NAN : b2Shape_GetRestitution( *shape );
}

EMSCRIPTEN_KEEPALIVE void b2js_shape_set_surface_material( int shapeHandle, float friction, float restitution, float rollingResistance,
														   float tangentSpeed, uint32_t userMaterialId, uint32_t customColor )
{
	b2ShapeId* shape = get_shape( shapeHandle );
	if ( shape == NULL )
	{
		return;
	}

	b2SurfaceMaterial material = make_surface_material( friction, restitution, rollingResistance, tangentSpeed, userMaterialId, customColor );
	b2Shape_SetSurfaceMaterial( *shape, &material );
}

EMSCRIPTEN_KEEPALIVE int b2js_shape_get_surface_material( int shapeHandle, float* outFloats, uint32_t* outInts )
{
	b2ShapeId* shape = get_shape( shapeHandle );
	if ( shape == NULL || outFloats == NULL || outInts == NULL )
	{
		return 0;
	}

	write_surface_material( b2Shape_GetSurfaceMaterial( *shape ), outFloats, outInts );
	return 1;
}

EMSCRIPTEN_KEEPALIVE void b2js_shape_set_user_material( int shapeHandle, uint32_t userMaterialId )
{
	b2ShapeId* shape = get_shape( shapeHandle );
	if ( shape != NULL )
	{
		b2Shape_SetUserMaterial( *shape, (uint64_t)userMaterialId );
	}
}

EMSCRIPTEN_KEEPALIVE uint32_t b2js_shape_get_user_material( int shapeHandle )
{
	b2ShapeId* shape = get_shape( shapeHandle );
	return shape == NULL ? 0 : (uint32_t)b2Shape_GetUserMaterial( *shape );
}

EMSCRIPTEN_KEEPALIVE void b2js_shape_set_filter( int shapeHandle, uint32_t categoryBits, uint32_t maskBits, int groupIndex )
{
	b2ShapeId* shape = get_shape( shapeHandle );
	if ( shape == NULL )
	{
		return;
	}

	b2Filter filter = b2Shape_GetFilter( *shape );
	filter.categoryBits = (uint64_t)categoryBits;
	filter.maskBits = (uint64_t)maskBits;
	filter.groupIndex = groupIndex;
	b2Shape_SetFilter( *shape, filter );
}

EMSCRIPTEN_KEEPALIVE double b2js_shape_get_category_bits( int shapeHandle )
{
	b2ShapeId* shape = get_shape( shapeHandle );
	return shape == NULL ? NAN : (double)b2Shape_GetFilter( *shape ).categoryBits;
}

EMSCRIPTEN_KEEPALIVE double b2js_shape_get_mask_bits( int shapeHandle )
{
	b2ShapeId* shape = get_shape( shapeHandle );
	return shape == NULL ? NAN : (double)b2Shape_GetFilter( *shape ).maskBits;
}

EMSCRIPTEN_KEEPALIVE int b2js_shape_get_group_index( int shapeHandle )
{
	b2ShapeId* shape = get_shape( shapeHandle );
	return shape == NULL ? 0 : b2Shape_GetFilter( *shape ).groupIndex;
}

EMSCRIPTEN_KEEPALIVE void b2js_shape_enable_sensor_events( int shapeHandle, int enabled )
{
	b2ShapeId* shape = get_shape( shapeHandle );
	if ( shape != NULL )
	{
		b2Shape_EnableSensorEvents( *shape, enabled != 0 );
	}
}

EMSCRIPTEN_KEEPALIVE int b2js_shape_are_sensor_events_enabled( int shapeHandle )
{
	b2ShapeId* shape = get_shape( shapeHandle );
	return shape == NULL ? 0 : b2Shape_AreSensorEventsEnabled( *shape );
}

EMSCRIPTEN_KEEPALIVE void b2js_shape_enable_contact_events( int shapeHandle, int enabled )
{
	b2ShapeId* shape = get_shape( shapeHandle );
	if ( shape != NULL )
	{
		b2Shape_EnableContactEvents( *shape, enabled != 0 );
	}
}

EMSCRIPTEN_KEEPALIVE int b2js_shape_are_contact_events_enabled( int shapeHandle )
{
	b2ShapeId* shape = get_shape( shapeHandle );
	return shape == NULL ? 0 : b2Shape_AreContactEventsEnabled( *shape );
}

EMSCRIPTEN_KEEPALIVE void b2js_shape_enable_hit_events( int shapeHandle, int enabled )
{
	b2ShapeId* shape = get_shape( shapeHandle );
	if ( shape != NULL )
	{
		b2Shape_EnableHitEvents( *shape, enabled != 0 );
	}
}

EMSCRIPTEN_KEEPALIVE int b2js_shape_are_hit_events_enabled( int shapeHandle )
{
	b2ShapeId* shape = get_shape( shapeHandle );
	return shape == NULL ? 0 : b2Shape_AreHitEventsEnabled( *shape );
}

EMSCRIPTEN_KEEPALIVE int b2js_shape_test_point( int shapeHandle, float x, float y )
{
	b2ShapeId* shape = get_shape( shapeHandle );
	return shape == NULL || isfinite( x ) == false || isfinite( y ) == false ? 0 : b2Shape_TestPoint( *shape, (b2Vec2){ x, y } );
}

EMSCRIPTEN_KEEPALIVE int b2js_shape_raycast( int shapeHandle, float ox, float oy, float tx, float ty, float maxFraction, float* outResult )
{
	b2ShapeId* shape = get_shape( shapeHandle );
	if ( shape == NULL || outResult == NULL || isfinite( ox ) == false || isfinite( oy ) == false || isfinite( tx ) == false ||
		 isfinite( ty ) == false || isfinite( maxFraction ) == false )
	{
		return 0;
	}

	b2RayCastInput input = { { ox, oy }, { tx, ty }, maxFraction };
	b2CastOutput output = b2Shape_RayCast( *shape, &input );
	outResult[0] = output.point.x;
	outResult[1] = output.point.y;
	outResult[2] = output.normal.x;
	outResult[3] = output.normal.y;
	outResult[4] = output.fraction;
	outResult[5] = (float)output.iterations;
	return output.hit;
}

EMSCRIPTEN_KEEPALIVE int b2js_shape_get_aabb( int shapeHandle, float* outAabb )
{
	b2ShapeId* shape = get_shape( shapeHandle );
	if ( shape == NULL || outAabb == NULL )
	{
		return 0;
	}

	b2AABB aabb = b2Shape_GetAABB( *shape );
	outAabb[0] = aabb.lowerBound.x;
	outAabb[1] = aabb.lowerBound.y;
	outAabb[2] = aabb.upperBound.x;
	outAabb[3] = aabb.upperBound.y;
	return 1;
}

static bool set_joint_body_frames( b2JointDef* base, b2BodyId bodyA, b2BodyId bodyB, int useLocalAnchors, float anchorAX, float anchorAY,
								   float anchorBX, float anchorBY, float axisX, float axisY, float localAngleB )
{
	if ( isfinite( anchorAX ) == false || isfinite( anchorAY ) == false || isfinite( anchorBX ) == false ||
		 isfinite( anchorBY ) == false || isfinite( axisX ) == false || isfinite( axisY ) == false || isfinite( localAngleB ) == false )
	{
		return false;
	}

	if ( useLocalAnchors != 0 )
	{
		base->localFrameA.p = (b2Vec2){ anchorAX, anchorAY };
		base->localFrameB.p = (b2Vec2){ anchorBX, anchorBY };
		base->localFrameA.q = b2MakeRot( atan2f( axisY, axisX ) );
	}
	else
	{
		base->localFrameA.p = b2Body_GetLocalPoint( bodyA, (b2Vec2){ anchorAX, anchorAY } );
		base->localFrameB.p = b2Body_GetLocalPoint( bodyB, (b2Vec2){ anchorBX, anchorBY } );
		b2Vec2 localAxis = b2Body_GetLocalVector( bodyA, (b2Vec2){ axisX, axisY } );
		base->localFrameA.q = b2MakeRot( atan2f( localAxis.y, localAxis.x ) );
	}

	base->localFrameB.q = b2MakeRot( localAngleB );
	return true;
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

EMSCRIPTEN_KEEPALIVE int b2js_create_filter_joint( int worldHandle, int bodyHandleA, int bodyHandleB, int collideConnected,
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

	b2FilterJointDef def = b2DefaultFilterJointDef();
	def.base.bodyIdA = *bodyA;
	def.base.bodyIdB = *bodyB;
	def.base.collideConnected = collideConnected != 0;
	set_joint_base_options( &def.base, constraintHertz, constraintDampingRatio, forceThreshold, torqueThreshold, drawScale );

	b2JointId id = b2CreateFilterJoint( *world, &def );
	int handle = alloc_joint_slot( worldHandle, bodyHandleA, bodyHandleB, b2_filterJoint, id );
	if ( handle == 0 )
	{
		b2DestroyJoint( id, true );
	}

	return handle;
}

EMSCRIPTEN_KEEPALIVE int b2js_create_prismatic_joint( int worldHandle, int bodyHandleA, int bodyHandleB, int useLocalAnchors,
													  float anchorAX, float anchorAY, float anchorBX, float anchorBY, float axisX,
													  float axisY, float localAngleB, int enableSpring, float hertz,
													  float dampingRatio, float targetTranslation, int enableLimit, float lowerTranslation,
													  float upperTranslation, int enableMotor, float motorSpeed, float maxMotorForce,
													  int collideConnected, float constraintHertz, float constraintDampingRatio,
													  float forceThreshold, float torqueThreshold, float drawScale )
{
	b2WorldId* world = get_world( worldHandle );
	b2BodyId* bodyA = get_body( bodyHandleA );
	b2BodyId* bodyB = get_body( bodyHandleB );
	if ( world == NULL || bodyA == NULL || bodyB == NULL )
	{
		return 0;
	}

	b2PrismaticJointDef def = b2DefaultPrismaticJointDef();
	def.base.bodyIdA = *bodyA;
	def.base.bodyIdB = *bodyB;
	if ( set_joint_body_frames( &def.base, *bodyA, *bodyB, useLocalAnchors, anchorAX, anchorAY, anchorBX, anchorBY, axisX, axisY,
								localAngleB ) == false )
	{
		return 0;
	}

	def.base.collideConnected = collideConnected != 0;
	set_joint_base_options( &def.base, constraintHertz, constraintDampingRatio, forceThreshold, torqueThreshold, drawScale );
	def.enableSpring = enableSpring != 0;
	if ( isfinite( hertz ) && hertz >= 0.0f )
	{
		def.hertz = hertz;
	}
	if ( isfinite( dampingRatio ) && dampingRatio >= 0.0f )
	{
		def.dampingRatio = dampingRatio;
	}
	if ( isfinite( targetTranslation ) )
	{
		def.targetTranslation = targetTranslation;
	}
	def.enableLimit = enableLimit != 0;
	if ( isfinite( lowerTranslation ) && isfinite( upperTranslation ) )
	{
		def.lowerTranslation = b2MinFloat( lowerTranslation, upperTranslation );
		def.upperTranslation = b2MaxFloat( lowerTranslation, upperTranslation );
	}
	def.enableMotor = enableMotor != 0;
	if ( isfinite( motorSpeed ) )
	{
		def.motorSpeed = motorSpeed;
	}
	if ( isfinite( maxMotorForce ) && maxMotorForce >= 0.0f )
	{
		def.maxMotorForce = maxMotorForce;
	}

	b2JointId id = b2CreatePrismaticJoint( *world, &def );
	int handle = alloc_joint_slot( worldHandle, bodyHandleA, bodyHandleB, b2_prismaticJoint, id );
	if ( handle == 0 )
	{
		b2DestroyJoint( id, true );
	}

	return handle;
}

EMSCRIPTEN_KEEPALIVE int b2js_create_wheel_joint( int worldHandle, int bodyHandleA, int bodyHandleB, int useLocalAnchors,
												  float anchorAX, float anchorAY, float anchorBX, float anchorBY, float axisX,
												  float axisY, float localAngleB, int enableSpring, float hertz, float dampingRatio,
												  int enableLimit, float lowerTranslation, float upperTranslation, int enableMotor,
												  float motorSpeed, float maxMotorTorque, int collideConnected, float constraintHertz,
												  float constraintDampingRatio, float forceThreshold, float torqueThreshold,
												  float drawScale )
{
	b2WorldId* world = get_world( worldHandle );
	b2BodyId* bodyA = get_body( bodyHandleA );
	b2BodyId* bodyB = get_body( bodyHandleB );
	if ( world == NULL || bodyA == NULL || bodyB == NULL )
	{
		return 0;
	}

	b2WheelJointDef def = b2DefaultWheelJointDef();
	def.base.bodyIdA = *bodyA;
	def.base.bodyIdB = *bodyB;
	if ( set_joint_body_frames( &def.base, *bodyA, *bodyB, useLocalAnchors, anchorAX, anchorAY, anchorBX, anchorBY, axisX, axisY,
								localAngleB ) == false )
	{
		return 0;
	}

	def.base.collideConnected = collideConnected != 0;
	set_joint_base_options( &def.base, constraintHertz, constraintDampingRatio, forceThreshold, torqueThreshold, drawScale );
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
	if ( isfinite( lowerTranslation ) && isfinite( upperTranslation ) )
	{
		def.lowerTranslation = b2MinFloat( lowerTranslation, upperTranslation );
		def.upperTranslation = b2MaxFloat( lowerTranslation, upperTranslation );
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

	b2JointId id = b2CreateWheelJoint( *world, &def );
	int handle = alloc_joint_slot( worldHandle, bodyHandleA, bodyHandleB, b2_wheelJoint, id );
	if ( handle == 0 )
	{
		b2DestroyJoint( id, true );
	}

	return handle;
}

EMSCRIPTEN_KEEPALIVE int b2js_create_motor_joint( int worldHandle, int bodyHandleA, int bodyHandleB, int collideConnected,
												 float linearVelocityX, float linearVelocityY, float angularVelocity,
												 float maxVelocityForce, float maxVelocityTorque, float linearHertz,
												 float linearDampingRatio, float maxSpringForce, float angularHertz,
												 float angularDampingRatio, float maxSpringTorque, float constraintHertz,
												 float constraintDampingRatio, float forceThreshold, float torqueThreshold,
												 float drawScale )
{
	b2WorldId* world = get_world( worldHandle );
	b2BodyId* bodyA = get_body( bodyHandleA );
	b2BodyId* bodyB = get_body( bodyHandleB );
	if ( world == NULL || bodyA == NULL || bodyB == NULL )
	{
		return 0;
	}

	b2MotorJointDef def = b2DefaultMotorJointDef();
	def.base.bodyIdA = *bodyA;
	def.base.bodyIdB = *bodyB;
	def.base.collideConnected = collideConnected != 0;
	set_joint_base_options( &def.base, constraintHertz, constraintDampingRatio, forceThreshold, torqueThreshold, drawScale );
	if ( isfinite( linearVelocityX ) && isfinite( linearVelocityY ) )
	{
		def.linearVelocity = (b2Vec2){ linearVelocityX, linearVelocityY };
	}
	if ( isfinite( angularVelocity ) )
	{
		def.angularVelocity = angularVelocity;
	}
	if ( isfinite( maxVelocityForce ) && maxVelocityForce >= 0.0f )
	{
		def.maxVelocityForce = maxVelocityForce;
	}
	if ( isfinite( maxVelocityTorque ) && maxVelocityTorque >= 0.0f )
	{
		def.maxVelocityTorque = maxVelocityTorque;
	}
	if ( isfinite( linearHertz ) && linearHertz >= 0.0f )
	{
		def.linearHertz = linearHertz;
	}
	if ( isfinite( linearDampingRatio ) && linearDampingRatio >= 0.0f )
	{
		def.linearDampingRatio = linearDampingRatio;
	}
	if ( isfinite( maxSpringForce ) && maxSpringForce >= 0.0f )
	{
		def.maxSpringForce = maxSpringForce;
	}
	if ( isfinite( angularHertz ) && angularHertz >= 0.0f )
	{
		def.angularHertz = angularHertz;
	}
	if ( isfinite( angularDampingRatio ) && angularDampingRatio >= 0.0f )
	{
		def.angularDampingRatio = angularDampingRatio;
	}
	if ( isfinite( maxSpringTorque ) && maxSpringTorque >= 0.0f )
	{
		def.maxSpringTorque = maxSpringTorque;
	}

	b2JointId id = b2CreateMotorJoint( *world, &def );
	int handle = alloc_joint_slot( worldHandle, bodyHandleA, bodyHandleB, b2_motorJoint, id );
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

EMSCRIPTEN_KEEPALIVE void b2js_prismatic_joint_enable_spring( int jointHandle, int enabled )
{
	b2JointId* joint = get_joint_of_type( jointHandle, b2_prismaticJoint );
	if ( joint != NULL ) b2PrismaticJoint_EnableSpring( *joint, enabled != 0 );
}

EMSCRIPTEN_KEEPALIVE int b2js_prismatic_joint_is_spring_enabled( int jointHandle )
{
	b2JointId* joint = get_joint_of_type( jointHandle, b2_prismaticJoint );
	return joint == NULL ? 0 : b2PrismaticJoint_IsSpringEnabled( *joint );
}

EMSCRIPTEN_KEEPALIVE void b2js_prismatic_joint_set_spring_hertz( int jointHandle, float hertz )
{
	b2JointId* joint = get_joint_of_type( jointHandle, b2_prismaticJoint );
	if ( joint != NULL && isfinite( hertz ) && hertz >= 0.0f ) b2PrismaticJoint_SetSpringHertz( *joint, hertz );
}

EMSCRIPTEN_KEEPALIVE float b2js_prismatic_joint_get_spring_hertz( int jointHandle )
{
	b2JointId* joint = get_joint_of_type( jointHandle, b2_prismaticJoint );
	return joint == NULL ? NAN : b2PrismaticJoint_GetSpringHertz( *joint );
}

EMSCRIPTEN_KEEPALIVE void b2js_prismatic_joint_set_spring_damping_ratio( int jointHandle, float dampingRatio )
{
	b2JointId* joint = get_joint_of_type( jointHandle, b2_prismaticJoint );
	if ( joint != NULL && isfinite( dampingRatio ) && dampingRatio >= 0.0f ) b2PrismaticJoint_SetSpringDampingRatio( *joint, dampingRatio );
}

EMSCRIPTEN_KEEPALIVE float b2js_prismatic_joint_get_spring_damping_ratio( int jointHandle )
{
	b2JointId* joint = get_joint_of_type( jointHandle, b2_prismaticJoint );
	return joint == NULL ? NAN : b2PrismaticJoint_GetSpringDampingRatio( *joint );
}

EMSCRIPTEN_KEEPALIVE void b2js_prismatic_joint_set_target_translation( int jointHandle, float translation )
{
	b2JointId* joint = get_joint_of_type( jointHandle, b2_prismaticJoint );
	if ( joint != NULL && isfinite( translation ) ) b2PrismaticJoint_SetTargetTranslation( *joint, translation );
}

EMSCRIPTEN_KEEPALIVE float b2js_prismatic_joint_get_target_translation( int jointHandle )
{
	b2JointId* joint = get_joint_of_type( jointHandle, b2_prismaticJoint );
	return joint == NULL ? NAN : b2PrismaticJoint_GetTargetTranslation( *joint );
}

EMSCRIPTEN_KEEPALIVE void b2js_prismatic_joint_enable_limit( int jointHandle, int enabled )
{
	b2JointId* joint = get_joint_of_type( jointHandle, b2_prismaticJoint );
	if ( joint != NULL ) b2PrismaticJoint_EnableLimit( *joint, enabled != 0 );
}

EMSCRIPTEN_KEEPALIVE int b2js_prismatic_joint_is_limit_enabled( int jointHandle )
{
	b2JointId* joint = get_joint_of_type( jointHandle, b2_prismaticJoint );
	return joint == NULL ? 0 : b2PrismaticJoint_IsLimitEnabled( *joint );
}

EMSCRIPTEN_KEEPALIVE float b2js_prismatic_joint_get_lower_limit( int jointHandle )
{
	b2JointId* joint = get_joint_of_type( jointHandle, b2_prismaticJoint );
	return joint == NULL ? NAN : b2PrismaticJoint_GetLowerLimit( *joint );
}

EMSCRIPTEN_KEEPALIVE float b2js_prismatic_joint_get_upper_limit( int jointHandle )
{
	b2JointId* joint = get_joint_of_type( jointHandle, b2_prismaticJoint );
	return joint == NULL ? NAN : b2PrismaticJoint_GetUpperLimit( *joint );
}

EMSCRIPTEN_KEEPALIVE void b2js_prismatic_joint_set_limits( int jointHandle, float lower, float upper )
{
	b2JointId* joint = get_joint_of_type( jointHandle, b2_prismaticJoint );
	if ( joint != NULL && isfinite( lower ) && isfinite( upper ) && lower <= upper ) b2PrismaticJoint_SetLimits( *joint, lower, upper );
}

EMSCRIPTEN_KEEPALIVE void b2js_prismatic_joint_enable_motor( int jointHandle, int enabled )
{
	b2JointId* joint = get_joint_of_type( jointHandle, b2_prismaticJoint );
	if ( joint != NULL ) b2PrismaticJoint_EnableMotor( *joint, enabled != 0 );
}

EMSCRIPTEN_KEEPALIVE int b2js_prismatic_joint_is_motor_enabled( int jointHandle )
{
	b2JointId* joint = get_joint_of_type( jointHandle, b2_prismaticJoint );
	return joint == NULL ? 0 : b2PrismaticJoint_IsMotorEnabled( *joint );
}

EMSCRIPTEN_KEEPALIVE void b2js_prismatic_joint_set_motor_speed( int jointHandle, float motorSpeed )
{
	b2JointId* joint = get_joint_of_type( jointHandle, b2_prismaticJoint );
	if ( joint != NULL && isfinite( motorSpeed ) ) b2PrismaticJoint_SetMotorSpeed( *joint, motorSpeed );
}

EMSCRIPTEN_KEEPALIVE float b2js_prismatic_joint_get_motor_speed( int jointHandle )
{
	b2JointId* joint = get_joint_of_type( jointHandle, b2_prismaticJoint );
	return joint == NULL ? NAN : b2PrismaticJoint_GetMotorSpeed( *joint );
}

EMSCRIPTEN_KEEPALIVE void b2js_prismatic_joint_set_max_motor_force( int jointHandle, float force )
{
	b2JointId* joint = get_joint_of_type( jointHandle, b2_prismaticJoint );
	if ( joint != NULL && isfinite( force ) && force >= 0.0f ) b2PrismaticJoint_SetMaxMotorForce( *joint, force );
}

EMSCRIPTEN_KEEPALIVE float b2js_prismatic_joint_get_max_motor_force( int jointHandle )
{
	b2JointId* joint = get_joint_of_type( jointHandle, b2_prismaticJoint );
	return joint == NULL ? NAN : b2PrismaticJoint_GetMaxMotorForce( *joint );
}

EMSCRIPTEN_KEEPALIVE float b2js_prismatic_joint_get_motor_force( int jointHandle )
{
	b2JointId* joint = get_joint_of_type( jointHandle, b2_prismaticJoint );
	return joint == NULL ? NAN : b2PrismaticJoint_GetMotorForce( *joint );
}

EMSCRIPTEN_KEEPALIVE float b2js_prismatic_joint_get_translation( int jointHandle )
{
	b2JointId* joint = get_joint_of_type( jointHandle, b2_prismaticJoint );
	return joint == NULL ? NAN : b2PrismaticJoint_GetTranslation( *joint );
}

EMSCRIPTEN_KEEPALIVE float b2js_prismatic_joint_get_speed( int jointHandle )
{
	b2JointId* joint = get_joint_of_type( jointHandle, b2_prismaticJoint );
	return joint == NULL ? NAN : b2PrismaticJoint_GetSpeed( *joint );
}

EMSCRIPTEN_KEEPALIVE void b2js_wheel_joint_enable_spring( int jointHandle, int enabled )
{
	b2JointId* joint = get_joint_of_type( jointHandle, b2_wheelJoint );
	if ( joint != NULL ) b2WheelJoint_EnableSpring( *joint, enabled != 0 );
}

EMSCRIPTEN_KEEPALIVE int b2js_wheel_joint_is_spring_enabled( int jointHandle )
{
	b2JointId* joint = get_joint_of_type( jointHandle, b2_wheelJoint );
	return joint == NULL ? 0 : b2WheelJoint_IsSpringEnabled( *joint );
}

EMSCRIPTEN_KEEPALIVE void b2js_wheel_joint_set_spring_hertz( int jointHandle, float hertz )
{
	b2JointId* joint = get_joint_of_type( jointHandle, b2_wheelJoint );
	if ( joint != NULL && isfinite( hertz ) && hertz >= 0.0f ) b2WheelJoint_SetSpringHertz( *joint, hertz );
}

EMSCRIPTEN_KEEPALIVE float b2js_wheel_joint_get_spring_hertz( int jointHandle )
{
	b2JointId* joint = get_joint_of_type( jointHandle, b2_wheelJoint );
	return joint == NULL ? NAN : b2WheelJoint_GetSpringHertz( *joint );
}

EMSCRIPTEN_KEEPALIVE void b2js_wheel_joint_set_spring_damping_ratio( int jointHandle, float dampingRatio )
{
	b2JointId* joint = get_joint_of_type( jointHandle, b2_wheelJoint );
	if ( joint != NULL && isfinite( dampingRatio ) && dampingRatio >= 0.0f ) b2WheelJoint_SetSpringDampingRatio( *joint, dampingRatio );
}

EMSCRIPTEN_KEEPALIVE float b2js_wheel_joint_get_spring_damping_ratio( int jointHandle )
{
	b2JointId* joint = get_joint_of_type( jointHandle, b2_wheelJoint );
	return joint == NULL ? NAN : b2WheelJoint_GetSpringDampingRatio( *joint );
}

EMSCRIPTEN_KEEPALIVE void b2js_wheel_joint_enable_limit( int jointHandle, int enabled )
{
	b2JointId* joint = get_joint_of_type( jointHandle, b2_wheelJoint );
	if ( joint != NULL ) b2WheelJoint_EnableLimit( *joint, enabled != 0 );
}

EMSCRIPTEN_KEEPALIVE int b2js_wheel_joint_is_limit_enabled( int jointHandle )
{
	b2JointId* joint = get_joint_of_type( jointHandle, b2_wheelJoint );
	return joint == NULL ? 0 : b2WheelJoint_IsLimitEnabled( *joint );
}

EMSCRIPTEN_KEEPALIVE float b2js_wheel_joint_get_lower_limit( int jointHandle )
{
	b2JointId* joint = get_joint_of_type( jointHandle, b2_wheelJoint );
	return joint == NULL ? NAN : b2WheelJoint_GetLowerLimit( *joint );
}

EMSCRIPTEN_KEEPALIVE float b2js_wheel_joint_get_upper_limit( int jointHandle )
{
	b2JointId* joint = get_joint_of_type( jointHandle, b2_wheelJoint );
	return joint == NULL ? NAN : b2WheelJoint_GetUpperLimit( *joint );
}

EMSCRIPTEN_KEEPALIVE void b2js_wheel_joint_set_limits( int jointHandle, float lower, float upper )
{
	b2JointId* joint = get_joint_of_type( jointHandle, b2_wheelJoint );
	if ( joint != NULL && isfinite( lower ) && isfinite( upper ) && lower <= upper ) b2WheelJoint_SetLimits( *joint, lower, upper );
}

EMSCRIPTEN_KEEPALIVE void b2js_wheel_joint_enable_motor( int jointHandle, int enabled )
{
	b2JointId* joint = get_joint_of_type( jointHandle, b2_wheelJoint );
	if ( joint != NULL ) b2WheelJoint_EnableMotor( *joint, enabled != 0 );
}

EMSCRIPTEN_KEEPALIVE int b2js_wheel_joint_is_motor_enabled( int jointHandle )
{
	b2JointId* joint = get_joint_of_type( jointHandle, b2_wheelJoint );
	return joint == NULL ? 0 : b2WheelJoint_IsMotorEnabled( *joint );
}

EMSCRIPTEN_KEEPALIVE void b2js_wheel_joint_set_motor_speed( int jointHandle, float motorSpeed )
{
	b2JointId* joint = get_joint_of_type( jointHandle, b2_wheelJoint );
	if ( joint != NULL && isfinite( motorSpeed ) ) b2WheelJoint_SetMotorSpeed( *joint, motorSpeed );
}

EMSCRIPTEN_KEEPALIVE float b2js_wheel_joint_get_motor_speed( int jointHandle )
{
	b2JointId* joint = get_joint_of_type( jointHandle, b2_wheelJoint );
	return joint == NULL ? NAN : b2WheelJoint_GetMotorSpeed( *joint );
}

EMSCRIPTEN_KEEPALIVE void b2js_wheel_joint_set_max_motor_torque( int jointHandle, float torque )
{
	b2JointId* joint = get_joint_of_type( jointHandle, b2_wheelJoint );
	if ( joint != NULL && isfinite( torque ) && torque >= 0.0f ) b2WheelJoint_SetMaxMotorTorque( *joint, torque );
}

EMSCRIPTEN_KEEPALIVE float b2js_wheel_joint_get_max_motor_torque( int jointHandle )
{
	b2JointId* joint = get_joint_of_type( jointHandle, b2_wheelJoint );
	return joint == NULL ? NAN : b2WheelJoint_GetMaxMotorTorque( *joint );
}

EMSCRIPTEN_KEEPALIVE float b2js_wheel_joint_get_motor_torque( int jointHandle )
{
	b2JointId* joint = get_joint_of_type( jointHandle, b2_wheelJoint );
	return joint == NULL ? NAN : b2WheelJoint_GetMotorTorque( *joint );
}

static b2Vec2 get_motor_joint_linear_velocity_or_nan( int jointHandle )
{
	b2JointId* joint = get_joint_of_type( jointHandle, b2_motorJoint );
	return joint == NULL ? (b2Vec2){ NAN, NAN } : b2MotorJoint_GetLinearVelocity( *joint );
}

EMSCRIPTEN_KEEPALIVE void b2js_motor_joint_set_linear_velocity( int jointHandle, float x, float y )
{
	b2JointId* joint = get_joint_of_type( jointHandle, b2_motorJoint );
	if ( joint != NULL && isfinite( x ) && isfinite( y ) ) b2MotorJoint_SetLinearVelocity( *joint, (b2Vec2){ x, y } );
}

EMSCRIPTEN_KEEPALIVE float b2js_motor_joint_get_linear_velocity_x( int jointHandle )
{
	return get_motor_joint_linear_velocity_or_nan( jointHandle ).x;
}

EMSCRIPTEN_KEEPALIVE float b2js_motor_joint_get_linear_velocity_y( int jointHandle )
{
	return get_motor_joint_linear_velocity_or_nan( jointHandle ).y;
}

EMSCRIPTEN_KEEPALIVE void b2js_motor_joint_set_angular_velocity( int jointHandle, float velocity )
{
	b2JointId* joint = get_joint_of_type( jointHandle, b2_motorJoint );
	if ( joint != NULL && isfinite( velocity ) ) b2MotorJoint_SetAngularVelocity( *joint, velocity );
}

EMSCRIPTEN_KEEPALIVE float b2js_motor_joint_get_angular_velocity( int jointHandle )
{
	b2JointId* joint = get_joint_of_type( jointHandle, b2_motorJoint );
	return joint == NULL ? NAN : b2MotorJoint_GetAngularVelocity( *joint );
}

EMSCRIPTEN_KEEPALIVE void b2js_motor_joint_set_max_velocity_force( int jointHandle, float force )
{
	b2JointId* joint = get_joint_of_type( jointHandle, b2_motorJoint );
	if ( joint != NULL && isfinite( force ) && force >= 0.0f ) b2MotorJoint_SetMaxVelocityForce( *joint, force );
}

EMSCRIPTEN_KEEPALIVE float b2js_motor_joint_get_max_velocity_force( int jointHandle )
{
	b2JointId* joint = get_joint_of_type( jointHandle, b2_motorJoint );
	return joint == NULL ? NAN : b2MotorJoint_GetMaxVelocityForce( *joint );
}

EMSCRIPTEN_KEEPALIVE void b2js_motor_joint_set_max_velocity_torque( int jointHandle, float torque )
{
	b2JointId* joint = get_joint_of_type( jointHandle, b2_motorJoint );
	if ( joint != NULL && isfinite( torque ) && torque >= 0.0f ) b2MotorJoint_SetMaxVelocityTorque( *joint, torque );
}

EMSCRIPTEN_KEEPALIVE float b2js_motor_joint_get_max_velocity_torque( int jointHandle )
{
	b2JointId* joint = get_joint_of_type( jointHandle, b2_motorJoint );
	return joint == NULL ? NAN : b2MotorJoint_GetMaxVelocityTorque( *joint );
}

EMSCRIPTEN_KEEPALIVE void b2js_motor_joint_set_linear_hertz( int jointHandle, float hertz )
{
	b2JointId* joint = get_joint_of_type( jointHandle, b2_motorJoint );
	if ( joint != NULL && isfinite( hertz ) && hertz >= 0.0f ) b2MotorJoint_SetLinearHertz( *joint, hertz );
}

EMSCRIPTEN_KEEPALIVE float b2js_motor_joint_get_linear_hertz( int jointHandle )
{
	b2JointId* joint = get_joint_of_type( jointHandle, b2_motorJoint );
	return joint == NULL ? NAN : b2MotorJoint_GetLinearHertz( *joint );
}

EMSCRIPTEN_KEEPALIVE void b2js_motor_joint_set_linear_damping_ratio( int jointHandle, float damping )
{
	b2JointId* joint = get_joint_of_type( jointHandle, b2_motorJoint );
	if ( joint != NULL && isfinite( damping ) && damping >= 0.0f ) b2MotorJoint_SetLinearDampingRatio( *joint, damping );
}

EMSCRIPTEN_KEEPALIVE float b2js_motor_joint_get_linear_damping_ratio( int jointHandle )
{
	b2JointId* joint = get_joint_of_type( jointHandle, b2_motorJoint );
	return joint == NULL ? NAN : b2MotorJoint_GetLinearDampingRatio( *joint );
}

EMSCRIPTEN_KEEPALIVE void b2js_motor_joint_set_angular_hertz( int jointHandle, float hertz )
{
	b2JointId* joint = get_joint_of_type( jointHandle, b2_motorJoint );
	if ( joint != NULL && isfinite( hertz ) && hertz >= 0.0f ) b2MotorJoint_SetAngularHertz( *joint, hertz );
}

EMSCRIPTEN_KEEPALIVE float b2js_motor_joint_get_angular_hertz( int jointHandle )
{
	b2JointId* joint = get_joint_of_type( jointHandle, b2_motorJoint );
	return joint == NULL ? NAN : b2MotorJoint_GetAngularHertz( *joint );
}

EMSCRIPTEN_KEEPALIVE void b2js_motor_joint_set_angular_damping_ratio( int jointHandle, float damping )
{
	b2JointId* joint = get_joint_of_type( jointHandle, b2_motorJoint );
	if ( joint != NULL && isfinite( damping ) && damping >= 0.0f ) b2MotorJoint_SetAngularDampingRatio( *joint, damping );
}

EMSCRIPTEN_KEEPALIVE float b2js_motor_joint_get_angular_damping_ratio( int jointHandle )
{
	b2JointId* joint = get_joint_of_type( jointHandle, b2_motorJoint );
	return joint == NULL ? NAN : b2MotorJoint_GetAngularDampingRatio( *joint );
}

EMSCRIPTEN_KEEPALIVE void b2js_motor_joint_set_max_spring_force( int jointHandle, float force )
{
	b2JointId* joint = get_joint_of_type( jointHandle, b2_motorJoint );
	if ( joint != NULL && isfinite( force ) && force >= 0.0f ) b2MotorJoint_SetMaxSpringForce( *joint, force );
}

EMSCRIPTEN_KEEPALIVE float b2js_motor_joint_get_max_spring_force( int jointHandle )
{
	b2JointId* joint = get_joint_of_type( jointHandle, b2_motorJoint );
	return joint == NULL ? NAN : b2MotorJoint_GetMaxSpringForce( *joint );
}

EMSCRIPTEN_KEEPALIVE void b2js_motor_joint_set_max_spring_torque( int jointHandle, float torque )
{
	b2JointId* joint = get_joint_of_type( jointHandle, b2_motorJoint );
	if ( joint != NULL && isfinite( torque ) && torque >= 0.0f ) b2MotorJoint_SetMaxSpringTorque( *joint, torque );
}

EMSCRIPTEN_KEEPALIVE float b2js_motor_joint_get_max_spring_torque( int jointHandle )
{
	b2JointId* joint = get_joint_of_type( jointHandle, b2_motorJoint );
	return joint == NULL ? NAN : b2MotorJoint_GetMaxSpringTorque( *joint );
}

EMSCRIPTEN_KEEPALIVE void b2js_world_set_gravity( int worldHandle, float x, float y )
{
	b2WorldId* world = get_world( worldHandle );
	if ( world != NULL && isfinite( x ) && isfinite( y ) )
	{
		b2World_SetGravity( *world, (b2Vec2){ x, y } );
	}
}

EMSCRIPTEN_KEEPALIVE float b2js_world_get_gravity_x( int worldHandle )
{
	b2WorldId* world = get_world( worldHandle );
	return world == NULL ? NAN : b2World_GetGravity( *world ).x;
}

EMSCRIPTEN_KEEPALIVE float b2js_world_get_gravity_y( int worldHandle )
{
	b2WorldId* world = get_world( worldHandle );
	return world == NULL ? NAN : b2World_GetGravity( *world ).y;
}

EMSCRIPTEN_KEEPALIVE void b2js_world_enable_sleeping( int worldHandle, int enabled )
{
	b2WorldId* world = get_world( worldHandle );
	if ( world != NULL )
	{
		b2World_EnableSleeping( *world, enabled != 0 );
	}
}

EMSCRIPTEN_KEEPALIVE int b2js_world_is_sleeping_enabled( int worldHandle )
{
	b2WorldId* world = get_world( worldHandle );
	return world == NULL ? 0 : b2World_IsSleepingEnabled( *world );
}

EMSCRIPTEN_KEEPALIVE void b2js_world_enable_continuous( int worldHandle, int enabled )
{
	b2WorldId* world = get_world( worldHandle );
	if ( world != NULL )
	{
		b2World_EnableContinuous( *world, enabled != 0 );
	}
}

EMSCRIPTEN_KEEPALIVE int b2js_world_is_continuous_enabled( int worldHandle )
{
	b2WorldId* world = get_world( worldHandle );
	return world == NULL ? 0 : b2World_IsContinuousEnabled( *world );
}

EMSCRIPTEN_KEEPALIVE void b2js_world_set_restitution_threshold( int worldHandle, float value )
{
	b2WorldId* world = get_world( worldHandle );
	if ( world != NULL && isfinite( value ) && value >= 0.0f )
	{
		b2World_SetRestitutionThreshold( *world, value );
	}
}

EMSCRIPTEN_KEEPALIVE float b2js_world_get_restitution_threshold( int worldHandle )
{
	b2WorldId* world = get_world( worldHandle );
	return world == NULL ? NAN : b2World_GetRestitutionThreshold( *world );
}

EMSCRIPTEN_KEEPALIVE void b2js_world_set_hit_event_threshold( int worldHandle, float value )
{
	b2WorldId* world = get_world( worldHandle );
	if ( world != NULL && isfinite( value ) && value >= 0.0f )
	{
		b2World_SetHitEventThreshold( *world, value );
	}
}

EMSCRIPTEN_KEEPALIVE float b2js_world_get_hit_event_threshold( int worldHandle )
{
	b2WorldId* world = get_world( worldHandle );
	return world == NULL ? NAN : b2World_GetHitEventThreshold( *world );
}

EMSCRIPTEN_KEEPALIVE void b2js_world_set_contact_tuning( int worldHandle, float hertz, float dampingRatio, float pushSpeed )
{
	b2WorldId* world = get_world( worldHandle );
	if ( world != NULL && isfinite( hertz ) && hertz >= 0.0f && isfinite( dampingRatio ) && dampingRatio >= 0.0f &&
		 isfinite( pushSpeed ) && pushSpeed >= 0.0f )
	{
		b2World_SetContactTuning( *world, hertz, dampingRatio, pushSpeed );
	}
}

EMSCRIPTEN_KEEPALIVE void b2js_world_set_contact_recycle_distance( int worldHandle, float value )
{
	b2WorldId* world = get_world( worldHandle );
	if ( world != NULL && isfinite( value ) && value >= 0.0f )
	{
		b2World_SetContactRecycleDistance( *world, value );
	}
}

EMSCRIPTEN_KEEPALIVE float b2js_world_get_contact_recycle_distance( int worldHandle )
{
	b2WorldId* world = get_world( worldHandle );
	return world == NULL ? NAN : b2World_GetContactRecycleDistance( *world );
}

EMSCRIPTEN_KEEPALIVE void b2js_world_set_maximum_linear_speed( int worldHandle, float value )
{
	b2WorldId* world = get_world( worldHandle );
	if ( world != NULL && isfinite( value ) && value > 0.0f )
	{
		b2World_SetMaximumLinearSpeed( *world, value );
	}
}

EMSCRIPTEN_KEEPALIVE float b2js_world_get_maximum_linear_speed( int worldHandle )
{
	b2WorldId* world = get_world( worldHandle );
	return world == NULL ? NAN : b2World_GetMaximumLinearSpeed( *world );
}

EMSCRIPTEN_KEEPALIVE void b2js_world_enable_warm_starting( int worldHandle, int enabled )
{
	b2WorldId* world = get_world( worldHandle );
	if ( world != NULL )
	{
		b2World_EnableWarmStarting( *world, enabled != 0 );
	}
}

EMSCRIPTEN_KEEPALIVE int b2js_world_is_warm_starting_enabled( int worldHandle )
{
	b2WorldId* world = get_world( worldHandle );
	return world == NULL ? 0 : b2World_IsWarmStartingEnabled( *world );
}

EMSCRIPTEN_KEEPALIVE int b2js_world_get_awake_body_count( int worldHandle )
{
	b2WorldId* world = get_world( worldHandle );
	return world == NULL ? 0 : b2World_GetAwakeBodyCount( *world );
}

EMSCRIPTEN_KEEPALIVE void b2js_world_enable_friction_callback( int worldHandle, int enabled )
{
	b2WorldId* world = get_world( worldHandle );
	if ( world != NULL )
	{
		b2World_SetFrictionCallback( *world, enabled != 0 ? b2js_friction_callback : NULL );
	}
}

EMSCRIPTEN_KEEPALIVE void b2js_world_enable_restitution_callback( int worldHandle, int enabled )
{
	b2WorldId* world = get_world( worldHandle );
	if ( world != NULL )
	{
		b2World_SetRestitutionCallback( *world, enabled != 0 ? b2js_restitution_callback : NULL );
	}
}

EMSCRIPTEN_KEEPALIVE void b2js_clear_friction_mix_rules( void )
{
	frictionMixRuleCount = 0;
}

EMSCRIPTEN_KEEPALIVE int b2js_add_friction_mix_rule( uint32_t materialA, uint32_t materialB, float friction )
{
	if ( frictionMixRuleCount >= b2js_maxMixRules || isfinite( friction ) == false || friction < 0.0f )
	{
		return 0;
	}

	frictionMixRules[frictionMixRuleCount++] = (MixRule){ (uint64_t)materialA, (uint64_t)materialB, friction };
	return 1;
}

EMSCRIPTEN_KEEPALIVE void b2js_clear_restitution_mix_rules( void )
{
	restitutionMixRuleCount = 0;
}

EMSCRIPTEN_KEEPALIVE int b2js_add_restitution_mix_rule( uint32_t materialA, uint32_t materialB, float restitution )
{
	if ( restitutionMixRuleCount >= b2js_maxMixRules || isfinite( restitution ) == false || restitution < 0.0f )
	{
		return 0;
	}

	restitutionMixRules[restitutionMixRuleCount++] = (MixRule){ (uint64_t)materialA, (uint64_t)materialB, restitution };
	return 1;
}

EMSCRIPTEN_KEEPALIVE int b2js_world_cast_ray_closest( int worldHandle, float ox, float oy, float tx, float ty, uint32_t categoryBits,
													  uint32_t maskBits, float* outResult )
{
	b2WorldId* world = get_world( worldHandle );
	if ( world == NULL || outResult == NULL || isfinite( ox ) == false || isfinite( oy ) == false || isfinite( tx ) == false ||
		 isfinite( ty ) == false )
	{
		return 0;
	}

	b2RayResult result =
		b2World_CastRayClosest( *world, (b2Vec2){ ox, oy }, (b2Vec2){ tx, ty }, make_query_filter( categoryBits, maskBits ) );
	outResult[0] = result.point.x;
	outResult[1] = result.point.y;
	outResult[2] = result.normal.x;
	outResult[3] = result.normal.y;
	outResult[4] = result.fraction;
	outResult[5] = (float)result.nodeVisits;
	outResult[6] = (float)result.leafVisits;
	return result.hit ? find_shape_handle( result.shapeId ) : 0;
}

typedef struct QueryContext
{
	int* handles;
	int count;
	int capacity;
} QueryContext;

static bool b2js_overlap_callback( b2ShapeId shapeId, void* context )
{
	QueryContext* query = (QueryContext*)context;
	if ( query->count >= query->capacity )
	{
		return false;
	}

	query->handles[query->count++] = find_shape_handle( shapeId );
	return query->count < query->capacity;
}

EMSCRIPTEN_KEEPALIVE int b2js_world_overlap_aabb( int worldHandle, float lowerX, float lowerY, float upperX, float upperY,
												  uint32_t categoryBits, uint32_t maskBits, int* outShapeHandles, int capacity )
{
	b2WorldId* world = get_world( worldHandle );
	if ( world == NULL || outShapeHandles == NULL || capacity <= 0 || isfinite( lowerX ) == false || isfinite( lowerY ) == false ||
		 isfinite( upperX ) == false || isfinite( upperY ) == false )
	{
		return 0;
	}

	b2AABB aabb = { { b2MinFloat( lowerX, upperX ), b2MinFloat( lowerY, upperY ) },
					{ b2MaxFloat( lowerX, upperX ), b2MaxFloat( lowerY, upperY ) } };
	QueryContext context = { outShapeHandles, 0, capacity };
	b2World_OverlapAABB( *world, aabb, make_query_filter( categoryBits, maskBits ), b2js_overlap_callback, &context );
	return context.count;
}

EMSCRIPTEN_KEEPALIVE int b2js_world_get_body_event_count( int worldHandle )
{
	b2WorldId* world = get_world( worldHandle );
	return world == NULL ? 0 : b2World_GetBodyEvents( *world ).moveCount;
}

EMSCRIPTEN_KEEPALIVE int b2js_world_get_body_events( int worldHandle, int* outBodyHandles, float* outTransforms, int* outFellAsleep,
													 int capacity )
{
	b2WorldId* world = get_world( worldHandle );
	if ( world == NULL || outBodyHandles == NULL || outTransforms == NULL || outFellAsleep == NULL || capacity <= 0 )
	{
		return 0;
	}

	b2BodyEvents events = b2World_GetBodyEvents( *world );
	int count = b2MinInt( events.moveCount, capacity );
	for ( int i = 0; i < count; ++i )
	{
		b2BodyMoveEvent event = events.moveEvents[i];
		outBodyHandles[i] = find_body_handle( event.bodyId );
		outTransforms[i * 3] = event.transform.p.x;
		outTransforms[i * 3 + 1] = event.transform.p.y;
		outTransforms[i * 3 + 2] = b2Rot_GetAngle( event.transform.q );
		outFellAsleep[i] = event.fellAsleep ? 1 : 0;
	}

	return count;
}

EMSCRIPTEN_KEEPALIVE int b2js_world_get_contact_begin_count( int worldHandle )
{
	b2WorldId* world = get_world( worldHandle );
	return world == NULL ? 0 : b2World_GetContactEvents( *world ).beginCount;
}

EMSCRIPTEN_KEEPALIVE int b2js_world_get_contact_end_count( int worldHandle )
{
	b2WorldId* world = get_world( worldHandle );
	return world == NULL ? 0 : b2World_GetContactEvents( *world ).endCount;
}

EMSCRIPTEN_KEEPALIVE int b2js_world_get_contact_hit_count( int worldHandle )
{
	b2WorldId* world = get_world( worldHandle );
	return world == NULL ? 0 : b2World_GetContactEvents( *world ).hitCount;
}

EMSCRIPTEN_KEEPALIVE int b2js_world_get_contact_begin_events( int worldHandle, int* outShapeHandles, int capacity )
{
	b2WorldId* world = get_world( worldHandle );
	if ( world == NULL || outShapeHandles == NULL || capacity <= 0 )
	{
		return 0;
	}

	b2ContactEvents events = b2World_GetContactEvents( *world );
	int count = b2MinInt( events.beginCount, capacity );
	for ( int i = 0; i < count; ++i )
	{
		outShapeHandles[i * 2] = find_shape_handle( events.beginEvents[i].shapeIdA );
		outShapeHandles[i * 2 + 1] = find_shape_handle( events.beginEvents[i].shapeIdB );
	}

	return count;
}

EMSCRIPTEN_KEEPALIVE int b2js_world_get_contact_end_events( int worldHandle, int* outShapeHandles, int capacity )
{
	b2WorldId* world = get_world( worldHandle );
	if ( world == NULL || outShapeHandles == NULL || capacity <= 0 )
	{
		return 0;
	}

	b2ContactEvents events = b2World_GetContactEvents( *world );
	int count = b2MinInt( events.endCount, capacity );
	for ( int i = 0; i < count; ++i )
	{
		outShapeHandles[i * 2] = find_shape_handle( events.endEvents[i].shapeIdA );
		outShapeHandles[i * 2 + 1] = find_shape_handle( events.endEvents[i].shapeIdB );
	}

	return count;
}

EMSCRIPTEN_KEEPALIVE int b2js_world_get_contact_hit_events( int worldHandle, int* outShapeHandles, float* outHitData, int capacity )
{
	b2WorldId* world = get_world( worldHandle );
	if ( world == NULL || outShapeHandles == NULL || outHitData == NULL || capacity <= 0 )
	{
		return 0;
	}

	b2ContactEvents events = b2World_GetContactEvents( *world );
	int count = b2MinInt( events.hitCount, capacity );
	for ( int i = 0; i < count; ++i )
	{
		b2ContactHitEvent event = events.hitEvents[i];
		outShapeHandles[i * 2] = find_shape_handle( event.shapeIdA );
		outShapeHandles[i * 2 + 1] = find_shape_handle( event.shapeIdB );
		outHitData[i * 5] = event.point.x;
		outHitData[i * 5 + 1] = event.point.y;
		outHitData[i * 5 + 2] = event.normal.x;
		outHitData[i * 5 + 3] = event.normal.y;
		outHitData[i * 5 + 4] = event.approachSpeed;
	}

	return count;
}

EMSCRIPTEN_KEEPALIVE int b2js_world_get_sensor_begin_count( int worldHandle )
{
	b2WorldId* world = get_world( worldHandle );
	return world == NULL ? 0 : b2World_GetSensorEvents( *world ).beginCount;
}

EMSCRIPTEN_KEEPALIVE int b2js_world_get_sensor_end_count( int worldHandle )
{
	b2WorldId* world = get_world( worldHandle );
	return world == NULL ? 0 : b2World_GetSensorEvents( *world ).endCount;
}

EMSCRIPTEN_KEEPALIVE int b2js_world_get_sensor_begin_events( int worldHandle, int* outShapeHandles, int capacity )
{
	b2WorldId* world = get_world( worldHandle );
	if ( world == NULL || outShapeHandles == NULL || capacity <= 0 )
	{
		return 0;
	}

	b2SensorEvents events = b2World_GetSensorEvents( *world );
	int count = b2MinInt( events.beginCount, capacity );
	for ( int i = 0; i < count; ++i )
	{
		outShapeHandles[i * 2] = find_shape_handle( events.beginEvents[i].sensorShapeId );
		outShapeHandles[i * 2 + 1] = find_shape_handle( events.beginEvents[i].visitorShapeId );
	}

	return count;
}

EMSCRIPTEN_KEEPALIVE int b2js_world_get_sensor_end_events( int worldHandle, int* outShapeHandles, int capacity )
{
	b2WorldId* world = get_world( worldHandle );
	if ( world == NULL || outShapeHandles == NULL || capacity <= 0 )
	{
		return 0;
	}

	b2SensorEvents events = b2World_GetSensorEvents( *world );
	int count = b2MinInt( events.endCount, capacity );
	for ( int i = 0; i < count; ++i )
	{
		outShapeHandles[i * 2] = find_shape_handle( events.endEvents[i].sensorShapeId );
		outShapeHandles[i * 2 + 1] = find_shape_handle( events.endEvents[i].visitorShapeId );
	}

	return count;
}

EMSCRIPTEN_KEEPALIVE int b2js_world_get_joint_event_count( int worldHandle )
{
	b2WorldId* world = get_world( worldHandle );
	return world == NULL ? 0 : b2World_GetJointEvents( *world ).count;
}

EMSCRIPTEN_KEEPALIVE int b2js_world_get_joint_events( int worldHandle, int* outJointHandles, int capacity )
{
	b2WorldId* world = get_world( worldHandle );
	if ( world == NULL || outJointHandles == NULL || capacity <= 0 )
	{
		return 0;
	}

	b2JointEvents events = b2World_GetJointEvents( *world );
	int count = b2MinInt( events.count, capacity );
	for ( int i = 0; i < count; ++i )
	{
		outJointHandles[i] = find_joint_handle( events.jointEvents[i].jointId );
	}

	return count;
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
