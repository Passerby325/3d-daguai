import * as THREE from 'three';
export class MiniMap {
    constructor(player, enemyManager) {
        this.player = player;
        this.enemyManager = enemyManager;
        this.mapElement = document.getElementById('minimap');
        this.mapSize = 250; // 地图大小（像素）
        
        // 固定地图范围（世界坐标）
        this.worldMinX = -100;
        this.worldMaxX = 100;
        this.worldMinZ = -100;
        this.worldMaxZ = 100;
        this.worldWidth = this.worldMaxX - this.worldMinX; // 200米
        this.worldHeight = this.worldMaxZ - this.worldMinZ; // 200米
        
        // 从相机获取实际FOV
        this.cameraFov = this.player.camera.fov; // 相机的实际FOV（75度）
        this.cameraAspect = this.player.camera.aspect; // 相机纵横比
        
        this.blipElements = new Map();
        this.fovElement = null; // 视野范围元素
        
        // 镜像开关（默认开启）
        this.mapMirror = true;
        
        this.init();
    }
    
    init() {
        if (this.mapElement) {
            this.mapElement.style.display = 'block';
            this.createFovIndicator();
        }
    }
    
    createFovIndicator() {
        this.fovElement = document.createElement('div');
        this.fovElement.className = 'minimap-fov';
        this.mapElement.appendChild(this.fovElement);
    }
    
    update(delta) {
        if (!this.mapElement) return;
        
        // 更新视野范围
        this.updateFov();
        
        // 更新玩家位置标记（在世界地图上的位置）
        this.updatePlayerMarker();
        
        // 更新敌人标记
        this.updateEnemyBlips();
        
        // 更新Boss标记
        this.updateBossBlip();
    }
    
    updateFov() {
        if (!this.fovElement) return;
        
        const playerPos = this.player.getPosition();
        
        // 从相机获取朝向向量（而不是使用欧拉角，避免180度翻转问题）
        const forward = new THREE.Vector3(0, 0, -1);
        forward.applyQuaternion(this.player.camera.quaternion);
        
        // 计算XZ平面上的旋转角度
        // Three.js中相机朝向-Z时，在地图上应显示为指向上方（0度）
        let rotation = Math.atan2(-forward.x, -forward.z);
        
        // 镜像模式下翻转旋转方向
        if (this.mapMirror) {
            rotation = -rotation;
        }
        
        const mapPos = this.worldToMap(playerPos.x, playerPos.z);
        
        // 相机FOV参数
        const fovDeg = this.cameraFov; // 75度
        const fovHalfAngleDeg = fovDeg / 2; // 37.5度
        const fovHalfAngleRad = fovHalfAngleDeg * Math.PI / 180;
        
        // 最大视野距离：40米
        const maxViewRange = 40;
        const fovRadius = (maxViewRange / this.worldWidth) * this.mapSize;
        
        // 在40米处的视野宽度：2 * 40 * tan(37.5°)
        const fovWidth = 2 * maxViewRange * Math.tan(fovHalfAngleRad);
        const mapFovWidth = (fovWidth / this.worldWidth) * this.mapSize;
        
        // 转换为CSS旋转（弧度转角度）
        const rotationDeg = rotation * 180 / Math.PI;
        
        this.fovElement.style.cssText = `
            position: absolute;
            left: ${mapPos.x}px;
            top: ${mapPos.y}px;
            width: 0;
            height: 0;
            transform: translate(-50%, -50%) rotate(${rotationDeg}deg);
            pointer-events: none;
            z-index: 3;
        `;
        
        // 使用三角形表示视野锥（从玩家位置向前）
        // 三角形：顶点在玩家位置，底边在40米处
        const halfWidth = mapFovWidth / 2;
        this.fovElement.innerHTML = `
            <svg width="${mapFovWidth + 10}" height="${fovRadius + 10}" viewBox="0 0 ${mapFovWidth + 10} ${fovRadius + 10}" style="position: absolute; left: -${mapFovWidth/2 + 5}px; top: 0px; overflow: visible;">
                <polygon points="${(mapFovWidth + 10)/2},0 ${(mapFovWidth + 10)/2 - halfWidth},${fovRadius} ${(mapFovWidth + 10)/2 + halfWidth},${fovRadius}" 
                         fill="rgba(0, 255, 0, 0.2)" stroke="rgba(0, 255, 0, 0.5)" stroke-width="1"/>
            </svg>
        `;
    }
    
    updatePlayerMarker() {
        const playerPos = this.player.getPosition();
        const marker = document.getElementById('minimap-player');
        
        if (marker) {
            const mapPos = this.worldToMap(playerPos.x, playerPos.z);
            marker.style.left = `${mapPos.x}px`;
            marker.style.top = `${mapPos.y}px`;
        }
    }
    
    updateEnemyBlips() {
        const enemies = this.enemyManager.getEnemies();
        const currentBlips = new Set();
        
        enemies.forEach((enemy, index) => {
            if (!enemy || enemy.isDead || !enemy.mesh) return;
            
            try {
                const enemyPos = enemy.getPosition();
                
                // 检查是否在地图显示范围内
                if (this.isInWorldBounds(enemyPos.x, enemyPos.z)) {
                    const blipId = `enemy-${index}`;
                    currentBlips.add(blipId);
                    
                    const mapPos = this.worldToMap(enemyPos.x, enemyPos.z);
                    this.createOrUpdateBlip(blipId, mapPos, 'enemy');
                }
            } catch (e) {
                console.error('更新敌人地图标记失败:', e);
            }
        });
        
        this.removeOldBlips(currentBlips, 'enemy');
    }
    
    updateBossBlip() {
        const boss = this.enemyManager.boss;
        
        if (boss && !boss.isDead && boss.mesh) {
            try {
                const bossPos = boss.getPosition();
                
                if (this.isInWorldBounds(bossPos.x, bossPos.z)) {
                    const mapPos = this.worldToMap(bossPos.x, bossPos.z);
                    this.createOrUpdateBlip('boss', mapPos, 'boss');
                } else {
                    this.removeBlip('boss');
                }
            } catch (e) {
                console.error('更新Boss地图标记失败:', e);
            }
        } else {
            this.removeBlip('boss');
        }
    }
    
    worldToMap(worldX, worldZ) {
        let mapX = ((worldX - this.worldMinX) / this.worldWidth) * this.mapSize;
        const mapY = ((this.worldMaxZ - worldZ) / this.worldHeight) * this.mapSize;
        
        // 镜像处理
        if (this.mapMirror) {
            mapX = this.mapSize - mapX;
        }
        
        return { x: mapX, y: mapY };
    }
    
    isInWorldBounds(x, z) {
        return x >= this.worldMinX && x <= this.worldMaxX &&
               z >= this.worldMinZ && z <= this.worldMaxZ;
    }
    
    createOrUpdateBlip(id, position, type) {
        let blip = this.blipElements.get(id);
        
        if (!blip) {
            blip = document.createElement('div');
            blip.className = `map-${type}`;
            blip.id = `map-blip-${id}`;
            
            if (this.mapElement) {
                this.mapElement.appendChild(blip);
                this.blipElements.set(id, blip);
            }
        }
        
        blip.style.left = `${position.x}px`;
        blip.style.top = `${position.y}px`;
        blip.style.display = 'block';
    }
    
    removeOldBlips(currentBlips, type) {
        for (const [id, blip] of this.blipElements) {
            if (id.startsWith(type) && !currentBlips.has(id)) {
                blip.remove();
                this.blipElements.delete(id);
            }
        }
    }
    
    removeBlip(id) {
        const blip = this.blipElements.get(id);
        if (blip) {
            blip.remove();
            this.blipElements.delete(id);
        }
    }
    
    destroy() {
        for (const [id, blip] of this.blipElements) {
            blip.remove();
        }
        this.blipElements.clear();
        
        if (this.fovElement) {
            this.fovElement.remove();
            this.fovElement = null;
        }
        
        if (this.mapElement) {
            this.mapElement.style.display = 'none';
        }
    }
    
    toggleMirror() {
        this.mapMirror = !this.mapMirror;
        console.log('地图镜像模式:', this.mapMirror ? '开启' : '关闭');
    }
}