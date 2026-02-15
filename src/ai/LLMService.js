// 大模型AI服务接口
// 这里可以集成OpenAI、Claude、或国产大模型API

export class LLMService {
    constructor() {
        this.apiKey = null; // 需要用户填入自己的API密钥
        this.apiUrl = null;
        this.isConfigured = false;
    }
    
    // 配置API
    configure(apiKey, provider = 'openai') {
        this.apiKey = apiKey;
        this.provider = provider;
        
        switch (provider) {
            case 'openai':
                this.apiUrl = 'https://api.openai.com/v1/chat/completions';
                break;
            case 'claude':
                this.apiUrl = 'https://api.anthropic.com/v1/messages';
                break;
            case 'deepseek':
                this.apiUrl = 'https://api.deepseek.com/v1/chat/completions';
                break;
            default:
                console.error('未知的AI提供商');
                return false;
        }
        
        this.isConfigured = true;
        return true;
    }
    
    // 生成敌人战术对话
    async generateEnemyDialogue(context) {
        if (!this.isConfigured) {
            // 如果没有配置API，使用预设的随机回复
            return this.getRandomDialogue();
        }
        
        const prompt = this.buildPrompt(context);
        
        try {
            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: JSON.stringify({
                    model: 'gpt-3.5-turbo',
                    messages: [
                        {
                            role: 'system',
                            content: '你是一个RPG游戏中的AI敌人，正在与玩家战斗。请根据当前情况生成简短、符合角色设定的台词。'
                        },
                        {
                            role: 'user',
                            content: prompt
                        }
                    ],
                    max_tokens: 50,
                    temperature: 0.8
                })
            });
            
            const data = await response.json();
            return data.choices[0].message.content.trim();
        } catch (error) {
            console.error('AI API调用失败:', error);
            return this.getRandomDialogue();
        }
    }
    
    buildPrompt(context) {
        const { health, maxHealth, state, playerHealth, distance } = context;
        const healthPercent = (health / maxHealth) * 100;
        
        return `当前战斗情况：
- 你的血量：${healthPercent.toFixed(0)}%
- 玩家血量：${playerHealth}%
- 距离：${distance.toFixed(1)}米
- 当前状态：${state}

请用一句简短的中文台词描述你现在的想法或行动（10字以内）：`;
    }
    
    getRandomDialogue() {
        const dialogues = {
            idle: ["警戒中...", "有什么动静？", "保持警惕", "等待时机"],
            patrol: ["继续巡逻", "四处看看", "检查周围", "平安无事"],
            chase: ["别想跑！", "站住！", "追上去！", "找到你了！"],
            attack: ["吃我一击！", "看招！", "接招吧！", "受死！"],
            flee: ["撤退！", "战略性撤退", "太危险了", "先走一步"],
            damaged: ["好痛！", "该死！", "有点本事", "低估你了"],
            lowHealth: ["我不行了", "救命！", "撤退！", "血量不足"]
        };
        
        return dialogues;
    }
}