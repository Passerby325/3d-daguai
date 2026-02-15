import { Enemy } from './Enemy.js';
import { Boss } from './Boss.js';

export class EnemyManager {
    constructor(scene, player) {
        this.scene = scene;
        this.player = player;
        this.enemies = [];
        
        // Boss系统
        this.boss = null;
        this.bossSpawnTimer = 0;
        this.bossSpawnInterval = 10; // 每10秒生成一个Boss
        this.bossDefeatedCount = 0;
        
        // 难度系统
        this.gameTime = 0;
        this.difficultyLevel = 1;
        this.killCount = 0;
        
        // 基础设置
        this.baseMaxEnemies = 5;
        this.maxEnemies = this.baseMaxEnemies;
        this.baseSpawnInterval = 5;
        this.spawnInterval = this.baseSpawnInterval;
        this.spawnTimer = 0;
        
        // 显示难度信息
        this.createDifficultyUI();
        
        // 监听Boss召唤和死亡事件
        document.addEventListener('boss-summon', (e) => this.handleBossSummon(e));
        document.addEventListener('boss-defeated', () => this.handleBossDefeated());
    }
    
    createDifficultyUI() {
        const difficultyDiv = document.createElement('div');
        difficultyDiv.id = 'difficulty-display';
        difficultyDiv.style.cssText = `
            position: absolute;
            top: 60px;
            right: 30px;
            color: #ff6600;
            font-size: 16px;
            font-weight: bold;
            background: rgba(0, 0, 0, 0.5);
            padding: 10px 20px;
            border-radius: 5px;
            z-index: 100;
        `;
        difficultyDiv.innerHTML = `难度等级: <span id="difficulty-level">1</span>`;
        document.getElementById('ui-overlay').appendChild(difficultyDiv);
    }
    
    updateDifficulty(delta) {
        this.gameTime += delta;
        
        // 每30秒增加一个难度等级
        const newLevel = Math.floor(this.gameTime / 30) + 1;
        if (newLevel > this.difficultyLevel) {
            this.difficultyLevel = newLevel;
            this.onLevelUp();
        }
        
        // 根据难度调整参数
        this.maxEnemies = this.baseMaxEnemies + (this.difficultyLevel - 1) * 3;
        this.spawnInterval = Math.max(0.5, this.baseSpawnInterval - (this.difficultyLevel - 1) * 0.3);
        
        // 更新UI
        const levelDisplay = document.getElementById('difficulty-level');
        if (levelDisplay) {
            levelDisplay.textContent = this.difficultyLevel;
        }
        
        // Boss生成逻辑
        this.bossSpawnTimer += delta;
        if (!this.boss && this.bossSpawnTimer >= this.bossSpawnInterval) {
            this.spawnBoss();
            this.bossSpawnTimer = 0;
        }
    }
    
    onLevelUp() {
        // 显示升级提示
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(255, 0, 0, 0.9);
            color: white;
            padding: 30px 60px;
            font-size: 36px;
            font-weight: bold;
            border-radius: 15px;
            z-index: 1000;
            animation: pulse 0.5s ease-in-out;
        `;
        notification.textContent = `⚠️ 难度提升！等级 ${this.difficultyLevel}`;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 2000);
    }
    
    spawnEnemy(x, z) {
        if (this.enemies.length >= this.maxEnemies) return;
        
        try {
            // 传递难度参数给敌人
            const enemy = new Enemy(this.scene, this.player, x, z, this.difficultyLevel);
            this.enemies.push(enemy);
            this.updateEnemyCount();
        } catch (e) {
            console.error('生成敌人失败:', e);
        }
    }
    
    update(delta) {
        // 更新难度
        this.updateDifficulty(delta);
        
        // 更新Boss
        if (this.boss && !this.boss.isDead) {
            this.boss.update(delta);
        } else if (this.boss && this.boss.isDead) {
            // Boss死亡后清理引用
            this.boss = null;
            this.updateEnemyCount();
        }
        
        // 更新所有敌人
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const enemy = this.enemies[i];
            enemy.update(delta);
            
            // 检查敌人是否死亡
            if (enemy.isDead) {
                this.killCount++;
                this.updateKillCount();
                this.player.healStamina(15);
                this.removeEnemy(i);
            }
        }
        
        // 自动生成新敌人
        this.spawnTimer += delta;
        if (this.spawnTimer >= this.spawnInterval) {
            this.spawnTimer = 0;
            this.trySpawnNewEnemy();
        }
    }
    
    trySpawnNewEnemy() {
        if (this.enemies.length < this.maxEnemies) {
            // 在玩家一定距离外随机位置生成
            const angle = Math.random() * Math.PI * 2;
            const distance = 30 + Math.random() * 20;
            const x = this.player.getPosition().x + Math.cos(angle) * distance;
            const z = this.player.getPosition().z + Math.sin(angle) * distance;
            
            // 确保在地图范围内
            if (Math.abs(x) < 90 && Math.abs(z) < 90) {
                this.spawnEnemy(x, z);
            }
        }
    }
    
    removeEnemy(index) {
        const enemy = this.enemies[index];
        const position = enemy.getPosition().clone();
        enemy.destroy();
        this.enemies.splice(index, 1);
        this.updateEnemyCount();
        
        // 掉落子弹
        const dropEvent = new CustomEvent('enemy-drop-bullet', {
            detail: { position: position }
        });
        document.dispatchEvent(dropEvent);
    }
    
    updateEnemyCount() {
        const enemyNumElement = document.getElementById('enemy-num');
        if (enemyNumElement) {
            enemyNumElement.textContent = this.enemies.length + (this.boss ? 1 : 0);
        }
    }
    
    updateKillCount() {
        const killNumElement = document.getElementById('kill-num');
        if (killNumElement) {
            killNumElement.textContent = this.killCount;
        }
    }
    
    spawnBoss() {
        // 随机生成Boss位置（不限制距离，只要不在玩家10米内）
        let x, z, distance;
        do {
            x = (Math.random() - 0.5) * 180;
            z = (Math.random() - 0.5) * 180;
            distance = Math.sqrt(
                Math.pow(x - this.player.getPosition().x, 2) + 
                Math.pow(z - this.player.getPosition().z, 2)
            );
        } while (distance < 10); // 确保不在玩家10米内
        
        this.boss = new Boss(this.scene, this.player, x, z);
        this.updateEnemyCount();
        
        console.log('Boss已生成！');
    }
    
    handleBossSummon(event) {
        const { position, count } = event.detail;
        
        // 在Boss周围召唤小怪
        for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2;
            const distance = 5 + Math.random() * 3;
            const x = position.x + Math.cos(angle) * distance;
            const z = position.z + Math.sin(angle) * distance;
            
            // 确保不超出最大敌人数量
            if (this.enemies.length < this.maxEnemies) {
                this.spawnEnemy(x, z);
            }
        }
    }
    
    handleBossDefeated() {
        this.bossDefeatedCount++;
        this.boss = null;
        this.bossSpawnTimer = 0;
        
        // 重置Boss生成间隔（稍微缩短）
        this.bossSpawnInterval = Math.max(30, 60 - this.bossDefeatedCount * 5);
        
        this.updateEnemyCount();
        console.log('Boss已被击败！下一个Boss将在' + this.bossSpawnInterval + '秒后出现');
    }
    
    getEnemies() {
        return this.enemies;
    }
    
    getEnemyAt(position, radius = 2) {
        for (const enemy of this.enemies) {
            if (enemy.getPosition().distanceTo(position) < radius) {
                return enemy;
            }
        }
        return null;
    }
}