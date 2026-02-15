import * as THREE from 'three';

export class CombatSystem {
    constructor(player, enemyManager) {
        this.player = player;
        this.enemyManager = enemyManager;
        
        this.attackRange = 7; // 7米攻击距离
        this.playerDamage = 20;
        this.attackAngle = Math.PI / 3; // 60度攻击角度
        
        // 监听玩家攻击事件
        document.addEventListener('player-attack', (e) => this.handlePlayerAttack(e));
    }
    
    update(delta) {
        // 可以在这里添加其他战斗相关的更新逻辑
    }
    
    handlePlayerAttack(event) {
        const { position, direction } = event.detail;
        
        // 获取所有敌人和Boss
        const enemies = this.enemyManager.getEnemies();
        const boss = this.enemyManager.boss;
        
        // 创建检测对象数组（包括普通敌人和Boss）
        let allTargets = [...enemies];
        if (boss && !boss.isDead) {
            allTargets.push(boss);
        }
        
        // 找到在攻击范围内的最近目标
        let closestTarget = null;
        let closestDistance = Infinity;
        
        for (const target of allTargets) {
            if (!target.mesh) continue;
            
            // 计算到目标的距离
            const targetPos = target.getPosition();
            const distance = position.distanceTo(targetPos);
            
            // 检查是否在攻击距离内
            if (distance > this.attackRange) continue;
            
            // 计算方向角度（确保目标在玩家前方扇形区域内）
            const toTarget = new THREE.Vector3().subVectors(targetPos, position).normalize();
            const angle = direction.angleTo(toTarget);
            
            // 如果在扇形攻击范围内
            if (angle < this.attackAngle) {
                if (distance < closestDistance) {
                    closestDistance = distance;
                    closestTarget = target;
                }
            }
        }
        
        // 对最近的目标造成伤害
        if (closestTarget) {
            console.log('打击目标:', closestTarget.isBoss ? 'BOSS' : '敌人', '伤害:', this.playerDamage);
            closestTarget.takeDamage(this.playerDamage);
            
            // 击退效果
            const knockbackDir = new THREE.Vector3()
                .subVectors(closestTarget.getPosition(), position)
                .normalize();
            const knockbackDistance = closestTarget.isBoss ? 0.5 : 2;
            closestTarget.position.add(knockbackDir.multiplyScalar(knockbackDistance));
        } else {
            console.log('未打中任何目标');
        }
    }
}