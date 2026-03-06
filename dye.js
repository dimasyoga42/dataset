import puppeteer from "puppeteer";
import fs from "fs";

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const palette = {
1:"#ffffff",2:"#d9d9d9",3:"#bfbfbf",4:"#808080",5:"#000000",
6:"#e6b8bd",7:"#e4c6c3",8:"#e7d7c7",9:"#e9e0c2",10:"#ece9c0",
11:"#c1d9c3",12:"#a8d5b7",13:"#9cd0b0",14:"#a8cfd7",15:"#a7c4d7",
16:"#b4c6e7",17:"#b4bde7",18:"#c7b7e7",19:"#e0b7e7",20:"#d8b0d7",
21:"#e7b7d2",22:"#f08a8a",23:"#f1a87f",24:"#f2c686",25:"#e7d489",
26:"#e5ea85",27:"#b6e17f",28:"#8fe08c",29:"#7dd6b8",30:"#79cbd1",
31:"#7ec0d7",32:"#74a8d7",33:"#7d8ed7",34:"#8e86d7",35:"#b47ed7",
36:"#d67ad7",37:"#e768b3",38:"#ff2a00",39:"#ff6500",40:"#ff9a00",
41:"#ffe000",42:"#e8f055",43:"#8cff00",44:"#29ff00",45:"#00e0a8",
46:"#4ecbd3",47:"#2fa6d9",48:"#2f78d9",49:"#2450e8",50:"#1a24ff",
51:"#7b2cff",52:"#e020e0",53:"#f02fb5",54:"#c60000",55:"#b34700",
56:"#9a5b2b",57:"#9b7b00",58:"#999900",59:"#4ea000",60:"#00a000",
61:"#279c56",62:"#4ea6ad",63:"#357cad",64:"#2f5fa0",65:"#1f3da0",
66:"#1010a0",67:"#6b22b8",68:"#8a1fa6",69:"#a0105a",70:"#800000",
71:"#6b1f00",72:"#5a3c00",73:"#6b5800",74:"#5c6b00",75:"#335c00",
76:"#0b5c00",77:"#0b5c36",78:"#2f5c63",79:"#1f4b7a",80:"#102f63",
81:"#0b2a63",82:"#050563",83:"#3c006b",84:"#6b005c",85:"#5c002f"
};

async function scrape(){

const url = "https://tanaka0.work/AIO/en/DyePredictor/ColorWeapon";

const browser = await puppeteer.launch({
headless:"new",
args:[
"--no-sandbox",
"--disable-setuid-sandbox",
"--disable-dev-shm-usage"
]
});

try{

const page = await browser.newPage();

await page.setUserAgent(
"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36"
);

await page.setViewport({ width:1920, height:1080 });

console.log("opening page...");

await page.goto(url,{
waitUntil:"networkidle2",
timeout:60000
});

await delay(3000);

/* cek jumlah tabel */

const tableCount = await page.$$eval("table", t => t.length);

console.log("total tables:", tableCount);

if(tableCount === 0){
throw new Error("no table found");
}

/* ambil semua data tabel */

const rawData = await page.evaluate(() => {

const result = [];

const tables = document.querySelectorAll("table");

tables.forEach((table, tableIndex) => {

const rows = table.querySelectorAll("tr");

rows.forEach((tr,rowIndex) => {

const tds = tr.querySelectorAll("td");

if(tds.length >= 2){

const boss = tds[0].innerText.trim();
const dye = tds[1].innerText.trim();

if(boss && dye && dye !== "Unknown"){

result.push({
boss,
dye,
table: tableIndex,
row: rowIndex
});

}

}

});

});

return result;

});

console.log("total rows:", rawData.length);

/* convert dye ke color id */

const result = rawData.map(e => {

const clean = e.dye.replace(/[^\w\d]/g,"");
const match = clean.match(/\d+/);
const num = match ? parseInt(match[0]) : null;

return {
boss: e.boss,
dye: clean,
color_id: num,
hex: palette[num] || "#ffffff"
};

});

fs.writeFileSync(
"dye_data.json",
JSON.stringify(result,null,2)
);

console.log("saved dye_data.json");
console.log("total boss:", result.length);

}catch(err){

console.error(err);

}finally{

await browser.close();

}

}

scrape();
