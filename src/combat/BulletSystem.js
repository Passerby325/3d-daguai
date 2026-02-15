import * as THREE from 'three';

export class Bullet {
    constructor(scene, position, direction) {
        this.scene = scene;
        this.direction = direction.clone().normalize();
        this.speed = 100;
        this.damage = 25;
        this.lifetime = 3;
        this.age = 0;
        this.hasHit = false;
        
        // 创建子弹模型
        const geometry = new THREE.SphereGeometry(0.05, 8, 8);
        const material = new THREE.MeshBasicMaterial({ color: 0xffff00 });
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.copy(position);
        
        // 添加光晕效果
        const glowGeo = new THREE.SphereGeometry(0.1, 8, 8);
        const glowMat = new THREE.MeshBasicMaterial({ 
            color: 0xffff00, 
            transparent: true, 
            opacity: 0.3 
        });
        this.glow = new THREE.Mesh(glowGeo, glowMat);
        this.mesh.add(this.glow);
        
        this.scene.add(this.mesh);
    }
    
    update(delta) {
        this.age += delta;
        
        // 移动子弹
        this.mesh.position.add(this.direction.clone().multiplyScalar(this.speed * delta));
        
        // 检查是否超出生命周期
        if (this.age >= this.lifetime) {
            return false;
        }
        
        // 检查是否超出地图边界
        if (Math.abs(this.mesh.position.x) > 100 || 
            Math.abs(this.mesh.position.z) > 100) {
            return false;
        }
        
        return true;
    }
    
    destroy() {
        this.scene.remove(this.mesh);
    }
}

export class BulletSystem {
    constructor(scene) {
        this.scene = scene;
        this.bullets = [];
    }
    
    shoot(position, direction) {
        const bullet = new Bullet(this.scene, position, direction);
        this.bullets.push(bullet);
        return bullet;
    }
    
    update(delta, enemies, bosses) {
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const bullet = this.bullets[i];
            const alive = bullet.update(delta);
            
            if (!alive) {
                bullet.destroy();
                this.bullets.splice(i, 1);
                continue;
            }
            
            // 检测碰撞
            if (!bullet.hasHit) {
                const allTargets = [...enemies];
                if (bosses && bosses.length > 0) {
                    for (const boss of bosses) {
                        if (boss && !boss.isDead) {
                            allTargets.push(boss);
                        }
                    }
                }
                
                for (const target of allTargets) {
                    if (!target.mesh || target.isDead) continue;
                    
                    const distance = bullet.mesh.position.distanceTo(target.getPosition());
                    // Boss体积更大，检测距离更大
                    const hitRadius = target.isBoss ? 5 : 2.5;
                    
                    if (distance < hitRadius) {
                        target.takeDamage(bullet.damage);
                        bullet.hasHit = true;
                        bullet.destroy();
                        this.bullets.splice(i, 1);
                        break;
                    }
                }
            }
        }
    }
    
    destroy() {
        for (const bullet of this.bullets) {
            bullet.destroy();
        }
        this.bullets = [];
    }
}

export class BulletDrop {
    constructor(scene, position, bulletAmount = 1) {
        this.scene = scene;
        this.position = position.clone();
        this.position.y = 0.5;
        this.collected = false;
        this.bulletAmount = bulletAmount;
        
        // 子弹模型
        const geometry = new THREE.CylinderGeometry(0.1, 0.1, 0.3, 8);
        const material = new THREE.MeshStandardMaterial({ 
            color: 0xffff00,
            emissive: 0xffff00,
            emissiveIntensity: 0.5
        });
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.copy(this.position);
        this.mesh.rotation.z = Math.PI / 2;
        
        // 发光效果
        const glowGeo = new THREE.SphereGeometry(0.2, 8, 8);
        const glowMat = new THREE.MeshBasicMaterial({ 
            color: 0xffff00, 
            transparent: true, 
            opacity: 0.3 
        });
        this.glow = new THREE.Mesh(glowGeo, glowMat);
        this.mesh.add(this.glow);
        
        this.scene.add(this.mesh);
        
        // 销毁计时器
        this.lifetime = 30;
        this.age = 0;
    }
    
    update(delta, playerPosition) {
        this.age += delta;
        
        // 旋转动画
        this.mesh.rotation.y += delta * 2;
        
        // 浮动动画
        this.mesh.position.y = 0.5 + Math.sin(this.age * 3) * 0.1;
        
        // 检查是否被收集
        const distance = this.position.distanceTo(playerPosition);
        if (distance < 2) {
            this.collected = true;
            return true; // 返回true表示被收集
        }
        
        // 超过生命周期
        if (this.age >= this.lifetime) {
            return false;
        }
        
        return null; // 继续存在
    }
    
    destroy() {
        this.scene.remove(this.mesh);
    }
}

export class BulletDropManager {
    constructor(scene) {
        this.scene = scene;
        this.drops = [];
        this.bulletDropAmount = 1;
    }
    
    createDrop(position) {
        const drop = new BulletDrop(this.scene, position, this.bulletDropAmount);
        this.drops.push(drop);
    }
    
    update(delta, playerPosition) {
        for (let i = this.drops.length - 1; i >= 0; i--) {
            const result = this.drops[i].update(delta, playerPosition);
            
            if (result === true) {
                // 被收集
                const amount = this.drops[i].bulletAmount;
                this.drops[i].destroy();
                this.drops.splice(i, 1);
                return amount; // 返回收集的子弹数量
            } else if (result === false) {
                // 超时销毁
                this.drops[i].destroy();
                this.drops.splice(i, 1);
            }
        }
        return 0;
    }
    
    destroy() {
        for (const drop of this.drops) {
            drop.destroy();
        }
        this.drops = [];
    }
}
