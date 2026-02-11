#!/usr/bin/env node
/**
 * validate-data.js — valida integridade básica do atlas
 * Uso: node tools/validate-data.js
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");

function readJson(rel){
  const p = path.join(ROOT, rel);
  return JSON.parse(fs.readFileSync(p, "utf8"));
}
function die(msg){
  console.error("ERRO:", msg);
  process.exitCode = 1;
}
function ok(msg){
  console.log("OK:", msg);
}

function ensureUniqueIds(items, label){
  const seen = new Set();
  const dups = new Set();
  for(const it of items){
    if(!it || typeof it.id !== "string") continue;
    if(seen.has(it.id)) dups.add(it.id);
    seen.add(it.id);
  }
  if(dups.size) die(`${label}: IDs duplicados => ${Array.from(dups).join(", ")}`);
  else ok(`${label}: IDs únicos (${items.length})`);
}

function ensureXY(items){
  let bad = 0;
  for(const it of items){
    const x = Number(it.x), y = Number(it.y);
    if(!Number.isFinite(x) || !Number.isFinite(y) || x<0 || x>100 || y<0 || y>100) bad++;
  }
  if(bad) die(`pins: ${bad} pins com x/y fora de 0..100`);
  else ok("pins: x/y dentro de 0..100");
}

function ensureCityRefs(mainPins, cities){
  const ids = new Set(cities.map(c=>c.id));
  const broken = [];
  for(const p of mainPins){
    if(p.cityId && !ids.has(p.cityId)) broken.push(`${p.id}=>${p.cityId}`);
  }
  if(broken.length) die(`main_cities_pins: cityId quebrado => ${broken.slice(0,20).join("; ")}${broken.length>20?" ...":""}`);
  else ok("main_cities_pins: cityId OK");
}

function ensureAssetsExist(pins, cities){
  const assetsRoot = path.join(ROOT, "assets");
  function exists(rel){
    const p = path.join(ROOT, rel);
    return fs.existsSync(p);
  }
  const missing = [];
  for(const p of pins){
    const imgs = Array.isArray(p.images) ? p.images : [];
    for(const rel of imgs){
      if(typeof rel === "string" && rel.trim()){
        if(!exists(rel)) missing.push(rel);
      }
    }
  }
  for(const c of cities){
    const imgs = Array.isArray(c.images) ? c.images : [];
    for(const rel of imgs){
      if(typeof rel === "string" && rel.trim()){
        if(!exists(rel)) missing.push(rel);
      }
    }
    const preview = Array.isArray(c.previewImages) ? c.previewImages : [];
    for(const rel of preview){
      if(typeof rel === "string" && rel.trim()){
        if(!exists(rel)) missing.push(rel);
      }
    }
  }
  if(missing.length) die(`assets: faltando ${missing.length} arquivos (ex.: ${missing.slice(0,10).join(", ")})`);
  else ok("assets: todas as referências existem");
}

(function main(){
  const pins = readJson("data/pins.json");
  const mainPins = readJson("data/main_cities_pins.json");
  const cities = readJson("data/cities.json");

  ensureUniqueIds(pins, "pins");
  ensureUniqueIds(mainPins, "main_cities_pins");
  ensureUniqueIds(cities, "cities");
  ensureXY(pins);
  ensureCityRefs(mainPins, cities);
  ensureAssetsExist(pins, cities);

  if(process.exitCode) {
    console.error("\nValidação falhou.");
    process.exit(process.exitCode);
  } else {
    console.log("\nValidação concluída com sucesso.");
  }
})();
