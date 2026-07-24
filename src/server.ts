import * as http from "http";
import * as dotenv from "dotenv";
import { loadlaptops } from "./readData";

dotenv.config();

const PORT = process.env.PORT || 3000;
console.log(process.env.PORT);

const server = http.createServer(async (req, res) => {
  if (req.url === "/laptops" && req.method === "GET") {
    try {
      const laptops = await loadlaptops("./src/datas/Laptops.json");
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(laptops));
    } catch (err) {
      console.error("Error loading laptops:", (err as Error).message);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Internal server error" }));
    }
  } else {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
  }
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
