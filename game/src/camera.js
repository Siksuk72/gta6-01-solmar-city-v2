// Third-person camera: follows behind the player on foot or behind the car,
// with mouse-drag orbit, wheel zoom and a soft landing on the target.
import { clamp, angleLerp } from './random.js';

const THREE = window.THREE;

export class ThirdPersonCamera {
  constructor(camera) {
    this.camera = camera;
    this.yaw = 0;
    this.pitch = 0.32;
    this.distance = 10;
    this.targetDistance = 10;
    this.position = new THREE.Vector3(0, 8, -14);
    this.lookTarget = new THREE.Vector3(0, 1.5, 0);
    this.lastDragTime = -10;
    this.time = 0;
  }

  update(dt, input, focus, inCar, carHeading, speedRatio) {
    this.time += dt;
    // Mouse drag orbits; wheel zooms.
    if (input.mouseDX !== 0 || input.mouseDY !== 0) {
      this.yaw -= input.mouseDX * 0.005;
      this.pitch = clamp(this.pitch + input.mouseDY * 0.004, 0.05, 1.1);
      this.lastDragTime = this.time;
    }
    if (input.wheelDelta !== 0) {
      // Zoom speed grows with distance: a fixed step feels dead when far
      // out and twitchy when close in, so the wheel moves ~6% of the
      // current distance per notch plus a small fixed step.
      this.targetDistance = clamp(this.targetDistance + input.wheelDelta * (0.006 + this.targetDistance * 0.0006), 5, 20);
    }
    this.distance += (this.targetDistance - this.distance) * Math.min(1, dt * 6);
    // Speed feel: the lens opens up a little as the car goes faster, so a
    // flat-out run and a NOS burst actually look faster. Eases back at rest.
    const baseFov = 62;
    const targetFov = baseFov + (inCar ? clamp(speedRatio || 0, 0, 1) * 9 : 0);
    if (Math.abs(this.camera.fov - targetFov) > 0.05) {
      this.camera.fov += (targetFov - this.camera.fov) * Math.min(1, dt * 3);
      this.camera.updateProjectionMatrix();
    }
    // In a car the camera drifts back behind the car's heading unless the
    // player has just dragged it somewhere else.
    if (inCar && this.time - this.lastDragTime > 1.2) {
      const behind = carHeading + Math.PI;
      this.yaw = angleLerp(this.yaw, behind, Math.min(1, dt * 1.4));
    }
    const target = new THREE.Vector3(focus.x, focus.y + (inCar ? 1.6 : 1.6), focus.z);
    const offset = new THREE.Vector3(
      Math.sin(this.yaw) * Math.cos(this.pitch),
      Math.sin(this.pitch),
      Math.cos(this.yaw) * Math.cos(this.pitch),
    ).multiplyScalar(this.distance);
    const desired = target.clone().add(offset);
    desired.y = Math.max(desired.y, 1.2);
    this.position.lerp(desired, Math.min(1, dt * 8));
    this.lookTarget.lerp(target, Math.min(1, dt * 10));
    this.camera.position.copy(this.position);
    this.camera.lookAt(this.lookTarget);
  }

  // A high cinematic view for the city vista screenshot.
  setVista() {
    this.position.set(60, 130, -260);
    this.lookTarget.set(0, 10, 0);
    this.camera.position.copy(this.position);
    this.camera.lookAt(this.lookTarget);
  }
}
