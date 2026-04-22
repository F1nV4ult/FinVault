// Wait for DOM
document.addEventListener('DOMContentLoaded', () => {
    initThreeJS();
    initCardTilt();
    initSearchFilter();
    initDollarBackground();
    initDropdowns();
    initTerminalInteractivity();
});

function initDropdowns() {
    const dropdowns = document.querySelectorAll('.nav-dropdown');
    
    // Toggle on click for mobile/touch
    dropdowns.forEach(dropdown => {
        const trigger = dropdown.querySelector('.dropdown-trigger');
        
        trigger.addEventListener('click', (e) => {
            if (window.innerWidth <= 768) {
                e.preventDefault();
                e.stopPropagation();
                
                // Close other dropdowns
                dropdowns.forEach(other => {
                    if (other !== dropdown) other.classList.remove('active');
                });
                
                dropdown.classList.toggle('active');
            }
        });
    });

    // Close on click outside
    document.addEventListener('click', () => {
        dropdowns.forEach(dropdown => dropdown.classList.remove('active'));
    });
}

function initSearchFilter() {
    const searchInput = document.getElementById('company-search');
    const cards = document.querySelectorAll('.company-card');
    
    if (!searchInput) return;
    
    searchInput.addEventListener('input', (e) => {
        // Remove spaces and make lowercase for comparison
        const query = e.target.value.toLowerCase().replace(/\s+/g, '');
        
        cards.forEach(card => {
            // When search is empty, show all cards including placeholders
            if (query === '') {
                card.style.display = 'flex';
                return;
            }
            
            // Hide empty spacer cards during an active search
            if (card.innerHTML === '&nbsp;') {
                card.style.display = 'none';
                return;
            }
            
            const companyName = card.textContent.toLowerCase().replace(/\s+/g, '');
            if (companyName.includes(query)) {
                card.style.display = 'flex';
            } else {
                card.style.display = 'none';
            }
        });
    });
}

function initThreeJS() {
    const container = document.getElementById('mural-canvas-container');
    const secondaryContainer = document.getElementById('secondary-canvas-container');
    
    if (container) {
        initHeroThreeJS(container);
    } 
    
    if (secondaryContainer) {
        initSecondaryThreeJS(secondaryContainer);
    }
}

function initHeroThreeJS(container) {
    // Scene setup
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 5;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.2);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(5, 5, 5);
    scene.add(directionalLight);
    
    // Add point light for neon green highlight
    const greenLight = new THREE.PointLight(0x39FF14, 2, 10);
    greenLight.position.set(-2, 0, 2);
    scene.add(greenLight);

    // --- Truly 3D Holographic Graphic ---
    
    // 1. Outer Hologram: Complex Torus Knot
    const knotGeo = new THREE.TorusKnotGeometry(1.5, 0.4, 128, 32);
    const knotMat = new THREE.MeshBasicMaterial({
        color: 0x39FF14, // Neon green
        wireframe: true,
        transparent: true,
        opacity: 0.4,
        blending: THREE.AdditiveBlending
    });
    const knotMesh = new THREE.Mesh(knotGeo, knotMat);
    
    // Group them for the scene
    const hologramGroup = new THREE.Group();
    hologramGroup.add(knotMesh);
    
    hologramGroup.position.y = 0.5; // Sit slightly up in the view
    
    window.knotMesh = knotMesh; // Store globally for animation

    scene.add(hologramGroup);

    // Resize handler
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // Animation loop
    function animate() {
        requestAnimationFrame(animate);
        
        // Multi-axis mathematical rotation
        if (window.knotMesh) {
            window.knotMesh.rotation.x += 0.002;
            window.knotMesh.rotation.y += 0.005;
        }
        
        renderer.render(scene, camera);
    }
    animate();
}

function initSecondaryThreeJS(container) {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 10;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    // Beautiful large floating wireframe sphere spanning the entire background
    const geo = new THREE.SphereGeometry(15, 32, 32);
    const mat = new THREE.MeshBasicMaterial({
        color: 0x39FF14,
        wireframe: true,
        transparent: true,
        opacity: 0.4, // Boosted for visibility
        blending: THREE.AdditiveBlending
    });
    const bgMesh = new THREE.Mesh(geo, mat);
    scene.add(bgMesh);

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    function animate() {
        requestAnimationFrame(animate);
        bgMesh.rotation.y += 0.0008;
        bgMesh.rotation.x += 0.0004;
        renderer.render(scene, camera);
    }
    animate();
}

function initCardTilt() {
    const cards = document.querySelectorAll('.holographic-card');
    
    cards.forEach(card => {
        const bg = card.querySelector('.card-bg');
        
        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            // Get mouse position relative to card center
            const x = e.clientX - rect.left - rect.width / 2;
            const y = e.clientY - rect.top - rect.height / 2;
            
            // Calculate tilt
            const tiltX = (y / rect.height) * -20; // max 20deg tilt
            const tiltY = (x / rect.width) * 20;
            
            card.style.transform = `perspective(1000px) rotateX(${tiltX}deg) rotateY(${tiltY}deg) scale3d(1.05, 1.05, 1.05)`;
            
            // Parallax effect on background
            const bgX = (x / rect.width) * -20;
            const bgY = (y / rect.height) * -20;
            bg.style.transform = `translate(${bgX}px, ${bgY}px) scale(1.1)`;
        });
        
        card.addEventListener('mouseleave', () => {
            card.style.transform = `perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)`;
            bg.style.transform = `translate(0, 0) scale(1)`;
        });
    });
}

function initDollarBackground() {
    const container = document.querySelector('.dollar-bg-container');
    if (!container) return;

    // Create a precise grid of 6 bills to prevent overlapping
    const pattern = [
        { left: 5, delay: 0 },
        { left: 22, delay: -5 },
        { left: 39, delay: -10 },
        { left: 56, delay: -15 },
        { left: 73, delay: -20 },
        { left: 90, delay: -25 }
    ];

    const symbols = ['$', '¥', '€', '£', '₹'];

    pattern.forEach((config, i) => {
        const bill = document.createElement('div');
        bill.className = 'floating-dollar';
        
        const randomSymbol = symbols[Math.floor(Math.random() * symbols.length)];
        const svgTemplate = `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 50" width="100%" height="100%">
                <rect x="2" y="2" width="96" height="46" rx="5" fill="none" stroke="currentColor" stroke-width="2"/>
                <rect x="8" y="8" width="84" height="34" rx="2" fill="none" stroke="currentColor" stroke-width="1" opacity="0.6"/>
                <circle cx="50" cy="25" r="10" fill="none" stroke="currentColor" stroke-width="1.5"/>
                <text x="50" y="30" font-family="monospace" font-weight="bold" font-size="14" fill="currentColor" text-anchor="middle">${randomSymbol}</text>
            </svg>
        `;
        bill.innerHTML = svgTemplate;
        
        // Consistent rotation scaling and parameters
        const duration = 25; // Locked 25 second cycle
        const scale = 0.8; // Uniform scale
        const opacity = 0.35; // Bumped visibility while preserving text contrast
        
        // Alternating tumbling directions for sequence
        const rotXAmount = i % 2 === 0 ? 1 : 0.5;
        const rotYAmount = i % 2 === 0 ? 0.5 : 1;
        
        bill.style.left = `${config.left}%`;
        bill.style.opacity = opacity;
        bill.style.setProperty('--delay', `${config.delay}s`);
        bill.style.setProperty('--duration', `${duration}s`);
        bill.style.setProperty('--scale', scale);
        bill.style.setProperty('--rot-x', rotXAmount);
        bill.style.setProperty('--rot-y', rotYAmount);
        
        container.appendChild(bill);
    });
}

function initTerminalInteractivity() {
    const finvaultBtn = document.getElementById('tool-finvault-btn');
    const finvaultLog = document.getElementById('finvault-log');
    
    if (finvaultBtn && finvaultLog) {
        const logText = `FINVAULT DATA_LOG // SEC_01
SOURCE: 10-K MANDATORY FILINGS/ CONSOLIDATED FINANCIAL STATEMENTS
ANALYSIS_PARAM: RATIOS_MULTIPLES_SECTOR_KPIs.
SECTOR_FOCUS: [ENERGY] [UTILITIES] [INDUSTRIALS].
PURPOSE: DETERMINING ASSET POTENTIAL AND FIRM PERFORMANCE/POSITION.`;

        let isTyping = false;
        
        finvaultBtn.addEventListener('click', () => {
            if (isTyping) return;
            
            isTyping = true;
            finvaultLog.style.display = 'block';
            finvaultLog.textContent = '';
            
            let i = 0;
            const speed = 25;
            
            function typeWriter() {
                if (i < logText.length) {
                    finvaultLog.textContent += logText.charAt(i);
                    i++;
                    setTimeout(typeWriter, speed);
                } else {
                    isTyping = false;
                }
            }
            
            typeWriter();
        });
    }

    const sentinelBtn = document.getElementById('tool-sentinel-btn');
    const sentinelLog = document.getElementById('sentinel-log');

    if (sentinelBtn && sentinelLog) {
        const sentinelLogText = `SENTINEL_HEARTBEAT // NODE_02
SOURCE: LIVE_FRED_SOVEREIGN_ANCHORS / EQUITY_VOLATILITY_SIGNALS
ANALYSIS_PARAM: MERTON_CONVEXITY_LOGIC / G-SPREAD_WATERFALL / SECTOR_BETA_WEIGHTING.
SECTOR_FOCUS: [ENERGY] [UTILITIES] [INDUSTRIALS].
PURPOSE: REAL-TIME CREDIT SOLVENCY MONITORING / DYNAMIC STRESS-TESTING / FISCAL_FALLOUT_PROJECTION`;

        let isSentinelTyping = false;
        
        sentinelBtn.addEventListener('click', () => {
            if (isSentinelTyping) return;
            
            isSentinelTyping = true;
            sentinelLog.style.display = 'block';
            sentinelLog.textContent = '';
            
            let j = 0;
            const speed = 25;
            
            function typeWriterSentinel() {
                if (j < sentinelLogText.length) {
                    sentinelLog.textContent += sentinelLogText.charAt(j);
                    j++;
                    setTimeout(typeWriterSentinel, speed);
                } else {
                    isSentinelTyping = false;
                }
            }
            
            typeWriterSentinel();
        });
    }
}