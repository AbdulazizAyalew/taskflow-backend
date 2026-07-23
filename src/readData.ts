import type {Laptop} from "./types";
import  {readFile} from 'fs/promises';

export async function loadlaptops(path:string): Promise<Laptop[]>{
    const raw = await readFile(path, 'utf-8');
    const data = JSON.parse(raw) as Laptop[];
    return data;
}


