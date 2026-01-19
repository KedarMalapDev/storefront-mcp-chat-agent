import { PassThrough } from "stream";
import { renderToPipeableStream } from "react-dom/server";
import { ServerRouter } from "react-router";
import { createReadableStreamFromReadable } from "@react-router/node";
import { isbot } from "isbot";
import { addDocumentResponseHeaders } from "./shopify.server";

export const streamTimeout = 5000;

export default async function handleRequest(
  request,
  responseStatusCode,
  responseHeaders,
  reactRouterContext,
) {
  // Log response headers to debug
  console.log("entry.server - responseHeaders Content-Type:", responseHeaders.get("Content-Type"));
  console.log("entry.server - responseStatusCode:", responseStatusCode);
  
  // Check if React Router has already set a response with Content-Type: text/event-stream
  // This happens when an action returns a Response object with SSE headers
  const contentType = responseHeaders.get("Content-Type");
  const isSseResponse = contentType && contentType.includes("text/event-stream");
  
  // Check if this is an API request based on Accept header or path
  const acceptHeader = request.headers.get("Accept");
  const url = new URL(request.url);
  const pathPrefix = url.searchParams.get("path_prefix");
  const isApiRequest = acceptHeader === "text/event-stream" || 
                       pathPrefix === "/apps/chat" ||
                       url.pathname === "/chat";
  
  console.log("entry.server - isApiRequest:", isApiRequest, "isSseResponse:", isSseResponse, "method:", request.method);
  
  // For API requests with SSE, we should not add document headers
  // and should preserve the response headers from the action
  if (isApiRequest && request.method === "POST") {
    // Don't add document headers for API requests - they might interfere with SSE
    const userAgent = request.headers.get("user-agent");
    const callbackName = isbot(userAgent ?? "") ? "onAllReady" : "onShellReady";

    return new Promise((resolve, reject) => {
      const { pipe, abort } = renderToPipeableStream(
        <ServerRouter context={reactRouterContext} url={request.url} />,
        {
          [callbackName]: () => {
            const body = new PassThrough();
            const stream = createReadableStreamFromReadable(body);

            // Check if responseHeaders already has Content-Type set (from action's Response)
            // If it's text/event-stream, we should preserve it and not override
            const existingContentType = responseHeaders.get("Content-Type");
            console.log("entry.server callback - existingContentType:", existingContentType);
            
            // Only set HTML content-type if it's not already set (for API responses)
            // React Router should have already set the correct headers from the action's Response
            if (!existingContentType) {
              responseHeaders.set("Content-Type", "text/html");
            }
            
            resolve(
              new Response(stream, {
                headers: responseHeaders,
                status: responseStatusCode,
              }),
            );
            pipe(body);
          },
          onShellError(error) {
            reject(error);
          },
          onError(error) {
            responseStatusCode = 500;
            console.error(error);
          },
        },
      );

      setTimeout(abort, streamTimeout + 1000);
    });
  }

  // For regular page requests, use normal rendering
  addDocumentResponseHeaders(request, responseHeaders);
  const userAgent = request.headers.get("user-agent");
  const callbackName = isbot(userAgent ?? "") ? "onAllReady" : "onShellReady";

  return new Promise((resolve, reject) => {
    const { pipe, abort } = renderToPipeableStream(
      <ServerRouter context={reactRouterContext} url={request.url} />,
      {
        [callbackName]: () => {
          const body = new PassThrough();
          const stream = createReadableStreamFromReadable(body);

          responseHeaders.set("Content-Type", "text/html");
          resolve(
            new Response(stream, {
              headers: responseHeaders,
              status: responseStatusCode,
            }),
          );
          pipe(body);
        },
        onShellError(error) {
          reject(error);
        },
        onError(error) {
          responseStatusCode = 500;
          console.error(error);
        },
      },
    );

    // Automatically timeout the React renderer after 6 seconds, which ensures
    // React has enough time to flush down the rejected boundary contents
    setTimeout(abort, streamTimeout + 1000);
  });
}
