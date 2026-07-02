import { createServer } from "http";
import { HubServer } from "./src/socket/HubServer.js";

const httpServer = createServer();

const hub = new HubServer(httpServer);

hub.start();

const PORT = 3000;

httpServer.listen(PORT, () => {
  console.log(`Command Hub running on port ${PORT}`);
});