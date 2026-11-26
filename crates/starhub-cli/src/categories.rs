//! Official StarHub preset categories mirrored verbatim from `src/config/categories.ts`.

use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct CategoryPreset {
    pub name: &'static str,
    pub name_en: &'static str,
    pub emoji: &'static str,
    pub description: &'static str,
    pub color: &'static str,
    pub keywords: &'static [&'static str],
}

pub const DEFAULT_CATEGORIES: &[CategoryPreset] = &[
    CategoryPreset {
        name: "文戏 · 配音字幕",
        name_en: "Civil: Voice & Subtitles",
        emoji: "🎙️",
        description: "AI 语音合成(TTS)、情感配音、口癖切除与双层字幕打轴",
        color: "#36cfc9",
        keywords: &["tts", "voice", "speech", "subtitles", "whisper", "sensevoice", "cosyvoice", "chattts", "audio", "srt", "cutcli"],
    },
    CategoryPreset {
        name: "武戏 · 运镜视效",
        name_en: "Action: Camera & VFX",
        emoji: "💥",
        description: "AI 视频生成、运镜控制、受力碰撞、粒子解构与冲击波视效",
        color: "#f5222d",
        keywords: &["video-generation", "video", "kling", "wan", "cogvideo", "hunyuanvideo", "comfyui", "camera", "vfx", "motion", "seedance"],
    },
    CategoryPreset {
        name: "视觉 · 角色锁脸",
        name_en: "Visual: Face Consistency",
        emoji: "🎭",
        description: "角色面部一致性、三视图骨相锁定、姿态控制与生图模型",
        color: "#722ed1",
        keywords: &["instantid", "faceid", "lora", "flux", "character", "consistency", "portrait", "ip-adapter", "photomaker"],
    },
    CategoryPreset {
        name: "后期 · 剪辑工程",
        name_en: "Post-Production: Editing",
        emoji: "✂️",
        description: "剪映草稿自动构建、FFmpeg 硬件编解码、多轨时间线与卡点成片",
        color: "#fa8c16",
        keywords: &["cutcli", "ffmpeg", "capcut", "draft", "jianying", "timeline", "montage", "video-editing", "render"],
    },
    CategoryPreset {
        name: "设定 · 灵感世界观",
        name_en: "World-Building & Lore",
        emoji: "📜",
        description: "短剧大纲、科学修仙设定、长篇网文外挂、情节钩子与故事图谱",
        color: "#1890ff",
        keywords: &["story", "drama", "screenplay", "prompt", "world-building", "lore", "fiction", "novel", "script", "graphify"],
    },
    CategoryPreset {
        name: "Web 开发",
        name_en: "Web Development",
        emoji: "🌐",
        description: "前端、后端、全栈 Web 应用和框架",
        color: "#42b883",
        keywords: &["web", "frontend", "backend", "react", "vue", "angular", "svelte", "next", "nuxt", "express", "koa", "fastify", "nestjs"],
    },
    CategoryPreset {
        name: "移动开发",
        name_en: "Mobile Development",
        emoji: "📱",
        description: "iOS、Android、跨平台移动应用",
        color: "#34a853",
        keywords: &["mobile", "android", "ios", "react-native", "flutter", "swift", "kotlin", "xamarin", "harmonyos", "hdc", "scrcpy"],
    },
    CategoryPreset {
        name: "数据科学",
        name_en: "Data Science",
        emoji: "🤖",
        description: "机器学习、深度学习、数据分析",
        color: "#ff9800",
        keywords: &["machine-learning", "ml", "ai", "deep-learning", "tensorflow", "pytorch", "pandas", "numpy", "data", "analytics", "llm", "agent", "mcp"],
    },
    CategoryPreset {
        name: "工具库",
        name_en: "Tools & Libraries",
        emoji: "🛠️",
        description: "通用工具、库、框架",
        color: "#9c27b0",
        keywords: &["library", "framework", "util", "helper", "tool", "sdk", "api", "cli"],
    },
    CategoryPreset {
        name: "DevOps",
        name_en: "DevOps",
        emoji: "⚙️",
        description: "CI/CD、容器化、基础设施",
        color: "#00bcd4",
        keywords: &["devops", "docker", "kubernetes", "k8s", "ci", "cd", "deploy", "infrastructure", "terraform", "ansible"],
    },
    CategoryPreset {
        name: "游戏开发",
        name_en: "Game Development",
        emoji: "🎮",
        description: "游戏引擎、游戏相关工具",
        color: "#f44336",
        keywords: &["game", "gaming", "unity", "unreal", "godot", "phaser", "cocos"],
    },
    CategoryPreset {
        name: "数据库",
        name_en: "Database",
        emoji: "💾",
        description: "数据库系统、ORM、数据存储",
        color: "#ff5722",
        keywords: &["database", "sql", "nosql", "mongodb", "postgres", "mysql", "redis", "orm", "prisma", "sqlite", "d1"],
    },
    CategoryPreset {
        name: "安全",
        name_en: "Security",
        emoji: "🔒",
        description: "网络安全、加密、认证",
        color: "#e91e63",
        keywords: &["security", "crypto", "encryption", "auth", "oauth", "jwt", "vulnerability"],
    },
    CategoryPreset {
        name: "区块链",
        name_en: "Blockchain",
        emoji: "⛓️",
        description: "加密货币、智能合约、Web3",
        color: "#ffc107",
        keywords: &["blockchain", "crypto", "bitcoin", "ethereum", "web3", "smart-contract", "defi", "nft"],
    },
    CategoryPreset {
        name: "编程语言",
        name_en: "Programming Language",
        emoji: "💻",
        description: "编译器、解释器、语言工具",
        color: "#3f51b5",
        keywords: &["compiler", "interpreter", "language", "parser", "transpiler", "babel"],
    },
    CategoryPreset {
        name: "系统编程",
        name_en: "Systems Programming",
        emoji: "⚡",
        description: "操作系统、底层开发",
        color: "#607d8b",
        keywords: &["system", "os", "kernel", "driver", "embedded", "low-level", "c", "rust", "assembly", "wayland", "hyprland"],
    },
    CategoryPreset {
        name: "设计",
        name_en: "Design",
        emoji: "🎨",
        description: "UI/UX、设计工具、图形处理",
        color: "#e91e63",
        keywords: &["design", "ui", "ux", "figma", "sketch", "graphics", "animation", "svg"],
    },
    CategoryPreset {
        name: "文档",
        name_en: "Documentation",
        emoji: "📚",
        description: "文档生成、知识管理",
        color: "#795548",
        keywords: &["documentation", "docs", "markdown", "wiki", "knowledge", "readme"],
    },
    CategoryPreset {
        name: "测试",
        name_en: "Testing",
        emoji: "🧪",
        description: "测试框架、自动化测试",
        color: "#4caf50",
        keywords: &["test", "testing", "jest", "mocha", "cypress", "selenium", "automation", "e2e"],
    },
    CategoryPreset {
        name: "Awesome",
        name_en: "Awesome",
        emoji: "😎",
        description: "精选资源列表",
        color: "#ff6b6b",
        keywords: &["awesome", "curated", "list", "resources", "collection"],
    },
    CategoryPreset {
        name: "Node.js",
        name_en: "Node.js",
        emoji: "🟢",
        description: "Node.js 生态系统",
        color: "#339933",
        keywords: &["nodejs", "node", "npm", "javascript", "server"],
    },
    CategoryPreset {
        name: "Vue",
        name_en: "Vue",
        emoji: "🟩",
        description: "Vue 生态系统",
        color: "#42b883",
        keywords: &["vue", "vuejs", "composition-api", "vuex", "pinia", "vite", "nuxt"],
    },
    CategoryPreset {
        name: "其他",
        name_en: "Others",
        emoji: "📦",
        description: "不属于以上任何类别",
        color: "#9e9e9e",
        keywords: &[],
    },
];

/// Match repository metadata against StarHub preset categories using keyword heuristics.
pub fn match_categories(name: &str, desc: &str, lang: &str, topics: &[String]) -> Vec<String> {
    let haystack = format!(
        "{} {} {} {}",
        name.to_lowercase(),
        desc.to_lowercase(),
        lang.to_lowercase(),
        topics.join(" ").to_lowercase()
    );

    let tokens: Vec<&str> = haystack
        .split(|c: char| !c.is_alphanumeric() && c != '-' && c != '_')
        .filter(|s| !s.is_empty())
        .collect();

    let mut matched = Vec::new();
    for cat in DEFAULT_CATEGORIES {
        if cat.keywords.is_empty() {
            continue;
        }
        let hit = cat.keywords.iter().any(|&kw| {
            if kw.len() <= 2 {
                tokens.contains(&kw)
            } else {
                haystack.contains(kw)
            }
        });
        if hit {
            matched.push(format!("{} {}", cat.emoji, cat.name));
        }
    }

    if matched.is_empty() {
        matched.push("📦 其他".to_string());
    }
    matched
}
