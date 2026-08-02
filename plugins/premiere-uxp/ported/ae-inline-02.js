
  (function(){
    try{
      if(typeof window==='undefined'||window.__adobe_cep__)return;   // faqat brauzer QA
      if(/[?&]ffcms/.test(location.search))return;                   // admin muharriri — saxna kerak emas
      var x=new XMLHttpRequest(); x.open('GET','_dev-ae-stage.html',false); x.send(null);
      if(x.status&&x.status>=400)return;
      var host=document.getElementById('demoStage'); if(!host)return;
      var tmp=document.createElement('div'); tmp.innerHTML=x.responseText;
      while(tmp.firstChild){
        var n=tmp.firstChild;
        // Uslublar head'ning BOSHIGA — kaskad tartibi avvalgidek qoladi (asosiy varaq
        // media/cep-mode qoidalari saxna uslublarini ustun qiladi).
        if(n.nodeType===1&&n.tagName==='STYLE')document.head.insertBefore(n,document.head.firstChild);
        else host.appendChild(n);   // .ae-app grid-column:1, badge esa position:fixed
      }
    }catch(e){ try{console.warn('[dev] Premiere QA saxnasi yuklanmadi:',e&&e.message);}catch(_){} }
  })();
  