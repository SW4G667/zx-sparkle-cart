import React, { useEffect, useId, useRef, useState } from 'react';
import Icon from './icons.jsx';
import { applicationTypes, applicationStatuses, searchApplications } from './application-model.mjs';
export default function ApplicationPicker({ apps, selected, onSelect, disabled, hideIds, refreshing, onRefresh }) {
  const [open, setOpen] = useState(false), [query, setQuery] = useState('');
  const root = useRef(null), trigger = useRef(null), search = useRef(null), listId = useId();
  const filtered = searchApplications(apps, query);
  const close = () => { setOpen(false); trigger.current?.focus(); };
  useEffect(() => {
    if (!open) return;
    search.current?.focus();
    const outside = event => { if (!root.current?.contains(event.target)) setOpen(false); };
    const escape = event => { if (event.key === 'Escape') { event.stopPropagation(); setOpen(false); trigger.current?.focus(); } };
    document.addEventListener('pointerdown', outside); root.current?.addEventListener('keydown', escape);
    const element = root.current;
    return () => { document.removeEventListener('pointerdown', outside); element?.removeEventListener('keydown', escape); };
  }, [open]);
  useEffect(() => { if (disabled) setOpen(false); }, [disabled]);
  function navigate(event) {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    const options = Array.from(root.current?.querySelectorAll('[data-app-option]') || []);
    if (!options.length) return;
    event.preventDefault();
    const current = options.indexOf(document.activeElement);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1 : event.key === 'ArrowDown' ? (current + 1) % options.length : current <= 0 ? options.length - 1 : current - 1;
    options[next]?.focus();
  }
  return <div className="application-picker" ref={root}>
    <span className="application-picker-label">SUAS APLICAÇÕES <span>{apps.length}</span></span>
    <button ref={trigger} type="button" className="application-picker-trigger" aria-label="Aplicação atual" aria-haspopup="dialog" aria-expanded={open} aria-controls={listId} disabled={disabled}
      onClick={() => { setQuery(''); setOpen(value => !value); }}>
      <span className="application-picker-icon"><Icon name={selected?.profile === 'robux' ? 'finance' : 'apps'} size={20}/></span>
      <span className="application-picker-current"><strong>{selected?.label || 'Selecionar aplicação'}</strong><small>{selected ? applicationTypes[selected.profile] || 'Aplicação' : 'Seus bots aparecerão aqui'}</small></span><Icon name="chevron" size={15}/>
    </button>
    {open && <div id={listId} className="application-picker-popup" role="dialog" aria-label="Selecionar aplicação" onKeyDown={navigate}>
      <label className="application-picker-search"><Icon name="search" size={16}/><input ref={search} aria-label="Buscar aplicação" autoComplete="off" placeholder="Buscar nome ou ID" value={query} onChange={event => setQuery(event.target.value)}/></label>
      <div className="application-picker-list" aria-label="Aplicações disponíveis">
        {filtered.map(app => <button type="button" data-app-option key={app.key} className={'application-picker-option' + (selected?.key === app.key ? ' selected' : '')} aria-pressed={selected?.key === app.key}
          onClick={() => { onSelect(app); close(); }}>
          <span className={'application-picker-dot status-' + app.status}/><span><strong>{app.label}</strong><small>{applicationTypes[app.profile] || 'Aplicação'}{!hideIds && ` · ${(app.botId || app.id).slice(-6)}`}</small><small>{applicationStatuses[app.status] || applicationStatuses.unknown} · {app.cloudId ? 'Workspace disponível' : 'Aguardando identificação'}</small></span>{selected?.key === app.key && <Icon name="check" size={16}/>}
        </button>)}
        {!filtered.length && <p className="application-picker-empty">{apps.length ? 'Nenhuma aplicação encontrada.' : 'Aguardando suas aplicações do Manager.'}</p>}
      </div>
      <button type="button" className="application-picker-refresh" onClick={onRefresh} disabled={refreshing}><Icon name="refresh" size={14}/>{refreshing ? 'Atualizando…' : 'Atualizar aplicações'}</button>
    </div>}
  </div>;
}
