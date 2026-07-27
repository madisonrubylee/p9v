import { createServer } from "node:http";
import next from "next";

const port = Number(process.env.PORT ?? 3100);
const hostname = "127.0.0.1";

const app = next({ dev: false, hostname, port });
const handle = app.getRequestHandler();

await app.prepare();

createServer((req, res) => handle(req, res)).listen(port, hostname, () => {
  console.log(`ready on http://${hostname}:${port}`);
});
