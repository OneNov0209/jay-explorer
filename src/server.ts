import "./lib/error-capture";
import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

export default {
  async fetch(request: Request) {
    try {
      const { default: serverEntry } = await import("@tanstack/react-start/server-entry");
      const response = await serverEntry.fetch(request);
      return response;
    } catch (error) {
      console.error(error);
      console.error(consumeLastCapturedError());
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
