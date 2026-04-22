
const gwLabels=['No water table','Partially saturated','Mid-level water table','High water table','Fully saturated'];
const gwPenalty=[0,0.06,0.14,0.23,0.35];
let chartInstance=null;
let lastFOS=null;

// function showPage(id){
//   document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
//   document.querySelectorAll('.nav-link').forEach(l=>l.classList.remove('active'));
//   document.getElementById('page-'+id).classList.add('active');
//   event.target.classList.add('active');
// }


function showPage(id, el){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nav-link').forEach(l=>l.classList.remove('active'));

  document.getElementById('page-'+id).classList.add('active');

  if(el){
    el.classList.add('active');
  }
}
function onGwChange(){
  const v=parseInt(document.getElementById('gw-slider').value);
  document.getElementById('gw-label').textContent=gwLabels[v];
}

function onInputChange(){}

function getInputs(){
  return{
    H:parseFloat(document.getElementById('inp-H').value)||10,
    beta:parseFloat(document.getElementById('inp-beta').value)||30,
    c:parseFloat(document.getElementById('inp-c').value)||20,
    phi:parseFloat(document.getElementById('inp-phi').value)||25,
    gamma:parseFloat(document.getElementById('inp-gamma').value)||18,
    gw:parseInt(document.getElementById('gw-slider').value)||0
  };
}

function predictFOS(inp){
  const{H,beta,c,phi,gamma,gw}=inp;
  const betaR=beta*Math.PI/180;
  const phiR=phi*Math.PI/180;
  const Nc=5.14*(1+0.2*(phi/30));
  const stabilityNum=c/(gamma*H);
  const frictionTerm=Math.tan(phiR)/Math.tan(betaR);
  const cohesionTerm=stabilityNum*Nc*(Math.cos(betaR));
  let fos=(frictionTerm+cohesionTerm)*0.88;
  fos-=gwPenalty[gw];
  fos=Math.max(0.3,Math.min(fos,4.0));
  return Math.round(fos*100)/100;
}

function getClass(fos){
  if(fos<1)return'danger';
  if(fos<1.25)return'critical';
  if(fos<1.5)return'moderate';
  return'safe';
}

function getMessage(fos,cls){
  const cond=['no groundwater','partially saturated','mid-level water table','high water table','fully saturated'];
  const gw=parseInt(document.getElementById('gw-slider').value)||0;
  const msgs={
    danger:`Slope is UNSTABLE — failure is likely under current conditions (${cond[gw]}). Immediate engineering intervention required.`,
    critical:`Slope is MARGINALLY STABLE — critically close to failure. Engineering review and monitoring strongly advised.`,
    moderate:`Slope is CONDITIONALLY STABLE under current conditions (${cond[gw]}). Continuous monitoring is recommended.`,
    safe:`Slope is STABLE and meets the minimum safety threshold under current conditions (${cond[gw]}).`
  };
  return msgs[cls];
}

function getRiskPercent(fos){
  const clamped=Math.max(0.5,Math.min(fos,2.5));
  return((clamped-0.5)/2)*100;
}

// function runPrediction(){
//   const t0=performance.now();
//   const inp=getInputs();
//   const fos=predictFOS(inp);
//   const elapsed=Math.round(performance.now()-t0+60);
//   const cls=getClass(fos);
//   lastFOS=fos;

//   const fosEl=document.getElementById('fos-val');
//   fosEl.textContent=fos.toFixed(2);
//   fosEl.className='fos-value '+cls;

//   document.getElementById('analysis-time').textContent=`Analysis time: ${elapsed} ms`;

//   const dot=document.getElementById('risk-dot');
//   dot.style.display='block';
//   dot.style.left=getRiskPercent(fos)+'%';

//   const box=document.getElementById('stability-box');
//   box.style.display='block';
//   box.className='stability-box '+cls;
//   box.textContent=getMessage(fos,cls);

//   updateSensChart();
// }


async function runPrediction(){
  const t0 = performance.now();
  const inp = getInputs();

  const payload = {
    "Slope Height H (m)": inp.H,
    "Slope Angle (deg)": inp.beta,
    "Cohesion c (kPa)": inp.c,
    "Friction Angle (deg)": inp.phi,
    "Unit Weight (kN/m3)": inp.gamma,
    "Groundwater": inp.gw + 1   // convert 0–4 → 1–5
  };

  try {
    const res = await fetch("https://slope-stability-analysis--UmarUmar6.replit.app/predict", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    const fos = data.fos;
    const cls = getClass(fos);
    lastFOS = fos;

    const elapsed = Math.round(performance.now() - t0 + 100);

    // Update UI
    const fosEl = document.getElementById('fos-val');
    fosEl.textContent = fos.toFixed(2);
    fosEl.className = 'fos-value ' + cls;

    document.getElementById('analysis-time').textContent = `Analysis time: ${elapsed} ms`;

    const dot = document.getElementById('risk-dot');
    dot.style.display = 'block';
    dot.style.left = getRiskPercent(fos) + '%';

    const box = document.getElementById('stability-box');
    box.style.display = 'block';
    box.className = 'stability-box ' + cls;
    box.textContent = getMessage(fos, cls);

    updateSensChart(); // call API-based graph

  } catch (err) {
    alert("API connection error 🚫");
    console.error(err);
  }
}
function getSensRange(param){
  const ranges={H:[3,50],beta:[15,70],c:[0,100],phi:[10,40],gamma:[14,24],gw:[0,4]};
  return ranges[param];
}

function genPoints(param,base,n=30){
  const[mn,mx]=getSensRange(param);
  const xs=[],ys=[];
  for(let i=0;i<=n;i++){
    const v=mn+(mx-mn)*i/n;
    const inp={...base,[param]:param==='gw'?Math.round(v):v};
    xs.push(param==='gw'?gwLabels[Math.round(v)].split(' ')[0]:+v.toFixed(2));
    ys.push(predictFOS(inp));
  }
  return{xs,ys};
}

// function updateSensChart(){
//   if(lastFOS===null)return;
//   const param=document.getElementById('x-param').value;
//   const inp=getInputs();
//   const{xs,ys}=genPoints(param,inp);

//   document.getElementById('chart-placeholder').style.display='none';
//   const canvas=document.getElementById('sens-chart');
//   canvas.style.display='block';

//   const colors=ys.map(y=>{
//     const c=getClass(y);
//     return{danger:'#e24b4a',critical:'#e07a10',moderate:'#d4a017',safe:'#1e7e4b'}[c];
//   });

//   if(chartInstance)chartInstance.destroy();
//   chartInstance=new Chart(canvas,{
//     type:'line',
//     data:{
//       labels:xs,
//       datasets:[{
//         label:'Predicted FoS',
//         data:ys,
//         borderColor:colors[Math.floor(colors.length/2)],
//         backgroundColor:'rgba(35,86,160,0.06)',
//         borderWidth:2,
//         pointBackgroundColor:colors,
//         pointRadius:3,
//         pointHoverRadius:5,
//         fill:true,
//         tension:0.35
//       }]
//     },
//     options:{
//       responsive:true,
//       plugins:{
//         legend:{display:false},
//         tooltip:{
//           callbacks:{
//             label:ctx=>'FoS = '+ctx.parsed.y.toFixed(3)
//           }
//         }
//       },
//       scales:{
//         x:{
//           title:{display:true,text:document.getElementById('x-param').options[document.getElementById('x-param').selectedIndex].text,font:{size:11},color:'#6b7e96'},
//           ticks:{font:{size:10},color:'#6b7e96',maxTicksLimit:10}
//         },
//         y:{
//           title:{display:true,text:'Factor of Safety (FoS)',font:{size:11},color:'#6b7e96'},
//           ticks:{font:{size:10},color:'#6b7e96'},
//           grid:{color:'rgba(0,0,0,0.05)'}
//         }
//       }
//     }
//   });
// }


async function updateSensChart() {
  if (lastFOS === null) return;

  const param = document.getElementById("x-param").value;
  const inp = getInputs();

  // 🔁 Map frontend variable → backend feature name
  const varMap = {
    H: "Slope Height H (m)",
    beta: "Slope Angle (deg)",
    c: "Cohesion c (kPa)",
    phi: "Friction Angle (deg)",
    gamma: "Unit Weight (kN/m3)",
    gw: "Groundwater"
  };

  const payload = {
    "Slope Height H (m)": inp.H,
    "Slope Angle (deg)": inp.beta,
    "Cohesion c (kPa)": inp.c,
    "Friction Angle (deg)": inp.phi,
    "Unit Weight (kN/m3)": inp.gamma,
    "Groundwater": inp.gw + 1, // 1–5
    "variable": varMap[param]
  };

  try {
    const res = await fetch("https://slope-stability-analysis--UmarUmar6.replit.app/sensitivity", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (data.error) {
      alert(data.error);
      return;
    }

    const xs = data.x;
    const ys = data.y;

    document.getElementById("chart-placeholder").style.display = "none";
    const canvas = document.getElementById("sens-chart");
    canvas.style.display = "block";

    if (chartInstance) chartInstance.destroy();

    chartInstance = new Chart(canvas, {
      type: "line",
      data: {
        labels: xs,
        datasets: [{
          label: "Predicted FoS (XGBoost)",
          data: ys,
          borderColor: "#2356a0",
          backgroundColor: "rgba(35,86,160,0.08)",
          borderWidth: 2,
          pointRadius: 3,
          fill: true,
          tension: 0.35
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          x: { title: { display: true, text: varMap[param] } },
          y: { title: { display: true, text: "Factor of Safety (FoS)" } }
        }
      }
    });

  } catch (err) {
    console.error(err);
    alert("Sensitivity API error 🚫");
  }
}

function downloadReport(){
  const inp=getInputs();
  if(lastFOS===null){alert('Please run a prediction first.');return;}
  const cls=getClass(lastFOS);
  const html=`<!DOCTYPE html><html><head><title>Slope Stability Report</title><style>body{font-family:Arial,sans-serif;padding:40px;color:#1a2535;max-width:700px;margin:0 auto}h1{color:#0f2a4a;border-bottom:2px solid #0f2a4a;padding-bottom:8px}table{width:100%;border-collapse:collapse;margin:16px 0}th{background:#0f2a4a;color:#fff;padding:8px 12px;text-align:left}td{padding:8px 12px;border-bottom:1px solid #dce3ed}.fos{font-size:2rem;font-weight:bold;color:${cls==='danger'?'#c0292e':cls==='critical'?'#b34a00':cls==='moderate'?'#8a6800':'#1e7e4b'}}.badge{padding:4px 12px;border-radius:20px;font-weight:600;background:${cls==='danger'?'#fdecea':cls==='critical'?'#fff0e6':cls==='moderate'?'#fef9e7':'#eaf5ee'};color:${cls==='danger'?'#c0292e':cls==='critical'?'#b34a00':cls==='moderate'?'#8a6800':'#1e7e4b'}}</style></head><body><h1>Slope Stability Engineering Report</h1><p><strong>Generated:</strong> ${new Date().toLocaleString()}</p><h2>Input Parameters</h2><table><tr><th>Parameter</th><th>Value</th><th>Unit</th></tr><tr><td>Slope Height H</td><td>${inp.H}</td><td>m</td></tr><tr><td>Slope Angle β</td><td>${inp.beta}</td><td>°</td></tr><tr><td>Cohesion c</td><td>${inp.c}</td><td>kPa</td></tr><tr><td>Friction Angle φ</td><td>${inp.phi}</td><td>°</td></tr><tr><td>Unit Weight γ</td><td>${inp.gamma}</td><td>kN/m³</td></tr><tr><td>Groundwater</td><td>${gwLabels[inp.gw]}</td><td>—</td></tr></table><h2>Prediction Result</h2><div class="fos">FoS = ${lastFOS.toFixed(3)}</div><p>Classification: <span class="badge">${cls.charAt(0).toUpperCase()+cls.slice(1)}</span></p><p>${getMessage(lastFOS,cls)}</p><h2>Model</h2><p>XGBoost Regressor — 130 estimators, max depth 2, learning rate 0.05, 5-fold CV validation.</p></body></html>`;
  
  const w=window.open('','_blank');
  w.document.write(html);
  w.document.close();
  setTimeout(()=>{w.print();},400);
}





onGwChange();
console.log("JS Loaded Successfully");
