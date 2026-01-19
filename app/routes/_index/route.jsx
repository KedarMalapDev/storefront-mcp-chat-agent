import { redirect } from "react-router";
import styles from "./styles.module.css";

export const loader = async ({ request }) => {
  const url = new URL(request.url);
  const pathPrefix = url.searchParams.get("path_prefix");

  // Handle app proxy GET requests for /apps/chat
  if (pathPrefix === "/apps/chat") {
    const chatUrl = new URL("/chat", url.origin);
    // Preserve query params except path_prefix
    url.searchParams.forEach((value, key) => {
      if (key !== "path_prefix") {
        chatUrl.searchParams.set(key, value);
      }
    });
    
    const chatRequest = new Request(chatUrl.toString(), {
      method: request.method,
      headers: request.headers,
    });
    
    const { loader: chatLoader } = await import("../routes/chat.jsx");
    return chatLoader({ request: chatRequest });
  }

  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }

  return null
};

// Handle app proxy requests - Shopify forwards /apps/chat to /?path_prefix=/apps/chat
export const action = async ({ request }) => {
  const url = new URL(request.url);
  const pathPrefix = url.searchParams.get("path_prefix");
  
  // If this is an app proxy request for /apps/chat, forward to /chat
  if (pathPrefix === "/apps/chat") {
    // Create a new request to /chat with the same body and headers
    const chatUrl = new URL("/chat", url.origin);
    // Preserve query params except path_prefix
    url.searchParams.forEach((value, key) => {
      if (key !== "path_prefix") {
        chatUrl.searchParams.set(key, value);
      }
    });
    
    // Forward the request to the chat route
    const chatRequest = new Request(chatUrl.toString(), {
      method: request.method,
      headers: request.headers,
      body: request.body,
    });
    
    // Import and call the chat route handler
    const { action: chatAction } = await import("../routes/chat.jsx");
    return chatAction({ request: chatRequest });
  }

  // For other POST requests, return method not allowed
  return new Response("Method Not Allowed", { status: 405 });
};

export default function App() {
  return (
    <div className={styles.index}>
      <div className={styles.content}>
        <h1 className={styles.heading}>Shop chat agent reference app</h1>
        <p className={styles.text}>
          A reference app for shop chat agent.
        </p>
      </div>
    </div>
  );
}
