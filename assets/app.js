const cn={"AF":"Afghanistan","AL":"Albania","DZ":"Algeria","AR":"Argentina","AU":"Australia","AT":"Austria","BD":"Bangladesh","BE":"Belgium","BO":"Bolivia","BR":"Brazil","CA":"Canada","CL":"Chile","CN":"China","CO":"Colombia","CR":"Costa Rica","CU":"Cuba","CZ":"Czechia","DK":"Denmark","DO":"Dominican Republic","EC":"Ecuador","EG":"Egypt","FI":"Finland","FR":"France","DE":"Germany","GH":"Ghana","GR":"Greece","GT":"Guatemala","GY":"Guyana","HT":"Haiti","HN":"Honduras","HK":"Hong Kong","HU":"Hungary","IN":"India","ID":"Indonesia","IE":"Ireland","IL":"Israel","IT":"Italy","JM":"Jamaica","JP":"Japan","KE":"Kenya","KR":"South Korea","LB":"Lebanon","MX":"Mexico","MA":"Morocco","NL":"Netherlands","NZ":"New Zealand","NG":"Nigeria","NO":"Norway","PK":"Pakistan","PA":"Panama","PE":"Peru","PH":"Philippines","PL":"Poland","PT":"Portugal","PR":"Puerto Rico","RO":"Romania","RU":"Russia","SA":"Saudi Arabia","SN":"Senegal","SG":"Singapore","ZA":"South Africa","ES":"Spain","SE":"Sweden","CH":"Switzerland","TW":"Taiwan","TH":"Thailand","TT":"Trinidad and Tobago","TR":"Turkey","UA":"Ukraine","AE":"UAE","GB":"United Kingdom","US":"United States","UY":"Uruguay","VE":"Venezuela","VN":"Vietnam"};
function setField(id,val){var el=document.getElementById(id);if(el){el.innerHTML=val;}}
function flagImg(cc){if(!cc)return'';return '<img src="https://flagcdn.com/20x15/'+cc.toLowerCase()+'.png" style="vertical-align:middle;margin-right:4px;" alt="'+cc+'">';}
async function fetchIP(){
  try{
    const r=await fetch('https://api.db-ip.com/v2/free/self');
    const d=await r.json();
    var ip=d.ipAddress,cc=d.countryCode,country=d.countryName||cn[cc]||cc,city=d.city||'—',region=d.stateProv||'',ver=ip.includes(':')?'IPv6':'IPv4',org='—';
    try{const r2=await fetch('https://ipinfo.io/json');const d2=await r2.json();org=(d2.org||'').replace(/^AS\d+\s*/,'')||'—';}catch(e){}
    window._ip=ip;
    setField('ipDisplay',ip);
    setField('metaISP',org);
    setField('metaCountry',flagImg(cc)+country);
    setField('metaCity',city+', '+region);
    setField('ipType',ver+' Address');
  }catch(e){
    try{
      const r=await fetch('https://ipinfo.io/json');
      const d=await r.json();
      window._ip=d.ip;
      setField('ipDisplay',d.ip);
      setField('metaISP',(d.org||'').replace(/^AS\d+\s*/,''));
      setField('metaCountry',flagImg(d.country)+(cn[d.country]||d.country));
      setField('metaCity',(d.city||'—')+', '+(d.region||''));
      setField('ipType',(d.ip.includes(':')?'IPv6':'IPv4')+' Address');
    }catch(e2){
      setField('ipDisplay','Unable to detect');
    }
  }
}
fetchIP();
setTimeout(fetchIP,3000);
function copyIP(){navigator.clipboard.writeText(window._ip||'').then(()=>showToast('✓ Copied!'));}
function switchTab(btn,id){btn.closest('.lookup-card').querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));btn.closest('.lookup-card').querySelectorAll('.tab-panel').forEach(p=>p.classList.remove('active'));btn.classList.add('active');document.getElementById(id).classList.add('active');}
function showToast(msg){const el=document.getElementById('toast');el.textContent=msg;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),2000);}
function setCookies(yes){localStorage.setItem('cookieConsent',yes?'1':'0');document.getElementById('cookieBanner').style.display='none';if(yes)loadAnalytics();}
function loadAnalytics(){const s=document.createElement('script');s.src='https://www.googletagmanager.com/gtag/js?id=G-J2Z9RR5FJ3';s.async=true;document.head.appendChild(s);s.onload=()=>{window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-J2Z9RR5FJ3');};}
const consent=localStorage.getItem('cookieConsent');
if(consent==='1')loadAnalytics();else if(consent===null)document.getElementById('cookieBanner').style.display='flex';
