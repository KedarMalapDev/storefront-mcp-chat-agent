import { Links, Meta, Outlet, Scripts, ScrollRestoration } from "react-router";

// Handle app proxy POST requests at the root level
// Shopify forwards /apps/chat to /?path_prefix=/apps/chat
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

    // Read the request body as text to preserve it
    // Check if request has a body by checking content-length or content-type
    let bodyText = null;
    const contentType = request.headers.get("content-type");
    const contentLength = request.headers.get("content-length");

    // Try to read body if content-length exists and > 0, or if content-type suggests a body
    if ((contentLength && parseInt(contentLength) > 0) || (contentType && contentType.includes("application/json"))) {
      try {
        bodyText = await request.text();
        // If body is empty string, set to null
        if (bodyText === "") {
          bodyText = null;
        }
      } catch (error) {
        console.error("Error reading request body:", error);
        bodyText = null;
      }
    }

    // Forward the request to the chat route
    // Note: duplex option is required when sending a body in Node.js
    const chatRequest = new Request(chatUrl.toString(), {
      method: request.method,
      headers: request.headers,
      body: bodyText,
      duplex: 'half',
    });

    // Import and call the chat route handler
    const { action: chatAction } = await import("./routes/chat.jsx");
    return chatAction({ request: chatRequest });
  }

  // For other POST requests, return method not allowed
  return new Response("Method Not Allowed", { status: 405 });
};

// Handle app proxy GET requests at the root level
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

    const { loader: chatLoader } = await import("./routes/chat.jsx");
    return chatLoader({ request: chatRequest });
  }

  // For other requests, let the index route handle it
  return null;
};

export default function App() {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <link rel="preconnect" href="https://cdn.shopify.com/" />
        <link
          rel="stylesheet"
          href="https://cdn.shopify.com/static/fonts/inter/v4/styles.css"
        />
        <Meta />
        <Links />
      </head>
      <body>
        <Outlet />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}
