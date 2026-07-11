import { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";

export default function ThreeBackground({ modelPath, useAI }) {
  const mountRef = useRef(null);
  const useAIRef = useRef(useAI);

  useEffect(() => {
    useAIRef.current = useAI;
  }, [useAI]);

  useEffect(() => {
    const mount = mountRef.current;

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(
      50,
      mount.clientWidth / mount.clientHeight,
      0.1,
      1000
    );
    camera.position.set(0, 0, 2.5);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);

    // Lights
    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambient);

    const dirLight = new THREE.DirectionalLight(0x38f3bb, 1.2);
    dirLight.position.set(5, 10, 5);
    scene.add(dirLight);

    const pointLight = new THREE.PointLight(0x7059ff, 1.5, 20);
    pointLight.position.set(-3, 2, 3);
    scene.add(pointLight);

    const rimLight = new THREE.PointLight(0xff6f00, 0, 10);
    rimLight.position.set(3, -2, -3);
    scene.add(rimLight);

    // --- Cursor tracking state ---
    // Normalized cursor position: -1 to +1 on both axes
    let cursorX = 0;
    let cursorY = 0;
    // Smoothed values for lerping
    let smoothCursorX = 0;
    let smoothCursorY = 0;

    // --- Drag state ---
    let isDragging = false;
    let prevMouseX = 0;
    let prevMouseY = 0;
    let rotX = 0;
    let rotY = 0;
    let velX = 0;
    let velY = 0;

    // Track cursor position globally (normalized -1 to +1)
    const handleMouseMove = (e) => {
      const rect = mount.getBoundingClientRect();
      // Normalize relative to the mount element
      cursorX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      cursorY = -(((e.clientY - rect.top) / rect.height) * 2 - 1);

      if (isDragging) {
        const dx = e.clientX - prevMouseX;
        const dy = e.clientY - prevMouseY;
        prevMouseX = e.clientX;
        prevMouseY = e.clientY;
        velX = dx;
        velY = dy;
        rotY += dx * 0.01;
        rotX += dy * 0.01;
        rotX = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, rotX));
      }
    };

    const handleMouseDown = (e) => {
      isDragging = true;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;
      velX = 0;
      velY = 0;
      mount.style.cursor = "grabbing";
    };

    const handleMouseUp = () => {
      isDragging = false;
      mount.style.cursor = "grab";
    };

    // Reset cursor to center when mouse leaves
    const handleMouseLeave = () => {
      cursorX = 0;
      cursorY = 0;
    };

    const handleTouchStart = (e) => {
      const touch = e.touches[0];
      isDragging = true;
      prevMouseX = touch.clientX;
      prevMouseY = touch.clientY;
      velX = 0;
      velY = 0;
    };

    const handleTouchMove = (e) => {
      if (!isDragging) return;
      e.preventDefault();
      const touch = e.touches[0];
      const rect = mount.getBoundingClientRect();
      cursorX = ((touch.clientX - rect.left) / rect.width) * 2 - 1;
      cursorY = -(((touch.clientY - rect.top) / rect.height) * 2 - 1);

      const dx = touch.clientX - prevMouseX;
      const dy = touch.clientY - prevMouseY;
      prevMouseX = touch.clientX;
      prevMouseY = touch.clientY;
      velX = dx;
      velY = dy;
      rotY += dx * 0.01;
      rotX += dy * 0.01;
      rotX = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, rotX));
    };

    const handleTouchEnd = () => {
      isDragging = false;
      cursorX = 0;
      cursorY = 0;
    };

    mount.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    mount.addEventListener("mouseleave", handleMouseLeave);
    mount.addEventListener("touchstart", handleTouchStart, { passive: true });
    mount.addEventListener("touchmove", handleTouchMove, { passive: false });
    mount.addEventListener("touchend", handleTouchEnd);

    // Load GLB
    const loader = new GLTFLoader();
    let model;
    let originalMaterials = [];

    loader.load(
      modelPath,
      (gltf) => {
        model = gltf.scene;
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        model.position.sub(center);

        model.traverse((child) => {
          if (child.isMesh) {
            child.material.needsUpdate = true;
            originalMaterials.push({
              mesh: child,
              color: child.material.color
                ? child.material.color.clone()
                : new THREE.Color(1, 1, 1),
              emissive: child.material.emissive
                ? child.material.emissive.clone()
                : new THREE.Color(0, 0, 0),
            });
          }
        });

        scene.add(model);
      },
      undefined,
      (err) => console.error("GLB error:", err)
    );

    // Color themes
    const NORMAL_THEME = {
      dir: new THREE.Color(0x38f3bb),
      point: new THREE.Color(0x7059ff),
      rim: 0,
      meshColor: null,
      emissive: new THREE.Color(0x000000),
    };

    const AI_THEME = {
  dir: new THREE.Color(0xffffff),       // pure white studio light — maximum chrome reflection
  point: new THREE.Color(0x7eb8f7),     // bright icy blue fill — cold metallic sheen
  rim: 4.5,                              // very strong rim = sharp bright silhouette edge
  meshColor: new THREE.Color(0x8a9bb5), // light silver-blue steel — visible, bright, premium
  emissive: new THREE.Color(0x3a5080),  // vivid blue inner glow — gives life & depth to metal
};

    let lerpProgress = 0;

    // How strongly the model follows the cursor (radians max tilt)
    const CURSOR_FOLLOW_STRENGTH = 0.35;

    let animId;
    const clock = new THREE.Clock();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();
      const isAI = useAIRef.current;

      // Lerp theme progress
      const target = isAI ? 1 : 0;
      lerpProgress += (target - lerpProgress) * 0.04;

      // Smooth the cursor position
      smoothCursorX += (cursorX - smoothCursorX) * 0.06;
      smoothCursorY += (cursorY - smoothCursorY) * 0.06;

      // Light interpolation
      dirLight.color.lerpColors(NORMAL_THEME.dir, AI_THEME.dir, lerpProgress);
      pointLight.color.lerpColors(NORMAL_THEME.point, AI_THEME.point, lerpProgress);
      rimLight.intensity = THREE.MathUtils.lerp(NORMAL_THEME.rim, AI_THEME.rim, lerpProgress);

      if (model) {
        originalMaterials.forEach(({ mesh, color, emissive }) => {
          if (mesh.material.color) {
            const targetColor = AI_THEME.meshColor || color;
            mesh.material.color.lerpColors(color, targetColor, lerpProgress);
          }
          if (mesh.material.emissive) {
            mesh.material.emissive.lerpColors(
              NORMAL_THEME.emissive,
              AI_THEME.emissive,
              lerpProgress
            );
            mesh.material.emissiveIntensity = THREE.MathUtils.lerp(0, 0.4, lerpProgress);
          }
        });

        if (isDragging) {
          // During drag: apply drag rotation directly
          velX *= 0.90;
          velY *= 0.90;
          model.rotation.x = rotX;
          model.rotation.y = rotY;
        } else {
          // No drag: apply inertia + cursor follow
          velX *= 0.90;
          velY *= 0.90;
          rotY += velX * 0.01;
          rotX += velY * 0.01;
          rotX = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, rotX));

          // Blend drag rotation toward cursor-follow target
          const targetRotY = smoothCursorX * CURSOR_FOLLOW_STRENGTH;
          const targetRotX = -smoothCursorY * CURSOR_FOLLOW_STRENGTH;

          // When velocity is low, cursor takes over smoothly
          const speed = Math.sqrt(velX * velX + velY * velY);
          const cursorWeight = Math.max(0, 1 - speed / 3); // 0 while flinging, 1 when still

          rotX += (targetRotX - rotX) * 0.05 * cursorWeight;
          rotY += (targetRotY - rotY) * 0.05 * cursorWeight;

          model.rotation.x = rotX;
          model.rotation.y = rotY;
        }

        // Float
        model.position.y = Math.sin(t * 0.8) * 0.15;

        // Breathe
        const breath = 1.8 + Math.sin(t * 1.2) * 0.05;
        model.scale.set(breath, breath, breath);
      }

      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(animId);
      mount.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      mount.removeEventListener("mouseleave", handleMouseLeave);
      mount.removeEventListener("touchstart", handleTouchStart);
      mount.removeEventListener("touchmove", handleTouchMove);
      mount.removeEventListener("touchend", handleTouchEnd);
      window.removeEventListener("resize", handleResize);
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
      renderer.dispose();
    };
  }, [modelPath]);

  return (
    <div
      ref={mountRef}
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 0,
        cursor: "grab",
      }}
    />
  );
}