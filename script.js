// Minecraft Clone - Three.js
const THREE = window.THREE;

// Configuration
const CHUNK_SIZE = 16;
const WORLD_HEIGHT = 64;
const RENDER_DISTANCE = 4;

// Blocs
const BLOCKS = {
    dirt: { color: 0x8B7355 },
    grass: { color: 0x228B22 },
    stone: { color: 0x808080 },
    wood: { color: 0x654321 },
    sand: { color: 0xF4A460 },
    water: { color: 0x4169E1, transparent: true },
    lava: { color: 0xFF4500, transparent: true },
    glass: { color: 0x87CEEB, transparent: true },
    cobblestone: { color: 0x696969 }
};

// Scene setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB);
scene.fog = new THREE.Fog(0x87CEEB, 200, 300);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 50, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowShadowMap;
document.getElementById('canvas-container').appendChild(renderer.domElement);

// Lumière
const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(100, 100, 100);
light.castShadow = true;
light.shadow.mapSize.width = 2048;
light.shadow.mapSize.height = 2048;
light.shadow.camera.far = 500;
light.shadow.camera.left = -200;
light.shadow.camera.right = 200;
light.shadow.camera.top = 200;
light.shadow.camera.bottom = -200;
scene.add(light);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

// Joueur
const player = {
    position: new THREE.Vector3(0, 50, 0),
    velocity: new THREE.Vector3(0, 0, 0),
    speed: 0.2,
    jumpForce: 0.8,
    isFlying: false,
    canJump: false,
    jumpCount: 0,
    yaw: 0,
    pitch: 0
};

camera.position.copy(player.position);

// Contrôles
const keys = {};
const mouse = { x: 0, y: 0, locked: false };
let selectedBlock = 'dirt';

document.addEventListener('keydown', (e) => {
    keys[e.key.toLowerCase()] = true;
    
    // Double saut pour voler
    if (e.key === ' ') {
        player.jumpCount++;
        if (player.jumpCount === 2) {
            player.isFlying = !player.isFlying;
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
        player.yaw -= e.movementX * 0.002;
        player.pitch -= e.movementY * 0.002;
        player.pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, player.pitch));
    }
});

document.addEventListener('click', () => {
    renderer.domElement.requestPointerLock();
});

renderer.domElement.addEventListener('click', (event) => {
    if (event.button === 0) {
        // Clic gauche - détruire
        destroyBlock();
    } else if (event.button === 2) {
        // Clic droit - placer
        placeBlock();
    }
});

document.addEventListener('contextmenu', (e) => e.preventDefault());

// Molette - changer de bloc
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

// Sélection de bloc
document.querySelectorAll('.hotbar-slot').forEach((slot, index) => {
    slot.addEventListener('click', () => selectBlock(index));
});

function selectBlock(index) {
    document.querySelectorAll('.hotbar-slot').forEach(s => s.classList.remove('selected'));
    document.querySelectorAll('.hotbar-slot')[index].classList.add('selected');
    selectedBlock = document.querySelectorAll('.hotbar-slot')[index].getAttribute('data-block');
    document.getElementById('selected-block').textContent = selectedBlock;
}

// Monde
const world = new Map();
const chunks = new Map();

class Chunk {
    constructor(x, z) {
        this.x = x;
        this.z = z;
        this.data = new Map();
        this.mesh = null;
        this.generate();
        this.updateMesh();
    }
    
    generate() {
        for (let xx = 0; xx < CHUNK_SIZE; xx++) {
            for (let zz = 0; zz < CHUNK_SIZE; zz++) {
                const worldX = this.x * CHUNK_SIZE + xx;
                const worldZ = this.z * CHUNK_SIZE + zz;
                const height = Math.floor(Math.sin(worldX * 0.05) * 5 + Math.cos(worldZ * 0.05) * 5 + 30);
                
                for (let y = 0; y < WORLD_HEIGHT; y++) {
                    let blockType = null;
                    
                    if (y < height - 3) {
                        blockType = 'stone';
                    } else if (y < height) {
                        blockType = 'dirt';
                    } else if (y === height) {
                        blockType = 'grass';
                    } else if (y < height + 1 && Math.random() > 0.7) {
                        blockType = 'water';
                    }
                    
                    if (blockType) {
                        this.setBlock(xx, y, zz, blockType);
                    }
                }
            }
        }
    }
    
    setBlock(x, y, z, type) {
        this.data.set(`${x},${y},${z}`, type);
    }
    
    getBlock(x, y, z) {
        return this.data.get(`${x},${y},${z}`);
    }
    
    updateMesh() {
        if (this.mesh) {
            scene.remove(this.mesh);
        }
        
        const geometry = new THREE.BufferGeometry();
        const vertices = [];
        const colors = [];
        
        for (let xx = 0; xx < CHUNK_SIZE; xx++) {
            for (let y = 0; y < WORLD_HEIGHT; y++) {
                for (let zz = 0; zz < CHUNK_SIZE; zz++) {
                    const blockType = this.getBlock(xx, y, zz);
                    if (!blockType) continue;
                    
                    const block = BLOCKS[blockType];
                    const color = new THREE.Color(block.color);
                    const worldX = this.x * CHUNK_SIZE + xx;
                    const worldZ = this.z * CHUNK_SIZE + zz;
                    
                    // Ajouter les faces visibles du bloc
                    addCubeToGeometry(
                        vertices, colors,
                        worldX, y, worldZ,
                        color, this, xx, y, zz
                    );
                }
            }
        }
        
        if (vertices.length > 0) {
            geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vertices), 3));
            geometry.setAttribute('color', new THREE.BufferAttribute(new Uint8Array(colors), 3, true));
            
            const material = new THREE.MeshLambertMaterial({
                vertexColors: true,
                side: THREE.DoubleSide
            });
            
            this.mesh = new THREE.Mesh(geometry, material);
            this.mesh.castShadow = true;
            this.mesh.receiveShadow = true;
            scene.add(this.mesh);
        }
    }
}

function addCubeToGeometry(vertices, colors, x, y, z, color, chunk, xx, yy, zz) {
    const size = 0.5;
    const cubeVertices = [
        [-size, -size, -size], [size, -size, -size], [size, size, -size], [-size, size, -size], // Front
        [-size, -size, size], [size, -size, size], [size, size, size], [-size, size, size] // Back
    ];
    
    const faces = [
        [0, 1, 2, 0, 2, 3], // Front
        [4, 6, 5, 4, 7, 6], // Back
        [0, 4, 5, 0, 5, 1], // Bottom
        [2, 6, 7, 2, 7, 3], // Top
        [0, 3, 7, 0, 7, 4], // Left
        [1, 5, 6, 1, 6, 2] // Right
    ];
    
    const directions = [
        [0, 0, -1], [0, 0, 1], [0, -1, 0], [0, 1, 0], [-1, 0, 0], [1, 0, 0]
    ];
    
    faces.forEach((face, faceIndex) => {
        const [dx, dy, dz] = directions[faceIndex];
        const neighborX = xx + dx;
        const neighborY = yy + dy;
        const neighborZ = zz + dz;
        
        let hasNeighbor = false;
        if (neighborX >= 0 && neighborX < CHUNK_SIZE && neighborY >= 0 && neighborY < WORLD_HEIGHT && neighborZ >= 0 && neighborZ < CHUNK_SIZE) {
            hasNeighbor = chunk.getBlock(neighborX, neighborY, neighborZ) !== undefined;
        }
        
        if (!hasNeighbor) {
            face.forEach(vertexIndex => {
                const [vx, vy, vz] = cubeVertices[vertexIndex];
                vertices.push(x + vx, y + vy, z + vz);
                colors.push(Math.floor(color.r * 255), Math.floor(color.g * 255), Math.floor(color.b * 255));
            });
        }
    });
}

// Gestion des chunks
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
    
    // Supprimer les chunks éloignés
    for (const [key, chunk] of chunks.entries()) {
        const dist = Math.max(Math.abs(chunk.x - playerChunkX), Math.abs(chunk.z - playerChunkZ));
        if (dist > RENDER_DISTANCE + 1) {
            if (chunk.mesh) scene.remove(chunk.mesh);
            chunks.delete(key);
        }
    }
}

// Raycasting pour casser/placer des blocs
const raycaster = new THREE.Raycaster();

function destroyBlock() {
    raycaster.setFromCamera({ x: 0, y: 0 }, camera);
    
    const meshes = [];
    scene.traverse(obj => {
        if (obj.isMesh && obj !== player.mesh) meshes.push(obj);
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
        if (obj.isMesh && obj !== player.mesh) meshes.push(obj);
    });
    
    const intersects = raycaster.intersectObjects(meshes);
    if (intersects.length > 0) {
        const point = intersects[0].point;
        const normal = intersects[0].face.normal;
        const blockX = Math.round(point.x + normal.x * 0.5);
        const blockY = Math.round(point.y + normal.y * 0.5);
        const blockZ = Math.round(point.z + normal.z * 0.5);
        
        const chunkX = Math.floor(blockX / CHUNK_SIZE);
        const chunkZ = Math.floor(blockZ / CHUNK_SIZE);
        const chunk = chunks.get(`${chunkX},${chunkZ}`);
        
        if (chunk && blockY >= 0 && blockY < WORLD_HEIGHT) {
            const xx = blockX - chunkX * CHUNK_SIZE;
            const zz = blockZ - chunkZ * CHUNK_SIZE;
            if (xx >= 0 && xx < CHUNK_SIZE && zz >= 0 && zz < CHUNK_SIZE) {
                chunk.setBlock(xx, blockY, zz, selectedBlock);
                chunk.updateMesh();
            }
        }
    }
}

// Boucle principale
function update() {
    // Mouvement
    const forward = new THREE.Vector3(Math.sin(player.yaw), 0, Math.cos(player.yaw));
    const right = new THREE.Vector3(Math.cos(player.yaw), 0, -Math.sin(player.yaw));
    
    if (keys['z'] || keys['arrowup']) player.velocity.add(forward.multiplyScalar(player.speed));
    if (keys['s'] || keys['arrowdown']) player.velocity.add(forward.multiplyScalar(-player.speed));
    if (keys['q'] || keys['arrowleft']) player.velocity.add(right.multiplyScalar(-player.speed));
    if (keys['d'] || keys['arrowright']) player.velocity.add(right.multiplyScalar(player.speed));
    
    // Vol
    if (player.isFlying) {
        if (keys[' ']) player.velocity.y += player.speed;
        if (keys['shift']) player.velocity.y -= player.speed;
    } else {
        // Gravité
        player.velocity.y -= 0.02;
        
        // Collision sol
        let onGround = false;
        const checkY = Math.floor(player.position.y - 1);
        const checkX = Math.floor(player.position.x);
        const checkZ = Math.floor(player.position.z);
        const chunkX = Math.floor(checkX / CHUNK_SIZE);
        const chunkZ = Math.floor(checkZ / CHUNK_SIZE);
        const chunk = chunks.get(`${chunkX},${chunkZ}`);
        
        if (chunk && chunk.getBlock(checkX - chunkX * CHUNK_SIZE, checkY, checkZ - chunkZ * CHUNK_SIZE)) {
            onGround = true;
            player.velocity.y = 0;
        }
        
        if (onGround && keys[' ']) {
            player.velocity.y = player.jumpForce;
        }
    }
    
    // Appliquer la vélocité
    player.position.add(player.velocity);
    player.velocity.multiplyScalar(0.9); // Friction
    
    // Limiter la position
    if (player.position.y < -100) {
        player.position.set(0, 50, 0);
    }
    
    // Mettre à jour la caméra
    camera.position.copy(player.position);
    camera.rotation.order = 'YXZ';
    camera.rotation.y = player.yaw;
    camera.rotation.x = player.pitch;
    
    // Charger les chunks
    loadChunks();
    
    // Mise à jour de l'interface
    document.getElementById('pos').textContent = 
        `${Math.floor(player.position.x)}, ${Math.floor(player.position.y)}, ${Math.floor(player.position.z)}`;
}

function animate() {
    requestAnimationFrame(animate);
    update();
    renderer.render(scene, camera);
}

// Gestion du redimensionnement
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

animate();
