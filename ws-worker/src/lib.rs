use futures::StreamExt;
use serde::{Deserialize, Serialize};
use worker::*;

// ── Message Types ───────────────────────────────────────────

#[derive(Deserialize)]
struct ClientMessage {
    #[serde(rename = "type")]
    msg_type: String,
    payload: Option<serde_json::Value>,
}

#[derive(Serialize)]
struct ServerMessage<'a> {
    #[serde(rename = "type")]
    msg_type: &'a str,
    payload: serde_json::Value,
}

// ── Entrypoint ──────────────────────────────────────────────

#[event(fetch)]
pub async fn main(req: Request, env: Env, ctx: Context) -> Result<Response> {
    let upgrade = req.headers().get("Upgrade")?.unwrap_or_default();
    if upgrade.to_lowercase() != "websocket" {
        return Response::error("Expected WebSocket upgrade", 400);
    }

    let pair = WebSocketPair::new()?;
    let server = pair.server;
    server.accept()?;

    let srv = server.clone();
    let env_clone = env.clone();

    ctx.wait_until(async move {
        if let Err(e) = handle_websocket(srv, env_clone).await {
            console_error!("WebSocket handler error: {:?}", e);
        }
    });

    Response::from_websocket(pair.client)
}

// ── WebSocket Event Loop ────────────────────────────────────

async fn handle_websocket(ws: WebSocket, env: Env) -> Result<()> {
    let mut stream = ws.events()?;

    while let Some(event) = stream.next().await {
        match event {
            WebsocketEvent::Message(msg) => {
                if let Some(text) = msg.text() {
                    if let Ok(client_msg) = serde_json::from_str::<ClientMessage>(&text) {
                        dispatch(&ws, &env, &client_msg).await;
                    } else {
                        let err = ServerMessage {
                            msg_type: "error",
                            payload: serde_json::json!({"detail": "invalid JSON"}),
                        };
                        send_json(&ws, &err).await;
                    }
                }
            }
            WebsocketEvent::Close(_) => {
                console_log!("ws: client disconnected");
                break;
            }
        }
    }

    let _ = ws.close(None, None);
    Ok(())
}

// ── Message Router ──────────────────────────────────────────

async fn dispatch(ws: &WebSocket, env: &Env, msg: &ClientMessage) {
    match msg.msg_type.as_str() {
        "ping" => {
            let resp = ServerMessage {
                msg_type: "pong",
                payload: serde_json::json!({}),
            };
            send_json(ws, &resp).await;
        }

        "subscribe:sync" | "subscribe:classify" => {
            console_log!("ws: subscribed to {}", msg.msg_type);
            let resp = ServerMessage {
                msg_type: "subscribed",
                payload: serde_json::json!({"channel": msg.msg_type.replace("subscribe:", "")}),
            };
            send_json(ws, &resp).await;
        }

        // ── Semantic Search ────────────────────────────────
        // Client sends: { type: "search:embed", payload: { text: "..." } }
        // Returns:      { type: "search:embed:result", payload: { vector: [...] } }
        "search:embed" => {
            let text = msg.payload
                .as_ref()
                .and_then(|p| p.get("text"))
                .and_then(|v| v.as_str())
                .unwrap_or("");

            if text.is_empty() {
                let err = ServerMessage {
                    msg_type: "error",
                    payload: serde_json::json!({"detail": "text is required"}),
                };
                send_json(ws, &err).await;
                return;
            }

            match generate_embedding(env, text).await {
                Ok(vector) => {
                    let resp = ServerMessage {
                        msg_type: "search:embed:result",
                        payload: serde_json::json!({ "vector": vector }),
                    };
                    send_json(ws, &resp).await;
                }
                Err(e) => {
                    let err = ServerMessage {
                        msg_type: "error",
                        payload: serde_json::json!({"detail": format!("embedding failed: {}", e)}),
                    };
                    send_json(ws, &err).await;
                }
            }
        }

        // Client sends: { type: "repo:classify", payload: { repo: {...} } }
        // Returns:      { type: "repo:classify:result", payload: { category: "junk|tool|...", reason: "..." } }
        "repo:classify" => {
            let repo = msg.payload.as_ref().and_then(|p| p.get("repo"));
            match repo {
                Some(r) => match classify_repo(env, r).await {
                    Ok(category) => {
                        let resp = ServerMessage {
                            msg_type: "repo:classify:result",
                            payload: serde_json::json!({ "category": category }),
                        };
                        send_json(ws, &resp).await;
                    }
                    Err(e) => {
                        let err = ServerMessage {
                            msg_type: "error",
                            payload: serde_json::json!({"detail": format!("classify failed: {}", e)}),
                        };
                        send_json(ws, &err).await;
                    }
                },
                None => {
                    let err = ServerMessage {
                        msg_type: "error",
                        payload: serde_json::json!({"detail": "repo is required"}),
                    };
                    send_json(ws, &err).await;
                }
            }
        }

        other => {
            console_log!("ws: unknown message type: {}", other);
            let resp = ServerMessage {
                msg_type: "error",
                payload: serde_json::json!({"detail": format!("unknown type: {}", other)}),
            };
            send_json(ws, &resp).await;
        }
    }
}

// ── Workers AI: Embedding ──────────────────────────────────

async fn generate_embedding(env: &Env, text: &str) -> Result<Vec<f32>> {
    let ai = env.ai()?;

    let input = serde_json::json!({
        "text": [text],
    });

    let result = ai.run("bge-base-zh-v1.5", input).await?;

    // The Workers AI embedding API returns { data: [{ embedding: [f32, ...] }] }
    let data = result.get("data")
        .and_then(|d| d.as_array())
        .and_then(|arr| arr.first())
        .and_then(|first| first.get("embedding"))
        .and_then(|e| e.as_array())
        .ok_or_else(|| Error::from("unexpected embedding response format"))?;

    let vector: Vec<f32> = data
        .iter()
        .filter_map(|v| v.as_f64().map(|f| f as f32))
        .collect();

    Ok(vector)
}

// ── Workers AI: Repo Classification ─────────────────────────

async fn classify_repo(env: &Env, repo: &serde_json::Value) -> Result<String> {
    let ai = env.ai()?;
    let name = repo.get("full_name").and_then(|v| v.as_str()).unwrap_or("unknown");
    let desc = repo.get("description").and_then(|v| v.as_str()).unwrap_or("");
    let lang = repo.get("language").and_then(|v| v.as_str()).unwrap_or("");
    let topics: Vec<String> = repo.get("topics")
        .and_then(|t| t.as_array())
        .map(|arr| arr.iter().filter_map(|v| v.as_str().map(String::from)).collect())
        .unwrap_or_default();
    let stars = repo.get("stargazers_count").and_then(|v| v.as_i64()).unwrap_or(0);
    let archived = repo.get("archived").and_then(|v| v.as_bool()).unwrap_or(false);

    let prompt = format!(
        "Analyze this GitHub repository and classify it into one category:\n\
        - junk: dead, archived, no real code, just a demo/fork with no changes\n\
        - tool: useful library, framework, CLI tool, package\n\
        - learning: tutorial, awesome-list, book, course materials\n\
        - longterm: actively maintained, large community,值得长期关注\n\
        - app: complete application, product, service\n\n\
        Repository:\n\
        Name: {}\n\
        Description: {}\n\
        Language: {}\n\
        Topics: {}\n\
        Stars: {}\n\
        Archived: {}\n\n\
        Reply with ONLY the category name: junk, tool, learning, longterm, or app",
        name, desc, lang, topics.join(", "), stars, archived
    );

    let input = serde_json::json!({
        "prompt": prompt,
        "max_tokens": 10,
        "temperature": 0.1,
    });

    let result = ai.run("@cf/meta/llama-3.1-8b-instruct", input).await?;
    let text = result["response"].as_str().unwrap_or("tool").trim().to_lowercase();

    // Validate the response
    match text.as_str() {
        "junk" | "tool" | "learning" | "longterm" | "app" => Ok(text),
        _ => {
            // Fallback: if the response contains a known category
            for cat in &["junk", "tool", "learning", "longterm", "app"] {
                if text.contains(cat) {
                    return Ok(cat.to_string());
                }
            }
            Ok("tool".to_string())
        }
    }
}

// ── Send Helper ─────────────────────────────────────────────

async fn send_json(ws: &WebSocket, msg: &ServerMessage<'_>) {
    if let Ok(json) = serde_json::to_string(msg) {
        let _ = ws.send_with_str(&json);
    }
}