import * as THREE from 'three';

export class Player {
    constructor(camera, scene, enemyManager = null) {
        this.camera = camera;
        this.scene = scene;
        this.enemyManager = enemyManager;
        
        this.health = 100;
        this.maxHealth = 100;
        this.speed = this.baseSpeed;
        
        // 碰撞半径
        this.collisionRadius = 0.8;
        
        // 碰撞伤害相关
        this.lastCollisionDamageTime = 0;
        this.collisionDamageCooldown = 1; // 碰撞伤害冷却1秒
        
        // 子弹系统
        this.bullets = 0;
        this.maxBullets = 50;
        this.infiniteBullets = false;
        this.secretCode = '';
        this.secretCodeTarget = 'kkkk';
        this.pistol = null;
        this.isShooting = false;
        this.shootCooldown = 0;
        this.shootCooldownMax = 0.3; // 0.3秒射击冷却
        this.jumpForce = 10;
        this.gravity = 30;
        
        this.position = new THREE.Vector3(0, 2, 0);
        this.velocity = new THREE.Vector3();
        this.direction = new THREE.Vector3();
        
        this.isGrounded = false;
        this.isAttacking = false;
        this.canJump = false;
        this.isDead = false;
        this.attackCooldown = 0;
        this.attackCooldownMax = 0.2; // 0.2秒的攻击CD
        
        // 武器系统
        this.currentWeapon = 'sword'; // 当前武器: pistol 或 sword
        this.hasPistol = true;
        this.hasSword = true;
        
        // 体力系统
        this.stamina = 100;
        this.maxStamina = 100;
        this.staminaDrainRate = 30; // 每秒消耗体力
        this.staminaRegenRate = 15; // 每秒恢复体力
        this.isSprinting = false;
        this.staminaDepleted = false; // 体力是否耗尽
        this.baseSpeed = 10;
        this.sprintSpeed = 25;
        
        this.keys = {
            w: false,
            a: false,
            s: false,
            d: false,
            space: false,
            shift: false
        };
        
        this.mouse = {
            x: 0,
            y: 0
        };
        
        this.euler = new THREE.Euler(0, 0, 0, 'YXZ');
        
        this.setupControls();
        this.createWeapon();
        this.createPistol();
        this.updateBulletUI();
        this.updateWeaponUI();
    }
    
    setupControls() {
        // 键盘事件
        document.addEventListener('keydown', (e) => this.onKeyDown(e));
        document.addEventListener('keyup', (e) => this.onKeyUp(e));
        
        // 鼠标事件
        document.addEventListener('mousemove', (e) => this.onMouseMove(e));
        document.addEventListener('mousedown', (e) => this.onMouseDown(e));
        
        // 鼠标锁定状态变化
        document.addEventListener('pointerlockchange', () => this.onPointerLockChange());
    }
    
    onKeyDown(event) {
        // 秘密指令检测 - 输入 kkkk 开启无限子弹
        if (event.code === 'KeyK') {
            this.secretCode += 'k';
            if (this.secretCode.length > this.secretCodeTarget.length) {
                this.secretCode = this.secretCode.slice(-this.secretCodeTarget.length);
            }
            if (this.secretCode === this.secretCodeTarget) {
                this.infiniteBullets = !this.infiniteBullets;
                this.showSecretMessage();
                this.secretCode = '';
            }
        }
        
        switch (event.code) {
            case 'KeyW': this.keys.w = true; break;
            case 'KeyA': this.keys.a = true; break;
            case 'KeyS': this.keys.s = true; break;
            case 'KeyD': this.keys.d = true; break;
            case 'Space': 
                if (this.canJump) {
                    this.velocity.y = this.jumpForce;
                    this.canJump = false;
                }
                break;
            case 'ShiftLeft':
            case 'ShiftRight':
                this.keys.shift = true;
                break;
            case 'KeyM':
                if (typeof window.toggleMinimapMirror === 'function') {
                    window.toggleMinimapMirror();
                }
                break;
        }
    }
    
    onKeyUp(event) {
        switch (event.code) {
            case 'KeyW': this.keys.w = false; break;
            case 'KeyA': this.keys.a = false; break;
            case 'KeyS': this.keys.s = false; break;
            case 'KeyD': this.keys.d = false; break;
            case 'ShiftLeft':
            case 'ShiftRight':
                this.keys.shift = false;
                break;
        }
    }
    
    onMouseMove(event) {
        if (document.pointerLockElement === document.body) {
            this.mouse.x = event.movementX || 0;
            this.mouse.y = event.movementY || 0;
            
            this.euler.setFromQuaternion(this.camera.quaternion);
            this.euler.y -= this.mouse.x * 0.002;
            this.euler.x -= this.mouse.y * 0.002;
            
            this.euler.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.euler.x));
            
            this.camera.quaternion.setFromEuler(this.euler);
        }
    }
    
    onMouseDown(event) {
        if (document.pointerLockElement === document.body) {
            // 左键 - 攻击
            if (event.button === 0) {
                if (this.currentWeapon === 'sword') {
                    if (this.attackCooldown <= 0) {
                        this.attack();
                    }
                } else if (this.currentWeapon === 'pistol') {
                    if (this.shootCooldown <= 0 && this.bullets > 0) {
                        this.shoot();
                    }
                }
            }
            // 右键 - 切换武器
            else if (event.button === 2) {
                this.switchWeapon();
            }
        }
    }
    
    switchWeapon() {
        if (this.currentWeapon === 'pistol') {
            this.currentWeapon = 'sword';
        } else {
            this.currentWeapon = 'pistol';
        }
        
        // 显示/隐藏对应武器
        if (this.weapon) {
            this.weapon.visible = (this.currentWeapon === 'sword');
        }
        if (this.pistol) {
            this.pistol.visible = (this.currentWeapon === 'pistol');
        }
        
        // 更新UI显示
        this.updateWeaponUI();
    }
    
    updateWeaponUI() {
        const weaponText = document.getElementById('weapon-text');
        if (weaponText) {
            weaponText.textContent = this.currentWeapon === 'sword' ? '剑' : '手枪';
        }
    }
    
    attack() {
        if (this.isAttacking) return;
        this.isAttacking = true;
        this.attackCooldown = this.attackCooldownMax; // 设置CD
        
        // 挥砍动画 - 使用流畅的旋转动画
        if (this.weapon) {
            const startRotation = this.weapon.rotation.x;
            const slashSpeed = 0.3; // 挥砍速度
            let progress = 0;
            
            const animateSlash = () => {
                progress += slashSpeed;
                
                if (progress <= Math.PI) {
                    // 挥砍动作：从右上到左下
                    this.weapon.rotation.x = startRotation - Math.sin(progress) * 1.5;
                    this.weapon.rotation.y = Math.sin(progress * 0.5) * 0.5;
                    
                    // 添加一些位置移动增强效果
                    this.weapon.position.x = 0.3 + Math.sin(progress) * 0.3;
                    this.weapon.position.z = -0.5 - Math.sin(progress) * 0.2;
                    
                    requestAnimationFrame(animateSlash);
                } else {
                    // 重置位置
                    this.weapon.rotation.x = startRotation;
                    this.weapon.rotation.y = 0;
                    this.weapon.position.set(0.3, -0.3, -0.5);
                    this.isAttacking = false;
                }
            };
            
            animateSlash();
        }
        
        // 触发攻击事件
        const attackEvent = new CustomEvent('player-attack', {
            detail: {
                position: this.camera.position.clone(),
                direction: new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion)
            }
        });
        document.dispatchEvent(attackEvent);
    }
    
    shoot() {
        if (this.bullets <= 0 || this.isShooting) return;
        
        this.isShooting = true;
        this.shootCooldown = this.shootCooldownMax;
        if (!this.infiniteBullets) {
            this.bullets--;
        }
        this.updateBulletUI();
        
        // 射击动画 - 手枪后坐力
        if (this.pistol) {
            const originalPos = this.pistol.position.clone();
            this.pistol.position.z -= 0.1;
            
            setTimeout(() => {
                this.pistol.position.copy(originalPos);
            }, 100);
        }
        
        // 触发射击事件
        const shootEvent = new CustomEvent('player-shoot', {
            detail: {
                position: this.camera.position.clone(),
                direction: new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion)
            }
        });
        document.dispatchEvent(shootEvent);
        
        setTimeout(() => {
            this.isShooting = false;
        }, 100);
    }
    
    showSecretMessage() {
        const msg = document.createElement('div');
        msg.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: ${this.infiniteBullets ? 'rgba(0, 255, 0, 0.9)' : 'rgba(255, 0, 0, 0.9)'};
            color: white;
            padding: 20px 40px;
            font-size: 24px;
            font-weight: bold;
            border-radius: 10px;
            z-index: 10000;
            animation: pulse 0.5s ease-in-out;
        `;
        msg.textContent = this.infiniteBullets ? '🔫 无限子弹已激活！' : '🔫 无限子弹已关闭';
        document.body.appendChild(msg);
        setTimeout(() => msg.remove(), 2000);
    }
    
    updateBulletUI() {
        const bulletNumElement = document.getElementById('bullet-num');
        if (bulletNumElement) {
            bulletNumElement.textContent = this.infiniteBullets ? '∞' : this.bullets;
        }
    }
    
    addBullets(amount) {
        this.bullets = Math.min(this.maxBullets, this.bullets + amount);
        this.updateBulletUI();
    }
    
    enhance() {
        this.baseSpeed += 2;
        this.sprintSpeed += 3;
        this.showEnhanceMessage();
    }
    
    showEnhanceMessage() {
        const msg = document.createElement('div');
        msg.style.cssText = `
            position: fixed;
            top: 30%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(255, 165, 0, 0.9);
            color: white;
            padding: 20px 40px;
            font-size: 20px;
            font-weight: bold;
            border-radius: 10px;
            z-index: 10000;
        `;
        msg.textContent = '⚡ 能力增强！速度+2 冲刺+3';
        document.body.appendChild(msg);
        setTimeout(() => msg.remove(), 2000);
    }
    
    onPointerLockChange() {
        if (document.pointerLockElement !== document.body) {
            // 游戏暂停
        }
    }
    
    lockPointer() {
        document.body.requestPointerLock();
    }
    
    unlockPointer() {
        document.exitPointerLock();
    }
    
    createWeapon() {
        // 创建简单的武器模型（剑）
        const weaponGroup = new THREE.Group();
        
        // 剑刃
        const bladeGeo = new THREE.BoxGeometry(0.1, 0.8, 0.05);
        const bladeMat = new THREE.MeshStandardMaterial({ color: 0xCCCCCC });
        const blade = new THREE.Mesh(bladeGeo, bladeMat);
        blade.position.set(0.3, -0.3, -0.5);
        weaponGroup.add(blade);
        
        // 剑柄
        const handleGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.3, 8);
        const handleMat = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
        const handle = new THREE.Mesh(handleGeo, handleMat);
        handle.rotation.x = Math.PI / 2;
        handle.position.set(0.3, -0.7, -0.5);
        weaponGroup.add(handle);
        
        // 护手
        const guardGeo = new THREE.BoxGeometry(0.2, 0.05, 0.05);
        const guardMat = new THREE.MeshStandardMaterial({ color: 0xFFD700 });
        const guard = new THREE.Mesh(guardGeo, guardMat);
        guard.position.set(0.3, -0.35, -0.5);
        weaponGroup.add(guard);
        
        this.camera.add(weaponGroup);
        this.weapon = weaponGroup;
        this.weapon.visible = true; // 初始显示剑
        
        // 相机应该已经在场景中了，不需要再次添加
        if (!this.camera.parent) {
            this.scene.add(this.camera);
        }
    }
    
    createPistol() {
        const pistolGroup = new THREE.Group();
        
        // 枪身
        const bodyGeo = new THREE.BoxGeometry(0.08, 0.12, 0.25);
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.set(0.25, -0.25, -0.4);
        pistolGroup.add(body);
        
        // 枪管
        const barrelGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.2, 8);
        const barrelMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
        const barrel = new THREE.Mesh(barrelGeo, barrelMat);
        barrel.rotation.x = Math.PI / 2;
        barrel.position.set(0.25, -0.22, -0.55);
        pistolGroup.add(barrel);
        
        // 枪柄
        const gripGeo = new THREE.BoxGeometry(0.06, 0.15, 0.08);
        const gripMat = new THREE.MeshStandardMaterial({ color: 0x4a3728 });
        const grip = new THREE.Mesh(gripGeo, gripMat);
        grip.position.set(0.25, -0.35, -0.32);
        grip.rotation.x = 0.3;
        pistolGroup.add(grip);
        
        this.camera.add(pistolGroup);
        this.pistol = pistolGroup;
        this.pistol.visible = false; // 初始隐藏手枪
    }
    
    update(delta) {
        // 更新攻击CD
        if (this.attackCooldown > 0) {
            this.attackCooldown -= delta;
        }
        
        // 更新射击冷却
        if (this.shootCooldown > 0) {
            this.shootCooldown -= delta;
        }
        
        // 处理体力系统
        // 只有按住shift且体力充足且未耗尽时才能加速
        this.isSprinting = this.keys.shift && this.stamina > 0 && !this.staminaDepleted && this.direction.length() > 0;
        
        if (this.isSprinting) {
            this.stamina -= this.staminaDrainRate * delta;
            if (this.stamina <= 0) {
                this.stamina = 0;
                this.staminaDepleted = true; // 体力耗尽，必须松开shift
            }
        } else if (this.direction.length() === 0) {
            // 站立时恢复体力
            this.stamina += this.staminaRegenRate * delta;
            if (this.stamina > this.maxStamina) this.stamina = this.maxStamina;
        } else {
            // 行走时恢复体力较慢
            this.stamina += this.staminaRegenRate * 0.5 * delta;
            if (this.stamina > this.maxStamina) this.stamina = this.maxStamina;
        }
        
        // 如果体力恢复超过10%，则解除耗尽状态
        if (this.stamina > 10) {
            this.staminaDepleted = false;
        }
        
        // 更新体力条
        this.updateStaminaBar();
        
        // 设置速度
        this.speed = this.isSprinting ? this.sprintSpeed : this.baseSpeed;
        
        // 计算移动方向
        this.direction.set(0, 0, 0);
        
        if (this.keys.w) this.direction.z -= 1;
        if (this.keys.s) this.direction.z += 1;
        if (this.keys.a) this.direction.x -= 1;
        if (this.keys.d) this.direction.x += 1;
        
        this.direction.normalize();
        
        // 应用相机旋转到移动方向
        this.direction.applyQuaternion(this.camera.quaternion);
        this.direction.y = 0;
        this.direction.normalize();
        
        // 水平移动
        if (this.direction.length() > 0) {
            this.velocity.x = this.direction.x * this.speed;
            this.velocity.z = this.direction.z * this.speed;
        } else {
            this.velocity.x *= 0.8;
            this.velocity.z *= 0.8;
        }
        
        // 重力
        this.velocity.y -= this.gravity * delta;
        
        // 更新位置
        this.position.x += this.velocity.x * delta;
        this.position.y += this.velocity.y * delta;
        this.position.z += this.velocity.z * delta;
        
        // 地面检测
        if (this.position.y <= 2) {
            this.position.y = 2;
            this.velocity.y = 0;
            this.isGrounded = true;
            this.canJump = true;
        } else {
            this.isGrounded = false;
        }
        
        // 边界限制
        this.position.x = Math.max(-95, Math.min(95, this.position.x));
        this.position.z = Math.max(-95, Math.min(95, this.position.z));
        
        // 敌人碰撞检测
        this.handleEnemyCollision();
        
        // 更新相机位置
        this.camera.position.copy(this.position);
    }
    
    handleEnemyCollision() {
        if (!this.enemyManager) return;
        
        const enemies = this.enemyManager.getEnemies();
        const bosses = this.enemyManager.bosses || [];
        
        const allTargets = [...enemies, ...bosses];
        const currentTime = Date.now() / 1000;
        
        for (const target of allTargets) {
            if (!target || target.isDead || !target.mesh) continue;
            
            const targetPos = target.getPosition();
            const distance = this.position.distanceTo(targetPos);
            
            const targetRadius = target.isBoss ? 3 : 0.8;
            const minDist = this.collisionRadius + targetRadius;
            
            if (distance < minDist && distance > 0) {
                // 计算推力方向
                const pushDir = new THREE.Vector3()
                    .subVectors(this.position, targetPos)
                    .normalize();
                
                // 将玩家推开
                const overlap = minDist - distance;
                this.position.x += pushDir.x * overlap;
                this.position.z += pushDir.z * overlap;
                
                // 碰撞造成伤害
                if (currentTime - this.lastCollisionDamageTime >= this.collisionDamageCooldown) {
                    const damage = target.isBoss ? 30 : 10;
                    this.takeDamage(damage);
                    this.lastCollisionDamageTime = currentTime;
                }
            }
        }
    }
    
    takeDamage(amount) {
        if (this.isDead) return; // 已死亡则不再受伤
        
        this.health -= amount;
        if (this.health < 0) this.health = 0;
        
        // 更新UI
        const healthFill = document.getElementById('health-fill');
        if (healthFill) {
            healthFill.style.width = `${(this.health / this.maxHealth) * 100}%`;
        }
        
        // 屏幕红色闪烁效果
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(255, 0, 0, 0.3);
            pointer-events: none;
            z-index: 1000;
        `;
        document.body.appendChild(overlay);
        setTimeout(() => overlay.remove(), 200);
        
        if (this.health <= 0) {
            this.die();
        }
    }
    
    die() {
        this.isDead = true;
        
        // 退出指针锁定
        document.exitPointerLock();
        
        // 获取游戏信息
        let gameTimeStr = '00:00';
        let bossKills = 0;
        
        if (typeof window.game !== 'undefined' && window.game) {
            const game = window.game;
            const minutes = Math.floor(game.gameTime / 60);
            const seconds = Math.floor(game.gameTime % 60);
            gameTimeStr = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            bossKills = game.bossKillCount || 0;
        }
        
        // 显示游戏结束画面
        const gameOverDiv = document.createElement('div');
        gameOverDiv.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.9);
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            z-index: 10000;
        `;
        
        gameOverDiv.innerHTML = `
            <h1 style="color: #ff0000; font-size: 60px; margin-bottom: 30px;">游戏结束</h1>
            <p style="color: #ffffff; font-size: 24px; margin: 10px 0;">存活时间: ${gameTimeStr}</p>
            <p style="color: #ffff00; font-size: 24px; margin: 10px 0;">击杀BOSS: ${bossKills}</p>
            <button onclick="location.reload()" style="margin-top: 40px; padding: 15px 40px; font-size: 20px; cursor: pointer;">重新开始</button>
        `;
        
        document.body.appendChild(gameOverDiv);
    }
    
    updateStaminaBar() {
        const staminaFill = document.getElementById('stamina-fill');
        if (staminaFill) {
            const percent = (this.stamina / this.maxStamina) * 100;
            staminaFill.style.width = `${percent}%`;
        }
    }
    
    heal(amount) {
        this.health = Math.min(this.maxHealth, this.health + amount);
        
        // 更新UI
        const healthFill = document.getElementById('health-fill');
        if (healthFill) {
            healthFill.style.width = `${(this.health / this.maxHealth) * 100}%`;
        }
        
        // 显示治疗提示
        const healText = document.createElement('div');
        healText.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            color: #00ff00;
            font-size: 36px;
            font-weight: bold;
            text-shadow: 0 0 10px rgba(0, 255, 0, 0.8);
            pointer-events: none;
            z-index: 500;
            animation: healFloat 1s ease-out forwards;
        `;
        healText.textContent = `+${amount} HP`;
        
        // 添加动画
        const style = document.createElement('style');
        style.textContent = `
            @keyframes healFloat {
                0% { opacity: 1; transform: translate(-50%, -50%); }
                100% { opacity: 0; transform: translate(-50%, -120%); }
            }
        `;
        document.head.appendChild(style);
        
        document.body.appendChild(healText);
        setTimeout(() => healText.remove(), 1000);
    }
    
    healStamina(amount) {
        this.stamina = Math.min(this.maxStamina, this.stamina + amount);
        this.updateStaminaBar();
    }
    
    getPosition() {
        return this.position.clone();
    }
}