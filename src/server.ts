import * as http from "http";
import { loadlaptops } from "./readData";

const server = http.createServer(async (req, res) => {
  if (req.url === "/laptops" && req.method === "GET") {
    const laptops = await loadlaptops("./src/datas/Laptops.json");
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(laptops));
  } else {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
  }
});

server.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});
