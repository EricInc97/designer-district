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
 * And it is never on the critical path. three.js is a dynamic import, so
 * the chunk is fetched when a band approaches rather than on page load, and
 * the hero takes `defer` — it keeps the plain <img> through the largest
 * paint and only then hands over. Which is the difference between this and
 * the first version, where the hero simply opted out: that left the effect
 * absent from the nine houses whose only picture is the hero.
 */

const VERT = `
  void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

/*
 * The picture is never quite still.
 *
 * Three things run at once and each has a job.
 *
 * A slow flow, always on, warping the sampled coordinate by about two
 * pixels. On its own it is almost subliminal, which is the point: it stops
 * the frame reading as a flat printed poster without making the clothes
 * wobble. Amplitude is the whole argument here — this is a shop, and a
 * garment that ripples is a garment misrepresented, so the number stays
 * where the eye registers life rather than distortion.
 *
 * A gloss sweep crossing the frame every eleven seconds or so, a soft band
 * of light a few per cent brighter. This is the part that actually catches
 * the eye, and it does it with light rather than geometry, so nothing about
 * the product changes shape.
 *
 * And scroll speed, which multiplies the flow and pulls the channels apart
 * a little, so the image answers back when you move and settles when you
 * stop.
 *
 * The entry wipe still reaches 1 everywhere at p = 1, so arriving is still
 * a separate thing from being alive.
 */
const FRAG = `
  precision mediump float;
  uniform sampler2D uTex;
  uniform vec2  uRes;
  uniform float uProgress;
  uniform float uVel;
  uniform float uTime;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }

  void main() {
    vec2 uv = gl_FragCoord.xy / uRes;
    float p = clamp(uProgress, 0.0, 1.0);
    float edge = smoothstep(0.0, 0.45, p * 1.45 - (1.0 - uv.y));
    float v = clamp(uVel, -1.0, 1.0);

    vec2 flow = vec2(
      noise(uv * 3.0 + vec2(uTime * 0.05, uTime * 0.03)),
      noise(uv * 3.0 - vec2(uTime * 0.04, uTime * 0.045))
    ) - 0.5;

    vec2 base = uv
      + flow * 0.004 * (1.0 + abs(v) * 5.0)
      + vec2(0.0, v * 0.018)
      + vec2(0.0, (1.0 - p) * 0.05 * (1.0 - edge));

    float ca = abs(v) * 0.004;
    vec4 c = texture2D(uTex, clamp(base, 0.001, 0.999));
    float r = texture2D(uTex, clamp(base + vec2(ca, 0.0), 0.001, 0.999)).r;
    float b = texture2D(uTex, clamp(base - vec2(ca, 0.0), 0.001, 0.999)).b;
    vec3 col = vec3(r, c.g, b);

    float sweep = fract(uTime * 0.09);
    float band = smoothstep(0.24, 0.0,
      abs((uv.x * 0.7 + uv.y * 0.3) - (sweep * 1.6 - 0.3)));
    col += band * 0.055;

    gl_FragColor = vec4(col, c.a * edge);
  }
`;

export default function GlReveal({
  src,
  alt,
  className = "",
  wrapClassName = "block w-full",
  style,
  loading = "lazy",
  defer = false,
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
  /**
   * Hold the canvas back until after the page has painted and settled.
   *
   * For the hero, which is the LCP element. The first version simply
   * refused to touch it, and that turned out to be the wrong call for a
   * plain reason: nine of the fifteen houses have exactly one campaign
   * picture, and it is the hero, so on most of the site the effect existed
   * nowhere at all. Deferring gets both — the largest paint is still a
   * plain decoded <img> on the critical path, and the canvas takes over a
   * moment later once that measurement is long done.
   */
  defer?: boolean;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const img = useRef<HTMLImageElement>(null);

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
    /* Whether a renderer is being built or running, and whether the band is
     * still wanted by the time one is.
     *
     * Both are local to this mount rather than refs on the component, and
     * that is the whole of a bug worth recording. As a ref, the flag outlived
     * the effect: React's development double-mount ran `start`, set it, threw
     * the mount away, and the second mount then found it already set and
     * returned forever. Which looked like "WebGL does not work on product
     * pages" and was really "any band already inside the observer's margin at
     * first paint never starts" — the deferred hero was spared only because
     * its observer begins after that window has closed.
     *
     * Every path out of `start` now releases it, so a band abandoned halfway
     * through loading can also be started again when it is scrolled back to.
     */
    let live = false;
    let wanted = false;

    const start = async () => {
      if (disposed || live) return;
      live = true;

      let THREE: typeof import("three");
      try {
        THREE = await import("three");
      } catch {
        live = false;
        return; // the plain image is already on screen; nothing to undo
      }
      if (disposed) {
        live = false;
        return;
      }

      // The texture comes from the <img> the browser has already fetched,
      // so the effect costs no second download.
      if (!picture.complete) {
        await new Promise<void>((done) => {
          picture.addEventListener("load", () => done(), { once: true });
          picture.addEventListener("error", () => done(), { once: true });
        });
      }
      if (disposed || !picture.naturalWidth) {
        live = false;
        return;
      }

      const canvas = document.createElement("canvas");
      canvas.setAttribute("aria-hidden", "true");
      canvas.style.cssText =
        "position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none";

      let renderer: import("three").WebGLRenderer;
      try {
        renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false });
      } catch {
        live = false;
        return;
      }
      renderer.setClearAlpha(0);

      /* No colour conversion in either direction, deliberately.
       *
       * Marking the texture sRGB makes three decode it to linear when the
       * shader samples it. The matching encode back to sRGB lives in the
       * `colorspace_fragment` chunk, which a ShaderMaterial does not
       * include — so the linear values went straight to the screen and
       * every picture came out noticeably darker than the plain <img>
       * beside it.
       *
       * Nothing here does lighting or blending that needs linear light.
       * The shader samples a photograph and writes it back, so the right
       * answer is to touch neither end: raw bytes in, same bytes out, and
       * the canvas matches the image exactly.
       */
      const texture = new THREE.Texture(picture);
      texture.colorSpace = THREE.NoColorSpace;
      texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
      texture.minFilter = THREE.LinearFilter;
      texture.generateMipmaps = false;
      texture.needsUpdate = true;

      const uniforms = {
        uTex: { value: texture },
        uRes: { value: new THREE.Vector2(1, 1) },
        uProgress: { value: 0 },
        uVel: { value: 0 },
        uTime: { value: 0 },
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
        /* Capped at 1.5 rather than the display's own ratio. This pass
         * now runs every frame for as long as a band is on screen, not
         * once on arrival, so the cost is continuous — and a phone with a
         * 3x screen would be shading nine times the pixels for a drift of
         * about two of them. */
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
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
      const t0 = performance.now();

      const frame = () => {
        if (disposed) return;
        raf = requestAnimationFrame(frame);

        const r = host.getBoundingClientRect();
        // 0 when the top edge is at the bottom of the screen, 1 once it has
        // come up by a third of the viewport.
        const p = 1 - (r.top - window.innerHeight * 0.1) / (window.innerHeight * 0.75);
        uniforms.uProgress.value = Math.max(0, Math.min(1, p));

        uniforms.uTime.value = (performance.now() - t0) / 1000;

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
        live = false;
      };

      // It may have been scrolled past while three and the picture loaded.
      if (!wanted) {
        teardown();
        teardown = null;
      }
    };

    /* Armed a little before it arrives so the chunk and the first frame are
     * ready, and torn down well after it leaves so a slow scroll back up
     * does not rebuild a renderer every few seconds. */
    let io: IntersectionObserver | null = null;
    const watch = () => {
      if (disposed) return;
      io = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            wanted = e.isIntersecting;
            if (e.isIntersecting) void start();
            else if (teardown) {
              teardown();
              teardown = null;
            }
          }
        },
        { rootMargin: "60% 0px 60% 0px" },
      );
      io.observe(host);
    };

    let hold: ReturnType<typeof setTimeout> | null = null;
    let onLoad: (() => void) | null = null;
    if (defer) {
      // Well after the largest paint has been taken, and after the load
      // event, so nothing here competes with the image it is replacing.
      const soon = () => { hold = setTimeout(watch, 700); };
      if (document.readyState === "complete") soon();
      else {
        onLoad = soon;
        window.addEventListener("load", onLoad, { once: true });
      }
    } else {
      watch();
    }

    return () => {
      disposed = true;
      if (hold) clearTimeout(hold);
      if (onLoad) window.removeEventListener("load", onLoad);
      io?.disconnect();
      teardown?.();
    };
  }, [defer]);

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
