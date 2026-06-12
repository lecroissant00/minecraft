// Minecraft Clone - Advanced Three.js Engine

const THREE = window.THREE;

// ==================== CONFIGURATION ====================
const CHUNK_SIZE = 32;
const WORLD_HEIGHT = 128;
const RENDER_DISTANCE = 5;
const BLOCK_SIZE = 1;

// Block types with colors
const BLOCKS = {
    dirt: { color: 0x8B7355, opacity: 1 },
    grass: { color: 0x228B22, opacity: 1 },
    stone: { color: 0x808080, opacity: 1 },
    wood: { color: 0x654321, opacity: 1 },
    sand: { color: 0xF4A460, opacity: 1 },
    water: { color: 0x4169E1, opacity: 0.5 },
    lava: { color: 0xFF4500, opacity: 0.6 },
    glass: { color: 0x87CEEB, opacity: 0.3 },
    cobblestone: { color: 0x696969, opacity: 1 }
};

// ==================== SCENE SETUP ====================
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB);
scene.fog = new THREE.Fog(0x87CEEB, 300, 400);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 70, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowShadowMap;
renderer.setPixelRatio(window.devicePixelRatio);
document.getElementById('canvas-container').appendChild(renderer.domElement);

// ==================== LIGHTING ====================
const directionalLight = new THREE.DirectionalLight(0xffffff, 0.9);
directionalLight.position.set(150, 150, 150);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.width = 4096;
directionalLight.shadow.mapSize.height = 4096;
directionalLight.shadow.camera.far = 500;
directionalLight.shadow.camera.left = -300;
directionalLight.shadow.camera.right = 300;
directionalLight.shadow.camera.top = 300;
directionalLight.shadow.camera.bottom = -300;
scene.add(directionalLight);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

// ==================== PLAYER ====================
const player = {
    position: new THREE.Vector3(0, 70, 0),
    velocity: new THREE.Vector3(0, 0, 0),
    speed: 0.15,
    jumpForce: 0.6,
    isFlying: false,
    canJump: false,
    jumpCount: 0,
    yaw: 0,
    pitch: 0
};

camera.position.copy(player.position);

// ==================== INPUT HANDLING ====================
const keys = {};
let selectedBlock = 'dirt';
let raycaster = new THREE.Raycaster();

document.addEventListener('keydown', (e) => {
    keys[e.key.toLowerCase()] = true;
    
    if (e.key === ' ') {
        player.jumpCount++;
        if (player.jumpCount === 2) {
            player.isFlying = !player.isFlying;
            if (!player.isFlying) player.velocity.y = 0;
        }
    }
});

document.addEventListener('keyup', (e) => {
    keys[e.key.toLowerCase()] = false;
    if (e.key === ' ') {
        player.jumpCount = 0;
    }
});

document.addEventListener('mousemove', (e) => {
    if (document.pointerLockElement) {
        player.yaw -= e.movementX * 0.003;
        player.pitch -= e.movementY * 0.003;
        player.pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, player.pitch));
    }
});

document.addEventListener('click', () => {
    renderer.domElement.requestPointerLock();
});

renderer.domElement.addEventListener('click', (event) => {
    if (event.button === 0) destroyBlock();
    else if (event.button === 2) placeBlock();
});

document.addEventListener('contextmenu', (e) => e.preventDefault());

// Scroll to change block
document.addEventListener('wheel', (e) => {
    const slots = document.querySelectorAll('.hotbar-slot');
    let currentIndex = Array.from(slots).findIndex(s => s.classList.contains('selected'));
    
    if (e.deltaY > 0) {
        currentIndex = (currentIndex + 1) % slots.length;
    } else {
        currentIndex = (currentIndex - 1 + slots.length) % slots.length;
    }
    
    selectBlock(currentIndex);
    e.preventDefault();
});

// Click hotbar to select block
document.querySelectorAll('.hotbar-slot').forEach((slot, index) => {
    slot.addEventListener('click', () => selectBlock(index));
});

function selectBlock(index) {
    document.querySelectorAll('.hotbar-slot').forEach(s => s.classList.remove('selected'));
    document.querySelectorAll('.hotbar-slot')[index].classList.add('selected');
    selectedBlock = document.querySelectorAll('.hotbar-slot')[index].getAttribute('data-block');
    document.getElementById('selected-block').textContent = selectedBlock.charAt(0).toUpperCase() + selectedBlock.slice(1);
}

// ==================== CHUNK SYSTEM ====================
const chunks = new Map();

class Chunk {
    constructor(x, z) {
        this.x = x;
        this.z = z;
        this.blocks = new Map();
        this.mesh = null;
        this.generate();
    }
    
    generate() {
        const OCTAVES = 4;
        const PERSISTENCE = 0.5;
        const LACUNARITY = 2;
        
        for (let xx = 0; xx < CHUNK_SIZE; xx++) {
            for (let zz = 0; zz < CHUNK_SIZE; zz++) {
                const worldX = this.x * CHUNK_SIZE + xx;
                const worldZ = this.z * CHUNK_SIZE + zz;
                
                // Perlin-like noise (simplified)
                let height = 0;
                let amplitude = 1;
                let frequency = 1;
                let maxValue = 0;
                
                for (let i = 0; i < OCTAVES; i++) {
                    const x = (worldX + 10000) * 0.02 * frequency;
                    const z = (worldZ + 10000) * 0.02 * frequency;
                    height += (Math.sin(x) + Math.cos(z)) * amplitude;
                    
                    maxValue += amplitude;
                    amplitude *= PERSISTENCE;
                    frequency *= LACUNARITY;
                }
                
                height = (height / maxValue) * 20 + 40;
                height = Math.floor(height);
                
                for (let y = 0; y < WORLD_HEIGHT; y++) {
                    let blockType = null;
                    
                    if (y < height - 4) {
                        blockType = 'stone';
                    } else if (y < height - 1) {
                        blockType = 'dirt';
                    } else if (y === height - 1) {
                        blockType = 'grass';
                    } else if (y < height && Math.random() > 0.8) {
                        blockType = 'water';
                    }
                    
                    if (blockType) {
                        this.setBlock(xx, y, zz, blockType);
                    }
                }
            }
        }
        this.updateMesh();
    }
    
    setBlock(x, y, z, type) {
        if (type === null) {
            this.blocks.delete(`${x},${y},${z}`);
        } else {
            this.blocks.set(`${x},${y},${z}`, type);
        }
    }
    
    getBlock(x, y, z) {
        if (x < 0 || x >= CHUNK_SIZE || y < 0 || y >= WORLD_HEIGHT || z < 0 || z >= CHUNK_SIZE) {
            return null;
        }
        return this.blocks.get(`${x},${y},${z}`);
    }
    
    updateMesh() {
        if (this.mesh) {
            scene.remove(this.mesh);
            this.mesh.geometry.dispose();
            this.mesh.material.dispose();
        }
        
        const geometries = {};
        
        for (const blockType of Object.keys(BLOCKS)) {
            geometries[blockType] = new THREE.BufferGeometry();
            geometries[blockType].vertices = [];
            geometries[blockType].colors = [];
        }
        
        // Generate cube faces
        for (let xx = 0; xx < CHUNK_SIZE; xx++) {
            for (let y = 0; y < WORLD_HEIGHT; y++) {
                for (let zz = 0; zz < CHUNK_SIZE; zz++) {
                    const blockType = this.getBlock(xx, y, zz);
                    if (!blockType) continue;
                    
                    const block = BLOCKS[blockType];
                    const color = new THREE.Color(block.color);
                    
                    // Check each face
                    const faces = [
                        { dir: [0, 0, -1], vertices: [[0,0,0],[1,0,0],[1,1,0],[0,1,0]] }, // Front
                        { dir: [0, 0, 1], vertices: [[1,0,1],[0,0,1],[0,1,1],[1,1,1]] }, // Back
                        { dir: [0, -1, 0], vertices: [[0,0,1],[1,0,1],[1,0,0],[0,0,0]] }, // Bottom
                        { dir: [0, 1, 0], vertices: [[0,1,0],[1,1,0],[1,1,1],[0,1,1]] }, // Top
                        { dir: [-1, 0, 0], vertices: [[0,0,1],[0,0,0],[0,1,0],[0,1,1]] }, // Left
                        { dir: [1, 0, 0], vertices: [[1,0,0],[1,0,1],[1,1,1],[1,1,0]] } // Right
                    ];
                    
                    faces.forEach(face => {
                        const [dx, dy, dz] = face.dir;
                        const neighborX = xx + dx;
                        const neighborY = y + dy;
                        const neighborZ = zz + dz;
                        
                        const neighbor = this.getBlock(neighborX, neighborY, neighborZ);
                        
                        if (!neighbor) {
                            const worldX = this.x * CHUNK_SIZE + xx;
                            const worldZ = this.z * CHUNK_SIZE + zz;
                            
                            face.vertices.forEach(v => {
                                geometries[blockType].vertices.push(
                                    worldX + v[0],
                                    y + v[1],
                                    worldZ + v[2]
                                );
                                geometries[blockType].colors.push(
                                    color.r, color.g, color.b
                                );
                            });
                        }
                    });
                }
            }
        }
        
        // Create meshes
        for (const blockType of Object.keys(BLOCKS)) {
            const geo = geometries[blockType];
            if (geo.vertices.length === 0) continue;
            
            const bufferGeo = new THREE.BufferGeometry();
            bufferGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(geo.vertices), 3));
            bufferGeo.setAttribute('color', new THREE.BufferAttribute(new Uint8Array(geo.colors), 3, true));
            bufferGeo.computeVertexNormals();
            
            const material = new THREE.MeshLambertMaterial({
                vertexColors: true,
                side: THREE.DoubleSide,
                transparent: BLOCKS[blockType].opacity < 1,
                opacity: BLOCKS[blockType].opacity
            });
            
            const mesh = new THREE.Mesh(bufferGeo, material);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            scene.add(mesh);
            
            if (!this.mesh) this.mesh = mesh;
        }
    }
}

// ==================== BLOCK INTERACTION ====================
function destroyBlock() {
    raycaster.setFromCamera({ x: 0, y: 0 }, camera);
    
    const meshes = [];
    scene.traverse(obj => {
        if (obj.isMesh) meshes.push(obj);
    });
    
    const intersects = raycaster.intersectObjects(meshes);
    if (intersects.length > 0) {
        const point = intersects[0].point;
        const blockX = Math.floor(point.x);
        const blockY = Math.floor(point.y);
        const blockZ = Math.floor(point.z);
        
        const chunkX = Math.floor(blockX / CHUNK_SIZE);
        const chunkZ = Math.floor(blockZ / CHUNK_SIZE);
        const chunk = chunks.get(`${chunkX},${chunkZ}`);
        
        if (chunk) {
            const xx = blockX - chunkX * CHUNK_SIZE;
            const zz = blockZ - chunkZ * CHUNK_SIZE;
            chunk.setBlock(xx, blockY, zz, null);
            chunk.updateMesh();
        }
    }
}

function placeBlock() {
    raycaster.setFromCamera({ x: 0, y: 0 }, camera);
    
    const meshes = [];
    scene.traverse(obj => {
        if (obj.isMesh) meshes.push(obj);
    });
    
    const intersects = raycaster.intersectObjects(meshes);
    if (intersects.length > 0) {
        const point = intersects[0].point;
        const normal = intersects[0].face.normal;
        const blockX = Math.round(point.x + normal.x * 0.4);
        const blockY = Math.round(point.y + normal.y * 0.4);
        const blockZ = Math.round(point.z + normal.z * 0.4);
        
        if (blockY < 0 || blockY >= WORLD_HEIGHT) return;
        
        const chunkX = Math.floor(blockX / CHUNK_SIZE);
        const chunkZ = Math.floor(blockZ / CHUNK_SIZE);
        const chunk = chunks.get(`${chunkX},${chunkZ}`);
        
        if (chunk) {
            const xx = ((blockX % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
            const zz = ((blockZ % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
            chunk.setBlock(xx, blockY, zz, selectedBlock);
            chunk.updateMesh();
        }
    }
}

// ==================== CHUNK LOADING ====================
function loadChunks() {
    const playerChunkX = Math.floor(player.position.x / CHUNK_SIZE);
    const playerChunkZ = Math.floor(player.position.z / CHUNK_SIZE);
    
    for (let x = playerChunkX - RENDER_DISTANCE; x <= playerChunkX + RENDER_DISTANCE; x++) {
        for (let z = playerChunkZ - RENDER_DISTANCE; z <= playerChunkZ + RENDER_DISTANCE; z++) {
            const key = `${x},${z}`;
            if (!chunks.has(key)) {
                chunks.set(key, new Chunk(x, z));
            }
        }
    }
}

// ==================== GAME LOOP ====================
function update() {
    // Movement
    const forward = new THREE.Vector3(Math.sin(player.yaw), 0, Math.cos(player.yaw));
    const right = new THREE.Vector3(Math.cos(player.yaw), 0, -Math.sin(player.yaw));
    
    if (keys['z'] || keys['arrowup']) player.velocity.add(forward.multiplyScalar(player.speed));
    if (keys['s'] || keys['arrowdown']) player.velocity.add(forward.multiplyScalar(-player.speed));
    if (keys['q'] || keys['arrowleft']) player.velocity.add(right.multiplyScalar(-player.speed));
    if (keys['d'] || keys['arrowright']) player.velocity.add(right.multiplyScalar(player.speed));
    
    // Flying
    if (player.isFlying) {
        if (keys[' ']) player.velocity.y += player.speed * 0.8;
        if (keys['shift']) player.velocity.y -= player.speed * 0.8;
    } else {
        // Gravity
        player.velocity.y -= 0.025;
    }
    
    player.position.add(player.velocity);
    player.velocity.multiplyScalar(0.9);
    
    if (player.position.y < -100) {
        player.position.set(0, 70, 0);
        player.velocity.set(0, 0, 0);
    }
    
    // Camera update
    camera.position.copy(player.position);
    camera.rotation.order = 'YXZ';
    camera.rotation.y = player.yaw;
    camera.rotation.x = player.pitch;
    
    // Load chunks
    loadChunks();
    
    // Update UI
    document.getElementById('pos').textContent = 
        `${Math.floor(player.position.x)}, ${Math.floor(player.position.y)}, ${Math.floor(player.position.z)}`;
}

function animate() {
    requestAnimationFrame(animate);
    update();
    renderer.render(scene, camera);
}

// ==================== RESIZE HANDLING ====================
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Start game
animate();
