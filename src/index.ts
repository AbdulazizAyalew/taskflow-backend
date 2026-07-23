import { loadlaptops } from "./readData";

async function main() {
    console.log("Welcome to CONNECT.");
    const Laptops = await loadlaptops("./src/datas/Laptops.json");
    console.log(Laptops);
}

main();