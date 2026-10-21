"use client";

import { useEffect, useRef } from "react";

/**
 * A campaign picture that arrives through WebGL as you scroll to it.
 *
 * The plain <img> is always in the markup. That is what the server sends,
 * what a crawler reads, what shows with JavaScript off or WebGL blocked,
 * and what stays if anything here throws. The canvas is laid over it and
 * the image is only hidden once a first frame has actually been drawn, so
 * the failure mode is "no effect", never "no picture".
 *
 * Three rules it inherits from the rest of the layout.
 *
 * At rest it is the photograph, exactly. Once the reveal completes and the
 * page is still, the shader samples uv straight through: same pixels, same
 * colours, same framing. The effect is a way of arriving, not a filter.
 *
 * It never crops. Every displacement is on the sampled coordinate and
 * decays to zero, so nothing is scaled up to make room for movement — which
 * is the whole reason this is not a parallax. These photographs are people
 * head to shoes and a parallax costs exactly the head and the shoes.
 *
 * And it is never the hero. The first picture on a page is the LCP element
 * and stays a plain <img>; only bands you scroll down to get the canvas. So
 * three.js is not on the critical path, and it is a dynamic import on top of
 * that — the chunk is fetched when a band approaches, not on page load.
 */

const VERT = `
  void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

/*
 * `edge` is a soft wipe that reaches 1 everywhere at p = 1, which is what
 * guarantees the settled frame is the untouched photograph. The two
 * displacements both carry a (1 - p) or a velocity term for the same
 * reason: when the reveal is done and the page is still, every offset is
 * exactly zero.
 */
const FRAG = `
  precision mediump float;
  uniform sampler2D uTex;
  uniform vec2  uRes;
  uniform float uProgress;
  uniform float uVel;

  void main() {
    vec2 vUv = gl_FragCoord.xy / uRes;
    float p  = clamp(uProgress, 0.0, 1.0);

    float edge = smoothstep(0.0, 0.45, p * 1.45 - (1.0 - vUv.y));

    float d = (1.0 - p) * 0.05 + uVel * 0.02;
    vec2 uv = vUv;
    uv.y += d * (1.0 - edge) * 0.6;
    uv.x += d * 0.12 * sin(vUv.y * 6.2831);
    uv    = clamp(uv, 0.001, 0.999);

    vec4 c = texture2D(uTex, uv);
    gl_FragColor = vec4(c.rgb, c.a * edge);
  }
`;

export default function GlReveal({
  src,
  alt,
  className = "",
  wrapClassName = "block w-full",
  style,
  loading = "lazy",
}: {
  src: string;
  alt: string;
  /** Classes for the image itself, exactly as it would be without this. */
  className?: string;
  /**
   * Classes for the wrapper. It has to size to the image and nothing else,
   * because the canvas is stretched over it: an upright board shrink-wraps
   * from sm up, a landscape one runs the full width. Passed in rather than
   * guessed so this component never has an opinion about the layout.
   */
  wrapClassName?: string;
  style?: React.CSSProperties;
  loading?: "eager" | "lazy";
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const img = useRef<HTMLImageElement>(null);
  const live = useRef(false);

  useEffect(() => {
    const host = wrap.current;
    const picture = img.current;
    if (!host || !picture) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // Cheap capability test before importing anything.
    try {
      const probe = document.createElement("canvas");
      if (!probe.getContext("webgl") && !probe.getContext("experimental-webgl")) return;
    } catch {
      return;
    }

    let disposed = false;
    let teardown: (() => void) | null = null;

    const start = async () => {
      if (disposed || live.current) return;
      live.current = true;

      let THREE: typeof import("three");
      try {
        THREE = await import("three");
      } catch {
        live.current = false;
        return; // the plain image is already on screen; nothing to undo
      }
      if (disposed) return;

      // The texture comes from the <img> the browser has already fetched,
      // so the effect costs no second download.
      if (!picture.complete) {
        await new Promise<void>((done) => {
          picture.addEventListener("load", () => done(), { once: true });
          picture.addEventListener("error", () => done(), { once: true });
        });
      }
      if (disposed || !picture.naturalWidth) return;

      const canvas = document.createElement("canvas");
      canvas.setAttribute("aria-hidden", "true");
      canvas.style.cssText =
        "position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none";

      let renderer: import("three").WebGLRenderer;
      try {
        renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false });
      } catch {
        live.current = false;
        return;
      }
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.setClearAlpha(0);

      const texture = new THREE.Texture(picture);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
      texture.minFilter = THREE.LinearFilter;
      texture.generateMipmaps = false;
      texture.needsUpdate = true;

      const uniforms = {
        uTex: { value: texture },
        uRes: { value: new THREE.Vector2(1, 1) },
        uProgress: { value: 0 },
        uVel: { value: 0 },
      };
      const scene = new THREE.Scene();
      const camera = new THREE.Camera();
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(2, 2),
        new THREE.ShaderMaterial({
          vertexShader: VERT,
          fragmentShader: FRAG,
          uniforms,
          transparent: true,
        }),
      );
      scene.add(mesh);
      host.appendChild(canvas);

      const size = () => {
        const r = host.getBoundingClientRect();
        if (r.width < 2 || r.height < 2) return;
        // Capped: this is a decorative pass over a full-width picture, and
        // a phone with a 3x screen gains nothing from nine times the work.
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setSize(r.width, r.height, false);
        uniforms.uRes.value.set(
          r.width * renderer.getPixelRatio(),
          r.height * renderer.getPixelRatio(),
        );
      };
      size();
      const ro = new ResizeObserver(size);
      ro.observe(host);

      let lastY = window.scrollY;
      let vel = 0;
      let shown = false;
      let raf = 0;

      const frame = () => {
        if (disposed) return;
        raf = requestAnimationFrame(frame);

        const r = host.getBoundingClientRect();
        // 0 when the top edge is at the bottom of the screen, 1 once it has
        // come up by a third of the viewport.
        const p = 1 - (r.top - window.innerHeight * 0.1) / (window.innerHeight * 0.75);
        uniforms.uProgress.value = Math.max(0, Math.min(1, p));

        const y = window.scrollY;
        vel = vel * 0.86 + (y - lastY) * 0.014;
        lastY = y;
        if (Math.abs(vel) < 0.0008) vel = 0;
        uniforms.uVel.value = Math.max(-1, Math.min(1, vel));

        renderer.render(scene, camera);

        // Swap only after a frame exists, so there is never a blank gap.
        if (!shown) {
          shown = true;
          picture.style.visibility = "hidden";
        }
      };
      raf = requestAnimationFrame(frame);

      teardown = () => {
        cancelAnimationFrame(raf);
        ro.disconnect();
        picture.style.visibility = "";
        canvas.remove();
        mesh.geometry.dispose();
        (mesh.material as import("three").ShaderMaterial).dispose();
        texture.dispose();
        renderer.dispose();
        live.current = false;
      };
    };

    /* Armed a little before it arrives so the chunk and the first frame are
     * ready, and torn down well after it leaves so a slow scroll back up
     * does not rebuild a renderer every few seconds. */
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) void start();
          else if (!e.isIntersecting && teardown) {
            teardown();
            teardown = null;
          }
        }
      },
      { rootMargin: "60% 0px 60% 0px" },
    );
    io.observe(host);

    return () => {
      disposed = true;
      io.disconnect();
      teardown?.();
    };
  }, []);

  return (
    <div ref={wrap} className={`relative ${wrapClassName}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={img}
        src={src}
        alt={alt}
        loading={loading}
        style={style}
        className={className}
      />
    </div>
  );
}
