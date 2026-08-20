"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

// Landing hero'sundaki küçük gerçek 3D öğe (bkz. kullanıcı: "karma - küçük
// gerçek 3D + CSS"). Marka rengi rose/gold, faceted bir mücevher; yavaş döner,
// hafifçe süzülür, fare ile eğilir. next/dynamic ssr:false ile lazy yüklenir
// (three ilk bundle'a girmez). prefers-reduced-motion'da statik render.
export default function HeroGem3D() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let width = mount.clientWidth || 1;
    let height = mount.clientHeight || 1;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
    camera.position.set(0, 0, 5.2);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    mount.appendChild(renderer.domElement);

    const geometry = new THREE.IcosahedronGeometry(1.5, 0); // faceted kristal
    // Düşük metalness + güçlü renkli ışıklar: ortam haritası olmadan da
    // ışıkla parlar (yüksek metalness ortam haritası olmadan kararırdı).
    // sheen yumuşak bir kadife/gül parıltısı katar ("tatlı" his).
    const material = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color("#dd8ba6"),
      metalness: 0.15,
      roughness: 0.28,
      flatShading: true,
      clearcoat: 0.7,
      clearcoatRoughness: 0.28,
      sheen: 1,
      sheenColor: new THREE.Color("#f4b8cb"),
      sheenRoughness: 0.5,
      emissive: new THREE.Color("#a34468"),
      emissiveIntensity: 0.16,
    });
    const gem = new THREE.Mesh(geometry, material);
    scene.add(gem);

    // İnce kenar teli - facet hatlarını altın tonuyla vurgular
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(geometry),
      new THREE.LineBasicMaterial({ color: new THREE.Color("#f2d9ab"), transparent: true, opacity: 0.55 }),
    );
    gem.add(edges);

    const key = new THREE.DirectionalLight(0xffffff, 3);
    key.position.set(3, 4, 5);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xfff0dd, 1.8); // arkadan sıcak kenar ışığı
    rim.position.set(-2, 3, -4);
    scene.add(rim);
    const gold = new THREE.PointLight(0xe8b878, 90, 26, 1.6);
    gold.position.set(-4.5, -1, 3.5);
    scene.add(gold);
    const rose = new THREE.PointLight(0xd06f8f, 60, 26, 1.6);
    rose.position.set(4.5, -3, -1);
    scene.add(rose);
    scene.add(new THREE.AmbientLight(0xfff2ec, 0.8));

    let targetTiltX = 0;
    let targetTiltY = 0;
    function onPointer(e: PointerEvent) {
      const r = mount!.getBoundingClientRect();
      targetTiltY = (((e.clientX - r.left) / r.width) * 2 - 1) * 0.5;
      targetTiltX = (((e.clientY - r.top) / r.height) * 2 - 1) * 0.35;
    }

    const clock = new THREE.Clock();
    let raf = 0;
    function frame() {
      raf = requestAnimationFrame(frame);
      const t = clock.getElapsedTime();
      gem.rotation.y += 0.0045;
      gem.rotation.x += (targetTiltX - gem.rotation.x) * 0.05;
      gem.rotation.z = targetTiltY * 0.25;
      gem.position.y = Math.sin(t * 0.85) * 0.09;
      renderer.render(scene, camera);
    }

    if (reduced) {
      gem.rotation.set(0.3, 0.6, 0);
      renderer.render(scene, camera);
    } else {
      window.addEventListener("pointermove", onPointer);
      frame();
    }

    function onResize() {
      width = mount!.clientWidth || 1;
      height = mount!.clientHeight || 1;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    }
    const ro = new ResizeObserver(onResize);
    ro.observe(mount);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onPointer);
      ro.disconnect();
      geometry.dispose();
      material.dispose();
      (edges.geometry as THREE.BufferGeometry).dispose();
      (edges.material as THREE.Material).dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return <div ref={mountRef} style={{ width: "100%", height: "100%" }} aria-hidden />;
}
