import { TailnetObject } from "../../../src/index.js";

// One Durable Object = one tailnet device. This one is an exit node and also
// serves a small page to tailnet peers on port 80.
export class ExitNode extends TailnetObject {
  tailnetOptions() {
    return {
      ...super.tailnetOptions(),
      hostname: this.env.TS_HOSTNAME ?? "cf-exit",
      exitNode: true,
      statePrefix: "ts:", // keeps the device identity from the first prototype
    };
  }

  async onTailnet(tailnet) {
    tailnet.serve(80, (request, who) =>
      Response.json({
        hello: who?.displayName ?? "unknown",
        you: who,
        node: tailnet.status().name,
        path: new URL(request.url).pathname,
      }),
    );
  }

  async fetch() {
    return Response.json(await this.tailnetStatus());
  }
}

export default {
  async fetch(request, env) {
    const node = env.EXIT.getByName("exit");
    const url = new URL(request.url);
    // /tailnet?url=http://host:port/path fetches a tailnet URL via the DO.
    if (url.pathname === "/tailnet") {
      return node.tailnetFetch(url.searchParams.get("url"));
    }
    return node.fetch(request);
  },
};
