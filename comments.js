// ── comments.js — kommentarer på en plats ────────────────────────────────────
// Isolerad modul (samma mönster som tips.js/challenges.js). All säkerhet ligger
// i RLS + triggers i Supabase (se migrationen 20260822090000_place_comments.sql);
// den här filen är bara UI och anrop.
//
// Skillnaden mot tips.js: ett tips är ett innehållsbidrag som granskas av andra
// innan det publiceras. En kommentar är ett samtal — den syns direkt och
// modereras i efterhand via rapportering. Därför laddas kommentarer per PLATS
// när detaljvyn öppnas, inte per stad i förväg: en stad kan ha tusentals, och
// ingen behöver dem förrän de tittar på just den platsen.
import { getSupabase, isConfigured } from './config.js';
import { getUser, requireAuth } from './auth.js';
import { uploadPhoto } from './tips.js';
import { ico } from './icons.js';

let ctx = null;
let supa = null;
const cache = new Map();          // stop_ref → kommentarer (töms vid stadsbyte)
const authorNames = new Map();    // id → visningsnamn

const t = k => (ctx && ctx.t ? ctx.t(k) : k);
const en = () => ctx && ctx.lang === 'en';
const city = () => (ctx && ctx.citySlug) || 'mjolby';
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, m =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));

export function commentsActive() { return isConfigured(); }
async function ensureClient() { if (!supa && isConfigured()) supa = await getSupabase(); return supa; }

export function initComments(context) { ctx = context; }
export function clearCommentCache() { cache.clear(); }

// "för 5 min sedan" / "3 dagar sedan" — relativ tid läses snabbare än datum i
// ett samtalsflöde, och slipper tidszonsfrågor.
function ago(iso) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  const step = [[60, 'sek', 'sec'], [3600, 'min', 'min'], [86400, 'tim', 'h'], [604800, 'dgr', 'd']];
  if (s < 60) return en() ? 'just now' : 'nyss';
  for (let i = 1; i < step.length; i++) {
    if (s < step[i][0]) {
      const n = Math.floor(s / step[i - 1][0]);
      return en() ? `${n}${step[i][2]} ago` : `${n} ${step[i][1]} sedan`;
    }
  }
  const w = Math.floor(s / 604800);
  return en() ? `${w}w ago` : `${w} v sedan`;
}

// Sant först när vi vet att tabellen finns. Innan migrationen är körd i prod
// ska sektionen inte visas alls — annars påstår den "ingen har sagt något än"
// om något som i själva verket inte går att skriva till.
let tableMissing = false;

async function fetchComments(stopId) {
  await ensureClient();
  if (!supa) return [];
  const { data, error } = await supa
    .from('place_comments')
    .select('id, author_id, body, media_url, edited, created_at')
    .eq('city', city()).eq('stop_ref', stopId).eq('hidden', false)
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) {
    if (/does not exist|schema cache|PGRST205/i.test(error.message || '')) tableMissing = true;
    else console.warn('kommentarer', error);
    return [];
  }
  const list = data || [];
  // Visningsnamn hämtas ur public_authors (vyn döljer all annan profildata).
  const missing = [...new Set(list.map(c => c.author_id))].filter(id => !authorNames.has(id));
  if (missing.length) {
    const { data: who } = await supa.from('public_authors').select('id, display_name').in('id', missing);
    (who || []).forEach(a => authorNames.set(a.id, a.display_name));
  }
  cache.set(stopId, list);
  return list;
}

const nameOf = id => authorNames.get(id) || (en() ? 'A contributor' : 'En stadsvandrare');

function commentHtml(c, meId) {
  const mine = c.author_id === meId;
  const isImg = c.media_url && /\.(jpe?g|png|webp|gif)(\?|$)/i.test(c.media_url);
  return `<li class="cmt${mine ? ' cmt--mine' : ''}" data-cmt="${c.id}">
    <div class="cmt-head">
      <b>${esc(nameOf(c.author_id))}</b>
      <small>${ago(c.created_at)}${c.edited ? ` · ${en() ? 'edited' : 'ändrad'}` : ''}</small>
    </div>
    ${isImg ? `<img class="cmt-img" src="${esc(c.media_url)}" alt="" loading="lazy" decoding="async">` : ''}
    <p class="cmt-body">${esc(c.body)}</p>
    <div class="cmt-actions">
      ${mine
        ? `<button class="cmt-act" data-del="${c.id}">${t('cmt_delete')}</button>`
        : `<button class="cmt-act" data-flag="${c.id}">${t('cmt_report')}</button>`}
    </div>
  </li>`;
}

// Platshållare som renderas med resten av detaljvyn; innehållet fylls i av
// wireCommentBlock när raderna hämtats.
export function commentBlockHtml(stopId) {
  if (!commentsActive()) return '';
  return `<div class="cmt-section" data-comments="${esc(stopId)}">
    <div class="contrib-h">${ico('chat',17)} ${t('cmt_section')}</div>
    <div class="cmt-list-wrap"><div class="contrib-optimizing">${t('cmt_loading')}</div></div>
    <div class="cmt-form-wrap"></div>
  </div>`;
}

export async function wireCommentBlock(root, stopId) {
  const sec = root.querySelector(`[data-comments="${CSS.escape(stopId)}"]`);
  if (!sec) return;
  const listWrap = sec.querySelector('.cmt-list-wrap');
  const formWrap = sec.querySelector('.cmt-form-wrap');

  let photo = null;    // { full, thumb, kb } från ctx.optimizeImage

  function renderForm() {
    const me = getUser();
    if (!me) {
      formWrap.innerHTML = `<button class="contrib-add" data-cmt-login="1">${ico('chat',18)} ${t('cmt_write')}</button>`;
      formWrap.querySelector('[data-cmt-login]').onclick = async () => {
        if (await requireAuth()) renderForm();
      };
      return;
    }
    formWrap.innerHTML = `
      <div class="cmt-form">
        <textarea class="fb-text" id="cmt-text" rows="3" placeholder="${t('cmt_placeholder')}" aria-label="${t('cmt_placeholder')}"></textarea>
        <div class="cmt-photo" id="cmt-photo"></div>
        <div class="cmt-form-row">
          <button class="fb-cta cmt-photo-btn" id="cmt-photo-btn" type="button">${ico('camera',17)} ${t('cmt_addphoto')}</button>
          <button class="cta" id="cmt-send">${t('cmt_send')}</button>
        </div>
      </div>`;
    const fileInput = document.createElement('input');
    fileInput.type = 'file'; fileInput.accept = 'image/*';
    formWrap.querySelector('#cmt-photo-btn').onclick = () => fileInput.click();
    fileInput.onchange = () => {
      const f = fileInput.files && fileInput.files[0]; if (!f) return;
      formWrap.querySelector('#cmt-photo').innerHTML = `<div class="contrib-optimizing">${t('optimizing')}</div>`;
      ctx.optimizeImage(f, opt => {
        photo = opt;
        formWrap.querySelector('#cmt-photo').innerHTML =
          `<div class="contrib-preview"><img src="${opt.thumb}" alt=""><span class="contrib-kb">~${opt.kb} kB</span></div>`;
      });
    };
    formWrap.querySelector('#cmt-send').onclick = send;
  }

  async function send() {
    const ta = formWrap.querySelector('#cmt-text');
    const body = (ta.value || '').trim();
    if (!body) { ctx.toast(t('cmt_need_text')); return; }
    const btn = formWrap.querySelector('#cmt-send');
    btn.disabled = true; btn.textContent = t('cmt_sending');

    let media_url = null;
    if (photo) media_url = await uploadPhoto(photo.full);

    const { error } = await supa.from('place_comments')
      .insert({ city: city(), stop_ref: stopId, body, media_url });
    btn.disabled = false; btn.textContent = t('cmt_send');
    if (error) {
      // Vaktens undantag (takt/cooldown) kommer som vanliga fel — visa dem
      // begripligt i stället för rå SQL-text.
      const msg = /too many comments/.test(error.message) ? t('cmt_rate')
                : /cooldown|suspended/.test(error.message) ? t('cmt_cooldown')
                : error.message;
      ctx.toast(msg);
      return;
    }
    photo = null;
    ta.value = '';
    ctx.toast('💬 ' + t('cmt_posted'));
    await refresh();
  }

  async function refresh() {
    const list = await fetchComments(stopId);
    const me = getUser();
    const meId = me ? me.id : null;
    listWrap.innerHTML = list.length
      ? `<ul class="cmt-list">${list.map(c => commentHtml(c, meId)).join('')}</ul>`
      : `<p class="cmt-empty">${t('cmt_empty')}</p>`;
    listWrap.querySelectorAll('[data-del]').forEach(b => b.onclick = () => remove(b.dataset.del));
    listWrap.querySelectorAll('[data-flag]').forEach(b => b.onclick = () => report(b.dataset.flag));
    renderForm();
  }

  async function remove(id) {
    if (!confirm(t('cmt_delete_confirm'))) return;
    const { error } = await supa.from('place_comments').delete().eq('id', id);
    if (error) { ctx.toast(error.message); return; }
    ctx.toast(t('cmt_deleted'));
    await refresh();
  }

  async function report(id) {
    if (!(await requireAuth())) return;
    const me = getUser();
    const { error } = await supa.from('comment_flags')
      .insert({ comment_id: id, reporter_id: me.id, reason: 'offensive' });
    // Dubbelrapport från samma person avvisas av unik-villkoret — det är inget
    // fel användaren behöver se, de har redan gjort sitt.
    if (error && !/duplicate key/i.test(error.message)) { ctx.toast(error.message); return; }
    ctx.toast(t('cmt_reported'));
  }

  await ensureClient();
  if (!supa) { sec.remove(); return; }
  await refresh();
  if (tableMissing) sec.remove();
}
