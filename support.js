(() => {
  const byId=id=>document.getElementById(id);
  function showContent(content={}) {
    const enabled=String(content['donate-enabled']||'').toLowerCase()==='oui';
    const beneficiary=String(content['donate-beneficiary']||'').trim();
    const iban=String(content['donate-iban']||'').replace(/\s+/g,'').toUpperCase();
    const validIban=(()=>{if(!/^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/.test(iban))return false;const rearranged=iban.slice(4)+iban.slice(0,4);let remainder=0;for(const char of rearranged){const digits=char>='A'?(char.charCodeAt(0)-55).toString():char;for(const digit of digits)remainder=(remainder*10+Number(digit))%97;}return remainder===1})();
    const hasDetails=enabled&&beneficiary&&validIban;
    let paypalUrl='';
    try{const parsed=new URL(String(content['donate-paypal-url']||'').trim());if(parsed.protocol==='https:'&&['paypal.me','www.paypal.com','paypal.com'].includes(parsed.hostname)&&parsed.pathname!=='/')paypalUrl=parsed.href}catch{}
    if(content['donate-title'])byId('donate-title').textContent=content['donate-title'];
    if(content['donate-intro'])byId('donate-intro').textContent=content['donate-intro'];
    byId('transfer-card').hidden=!hasDetails;
    byId('support-unavailable').hidden=!!(hasDetails||paypalUrl);
    byId('paypal-card').hidden=!paypalUrl;
    if(paypalUrl)byId('paypal-link').href=paypalUrl;
    byId('transfer-card').hidden=!hasDetails;
    if(hasDetails){
      byId('transfer-beneficiary').textContent=beneficiary;
      byId('transfer-iban').textContent=iban.replace(/(.{4})/g,'$1 ').trim();
      const bic=String(content['donate-bic']||'').trim();
      byId('transfer-bic-row').hidden=!bic;
      byId('transfer-bic').textContent=bic;
      const reference=String(content['donate-reference']||'').trim();
      byId('transfer-reference-row').hidden=!reference;
      byId('transfer-reference').textContent=reference;
      byId('copy-iban').onclick=async()=>{try{await navigator.clipboard.writeText(iban);byId('transfer-status').textContent='IBAN copié.'}catch{byId('transfer-status').textContent='Copie automatique indisponible : sélectionne et copie l’IBAN.'}};
    }
  }
  window.RVCloud.ready.then(()=>{let content={};try{content=JSON.parse(localStorage.getItem('rv-content')||'{}')}catch{}showContent(content)});
})();
