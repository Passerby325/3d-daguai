import * as THREE from 'three';
import { Game } from './core/Game.js';

console.log('main.js 加载成功');

// 游戏初始化
let game;
try {
    game = new Game();
    console.log('游戏初始化成功');
} catch (e) {
    console.error('游戏初始化失败:', e);
    alert('游戏加载失败: ' + e.message);
}

// 防止右键菜单
document.addEventListener('contextmenu', (e) => e.preventDefault());

// 全局启动函数（供内联onclick使用）
window.startGame = function() {
    console.log('startGame被调用');
    
    // 锁定指针（必须在用户交互中同步调用）
    document.body.requestPointerLock().then(() => {
        console.log('指针锁定成功');
    }).catch(err => {
        console.warn('指针锁定失败:', err);
    });
    
    // 启动游戏
    if (game) {
        game.start();
        console.log('游戏已启动');
    } else {
        console.error('游戏对象未初始化');
        alert('游戏尚未加载完成，请刷新页面重试');
    }
};

console.log('main.js 完全加载');