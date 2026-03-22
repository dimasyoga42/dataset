import puppeteer from "puppeteer";
import * as cheerio from "cheerio";
import axios from "axios";
import fs from "fs";
import { Groq } from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const DELAY = 600;
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

// ======= SEMUA SKILL TREE =======
const ALL_TREES = [
  // Weapon
  { name: "Blade",       group: "Weapon",  cyId: 0 },
  { name: "Shot",        group: "Weapon",  cyId: 1 },
  { name: "Magic",       group: "Weapon",  cyId: 2 },
  { name: "Martial",     group: "Weapon",  cyId: 3 },
  { name: "DualSword",   group: "Weapon",  cyId: 4 },
  { name: "Halberd",     group: "Weapon",  cyId: 5 },
  { name: "Mononofu",    group: "Weapon",  cyId: 6 },
  { name: "Barehand",    group: "Weapon",  cyId: null },
  { name: "Crusher",     group: "Weapon",  cyId: 7 },
  { name: "Sprite",      group: "Weapon",  cyId: 8 },
  // Buff
  { name: "Guard",       group: "Buff",    cyId: null },
  { name: "Shield",      group: "Buff",    cyId: null },
  { name: "Dagger",      group: "Buff",    cyId: null },
  { name: "Knight",      group: "Buff",    cyId: null },
  { name: "Priest",      group: "Buff",    cyId: null },
  { name: "Assassin",    group: "Buff",    cyId: null },
  { name: "Wizard",      group: "Buff",    cyId: null },
  { name: "Hunter",      group: "Buff",    cyId: null },
  { name: "DarkPower",   group: "Buff",    cyId: null },
  { name: "MagicBlade",  group: "Buff",    cyId: null },
  { name: "Ninja",       group: "Buff",    cyId: null },
  { name: "Partisan",    group: "Buff",    cyId: null },
  { name: "Necromancer", group: "Buff",    cyId: null },
  // Assist
  { name: "Survival",    group: "Assist",  cyId: null },
  { name: "Support",     group: "Assist",  cyId: null },
  { name: "Minstrel",    group: "Assist",  cyId: null },
  { name: "Dancer",      group: "Assist",  cyId: null },
  { name: "Battle",      group: "Assist",  cyId: null },
  { name: "Golem",       group: "Assist",  cyId: null },
  // Other
  { name: "Smith",       group: "Other",   cyId: null },
  { name: "Alchemy",     group: "Other",   cyId: null },
  { name: "Tamer",       group: "Other",   cyId: null },
  { name: "Scroll",      group: "Other",   cyId: null },
];

// ======= CSV HELPER =======
const csvEscape = (val) => {
  if (val === null || val === undefined) return "";
  const str = String(val).replace(/\r?\n/g, " ").trim();
  return str.includes(",") || str.includes('"')
    ? `"${str.replace(/"/g, '""')}"`
    : str;
};

// ======= CORYN CLUB SCRAPER (cheerio) =======
const scrapeCoryn = async (treeName) => {
  const url = `https://coryn.club/skill.php?tree=${treeName}`;
  console.log(`   🌐 Coryn: ${url}`);

  try {
    const { data: html } = await axios.get(url, { timeout: 15000 });
    const $ = cheerio.load(html);
    const skills = [];

    // Setiap skill card
    $("h2").each((_, el) => {
      const skillName = $(el).text().trim();
      if (!skillName) return;

      const card = $(el).closest("div, section").next();

      const type    = card.find("tr:contains('Type') td").last().text().trim();
      const element = card.find("tr:contains('Element') td").last().text().trim();
      const mp      = card.find("tr:contains('MP') td").last().text().trim();
      const combo   = card.find("tr:contains('Combo') td").last().text().trim();
      const range   = card.find("tr:contains('Range') td").last().text().trim();
      const desc    = card.find("tr:contains('Description') td").last().text().trim()
                   || card.find("p.description, .desc").text().trim();

      skills.push({ skillName, type, element, mp, combo, range, desc });
    });

    // Fallback: ambil langsung dari struktur coryn
    if (skills.length === 0) {
      $(".skill-entry, .skill-block, article").each((_, el) => {
        const skillName = $(el).find("h2, h3, .skill-name").first().text().trim();
        const rows = {};
        $(el).find("tr").each((_, row) => {
          const label = $(row).find("td").first().text().trim();
          const value = $(row).find("td").last().text().trim();
          if (label && value && label !== value) rows[label] = value;
        });
        const desc = $(el).find("p").text().trim();
        if (skillName) skills.push({ skillName, ...rows, desc });
      });
    }

    return skills;
  } catch (err) {
    console.error(`   ⚠️ Coryn error: ${err.message}`);
    return [];
  }
};

// ======= CY GRIMOIRE SCRAPER (puppeteer) =======
const scrapeCyGrimoire = async (page, cyId) => {
  if (cyId === null) return [];

  const url = `https://cy-grimoire.netlify.app/skill/${cyId}-0-0`;
  console.log(`   🔮 Cy Grimoire: tree ${cyId}`);

  try {
    await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
    await page.waitForSelector(".skill-name", { timeout: 10000 }).catch(() => {});

    const skillNames = await page.evaluate(() =>
      Array.from(document.querySelectorAll(".skill-name"))
        .map((el) => el.textContent.trim())
        .filter(Boolean)
    );

    const results = [];
    for (let i = 0; i < skillNames.length; i++) {
      const skillUrl = `https://cy-grimoire.netlify.app/skill/${cyId}-${i}-0`;
      await page.goto(skillUrl, { waitUntil: "networkidle2", timeout: 30000 });
      await page.waitForSelector(".skill-effect-main", { timeout: 8000 }).catch(() => {});
      await delay(200);

      const detail = await page.evaluate(() => {
        const stats = {};
        document.querySelectorAll("table tr").forEach((row) => {
          const label = row.querySelector("td:first-child")?.innerText?.trim();
          const value = row.querySelector("td:last-child")?.innerText?.trim();
          if (label && value) stats[label] = value;
        });

        const proportions = [];
        document.querySelectorAll(".flex.flex-wrap.items-center.rounded-sm .my-1")
          .forEach((el) => proportions.push(el.innerText?.trim()));

        const damages = [];
        document.querySelectorAll(".damage-formula-main")
          .forEach((el) => damages.push(el.innerText?.replace(/\s+/g, " ").trim()));

        const propsOn = [], propsOff = [];
        document.querySelectorAll(".prop-value-wrapper").forEach((el) => {
          const isActive = el.closest("span")?.classList.contains("text-cyan-50");
          if (isActive) propsOn.push(el.textContent.trim());
          else propsOff.push(el.textContent.trim());
        });

        const critEl = document.querySelector(".text-red-60");
        const critEffect = critEl ? critEl.closest(".pl-3")?.innerText?.trim() : "";
        const actionTimeEl = document.querySelector("[class*='text-red-50']");
        const actionTime = actionTimeEl?.closest("div")?.innerText?.trim() || "";

        return { stats, proportions, damages, propsOn, propsOff, critEffect, actionTime };
      });

      results.push({ skillName: skillNames[i], ...detail });
      await delay(DELAY);
    }

    return results;
  } catch (err) {
    console.error(`   ⚠️ Cy error: ${err.message}`);
    return [];
  }
};

// ======= MERGE DATA =======
const mergeSkillData = (corynSkills, cySkills) => {
  const merged = [];
  const cyMap = {};
  cySkills.forEach((s) => { cyMap[s.skillName?.toLowerCase()] = s; });

  for (const cs of corynSkills) {
    const key = cs.skillName?.toLowerCase();
    const cy = cyMap[key] || {};

    merged.push({
      name:        cs.skillName || "",
      type:        cs.type || cs["Type"] || "",
      element:     cs.element || cs["Element"] || "",
      mp:          cs.mp || cs["MP"] || cy.stats?.["MP Cost"] || "",
      combo:       cs.combo || cs["Combo"] || cy.stats?.["Combo"] || "",
      range:       cs.range || cs["Range"] || cy.stats?.["Cast Range"] || "",
      castType:    cy.stats?.["Cast Type"] || cy.stats?.["Jenis pemeran"] || "",
      motion:      cy.stats?.["Motion"] || cy.stats?.["Gerakan"] || "",
      proportion:  cy.proportions?.join(" | ") || "",
      damage:      cy.damages?.join(" | ") || "",
      actionTime:  cy.actionTime || "",
      propsOn:     cy.propsOn?.join(" | ") || "",
      propsOff:    cy.propsOff?.join(" | ") || "",
      critEffect:  cy.critEffect || "",
      description: cs.desc || cs["Description"] || "",
    });
  }

  // Tambah skill dari Cy yang tidak ada di Coryn
  for (const cy of cySkills) {
    const key = cy.skillName?.toLowerCase();
    const exists = corynSkills.some((c) => c.skillName?.toLowerCase() === key);
    if (!exists) {
      merged.push({
        name:        cy.skillName || "",
        type:        "",
        element:     "",
        mp:          cy.stats?.["MP Cost"] || "",
        combo:       cy.stats?.["Combo"] || "",
        range:       cy.stats?.["Cast Range"] || "",
        castType:    cy.stats?.["Cast Type"] || "",
        motion:      cy.stats?.["Motion"] || "",
        proportion:  cy.proportions?.join(" | ") || "",
        damage:      cy.damages?.join(" | ") || "",
        actionTime:  cy.actionTime || "",
        propsOn:     cy.propsOn?.join(" | ") || "",
        propsOff:    cy.propsOff?.join(" | ") || "",
        critEffect:  cy.critEffect || "",
        description: "",
      });
    }
  }

  return merged;
};

// ======= GROQ AI EXPLAIN =======
const explainSkill = async (skill, treeName, group) => {
  const prompt = `
Kamu adalah ahli game Toram Online. Jelaskan skill berikut dalam Bahasa Indonesia secara singkat dan jelas (maksimal 3 kalimat):

Skill Tree  : ${treeName} (${group})
Nama Skill  : ${skill.name}
Type        : ${skill.type}
Element     : ${skill.element}
MP Cost     : ${skill.mp}
Range       : ${skill.range}
Cast Type   : ${skill.castType}
Combo       : ${skill.combo}
Motion      : ${skill.motion}
Proporsi    : ${skill.proportion}
Damage      : ${skill.damage}
Action Time : ${skill.actionTime}
Efek Aktif  : ${skill.propsOn}
Efek Negatif: ${skill.propsOff}
Critical    : ${skill.critEffect}
Deskripsi   : ${skill.description}

Fokus pada: fungsi utama, damage/efek, dan kapan skill ini paling berguna.
`.trim();

  try {
    let result = "";
    const stream = await groq.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "openai/gpt-oss-120b",
      temperature: 0.7,
      max_completion_tokens: 300,
      top_p: 1,
      stream: true,
      reasoning_effort: "medium",
    });
    for await (const chunk of stream) {
      result += chunk.choices[0]?.delta?.content || "";
    }
    return result.trim();
  } catch (err) {
    console.error(`   ⚠️ AI error: ${err.message}`);
    return "-";
  }
};

// ======= MAIN =======
const main = async () => {
  console.log("🚀 Scraping Coryn Club + Cy Grimoire + AI Explanation\n");

  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--lang=en-US"],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.setExtraHTTPHeaders({ "Accept-Language": "en-US,en;q=0.9" });

  const headers = [
    "Group", "SkillTree", "SkillName",
    "Type", "Element", "MP", "Range", "CastType", "Combo", "Motion",
    "Proportion", "DamageFormula", "ActionTime",
    "Props_Active", "Props_Inactive", "CritEffect",
    "Description_Coryn",
    "AI_Explanation",
  ];

  const rows = [headers.join(",")];

  for (const tree of ALL_TREES) {
    console.log(`\n📚 [${tree.group}] ${tree.name}`);

    const [corynSkills, cySkills] = await Promise.all([
      scrapeCoryn(tree.name),
      scrapeCyGrimoire(page, tree.cyId),
    ]);

    console.log(`   ✅ Coryn: ${corynSkills.length} | Cy: ${cySkills.length} skill`);

    const merged = mergeSkillData(corynSkills, cySkills);
    console.log(`   🔗 Merged: ${merged.length} skill unik`);

    for (const skill of merged) {
      process.stdout.write(`   🤖 AI: ${skill.name}... `);
      const explanation = await explainSkill(skill, tree.name, tree.group);
      console.log("✅");

      rows.push([
        csvEscape(tree.group),
        csvEscape(tree.name),
        csvEscape(skill.name),
        csvEscape(skill.type),
        csvEscape(skill.element),
        csvEscape(skill.mp),
        csvEscape(skill.range),
        csvEscape(skill.castType),
        csvEscape(skill.combo),
        csvEscape(skill.motion),
        csvEscape(skill.proportion),
        csvEscape(skill.damage),
        csvEscape(skill.actionTime),
        csvEscape(skill.propsOn),
        csvEscape(skill.propsOff),
        csvEscape(skill.critEffect),
        csvEscape(skill.description),
        csvEscape(explanation),
      ].join(","));

      await delay(300);
    }
  }

  fs.writeFileSync("skill_all.csv", rows.join("\n"), "utf-8");

  console.log(`\n✅ Selesai!`);
  console.log(`📄 Output: skill_all.csv`);
  console.log(`📊 Total skill: ${rows.length - 1}`);

  await browser.close();
};

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
