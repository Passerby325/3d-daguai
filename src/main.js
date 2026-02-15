import * as THREE from 'three';
import { Game } from './core/Game.js';

console.log('main.js 加载成功');

// 游戏初始化
let game;
try {
    game = new Game();
    window.game = game; // 暴露到全局
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

// 全局镜像开关函数
window.toggleMinimapMirror = function() {
    if (game && game.minimap) {
        game.minimap.toggleMirror();
    } else {
        console.warn('minimap 未初始化');
    }
};

// 暂停功能
let isPaused = false;
window.togglePause = function() {
    isPaused = !isPaused;
    const pauseMenu = document.getElementById('pause-menu');
    
    if (isPaused) {
        pauseMenu.style.display = 'flex';
        document.exitPointerLock();
    } else {
        pauseMenu.style.display = 'none';
        // 安全地请求指针锁定
        if (document.body) {
            document.body.requestPointerLock().catch(() => {});
        }
    }
    
    if (game) {
        game.setPaused(isPaused);
    }
};

// 点击暂停菜单继续游戏
document.getElementById('pause-menu').addEventListener('click', function() {
    if (isPaused) {
        isPaused = false;
        document.getElementById('pause-menu').style.display = 'none';
        // 安全地请求指针锁定
        document.body.requestPointerLock().catch(() => {});
        if (game) {
            game.setPaused(false);
        }
    }
});

// ESC按键直接暂停（使用keydown确保在指针未锁定时也能检测）
document.addEventListener('keydown', function(e) {
    if (e.code === 'Escape') {
        // 阻止默认行为
        e.preventDefault();
        window.togglePause();
    }
});

console.log('main.js 完全加载');