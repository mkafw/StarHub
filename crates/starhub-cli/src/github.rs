use crate::categories::match_categories;
use serde_json::{json, Value};
use std::collections::HashMap;
use std::process::Command;

pub const STARHUB_WEB_URL: &str = "https://stars.qilong.us.ci/#/home";
pub const STARHUB_API_BASE: &str = "https://stars.qilong.us.ci";
pub const STARHUB_REPO_URL: &str = "https://github.com/mkafw/StarHub";
pub const STARHUB_LOCAL_PATH: &str = "/home/daoxuan/Projects/StarHub";
pub const DEFAULT_PROXY: &str = "http://127.0.0.1:3067";

/// Run a subprocess with proxy env fallback when HTTPS_PROXY isn't explicitly set.
fn run_cmd_with_proxy(program: &str, args: &[&str]) -> Result<String, String> {
    let mut cmd = Command::new(program);
    cmd.args(args);

    if std::env::var("HTTPS_PROXY").is_err() && std::env::var("https_proxy").is_err() {
        cmd.env("HTTPS_PROXY", DEFAULT_PROXY)
            .env("HTTP_PROXY", DEFAULT_PROXY)
            .env(
                "ALL_PROXY",
                format!("socks5h://{}", DEFAULT_PROXY.trim_start_matches("http://")),
            );
    }

    let output = cmd
        .output()
        .map_err(|e| format!("Failed to execute {}: {}", program, e))?;

    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();

    if !output.status.success() {
        return Err(if !stderr.is_empty() {
            stderr
        } else {
            format!("{} exited with code {:?}", program, output.status.code())
        });
    }

    Ok(stdout)
}

/// Run a `gh` command with appropriate proxy environment.
pub fn run_gh(args: &[&str]) -> Result<String, String> {
    run_cmd_with_proxy("gh", args)
}

/// Retrieve current GitHub auth token from `gh auth token` (or GITHUB_TOKEN env).
pub fn get_gh_token() -> Result<String, String> {
    if let Ok(tok) = std::env::var("GITHUB_TOKEN") {
        if !tok.trim().is_empty() {
            return Ok(tok.trim().to_string());
        }
    }
    let tok = run_gh(&["auth", "token"])?;
    if tok.is_empty() {
        return Err("Empty GitHub token from `gh auth token`".to_string());
    }
    Ok(tok)
}

/// Call StarHub's live Cloudflare Worker D1 API (`/api/*`).
pub fn starhub_api(method: &str, path: &str, body_json: Option<&Value>) -> Result<Value, String> {
    let token = get_gh_token()?;
    let url = format!("{}{}", STARHUB_API_BASE, path);
    let auth_header = format!("Authorization: Bearer {}", token);

    let mut args = vec![
        "-sS",
        "--connect-timeout",
        "3",
        "--max-time",
        "8",
        "-X",
        method,
        "-H",
        &auth_header,
        "-H",
        "Content-Type: application/json",
    ];

    let body_str;
    if let Some(b) = body_json {
        body_str = b.to_string();
        args.push("-d");
        args.push(&body_str);
    }
    args.push(&url);

    let out = run_cmd_with_proxy("curl", &args)?;
    if out.is_empty() {
        return Ok(json!({ "ok": true }));
    }
    serde_json::from_str::<Value>(&out)
        .map_err(|e| format!("Invalid JSON from StarHub API ({}): {} | raw={}", path, e, out))
}

/// Fetch cloud tags from StarHub D1 backend.
pub fn try_get_cloud_tags() -> Result<Vec<Value>, String> {
    let val = starhub_api("GET", "/api/tags", None)?;
    Ok(val.as_array().cloned().unwrap_or_default())
}

/// Decode Base64 string to UTF-8 text (pure Rust, zero external crates).
pub fn decode_base64(input: &str) -> Option<String> {
    let clean: String = input.chars().filter(|c| !c.is_whitespace()).collect();
    let b = clean.as_bytes();
    let mut out = Vec::with_capacity(b.len() * 3 / 4);

    let val = |c: u8| -> Option<u8> {
        match c {
            b'A'..=b'Z' => Some(c - b'A'),
            b'a'..=b'z' => Some(c - b'a' + 26),
            b'0'..=b'9' => Some(c - b'0' + 52),
            b'+' => Some(62),
            b'/' => Some(63),
            b'=' => Some(0),
            _ => None,
        }
    };

    for chunk in b.chunks(4) {
        if chunk.len() < 2 {
            break;
        }
        let c0 = val(chunk[0])?;
        let c1 = val(chunk[1])?;
        out.push((c0 << 2) | (c1 >> 4));

        if chunk.len() > 2 && chunk[2] != b'=' {
            let c2 = val(chunk[2])?;
            out.push((c1 << 4) | (c2 >> 2));
            if chunk.len() > 3 && chunk[3] != b'=' {
                let c3 = val(chunk[3])?;
                out.push((c2 << 6) | c3);
            }
        }
    }
    String::from_utf8(out).ok()
}

fn build_cloud_tag_index() -> HashMap<u64, Vec<String>> {
    let mut index: HashMap<u64, Vec<String>> = HashMap::new();
    if let Ok(tags) = try_get_cloud_tags() {
        for tag in tags {
            let label = format!(
                "{} {}",
                tag["emoji"].as_str().unwrap_or("🏷️"),
                tag["name"].as_str().unwrap_or("")
            )
            .trim()
            .to_string();
            if let Some(repos) = tag["repos"].as_array() {
                for r in repos {
                    if let Some(rid) = r.as_u64() {
                        index.entry(rid).or_default().push(label.clone());
                    }
                }
            }
        }
    }
    index
}

fn enrich_repo_categories(v: &mut Value, cloud_index: Option<&HashMap<u64, Vec<String>>>) {
    let name = v["name"]
        .as_str()
        .or_else(|| v["fullName"].as_str())
        .unwrap_or("")
        .to_string();
    let desc = v["desc"]
        .as_str()
        .or_else(|| v["description"].as_str())
        .unwrap_or("")
        .to_string();
    let lang = v["lang"]
        .as_str()
        .or_else(|| v["language"].as_str())
        .unwrap_or("")
        .to_string();
    let topics: Vec<String> = v["topics"]
        .as_array()
        .map(|arr| {
            arr.iter()
                .filter_map(|t| t.as_str().map(|s| s.to_string()))
                .collect()
        })
        .unwrap_or_default();

    let cats = match_categories(&name, &desc, &lang, &topics);
    let repo_id = v["id"].as_u64();

    if let Some(obj) = v.as_object_mut() {
        obj.insert("matched_categories".to_string(), json!(cats));
        if let (Some(idx), Some(rid)) = (cloud_index, repo_id) {
            if let Some(ctags) = idx.get(&rid) {
                obj.insert("cloud_tags".to_string(), json!(ctags));
            }
        }
    }
}

/// Fetch personal starred repos (up to `limit`, max 300), enriched with StarHub categories & cloud tags.
pub fn get_starred_repos(
    query: &str,
    category: Option<&str>,
    language: Option<&str>,
    limit: usize,
) -> Result<Vec<Value>, String> {
    let target = limit.max(1).min(300);
    let jq_filter = ".[] | {id: .id, name: .full_name, stars: .stargazers_count, desc: .description, lang: .language, topics: .topics, url: .html_url}";

    let mut all_raw = Vec::new();
    let pages = ((target + 99) / 100).max(1).min(3);

    for page in 1..=pages {
        let per_page = if page < pages { 100 } else { target - (pages - 1) * 100 }.min(100);
        let fetch_count = if !query.is_empty() || category.is_some() || language.is_some() {
            100
        } else {
            per_page
        };
        let raw = run_gh(&[
            "api",
            &format!("user/starred?per_page={}&page={}", fetch_count, page),
            "--jq",
            jq_filter,
        ])?;
        if raw.is_empty() {
            break;
        }
        let line_count = raw.lines().count();
        all_raw.push(raw);
        if line_count < fetch_count {
            break;
        }
    }

    let cloud_index = build_cloud_tag_index();
    let q_lower = query.trim().to_lowercase();
    let cat_lower = category.unwrap_or("").trim().to_lowercase();
    let lang_lower = language.unwrap_or("").trim().to_lowercase();

    let mut items = Vec::new();
    for raw_page in all_raw {
        for line in raw_page.lines() {
            let line = line.trim();
            if line.is_empty() {
                continue;
            }
            if let Ok(mut v) = serde_json::from_str::<Value>(line) {
                enrich_repo_categories(&mut v, Some(&cloud_index));

                if !lang_lower.is_empty() {
                    let r_lang = v["lang"].as_str().unwrap_or("").to_lowercase();
                    if r_lang != lang_lower {
                        continue;
                    }
                }

                if !cat_lower.is_empty() {
                    let cat_match = v["matched_categories"]
                        .as_array()
                        .map(|arr| {
                            arr.iter().any(|c| {
                                c.as_str()
                                    .unwrap_or("")
                                    .to_lowercase()
                                    .contains(&cat_lower)
                            })
                        })
                        .unwrap_or(false)
                        || v["cloud_tags"]
                            .as_array()
                            .map(|arr| {
                                arr.iter().any(|c| {
                                    c.as_str()
                                        .unwrap_or("")
                                        .to_lowercase()
                                        .contains(&cat_lower)
                                })
                            })
                            .unwrap_or(false);
                    if !cat_match {
                        continue;
                    }
                }

                if !q_lower.is_empty() {
                    let name = v["name"].as_str().unwrap_or("").to_lowercase();
                    let desc = v["desc"].as_str().unwrap_or("").to_lowercase();
                    let topics_str = v["topics"]
                        .as_array()
                        .map(|arr| {
                            arr.iter()
                                .filter_map(|t| t.as_str().map(|s| s.to_lowercase()))
                                .collect::<Vec<_>>()
                                .join(" ")
                        })
                        .unwrap_or_default();
                    let cats_str = v["matched_categories"]
                        .as_array()
                        .map(|arr| {
                            arr.iter()
                                .filter_map(|t| t.as_str().map(|s| s.to_lowercase()))
                                .collect::<Vec<_>>()
                                .join(" ")
                        })
                        .unwrap_or_default();

                    if !name.contains(&q_lower)
                        && !desc.contains(&q_lower)
                        && !topics_str.contains(&q_lower)
                        && !cats_str.contains(&q_lower)
                    {
                        continue;
                    }
                }

                items.push(v);
                if items.len() >= target {
                    return Ok(items);
                }
            }
        }
    }

    Ok(items)
}

/// Search global GitHub repositories and tag them with StarHub categories.
pub fn search_github(
    query: &str,
    lang: Option<&str>,
    min_stars: Option<u64>,
    limit: usize,
) -> Result<Vec<Value>, String> {
    let mut parts = vec![query.to_string()];
    if let Some(s) = min_stars {
        parts.push(format!("stars:>={}", s));
    }
    if let Some(l) = lang {
        if !l.is_empty() {
            parts.push(format!("language:{}", l));
        }
    }

    let full_query = parts.join(" ");
    let limit_str = limit.max(1).min(50).to_string();

    let raw = run_gh(&[
        "search",
        "repos",
        &full_query,
        "--limit",
        &limit_str,
        "--json",
        "fullName,description,stargazersCount,url,language,updatedAt",
    ])?;

    let val: Value = serde_json::from_str(&raw)
        .map_err(|e| format!("Failed to parse GitHub search JSON: {}", e))?;

    let mut arr = val.as_array().cloned().unwrap_or_default();
    for item in &mut arr {
        enrich_repo_categories(item, None);
    }
    Ok(arr)
}

/// Fetch repository details and README preview.
pub fn get_repo_details(repo: &str) -> Result<Value, String> {
    let jq_meta = "{id: .id, name: .full_name, stars: .stargazers_count, forks: .forks_count, open_issues: .open_issues_count, desc: .description, lang: .language, topics: .topics, url: .html_url, created: .created_at, updated: .updated_at, license: .license.spdx_id, default_branch: .default_branch}";
    let raw_meta = run_gh(&["api", &format!("repos/{}", repo), "--jq", jq_meta])?;

    let mut meta: Value = serde_json::from_str(&raw_meta)
        .map_err(|e| format!("Failed to parse repo metadata: {}", e))?;

    let cloud_index = build_cloud_tag_index();
    enrich_repo_categories(&mut meta, Some(&cloud_index));

    let readme_res = run_gh(&[
        "api",
        &format!("repos/{}/readme", repo),
        "--jq",
        ".content",
    ]);

    let readme_text = match readme_res {
        Ok(b64) => decode_base64(&b64).unwrap_or_default(),
        Err(_) => String::new(),
    };

    if let Some(obj) = meta.as_object_mut() {
        let preview = if readme_text.chars().count() > 4000 {
            let idx = readme_text
                .char_indices()
                .nth(4000)
                .map(|(i, _)| i)
                .unwrap_or(readme_text.len());
            format!("{}...\n(truncated)", &readme_text[..idx])
        } else {
            readme_text
        };
        obj.insert("readme_preview".to_string(), Value::String(preview));
    }

    Ok(meta)
}

/// Resolve an `owner/repo` string (or numeric ID string) to numeric GitHub repo ID.
pub fn resolve_repo_id(repo_or_id: &str) -> Result<u64, String> {
    if let Ok(id) = repo_or_id.trim().parse::<u64>() {
        return Ok(id);
    }
    let out = run_gh(&["api", &format!("repos/{}", repo_or_id.trim()), "--jq", ".id"])?;
    out.trim()
        .parse::<u64>()
        .map_err(|e| format!("Failed to resolve numeric repo ID for {}: {}", repo_or_id, e))
}

/// Generate a 4-level creative nutrition card for a repo.
pub fn generate_creative_card(repo: &str) -> Result<String, String> {
    let details = get_repo_details(repo)?;

    let name = details["name"].as_str().unwrap_or(repo);
    let stars = details["stars"].as_u64().unwrap_or(0);
    let desc = details["desc"].as_str().unwrap_or("暂无描述");
    let lang = details["lang"].as_str().unwrap_or("通用");
    let license = details["license"].as_str().unwrap_or("Open Source");
    let url = details["url"].as_str().unwrap_or("");
    let topics: Vec<String> = details["topics"]
        .as_array()
        .map(|arr| {
            arr.iter()
                .filter_map(|v| v.as_str().map(|s| s.to_string()))
                .collect()
        })
        .unwrap_or_default();
    let topics_str = if topics.is_empty() {
        "暂无标签".to_string()
    } else {
        topics.join(", ")
    };

    let cats_str = details["matched_categories"]
        .as_array()
        .map(|arr| {
            arr.iter()
                .filter_map(|v| v.as_str())
                .collect::<Vec<_>>()
                .join(" | ")
        })
        .unwrap_or_else(|| "📦 其他".to_string());

    let readme = details["readme_preview"].as_str().unwrap_or("");
    let readme_snippet = if readme.chars().count() > 1000 {
        let idx = readme
            .char_indices()
            .nth(1000)
            .map(|(i, _)| i)
            .unwrap_or(readme.len());
        &readme[..idx]
    } else {
        readme
    };

    let card = format!(
        r#"# 📋 创作素材营养卡: [{name}]({url})
> 来源: [StarHub]({web_url}) × GitHub | 星标: ★ {stars} | 语言: {lang} | 协议: {license}
> **StarHub 智能分类**: {cats_str}

## 一、物理脱毒与事实核定 (Level 1)
- **项目定义**: {desc}
- **核心关键词**: {topics_str}
- **开源地址**: {url}

## 二、概念解耦与叙事点提炼 (Level 2)
- **核心技术核 / 故事钩子**: 该项目解决了什么根本痛点？有何反直觉设计或创新解法？
- **人设与阵营映射**:
  - 技术流派 / 工具属性: 可转化为剧本中的神兵利器、金手指外挂、禁忌科技或宗门阵法。
  - 开发者哲学: 模块化、极简主义、高并发、自托管或隐私优先的极客信仰。

## 三、逻辑拓扑与创作注入 (Level 3)
- **短剧/小说剧情挂钩**:
  - 【灵感切入点】: 作为主角的核心底牌、突破瓶颈的技术钥匙或反派的窃密目标。
  - 【冲突场景】: 算力枯竭、权限争夺、数据投毒或服务熔断崩盘时刻的绝地反击。

## 四、资产定帧与代码/架构精要 (Level 4)
```markdown
{readme_snippet}
```
---
*本卡片已由 StarHub 纯 Rust 引擎生成，可直接注入短剧大纲、分镜、长篇网文正文或系统架构设计方案。*"#,
        name = name,
        url = url,
        web_url = STARHUB_WEB_URL,
        stars = stars,
        lang = lang,
        license = license,
        cats_str = cats_str,
        desc = desc,
        topics_str = topics_str,
        readme_snippet = readme_snippet.trim()
    );

    Ok(card)
}
