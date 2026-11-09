'use strict';
(() => {
  const root = document.getElementById('modsRoot');
  if (!root) return;
  const api = window.dragonStrap;
  let state = {mods:[],active:null}, review = null, busy = false;
  const esc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const feedback = root.querySelector('[role="status"]');
  const list = root.querySelector('.mods-library'), preview = root.querySelector('.mods-review');
  function render() {
    root.querySelector('.mods-active').innerHTML = state.active ? `<strong>${esc(state.active.name)}</strong><p>${esc(state.active.target)} · ${esc(state.active.version)}</p><p>Original-file backup retained. Restore before switching mods. After a Roblox update, restore applies only to the original version.</p><button type="button" class="manager-button" data-mod-action="restore">RESTORE ORIGINAL</button>` : '<strong>No asset mod applied</strong><p>Importing adds a local copy to your library. Roblox files change only after you preview and apply.</p>';
    list.innerHTML = state.mods.length ? state.mods.map(mod=>`<article class="mods-item"><div><h3>${esc(mod.name)}</h3><p>${esc(mod.target)}</p><small>${(mod.size/1024).toFixed(1)} KB · SHA-256 ${esc(mod.hash)}</small></div><div class="manager-actions"><button class="manager-button" type="button" data-mod-action="preview" data-id="${esc(mod.id)}" ${state.active?'disabled':''}>PREVIEW</button><button class="manager-button" type="button" data-mod-action="remove" data-id="${esc(mod.id)}" ${state.active?'disabled':''}>REMOVE</button></div></article>`).join('') : '<p class="mods-empty">Your library is empty. Add a replacement asset to get started.</p>';
    preview.hidden = !review;
    preview.innerHTML = review ? `<h2>REVIEW FILE REPLACEMENT</h2><strong>${esc(review.name)}</strong><p>${esc(review.destination)}</p><p>One existing Player asset will be replaced. DragonStrap saves the current file for restoration. Close Roblox first; launch it again after applying.</p><div class="manager-actions"><button class="manager-button primary" data-mod-action="apply" type="button">BACK UP &amp; APPLY</button><button class="manager-button" data-mod-action="cancel" type="button">CANCEL</button></div>` : '';
    root.querySelectorAll('button').forEach(button=>{if(busy)button.disabled=true;});
  }
  async function run(task) {
    if (busy) return;
    busy=true; render(); feedback.textContent='Working…';
    try { const result=await task(); if(!result.ok)throw new Error(result.message || 'Mods operation failed.'); if(result.state)state=result.state;if(result.preview)review=result.preview;feedback.textContent=result.canceled?'Import canceled.':result.preview?'Review the exact destination below.':'Done.'; }
    catch(error) {feedback.textContent=error.message;review=null;try{const latest=await api.getMods();if(latest.ok)state=latest.state;}catch{/* Preserve the actionable error. */}}
    finally {busy=false;root.querySelectorAll('button').forEach(button=>button.disabled=false);render();}
  }
  root.querySelector('form').addEventListener('submit',event=>{event.preventDefault();const form=new FormData(event.target);review=null;run(()=>api.importMod(form.get('target'),form.get('name')));});
  root.addEventListener('click',event=>{
    const button=event.target.closest('[data-mod-action]');if(!button||busy)return;
    const action=button.dataset.modAction;
    if(action==='cancel'){review=null;render();return;}
    if(action==='refresh'){review=null;run(()=>api.getMods());return;}
    if(action==='preview'){review=null;run(()=>api.previewMod(button.dataset.id));return;}
    const value=action==='apply'?review?.token:button.dataset.id;review=null;
    run(()=>api.changeMod(action,value));
  });
  let visible=false;
  new MutationObserver(()=>{const next=document.documentElement.dataset.view==='mods';if(next&&!visible)run(()=>api.getMods());visible=next;}).observe(document.documentElement,{attributes:true,attributeFilter:['data-view']});
  render();
})();
