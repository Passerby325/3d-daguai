import * as THREE from 'three';
import { Enemy } from './Enemy.js';

// Boss状态枚举
const BossState = {
    IDLE: 'idle',
    CHASE: 'chase',
    ATTACK: 'attack',
    CHARGE: 'charge',      // 冲锋状态
    SMASH: 'smash',        // 砸地范围攻击
    SUMMON: 'summon',      // 召唤小怪
    ENRAGED: 'enraged'     // 狂暴状态
};

export class Boss extends Enemy {
    constructor(scene, player, x, z) {
        // Boss基础属性比敌人强很多
        super(scene, player, x, z, 1);
        
        // 覆盖基础属性
        this.maxHealth = 500;
        this.health = this.maxHealth;
        this.damage = 30;
        this.baseSpeed = 4;
        this.speed = this.baseSpeed;
        this.attackRange = 4;
        this.detectionRange = 40;
        this.attackInterval = 2;
        
        // Boss特有属性
        this.isBoss = true;
        this.bossState = BossState.IDLE;
        this.phase = 1; // 战斗阶段
        this.enragedThreshold = 0.3; // 30%血量进入狂暴
        
        // 技能冷却
        this.chargeCooldown = 0;
        this.chargeInterval = 8;
        this.smashCooldown = 0;
        this.smashInterval = 12;
        this.summonCooldown = 0;
        this.summonInterval = 15;
        
        // 冲锋技能属性
        this.isCharging = false;
        this.chargeDirection = null;
        this.chargeSpeed = 20;
        this.chargeDuration = 0;
        
        // 创建Boss专用的视觉效果
        this.createBossEffects();
        
        // 显示Boss警告
        this.showBossWarning();
        
        console.log('Boss已生成！');
    }
    
    createMesh() {
        // Boss比普通敌人大3倍
        const sizeMultiplier = 3;
        
        // 创建Boss主体 - 使用更复杂的形状
        const bodyGeo = new THREE.BoxGeometry(2 * sizeMultiplier, 3 * sizeMultiplier, 2 * sizeMultiplier);
        const bodyMat = new THREE.MeshStandardMaterial({ 
            color: 0x660000,
            emissive: 0x330000,
            emissiveIntensity: 0.3
        });
        this.mesh = new THREE.Mesh(bodyGeo, bodyMat);
        this.mesh.position.copy(this.position);
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;
        this.scene.add(this.mesh);
        
        // 肩部护甲
        const shoulderGeo = new THREE.BoxGeometry(3 * sizeMultiplier, 1 * sizeMultiplier, 1.5 * sizeMultiplier);
        const shoulderMat = new THREE.MeshStandardMaterial({ color: 0x444444 });
        const shoulders = new THREE.Mesh(shoulderGeo, shoulderMat);
        shoulders.position.set(0, 1 * sizeMultiplier, 0);
        this.mesh.add(shoulders);
        
        // 发光眼睛白球 - 在正面
        const eyeWhiteGeo = new THREE.SphereGeometry(0.5 * sizeMultiplier, 16, 16);
        const eyeWhiteMat = new THREE.MeshStandardMaterial({ 
            color: 0xffffff,
            emissive: 0x444444,
            emissiveIntensity: 0.5
        });
        
        const leftEye = new THREE.Mesh(eyeWhiteGeo, eyeWhiteMat);
        leftEye.position.set(-0.5 * sizeMultiplier, 0.5 * sizeMultiplier, 1 * sizeMultiplier);
        this.mesh.add(leftEye);
        
        const rightEye = new THREE.Mesh(eyeWhiteGeo, eyeWhiteMat);
        rightEye.position.set(0.5 * sizeMultiplier, 0.5 * sizeMultiplier, 1 * sizeMultiplier);
        this.mesh.add(rightEye);
        
        // 眼珠（黑色，大且明显）
        const pupilGeo = new THREE.SphereGeometry(0.35 * sizeMultiplier, 16, 16);
        const pupilMat = new THREE.MeshStandardMaterial({ 
            color: 0x000000,
            emissive: 0x000000
        });
        
        const leftPupil = new THREE.Mesh(pupilGeo, pupilMat);
        leftPupil.position.set(-0.5 * sizeMultiplier, 0.5 * sizeMultiplier, 1.25 * sizeMultiplier);
        this.mesh.add(leftPupil);
        
        const rightPupil = new THREE.Mesh(pupilGeo, pupilMat);
        rightPupil.position.set(0.5 * sizeMultiplier, 0.5 * sizeMultiplier, 1.25 * sizeMultiplier);
        this.mesh.add(rightPupil);
        
        // Boss名称标签
        this.createNameTag();
    }
    
    createNameTag() {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        
        // 背景
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(0, 0, 256, 64);
        
        // 文字
        ctx.fillStyle = '#ff0000';
        ctx.font = 'bold 32px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('★ BOSS ★', 128, 40);
        
        const texture = new THREE.CanvasTexture(canvas);
        const spriteMat = new THREE.SpriteMaterial({ map: texture });
        this.nameTag = new THREE.Sprite(spriteMat);
        this.nameTag.position.set(0, 6, 0);
        this.nameTag.scale.set(6, 1.5, 1);
        this.mesh.add(this.nameTag);
    }
    
    createHealthBar() {
        // Boss血条比普通敌人更大
        const bgGeo = new THREE.PlaneGeometry(4, 0.4);
        const bgMat = new THREE.MeshStandardMaterial({ color: 0x000000 });
        const bg = new THREE.Mesh(bgGeo, bgMat);
        bg.position.y = 4.5;
        this.mesh.add(bg);
        
        // 血条填充
        const fillGeo = new THREE.PlaneGeometry(4, 0.4);
        const fillMat = new THREE.MeshStandardMaterial({ 
            color: 0xff0000,
            emissive: 0xff0000,
            emissiveIntensity: 0.5
        });
        this.healthBar = new THREE.Mesh(fillGeo, fillMat);
        this.healthBar.position.z = 0.01;
        this.healthBar.position.y = 4.5;
        this.healthBar.scale.x = 1;
        this.mesh.add(this.healthBar);
    }
    
    createBossEffects() {
        // 创建Boss周围的光环效果
        const ringGeo = new THREE.RingGeometry(4, 5, 32);
        const ringMat = new THREE.MeshBasicMaterial({ 
            color: 0xff0000,
            transparent: true,
            opacity: 0.3,
            side: THREE.DoubleSide
        });
        this.auraRing = new THREE.Mesh(ringGeo, ringMat);
        this.auraRing.rotation.x = -Math.PI / 2;
        this.auraRing.position.y = 0.1;
        this.scene.add(this.auraRing);
        
        // 粒子效果
        this.particles = [];
    }
    
    showBossWarning() {
        // 全屏Boss警告 - 显示在正上方
        const warning = document.createElement('div');
        warning.style.cssText = `
            position: fixed;
            top: 10%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: linear-gradient(135deg, rgba(255,0,0,0.9), rgba(100,0,0,0.9));
            color: white;
            padding: 30px 60px;
            font-size: 36px;
            font-weight: bold;
            border-radius: 20px;
            z-index: 10000;
            text-align: center;
            border: 5px solid gold;
            text-shadow: 0 0 20px rgba(255,0,0,1);
        `;
        warning.innerHTML = `
            <div style="font-size: 48px;">⚠️</div>
            <div>BOSS 出现！</div>
            <div style="font-size: 18px; margin-top: 10px;">准备战斗！</div>
        `;
        
        document.body.appendChild(warning);
        
        setTimeout(() => {
            warning.remove();
        }, 1000); // 显示1秒
    }
    
    update(delta) {
        if (this.isDead) return;
        
        this.stateTimer += delta;
        this.attackCooldown -= delta;
        this.chargeCooldown -= delta;
        this.smashCooldown -= delta;
        this.summonCooldown -= delta;
        
        // 检查是否进入狂暴状态
        if (this.phase === 1 && this.health / this.maxHealth <= this.enragedThreshold) {
            this.enterEnragedMode();
        }
        
        // 更新Boss状态
        this.updateBossAI(delta);
        
        // 更新光环动画
        if (this.auraRing) {
            this.auraRing.rotation.z += delta;
            this.auraRing.position.copy(this.position);
            this.auraRing.position.y = 0.1;
            
            // 脉冲效果
            const pulse = Math.sin(Date.now() * 0.003) * 0.1 + 1;
            this.auraRing.scale.set(pulse, pulse, 1);
        }
        
        // 更新血条朝向
        this.healthBar.lookAt(this.player.camera.position);
        if (this.nameTag) {
            this.nameTag.lookAt(this.player.camera.position);
        }
        
        // 更新UI血条
        this.updateUI();
    }
    
    updateBossAI(delta) {
        const distanceToPlayer = this.position.distanceTo(this.player.getPosition());
        
        // 优先使用特殊技能
        if (this.bossState !== BossState.CHARGE) {
            if (this.chargeCooldown <= 0 && distanceToPlayer > 5 && distanceToPlayer < 20) {
                this.startCharge();
                return;
            }
            
            if (this.smashCooldown <= 0 && distanceToPlayer < 6) {
                this.startSmash();
                return;
            }
            
            if (this.summonCooldown <= 0 && this.phase === 2) {
                this.startSummon();
                return;
            }
        }
        
        // 根据距离选择行为
        if (this.bossState === BossState.CHARGE) {
            this.updateCharge(delta);
        } else if (this.bossState === BossState.SMASH) {
            this.updateSmash(delta);
        } else if (this.bossState === BossState.SUMMON) {
            this.updateSummon(delta);
        } else if (distanceToPlayer < this.attackRange) {
            this.bossState = BossState.ATTACK;
            this.updateAttack(delta);
        } else {
            // Boss始终追击玩家，不受距离限制
            this.bossState = BossState.CHASE;
            this.updateChase(delta);
        }
        
        // 更新位置
        this.position.add(this.velocity.clone().multiplyScalar(delta));
        this.mesh.position.copy(this.position);
        
        // Boss始终面向玩家
        const playerPos = this.player.getPosition();
        this.mesh.lookAt(playerPos.x, this.position.y, playerPos.z);
    }
    
    enterEnragedMode() {
        this.phase = 2;
        this.bossState = BossState.ENRAGED;
        
        // 狂暴状态属性提升
        this.speed = this.baseSpeed * 1.5;
        this.damage = this.damage * 1.3;
        this.attackInterval = this.attackInterval * 0.7;
        
        // 视觉效果
        this.mesh.material.emissive.setHex(0xff0000);
        this.mesh.material.emissiveIntensity = 0.8;
        
        // 狂暴提示
        const rageText = document.createElement('div');
        rageText.style.cssText = `
            position: fixed;
            top: 30%;
            left: 50%;
            transform: translate(-50%, -50%);
            color: #ff0000;
            font-size: 60px;
            font-weight: bold;
            text-shadow: 0 0 30px rgba(255,0,0,1);
            z-index: 10000;
            animation: ragePulse 1s ease-in-out infinite;
        `;
        rageText.textContent = '🔥 BOSS狂暴！ 🔥';
        
        const style = document.createElement('style');
        style.textContent = `
            @keyframes ragePulse {
                0%, 100% { transform: translate(-50%, -50%) scale(1); }
                50% { transform: translate(-50%, -50%) scale(1.2); }
            }
        `;
        document.head.appendChild(style);
        
        document.body.appendChild(rageText);
        
        setTimeout(() => {
            rageText.remove();
        }, 3000);
        
        console.log('Boss进入狂暴状态！');
    }
    
    startCharge() {
        this.bossState = BossState.CHARGE;
        this.chargeCooldown = this.chargeInterval;
        this.isCharging = true;
        this.chargeDuration = 1.5;
        
        // 计算冲锋方向
        const playerPos = this.player.getPosition();
        this.chargeDirection = new THREE.Vector3()
            .subVectors(playerPos, this.position)
            .normalize();
        
        // 预警效果
        this.mesh.material.emissive.setHex(0xffaa00);
        this.showDialogue("小心，我要冲锋了！");
        
        console.log('Boss开始冲锋！');
    }
    
    updateCharge(delta) {
        this.chargeDuration -= delta;
        
        if (this.chargeDuration > 0) {
            // 快速冲锋
            this.velocity.copy(this.chargeDirection).multiplyScalar(this.chargeSpeed);
            
            // 冲锋时留下残影效果
            if (Math.random() > 0.7) {
                this.createAfterImage();
            }
            
            // 检测碰撞玩家
            if (this.position.distanceTo(this.player.getPosition()) < 3) {
                this.player.takeDamage(this.damage * 2);
                // 击退玩家
                const knockbackDir = new THREE.Vector3()
                    .subVectors(this.player.getPosition(), this.position)
                    .normalize();
                this.player.position.add(knockbackDir.multiplyScalar(5));
            }
        } else {
            // 冲锋结束
            this.isCharging = false;
            this.bossState = BossState.IDLE;
            this.mesh.material.emissive.setHex(this.phase === 2 ? 0xff0000 : 0x330000);
        }
    }
    
    createAfterImage() {
        const afterImage = this.mesh.clone();
        afterImage.material = afterImage.material.clone();
        afterImage.material.transparent = true;
        afterImage.material.opacity = 0.5;
        this.scene.add(afterImage);
        
        // 渐隐消失
        const fade = setInterval(() => {
            if (afterImage.material.opacity > 0) {
                afterImage.material.opacity -= 0.1;
            } else {
                clearInterval(fade);
                this.scene.remove(afterImage);
            }
        }, 50);
    }
    
    startSmash() {
        this.bossState = BossState.SMASH;
        this.smashCooldown = this.smashInterval;
        
        // 砸地预警
        this.mesh.position.y += 3;
        this.showDialogue("尝尝这个！");
        
        setTimeout(() => {
            this.performSmash();
        }, 800);
    }
    
    performSmash() {
        // 砸地动作
        this.mesh.position.y = 1;
        
        // 范围伤害
        const smashRange = 8;
        if (this.position.distanceTo(this.player.getPosition()) < smashRange) {
            this.player.takeDamage(this.damage * 1.5);
        }
        
        // 冲击波效果
        this.createShockwave();
        
        // 屏幕震动
        this.shakeScreen();
        
        this.bossState = BossState.IDLE;
    }
    
    createShockwave() {
        const waveGeo = new THREE.RingGeometry(0.5, 1, 32);
        const waveMat = new THREE.MeshBasicMaterial({
            color: 0xff6600,
            transparent: true,
            opacity: 0.8,
            side: THREE.DoubleSide
        });
        const wave = new THREE.Mesh(waveGeo, waveMat);
        wave.rotation.x = -Math.PI / 2;
        wave.position.copy(this.position);
        wave.position.y = 0.2;
        this.scene.add(wave);
        
        // 扩散动画
        let scale = 1;
        const expand = setInterval(() => {
            scale += 0.5;
            wave.scale.set(scale, scale, 1);
            waveMat.opacity -= 0.05;
            
            if (waveMat.opacity <= 0) {
                clearInterval(expand);
                this.scene.remove(wave);
            }
        }, 50);
    }
    
    shakeScreen() {
        const canvas = document.querySelector('canvas');
        if (!canvas) return;
        
        let shakeCount = 0;
        const maxShakes = 10;
        
        const shake = setInterval(() => {
            const x = (Math.random() - 0.5) * 20;
            const y = (Math.random() - 0.5) * 20;
            canvas.style.transform = `translate(${x}px, ${y}px)`;
            
            shakeCount++;
            if (shakeCount >= maxShakes) {
                clearInterval(shake);
                canvas.style.transform = 'translate(0, 0)';
            }
        }, 50);
    }
    
    startSummon() {
        this.bossState = BossState.SUMMON;
        this.summonCooldown = this.summonInterval;
        
        this.showDialogue("出来吧，我的仆从！");
        
        // 召唤动画
        this.mesh.rotation.y += Math.PI * 2;
        
        setTimeout(() => {
            this.summonMinions();
            this.bossState = BossState.IDLE;
        }, 1000);
    }
    
    summonMinions() {
        // 召唤3个小怪
        const summonEvent = new CustomEvent('boss-summon', {
            detail: {
                position: this.position.clone(),
                count: 3
            }
        });
        document.dispatchEvent(summonEvent);
        
        console.log('Boss召唤了小怪！');
    }
    
    updateSmash(delta) {
        // 砸地过程中不移动
        this.velocity.set(0, 0, 0);
    }
    
    updateSummon(delta) {
        // 召唤过程中缓慢旋转
        this.mesh.rotation.y += delta * 2;
        this.velocity.set(0, 0, 0);
    }
    
    updateUI() {
        const bossHealthBar = document.getElementById('boss-health-bar');
        const bossHealthFill = document.getElementById('boss-health-fill');
        const bossName = document.getElementById('boss-name');
        
        if (bossHealthBar && bossHealthFill && bossName) {
            if (!this.isDead) {
                bossHealthBar.style.display = 'block';
                bossName.style.display = 'block';
                const healthPercent = Math.max(0, (this.health / this.maxHealth) * 100);
                bossHealthFill.style.width = `${healthPercent}%`;
            } else {
                // Boss死亡时立即显示血条为0
                bossHealthFill.style.width = '0%';
                setTimeout(() => {
                    bossHealthBar.style.display = 'none';
                    bossName.style.display = 'none';
                }, 500);
            }
        }
    }
    
    takeDamage(amount) {
        // Boss受伤逻辑 - 重写父类方法确保正确工作
        this.health -= amount;
        if (this.health < 0) this.health = 0; // 防止负数
        
        // 更新血条
        const healthPercent = Math.max(0, Math.min(1, this.health / this.maxHealth));
        if (this.healthBar) {
            this.healthBar.scale.x = healthPercent;
        }
        
        // 受击闪烁
        if (this.mesh && this.mesh.material) {
            const originalEmissive = this.mesh.material.emissive.getHex();
            const originalIntensity = this.mesh.material.emissiveIntensity;
            
            this.mesh.material.emissive.setHex(0xff0000);
            this.mesh.material.emissiveIntensity = 0.8;
            
            setTimeout(() => {
                if (this.mesh && this.mesh.material) {
                    // 根据当前状态恢复颜色
                    if (this.phase === 2) {
                        this.mesh.material.emissive.setHex(0xff0000);
                        this.mesh.material.emissiveIntensity = 0.8;
                    } else {
                        this.mesh.material.emissive.setHex(0x330000);
                        this.mesh.material.emissiveIntensity = 0.3;
                    }
                }
            }, 150);
        }
        
        // 显示伤害数字
        this.showDamageText(amount);
        
        // Boss说话时受到攻击
        if (Math.random() > 0.7) {
            const dialogues = [
                "这点伤害不值一提！",
                "你就这点本事？",
                "我要认真了！",
                "有点意思..."
            ];
            this.showDialogue(dialogues[Math.floor(Math.random() * dialogues.length)]);
        }
        
        // 检查是否死亡
        if (this.health <= 0) {
            this.die();
        }
    }
    
    die() {
        this.isDead = true;
        
        // 立即清零血条
        if (this.healthBar) {
            this.healthBar.scale.x = 0;
        }
        
        // Boss死亡特效
        this.createDeathEffect();
        
        // 清理光环
        if (this.auraRing) {
            this.scene.remove(this.auraRing);
        }
        
        // 发送Boss死亡事件
        const deathEvent = new CustomEvent('boss-defeated', {
            detail: {
                position: this.position.clone()
            }
        });
        document.dispatchEvent(deathEvent);
        
        // 延迟销毁
        setTimeout(() => {
            this.destroy();
        }, 3000);
    }
    
    createDeathEffect() {
        // 爆炸效果
        const explosionGeo = new THREE.SphereGeometry(1, 16, 16);
        const explosionMat = new THREE.MeshBasicMaterial({
            color: 0xff0000,
            transparent: true,
            opacity: 0.8
        });
        
        for (let i = 0; i < 5; i++) {
            setTimeout(() => {
                const explosion = new THREE.Mesh(explosionGeo, explosionMat.clone());
                explosion.position.copy(this.position);
                explosion.position.x += (Math.random() - 0.5) * 4;
                explosion.position.z += (Math.random() - 0.5) * 4;
                explosion.scale.set(0.1, 0.1, 0.1);
                this.scene.add(explosion);
                
                // 扩散动画
                let scale = 0.1;
                const expand = setInterval(() => {
                    scale += 0.5;
                    explosion.scale.set(scale, scale, scale);
                    explosion.material.opacity -= 0.05;
                    
                    if (explosion.material.opacity <= 0) {
                        clearInterval(expand);
                        this.scene.remove(explosion);
                    }
                }, 50);
            }, i * 200);
        }
        
        // 胜利提示 - 显示在正上方，显示1秒
        const victory = document.createElement('div');
        victory.style.cssText = `
            position: fixed;
            top: 10%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: linear-gradient(135deg, #ffd700, #ffed4e);
            color: #000;
            padding: 30px 60px;
            font-size: 36px;
            font-weight: bold;
            border-radius: 20px;
            z-index: 10000;
            text-align: center;
            border: 5px solid #fff;
            box-shadow: 0 0 50px rgba(255, 215, 0, 0.8);
        `;
        victory.innerHTML = `
            <div style="font-size: 48px;">🏆</div>
            <div>BOSS 被击败！</div>
            <div style="font-size: 18px; margin-top: 10px;">获得 1000 经验值！</div>
        `;
        
        document.body.appendChild(victory);
        
        setTimeout(() => {
            victory.remove();
        }, 1000); // 显示1秒
        
        console.log('Boss被击败！');
    }
}