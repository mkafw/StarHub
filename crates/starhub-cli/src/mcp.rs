use crate::categories::DEFAULT_CATEGORIES;
use crate::github::{
    generate_creative_card, get_repo_details, get_starred_repos, resolve_repo_id,
    search_github, starhub_api, try_get_cloud_tags, DEFAULT_PROXY, STARHUB_API_BASE,
    STARHUB_LOCAL_PATH, STARHUB_REPO_URL, STARHUB_WEB_URL,
};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::time::{SystemTime, UNIX_EPOCH};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tracing::{info, warn};

fn tool_def(name: &str, desc: &str, props: Value, required: &[&str]) -> Value {
    json!({
        "name": name,
        "description": desc,
        "inputSchema": {
            "type": "object",
            "properties": props,
            "required": required,
        }
    })
}

fn all_tools() -> Value {
    json!([
        tool_def(
            "starhub_my_stars",
            "Search or list the user's GitHub starred repositories enriched with StarHub categories and D1 cloud tags",
            json!({
                "query": {"type": "string", "description": "Optional keyword matching name, description, topics, or StarHub category"},
                "category": {"type": "string", "description": "Optional StarHub category filter (e.g. '文戏', '武戏', '系统编程', 'Web 开发', '数据科学')"},
                "language": {"type": "string", "description": "Optional programming language filter (e.g. 'Rust', 'TypeScript', 'Vue')"},
                "limit": {"type": "integer", "description": "Maximum repositories to return (default 30, max 300)"}
            }),
            &[]
        ),
        tool_def(
            "starhub_search",
            "Search global GitHub repositories for trending tools, architectures, and inspiration with auto-category matching",
            json!({
                "query": {"type": "string", "description": "Search keyword or topic"},
                "language": {"type": "string", "description": "Optional programming language filter (e.g. rust, typescript)"},
                "min_stars": {"type": "integer", "description": "Minimum star threshold (default 100)"},
                "limit": {"type": "integer", "description": "Maximum number of repositories to return (default 10, max 50)"}
            }),
            &["query"]
        ),
        tool_def(
            "starhub_categories",
            "List StarHub's 23 preset categories (including AI short-drama & systems categories) and optionally count matching starred repos",
            json!({
                "include_counts": {"type": "boolean", "description": "If true, scans starred repos (up to 100) and attaches matching repo lists per category (default false)"}
            }),
            &[]
        ),
        tool_def(
            "starhub_cloud_tags",
            "Read or manage custom cloud tags stored in StarHub's Cloudflare D1 backend (https://stars.qilong.us.ci/api/tags)",
            json!({
                "action": {
                    "type": "string",
                    "enum": ["list", "create", "delete", "tag_repo", "untag_repo"],
                    "description": "Operation to perform against StarHub D1 cloud tags"
                },
                "tag_id": {"type": "string", "description": "Tag ID (required for delete, tag_repo, untag_repo)"},
                "name": {"type": "string", "description": "Tag name (required for create)"},
                "emoji": {"type": "string", "description": "Tag emoji (optional for create, default '🏷️')"},
                "color": {"type": "string", "description": "Tag hex color (optional for create, default '#409eff')"},
                "repo": {"type": "string", "description": "Repository 'owner/repo' or numeric repo ID (required for tag_repo, untag_repo)"}
            }),
            &["action"]
        ),
        tool_def(
            "starhub_repo_card",
            "Generate a 4-level de-toxified creative nutrition card from any GitHub repository for story writing, system architecture, or drama pipelines",
            json!({
                "repo": {"type": "string", "description": "Repository identifier in 'owner/repo' format (e.g. 'mkafw/StarHub')"},
                "output_file": {"type": "string", "description": "Optional file path to save the generated markdown card"}
            }),
            &["repo"]
        ),
        tool_def(
            "starhub_repo_info",
            "Fetch full repository metadata (ID, stars, forks, license, topics, StarHub categories, D1 cloud tags, README preview)",
            json!({
                "repo": {"type": "string", "description": "Repository identifier in 'owner/repo' format"}
            }),
            &["repo"]
        ),
        tool_def(
            "starhub_console_info",
            "Get StarHub web console URL, GitHub repository, local project path, and live Cloudflare D1 sync health",
            json!({}),
            &[]
        ),
    ])
}

fn text_content(text: &str) -> Vec<Value> {
    vec![json!({"type": "text", "text": text})]
}

pub async fn run_stdio_mcp() -> Result<(), Box<dyn std::error::Error>> {
    info!("StarHub MCP server starting on stdio");

    let stdin = BufReader::new(tokio::io::stdin());
    let mut stdout = tokio::io::stdout();
    let mut lines = stdin.lines();

    while let Ok(Some(line)) = lines.next_line().await {
        let line = line.trim().to_string();
        if line.is_empty() {
            continue;
        }

        let req: Value = match serde_json::from_str(&line) {
            Ok(v) => v,
            Err(e) => {
                warn!("Invalid JSON on stdin: {}", e);
                continue;
            }
        };

        // Notifications (no id) -> never reply
        let id = match req.get("id") {
            Some(id) => id.clone(),
            None => continue,
        };

        let method = req["method"].as_str().unwrap_or("");
        let params = req.get("params").cloned().unwrap_or(json!({}));

        let response = match method {
            "initialize" => json!({
                "jsonrpc": "2.0",
                "id": id,
                "result": {
                    "protocolVersion": "2024-11-05",
                    "capabilities": { "tools": {} },
                    "serverInfo": {
                        "name": "starhub",
                        "version": "1.0.0"
                    }
                }
            }),
            "tools/list" => json!({
                "jsonrpc": "2.0",
                "id": id,
                "result": { "tools": all_tools() }
            }),
            "tools/call" => {
                let tool_name = params["name"].as_str().unwrap_or("");
                let args = params.get("arguments").cloned().unwrap_or(json!({}));
                let result = dispatch_tool(tool_name, &args).await;
                match result {
                    Ok(content) => json!({
                        "jsonrpc": "2.0",
                        "id": id,
                        "result": { "content": content }
                    }),
                    Err(e) => json!({
                        "jsonrpc": "2.0",
                        "id": id,
                        "result": {
                            "content": [{ "type": "text", "text": format!("Error: {}", e) }],
                            "isError": true
                        }
                    }),
                }
            }
            "ping" => json!({
                "jsonrpc": "2.0",
                "id": id,
                "result": {}
            }),
            _ => json!({
                "jsonrpc": "2.0",
                "id": id,
                "error": { "code": -32601, "message": format!("Method not found: {}", method) }
            }),
        };

        let mut out = serde_json::to_string(&response)?;
        out.push('\n');
        stdout.write_all(out.as_bytes()).await?;
        stdout.flush().await?;
    }

    info!("StarHub MCP stdin closed, shutting down");
    Ok(())
}

async fn dispatch_tool(name: &str, args: &Value) -> Result<Vec<Value>, String> {
    match name {
        "starhub_my_stars" => {
            let query = args.get("query").and_then(|v| v.as_str()).unwrap_or("");
            let category = args.get("category").and_then(|v| v.as_str());
            let language = args.get("language").and_then(|v| v.as_str());
            let limit = args.get("limit").and_then(|v| v.as_u64()).unwrap_or(30) as usize;
            let repos = get_starred_repos(query, category, language, limit)?;
            let text = serde_json::to_string_pretty(&repos)
                .map_err(|e| format!("Failed to serialize repos: {}", e))?;
            Ok(text_content(&text))
        }
        "starhub_search" => {
            let query = args["query"].as_str().ok_or("missing query")?;
            let lang = args.get("language").and_then(|v| v.as_str());
            let min_stars = args.get("min_stars").and_then(|v| v.as_u64()).or(Some(100));
            let limit = args.get("limit").and_then(|v| v.as_u64()).unwrap_or(10) as usize;
            let repos = search_github(query, lang, min_stars, limit)?;
            let text = serde_json::to_string_pretty(&repos)
                .map_err(|e| format!("Failed to serialize repos: {}", e))?;
            Ok(text_content(&text))
        }
        "starhub_categories" => {
            let include_counts = args
                .get("include_counts")
                .and_then(|v| v.as_bool())
                .unwrap_or(false);

            let mut by_cat: HashMap<String, Vec<String>> = HashMap::new();
            if include_counts {
                let repos = get_starred_repos("", None, None, 100)?;
                for r in repos {
                    let rname = r["name"].as_str().unwrap_or("").to_string();
                    if let Some(cats) = r["matched_categories"].as_array() {
                        for c in cats {
                            if let Some(cs) = c.as_str() {
                                by_cat.entry(cs.to_string()).or_default().push(rname.clone());
                            }
                        }
                    }
                }
            }

            let list: Vec<Value> = DEFAULT_CATEGORIES
                .iter()
                .map(|c| {
                    let label = format!("{} {}", c.emoji, c.name);
                    let mut obj = json!({
                        "name": c.name,
                        "name_en": c.name_en,
                        "emoji": c.emoji,
                        "description": c.description,
                        "keywords": c.keywords,
                    });
                    if include_counts {
                        let matched_repos = by_cat.get(&label).cloned().unwrap_or_default();
                        if let Some(m) = obj.as_object_mut() {
                            m.insert("matched_count".to_string(), json!(matched_repos.len()));
                            m.insert("matched_repos".to_string(), json!(matched_repos));
                        }
                    }
                    obj
                })
                .collect();

            Ok(text_content(&serde_json::to_string_pretty(&list).unwrap()))
        }
        "starhub_cloud_tags" => {
            let action = args["action"].as_str().ok_or("missing action")?;
            match action {
                "list" => {
                    let tags = try_get_cloud_tags()?;
                    Ok(text_content(&serde_json::to_string_pretty(&tags).unwrap()))
                }
                "create" => {
                    let name = args["name"].as_str().ok_or("missing name")?;
                    let emoji = args.get("emoji").and_then(|v| v.as_str()).unwrap_or("🏷️");
                    let color = args.get("color").and_then(|v| v.as_str()).unwrap_or("#409eff");
                    let now_ms = SystemTime::now()
                        .duration_since(UNIX_EPOCH)
                        .unwrap_or_default()
                        .as_millis() as u64;
                    let id = format!("tag_{}", now_ms);
                    let body = json!({
                        "id": id,
                        "name": name,
                        "emoji": emoji,
                        "color": color,
                        "createdAt": now_ms,
                        "updatedAt": now_ms,
                    });
                    let res = starhub_api("POST", "/api/tags", Some(&body))?;
                    Ok(text_content(
                        &serde_json::to_string_pretty(&json!({"id": id, "response": res})).unwrap(),
                    ))
                }
                "delete" => {
                    let tag_id = args["tag_id"].as_str().ok_or("missing tag_id")?;
                    let res = starhub_api("DELETE", &format!("/api/tags?id={}", tag_id), None)?;
                    Ok(text_content(&serde_json::to_string_pretty(&res).unwrap()))
                }
                "tag_repo" => {
                    let tag_id = args["tag_id"].as_str().ok_or("missing tag_id")?;
                    let repo = args["repo"].as_str().ok_or("missing repo")?;
                    let repo_id = resolve_repo_id(repo)?;
                    let body = json!({ "repoId": repo_id, "tagId": tag_id });
                    let res = starhub_api("POST", "/api/repoTags", Some(&body))?;
                    Ok(text_content(
                        &serde_json::to_string_pretty(&json!({"repoId": repo_id, "tagId": tag_id, "response": res})).unwrap(),
                    ))
                }
                "untag_repo" => {
                    let tag_id = args["tag_id"].as_str().ok_or("missing tag_id")?;
                    let repo = args["repo"].as_str().ok_or("missing repo")?;
                    let repo_id = resolve_repo_id(repo)?;
                    let res = starhub_api(
                        "DELETE",
                        &format!("/api/repoTags?repoId={}&tagId={}", repo_id, tag_id),
                        None,
                    )?;
                    Ok(text_content(&serde_json::to_string_pretty(&res).unwrap()))
                }
                _ => Err(format!("Unsupported action: {}", action)),
            }
        }
        "starhub_repo_card" => {
            let repo = args["repo"].as_str().ok_or("missing repo")?;
            let card = generate_creative_card(repo)?;
            if let Some(out_path) = args.get("output_file").and_then(|v| v.as_str()) {
                if !out_path.is_empty() {
                    let _ = std::fs::write(out_path, &card);
                }
            }
            Ok(text_content(&card))
        }
        "starhub_repo_info" => {
            let repo = args["repo"].as_str().ok_or("missing repo")?;
            let details = get_repo_details(repo)?;
            let text = serde_json::to_string_pretty(&details)
                .map_err(|e| format!("Failed to serialize details: {}", e))?;
            Ok(text_content(&text))
        }
        "starhub_console_info" => {
            let d1_status = match try_get_cloud_tags() {
                Ok(tags) => format!("connected ({} cloud tags)", tags.len()),
                Err(e) => format!("offline ({})", e),
            };
            let info = json!({
                "starhub_web_url": STARHUB_WEB_URL,
                "starhub_api_base": STARHUB_API_BASE,
                "starhub_github_repo": STARHUB_REPO_URL,
                "local_repo_path": STARHUB_LOCAL_PATH,
                "d1_cloud_status": d1_status,
                "preset_categories_count": DEFAULT_CATEGORIES.len(),
                "proxy": DEFAULT_PROXY,
            });
            Ok(text_content(&serde_json::to_string_pretty(&info).unwrap()))
        }
        _ => Err(format!("Unknown tool: {}", name)),
    }
}
