import * as THREE from 'three';
import { Player } from '../player/Player.js';
import { EnemyManager } from '../enemies/EnemyManager.js';
import { CombatSystem } from '../combat/CombatSystem.js';
import { MiniMap } from '../ui/MiniMap.js';
import { BulletSystem, BulletDropManager } from '../combat/BulletSystem.js';

export class Game {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.clock = new THREE.Clock();
        this.isRunning = false;
        
        this.player = null;
        this.enemyManager = null;
        this.combatSystem = null;
        this.minimap = null;
        this.bulletSystem = null;
        this.bulletDropManager = null;
        this.gameTime = 0;
        this.bossKillCount = 0;
        
        this.init();
    }
    
    init() {
        console.log('Game.init() 开始');
        
        // 创建场景
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87CEEB);
        this.scene.fog = new THREE.Fog(0x87CEEB, 10, 100);
        console.log('场景创建成功');
        
        // 创建相机
        this.camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );
        
        // 将相机添加到场景（必须在创建Player之前）
        this.scene.add(this.camera);
        
        // 创建渲染器
        console.log('创建渲染器...');
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        document.getElementById('game-container').appendChild(this.renderer.domElement);
        console.log('渲染器创建成功');
        
        // 添加光照
        this.setupLighting();
        
        // 创建环境
        this.createEnvironment();
        
        // 创建玩家
        console.log('创建玩家...');
        this.player = new Player(this.camera, this.scene);
        console.log('玩家创建成功');
        
        // 创建敌人管理器
        this.enemyManager = new EnemyManager(this.scene, this.player);
        
        // 创建战斗系统
        this.combatSystem = new CombatSystem(this.player, this.enemyManager);
        
        // 创建雷达
        this.minimap = new MiniMap(this.player, this.enemyManager);
        
        // 窗口大小调整
        window.addEventListener('resize', () => this.onWindowResize());
        
        // 监听Boss死亡事件
        document.addEventListener('boss-defeated', () => {
            this.addBossKill();
        });
        
        // 生成初始敌人
        console.log('生成初始敌人...');
        this.spawnInitialEnemies();
        
        // 创建子弹系统
        this.bulletSystem = new BulletSystem(this.scene);
        this.bulletDropManager = new BulletDropManager(this.scene);
        
        // 监听射击事件
        document.addEventListener('player-shoot', (e) => this.handlePlayerShoot(e));
        
        // 监听敌人掉落子弹事件
        document.addEventListener('enemy-drop-bullet', (e) => {
            if (this.bulletDropManager) {
                this.bulletDropManager.createDrop(e.detail.position);
            }
        });
        
        console.log('Game.init() 完成');
    }
    
    handlePlayerShoot(event) {
        const { position, direction } = event.detail;
        this.bulletSystem.shoot(position, direction);
    }
    
    setupLighting() {
        // 环境光
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
        this.scene.add(ambientLight);
        
        // 方向光（模拟太阳）
        const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        dirLight.position.set(50, 100, 50);
        dirLight.castShadow = true;
        dirLight.shadow.camera.left = -50;
        dirLight.shadow.camera.right = 50;
        dirLight.shadow.camera.top = 50;
        dirLight.shadow.camera.bottom = -50;
        dirLight.shadow.camera.near = 0.1;
        dirLight.shadow.camera.far = 200;
        this.scene.add(dirLight);
    }
    
    createEnvironment() {
        // 地面
        const groundGeometry = new THREE.PlaneGeometry(200, 200);
        const groundMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x3d7c47,
            roughness: 0.8
        });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        this.scene.add(ground);
        
        // 添加一些障碍物（树木/岩石）
        this.createObstacles();
    }
    
    createObstacles() {
        // 创建随机分布的障碍物
        for (let i = 0; i < 30; i++) {
            const type = Math.random() > 0.5 ? 'tree' : 'rock';
            const x = (Math.random() - 0.5) * 180;
            const z = (Math.random() - 0.5) * 180;
            
            // 避开出生点
            if (Math.abs(x) < 10 && Math.abs(z) < 10) continue;
            
            if (type === 'tree') {
                this.createTree(x, z);
            } else {
                this.createRock(x, z);
            }
        }
    }
    
    createTree(x, z) {
        // 树干
        const trunkGeo = new THREE.CylinderGeometry(0.3, 0.5, 3, 8);
        const trunkMat = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
        const trunk = new THREE.Mesh(trunkGeo, trunkMat);
        trunk.position.set(x, 1.5, z);
        trunk.castShadow = true;
        trunk.receiveShadow = true;
        this.scene.add(trunk);
        
        // 树叶
        const leavesGeo = new THREE.ConeGeometry(2.5, 5, 8);
        const leavesMat = new THREE.MeshStandardMaterial({ color: 0x228B22 });
        const leaves = new THREE.Mesh(leavesGeo, leavesMat);
        leaves.position.set(x, 4.5, z);
        leaves.castShadow = true;
        this.scene.add(leaves);
    }
    
    createRock(x, z) {
        const rockGeo = new THREE.DodecahedronGeometry(Math.random() * 1 + 0.5);
        const rockMat = new THREE.MeshStandardMaterial({ color: 0x808080 });
        const rock = new THREE.Mesh(rockGeo, rockMat);
        rock.position.set(x, 0.5, z);
        rock.castShadow = true;
        rock.receiveShadow = true;
        rock.rotation.set(
            Math.random() * Math.PI,
            Math.random() * Math.PI,
            Math.random() * Math.PI
        );
        this.scene.add(rock);
    }
    
    spawnInitialEnemies() {
        // 生成5个初始敌人
        for (let i = 0; i < 5; i++) {
            const angle = (i / 5) * Math.PI * 2;
            const distance = 20 + Math.random() * 10;
            const x = Math.cos(angle) * distance;
            const z = Math.sin(angle) * distance;
            
            this.enemyManager.spawnEnemy(x, z);
        }
    }
    
    start() {
        console.log('Game.start() 被调用');
        this.isRunning = true;
        // 指针锁定已经在点击事件中完成
        this.animate();
    }
    
    setPaused(paused) {
        this.isPaused = paused;
        if (!paused) {
            this.clock.getDelta(); // 重置时钟
            this.animate();
        }
    }
    
    updateGameInfo() {
        const timeElement = document.getElementById('game-time');
        const bossElement = document.getElementById('boss-kills');
        
        if (timeElement) {
            const minutes = Math.floor(this.gameTime / 60);
            const seconds = Math.floor(this.gameTime % 60);
            timeElement.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
        
        if (bossElement) {
            bossElement.textContent = this.bossKillCount;
        }
    }
    
    addBossKill() {
        this.bossKillCount++;
        this.updateGameInfo();
    }
    
    animate() {
        if (!this.isRunning || this.isPaused) {
            return;
        }
        
        requestAnimationFrame(() => this.animate());
        
        const delta = this.clock.getDelta();
        
        // 更新游戏时间
        if (!this.isPaused) {
            this.gameTime += delta;
            this.updateGameInfo();
        }
        
        // 更新玩家
        this.player.update(delta);
        
        // 更新敌人
        this.enemyManager.update(delta);
        
        // 更新战斗系统
        this.combatSystem.update(delta);
        
        // 更新子弹系统
        if (this.bulletSystem) {
            const enemies = this.enemyManager.getEnemies();
            const boss = this.enemyManager.boss;
            this.bulletSystem.update(delta, enemies, boss);
        }
        
        // 更新子弹掉落
        if (this.bulletDropManager) {
            const collected = this.bulletDropManager.update(delta, this.player.getPosition());
            if (collected > 0) {
                this.player.addBullets(collected);
            }
        }
        
        // 更新雷达
        if (this.minimap) {
            this.minimap.update(delta);
        }
        
        // 渲染
        this.renderer.render(this.scene, this.camera);
    }
    
    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
}