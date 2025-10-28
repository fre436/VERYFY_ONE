/**
 * Lucifer....!!🌈™ Verify Bot — V9.0 ULTRA SECURE (Vercel Ready)
 * 100% working all commands + webhook edition
 */

require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const express = require('express');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const osutils = require('os-utils');
const ping = require('ping');

// === Setup Paths ===
const DATA_DIR = './data';
const LOG_DIR = './logs';
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const LOG_FILE = path.join(LOG_DIR, 'bot.log');
fs.ensureDirSync(DATA_DIR);
fs.ensureDirSync(LOG_DIR);
if (!fs.existsSync(USERS_FILE)) fs.writeJsonSync(USERS_FILE, []);

// === Helpers ===
function logEvent(txt) {
  const line = `[${new Date().toISOString()}] ${txt}\n`;
  fs.appendFileSync(LOG_FILE, line);
}
function lucifer(title, lines = []) {
  return `🌈 𝐋𝐮𝐜𝐢𝐟𝐞𝐫....!!🌈™  ${title}\n━━━━━━━━━━━━━━━━━━━━━━\n${lines.join('\n')}`;
}

// === Config ===
function loadConfig() {
  require('dotenv').config();
  return {
    BOT_TOKEN: process.env.BOT_TOKEN,
    ADMINS: (process.env.ADMINS || '').split(',').map(a => Number(a.trim())),
    CHANNELS: (process.env.CHANNELS || '').split(',').map(c => c.trim()),
    DOWNLOAD_LINK: process.env.DOWNLOAD_LINK,
    WELCOME_IMAGE: process.env.WELCOME_IMAGE,
    THANKS_IMAGE: process.env.THANKS_IMAGE,
    RATE_LIMIT_MS: Number(process.env.RATE_LIMIT_MS || 10000)
  };
}
let CONFIG = loadConfig();

// === Bot Setup ===
if (!CONFIG.BOT_TOKEN) {
  console.error("❌ BOT_TOKEN missing in .env");
  process.exit(1);
}
const bot = new Telegraf(CONFIG.BOT_TOKEN);

// === User DB ===
let users = fs.readJsonSync(USERS_FILE, { throws: false }) || [];
function saveUsers() { fs.writeJsonSync(USERS_FILE, users, { spaces: 2 }); }
function findUser(id) { return users.find(u => u.id === id); }
function ensureUser(id, data) {
  let u = findUser(id);
  if (!u) {
    u = { id, verified: false, banned: false, ...data, createdAt: new Date().toISOString() };
    users.push(u); saveUsers();
  }
  return u;
}
function isAdmin(id) { return CONFIG.ADMINS.includes(Number(id)); }

// === Rate Limit ===
const verifyCooldown = new Map();
function canVerify(uid) {
  const last = verifyCooldown.get(uid) || 0;
  const now = Date.now();
  if (now - last < CONFIG.RATE_LIMIT_MS) return false;
  verifyCooldown.set(uid, now);
  return true;
}

// === /start ===
bot.start(async (ctx) => {
  const id = ctx.from.id;
  const name = ctx.from.first_name || ctx.from.username || id;
  ensureUser(id, { username: ctx.from.username, name });
  const btns = [
    ...CONFIG.CHANNELS.map(c => [Markup.button.url(`📢 Join ${c}`, `https://t.me/${c.replace('@', '')}`)]),
    [Markup.button.callback('🔥 Verify Now 🔥', 'VERIFY')]
  ];
  const msg = lucifer('Official Verify System', [
    `👋 Welcome, ${name}`,
    `🔐 Join all required channels below`,
    `🧭 After joining, press Verify`
  ]);
  if (CONFIG.WELCOME_IMAGE)
    await ctx.replyWithPhoto(CONFIG.WELCOME_IMAGE, { caption: msg, parse_mode: 'HTML', ...Markup.inlineKeyboard(btns) });
  else
    await ctx.reply(msg, { parse_mode: 'HTML', ...Markup.inlineKeyboard(btns) });

  logEvent(`👤 /start by ${name} (${id})`);
});

// === Verify ===
bot.action('VERIFY', async (ctx) => {
  const id = ctx.from.id;
  if (!canVerify(id)) return ctx.answerCbQuery('⏳ Wait before re-trying.');

  const rec = ensureUser(id, { username: ctx.from.username });
  if (rec.banned) return ctx.reply(lucifer('Blocked', ['⛔ You are banned.']));

  await ctx.answerCbQuery();
  await ctx.reply(lucifer('Checking Membership', ['🔎 Please wait...']));
  await new Promise(r => setTimeout(r, 500));

  const missing = [];
  for (const c of CONFIG.CHANNELS) {
    try {
      const m = await bot.telegram.getChatMember(c, id);
      if (!['member', 'creator', 'administrator'].includes(m.status)) missing.push(c);
    } catch {
      missing.push(c);
    }
  }

  if (missing.length) {
    await ctx.reply(lucifer('Verification Failed', [`❌ Missing:\n${missing.join('\n')}`]));
    logEvent(`❌ Verify fail ${id}`);
    return;
  }

  rec.verified = true;
  rec.lastChecked = new Date().toISOString();
  saveUsers();

  const kb = Markup.inlineKeyboard([
    [Markup.button.url('📥 Download Zone', CONFIG.DOWNLOAD_LINK)],
    [Markup.button.callback('💬 Support', 'SUPPORT')]
  ]);
  if (CONFIG.THANKS_IMAGE)
    await ctx.replyWithPhoto(CONFIG.THANKS_IMAGE, { caption: lucifer('Success', ['✅ Verified Successfully!']), ...kb });
  else
    await ctx.reply(lucifer('Success', ['✅ Verified Successfully!']), { ...kb });

  logEvent(`✅ verified ${id}`);
});

// === Support ===
bot.action('SUPPORT', async (ctx) => {
  await ctx.answerCbQuery();
  ctx.reply(lucifer('Support', ['💬 @Lucifer_HelpDesk']));
});

// === Admin Commands ===
bot.command('stats', async (ctx) => {
  if (!isAdmin(ctx.from.id)) return;
  const total = users.length;
  const verified = users.filter(u => u.verified).length;
  const banned = users.filter(u => u.banned).length;
  await ctx.reply(lucifer('Stats', [
    `👥 Total: ${total}`,
    `✅ Verified: ${verified}`,
    `⛔ Banned: ${banned}`
  ]));
});

bot.command('ban', async (ctx) => {
  if (!isAdmin(ctx.from.id)) return;
  const id = Number(ctx.message.text.split(' ')[1]);
  let u = findUser(id);
  if (!u) return ctx.reply('User not found.');
  u.banned = true; u.verified = false; saveUsers();
  ctx.reply(`⛔ ${id} banned.`);
});

bot.command('unban', async (ctx) => {
  if (!isAdmin(ctx.from.id)) return;
  const id = Number(ctx.message.text.split(' ')[1]);
  let u = findUser(id);
  if (!u) return ctx.reply('User not found.');
  u.banned = false; saveUsers();
  ctx.reply(`🔓 ${id} unbanned.`);
});

bot.command('broadcast', async (ctx) => {
  if (!isAdmin(ctx.from.id)) return;
  const msg = ctx.message.text.split(' ').slice(1).join(' ');
  if (!msg) return ctx.reply('Usage: /broadcast <text>');
  let sent = 0;
  for (const u of users) {
    if (u.banned) continue;
    try { await bot.telegram.sendMessage(u.id, lucifer('Broadcast', [msg])); sent++; }
    catch {}
  }
  ctx.reply(`✅ Sent to ${sent} users.`);
});

// === Express Webhook for Vercel ===
const app = express();
app.use(express.json());

app.get('/', (req, res) => res.send('🌈 Lucifer Verify Bot V9.0 — Alive'));

app.post(`/api/${CONFIG.BOT_TOKEN}`, (req, res) => {
  bot.handleUpdate(req.body, res);
  res.sendStatus(200);
});

// === Export for Vercel ===
module.exports = app;
logEvent('🚀 Lucifer Verify Bot v9.0 Webhook Ready');
