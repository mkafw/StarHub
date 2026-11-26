mod categories;
mod github;
mod mcp;

use categories::DEFAULT_CATEGORIES;
use clap::{Parser, Subcommand};
use github::{
    generate_creative_card, get_repo_details, get_starred_repos, search_github,
    try_get_cloud_tags, STARHUB_REPO_URL, STARHUB_WEB_URL,
};

#[derive(Parser, Debug)]
#[command(
    name = "starhub",
    author = "mkafw",
    version = "1.0.0",
    about = "StarHub 开源资产中枢与 GitHub 灵感挖掘 CLI / MCP Server (Pure Rust)"
)]
struct Cli {
    /// 运行为 Model Context Protocol (MCP) Stdio 服务端
    #[arg(long)]
    mcp: bool,

    #[command(subcommand)]
    command: Option<Commands>,
}

#[derive(Subcommand, Debug)]
enum Commands {
    /// 打印 StarHub Web 控制台与 GitHub 仓库入口
    Web,

    /// 检索或列出个人 GitHub Star 收藏素材库
    Stars {
        /// 过滤搜索关键词 (匹配名称、描述、话题或分类)
        query: Option<String>,

        /// 按 StarHub 预设分类过滤 (如: 文戏、武戏、系统编程、Web)
        #[arg(short = 'c', long)]
        category: Option<String>,

        /// 按编程语言过滤
        #[arg(short = 'l', long)]
        lang: Option<String>,

        /// 返回数量上限 (默认 30, 最大 300)
        #[arg(short = 'n', long, default_value_t = 30)]
        limit: usize,
    },

    /// 全网检索 GitHub 高星灵感与前沿开源项目
    Search {
        /// 搜索关键词或题材
        query: String,

        /// 限定编程语言 (例如: rust, typescript)
        #[arg(short = 'l', long)]
        lang: Option<String>,

        /// 最小 Star 阈值 (默认 100)
        #[arg(short = 's', long, default_value_t = 100)]
        min_stars: u64,

        /// 返回数量上限 (默认 10)
        #[arg(short = 'n', long, default_value_t = 10)]
        limit: usize,
    },

    /// 列出 StarHub 23 个预设智能分类体系
    Categories,

    /// 读取 StarHub Cloudflare D1 云端自定义标签
    Tags,

    /// 为指定开源项目生成四级清洗创作素材卡片
    Card {
        /// 仓库标识符 (owner/repo)
        repo: String,

        /// 保存 Markdown 素材卡片到指定文件路径
        #[arg(short = 'o', long)]
        output: Option<String>,
    },

    /// 获取指定仓库的详细指标与 README 摘要
    Info {
        /// 仓库标识符 (owner/repo)
        repo: String,
    },
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let cli = Cli::parse();

    // MCP 模式: 日志输出到 stderr，stdin/stdout 纯净 JSON-RPC 2.0 通信
    if cli.mcp {
        tracing_subscriber::fmt()
            .with_env_filter(
                tracing_subscriber::EnvFilter::from_default_env()
                    .add_directive(tracing::Level::INFO.into()),
            )
            .with_writer(std::io::stderr)
            .init();
        return mcp::run_stdio_mcp().await;
    }

    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::from_default_env()
                .add_directive(tracing::Level::WARN.into()),
        )
        .init();

    match cli.command {
        Some(Commands::Web) => {
            println!("\n🌟 StarHub 智能控制台: {}", STARHUB_WEB_URL);
            println!("🔗 GitHub 官方仓库: {}", STARHUB_REPO_URL);
            println!("⚡ 纯 Rust 极速驱动，支持 CLI 命令行、Cloudflare D1 云同步与 MCP 大模型协同\n");
        }
        Some(Commands::Categories) => {
            println!("🏷️ StarHub 预设分类体系 ({} 类):\n", DEFAULT_CATEGORIES.len());
            for (i, c) in DEFAULT_CATEGORIES.iter().enumerate() {
                println!(
                    "{:2}. {} {} ({}) — {}",
                    i + 1,
                    c.emoji,
                    c.name,
                    c.name_en,
                    c.description
                );
            }
        }
        Some(Commands::Tags) => match try_get_cloud_tags() {
            Ok(tags) => println!("{}", serde_json::to_string_pretty(&tags)?),
            Err(e) => eprintln!("❌ 读取 StarHub D1 云端标签失败: {}", e),
        },
        Some(Commands::Stars {
            query,
            category,
            lang,
            limit,
        }) => {
            let q = query.unwrap_or_default();
            println!("🔍 正在检索个人 GitHub Star 收藏素材库 (Limit: {})...", limit);
            match get_starred_repos(&q, category.as_deref(), lang.as_deref(), limit) {
                Ok(items) => {
                    println!("✨ 找到 {} 个星标项目:\n", items.len());
                    for (i, it) in items.iter().enumerate() {
                        let name = it["name"].as_str().unwrap_or("");
                        let stars = it["stars"].as_u64().unwrap_or(0);
                        let r_lang = it["lang"].as_str().unwrap_or("N/A");
                        let desc = it["desc"].as_str().unwrap_or("无描述");
                        let url = it["url"].as_str().unwrap_or("");
                        let cats = it["matched_categories"]
                            .as_array()
                            .map(|arr| {
                                arr.iter()
                                    .filter_map(|t| t.as_str())
                                    .collect::<Vec<_>>()
                                    .join(" | ")
                            })
                            .unwrap_or_default();
                        let topics = it["topics"]
                            .as_array()
                            .map(|arr| {
                                arr.iter()
                                    .filter_map(|t| t.as_str())
                                    .collect::<Vec<_>>()
                                    .join(", ")
                            })
                            .unwrap_or_default();

                        println!("{}. 📦 [{}]({}) ★ {} [{}]", i + 1, name, url, stars, r_lang);
                        println!("   💡 {}", desc);
                        if !cats.is_empty() {
                            println!("   🗂️ StarHub 分类: {}", cats);
                        }
                        if !topics.is_empty() {
                            println!("   🏷️ Topics: {}", topics);
                        }
                        println!();
                    }
                }
                Err(e) => eprintln!("❌ 检索个人 Star 失败: {}", e),
            }
        }
        Some(Commands::Search {
            query,
            lang,
            min_stars,
            limit,
        }) => {
            println!(
                "🌐 正在全网检索 GitHub 灵感素材: '{}' (min_stars: {}, limit: {})...",
                query, min_stars, limit
            );
            match search_github(&query, lang.as_deref(), Some(min_stars), limit) {
                Ok(repos) => {
                    println!("✨ 检索完成，共推荐 {} 个高价值项目:\n", repos.len());
                    for (i, r) in repos.iter().enumerate() {
                        let name = r["fullName"].as_str().unwrap_or("");
                        let stars = r["stargazersCount"].as_u64().unwrap_or(0);
                        let desc = r["description"].as_str().unwrap_or("无描述");
                        let url = r["url"].as_str().unwrap_or("");
                        let updated = r["updatedAt"].as_str().unwrap_or("");
                        let date = if updated.len() >= 10 { &updated[..10] } else { updated };
                        let cats = r["matched_categories"]
                            .as_array()
                            .map(|arr| {
                                arr.iter()
                                    .filter_map(|t| t.as_str())
                                    .collect::<Vec<_>>()
                                    .join(" | ")
                            })
                            .unwrap_or_default();

                        println!("{}. 🚀 [{}]({}) ★ {} (更新于 {})", i + 1, name, url, stars, date);
                        println!("   📖 功能: {}", desc);
                        if !cats.is_empty() {
                            println!("   🗂️ 分类: {}", cats);
                        }
                        println!("   📥 生成素材卡: starhub card {}", name);
                        println!();
                    }
                }
                Err(e) => eprintln!("❌ 全网检索失败: {}", e),
            }
        }
        Some(Commands::Card { repo, output }) => {
            println!("🔬 正在为 [{}] 提取生成四级清洗创作素材卡片...", repo);
            match generate_creative_card(&repo) {
                Ok(card) => {
                    println!("\n{}\n", card);
                    if let Some(out_path) = output {
                        if let Err(e) = std::fs::write(&out_path, &card) {
                            eprintln!("❌ 保存素材卡片失败: {}", e);
                        } else {
                            println!("💾 素材卡片已保存至: {}", out_path);
                        }
                    }
                }
                Err(e) => eprintln!("❌ 生成素材卡片失败: {}", e),
            }
        }
        Some(Commands::Info { repo }) => {
            println!("🔍 正在获取 [{}] 详细信息...", repo);
            match get_repo_details(&repo) {
                Ok(details) => println!("\n{}", serde_json::to_string_pretty(&details)?),
                Err(e) => eprintln!("❌ 获取仓库信息失败: {}", e),
            }
        }
        None => {
            println!("StarHub CLI & MCP Server (Pure Rust)");
            println!("运行 'starhub --help' 查看所有可用指令");
            println!("运行 'starhub --mcp' 启动 Model Context Protocol 服务端");
        }
    }

    Ok(())
}
