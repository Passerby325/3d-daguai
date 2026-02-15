import * as THREE from 'three';

// AI状态枚举
const AIState = {
    IDLE: 'idle',
    PATROL: 'patrol',
    CHASE: 'chase',
    ATTACK: 'attack',
    FLEE: 'flee',
    DEAD: 'dead'
};

export class Enemy {
    constructor(scene, player, x, z, difficultyLevel = 1) {
        this.scene = scene;
        this.player = player;
        this.difficultyLevel = difficultyLevel;
        
        // 根据难度调整属性
        const difficultyMultiplier = 1 + (difficultyLevel - 1) * 0.2; // 每级增加20%
        
        this.health = 50 * difficultyMultiplier;
        this.maxHealth = this.health;
        this.damage = 10 * difficultyMultiplier;
        this.baseSpeed = 3;
        this.speed = this.baseSpeed * difficultyMultiplier;
        this.attackRange = 2;
        this.detectionRange = 25;
        this.attackCooldown = 0;
        this.baseAttackInterval = 1.5;
        this.attackInterval = this.baseAttackInterval / difficultyMultiplier; // 难度越高，攻击间隔越短
        
        this.state = AIState.IDLE;
        this.stateTimer = 0;
        this.isDead = false;
        
        this.position = new THREE.Vector3(x, 1, z);
        this.velocity = new THREE.Vector3();
        this.targetPosition = null;
        
        this.mesh = null;
        this.healthBar = null;
        
        this.createMesh();
        this.createHealthBar();
        this.selectNewPatrolTarget();
    }
    
    createMesh() {
        // 根据难度调整体型：难度越高，敌人越大
        const sizeMultiplier = 1 + (this.difficultyLevel - 1) * 0.15;
        
        // 创建敌人身体
        const geometry = new THREE.BoxGeometry(1 * sizeMultiplier, 2 * sizeMultiplier, 1 * sizeMultiplier);
        const material = new THREE.MeshStandardMaterial({ color: 0xff0000 });
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.copy(this.position);
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;
        this.scene.add(this.mesh);
        
        // 添加眼睛（用于指示方向）- 在敌人正面
        // 眼球（白色，较大）
        const eyeWhiteGeo = new THREE.SphereGeometry(0.25 * sizeMultiplier, 16, 16);
        const eyeWhiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
        
        const leftEye = new THREE.Mesh(eyeWhiteGeo, eyeWhiteMat);
        leftEye.position.set(-0.35 * sizeMultiplier, 0.4 * sizeMultiplier, 0.52 * sizeMultiplier);
        this.mesh.add(leftEye);
        
        const rightEye = new THREE.Mesh(eyeWhiteGeo, eyeWhiteMat);
        rightEye.position.set(0.35 * sizeMultiplier, 0.4 * sizeMultiplier, 0.52 * sizeMultiplier);
        this.mesh.add(rightEye);
        
        // 眼珠（黑色，较大，占眼白的大部分）
        const pupilGeo = new THREE.SphereGeometry(0.18 * sizeMultiplier, 16, 16);
        const pupilMat = new THREE.MeshStandardMaterial({ color: 0x000000 });
        
        const leftPupil = new THREE.Mesh(pupilGeo, pupilMat);
        leftPupil.position.set(-0.35 * sizeMultiplier, 0.4 * sizeMultiplier, 0.62 * sizeMultiplier);
        this.mesh.add(leftPupil);
        
        const rightPupil = new THREE.Mesh(pupilGeo, pupilMat);
        rightPupil.position.set(0.35 * sizeMultiplier, 0.4 * sizeMultiplier, 0.62 * sizeMultiplier);
        this.mesh.add(rightPupil);
        
        // 高难度敌人发光效果
        if (this.difficultyLevel > 1) {
            const glowIntensity = Math.min(0.3, (this.difficultyLevel - 1) * 0.1);
            material.emissive = new THREE.Color(0xff0000);
            material.emissiveIntensity = glowIntensity;
        }
    }
    
    createHealthBar() {
        // 血条背景
        const bgGeo = new THREE.PlaneGeometry(1.2, 0.2);
        const bgMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
        const bg = new THREE.Mesh(bgGeo, bgMat);
        bg.position.y = 1.5;
        this.mesh.add(bg);
        
        // 血条填充
        const fillGeo = new THREE.PlaneGeometry(1.2, 0.2);
        const fillMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
        this.healthBar = new THREE.Mesh(fillGeo, fillMat);
        this.healthBar.position.z = 0.01;
        this.healthBar.position.y = 1.5;
        this.healthBar.scale.x = 1;
        this.mesh.add(this.healthBar);
    }
    
    update(delta) {
        if (this.isDead) return;
        
        this.stateTimer += delta;
        this.attackCooldown -= delta;
        
        // 状态机更新
        this.updateAIState();
        
        // 执行当前状态的行为
        switch (this.state) {
            case AIState.IDLE:
                this.updateIdle(delta);
                break;
            case AIState.PATROL:
                this.updatePatrol(delta);
                break;
            case AIState.CHASE:
                this.updateChase(delta);
                break;
            case AIState.ATTACK:
                this.updateAttack(delta);
                break;
            case AIState.FLEE:
                this.updateFlee(delta);
                break;
        }
        
        // 更新位置
        this.position.add(this.velocity.clone().multiplyScalar(delta));
        this.mesh.position.copy(this.position);
        
        // 敌人始终面向玩家
        const playerPos = this.player.getPosition();
        this.mesh.lookAt(playerPos.x, this.position.y, playerPos.z);
        
        // 更新血条朝向相机
        this.healthBar.lookAt(this.player.camera.position);
    }
    
    updateAIState() {
        const distanceToPlayer = this.position.distanceTo(this.player.getPosition());
        
        // 状态转换逻辑
        switch (this.state) {
            case AIState.IDLE:
            case AIState.PATROL:
                if (distanceToPlayer < this.detectionRange) {
                    this.changeState(AIState.CHASE);
                } else if (this.state === AIState.IDLE && this.stateTimer > 2) {
                    this.changeState(AIState.PATROL);
                }
                break;
                
            case AIState.CHASE:
                if (distanceToPlayer < this.attackRange) {
                    this.changeState(AIState.ATTACK);
                } else if (distanceToPlayer > this.detectionRange * 2.5) { // 增加放弃追击距离
                    this.changeState(AIState.IDLE);
                } else if (this.health < this.maxHealth * 0.2) { // 血量更低才逃跑
                    if (Math.random() > 0.7) {
                        this.changeState(AIState.FLEE);
                        this.showDialogue("我需要撤退！");
                    }
                }
                break;
                
            case AIState.ATTACK:
                if (distanceToPlayer > this.attackRange * 2) { // 增加从攻击切换到追击的距离
                    this.changeState(AIState.CHASE);
                } else if (this.health < this.maxHealth * 0.2) {
                    if (Math.random() > 0.7) {
                        this.changeState(AIState.FLEE);
                        this.showDialogue("太强大了，我先撤！");
                    }
                }
                break;
                
            case AIState.FLEE:
                if (distanceToPlayer > this.detectionRange * 2.5 || this.health > this.maxHealth * 0.5) {
                    this.changeState(AIState.IDLE);
                    this.showDialogue("现在安全了...");
                }
                break;
        }
    }
    
    changeState(newState) {
        if (this.state !== newState) {
            this.state = newState;
            this.stateTimer = 0;
            
            // 根据状态改变颜色
            if (this.mesh && this.mesh.material) {
                switch (newState) {
                    case AIState.CHASE:
                        this.mesh.material.color.setHex(0xff6600); // 橙色-追击
                        this.mesh.material.emissive.setHex(0x331100);
                        break;
                    case AIState.ATTACK:
                        this.mesh.material.color.setHex(0xff0000); // 红色-攻击
                        this.mesh.material.emissive.setHex(0x550000);
                        break;
                    case AIState.FLEE:
                        this.mesh.material.color.setHex(0xffff00); // 黄色-逃跑
                        this.mesh.material.emissive.setHex(0x333300);
                        break;
                    default:
                        this.mesh.material.color.setHex(0xff0000); // 红色-默认
                        this.mesh.material.emissive.setHex(0x000000);
                }
            }
            
            // 状态切换时的AI对话
            if (newState === AIState.CHASE) {
                const dialogues = ["发现目标！", "别想跑！", "我来解决你！"];
                this.showDialogue(dialogues[Math.floor(Math.random() * dialogues.length)]);
            } else if (newState === AIState.ATTACK) {
                const dialogues = ["吃我一击！", "接招！", "受死吧！"];
                this.showDialogue(dialogues[Math.floor(Math.random() * dialogues.length)]);
            }
        }
    }
    
    updateIdle(delta) {
        this.velocity.set(0, 0, 0);
    }
    
    updatePatrol(delta) {
        if (!this.targetPosition || this.position.distanceTo(this.targetPosition) < 1) {
            this.selectNewPatrolTarget();
        }
        
        if (this.targetPosition) {
            const direction = new THREE.Vector3()
                .subVectors(this.targetPosition, this.position)
                .normalize();
            this.velocity.copy(direction).multiplyScalar(this.speed * 0.5);
        }
    }
    
    updateChase(delta) {
        const playerPos = this.player.getPosition();
        const distanceToPlayer = this.position.distanceTo(playerPos);
        const direction = new THREE.Vector3()
            .subVectors(playerPos, this.position)
            .normalize();
        
        // 在追击过程中也可以攻击
        if (distanceToPlayer <= this.attackRange && this.attackCooldown <= 0) {
            this.performAttack();
            this.attackCooldown = this.attackInterval;
        }
        
        // 追击速度随难度增加：基础速度的1.5倍 + 难度加成
        const chaseSpeedMultiplier = 1.5 + (this.difficultyLevel - 1) * 0.3;
        this.velocity.copy(direction).multiplyScalar(this.speed * chaseSpeedMultiplier);
    }
    
    updateAttack(delta) {
        this.velocity.set(0, 0, 0);
        
        // 攻击
        if (this.attackCooldown <= 0) {
            this.performAttack();
            this.attackCooldown = this.attackInterval;
        }
        
        // 攻击状态下的呼吸效果
        const breathe = Math.sin(Date.now() * 0.01) * 0.1 + 1;
        this.mesh.scale.set(breathe, breathe, breathe);
    }
    
    updateFlee(delta) {
        const playerPos = this.player.getPosition();
        const direction = new THREE.Vector3()
            .subVectors(this.position, playerPos)
            .normalize();
        
        // 逃跑速度也随难度增加
        const fleeSpeedMultiplier = 1.2 + (this.difficultyLevel - 1) * 0.2;
        this.velocity.copy(direction).multiplyScalar(this.speed * fleeSpeedMultiplier);
    }
    
    performAttack() {
        // 检查是否在攻击范围内
        if (this.position.distanceTo(this.player.getPosition()) <= this.attackRange) {
            this.player.takeDamage(this.damage);
            
            // 攻击动画 - 扑向玩家
            const attackDirection = new THREE.Vector3()
                .subVectors(this.player.getPosition(), this.position)
                .normalize();
            
            // 向前冲刺距离随难度增加
            const dashDistance = 0.8 + (this.difficultyLevel - 1) * 0.2;
            const originalPos = this.position.clone();
            this.position.add(attackDirection.multiplyScalar(dashDistance));
            
            // 身体前倾攻击姿势
            this.mesh.rotation.x = -0.5;
            
            // 闪烁红色表示攻击
            this.mesh.material.emissive.setHex(0xff0000);
            
            // 攻击动画持续时间随难度减少（攻击更快）
            const animationDuration = Math.max(100, 200 - (this.difficultyLevel - 1) * 20);
            
            // 攻击音效提示（视觉反馈）
            setTimeout(() => {
                if (this.mesh && this.mesh.material) {
                    this.mesh.material.emissive.setHex(0x000000);
                    this.mesh.rotation.x = 0;
                    this.position.copy(originalPos);
                }
            }, animationDuration);
        }
    }
    
    selectNewPatrolTarget() {
        const angle = Math.random() * Math.PI * 2;
        const distance = 10 + Math.random() * 10;
        this.targetPosition = new THREE.Vector3(
            this.position.x + Math.cos(angle) * distance,
            1,
            this.position.z + Math.sin(angle) * distance
        );
        
        // 限制在地图范围内
        this.targetPosition.x = Math.max(-90, Math.min(90, this.targetPosition.x));
        this.targetPosition.z = Math.max(-90, Math.min(90, this.targetPosition.z));
    }
    
    takeDamage(amount) {
        this.health -= amount;
        
        // 更新血条
        const healthPercent = Math.max(0, this.health / this.maxHealth);
        this.healthBar.scale.x = healthPercent;
        
        // 受击闪烁
        this.mesh.material.emissive.setHex(0xff0000);
        setTimeout(() => {
            if (this.mesh && this.mesh.material) {
                this.mesh.material.emissive.setHex(0x000000);
            }
        }, 100);
        
        // 显示伤害数字
        this.showDamageText(amount);
        
        // 受伤对话
        if (this.health > 0) {
            const dialogues = ["好痛！", "该死！", "你会后悔的！", "有点本事！"];
            this.showDialogue(dialogues[Math.floor(Math.random() * dialogues.length)]);
        }
        
        if (this.health <= 0) {
            this.die();
        }
    }
    
    showDamageText(damage) {
        const damageDiv = document.createElement('div');
        damageDiv.className = 'damage-text';
        damageDiv.textContent = `-${damage}`;
        
        // 将3D位置转换为屏幕坐标
        const vector = this.position.clone();
        vector.y += 2;
        vector.project(this.player.camera);
        
        const x = (vector.x * 0.5 + 0.5) * window.innerWidth;
        const y = (-(vector.y * 0.5) + 0.5) * window.innerHeight;
        
        damageDiv.style.left = `${x}px`;
        damageDiv.style.top = `${y}px`;
        
        document.body.appendChild(damageDiv);
        setTimeout(() => damageDiv.remove(), 1000);
    }
    
    showDialogue(text) {
        const dialogueBox = document.getElementById('ai-dialogue');
        if (dialogueBox) {
            dialogueBox.textContent = text;
            dialogueBox.style.display = 'block';
            
            setTimeout(() => {
                dialogueBox.style.display = 'none';
            }, 3000);
        }
    }
    
    die() {
        this.isDead = true;
        this.state = AIState.DEAD;
        
        // 死亡动画
        this.mesh.rotation.x = Math.PI / 2;
        this.mesh.position.y = 0.5;
        
        this.showDialogue("啊...我输了...");
        
        // 击杀小怪回血（最大生命值的十分之一）
        const healAmount = Math.ceil(this.player.maxHealth / 10);
        this.player.heal(healAmount);
        
        // 延迟销毁
        setTimeout(() => {
            this.destroy();
        }, 2000);
    }
    
    destroy() {
        if (this.mesh) {
            this.scene.remove(this.mesh);
            this.mesh = null;
        }
        this.isDead = true;
    }
    
    getPosition() {
        return this.position.clone();
    }
    
    getState() {
        return this.state;
    }
}