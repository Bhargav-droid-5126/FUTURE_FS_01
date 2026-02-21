import { Renderer, Program, Triangle, Mesh } from 'https://unpkg.com/ogl';
import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

document.addEventListener('DOMContentLoaded', () => {

  // --- Elements ---
  const navbar = document.getElementById('navbar');
  const navLinks = document.querySelectorAll('.nav-links li a');
  const navPill = document.querySelector('.nav-pill');

  // --- Current Page Active State ---
  const currentPath = window.location.pathname;
  let activeLink = null;

  navLinks.forEach(link => {
    const linkPath = link.getAttribute('href');
    // Simple check for local file system (ending with path) or root
    if (currentPath.endsWith(linkPath) ||
      (currentPath === '/' && linkPath === 'index.html')) {
      link.classList.add('active');
      activeLink = link;
    } else {
      // Remove active class for non-matching links
      link.classList.remove('active');
    }
  });

  // --- Pill Animation Logic ---
  function movePillTo(element, isHover = false) {
    if (!element) {
      navPill.style.opacity = '0';
      return;
    }

    // Target the LI, not the A, for correct positioning relative to UL
    const targetNode = element.parentElement;

    if (targetNode) {
      // Ensure the pill measures correctly relative to the container
      navPill.style.width = `${targetNode.offsetWidth}px`;
      navPill.style.height = `${targetNode.offsetHeight}px`;
      navPill.style.left = `${targetNode.offsetLeft}px`;
      navPill.style.top = `${targetNode.offsetTop}px`;
      navPill.style.opacity = '1';
    }

    // Toggling color class
    if (isHover) {
      navPill.classList.add('hovered');
    } else {
      navPill.classList.remove('hovered');
    }
  }

  // Initial position
  if (activeLink) {
    setTimeout(() => {
      movePillTo(activeLink, false);
    }, 100);
  }

  // Hover effects
  navLinks.forEach(link => {
    link.addEventListener('mouseenter', () => {
      movePillTo(link, true);
    });
  });

  const navContainer = document.querySelector('.nav-links');
  if (navContainer) {
    navContainer.addEventListener('mouseleave', () => {
      // Return to active link if it exists
      if (activeLink) {
        movePillTo(activeLink, false);
      } else {
        navPill.style.opacity = '0';
        navPill.classList.remove('hovered');
      }
    });
  }

  // --- Mobile Hamburger Menu ---
  const burger = document.querySelector('.burger-menu');
  const nav = document.querySelector('.nav-links');

  if (burger && nav) {
    // Toggle Nav
    burger.addEventListener('click', () => {
      nav.classList.toggle('nav-active');
      burger.classList.toggle('toggle');
    });

    // Close Nav when a link is clicked
    const mobileNavLinks = document.querySelectorAll('.nav-links li:not(.nav-pill) a');
    mobileNavLinks.forEach(link => {
      link.addEventListener('click', () => {
        if (nav.classList.contains('nav-active')) {
          nav.classList.remove('nav-active');
          burger.classList.remove('toggle');
        }
      });
    });
  }

  // --- Scroll Header Effect ---
  window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
  });

  // --- Interaction Observer for Animations ---
  const observerOptions = {
    threshold: 0.1
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
        observer.unobserve(entry.target);
      }
    });
  }, observerOptions);

  // Fade in elements that have standard fade-up class or are specific sections
  const fadeElements = document.querySelectorAll('.project-card, .about-text, .skills-list, .timeline-item, .contact-form');

  fadeElements.forEach(el => {
    // Set initial state
    el.style.opacity = '0';
    el.style.transform = 'translateY(20px)';
    el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    observer.observe(el);
  });

  // --- LightRays Animation Class (OGL) ---
  class LightRays {
    constructor(config = {}) {
      this.container = document.getElementById('light-rays-container');
      if (!this.container) return;

      this.config = {
        raysOrigin: 'top-center',
        raysColor: '#ffffff',
        raysSpeed: 0.2,
        lightSpread: 0.2,
        rayLength: 5.0,
        pulsating: true,
        fadeDistance: 1.0,
        saturation: 1.0,
        mouseInfluence: 0.5,
        noiseAmount: 0.1,
        distortion: 0.5,
        ...config
      };

      this.mouse = { x: 0.5, y: 0.5 };
      this.smoothMouse = { x: 0.5, y: 0.5 };

      this.initWebGL();
    }

    initWebGL() {
      this.renderer = new Renderer({
        dpr: Math.min(window.devicePixelRatio, 2),
        alpha: true
      });

      this.gl = this.renderer.gl;
      Object.assign(this.gl.canvas.style, {
        width: '100%',
        height: '100%',
        position: 'absolute',
        top: '0',
        left: '0'
      });

      // Clear container before appending (hot reload safety)
      while (this.container.firstChild) {
        this.container.removeChild(this.container.firstChild);
      }
      this.container.appendChild(this.gl.canvas);

      const vert = `
                attribute vec2 position;
                varying vec2 vUv;
                void main() {
                    vUv = position * 0.5 + 0.5;
                    gl_Position = vec4(position, 0.0, 1.0);
                }
            `;

      const frag = `
                precision highp float;

                uniform float iTime;
                uniform vec2  iResolution;
                uniform vec2  rayPos;
                uniform vec2  rayDir;
                uniform vec3  raysColor;
                uniform float raysSpeed;
                uniform float lightSpread;
                uniform float rayLength;
                uniform float pulsating;
                uniform float fadeDistance;
                uniform float saturation;
                uniform vec2  mousePos;
                uniform float mouseInfluence;
                uniform float noiseAmount;
                uniform float distortion;

                varying vec2 vUv;

                float noise(vec2 st) {
                    return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
                }

                float rayStrength(vec2 raySource, vec2 rayRefDirection, vec2 coord, float seedA, float seedB, float speed) {
                    vec2 sourceToCoord = coord - raySource;
                    vec2 dirNorm = normalize(sourceToCoord);
                    float cosAngle = dot(dirNorm, rayRefDirection);

                    float distortedAngle = cosAngle + distortion * sin(iTime * 2.0 + length(sourceToCoord) * 0.01) * 0.2;
                    
                    float spread = max(lightSpread, 0.001);
                    float spreadFactor = pow(max(distortedAngle, 0.0), 1.0 / spread);

                    float distance = length(sourceToCoord);
                    float maxDistance = iResolution.x * rayLength;
                    float lengthFalloff = clamp((maxDistance - distance) / maxDistance, 0.0, 1.0);
                    
                    float fadeFalloff = clamp((iResolution.x * fadeDistance - distance) / (iResolution.x * fadeDistance), 0.5, 1.0);
                    float pulse = pulsating > 0.5 ? (0.8 + 0.2 * sin(iTime * speed * 3.0)) : 1.0;

                    float baseStrength = clamp(
                        (0.45 + 0.15 * sin(distortedAngle * seedA + iTime * speed)) +
                        (0.3 + 0.2 * cos(-distortedAngle * seedB + iTime * speed)),
                        0.0, 1.0
                    );

                    return baseStrength * lengthFalloff * fadeFalloff * spreadFactor * pulse;
                }

                void mainImage(out vec4 fragColor, in vec2 fragCoord) {
                    vec2 coord = vec2(fragCoord.x, iResolution.y - fragCoord.y);
                    
                    vec2 finalRayDir = rayDir;
                    if (mouseInfluence > 0.0) {
                        vec2 mouseScreenPos = mousePos * iResolution.xy;
                        vec2 diff = mouseScreenPos - rayPos;
                        if(length(diff) > 0.001) {
                            vec2 mouseDirection = normalize(diff);
                            finalRayDir = normalize(mix(rayDir, mouseDirection, mouseInfluence));
                        }
                    }

                    vec4 rays1 = vec4(1.0) * rayStrength(rayPos, finalRayDir, coord, 36.2214, 21.11349, 1.5 * raysSpeed);
                    vec4 rays2 = vec4(1.0) * rayStrength(rayPos, finalRayDir, coord, 22.3991, 18.0234, 1.1 * raysSpeed);

                    fragColor = rays1 * 0.5 + rays2 * 0.4;

                    if (noiseAmount > 0.0) {
                        float n = noise(coord * 0.01 + iTime * 0.1);
                        fragColor.rgb *= (1.0 - noiseAmount + noiseAmount * n);
                    }

                    float brightness = 1.0 - (coord.y / iResolution.y);
                    fragColor.x *= 0.1 + brightness * 0.8;
                    fragColor.y *= 0.3 + brightness * 0.6;
                    fragColor.z *= 0.5 + brightness * 0.5;

                    if (saturation != 1.0) {
                        float gray = dot(fragColor.rgb, vec3(0.299, 0.587, 0.114));
                        fragColor.rgb = mix(vec3(gray), fragColor.rgb, saturation);
                    }

                    fragColor.rgb *= raysColor;
                }

                void main() {
                    vec4 color;
                    mainImage(color, gl_FragCoord.xy);
                    gl_FragColor = color;
                }
            `;

      this.uniforms = {
        iTime: { value: 0 },
        iResolution: { value: [1, 1] },
        rayPos: { value: [0, 0] },
        rayDir: { value: [0, 1] },
        raysColor: { value: this.hexToRgb(this.config.raysColor) },
        raysSpeed: { value: this.config.raysSpeed },
        lightSpread: { value: this.config.lightSpread },
        rayLength: { value: this.config.rayLength },
        pulsating: { value: this.config.pulsating ? 1.0 : 0.0 },
        fadeDistance: { value: this.config.fadeDistance },
        saturation: { value: this.config.saturation },
        mousePos: { value: [0.5, 0.5] },
        mouseInfluence: { value: this.config.mouseInfluence },
        noiseAmount: { value: this.config.noiseAmount },
        distortion: { value: this.config.distortion }
      };

      const geometry = new Triangle(this.gl);
      const program = new Program(this.gl, {
        vertex: vert,
        fragment: frag,
        uniforms: this.uniforms
      });
      this.mesh = new Mesh(this.gl, { geometry, program });

      this.resize();
      this.addListeners();
      requestAnimationFrame((t) => this.loop(t));
    }

    getAnchorAndDir(origin, w, h) {
      const outside = 0.2;
      // Simplified logic for Top-Center
      return { anchor: [0.5 * w, -outside * h], dir: [0, 1] };
    }

    hexToRgb(hex) {
      const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return m ? [parseInt(m[1], 16) / 255, parseInt(m[2], 16) / 255, parseInt(m[3], 16) / 255] : [1, 1, 1];
    }

    resize() {
      if (!this.container || !this.renderer) return;
      const width = this.container.clientWidth;
      const height = this.container.clientHeight;
      this.renderer.setSize(width, height);

      const dpr = this.renderer.dpr;
      const w = width * dpr;
      const h = height * dpr;

      this.uniforms.iResolution.value = [w, h];

      const { anchor, dir } = this.getAnchorAndDir(this.config.raysOrigin, w, h);
      this.uniforms.rayPos.value = anchor;
      this.uniforms.rayDir.value = dir;
    }

    addListeners() {
      window.addEventListener('resize', () => this.resize());
      window.addEventListener('mousemove', (e) => {
        if (!this.container) return;
        const rect = this.container.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width;
        const y = (e.clientY - rect.top) / rect.height;
        // Flip Y for GL coords if needed, but shader handles it
        this.mouse = { x, y: 1.0 - y };
      });
    }

    loop(t) {
      if (!this.renderer) return;

      this.uniforms.iTime.value = t * 0.001;

      // Mouse smoothing
      this.smoothMouse.x += (this.mouse.x - this.smoothMouse.x) * 0.1;
      this.smoothMouse.y += (this.mouse.y - this.smoothMouse.y) * 0.1;

      // Invert Y for shader interaction intuitive feel
      this.uniforms.mousePos.value = [this.smoothMouse.x, this.smoothMouse.y];

      this.renderer.render({ scene: this.mesh });
      requestAnimationFrame((t) => this.loop(t));
    }
  }

  // Initialize LightRays
  try {
    new LightRays({
      raysOrigin: 'top-center',
      raysColor: '#ffffff',
      raysSpeed: 0.2, // Majestic slow speed
      lightSpread: 0.2,
      rayLength: 5.0,
      mouseInfluence: 0.5
    });
  } catch (err) {
    console.error("LightRays Init Error:", err);
  }


  // --- ClickSpark Animation Class ---
  class ClickSpark {
    constructor(options = {}) {
      this.options = {
        color: '#fff',
        size: 10,
        radius: 15,
        count: 8,
        duration: 400,
        extraScale: 1.0,
        easing: 'ease-out',
        ...options
      };
      this.sparks = [];
      this.canvas = null;
      this.ctx = null;
      this.init();
    }

    init() {
      this.canvas = document.createElement('canvas');
      this.canvas.id = 'click-spark-canvas';
      Object.assign(this.canvas.style, {
        position: 'fixed',
        top: '0',
        left: '0',
        width: '100vw',
        height: '100vh',
        pointerEvents: 'none',
        zIndex: '99999',
        display: 'block'
      });
      document.body.appendChild(this.canvas);
      this.ctx = this.canvas.getContext('2d');

      this.resize();
      // Use passive listeners where possible, but not strictly required here
      window.addEventListener('resize', () => this.resize());
      window.addEventListener('mousedown', (e) => this.handleClick(e));

      this.loop(performance.now());
    }

    resize() {
      this.canvas.width = window.innerWidth;
      this.canvas.height = window.innerHeight;
    }

    handleClick(e) {
      const x = e.clientX;
      const y = e.clientY;
      const now = performance.now();

      for (let i = 0; i < this.options.count; i++) {
        this.sparks.push({
          x,
          y,
          angle: (2 * Math.PI * i) / this.options.count,
          startTime: now
        });
      }
    }

    ease(t) {
      switch (this.options.easing) {
        case 'linear': return t;
        case 'ease-in': return t * t;
        case 'ease-in-out': return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
        default: return t * (2 - t);
      }
    }

    loop(timestamp) {
      if (!this.ctx) return;

      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

      this.sparks = this.sparks.filter(spark => {
        const elapsed = timestamp - spark.startTime;
        if (elapsed >= this.options.duration) return false;

        const progress = elapsed / this.options.duration;
        const eased = this.ease(progress);

        const distance = eased * this.options.radius * this.options.extraScale;
        const lineLength = this.options.size * (1 - eased);

        const x1 = spark.x + distance * Math.cos(spark.angle);
        const y1 = spark.y + distance * Math.sin(spark.angle);
        const x2 = spark.x + (distance + lineLength) * Math.cos(spark.angle);
        const y2 = spark.y + (distance + lineLength) * Math.sin(spark.angle);

        this.ctx.strokeStyle = this.options.color;
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(x1, y1);
        this.ctx.lineTo(x2, y2);
        this.ctx.stroke();

        return true;
      });

      requestAnimationFrame((t) => this.loop(t));
    }
  }

  // Initialize Global ClickSpark
  new ClickSpark({
    color: '#fff',
    size: 10,
    radius: 20,
    count: 8,
    duration: 400
  });

  // --- BlurText Animation ---
  class BlurText {
    constructor() {
      this.observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.1
      };
      this.init();
    }

    init() {
      const targets = document.querySelectorAll('.hero-title, .hero-subtitle, .page-title');

      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            this.animate(entry.target);
            observer.unobserve(entry.target);
          }
        });
      }, this.observerOptions);

      targets.forEach(el => {
        const text = el.textContent.trim();
        const words = text.split(/\s+/);

        el.innerHTML = words.map((word, index) =>
          `<span class="blur-text-word">${word}${index === words.length - 1 ? '' : '&nbsp;'}</span>`
        ).join('');

        observer.observe(el);
      });
    }

    animate(element) {
      const spans = element.querySelectorAll('.blur-text-word');
      spans.forEach((span, index) => {
        span.style.transitionDelay = `${index * 0.1}s`;
        span.offsetHeight;
        span.classList.add('blur-text-active');
      });
    }
  }

  // Initialize BlurText
  new BlurText();

  // --- ColorBends Animation ---
  class ColorBends {
    constructor(container, options = {}) {
      this.container = container;
      this.options = {
        rotation: 45,
        speed: 0.2,
        colors: [],
        transparent: true,
        autoRotate: 0,
        scale: 1,
        frequency: 1,
        warpStrength: 1,
        mouseInfluence: 1,
        parallax: 0.5,
        noise: 0.1,
        ...options
      };

      this.MAX_COLORS = 8;
      this.pointerTarget = new THREE.Vector2(0, 0);
      this.pointerCurrent = new THREE.Vector2(0, 0);
      this.pointerSmooth = 8;
      this.rotation = this.options.rotation;

      this.init();
    }

    init() {
      this.scene = new THREE.Scene();
      this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      this.geometry = new THREE.PlaneGeometry(2, 2);

      const uColorsArray = Array.from({ length: this.MAX_COLORS }, () => new THREE.Vector3(0, 0, 0));

      const frag = `
        #define MAX_COLORS ${this.MAX_COLORS}
        uniform vec2 uCanvas;
        uniform float uTime;
        uniform float uSpeed;
        uniform vec2 uRot;
        uniform int uColorCount;
        uniform vec3 uColors[MAX_COLORS];
        uniform int uTransparent;
        uniform float uScale;
        uniform float uFrequency;
        uniform float uWarpStrength;
        uniform vec2 uPointer; // in NDC [-1,1]
        uniform float uMouseInfluence;
        uniform float uParallax;
        uniform float uNoise;
        varying vec2 vUv;

        void main() {
          float t = uTime * uSpeed;
          vec2 p = vUv * 2.0 - 1.0;
          p += uPointer * uParallax * 0.1;
          vec2 rp = vec2(p.x * uRot.x - p.y * uRot.y, p.x * uRot.y + p.y * uRot.x);
          vec2 q = vec2(rp.x * (uCanvas.x / uCanvas.y), rp.y);
          q /= max(uScale, 0.0001);
          q /= 0.5 + 0.2 * dot(q, q);
          q += 0.2 * cos(t) - 7.56;
          vec2 toward = (uPointer - rp);
          q += toward * uMouseInfluence * 0.2;

          vec3 col = vec3(0.0);
          float a = 1.0;

          if (uColorCount > 0) {
            vec2 s = q;
            vec3 sumCol = vec3(0.0);
            float cover = 0.0;
            for (int i = 0; i < MAX_COLORS; ++i) {
              if (i >= uColorCount) break;
              s -= 0.01;
              vec2 r = sin(1.5 * (s.yx * uFrequency) + 2.0 * cos(s * uFrequency));
              float m0 = length(r + sin(5.0 * r.y * uFrequency - 3.0 * t + float(i)) / 4.0);
              float kBelow = clamp(uWarpStrength, 0.0, 1.0);
              float kMix = pow(kBelow, 0.3);
              float gain = 1.0 + max(uWarpStrength - 1.0, 0.0);
              vec2 disp = (r - s) * kBelow;
              vec2 warped = s + disp * gain;
              float m1 = length(warped + sin(5.0 * warped.y * uFrequency - 3.0 * t + float(i)) / 4.0);
              float m = mix(m0, m1, kMix);
              float w = 1.0 - exp(-6.0 / exp(6.0 * m));
              sumCol += uColors[i] * w;
              cover = max(cover, w);
            }
            col = clamp(sumCol, 0.0, 1.0);
            a = uTransparent > 0 ? cover : 1.0;
          } else {
            vec2 s = q;
            for (int k = 0; k < 3; ++k) {
              s -= 0.01;
              vec2 r = sin(1.5 * (s.yx * uFrequency) + 2.0 * cos(s * uFrequency));
              float m0 = length(r + sin(5.0 * r.y * uFrequency - 3.0 * t + float(k)) / 4.0);
              float kBelow = clamp(uWarpStrength, 0.0, 1.0);
              float kMix = pow(kBelow, 0.3);
              float gain = 1.0 + max(uWarpStrength - 1.0, 0.0);
              vec2 disp = (r - s) * kBelow;
              vec2 warped = s + disp * gain;
              float m1 = length(warped + sin(5.0 * warped.y * uFrequency - 3.0 * t + float(k)) / 4.0);
              float m = mix(m0, m1, kMix);
              col[k] = 1.0 - exp(-6.0 / exp(6.0 * m));
            }
            a = uTransparent > 0 ? max(max(col.r, col.g), col.b) : 1.0;
          }

          if (uNoise > 0.0001) {
            float n = fract(sin(dot(gl_FragCoord.xy + vec2(uTime), vec2(12.9898, 78.233))) * 43758.5453123);
            col += (n - 0.5) * uNoise;
            col = clamp(col, 0.0, 1.0);
          }

          vec3 rgb = (uTransparent > 0) ? col * a : col;
          gl_FragColor = vec4(rgb, a);
        }
      `;

      const vert = `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position, 1.0);
        }
      `;

      this.material = new THREE.ShaderMaterial({
        vertexShader: vert,
        fragmentShader: frag,
        uniforms: {
          uCanvas: { value: new THREE.Vector2(1, 1) },
          uTime: { value: 0 },
          uSpeed: { value: this.options.speed },
          uRot: { value: new THREE.Vector2(1, 0) },
          uColorCount: { value: 0 },
          uColors: { value: uColorsArray },
          uTransparent: { value: this.options.transparent ? 1 : 0 },
          uScale: { value: this.options.scale },
          uFrequency: { value: this.options.frequency },
          uWarpStrength: { value: this.options.warpStrength },
          uPointer: { value: new THREE.Vector2(0, 0) },
          uMouseInfluence: { value: this.options.mouseInfluence },
          uParallax: { value: this.options.parallax },
          uNoise: { value: this.options.noise }
        },
        premultipliedAlpha: true,
        transparent: true
      });

      this.updateColors();

      this.mesh = new THREE.Mesh(this.geometry, this.material);
      this.scene.add(this.mesh);

      this.renderer = new THREE.WebGLRenderer({
        antialias: false,
        powerPreference: 'high-performance',
        alpha: true
      });

      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      this.renderer.setClearColor(0x000000, this.options.transparent ? 0 : 1);

      this.renderer.domElement.style.width = '100%';
      this.renderer.domElement.style.height = '100%';
      this.renderer.domElement.style.display = 'block';
      this.container.appendChild(this.renderer.domElement);

      this.clock = new THREE.Clock();

      this.handleResize = this.handleResize.bind(this);
      this.handlePointerMove = this.handlePointerMove.bind(this);
      this.loop = this.loop.bind(this);

      window.addEventListener('resize', this.handleResize);
      window.addEventListener('pointermove', this.handlePointerMove);

      this.handleResize();
      this.raf = requestAnimationFrame(this.loop);
    }

    updateColors() {
      const toVec3 = hex => {
        const h = hex.replace('#', '').trim();
        const v =
          h.length === 3
            ? [parseInt(h[0] + h[0], 16), parseInt(h[1] + h[1], 16), parseInt(h[2] + h[2], 16)]
            : [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
        return new THREE.Vector3(v[0] / 255, v[1] / 255, v[2] / 255);
      };

      const arr = (this.options.colors || []).filter(Boolean).slice(0, this.MAX_COLORS).map(toVec3);
      for (let i = 0; i < this.MAX_COLORS; i++) {
        const vec = this.material.uniforms.uColors.value[i];
        if (i < arr.length) vec.copy(arr[i]);
        else vec.set(0, 0, 0);
      }
      this.material.uniforms.uColorCount.value = arr.length;
    }

    handleResize() {
      const w = this.container.clientWidth || 1;
      const h = this.container.clientHeight || 1;
      this.renderer.setSize(w, h, false);
      this.material.uniforms.uCanvas.value.set(w, h);
    }

    handlePointerMove(e) {
      const rect = this.container.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / (rect.width || 1)) * 2 - 1;
      const y = -(((e.clientY - rect.top) / (rect.height || 1)) * 2 - 1);
      this.pointerTarget.set(x, y);
    }

    loop() {
      const dt = this.clock.getDelta();
      const elapsed = this.clock.elapsedTime;
      this.material.uniforms.uTime.value = elapsed;

      const deg = (this.rotation % 360) + this.options.autoRotate * elapsed;
      const rad = (deg * Math.PI) / 180;
      const c = Math.cos(rad);
      const s = Math.sin(rad);
      this.material.uniforms.uRot.value.set(c, s);

      const cur = this.pointerCurrent;
      const tgt = this.pointerTarget;
      const amt = Math.min(1, dt * this.pointerSmooth);
      cur.lerp(tgt, amt);
      this.material.uniforms.uPointer.value.copy(cur);

      this.renderer.render(this.scene, this.camera);
      this.raf = requestAnimationFrame(this.loop);
    }
  }

  // Initialize ColorBends on specific containers
  const cbContainer = document.getElementById('colorbends-container');
  if (cbContainer) {
    new ColorBends(cbContainer, {
      colors: ["#ff5c7a", "#8a5cff", "#00ffd1"],
      rotation: -12,
      speed: 0.2,
      scale: 1,
      frequency: 1,
      warpStrength: 1,
      mouseInfluence: 1,
      parallax: 0.5,
      noise: 0.1,
      transparent: true,
      autoRotate: 0
    });
  }

});
