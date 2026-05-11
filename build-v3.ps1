$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$buildDir = Join-Path $root "build"
$box2dDir = Join-Path $root "Box2D_v3.1.1"
$emsdkEnv = "C:\Users\matt\emsdk\emsdk_env.bat"
$output = Join-Path $buildDir "Box2D_v3.1.1.js"
$responseFile = Join-Path $buildDir "box2d-v3-emcc.rsp"

New-Item -ItemType Directory -Force $buildDir | Out-Null

$exports = @(
  "_malloc",
  "_free",
  "_b2js_create_world",
  "_b2js_destroy_world",
  "_b2js_create_body",
  "_b2js_destroy_body",
  "_b2js_create_box_shape",
  "_b2js_create_circle_shape",
  "_b2js_create_segment_shape",
  "_b2js_create_polygon_shape",
  "_b2js_create_distance_joint",
  "_b2js_create_revolute_joint",
  "_b2js_revolute_joint_set_motor",
  "_b2js_destroy_joint",
  "_b2js_joint_get_type",
  "_b2js_joint_wake_bodies",
  "_b2js_joint_set_collide_connected",
  "_b2js_joint_get_collide_connected",
  "_b2js_joint_set_local_frame_a",
  "_b2js_joint_set_local_frame_b",
  "_b2js_joint_get_local_frame_a_x",
  "_b2js_joint_get_local_frame_a_y",
  "_b2js_joint_get_local_frame_a_angle",
  "_b2js_joint_get_local_frame_b_x",
  "_b2js_joint_get_local_frame_b_y",
  "_b2js_joint_get_local_frame_b_angle",
  "_b2js_joint_set_constraint_tuning",
  "_b2js_joint_get_constraint_hertz",
  "_b2js_joint_get_constraint_damping_ratio",
  "_b2js_joint_set_force_threshold",
  "_b2js_joint_get_force_threshold",
  "_b2js_joint_set_torque_threshold",
  "_b2js_joint_get_torque_threshold",
  "_b2js_joint_get_constraint_force_x",
  "_b2js_joint_get_constraint_force_y",
  "_b2js_joint_get_constraint_torque",
  "_b2js_joint_get_linear_separation",
  "_b2js_joint_get_angular_separation",
  "_b2js_distance_joint_set_length",
  "_b2js_distance_joint_get_length",
  "_b2js_distance_joint_enable_spring",
  "_b2js_distance_joint_is_spring_enabled",
  "_b2js_distance_joint_set_spring_force_range",
  "_b2js_distance_joint_get_lower_spring_force",
  "_b2js_distance_joint_get_upper_spring_force",
  "_b2js_distance_joint_set_spring_hertz",
  "_b2js_distance_joint_get_spring_hertz",
  "_b2js_distance_joint_set_spring_damping_ratio",
  "_b2js_distance_joint_get_spring_damping_ratio",
  "_b2js_distance_joint_enable_limit",
  "_b2js_distance_joint_is_limit_enabled",
  "_b2js_distance_joint_set_length_range",
  "_b2js_distance_joint_get_min_length",
  "_b2js_distance_joint_get_max_length",
  "_b2js_distance_joint_get_current_length",
  "_b2js_distance_joint_enable_motor",
  "_b2js_distance_joint_is_motor_enabled",
  "_b2js_distance_joint_set_motor_speed",
  "_b2js_distance_joint_get_motor_speed",
  "_b2js_distance_joint_set_max_motor_force",
  "_b2js_distance_joint_get_max_motor_force",
  "_b2js_distance_joint_get_motor_force",
  "_b2js_revolute_joint_enable_spring",
  "_b2js_revolute_joint_is_spring_enabled",
  "_b2js_revolute_joint_set_spring_hertz",
  "_b2js_revolute_joint_get_spring_hertz",
  "_b2js_revolute_joint_set_spring_damping_ratio",
  "_b2js_revolute_joint_get_spring_damping_ratio",
  "_b2js_revolute_joint_set_target_angle",
  "_b2js_revolute_joint_get_target_angle",
  "_b2js_revolute_joint_get_angle",
  "_b2js_revolute_joint_enable_limit",
  "_b2js_revolute_joint_is_limit_enabled",
  "_b2js_revolute_joint_get_lower_limit",
  "_b2js_revolute_joint_get_upper_limit",
  "_b2js_revolute_joint_set_limits",
  "_b2js_revolute_joint_enable_motor",
  "_b2js_revolute_joint_is_motor_enabled",
  "_b2js_revolute_joint_set_motor_speed",
  "_b2js_revolute_joint_get_motor_speed",
  "_b2js_revolute_joint_get_motor_torque",
  "_b2js_revolute_joint_set_max_motor_torque",
  "_b2js_revolute_joint_get_max_motor_torque",
  "_b2js_step",
  "_b2js_body_get_position_x",
  "_b2js_body_get_position_y",
  "_b2js_body_get_angle",
  "_b2js_body_get_velocity_x",
  "_b2js_body_get_velocity_y",
  "_b2js_body_get_mass",
  "_b2js_read_body_transforms"
)

$sources = Get-ChildItem -Path (Join-Path $box2dDir "src") -Filter "*.c" | Sort-Object Name | ForEach-Object { $_.FullName }
$sources += Join-Path $root "v3\box2d_v3_shim.c"

$includeDir = (Join-Path $box2dDir "include").Replace("\", "/")
$srcDir = (Join-Path $box2dDir "src").Replace("\", "/")
$outputArg = $output.Replace("\", "/")

$args = @(
  "-O3",
  "-std=gnu17",
  "-msimd128",
  "-msse2",
  "-I$includeDir",
  "-I$srcDir",
  "-sMODULARIZE=1",
  "-sEXPORT_NAME=Box2DModule",
  "-sENVIRONMENT=web,node",
  "-sALLOW_MEMORY_GROWTH=1",
  "-sNO_FILESYSTEM=1",
  "-sEXPORTED_FUNCTIONS=['$($exports -join "','")']",
  "-sEXPORTED_RUNTIME_METHODS=['HEAP32','HEAPF32']",
  "-o",
  $outputArg
)

$args += ($sources | ForEach-Object { $_.Replace("\", "/") })
$args | Set-Content -Encoding ASCII $responseFile

cmd /c "call `"$emsdkEnv`" >nul && emcc @`"$responseFile`""
if ($LASTEXITCODE -ne 0) {
  throw "emcc failed with exit code $LASTEXITCODE"
}
