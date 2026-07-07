use futures::StreamExt;
use serde::{Deserialize, Serialize};
use worker::*;

// ── Message Types ───────────────────────────────────────────

/// Messages that the client sends to the server
#[derive(Deserialize)]
struct ClientMessage {
    #[serde(rename = "type")]
    msg_type: String,
    payload: Option<serde_json::Value>,
}

/// Messages that the server sends to the client
#[derive(Serialize)]
struct ServerMessage<'a> {
    #[serde(rename = "type")]
    msg_type: &'a str,
    payload: serde_json::Value,
}

// ── Entrypoint ──────────────────────────────────────────────

#[event(fetch)]
pub async fn main(req: Request, _env: Env, ctx: Context) -> Result<Response> {
    // Only handle WebSocket upgrade requests
    let upgrade = req.headers().get("Upgrade")?.unwrap_or_default();
    if upgrade.to_lowercase() != "websocket" {
        return Response::error("Expected WebSocket upgrade", 400);
    }

    // Create a WebSocket pair: one end for the client, one for the server
    let pair = WebSocketPair::new()?;
    let server = pair.server;

    // Accept the server-side connection
    server.accept()?;

    // Clone for use inside the background handler
    let srv = server.clone();

    // Handle messages in background (does not block the response)
    ctx.wait_until(async move {
        if let Err(e) = handle_websocket(srv).await {
            console_error!("WebSocket handler error: {:?}", e);
        }
    });

    // Return the client-side WebSocket as a 101 Switching Protocols response
    Response::from_websocket(pair.client)
}

// ── WebSocket Event Loop ────────────────────────────────────

async fn handle_websocket(ws: WebSocket) -> Result<()> {
    let mut stream = ws.events()?;

    while let Some(event) = stream.next().await {
        match event {
            WebsocketEvent::Message(msg) => {
                if let Some(text) = msg.text() {
                    if let Ok(client_msg) = serde_json::from_str::<ClientMessage>(&text) {
                        dispatch(&ws, &client_msg).await;
                    } else {
                        // Unparseable message — send back an error
                        let err = ServerMessage {
                            msg_type: "error",
                            payload: serde_json::json!({"detail": "invalid JSON"}),
                        };
                        if let Ok(json) = serde_json::to_string(&err) {
                            let _ = ws.send_with_str(&json);
                        }
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

async fn dispatch(ws: &WebSocket, msg: &ClientMessage) {
    match msg.msg_type.as_str() {
        // Health check
        "ping" => {
            let resp = ServerMessage {
                msg_type: "pong",
                payload: serde_json::json!({}),
            };
            send_json(ws, &resp).await;
        }

        // Client subscribes to sync progress events
        "subscribe:sync" => {
            console_log!("ws: client subscribed to sync channel");
            let resp = ServerMessage {
                msg_type: "subscribed",
                payload: serde_json::json!({"channel": "sync"}),
            };
            send_json(ws, &resp).await;
        }

        // Client subscribes to classify progress events
        "subscribe:classify" => {
            console_log!("ws: client subscribed to classify channel");
            let resp = ServerMessage {
                msg_type: "subscribed",
                payload: serde_json::json!({"channel": "classify"}),
            };
            send_json(ws, &resp).await;
        }

        _ => {
            console_log!("ws: unknown message type: {}", msg.msg_type);
            let resp = ServerMessage {
                msg_type: "error",
                payload: serde_json::json!({"detail": format!("unknown type: {}", msg.msg_type)}),
            };
            send_json(ws, &resp).await;
        }
    }
}

// ── Helpers ─────────────────────────────────────────────────

async fn send_json(ws: &WebSocket, msg: &ServerMessage<'_>) {
    if let Ok(json) = serde_json::to_string(msg) {
        let _ = ws.send_with_str(&json);
    }
}