(function () {
    const canvas = document.getElementById('hero-gl');
    const stage = document.getElementById('hero-stage');
    if (!canvas || !stage) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) return;

    const gl = canvas.getContext('webgl', {
        alpha: true,
        antialias: false,
        depth: false,
        stencil: false,
        powerPreference: 'low-power'
    });
    if (!gl) return;

    canvas.classList.add('is-live');

    function compile(type, source) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            gl.deleteShader(shader);
            return null;
        }
        return shader;
    }

    const vs = compile(gl.VERTEX_SHADER, [
        'attribute vec2 a_pos;',
        'attribute float a_size;',
        'attribute float a_alpha;',
        'uniform vec2 u_res;',
        'varying float v_a;',
        'void main() {',
        '  vec2 clip = (a_pos / u_res) * 2.0 - 1.0;',
        '  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);',
        '  gl_PointSize = a_size;',
        '  v_a = a_alpha;',
        '}'
    ].join('\n'));

    const fs = compile(gl.FRAGMENT_SHADER, [
        'precision mediump float;',
        'varying float v_a;',
        'uniform vec3 u_color;',
        'void main() {',
        '  vec2 c = gl_PointCoord - vec2(0.5);',
        '  float d = length(c);',
        '  float g = smoothstep(0.48, 0.14, d);',
        '  gl_FragColor = vec4(u_color, v_a * g);',
        '}'
    ].join('\n'));

    if (!vs || !fs) return;

    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
    gl.useProgram(program);

    const locPos = gl.getAttribLocation(program, 'a_pos');
    const locSize = gl.getAttribLocation(program, 'a_size');
    const locAlpha = gl.getAttribLocation(program, 'a_alpha');
    const locRes = gl.getUniformLocation(program, 'u_res');
    const locColor = gl.getUniformLocation(program, 'u_color');

    const mobile = window.matchMedia('(max-width: 767px)').matches;
    const count = mobile ? 36 : 72;
    const particles = [];
    for (let i = 0; i < count; i += 1) {
        particles.push({
            x: Math.random(),
            y: Math.random(),
            vx: (Math.random() - 0.5) * 0.018,
            vy: (Math.random() - 0.5) * 0.012,
            size: mobile ? 8 + Math.random() * 14 : 10 + Math.random() * 22,
            alpha: 0.12 + Math.random() * 0.22
        });
    }

    const pos = new Float32Array(count * 2);
    const size = new Float32Array(count);
    const alpha = new Float32Array(count);
    const posBuf = gl.createBuffer();
    const sizeBuf = gl.createBuffer();
    const alphaBuf = gl.createBuffer();

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.uniform3f(locColor, 0.043, 0.231, 0.141);

    let width = 1;
    let height = 1;
    let running = false;
    let visible = false;
    let raf = 0;
    let last = 0;

    function resize() {
        const rect = stage.getBoundingClientRect();
        const dpr = Math.min(window.devicePixelRatio || 1, mobile ? 1.25 : 1.5);
        width = Math.max(1, Math.floor(rect.width));
        height = Math.max(1, Math.floor(rect.height));
        canvas.width = Math.floor(width * dpr);
        canvas.height = Math.floor(height * dpr);
        canvas.style.width = width + 'px';
        canvas.style.height = height + 'px';
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.uniform2f(locRes, width, height);
    }

    function step(dt) {
        for (let i = 0; i < count; i += 1) {
            const p = particles[i];
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            if (p.x < -0.05) p.x = 1.05;
            if (p.x > 1.05) p.x = -0.05;
            if (p.y < -0.05) p.y = 1.05;
            if (p.y > 1.05) p.y = -0.05;
            pos[i * 2] = p.x * width;
            pos[i * 2 + 1] = p.y * height;
            size[i] = p.size;
            alpha[i] = p.alpha;
        }
    }

    function draw() {
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
        gl.bufferData(gl.ARRAY_BUFFER, pos, gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(locPos);
        gl.vertexAttribPointer(locPos, 2, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, sizeBuf);
        gl.bufferData(gl.ARRAY_BUFFER, size, gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(locSize);
        gl.vertexAttribPointer(locSize, 1, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, alphaBuf);
        gl.bufferData(gl.ARRAY_BUFFER, alpha, gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(locAlpha);
        gl.vertexAttribPointer(locAlpha, 1, gl.FLOAT, false, 0, 0);

        gl.drawArrays(gl.POINTS, 0, count);
    }

    function tick(now) {
        if (!running) return;
        const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
        last = now;
        step(dt);
        draw();
        raf = requestAnimationFrame(tick);
    }

    function start() {
        if (running || document.hidden || !visible) return;
        running = true;
        last = performance.now();
        raf = requestAnimationFrame(tick);
    }

    function stop() {
        running = false;
        if (raf) cancelAnimationFrame(raf);
        raf = 0;
    }

    resize();
    window.addEventListener('resize', resize, { passive: true });

    document.addEventListener('visibilitychange', () => {
        if (document.hidden) stop();
        else start();
    });

    const io = new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting && entry.intersectionRatio > 0.08;
        if (visible) start();
        else stop();
    }, { threshold: [0, 0.08, 0.2] });
    io.observe(stage);
})();
