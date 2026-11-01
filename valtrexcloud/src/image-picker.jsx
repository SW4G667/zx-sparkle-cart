import React,{useEffect,useRef,useState} from 'react';
import Icon from './icons.jsx';

export async function prepareGalleryImage(file){
 if(!file||!['image/jpeg','image/png','image/webp','image/gif'].includes(file.type))throw Error('Escolha uma imagem JPG, PNG, WebP ou GIF da sua galeria.');
 if(file.size>15*1024*1024)throw Error('Escolha uma imagem de até 15 MB.');
 const dataUrl=blob=>new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('Não foi possível ler esta imagem.'));reader.readAsDataURL(blob);});
 if(file.type==='image/gif'&&file.size>3*1024*1024)throw Error('Escolha um GIF de até 3 MB.');
 const source=URL.createObjectURL(file);let bitmap;
 try{
  bitmap=await new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(Error('Esta imagem não pôde ser aberta. Escolha outra foto.'));image.src=source;});
  if(file.type==='image/gif')return dataUrl(file);
  const scale=Math.min(1,2048/Math.max(bitmap.naturalWidth,bitmap.naturalHeight));
  const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.naturalWidth*scale));canvas.height=Math.max(1,Math.round(bitmap.naturalHeight*scale));
  const context=canvas.getContext('2d');if(!context)throw Error('Não foi possível preparar a imagem neste navegador.');
  context.drawImage(bitmap,0,0,canvas.width,canvas.height);
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',0.86));
  if(!blob||blob.size>3*1024*1024)throw Error('Esta imagem ficou muito grande. Escolha uma foto menor.');
  return dataUrl(blob);
 }finally{URL.revokeObjectURL(source);}
}

export default function ImagePicker({label,value,onChange,call,purpose,disabled=false}){
 const input=useRef(null),root=useRef(null),operation=useRef(0),latest=useRef(onChange);
 const [busy,setBusy]=useState(false),[error,setError]=useState('');latest.current=onChange;
 useEffect(()=>()=>{operation.current++;},[]);
 useEffect(()=>{const form=root.current?.closest('form');if(!form||!busy)return;const stop=event=>{event.preventDefault();event.stopImmediatePropagation();setError('Aguarde o envio da imagem antes de salvar.');};form.addEventListener('submit',stop,true);return()=>form.removeEventListener('submit',stop,true);},[busy]);
 async function choose(event){const file=event.target.files?.[0];event.target.value='';if(!file)return;const job=++operation.current;setBusy(true);setError('');try{const dataUrl=await prepareGalleryImage(file);if(job!==operation.current)return;const result=await call('/media',{method:'POST',data:{purpose,dataUrl}});if(job===operation.current){if(!result.url)throw Error('O envio da imagem não foi confirmado.');latest.current(result.url);}}catch(failure){if(job===operation.current)setError(failure.message||'Não foi possível enviar a imagem.');}finally{if(job===operation.current)setBusy(false);}}
 return <div ref={root} className="image-picker" data-uploading={busy?'true':'false'} aria-busy={busy}><span className="image-picker-label">{label}</span><div className={`image-picker-preview${value?' has-image':''}`}>{value?<img key={value} src={value} alt={`Prévia: ${label}`} loading="lazy"/>:<><Icon name="image" size={28}/><span>Nenhuma imagem selecionada</span></>}</div><input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/gif" aria-label={`Escolher ${label.toLowerCase()} da galeria`} className="image-picker-input" onChange={choose} disabled={disabled||busy}/><div className="image-picker-actions"><button type="button" className="portal-outline" disabled={disabled||busy} onClick={()=>input.current?.click()}><Icon name="image" size={16}/>{busy?'Enviando imagem…':value?'Trocar imagem':'Escolher da galeria'}</button>{value&&<button type="button" className="portal-text-danger" disabled={disabled||busy} onClick={()=>{operation.current++;setError('');latest.current('');}}>Remover imagem</button>}</div>{busy&&<small role="status">Preparando e enviando sua imagem…</small>}{error&&<small role="alert" className="image-picker-error">{error}</small>}</div>;
}
