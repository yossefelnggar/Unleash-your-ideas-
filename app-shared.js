import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged, updateProfile, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { getDatabase, ref, push, set, update, remove, onValue, get } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-database.js";

const firebaseConfig = {
  apiKey:"AIzaSyAAM11KB7jbdZC0EiPyOgIawxzGZITgMA8",
  authDomain:"flash-feedback-9c529.firebaseapp.com",
  databaseURL:"https://flash-feedback-9c529-default-rtdb.europe-west1.firebasedatabase.app",
  projectId:"flash-feedback-9c529",
  storageBucket:"flash-feedback-9c529.firebasestorage.app",
  messagingSenderId:"1026286586523",
  appId:"1:1026286586523:web:b76e33473c260fc4d7143e",
  measurementId:"G-R93914YBXY"
};

// ====== إعدادات بسيطة قبل الإطلاق ======
let SUPPORT_URL = ""; // يُقرأ ويُحدَّث من admin.html
const DEFAULT_IMAGE = "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=1000&q=80";
const CATEGORIES = [
  {name:"التقنية والبرمجة", icon:"💻", bg:"rgba(56,162,140,.16)"},
  {name:"الذكاء الاصطناعي", icon:"🤖", bg:"rgba(214,134,68,.16)"},
  {name:"ريادة الأعمال",    icon:"🚀", bg:"rgba(239,167,91,.16)"},
  {name:"التصميم والإبداع", icon:"🎨", bg:"rgba(34,197,94,.16)"},
  {name:"السفر والمغامرات", icon:"🧭", bg:"rgba(56,189,248,.16)"}
];
// مراحل تقدم الفكرة، بترتيب واضح من فكرة خام لمشروع مُطلق فعليًا
const STAGES = [
  {key:"idea",     label:"💡 فكرة",          short:"فكرة"},
  {key:"team",     label:"👥 بحث عن فريق",   short:"بحث عن فريق"},
  {key:"progress", label:"🛠️ قيد التطوير",   short:"قيد التطوير"},
  {key:"launched", label:"🚀 مشروع مُطلق",   short:"مُطلق"}
];
function stageIndex(status){const i=STAGES.findIndex(s=>s.key===status);return i<0?0:i}
function stageInfo(status){return STAGES[stageIndex(status)]}

const app=initializeApp(firebaseConfig), auth=getAuth(app), db=getDatabase(app);
const provider=new GoogleAuthProvider();
let currentUser=null, allIdeas=[], allUsers=[], allReports=[], allPosts=[], selectedIdeaId=null, editingIdeaId=null, signup=false, feedTab="latest", commentCounts={}, pendingAction=null, authReady=false, adminMap={}, verifiedMap={}, notifMap={}, savesMap={}, notifUnsub=null, savesUnsub=null, followsUnsub=null, blocksUnsub=null, referralsUnsub=null, ideasPage=1, searchDebounce=null, uploadedImageUrl="", followsMap={}, blocksMap={}, viewingProfileUid=null, dmTargetUid=null, dmUnsub=null, profilePhotoUploading=false, reviewsCache={}, socialTab="latest", postImageUrl="", connectionRequestsMap={}, connectionsMap={}, connectionsUnsub=null, joinTargetId=null, allReviewsMap={};
const IMGBB_KEY="c9abb72da3c37b1c5cc01736f78ac808";
const PAGE_SIZE=12;
// ====== إعدادات الحماية والحدود ======
const IDEA_COOLDOWN_MS=2*60*1000;      // مهلة بين نشر فكرة وأخرى لكل مستخدم
const COMMENT_COOLDOWN_MS=8*1000;      // مهلة بين تعليق وآخر
const MAX_OPEN_IDEAS=6;                // أقصى عدد أفكار غير مؤرشفة/مطلقة لكل مستخدم
// المصادر التعليمية (مكتبة موارد ثابتة، بدون قاعدة بيانات)
const LEARN_ARTICLES=[
 {icon:"✍️",title:"إزاي تكتب فكرة تقنع الناس",body:"ابدأ بالمشكلة قبل الحل، وضّح مين المتضرر منها ولماذا الحل الحالي غير كافٍ. اكتب وصفك في جملتين تجيبان على: مين، مشكلة إيه، وليه دلوقتي. استخدم أرقام أو أمثلة حقيقية بدل الكلام العام، وخلّي عنوان الفكرة يوضح النتيجة مش بس الأداة."},
 {icon:"🛠️",title:"إزاي تبني MVP بأقل إمكانيات",body:"اختر أصغر نسخة تحل جزء واحد حقيقي من المشكلة، ولو محتاج تعمله يدويًا الأول (Concierge MVP) قبل ما تكتب كود. حدد مقياس نجاح واحد قبل البدء، وحاول تطلقه خلال أسبوعين لا أكتر."},
 {icon:"👥",title:"إزاي تكوّن فريق مناسب لفكرتك",body:"ابحث عن مهارات تكمّل نقاط ضعفك مش تكرر نفس مهاراتك. كن واضح من البداية عن الوقت المطلوب والتوقعات، واتفقوا على طريقة تواصل ثابتة (اجتماع أسبوعي مثلاً) من أول يوم."},
 {icon:"🎯",title:"إزاي تحدد السوق المستهدف بدقة",body:"تجنب وصف عام زي 'كل الناس'. حدد شريحة أولى ضيقة تقدر توصلها فعليًا، وجرّب تتكلم مع 5-10 أشخاص منها قبل ما تبدأ التطوير عشان تتأكد إن المشكلة حقيقية."},
 {icon:"🤝",title:"إزاي تعرض فكرتك على مستثمر أو شريك",body:"استخدم وضع 'العرض التقديمي' في صفحة الفكرة لعرض نسخة نظيفة بدون واجهة المنصة. ركّز على المشكلة، الحل، وليه أنت الشخص المناسب لتنفيذه، في أقل من دقيقتين كلام."}
];

const $=id=>document.getElementById(id);
function toast(msg,type){
 const icons={success:"✅",error:"⚠️",info:"💬"};
 const colors={success:"#22c55e",error:"#f43f5e",info:"#38A28C"};
 $("toast").innerHTML=`${icons[type]||"💬"} <span>${msg}</span>`;
 $("toast").style.borderInlineStart=`3px solid ${colors[type]||"#38A28C"}`;
 $("toast").classList.add("show");
 clearTimeout(window.__toastT);
 window.__toastT=setTimeout(()=>$("toast").classList.remove("show"),3000);
}
function skeletons(n){return Array.from({length:n}).map(()=>'<div class="skeleton"></div>').join("")}
let dataReady=false;
window.toggleTheme=()=>{
 const cur=document.documentElement.getAttribute("data-theme")==="light"?"dark":"light";
 document.documentElement.setAttribute("data-theme",cur);
 localStorage.setItem("theme",cur);
 $("themeToggleBtn").textContent=cur==="light"?"☀️":"🌙";
};
(()=>{const saved=localStorage.getItem("theme");if(saved==="light"){document.documentElement.setAttribute("data-theme","light");}})();
if(localStorage.getItem("theme")==="light"&&$("themeToggleBtn"))$("themeToggleBtn").textContent="☀️";

/* ---------- تثبيت التطبيق (PWA) ---------- */
let deferredInstallPrompt=null;
window.addEventListener("beforeinstallprompt",(e)=>{
 e.preventDefault();deferredInstallPrompt=e;
 if(!localStorage.getItem("pwaInstalled"))$("installAppBtn")?.classList.remove("hidden");
});
window.installApp=async()=>{
 if(!deferredInstallPrompt){toast("افتح المتصفح من القائمة ⋮ واختر «إضافة إلى الشاشة الرئيسية»");return}
 deferredInstallPrompt.prompt();
 const choice=await deferredInstallPrompt.userChoice;
 if(choice?.outcome==="accepted"){toast("🎉 جاري تثبيت التطبيق","success");localStorage.setItem("pwaInstalled","1")}
 deferredInstallPrompt=null;$("installAppBtn")?.classList.add("hidden");
};
window.addEventListener("appinstalled",()=>{localStorage.setItem("pwaInstalled","1");$("installAppBtn")?.classList.add("hidden")});
if("serviceWorker" in navigator){
 window.addEventListener("load",()=>{navigator.serviceWorker.register("sw.js").catch(()=>{})});
}

/* ---------- عدّاد حروف حي لحقول الكتابة ---------- */
function initCharCounters(){
 document.querySelectorAll("textarea[maxlength],input[maxlength]").forEach(el=>{
  if(el.dataset.counterInit)return;el.dataset.counterInit="1";
  const max=Number(el.getAttribute("maxlength"));
  const counter=document.createElement("div");
  counter.className="charcounter";
  const update=()=>{const len=el.value.length;counter.textContent=`${len} / ${max}`;counter.classList.toggle("warn",len>=max*0.9)};
  el.insertAdjacentElement("afterend",counter);
  el.addEventListener("input",update);
  update();
 });
}
document.addEventListener("DOMContentLoaded",initCharCounters);
if(document.readyState==="interactive"||document.readyState==="complete")initCharCounters();
function openModal(id){const el=$(id);if(el)el.classList.add("open")}
function closeModal(id){const el=$(id);if(!el)return;el.classList.remove("open");if(id==="detailModal"&&location.hash.startsWith("#idea-"))history.pushState(null,"",location.pathname);if(id==="ideaModal")resetIdeaForm();if(id==="dmModal"&&dmUnsub){dmUnsub();dmUnsub=null;dmTargetUid=null}}
window.closeModal=closeModal;

const PAGE_FILES={home:"index.html",ideas:"ideas.html",projects:"projects.html",people:"people.html",community:"community.html",stories:"stories.html",museum:"museum.html",learn:"learn.html",leaderboard:"leaderboard.html",profile:"profile.html",notifications:"notifications.html"};
function renderCurrentPage(){
 const id=document.body.dataset.page;
 if(id==="home")renderHome(); if(id==="ideas")renderIdeas(); if(id==="projects")renderProjects(); if(id==="profile")renderProfile();
 if(id==="people")renderPeople(); if(id==="community")renderCommunity();
 if(id==="notifications")renderNotifications();
 if(id==="leaderboard")renderLeaderboard();
 if(id==="stories")renderStories(); if(id==="museum")renderMuseum(); if(id==="learn")renderLearn();
}
window.goToCategory=(name)=>{
 if(document.body.dataset.page==="ideas"){
  const el=$("category"); if(el)el.value=name; ideasPage=1; renderIdeas();
  window.scrollTo({top:0,behavior:"smooth"});
  return;
 }
 location.href="ideas.html?category="+encodeURIComponent(name);
};
window.showPage=(id)=>{
  if(id==="admin"){ if(!currentUser){pendingAction="page:admin";toast("سجّل الدخول أولاً","info");openAuthMode("login");return} if(!isAdmin()){toast("هذه الصفحة للأدمن فقط","error");return} location.href="admin.html"; return }
  if((id==="profile"||id==="notifications")&&!currentUser){pendingAction="page:"+id;toast("سجّل الدخول أولاً","info");openAuthMode("login");return}
  if(document.body.dataset.page===id){
   window.scrollTo(0,0);
   document.querySelectorAll(".mobile-nav [data-nav]").forEach(b=>b.classList.toggle("active",b.dataset.nav===id));
   renderCurrentPage();
   return;
  }
  location.href=PAGE_FILES[id]||"index.html";
};
window.openAuth=()=>openModal("authModal");
window.openAuthMode=(mode)=>{
 signup=(mode==="signup");
 $("authTitle").textContent=signup?"إنشاء حساب":"تسجيل الدخول";
 $("authBtn").textContent=signup?"إنشاء الحساب":"دخول";
 $("authSwitch").textContent=signup?"لديك حساب بالفعل؟":"ليس لديك حساب؟";
 document.querySelector("#authSwitch + a").textContent=signup?"تسجيل الدخول":"تسجيل حساب جديد";
 openModal("authModal");
};
window.openSupport=()=>openModal("supportModal");

function isAdmin(){return currentUser && !!adminMap[currentUser.uid]}
function renderHeaderAuth(){
 const user=currentUser;
 const unread=user?Object.values(notifMap).filter(n=>!n.read).length:0;
 $("desktopAuth").innerHTML=user?
 `<button class="btn ghost sm iconbtn" style="position:relative" onclick="showPage('notifications')" aria-label="الإشعارات">🔔${unread?`<span class="notifbadge">${unread}</span>`:""}</button>
 <button class="accountbtn" onclick="openAccountSheet()" aria-label="حسابي وإعدادات الحساب">
   <img class="avatar" src="${safeAttr(user.photoURL||avatar(user.uid))}">
   <span class="accountbtn-name">${escapeHtml(user.displayName||"حسابي")}${isAdmin()?" 👑":""}</span>
 </button>`
 :`<div style="display:flex;gap:8px"><button class="btn" onclick="openAuthMode('signup')">انضم الآن</button><button class="btn ghost sm" onclick="openAuthMode('login')">تسجيل الدخول</button></div>`;
 $("notifDotMobile")?.classList.toggle("hidden",!unread);
 if(user)upsertSavedAccount(user);
}

/* ---------- حساب: قائمة الحساب + تبديل الحسابات ---------- */
function getSavedAccounts(){try{return JSON.parse(localStorage.getItem("savedAccounts")||"[]")}catch(e){return[]}}
function setSavedAccounts(list){try{localStorage.setItem("savedAccounts",JSON.stringify(list.slice(0,6)))}catch(e){}}
function upsertSavedAccount(user){
 if(!user)return;
 const list=getSavedAccounts().filter(a=>a.uid!==user.uid);
 list.unshift({uid:user.uid,email:user.email||"",displayName:user.displayName||(user.email?user.email.split("@")[0]:"مستخدم"),photoURL:user.photoURL||avatar(user.uid)});
 setSavedAccounts(list);
}
window.removeSavedAccount=(uid,ev)=>{
 ev?.stopPropagation();
 setSavedAccounts(getSavedAccounts().filter(a=>a.uid!==uid));
 renderAccountSheet();
};
window.openAccountSheet=()=>{if(!currentUser)return;renderAccountSheet();openModal("accountModal")};
function renderAccountSheet(){
 const user=currentUser;
 if(!user)return;
 const saved=getSavedAccounts();
 $("accountSheetContent").innerHTML=`
 <div style="display:flex;align-items:center;gap:12px;padding:2px 0 16px">
  <img class="avatar" style="width:52px;height:52px" src="${safeAttr(user.photoURL||avatar(user.uid))}">
  <div style="flex:1;min-width:0">
    <b style="display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(user.displayName||"مستخدم")}${isAdmin()?" 👑":""}</b>
    <span class="muted" style="font-size:12.5px;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(user.email||"")}</span>
  </div>
 </div>
 <div class="accountmenu">
   <button class="accountmenu-item" onclick="closeModal('accountModal');showPage('profile')">👤 ملفي الشخصي</button>
   <button class="accountmenu-item" onclick="closeModal('accountModal');showPage('notifications')">🔔 الإشعارات</button>
   ${isAdmin()?`<button class="accountmenu-item" onclick="closeModal('accountModal');showPage('admin')">👑 لوحة الإدارة</button>`:""}
 </div>
 <div class="section-head" style="margin-top:16px;margin-bottom:8px"><h3 style="font-size:14px">🔁 تبديل الحساب</h3></div>
 <div class="accountlist">
 ${saved.map(a=>`<div class="accountrow ${a.uid===user.uid?"is-current":""}" ${a.uid===user.uid?"":`onclick="switchAccount('${a.uid}','${safeAttr(a.email).replace(/'/g,"")}')"`}>
   <img class="avatar" src="${safeAttr(a.photoURL||avatar(a.uid))}">
   <div style="flex:1;min-width:0"><b style="display:block;font-size:13.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(a.displayName)}</b><span class="muted" style="font-size:11.5px;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(a.email)}</span></div>
   ${a.uid===user.uid?'<span class="pill" style="font-size:10.5px">الحالي</span>':`<button class="btn ghost sm" onclick="removeSavedAccount('${a.uid}',event);event.stopPropagation()" aria-label="إزالة من القائمة" title="إزالة من القائمة">✕</button>`}
 </div>`).join("")}
 </div>
 <button class="btn secondary" style="width:100%;margin-top:12px" onclick="addAnotherAccount()">➕ إضافة حساب آخر</button>
 <button class="btn danger" style="width:100%;margin-top:10px" onclick="logout()">🚪 تسجيل الخروج</button>`;
}
window.switchAccount=async(uid,email)=>{
 closeModal("accountModal");
 await signOut(auth);
 openAuthMode("login");
 setTimeout(()=>{if($("authEmail")){$("authEmail").value=email;$("authPassword")?.focus()}},60);
 toast("أدخل كلمة المرور للتبديل لهذا الحساب","info");
};
window.addAnotherAccount=async()=>{
 closeModal("accountModal");
 await signOut(auth);
 openAuthMode("login");
};
window.requireAuth=(action)=>{
  if(!currentUser){pendingAction=action;toast("سجّل الدخول أولاً","info");openAuthMode("login");return}
  if(action==="idea"){resetIdeaForm();openModal("ideaModal")}
};

window.toggleAuth=()=>{
 signup=!signup;
 $("authTitle").textContent=signup?"إنشاء حساب":"تسجيل الدخول";
 $("authBtn").textContent=signup?"إنشاء الحساب":"دخول";
 $("authSwitch").textContent=signup?"لديك حساب بالفعل؟":"ليس لديك حساب؟";
 document.querySelector("#authSwitch + a").textContent=signup?"تسجيل الدخول":"تسجيل حساب جديد";
};
window.emailAuth=async()=>{
 const email=$("authEmail").value.trim(), password=$("authPassword").value;
 if(!email||!email.includes("@")){toast("أدخل بريدًا إلكترونيًا صحيحًا");return}
 if(password.length<6){toast("كلمة المرور 6 أحرف على الأقل");return}
 $("authBtn").disabled=true;
 try{
  if(signup){
   const c=await createUserWithEmailAndPassword(auth,email,password);
   await updateProfile(c.user,{displayName:email.split("@")[0]});
   const refUid=getReferrerUid();
   await set(ref(db,"users/"+c.user.uid),{uid:c.user.uid,email,displayName:email.split("@")[0],createdAt:Date.now(),...(refUid?{referredBy:refUid}:{})});
   if(refUid&&refUid!==c.user.uid)set(ref(db,`referrals/${refUid}/${c.user.uid}`),Date.now());
   toast("🎉 تم إنشاء الحساب بنجاح","success");
   setTimeout(openOnboarding,400);
  }else{
   await signInWithEmailAndPassword(auth,email,password);
   toast("👋 مرحبًا بعودتك","success");
  }
  $("authEmail").value="";$("authPassword").value="";
  closeModal("authModal");
 }catch(e){toast("خطأ: "+friendlyError(e),"error")}
 finally{$("authBtn").disabled=false}
};
window.googleAuth=async()=>{
 try{
  const cred=await signInWithPopup(auth,provider);
  closeModal("authModal");toast("👋 تم تسجيل الدخول","success");
  const snap=await get(ref(db,"users/"+cred.user.uid));
  const data=snap.val();
  if(!data){
   const refUid=getReferrerUid();
   await set(ref(db,"users/"+cred.user.uid),{uid:cred.user.uid,email:cred.user.email,displayName:cred.user.displayName||cred.user.email.split("@")[0],createdAt:Date.now(),...(refUid?{referredBy:refUid}:{})});
   if(refUid&&refUid!==cred.user.uid)set(ref(db,`referrals/${refUid}/${cred.user.uid}`),Date.now());
  }
  if(!data?.interests)setTimeout(openOnboarding,400);
 }catch(e){toast("فشل Google: "+friendlyError(e),"error")}
};
window.resetPassword=async()=>{
 const email=$("authEmail").value.trim();
 if(!email||!email.includes("@")){toast("اكتب بريدك الإلكتروني أولًا فوق");return}
 try{await sendPasswordResetEmail(auth,email);toast("📩 تم إرسال رابط استعادة كلمة المرور إلى بريدك","success")}
 catch(e){toast("خطأ: "+friendlyError(e),"error")}
};
window.logout=async()=>{closeModal("accountModal");await signOut(auth);toast("تم تسجيل الخروج","info");showPage("home")};
function friendlyError(e){
 const m=e?.code||"";
 if(m.includes("auth/invalid-credential")||m.includes("auth/wrong-password")||m.includes("auth/user-not-found"))return"بيانات الدخول غير صحيحة";
 if(m.includes("auth/email-already-in-use"))return"البريد مستخدم بالفعل، جرّب تسجيل الدخول";
 if(m.includes("auth/weak-password"))return"كلمة المرور ضعيفة";
 if(m.includes("auth/too-many-requests"))return"محاولات كثيرة، حاول لاحقًا";
 if(m.includes("auth/popup-closed-by-user"))return"تم إغلاق نافذة Google قبل إتمام الدخول";
 return e?.message||"حدث خطأ";
}

onAuthStateChanged(auth,async user=>{
 if(user){
  try{
   const susSnap=await get(ref(db,"suspended/"+user.uid));
   if(susSnap.exists()){await signOut(auth);toast("تم تعليق هذا الحساب من قبل الإدارة","error");return}
  }catch(e){}
 }
 currentUser=user;
 renderHeaderAuth();
 renderProfile(); renderNotifications();
 [notifUnsub,savesUnsub,followsUnsub,blocksUnsub,referralsUnsub,connectionsUnsub].forEach(unsub=>{if(typeof unsub==="function")unsub()});
 notifUnsub=savesUnsub=followsUnsub=blocksUnsub=referralsUnsub=connectionsUnsub=null;
 if(user){
  notifUnsub=onValue(ref(db,`notifications/${user.uid}`),snap=>{notifMap=snap.val()||{};renderHeaderAuth();renderNotifications()});
  savesUnsub=onValue(ref(db,`saves/${user.uid}`),snap=>{savesMap=snap.val()||{};renderIdeas();renderHome();renderProjects();renderProfile()});
  followsUnsub=onValue(ref(db,`follows/${user.uid}`),snap=>{followsMap=snap.val()||{};if(viewingProfileUid)renderPublicProfile(viewingProfileUid)});
  blocksUnsub=onValue(ref(db,`blocks/${user.uid}`),snap=>{blocksMap=snap.val()||{};if(viewingProfileUid)renderPublicProfile(viewingProfileUid)});
  referralsUnsub=onValue(ref(db,`referrals/${user.uid}`),snap=>{referralsMap=snap.val()||{};renderProfile()});
  connectionsUnsub=onValue(ref(db,`connectionRequests/${user.uid}`),snap=>{connectionRequestsMap=snap.val()||{};renderCommunity()});
 }else{notifMap={};savesMap={};followsMap={};blocksMap={};referralsMap={};connectionRequestsMap={};renderHeaderAuth()}
 if(user&&authReady&&pendingAction){
  if(pendingAction==="idea")openModal("ideaModal");
  else if(pendingAction.startsWith("page:"))showPage(pendingAction.split(":")[1]);
  pendingAction=null;
 }
 authReady=true;
 hideAppLoader();
});
function hideAppLoader(){$("appLoader")?.classList.add("hide")}
setTimeout(hideAppLoader,4000); // شبكة بطيئة أو مشكلة اتصال: منعرّض المستخدم لسبينر بلا نهاية
onValue(ref(db,"admins"),snap=>{adminMap=snap.val()||{};renderHeaderAuth();renderProfile();renderAdmin(currentAdminTab)});
onValue(ref(db,"verified"),snap=>{verifiedMap=snap.val()||{};renderProfile();if(viewingProfileUid)renderPublicProfile(viewingProfileUid)});
onValue(ref(db,"reviews"),snap=>{allReviewsMap=snap.val()||{};renderProfile();if(viewingProfileUid)renderPublicProfile(viewingProfileUid)});
function verifiedBadge(uid){return verifiedMap[uid]?' <span class="verified-badge" title="حساب موثّق">✔️</span>':""}
window.toggleVerified=async(uid)=>{
 if(!isAdmin())return;
 if(verifiedMap[uid]){await remove(ref(db,"verified/"+uid));verifiedMap={...verifiedMap};delete verifiedMap[uid]}
 else{await set(ref(db,"verified/"+uid),true);verifiedMap={...verifiedMap,[uid]:true}}
 renderAdmin("users");
};
onValue(ref(db,"config"),snap=>{const c=snap.val()||{};if(c.supportUrl!==undefined)SUPPORT_URL=c.supportUrl;const n=$("siteNotice");if(n){n.textContent=c.announcement||"";n.classList.toggle("hidden",!c.announcement);if(c.maintenance&&!isAdmin()){n.textContent="⚠️ المنصة في وضع الصيانة حاليًا — بعض الوظائف قد تكون غير متاحة."+(c.announcement?" "+c.announcement:"");n.classList.remove("hidden")}}});
function notify(toUid,type,ideaId,ideaTitle){
 if(!toUid||toUid===currentUser?.uid)return;
 const msgs={like:"أعجب بفكرتك",comment:"علّق على فكرتك",join:"مهتم بالانضمام لفكرتك",update:"أضاف تحديثًا جديدًا",follow:"بدأ متابعتك",message:"أرسل لك رسالة",accepted:"قبِلك في فريق مشروعه",mention:"ذكرك في تعليق",connection:"يريد التواصل معك"};
 push(ref(db,`notifications/${toUid}`),{type,ideaId,ideaTitle,fromName:currentUser?.displayName||currentUser?.email?.split("@")[0]||"مستخدم",text:msgs[type]||"",createdAt:Date.now(),read:false}).catch(e=>console.warn("notification failed",e));
}
function renderTeamSection(x,interested,isOwner){
 const accepted=interested.filter(([,v])=>v.status==="accepted");
 const pending=interested.filter(([,v])=>!v.status||v.status==="pending");
 const rejected=interested.filter(([,v])=>v.status==="rejected");
 let html="";
 if(accepted.length){
  html+=`<div class="divider"></div><h3>👥 الفريق الحالي (${accepted.length})</h3><div style="margin-top:10px">${accepted.map(([uid,v])=>`
   <div class="comment"><div class="commenthead"><img class="avatar" src="${safeAttr(v.avatar||avatar(v.name))}">${escapeHtml(v.name)}${v.role?` <span class="tag" style="margin-inline-start:6px">${escapeHtml(v.role)}</span>`:""}${isOwner?`<button class="btn ghost sm" style="margin-inline-start:auto;padding:3px 8px" onclick="openDM('${uid}','${escapeHtml(v.name).replace(/'/g,"")}')">💬 رسالة</button>`:""}</div></div>`).join("")}</div>`;
 }
 if(isOwner){
  html+=`<div class="divider"></div><h3>🙋 طلبات الانضمام (${pending.length})</h3>
  <div style="margin-top:10px">${pending.length?pending.map(([uid,v])=>`<div class="comment"><div class="commenthead"><img class="avatar" src="${safeAttr(v.avatar||avatar(v.name))}">${escapeHtml(v.name)}${v.level?` <span class="tag" style="margin-inline-start:4px">${escapeHtml(v.level)}</span>`:""} <span class="muted" style="font-size:11px">${fmt(v.createdAt)}</span></div><p>${escapeHtml(v.message||"")}</p>
   <div class="actions" style="margin-top:8px"><button class="btn success sm" onclick="acceptRequest('${x.id}','${uid}')">✅ قبول</button><button class="btn ghost sm" onclick="rejectRequest('${x.id}','${uid}')">✖️ رفض</button><button class="btn ghost sm" onclick="openDM('${uid}','${escapeHtml(v.name).replace(/'/g,"")}')">💬 رسالة</button></div></div>`).join(""):`<p class="muted">لسه محدش أبدى اهتمامه، شارك الفكرة عشان توصلك شراكات 🚀</p>`}</div>
  ${rejected.length?`<p class="muted" style="font-size:12px;margin-top:10px">${rejected.length} طلب مرفوض سابقًا</p>`:""}`;
 }
 return html;
}
window.acceptRequest=async(ideaId,uid)=>{
 const idea=allIdeas.find(x=>x.id===ideaId); if(!idea||!currentUser||idea.authorId!==currentUser.uid)return;
 const role=prompt("حدد دور هذا العضو في الفريق (اختياري):","")||"";
 await update(ref(db,`ideas/${ideaId}/interested/${uid}`),{status:"accepted",role:role.trim()});
 notify(uid,"accepted",ideaId,idea.title);
 toast("✅ تم قبول العضو في الفريق","success"); openIdea(ideaId,true,true);
};
window.rejectRequest=async(ideaId,uid)=>{
 const idea=allIdeas.find(x=>x.id===ideaId); if(!idea||!currentUser||idea.authorId!==currentUser.uid)return;
 await update(ref(db,`ideas/${ideaId}/interested/${uid}`),{status:"rejected"});
 toast("تم رفض الطلب","info"); openIdea(ideaId,true,true);
};
function dmThreadId(a,b){return [a,b].sort().join("_")}
function getReferrerUid(){
 try{const m=new URLSearchParams(location.search).get("ref");return m&&m.length>10?m:(sessionStorage.getItem("refUid")||null)}catch(e){return null}
}
(()=>{try{const m=new URLSearchParams(location.search).get("ref");if(m)sessionStorage.setItem("refUid",m)}catch(e){}})();
let referralsMap={};
window.copyReferralLink=async()=>{
 if(!currentUser)return;
 const url=location.origin+location.pathname+"?ref="+currentUser.uid;
 try{await navigator.clipboard.writeText(url);toast("🔗 تم نسخ رابط الدعوة الخاص بك","success")}
 catch(e){prompt("انسخ رابط الدعوة:",url)}
};
window.openOnboarding=()=>{
 $("onboardCats").innerHTML=CATEGORIES.map((c,i)=>`<label class="formgroup full" style="display:flex;align-items:center;gap:10px;background:var(--surface);border:1px solid var(--border);border-radius:11px;padding:12px 14px;cursor:pointer;margin-bottom:0">
  <input type="checkbox" value="${escapeHtml(c.name)}" style="width:auto" id="onboardCat${i}"><span>${c.icon} ${escapeHtml(c.name)}</span></label>`).join("");
 openModal("onboardModal");
};
window.saveOnboarding=async()=>{
 if(!currentUser)return;
 const picked=CATEGORIES.filter((c,i)=>$("onboardCat"+i)?.checked).map(c=>c.name);
 if(picked.length<1){toast("اختر مجالًا واحدًا على الأقل");return}
 const interests={}; picked.forEach(name=>interests[name]=true);
 await update(ref(db,"users/"+currentUser.uid),{uid:currentUser.uid,interests});
 closeModal("onboardModal"); toast("✨ تم حفظ اهتماماتك","success");
};
function userInterests(){
 const me=allUsers.find(u=>u.uid===currentUser?.uid);
 return me?.interests||{};
}
window.toggleFollow=async(uid)=>{
 if(!currentUser){openAuth();return}
 if(uid===currentUser.uid)return;
 const isFollowing=!!followsMap[uid];
 if(isFollowing){
  await remove(ref(db,`follows/${currentUser.uid}/${uid}`));
  await remove(ref(db,`followers/${uid}/${currentUser.uid}`));
 }else{
  await set(ref(db,`follows/${currentUser.uid}/${uid}`),true);
  await set(ref(db,`followers/${uid}/${currentUser.uid}`),true);
  notify(uid,"follow");
 }
};
function userReviewStats(uid){
 const items=[];
 Object.entries(allReviewsMap).forEach(([ideaId,byReviewee])=>{
  const entry=byReviewee?.[uid]; if(!entry)return;
  Object.entries(entry).forEach(([reviewerUid,v])=>{
   if(!v||!v.rating)return;
   items.push({ideaId,reviewerUid,rating:v.rating,text:v.text||"",createdAt:v.createdAt||0});
  });
 });
 items.sort((a,b)=>b.createdAt-a.createdAt);
 const avg=items.length?(items.reduce((s,i)=>s+i.rating,0)/items.length):0;
 return {items,avg,count:items.length};
}
function ratingPill(uid){
 const {avg,count}=userReviewStats(uid);
 return count?`<span class="pill">⭐ ${avg.toFixed(1)} (${count} تقييم)</span>`:"";
}
function renderTestimonials(uid){
 const withText=userReviewStats(uid).items.filter(i=>i.text);
 if(!withText.length)return "";
 return `<div class="section-head" style="margin-top:30px"><h2>💼 توصيات من زملاء العمل</h2></div>
 <div style="display:flex;flex-direction:column;gap:10px">${withText.map(i=>{
  const reviewer=allUsers.find(u=>u.uid===i.reviewerUid);
  const idea=allIdeas.find(x=>x.id===i.ideaId);
  return `<div class="comment"><div class="commenthead"><img class="avatar" src="${safeAttr(reviewer?.photoURL||avatar(reviewer?.displayName||i.reviewerUid))}" onclick="openPublicProfile('${i.reviewerUid}')" style="cursor:pointer">${escapeHtml(reviewer?.displayName||"زميل عمل")}<span style="margin-inline-start:8px">${"⭐".repeat(i.rating)}</span></div><p>${escapeHtml(i.text)}</p>${idea?`<p class="muted" style="font-size:11px;margin-top:4px">في مشروع «${escapeHtml(idea.title)}»</p>`:""}</div>`;
 }).join("")}</div>`;
}
function badgesFor(mine,totalLikes){
 const b=[];
 if(mine.length>=1)b.push("🌱 أول فكرة");
 if(mine.length>=5)b.push("💡 5 أفكار");
 if(mine.length>=15)b.push("🧠 15 فكرة");
 if(totalLikes>=10)b.push("🔥 10 إعجابات");
 if(totalLikes>=50)b.push("⭐ 50 إعجابًا");
 if(mine.some(x=>x.status==="launched"))b.push("🚀 مشروع مُطلق");
 return b;
}
window.openPublicProfile=(uid)=>{
 if(!uid)return;
 if(currentUser&&uid===currentUser.uid){showPage("profile");return}
 if(document.body.dataset.page==="publicProfile"){
  const page=$("publicProfile"), content=$("publicProfileContent");
  if(!page||!content)return;
  viewingProfileUid=String(uid);
  history.replaceState(null,"","user.html?uid="+encodeURIComponent(String(uid)));
  window.scrollTo(0,0);
  content.innerHTML='<div class="empty">جارٍ تحميل الملف الشخصي...</div>';
  try{renderPublicProfile(String(uid));}catch(e){console.error("Public profile error",e);content.innerHTML='<div class="empty">تعذّر تحميل الملف الشخصي. حاول مرة أخرى.</div>';toast("حدث خطأ أثناء فتح الملف الشخصي","error");}
  return;
 }
 location.href="user.html?uid="+encodeURIComponent(String(uid));
};
window.toggleBlock=async(uid)=>{
 if(!currentUser||uid===currentUser.uid)return;
 const isBlocked=!!blocksMap[uid];
 if(isBlocked)await remove(ref(db,`blocks/${currentUser.uid}/${uid}`));
 else{await set(ref(db,`blocks/${currentUser.uid}/${uid}`),true);toast("🚫 تم حظر هذا المستخدم، لن تقدر تتواصل معه","info")}
 renderPublicProfile(uid);
};
let followersCache={};
function renderPublicProfile(uid){
 if(!$("publicProfileContent"))return;
 const info=allUsers.find(u=>u.uid===uid)||allIdeas.find(x=>x.authorId===uid)&&{uid,displayName:allIdeas.find(x=>x.authorId===uid).authorName,photoURL:allIdeas.find(x=>x.authorId===uid).authorAvatar};
 const mine=allIdeas.filter(x=>x.authorId===uid&&x.status!=="draft");
 const totalLikes=mine.reduce((n,x)=>n+likesCount(x),0);
 const followerCount=Object.keys(followersCache[uid]||{}).length;
 const isFollowing=!!followsMap[uid];
 const isBlocked=!!blocksMap[uid];
 $("publicProfileContent").innerHTML=`<div class="profilebox"><img class="bigavatar" src="${safeAttr(info?.photoURL||avatar(uid))}">
 <div><h1>${escapeHtml(info?.displayName||"مستخدم")}${verifiedBadge(uid)}</h1><p class="muted" style="margin-top:4px">${escapeHtml(info?.headline||"مبتكر")}</p>${info?.bio?`<p style="line-height:1.8;margin-top:8px">${escapeHtml(info.bio)}</p>`:""}
 <div class="pills"><span class="pill">💡 ${mine.length} أفكار</span><span class="pill">❤️ ${totalLikes} إعجاب</span><span class="pill">👥 ${followerCount} متابع</span>${ratingPill(uid)}${badgesFor(mine,totalLikes).map(b=>`<span class="pill badge-pill">${b}</span>`).join("")}</div>
 <div class="actions" style="justify-content:flex-start;margin-top:14px">
 ${currentUser?`<button class="btn followbtn ${isFollowing?"following":""}" onclick="toggleFollow('${uid}')">${isFollowing?"إلغاء المتابعة":"➕ متابعة"}</button>${!isBlocked?`<button class="btn secondary" onclick="openDM('${uid}','${escapeHtml(info?.displayName||"مستخدم").replace(/'/g,"")}')">💬 مراسلة</button><button class="btn secondary" onclick="connectUser('${uid}')">🤝 تواصل</button>`:""}<button class="btn ghost sm" onclick="toggleBlock('${uid}')">${isBlocked?"✅ إلغاء الحظر":"🚫 حظر"}</button>`:""}
 </div></div></div>
 <div class="section-head" style="margin-top:25px"><h2>أفكاره</h2></div><div class="grid">${mine.length?mine.map(card).join(""):`<div class="empty">لا توجد أفكار منشورة بعد.</div>`}</div>
 ${renderTestimonials(uid)}`;
 get(ref(db,`followers/${uid}`)).then(snap=>{followersCache[uid]=snap.val()||{};if(viewingProfileUid===uid)renderPublicProfile(uid)}).catch(()=>{});
}
window.openDM=(uid,name)=>{
 if(!currentUser){openAuth();return}
 if(blocksMap[uid]){toast("لقد حظرت هذا المستخدم، ألغِ الحظر أولاً للمراسلة","info");return}
 dmTargetUid=uid; $("dmTitle").textContent="💬 "+name;
 openModal("dmModal");
 if(dmUnsub)dmUnsub();
 dmUnsub=onValue(ref(db,`dm/${dmThreadId(currentUser.uid,uid)}`),snap=>{
  const d=snap.val()||{}; const arr=Object.values(d).sort((a,b)=>(a.createdAt||0)-(b.createdAt||0));
  $("dmList").innerHTML=arr.length?arr.map(m=>`<div class="dmbubble ${m.from===currentUser.uid?"me":"them"}">${escapeHtml(m.text)}</div>`).join(""):`<p class="muted" style="text-align:center;padding:20px 0">ابدأ المحادثة الآن 👋</p>`;
  $("dmList").scrollTop=$("dmList").scrollHeight;
 });
};
window.sendDM=async()=>{
 const text=$("dmText").value.trim(); if(!text||!currentUser||!dmTargetUid)return;
 await push(ref(db,`dm/${dmThreadId(currentUser.uid,dmTargetUid)}`),{from:currentUser.uid,text,createdAt:Date.now()});
 notify(dmTargetUid,"message");
 $("dmText").value="";
};


/* ===== مجتمع اجتماعي احترافي ===== */
function timeAgo(ts){const d=Date.now()-(ts||Date.now()),m=Math.floor(d/60000),h=Math.floor(d/3600000),day=Math.floor(d/86400000);if(m<1)return"الآن";if(m<60)return`منذ ${m} دقيقة`;if(h<24)return`منذ ${h} ساعة`;if(day<7)return`منذ ${day} يوم`;return fmt(ts)}
function currentUserRecord(){return allUsers.find(u=>u.uid===currentUser?.uid)||{}}
window.focusPostComposer=()=>{if(!currentUser){openAuth();return}showPage("community");setTimeout(()=>{$("postText")?.focus(),window.scrollTo({top:0,behavior:"smooth"})},120)};
window.setSocialTab=tab=>{socialTab=tab;document.querySelectorAll('[data-social-tab]').forEach(b=>b.classList.toggle('active',b.dataset.socialTab===tab));renderCommunity()};
window.publishPost=async()=>{
 if(!currentUser){openAuth();return}
 const text=$("postText").value.trim(); if(!text&&!postImageUrl){toast("اكتب شيئًا أو أضف صورة","error");return}
 if(text.length>1200){toast("المنشور طويل جدًا","error");return}
 const u=currentUserRecord(),btn=document.querySelector('.post-composer .btn:not(.secondary):not(.ghost)'); if(btn)btn.disabled=true;
 try{await push(ref(db,"posts"),{authorId:currentUser.uid,authorName:currentUser.displayName||u.displayName||currentUser.email.split("@")[0],authorAvatar:currentUser.photoURL||u.photoURL||avatar(currentUser.uid),headline:u.headline||"مبتكر",text,imageUrl:postImageUrl||"",createdAt:Date.now(),status:"published"});toast("🚀 تم نشر المنشور","success");$("postText").value="";removePostImage();}
 catch(e){toast("تعذّر نشر المنشور: "+(e.message||"خطأ"),"error")} finally{if(btn)btn.disabled=false}
};
window.togglePostLike=async id=>{if(!currentUser){openAuth();return}const r=ref(db,`posts/${id}/likes/${currentUser.uid}`);const p=allPosts.find(x=>x.id===id);if(p?.likes?.[currentUser.uid])await remove(r);else{await set(r,true);const p2=allPosts.find(x=>x.id===id);if(p2&&p2.authorId!==currentUser.uid)notify(p2.authorId,"like",null,p2.text?.slice(0,60)||"منشور")}};
window.addPostComment=async id=>{if(!currentUser){openAuth();return}const el=$("pc-"+id),text=el?.value.trim();if(!text)return;if(text.length>500){toast("التعليق طويل جدًا","error");return}const u=currentUserRecord();await push(ref(db,`posts/${id}/comments`),{uid:currentUser.uid,name:currentUser.displayName||u.displayName||"مستخدم",avatar:currentUser.photoURL||u.photoURL||avatar(currentUser.uid),text,createdAt:Date.now()});el.value=""};
window.removePostImage=()=>{postImageUrl="";$("postImageFile")&&($("postImageFile").value="");$("postImagePreviewWrap")?.classList.add("hidden");if($("postUploadStatus"))$("postUploadStatus").textContent=""};
window.handlePostImage=async input=>{const file=input?.files?.[0];if(!file)return;if(!file.type.startsWith("image/")){toast("اختر صورة صحيحة","error");return}if(file.size>8*1024*1024){toast("حجم الصورة أكبر من 8MB","error");return}$("postUploadStatus").textContent="جارٍ رفع الصورة...";try{const data=await resizeImage(file,1280,.78);postImageUrl=await uploadToImgbb(data);$("postImagePreview").src=postImageUrl;$("postImagePreviewWrap").classList.remove("hidden");$("postUploadStatus").textContent="✅ تم الرفع عبر ImgBB"}catch(e){postImageUrl="";toast("تعذّر رفع الصورة","error");$("postUploadStatus").textContent=""}};
function postCard(p){const liked=!!p.likes?.[currentUser?.uid],likes=Object.keys(p.likes||{}).length,comments=Object.values(p.comments||{}).sort((a,b)=>(a.createdAt||0)-(b.createdAt||0));const owner=allUsers.find(u=>u.uid===p.authorId)||{};return `<article class="social-card"><div class="post-head"><img class="avatar" src="${safeAttr(p.authorAvatar||owner.photoURL||avatar(p.authorName))}" onclick="openPublicProfile('${p.authorId}')"><div class="post-author"><b onclick="openPublicProfile('${p.authorId}')" style="cursor:pointer">${escapeHtml(p.authorName||owner.displayName||"مستخدم")}${verifiedBadge(p.authorId)}</b><small>${escapeHtml(p.headline||owner.headline||"مبتكر")} · ${timeAgo(p.createdAt)}</small></div>${currentUser&&p.authorId!==currentUser.uid?`<button class="btn ghost sm" onclick="toggleFollow('${p.authorId}')">${followsMap[p.authorId]?"متابَع":"➕ متابعة"}</button>`:""}</div>${p.text?`<div class="post-body">${escapeHtml(p.text)}</div>`:""}${p.imageUrl?`<img class="post-image" src="${safeAttr(p.imageUrl)}" loading="lazy" alt="صورة المنشور">`:""}<div class="post-actions"><button class="${liked?"active":""}" onclick="togglePostLike('${p.id}')">${liked?"❤️":"🤍"} ${likes}</button><button onclick="$(\'pc-${p.id}\')?.focus()">💬 ${comments.length}</button><button onclick="openPublicProfile('${p.authorId}')">👤 الملف</button></div>${comments.slice(-3).map(c=>`<div class="post-comment"><img class="avatar" style="width:28px;height:28px" src="${safeAttr(c.avatar||avatar(c.name))}"><div class="comment" style="flex:1"><b>${escapeHtml(c.name)}</b><p style="margin-top:3px">${escapeHtml(c.text)}</p></div></div>`).join("")}${currentUser?`<div class="post-comment"><input id="pc-${p.id}" maxlength="500" placeholder="اكتب تعليقًا..." onkeydown="if(event.key==='Enter')addPostComment('${p.id}')"><button class="btn sm" onclick="addPostComment('${p.id}')">إرسال</button></div>`:""}</article>`}
function renderCommunity(){if(!$('socialFeed'))return;const me=currentUserRecord();if($('composerAvatar'))$('composerAvatar').src=currentUser?(currentUser.photoURL||me.photoURL||avatar(currentUser.uid)):avatar("visitor");if($('composerName'))$('composerName').textContent=currentUser?(currentUser.displayName||me.displayName||currentUser.email.split('@')[0]):"سجّل الدخول للكتابة";let list=allPosts.filter(p=>p.status!=="hidden"&&p.status!=="deleted");if(socialTab==='following')list=list.filter(p=>p.authorId===currentUser?.uid||!!followsMap[p.authorId]);if(socialTab==='popular')list.sort((a,b)=>(Object.keys(b.likes||{}).length+Object.keys(b.comments||{}).length*2)-(Object.keys(a.likes||{}).length+Object.keys(a.comments||{}).length*2));else list.sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));$('socialFeed').innerHTML=list.length?list.map(postCard).join(''):`<div class="empty">لا توجد منشورات هنا بعد. كن أول من يبدأ 🚀</div>`;renderSocialSuggestions();renderConnectionRequests()}
function renderSocialSuggestions(){if(!$('socialSuggestions'))return;const me=currentUserRecord(),skills=(me.skills||'').toLowerCase().split(',').map(x=>x.trim()).filter(Boolean);let list=allUsers.filter(u=>u.uid!==currentUser?.uid&&!blocksMap[u.uid]);list=list.map(u=>{const us=(u.skills||'').toLowerCase().split(',').map(x=>x.trim());return {u,score:us.filter(x=>skills.includes(x)).length+(followsMap[u.uid]? -10:0)}}).sort((a,b)=>b.score-a.score).slice(0,6);$('socialSuggestions').innerHTML=list.length?list.map(({u})=>`<div class="person-mini"><img class="avatar" src="${safeAttr(u.photoURL||avatar(u.displayName||u.uid))}" onclick="event.stopPropagation();openPublicProfile('${u.uid}')"><div><b>${escapeHtml(u.displayName||'مستخدم')}${verifiedBadge(u.uid)}</b><small class="muted">${escapeHtml(u.headline||'مبتكر')}</small></div><button class="btn secondary sm" onclick="event.stopPropagation();toggleFollow('${u.uid}')">${followsMap[u.uid]?'متابَع':'متابعة'}</button></div>`).join(''):`<span class="muted">أكمل ملفك ومهاراتك لنرشح لك أشخاصًا أفضل.</span>`}
function renderConnectionRequests(){if(!$('connectionRequests'))return;const items=Object.entries(connectionRequestsMap||{}).filter(([,v])=>v&&v.status==='pending');$('connectionRequests').innerHTML=items.length?items.map(([uid,v])=>`<div class="person-mini"><img class="avatar" src="${safeAttr(v.avatar||avatar(v.name))}"><div><b>${escapeHtml(v.name||'مستخدم')}</b><small class="muted">يريد إضافتك إلى شبكة علاقاته</small></div><button class="btn sm" onclick="acceptConnection('${uid}')">قبول</button></div>`).join(''):`<span class="muted">لا توجد طلبات جديدة.</span>`}
window.connectUser=async uid=>{if(!currentUser||uid===currentUser.uid)return;await set(ref(db,`connectionRequests/${uid}/${currentUser.uid}`),{name:currentUser.displayName||currentUser.email.split('@')[0],avatar:currentUser.photoURL||avatar(currentUser.uid),status:'pending',createdAt:Date.now()});notify(uid,'connection');toast('🤝 تم إرسال طلب التواصل','success')};
window.acceptConnection=async uid=>{if(!currentUser)return;await set(ref(db,`connections/${currentUser.uid}/${uid}`),true);await set(ref(db,`connections/${uid}/${currentUser.uid}`),true);await update(ref(db,`connectionRequests/${currentUser.uid}/${uid}`),{status:'accepted',acceptedAt:Date.now()});notify(uid,'connectionAccepted');toast('🤝 تمت إضافة الشخص إلى شبكة علاقاتك','success');renderConnectionRequests()};
window.removeConnection=async uid=>{if(!currentUser)return;await remove(ref(db,`connections/${currentUser.uid}/${uid}`));await remove(ref(db,`connections/${uid}/${currentUser.uid}`));renderPublicProfile(viewingProfileUid||uid)};

function avatar(seed){return "https://api.dicebear.com/9.x/initials/svg?seed="+encodeURIComponent(seed)}
function escapeHtml(v){return String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
function safeAttr(v){return escapeHtml(v).replace(/javascript:/gi,"")}
function fmt(ts){return new Date(ts||Date.now()).toLocaleDateString("ar-EG",{year:"numeric",month:"short",day:"numeric"})}
function likesCount(x){return Object.keys(x.likes||{}).length}
function isStale(x){
 if(x.status!=="team"&&x.status!=="progress")return false;
 return (Date.now()-(x.lastUpdateAt||x.createdAt||0))>30*24*60*60*1000;
}

let hashRouteChecked=false;
function debounceRender(fn,ms){let t;return(...a)=>{clearTimeout(t);t=setTimeout(()=>fn(...a),ms)}}
const renderIdeasBatch=debounceRender(()=>{renderIdeas();renderHome();renderProjects();renderStats();renderCategories();renderHeroAvatars()},120);
onValue(ref(db,"ideas"),snap=>{
 const d=snap.val()||{}; allIdeas=Object.entries(d).map(([id,v])=>({id,...v})).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
 renderIdeasBatch();
 if(viewingProfileUid)renderPublicProfile(viewingProfileUid);
 if(!hashRouteChecked){hashRouteChecked=true;checkHashRoute()}
});
onValue(ref(db,"users"),snap=>{allUsers=Object.values(snap.val()||{});renderStats();renderAdmin(currentAdminTab);renderHeroAvatars();renderPeople();if($("profile").classList.contains("active"))renderProfile();if(viewingProfileUid)renderPublicProfile(viewingProfileUid)});
onValue(ref(db,"reports"),snap=>{allReports=Object.entries(snap.val()||{}).map(([id,v])=>({id,...v}));renderAdmin("reports")});
onValue(ref(db,"posts"),snap=>{const d=snap.val()||{};allPosts=Object.entries(d).map(([id,v])=>({id,...v})).filter(x=>x.status!=="deleted").sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));renderCommunity()});

const renderCommentsBatch=debounceRender(()=>{renderHome();renderIdeas();renderProjects()},120);
onValue(ref(db,"comments"),snap=>{
 const d=snap.val()||{}; commentCounts={};
 Object.entries(d).forEach(([ideaId,c])=>{commentCounts[ideaId]=Object.keys(c||{}).length});
 renderCommentsBatch();
});

function renderStats(){
 $("statIdeas") && ($("statIdeas").textContent=allIdeas.length);
 $("statUsers") && ($("statUsers").textContent=allUsers.length);
 $("statProjects") && ($("statProjects").textContent=allIdeas.filter(x=>x.status==="launched").length);
 $("statLikes") && ($("statLikes").textContent=allIdeas.reduce((n,x)=>n+likesCount(x),0));
 $("heroUserCount") && ($("heroUserCount").textContent="+"+allUsers.length);
}
function renderHeroAvatars(){
 if(!$("heroAvatars"))return;
 const pool=(allUsers.length?allUsers:allIdeas.map(x=>({uid:x.authorId,photoURL:x.authorAvatar,displayName:x.authorName}))).slice(0,4);
 $("heroAvatars").innerHTML=pool.length?pool.map(u=>`<img src="${safeAttr(u.photoURL||avatar(u.uid||u.displayName||"مبتكر"))}">`).join(""):`<img src="${avatar("مبتكر")}">`;
}
function renderCategories(){
 if(!$("catRail"))return;
 $("catRail").innerHTML=CATEGORIES.map(c=>{
  const count=allIdeas.filter(x=>x.category===c.name&&x.status!=="draft").length;
  return `<div class="catcard" onclick="goToCategory('${escapeHtml(c.name).replace(/'/g,"")}')">
   <div class="ico" style="background:${c.bg}">${c.icon}</div>
   <h4>${escapeHtml(c.name)}</h4><span>${count} مشروع</span>
  </div>`;
 }).join("");
}
function card(idea){
 const likes=likesCount(idea);
 const liked=currentUser&&idea.likes?.[currentUser.uid];
 const saved=currentUser&&savesMap[idea.id];
 const comments=commentCounts[idea.id]||0;
 const trending=likes>=5;
 const tags=(idea.skills||idea.category||"").split(",").map(x=>x.trim()).filter(Boolean).slice(0,3);
 return `<article class="card">
 <div style="position:relative">
 <img class="cardimg" src="${safeAttr(idea.imageUrl||DEFAULT_IMAGE)}" alt="" loading="lazy" onerror="this.onerror=null;this.src='${DEFAULT_IMAGE}'" onclick="openIdea('${idea.id}')" style="cursor:pointer">
 ${trending?'<span style="position:absolute;top:9px;right:9px;background:var(--grad-cta);color:#fff;font-size:11px;font-weight:800;padding:4px 9px;border-radius:8px">🔥 رائجة</span>':""}
 ${idea.status==="draft"?'<span style="position:absolute;top:9px;left:9px;background:rgba(120,113,108,.85);color:#fff;font-size:11px;font-weight:800;padding:4px 9px;border-radius:8px">📝 مسودة</span>':(idea.status&&idea.status!=="idea"?`<span style="position:absolute;top:9px;left:9px;background:${idea.status==="launched"?"rgba(34,197,94,.85)":"rgba(56,162,140,.85)"};color:#fff;font-size:11px;font-weight:800;padding:4px 9px;border-radius:8px">${stageInfo(idea.status).label}</span>`:"")}
 ${idea.teamFull?'<span style="position:absolute;bottom:9px;right:9px;background:rgba(244,63,94,.85);color:#fff;font-size:11px;font-weight:800;padding:4px 9px;border-radius:8px">🔒 الفريق مكتمل</span>':""}
 ${isStale(idea)?'<span class="stale-tag" style="position:absolute;bottom:9px;left:9px;color:#fff;font-size:11px;font-weight:800;padding:4px 9px;border-radius:8px">🕒 محتاجة تحديث</span>':""}
 </div>
 <div class="cardbody">
 <div class="author authorlink" onclick="openPublicProfile('${idea.authorId}')"><img class="avatar" src="${safeAttr(idea.authorAvatar||avatar(idea.authorName||"user"))}" onerror="this.onerror=null;this.src='${avatar(idea.authorName||"user")}'"><span>${escapeHtml(idea.authorName||"مبتكر")}${verifiedBadge(idea.authorId)} · ${fmt(idea.createdAt)}</span></div>
 <h3 onclick="openIdea('${idea.id}')" style="cursor:pointer">${escapeHtml(idea.title)}</h3>
 <p class="desc">${escapeHtml(idea.desc)}</p>
 <div class="tags">${tags.map(t=>`<span class="tag">${escapeHtml(t)}</span>`).join("")}</div>
 <div class="cardfoot">
 <span class="mini"><span>💬 ${comments}</span><span>❤️ ${likes}</span><span>👁️ ${idea.views||0}</span></span>
 <div style="display:flex;gap:6px"><button class="btn secondary sm iconbtn" onclick="toggleSave('${idea.id}')" aria-label="حفظ">${saved?"🔖":"📑"}</button><button class="btn secondary sm iconbtn" onclick="toggleLike('${idea.id}',this)" aria-label="إعجاب">${liked?"💖":"🤍"}</button><button class="btn sm" onclick="openIdea('${idea.id}')">فتح</button></div>
 </div></div></article>`;
}
window.setFeedTab=(tab,btn)=>{
 feedTab=tab; document.querySelectorAll(".feedtabs button").forEach(b=>b.classList.remove("active")); btn.classList.add("active"); renderHome();
};
function renderHome(){
 if(!$("homeIdeas"))return;
 let list=allIdeas.filter(x=>x.status!=="draft");
 if(feedTab==="popular")list.sort((a,b)=>likesCount(b)-likesCount(a));
 else if(feedTab==="ideas")list=list.filter(x=>x.status!=="launched");
 else if(feedTab==="projects")list=list.filter(x=>x.status==="launched");
 else if(feedTab==="skillmatch"){
  if(!currentUser){$("homeIdeas").innerHTML=`<div class="empty">سجّل الدخول وحدد مهاراتك عشان نرشحلك أفكارًا محتاجة خبرتك بالظبط 🎯</div>`;return}
  const myRecord=allUsers.find(u=>u.uid===currentUser.uid)||{};
  const mySkills=(myRecord.skills||"").split(",").map(s=>s.trim().toLowerCase()).filter(Boolean);
  if(!mySkills.length){$("homeIdeas").innerHTML=`<div class="empty">لسه ما حددتش مهاراتك<br><button class="btn sm" style="margin-top:10px" onclick="showPage('profile')">🎯 أضف مهاراتك من ملفك الشخصي</button></div>`;return}
  const scored=list.filter(x=>x.authorId!==currentUser.uid&&x.status!=="archived"&&!x.teamFull).map(x=>{
   const ideaSkills=(x.skills||"").split(",").map(s=>s.trim().toLowerCase()).filter(Boolean);
   const overlap=ideaSkills.filter(s=>mySkills.some(m=>s.includes(m)||m.includes(s))).length;
   return {x,overlap};
  }).filter(s=>s.overlap>0).sort((a,b)=>b.overlap-a.overlap||(b.x.createdAt||0)-(a.x.createdAt||0)).map(s=>s.x);
  $("homeIdeas").innerHTML=scored.length?scored.slice(0,12).map(card).join(""):`<div class="empty">لسه مفيش أفكار محتاجة مهاراتك المحددة، جرّب تصفح الأحدث أو حدّث مهاراتك 🎯</div>`;
  return;
 }
 else if(feedTab==="following"){
  if(!currentUser){$("homeIdeas").innerHTML=`<div class="empty">سجّل الدخول عشان تتابع مبتكرين وتشوف أحدث أفكارهم هنا 👥</div>`;return}
  const followingUids=Object.keys(followsMap||{});
  if(!followingUids.length){$("homeIdeas").innerHTML=`<div class="empty">لسه بتتابعش حد<br><button class="btn sm" style="margin-top:10px" onclick="showPage('ideas')">🔍 تصفح المبتكرين وابدأ بالمتابعة</button></div>`;return}
  const followingList=list.filter(x=>followingUids.includes(x.authorId)).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
  $("homeIdeas").innerHTML=followingList.length?followingList.slice(0,12).map(card).join(""):`<div class="empty">المبتكرين اللي بتتابعهم لسه منشروش أفكار جديدة، تابع كل جديد هنا 👥</div>`;
  return;
 }
 else if(feedTab==="foryou"){
  if(!currentUser){$("homeIdeas").innerHTML=`<div class="empty">سجّل الدخول واختر اهتماماتك عشان نرشحلك أفكارًا تناسبك ✨</div>`;return}
  const interests=userInterests();
  if(!Object.keys(interests).length){$("homeIdeas").innerHTML=`<div class="empty">لسه ما اخترتش اهتماماتك<br><button class="btn sm" style="margin-top:10px" onclick="openOnboarding()">✨ اختر اهتماماتك الآن</button></div>`;return}
  list=list.filter(x=>interests[x.category]);
 }
 $("homeIdeas").innerHTML=list.length?list.slice(0,8).map(card).join(""):`<div class="empty">${feedTab==="foryou"?"لسه مفيش أفكار في المجالات اللي اخترتها، جرّب تصفح الأحدث 🚀":"كن أول من ينشر فكرة 🚀"}</div>`;
}
window.onSearchInput=()=>{clearTimeout(searchDebounce);searchDebounce=setTimeout(()=>{ideasPage=1;renderIdeas()},300)};
window.clearAdvFilters=()=>{
 $("filterStage").value="all";$("filterInterested").value="0";$("filterFrom").value="";$("filterTo").value="";
 ideasPage=1;renderIdeas();
};
window.renderIdeas=()=>{
 if(!$("ideasGrid"))return;
 const q=($("search")?.value||"").toLowerCase().trim(),cat=$("category")?.value||"all",sortBy=$("sortBy")?.value||"new";
 const stageF=$("filterStage")?.value||"all",minInterested=Number($("filterInterested")?.value||0);
 const fromV=$("filterFrom")?.value,toV=$("filterTo")?.value;
 const fromTs=fromV?new Date(fromV).getTime():null, toTs=toV?new Date(toV).getTime()+86399999:null;
 let list=allIdeas.filter(x=>{
  if(x.status==="draft")return false;
  const text=[x.title,x.desc,x.category,x.skills,x.authorName].join(" ").toLowerCase();
  if(q&&!text.includes(q))return false;
  if(cat!=="all"&&x.category!==cat)return false;
  if(stageF!=="all"&&(x.status||"idea")!==stageF)return false;
  if(minInterested&&Object.keys(x.interested||{}).length<minInterested)return false;
  if(fromTs&&(x.createdAt||0)<fromTs)return false;
  if(toTs&&(x.createdAt||0)>toTs)return false;
  return true;
 });
 if(sortBy==="likes")list=[...list].sort((a,b)=>likesCount(b)-likesCount(a));
 else if(sortBy==="comments")list=[...list].sort((a,b)=>(commentCounts[b.id]||0)-(commentCounts[a.id]||0));
 const visible=list.slice(0,ideasPage*PAGE_SIZE);
 $("ideasGrid").innerHTML=visible.length?visible.map(card).join(""):`<div class="empty">لا توجد نتائج مطابقة. جرّب كلمات بحث مختلفة 🔍</div>`;
 $("loadMoreBtn").classList.toggle("hidden",visible.length>=list.length);
};
window.toggleLike=async(id,btn)=>{
 if(!currentUser){openAuth();return}
 const idea=allIdeas.find(x=>x.id===id); if(!idea)return;
 const path=ref(db,`ideas/${id}/likes/${currentUser.uid}`);
 const el=btn instanceof HTMLElement?btn:null;
 if(idea.likes?.[currentUser.uid])await remove(path);
 else{await set(path,true);notify(idea.authorId,"like",id,idea.title);if(el){el.classList.remove("liked-pop");void el.offsetWidth;el.classList.add("liked-pop")}}
};
window.toggleSave=async id=>{
 if(!currentUser){openAuth();return}
 const path=ref(db,`saves/${currentUser.uid}/${id}`);
 if(savesMap[id])await remove(path);else await set(path,true);
};
window.openIdea=(id,skipHash,refresh)=>{
 selectedIdeaId=id; const x=allIdeas.find(i=>i.id===id);if(!x)return;
 const isOwner=currentUser&&currentUser.uid===x.authorId;
 if(x.status==="draft"&&!isOwner){toast("هذه الفكرة لسه مسودة ومش منشورة","info");return}
 const likes=likesCount(x),saved=currentUser&&savesMap[id];
 const interested=Object.entries(x.interested||{});
 if(!refresh)update(ref(db,"ideas/"+id),{views:(x.views||0)+1});
 if(!skipHash)history.pushState(null,"","#idea-"+id);
 $("detailContent").innerHTML=`<button class="close" style="float:left" onclick="closeModal('detailModal')">×</button>
 <img src="${safeAttr(x.imageUrl||DEFAULT_IMAGE)}" onerror="this.onerror=null;this.src='${DEFAULT_IMAGE}'"><div class="detailbox">
 <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">
 <div class="author authorlink" onclick="openPublicProfile('${x.authorId}')"><img class="avatar" src="${safeAttr(x.authorAvatar||avatar(x.authorName))}" onerror="this.onerror=null;this.src='${avatar(x.authorName)}'"><span>${escapeHtml(x.authorName)} · ${fmt(x.createdAt)}</span></div>
 <span class="mini">👁️ ${(x.views||0)+1} مشاهدة</span>
 </div>
 <h1>${escapeHtml(x.title)}</h1>
 <div class="tags"><span class="tag">${escapeHtml(x.category)}</span>${(x.skills||"").split(",").filter(Boolean).map(s=>`<span class="tag">${escapeHtml(s.trim())}</span>`).join("")}</div>
 ${renderStageBar(x.status)}
 ${renderMilestones(x,likes,interested.length,commentCounts[x.id]||0)}
 <p class="detailtext">${escapeHtml(x.desc)}</p>
 ${(x.problem||x.solution||x.market)?`<div class="divider"></div>${x.problem?`<h3>🧩 المشكلة</h3><p class="detailtext" style="margin-bottom:14px">${escapeHtml(x.problem)}</p>`:""}${x.solution?`<h3>💡 الحل</h3><p class="detailtext" style="margin-bottom:14px">${escapeHtml(x.solution)}</p>`:""}${x.market?`<h3>🎯 السوق المستهدف</h3><p class="detailtext">${escapeHtml(x.market)}</p>`:""}`:""}
 <div class="actions" style="justify-content:flex-start;margin-top:15px;flex-wrap:wrap">
 <button class="btn secondary" onclick="toggleLike('${x.id}')">${x.likes?.[currentUser?.uid]?"💖":"🤍"} ${likes}</button>
 <button class="btn secondary" onclick="toggleSave('${x.id}')">${saved?"🔖 محفوظة":"📑 حفظ"}</button>
 <button class="btn secondary" onclick="shareIdea('${x.id}','${escapeHtml(x.title).replace(/'/g,"")}')">🔗 مشاركة</button>
 <button class="btn secondary iconbtn" title="مشاركة واتساب" onclick="shareWhatsApp('${x.id}','${escapeHtml(x.title).replace(/'/g,"")}')">💚</button>
 <button class="btn secondary iconbtn" title="مشاركة تويتر" onclick="shareTwitter('${x.id}','${escapeHtml(x.title).replace(/'/g,"")}')">🐦</button>
 ${!isOwner&&!x.teamFull?`<button class="btn" onclick="requestJoin('${x.id}')">🙋 أنا مهتم بالمشروع</button>`:""}
 ${!isOwner&&x.teamFull?`<button class="btn secondary" disabled>🔒 الفريق مكتمل حاليًا</button>`:""}
 ${!isOwner?`<button class="btn secondary" onclick="openDM('${x.authorId}','${escapeHtml(x.authorName).replace(/'/g,"")}')">💬 راسل صاحب الفكرة</button>`:""}
 ${!isOwner?`<button class="btn ghost" onclick="openReport('${x.id}')">🚨 إبلاغ</button>`:""}
 ${isOwner?`<button class="btn secondary" onclick="editIdea('${x.id}')">✏️ تعديل</button><button class="btn ${x.teamFull?"success":"secondary"}" onclick="toggleTeamFull('${x.id}')">${x.teamFull?"🔓 فتح استقبال الطلبات":"🔒 إغلاق استقبال الطلبات"}</button>${x.status!=="archived"?`<button class="btn ghost" onclick="openArchive('${x.id}')">🏛️ أرشفة (إيقاف)</button>`:""}${x.status==="launched"?`<button class="btn secondary" onclick="openStoryEditor('${x.id}')">✨ قصة النجاح</button>`:""}<button class="btn danger" onclick="deleteIdea('${x.id}')">🗑️ حذف</button>`:""}
 <button class="btn ghost" onclick="openPresentation('${x.id}')">🖥️ وضع العرض التقديمي</button>
 </div>
 ${x.status==="archived"&&x.archiveReason?`<div class="divider"></div><div class="card" style="padding:14px;background:rgba(244,63,94,.07);border-color:rgba(244,63,94,.25)"><b>🏛️ توقفت هنا وليه:</b><p class="detailtext" style="margin-top:6px">${escapeHtml(x.archiveReason)}</p></div>`:""}
 ${x.status==="launched"&&x.successStory?`<div class="divider"></div><div class="card" style="padding:14px;background:rgba(34,197,94,.07);border-color:rgba(34,197,94,.25)"><b>✨ قصة النجاح (بكلام صاحب الفكرة):</b><p class="detailtext" style="margin-top:6px">${escapeHtml(x.successStory)}</p></div>`:""}
 ${renderTeamSection(x,interested,isOwner)}
 ${renderMatchingPeople(x,isOwner)}
 ${renderKanban(x,interested,isOwner)}
 ${renderReviewsSection(x,interested,isOwner)}
 ${renderFaq(x,isOwner)}
 ${renderSimilarIdeas(x)}
 <div class="divider"></div><h3>📈 تحديثات المشروع</h3>
 <div id="ideaUpdates" style="margin-top:10px"></div>
 ${isOwner?`<div style="display:flex;gap:8px;margin-top:12px"><input id="updateText" placeholder="شارك تحديثًا جديدًا عن تقدّم المشروع..." onkeydown="if(event.key==='Enter')postUpdate('${x.id}')"><button class="btn secondary" onclick="postUpdate('${x.id}')">نشر</button></div>`:""}
 <div class="divider"></div><h3>💬 التعليقات</h3><div id="comments">جارٍ التحميل...</div>
 ${currentUser?`<div style="display:flex;gap:8px;margin-top:15px"><div class="autocomplete" style="flex:1"><input id="commentText" placeholder="اكتب تعليقًا... (استخدم @ لذكر أحد)" onkeydown="if(event.key==='Enter'&&!$('mentionAutolist').classList.contains('show'))addComment()" oninput="onMentionInput(this)"><div class="autolist" id="mentionAutolist"></div></div><button class="btn" onclick="addComment()">إرسال</button></div>`:`<p class="muted" style="margin-top:12px">سجّل الدخول لإضافة تعليق.</p>`}
 </div>`;
 openModal("detailModal");loadComments(id);loadUpdates(id);loadReviewsForIdea(id);
};
async function loadReviewsForIdea(ideaId){
 const snap=await get(ref(db,`reviews/${ideaId}`)); const d=snap.val()||{};
 Object.entries(d).forEach(([revieweeUid,reviewers])=>{
  reviewsCache[`${ideaId}_${revieweeUid}`]=reviewers||{};
  const myRating=(reviewers||{})[currentUser?.uid]?.rating||0;
  const el=$("stars_"+ideaId+"_"+revieweeUid);
  if(el)el.innerHTML=[1,2,3,4,5].map(n=>`<span class="${n<=myRating?"on":""}" onclick="rateUser('${ideaId}','${revieweeUid}',${n})">⭐</span>`).join("");
 });
}
function renderStageBar(status){
 const cur=stageIndex(status);
 return `<div style="margin:16px 0 4px"><div style="display:flex;gap:4px">${STAGES.map((s,i)=>`<div style="flex:1;height:6px;border-radius:99px;background:${i<=cur?"var(--grad-brand)":"var(--surface3)"}"></div>`).join("")}</div>
 <div style="display:flex;justify-content:space-between;margin-top:6px">${STAGES.map((s,i)=>`<span style="font-size:11px;font-weight:${i===cur?"800":"600"};color:${i<=cur?"var(--text)":"var(--muted2)"}">${s.short}</span>`).join("")}</div></div>`;
}
function renderMilestones(x,likes,interestedCount,commentsCount){
 const m=[];
 if(interestedCount>=1)m.push("🙋 أول شخص مهتم");
 if(interestedCount>=10)m.push("🎉 10 مهتمين بالمشروع");
 if(commentsCount>=1)m.push("💬 أول تعليق");
 if(likes>=10)m.push("🔥 10 إعجابات");
 if(likes>=50)m.push("⭐ 50 إعجابًا");
 if((x.views||0)>=100)m.push("👁️ 100 مشاهدة");
 if(x.status==="launched")m.push("🚀 وصلت لمرحلة الإطلاق");
 if(!m.length)return "";
 return `<div class="pills" style="margin:14px 0 4px">${m.map(t=>`<span class="pill badge-pill">${t}</span>`).join("")}</div>`;
}
// ====== أرشفة (المتحف) ======
window.openArchive=(id)=>{joinTargetId=id;$("archiveReason").value="";openModal("archiveModal")};
window.submitArchive=async()=>{
 const id=joinTargetId; const reason=$("archiveReason").value.trim();
 if(!reason){toast("اكتب سبب التوقف عشان يفيد غيرك","error");return}
 const x=allIdeas.find(i=>i.id===id); if(!x||!currentUser||x.authorId!==currentUser.uid)return;
 await update(ref(db,"ideas/"+id),{status:"archived",archiveReason:reason,archivedAt:Date.now()});
 closeModal("archiveModal");closeModal("detailModal");
 toast("🏛️ تم نقل الفكرة إلى متحف الأفكار","success");
};
// ====== قصص النجاح ======
window.openStoryEditor=(id)=>{
 const x=allIdeas.find(i=>i.id===id); joinTargetId=id; $("storyText").value=x?.successStory||""; openModal("storyModal");
};
window.submitStory=async()=>{
 const id=joinTargetId; const text=$("storyText").value.trim();
 const x=allIdeas.find(i=>i.id===id); if(!x||!currentUser||x.authorId!==currentUser.uid)return;
 await update(ref(db,"ideas/"+id),{successStory:text});
 closeModal("storyModal"); toast("✨ تم حفظ قصة النجاح","success"); openIdea(id,true,true);
};
function renderStories(){
 if(!$("storiesGrid"))return;
 const list=allIdeas.filter(x=>x.status==="launched"&&x.successStory);
 $("storiesGrid").innerHTML=list.length?list.map(x=>`<article class="card"><img class="cardimg" src="${safeAttr(x.imageUrl||DEFAULT_IMAGE)}" onclick="openIdea('${x.id}')" style="cursor:pointer"><div class="cardbody">
  <div class="author authorlink" onclick="openPublicProfile('${x.authorId}')"><img class="avatar" src="${safeAttr(x.authorAvatar||avatar(x.authorName))}"><span>${escapeHtml(x.authorName)}${verifiedBadge(x.authorId)}</span></div>
  <h3 onclick="openIdea('${x.id}')" style="cursor:pointer">${escapeHtml(x.title)}</h3>
  <p class="desc">${escapeHtml(x.successStory)}</p>
  <div class="cardfoot"><span class="mini">🚀 مُطلق · ${fmt(x.createdAt)}</span><button class="btn sm" onclick="openIdea('${x.id}')">اقرأ القصة كاملة</button></div>
 </div></article>`).join(""):`<div class="empty">لسه مفيش قصص نجاح موثّقة. أول مشروع يوصل للإطلاق ويحكي قصته هيظهر هنا ✨</div>`;
}
// ====== متحف الأفكار المؤرشفة ======
function renderMuseum(){
 if(!$("museumGrid"))return;
 const list=allIdeas.filter(x=>x.status==="archived").sort((a,b)=>(b.archivedAt||0)-(a.archivedAt||0));
 $("museumGrid").innerHTML=list.length?list.map(x=>`<article class="card museumcard"><img class="cardimg" src="${safeAttr(x.imageUrl||DEFAULT_IMAGE)}" onclick="openIdea('${x.id}')" style="cursor:pointer;filter:grayscale(.5)"><div class="cardbody">
  <div class="author authorlink" onclick="openPublicProfile('${x.authorId}')"><img class="avatar" src="${safeAttr(x.authorAvatar||avatar(x.authorName))}"><span>${escapeHtml(x.authorName)} · ${fmt(x.archivedAt||x.createdAt)}</span></div>
  <h3 onclick="openIdea('${x.id}')" style="cursor:pointer">${escapeHtml(x.title)}</h3>
  <p class="desc"><b>توقفت هنا وليه:</b> ${escapeHtml(x.archiveReason||"-")}</p>
 </div></article>`).join(""):`<div class="empty">لسه مفيش أفكار مؤرشفة. الأفكار اللي بتتوقف هتظهر هنا بدل الحذف الكامل، بشفافية كاملة 🏛️</div>`;
}
// ====== مكتبة الموارد ======
function renderLearn(){
 if(!$("learnGrid"))return;
 $("learnGrid").innerHTML=LEARN_ARTICLES.map(a=>`<article class="card"><div class="cardbody"><div class="ico" style="font-size:26px;margin-bottom:8px">${a.icon}</div><h3>${escapeHtml(a.title)}</h3><p class="desc" style="-webkit-line-clamp:unset">${escapeHtml(a.body)}</p></div></article>`).join("");
}
// ====== وضع العرض التقديمي ======
window.openPresentation=(id)=>{
 const x=allIdeas.find(i=>i.id===id); if(!x)return;
 const html=`<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>${escapeHtml(x.title)}</title>
 <style>body{font-family:'Tajawal',Tahoma,Arial,sans-serif;max-width:760px;margin:40px auto;padding:0 24px;color:#1E211C;line-height:1.9}
 img{width:100%;border-radius:16px;margin-bottom:24px} h1{font-size:30px;margin-bottom:6px} h3{margin:22px 0 6px;color:#1E4A40} .tag{display:inline-block;background:#F3EEE0;color:#1E4A40;padding:4px 12px;border-radius:8px;font-size:13px;margin-inline-end:6px}
 .meta{color:#6B6659;font-size:14px;margin-bottom:18px} @media print{body{margin:0;padding:24px}}</style></head>
 <body><img src="${safeAttr(x.imageUrl||DEFAULT_IMAGE)}"><h1>${escapeHtml(x.title)}</h1>
 <div class="meta">بواسطة ${escapeHtml(x.authorName)} · ${escapeHtml(x.category)}</div>
 <div>${(x.skills||"").split(",").filter(Boolean).map(s=>`<span class="tag">${escapeHtml(s.trim())}</span>`).join("")}</div>
 <h3>نبذة</h3><p>${escapeHtml(x.desc)}</p>
 ${x.problem?`<h3>🧩 المشكلة</h3><p>${escapeHtml(x.problem)}</p>`:""}
 ${x.solution?`<h3>💡 الحل</h3><p>${escapeHtml(x.solution)}</p>`:""}
 ${x.market?`<h3>🎯 السوق المستهدف</h3><p>${escapeHtml(x.market)}</p>`:""}
 <p style="margin-top:34px;color:#8C8778;font-size:12px">تم إنشاء هذا العرض من منصة عالم المبتكرين</p>
 </body></html>`;
 const blob=new Blob([html],{type:"text/html"}); const url=URL.createObjectURL(blob);
 window.open(url,"_blank");
};
// ====== تصدير بيانات المستخدم ======
window.exportMyData=async()=>{
 if(!currentUser)return;
 const uid=currentUser.uid;
 const mine=allIdeas.filter(x=>x.authorId===uid);
 const saved=Object.keys(savesMap||{});
 let myComments=[];
 try{
  const snap=await get(ref(db,"comments"));
  const d=snap.val()||{};
  Object.entries(d).forEach(([ideaId,c])=>Object.entries(c||{}).forEach(([cid,v])=>{if(v.authorId===uid)myComments.push({ideaId,cid,...v})}));
 }catch(e){}
 const payload={exportedAt:new Date().toISOString(),profile:{uid,email:currentUser.email,displayName:currentUser.displayName},ideas:mine,savedIdeaIds:saved,comments:myComments};
 const blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json"});
 const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download="my-data-export.json"; a.click();
 toast("📦 تم تجهيز ملف بياناتك للتنزيل","success");
};
// ====== أفكار مشابهة ======
function renderMatchingPeople(x,isOwner){
 if(!isOwner)return "";
 const ideaSkills=(x.skills||"").split(",").map(s=>s.trim().toLowerCase()).filter(Boolean);
 if(!ideaSkills.length)return "";
 const interestedUids=new Set(Object.keys(x.interested||{}));
 const scored=allUsers.filter(u=>u.uid!==x.authorId&&!interestedUids.has(u.uid)&&u.skills).map(u=>{
  const uSkills=(u.skills||"").split(",").map(s=>s.trim().toLowerCase()).filter(Boolean);
  const overlap=uSkills.filter(s=>ideaSkills.some(is=>s.includes(is)||is.includes(s))).length;
  return {u,overlap};
 }).filter(s=>s.overlap>0).sort((a,b)=>b.overlap-a.overlap).slice(0,4);
 if(!scored.length)return "";
 return `<div class="divider"></div><h3>🎯 أشخاص ممكن يناسبوا فكرتك</h3><p class="muted" style="font-size:12.5px;margin:4px 0 10px">بناءً على المهارات المطلوبة، دول أعضاء مهاراتهم قريبة من احتياج فكرتك</p>
 <div style="margin-top:6px">${scored.map(({u})=>`<div class="comment"><div class="commenthead"><img class="avatar" src="${safeAttr(u.photoURL||avatar(u.displayName||u.uid))}" onclick="openPublicProfile('${u.uid}')" style="cursor:pointer">${escapeHtml(u.displayName||"مستخدم")}${verifiedBadge(u.uid)}<button class="btn ghost sm" style="margin-inline-start:auto;padding:3px 8px" onclick="openDM('${u.uid}','${escapeHtml(u.displayName||"").replace(/'/g,"")}')">💬 دعوة</button></div><div class="tags" style="margin-top:6px">${(u.skills||"").split(",").filter(Boolean).slice(0,4).map(s=>`<span class="tag">${escapeHtml(s.trim())}</span>`).join("")}</div></div>`).join("")}</div>`;
}
function renderSimilarIdeas(x){
 const mySkills=(x.skills||"").split(",").map(s=>s.trim().toLowerCase()).filter(Boolean);
 const candidates=allIdeas.filter(o=>o.id!==x.id&&o.status!=="draft"&&o.status!=="archived"&&o.category===x.category);
 const scored=candidates.map(o=>{
  const oSkills=(o.skills||"").split(",").map(s=>s.trim().toLowerCase()).filter(Boolean);
  const overlap=oSkills.filter(s=>mySkills.includes(s)).length;
  return {o,score:overlap*3+1};
 }).sort((a,b)=>b.score-a.score).slice(0,3).map(s=>s.o);
 if(!scored.length)return "";
 return `<div class="divider"></div><h3>🔎 أفكار مشابهة</h3><div class="grid" style="margin-top:10px;grid-template-columns:repeat(3,1fr)">${scored.map(card).join("")}</div>`;
}
// ====== Mini Kanban للفريق ======
function renderKanban(x,interested,isOwner){
 const accepted=interested.filter(([,v])=>v.status==="accepted").map(([uid])=>uid);
 const canSeeKanban=isOwner||(currentUser&&accepted.includes(currentUser.uid));
 if(!canSeeKanban)return "";
 const tasks=Object.entries(x.tasks||{}).map(([tid,v])=>({tid,...v}));
 const cols=[{key:"todo",label:"📋 لسه هيتعمل"},{key:"doing",label:"🛠️ جارٍ العمل"},{key:"done",label:"✅ تم"}];
 return `<div class="divider"></div><h3>🗂️ مهام الفريق (Mini Kanban)</h3>
 <div style="display:flex;gap:8px;margin:10px 0"><input id="taskText" placeholder="مهمة جديدة..." onkeydown="if(event.key==='Enter')addTask('${x.id}')"><button class="btn secondary sm" onclick="addTask('${x.id}')">+ إضافة</button></div>
 <div class="kanbanwrap">${cols.map(c=>`<div class="kanbancol"><h4>${c.label} (${tasks.filter(t=>(t.col||"todo")===c.key).length})</h4>
  ${tasks.filter(t=>(t.col||"todo")===c.key).map(t=>`<div class="kanbancard">${escapeHtml(t.text)}
   <div class="krow"><span class="muted" style="font-size:10px">${escapeHtml(t.by||"")}</span><span>
   ${c.key!=="todo"?`<button onclick="moveTask('${x.id}','${t.tid}','${cols[cols.findIndex(z=>z.key===c.key)-1].key}')">◀</button>`:""}
   ${c.key!=="done"?`<button onclick="moveTask('${x.id}','${t.tid}','${cols[cols.findIndex(z=>z.key===c.key)+1].key}')">▶</button>`:""}
   <button onclick="deleteTask('${x.id}','${t.tid}')">🗑️</button></span></div></div>`).join("")||`<p class="muted" style="font-size:12px">فارغة</p>`}
  </div>`).join("")}</div>`;
}
window.addTask=async(id)=>{
 const text=$("taskText").value.trim(); if(!text||!currentUser)return;
 await push(ref(db,`ideas/${id}/tasks`),{text,col:"todo",by:currentUser.displayName||currentUser.email.split("@")[0],createdAt:Date.now()});
 $("taskText").value=""; openIdea(id,true,true);
};
window.moveTask=async(id,tid,col)=>{await update(ref(db,`ideas/${id}/tasks/${tid}`),{col});openIdea(id,true,true)};
window.deleteTask=async(id,tid)=>{await remove(ref(db,`ideas/${id}/tasks/${tid}`));openIdea(id,true,true)};
// ====== تقييم الشركاء بعد التعاون ======
function renderReviewsSection(x,interested,isOwner){
 const accepted=interested.filter(([,v])=>v.status==="accepted").map(([uid,v])=>({uid,name:v.name}));
 if(!currentUser||!accepted.length)return "";
 const myUid=currentUser.uid;
 const canReviewOwner=accepted.some(a=>a.uid===myUid)&&myUid!==x.authorId;
 const canReviewMembers=isOwner;
 if(!canReviewOwner&&!canReviewMembers)return "";
 let html=`<div class="divider"></div><h3>⭐ تقييم الشركاء بعد التعاون</h3><div style="margin-top:10px">`;
 if(canReviewOwner){
  html+=reviewRow(x.id,x.authorId,x.authorName,"owner");
 }
 if(canReviewMembers){
  accepted.forEach(a=>{html+=reviewRow(x.id,a.uid,a.name,"member")});
 }
 html+="</div>";
 return html;
}
function reviewRow(ideaId,revieweeUid,name,kind){
 const key=`${ideaId}_${revieweeUid}`;
 const mine=(reviewsCache[key]||{})[currentUser.uid]||{};
 const myRating=mine.rating||0;
 return `<div class="comment" style="display:flex;flex-direction:column;gap:8px">
 <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">
 <span>${kind==="owner"?"صاحب الفكرة: ":"عضو الفريق: "}<b>${escapeHtml(name||"مستخدم")}</b></span>
 <span class="starrow" id="stars_${ideaId}_${revieweeUid}">${[1,2,3,4,5].map(n=>`<span class="${n<=myRating?"on":""}" onclick="rateUser('${ideaId}','${revieweeUid}',${n})">⭐</span>`).join("")}</span>
 </div>
 <div style="display:flex;gap:8px"><input id="testi_${ideaId}_${revieweeUid}" maxlength="200" placeholder="توصية قصيرة عن تعاونك معاه (هتظهر على بروفايله)..." value="${escapeHtml(mine.text||"")}"><button class="btn secondary sm" onclick="saveTestimonial('${ideaId}','${revieweeUid}')">حفظ</button></div>
 </div>`;
}
window.rateUser=async(ideaId,revieweeUid,rating)=>{
 if(!currentUser)return;
 await update(ref(db,`reviews/${ideaId}/${revieweeUid}/${currentUser.uid}`),{rating,createdAt:Date.now()});
 toast("⭐ تم حفظ تقييمك","success");
 const snap=await get(ref(db,`reviews/${ideaId}/${revieweeUid}`));
 reviewsCache[`${ideaId}_${revieweeUid}`]=snap.val()||{};
 const el=$("stars_"+ideaId+"_"+revieweeUid);
 if(el)el.innerHTML=[1,2,3,4,5].map(n=>`<span class="${n<=rating?"on":""}" onclick="rateUser('${ideaId}','${revieweeUid}',${n})">⭐</span>`).join("");
};
window.saveTestimonial=async(ideaId,revieweeUid)=>{
 if(!currentUser)return;
 const el=$(`testi_${ideaId}_${revieweeUid}`); if(!el)return;
 const text=el.value.trim().slice(0,200);
 await update(ref(db,`reviews/${ideaId}/${revieweeUid}/${currentUser.uid}`),{text,createdAt:Date.now()});
 const snap=await get(ref(db,`reviews/${ideaId}/${revieweeUid}`));
 reviewsCache[`${ideaId}_${revieweeUid}`]=snap.val()||{};
 toast("💼 تم حفظ التوصية","success");
};
// ====== الأسئلة الشائعة (FAQ) ======
function renderFaq(x,isOwner){
 const faqs=Object.entries(x.faqs||{}).map(([fid,v])=>({fid,...v}));
 const answered=faqs.filter(f=>f.answer);
 const pending=faqs.filter(f=>!f.answer);
 let html=`<div class="divider"></div><h3>❓ أسئلة شائعة عن الفكرة</h3><div style="margin-top:10px">`;
 html+=answered.length?answered.map(f=>`<div class="faqitem"><b>${escapeHtml(f.question)}</b><p>${escapeHtml(f.answer)}</p></div>`).join(""):`<p class="muted">لا توجد أسئلة مُجابة بعد.</p>`;
 if(isOwner&&pending.length){
  html+=`<h4 style="margin:14px 0 8px;color:var(--muted)">أسئلة بانتظار إجابتك (${pending.length})</h4>`;
  html+=pending.map(f=>`<div class="faqitem"><b>${escapeHtml(f.question)}</b><div style="display:flex;gap:8px;margin-top:8px"><input id="ans_${f.fid}" placeholder="اكتب إجابتك..."><button class="btn sm" onclick="answerFaq('${x.id}','${f.fid}')">إرسال</button></div></div>`).join("");
 }
 html+="</div>";
 if(currentUser&&!isOwner){
  html+=`<div style="display:flex;gap:8px;margin-top:10px"><input id="faqQuestion" placeholder="اسأل صاحب الفكرة سؤالاً..." onkeydown="if(event.key==='Enter')askFaq('${x.id}')"><button class="btn secondary sm" onclick="askFaq('${x.id}')">اسأل</button></div>`;
 }
 return html;
}
window.askFaq=async(id)=>{
 const q=$("faqQuestion").value.trim(); if(!q||!currentUser)return;
 await push(ref(db,`ideas/${id}/faqs`),{question:q,askedBy:currentUser.uid,createdAt:Date.now()});
 $("faqQuestion").value=""; toast("❓ تم إرسال سؤالك لصاحب الفكرة","success"); openIdea(id,true,true);
};
window.answerFaq=async(ideaId,fid)=>{
 const ans=$("ans_"+fid).value.trim(); if(!ans)return;
 await update(ref(db,`ideas/${ideaId}/faqs/${fid}`),{answer:ans});
 openIdea(ideaId,true,true);
};
window.toggleTeamFull=async(id)=>{
 const x=allIdeas.find(i=>i.id===id); if(!x||!currentUser||x.authorId!==currentUser.uid)return;
 await update(ref(db,"ideas/"+id),{teamFull:!x.teamFull});
 toast(x.teamFull?"🔓 تم فتح استقبال طلبات الانضمام":"🔒 تم إغلاق استقبال طلبات الانضمام","success");
 openIdea(id,true,true);
};
window.shareWhatsApp=(id,title)=>{
 const url=location.origin+location.pathname+"#idea-"+id;
 window.open(`https://wa.me/?text=${encodeURIComponent(title+" — "+url)}`,"_blank");
};
window.shareTwitter=(id,title)=>{
 const url=location.origin+location.pathname+"#idea-"+id;
 window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`,"_blank");
};
window.shareIdea=async(id,title)=>{
 const url=location.origin+location.pathname+"#idea-"+id;
 if(navigator.share){try{await navigator.share({title,url})}catch(e){}}
 else{await navigator.clipboard.writeText(url);toast("🔗 تم نسخ رابط الفكرة","success")}
};
window.requestJoin=id=>{
 if(!currentUser){openAuth();return}
 const idea=allIdeas.find(x=>x.id===id);if(!idea)return;
 if(blocksMap[idea.authorId]){toast("لقد حظرت صاحب هذه الفكرة","info");return}
 if(idea.teamFull){toast("الفريق مكتمل حاليًا، جرّب التواصل مباشرة برسالة","info");return}
 joinTargetId=id;
 $("joinWhy").value="";$("joinOffer").value="";$("joinLevel").selectedIndex=1;
 openModal("joinModal");
};
window.submitJoinRequest=async()=>{
 if(!currentUser||!joinTargetId)return;
 const idea=allIdeas.find(x=>x.id===joinTargetId);if(!idea)return;
 const why=$("joinWhy").value.trim(),offer=$("joinOffer").value.trim(),level=$("joinLevel").value;
 if(!why&&!offer){toast("اكتب سطر واحد على الأقل عن سبب اهتمامك","error");return}
 const message=[why?`ليه مهتم: ${why}`:"",offer?`هيقدّم: ${offer}`:""].filter(Boolean).join(" | ");
 await set(ref(db,`ideas/${joinTargetId}/interested/${currentUser.uid}`),{name:currentUser.displayName||currentUser.email.split("@")[0],avatar:currentUser.photoURL||avatar(currentUser.uid),message,why,offer,level,createdAt:Date.now()});
 notify(idea.authorId,"join",joinTargetId,idea.title);
 closeModal("joinModal");
 toast("🙋 تم إرسال طلب انضمامك لصاحب الفكرة","success");
};
window.editIdea=id=>{
 const x=allIdeas.find(i=>i.id===id);if(!x)return;
 editingIdeaId=id;
 $("ideaModalTitle").textContent="✏️ تعديل الفكرة";
 $("publishBtn").textContent="💾 حفظ التعديلات"; $("draftBtn").dataset.allowed=x.status==="draft"?"1":"0";
 $("ideaTitle").value=x.title;$("ideaDesc").value=x.desc;$("ideaCategory").value=x.category;$("ideaSkills").value=x.skills||"";
 $("ideaProblem").value=x.problem||"";$("ideaSolution").value=x.solution||"";$("ideaMarket").value=x.market||"";
 $("ideaStageWrap").classList.remove("hidden"); $("ideaStage").value=x.status==="draft"?"idea":(x.status||"idea");
 uploadedImageUrl=x.imageUrl||"";
 $("imgPreview").src=x.imageUrl||DEFAULT_IMAGE; $("imgPreviewWrap").classList.remove("hidden");
 ideaCurrentStep=1; updateIdeaStepUI();
 closeModal("detailModal"); openModal("ideaModal");
};
async function loadComments(id){
 const snap=await get(ref(db,`comments/${id}`)); const d=snap.val()||{};
 const arr=Object.entries(d).map(([cid,v])=>({cid,...v})).sort((a,b)=>(a.createdAt||0)-(b.createdAt||0));
 const idea=allIdeas.find(x=>x.id===id);
 $("comments").innerHTML=arr.length?arr.map(c=>{
  const canDelete=currentUser&&(currentUser.uid===c.authorId||currentUser.uid===idea?.authorId||isAdmin());
  return `<div class="comment"><div class="commenthead"><img class="avatar" src="${safeAttr(c.avatar||avatar(c.authorName))}">${escapeHtml(c.authorName)} <span class="muted" style="font-size:11px">${fmt(c.createdAt)}</span>${canDelete?`<button class="btn ghost sm" style="margin-inline-start:auto;padding:3px 8px" onclick="deleteComment('${id}','${c.cid}')">حذف</button>`:""}</div><p>${renderCommentText(c.text)}</p></div>`;
 }).join(""):`<p class="muted" style="margin-top:12px">لا توجد تعليقات بعد. كن أول من يعلّق 💬</p>`;
}
window.deleteComment=async(ideaId,cid)=>{
 if(confirm("حذف هذا التعليق؟")){await remove(ref(db,`comments/${ideaId}/${cid}`));loadComments(ideaId)}
};
async function loadUpdates(id){
 const snap=await get(ref(db,`ideas/${id}/updates`)); const d=snap.val()||{};
 const arr=Object.entries(d).map(([uid,v])=>({uid,...v})).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
 $("ideaUpdates").innerHTML=arr.length?arr.map(u=>`<div class="comment"><div class="commenthead">📌 <span class="muted" style="font-size:11px">${fmt(u.createdAt)}</span></div><p>${escapeHtml(u.text)}</p></div>`).join(""):`<p class="muted">لا توجد تحديثات بعد.</p>`;
}
window.postUpdate=async(id)=>{
 const text=$("updateText").value.trim(); if(!text||!currentUser)return;
 const idea=allIdeas.find(x=>x.id===id); if(!idea||idea.authorId!==currentUser.uid)return;
 await push(ref(db,`ideas/${id}/updates`),{text,createdAt:Date.now()});
 await update(ref(db,"ideas/"+id),{lastUpdateAt:Date.now()});
 Object.keys(idea.interested||{}).forEach(uid=>notify(uid,"update",id,idea.title));
 $("updateText").value=""; loadUpdates(id); toast("📌 تم نشر التحديث","success");
};
window.onMentionInput=(el)=>{
 const val=el.value, caret=el.selectionStart;
 const uptoCaret=val.slice(0,caret);
 const m=uptoCaret.match(/@([\p{L}\p{N} ]{1,20})$/u);
 const list=$("mentionAutolist");
 if(!m){list.classList.remove("show");return}
 const q=m[1].trim().toLowerCase();
 const matches=allUsers.filter(u=>u.uid!==currentUser?.uid&&(u.displayName||"").toLowerCase().includes(q)).slice(0,6);
 if(!matches.length){list.classList.remove("show");return}
 list.innerHTML=matches.map(u=>`<div class="row" onclick="insertMention('${escapeHtml(u.displayName).replace(/'/g,"\\'")}')"><img src="${safeAttr(u.photoURL||avatar(u.displayName||u.uid))}">${escapeHtml(u.displayName)}</div>`).join("");
 list.classList.add("show");
};
window.insertMention=(name)=>{
 const el=$("commentText"); if(!el)return;
 const caret=el.selectionStart, val=el.value;
 const before=val.slice(0,caret).replace(/@([\p{L}\p{N} ]{0,20})$/u,"@"+name+" ");
 el.value=before+val.slice(caret);
 $("mentionAutolist").classList.remove("show");
 el.focus();
};
document.addEventListener("click",e=>{if(!e.target.closest(".autocomplete"))document.querySelectorAll(".autolist.show").forEach(l=>l.classList.remove("show"))});
window.addComment=async()=>{
 const text=$("commentText").value.trim();if(!text||!currentUser||!selectedIdeaId)return;
 const lastC=Number(localStorage.getItem("lastCommentAt")||0);
 if(Date.now()-lastC<COMMENT_COOLDOWN_MS){toast("تمهّل شوية بين تعليق وآخر 🙂","info");return}
 localStorage.setItem("lastCommentAt",String(Date.now()));
 const idea=allIdeas.find(x=>x.id===selectedIdeaId);
 await set(push(ref(db,`comments/${selectedIdeaId}`)),{text,authorId:currentUser.uid,authorName:currentUser.displayName||currentUser.email.split("@")[0],avatar:currentUser.photoURL||avatar(currentUser.uid),createdAt:Date.now()});
 if(idea)notify(idea.authorId,"comment",selectedIdeaId,idea.title);
 notifyMentions(text,selectedIdeaId,idea?.title,idea?.authorId);
 $("commentText").value="";loadComments(selectedIdeaId);
};
function notifyMentions(text,ideaId,ideaTitle,skipUid){
 if(!text.includes("@"))return;
 const names=allUsers.map(u=>u.displayName).filter(Boolean).sort((a,b)=>b.length-a.length);
 const mentionedUids=new Set();
 names.forEach(name=>{
  if(mentionedUids.size>=5)return; // حد أقصى منطقي لكل تعليق
  const esc=name.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
  if(new RegExp("@"+esc+"(?![\\p{L}\\p{N}])","u").test(text)){
   const u=allUsers.find(x=>x.displayName===name);
   if(u&&u.uid!==currentUser.uid&&u.uid!==skipUid)mentionedUids.add(u.uid);
  }
 });
 mentionedUids.forEach(uid=>notify(uid,"mention",ideaId,ideaTitle));
}
function renderCommentText(text){
 const names=allUsers.map(u=>u.displayName).filter(Boolean).sort((a,b)=>b.length-a.length);
 let escaped=escapeHtml(text);
 names.forEach(name=>{
  const escName=escapeHtml(name).replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
  escaped=escaped.replace(new RegExp("@"+escName+"(?![\\p{L}\\p{N}])","gu"),`<b style="color:var(--primary)">@${escapeHtml(name)}</b>`);
 });
 return escaped;
}
window.deleteIdea=async id=>{
 if(!currentUser)return;const x=allIdeas.find(i=>i.id===id);
 if(x?.authorId!==currentUser.uid&&!isAdmin()){toast("غير مسموح","error");return}
 if(confirm("هل تريد حذف الفكرة؟")){await remove(ref(db,"ideas/"+id));closeModal("detailModal");toast("تم الحذف","success")}
};
function resizeImage(file,maxDim,quality){
 return new Promise((resolve,reject)=>{
  const reader=new FileReader();
  reader.onload=e=>{
   const img=new Image();
   img.onload=()=>{
    let w=img.width,h=img.height;
    if(w>maxDim||h>maxDim){if(w>h){h=Math.round(h*maxDim/w);w=maxDim}else{w=Math.round(w*maxDim/h);h=maxDim}}
    const canvas=document.createElement("canvas");canvas.width=w;canvas.height=h;
    canvas.getContext("2d").drawImage(img,0,0,w,h);
    resolve(canvas.toDataURL("image/jpeg",quality));
   };
   img.onerror=()=>reject(new Error("تعذر قراءة الصورة"));
   img.src=e.target.result;
  };
  reader.onerror=()=>reject(new Error("تعذر قراءة الملف"));
  reader.readAsDataURL(file);
 });
}
function dataUrlToBlob(dataUrl){
 const parts=String(dataUrl||"").split(",");
 if(parts.length!==2)throw new Error("صيغة الصورة غير صحيحة");
 const head=parts[0],b64=parts[1],match=head.match(/^data:(.*?);base64$/);
 if(!match)throw new Error("صيغة الصورة غير صحيحة");
 const mime=match[1];
 const bin=atob(b64); const bytes=new Uint8Array(bin.length);
 for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);
 return new Blob([bytes],{type:mime});
}
async function uploadToImgbb(dataUrl){
 if(!IMGBB_KEY)throw new Error("مفتاح ImgBB غير موجود");
 const parts=String(dataUrl||"").split(",");
 if(parts.length!==2)throw new Error("صيغة الصورة غير صحيحة");
 const base64=parts[1];
 const form=new FormData();
 form.append("image",base64);
 const ctrl=new AbortController();
 const t=setTimeout(()=>ctrl.abort(),20000);
 try{
  const res=await fetch(`https://api.imgbb.com/1/upload?key=${encodeURIComponent(IMGBB_KEY)}`,{method:"POST",body:form,signal:ctrl.signal});
  if(!res.ok)throw new Error("ImgBB upload failed: "+res.status);
  const json=await res.json();
  if(json?.success&&json?.data?.url)return json.data.url;
  if(json?.data?.url)return json.data.url;
  throw new Error(json?.error?.message||"لم يرجع ImgBB رابط الصورة");
 }finally{clearTimeout(t)}
}
async function uploadImageData(dataUrl){
 const url=await uploadToImgbb(dataUrl);
 return {url,hosted:true};
}
document.addEventListener("change",e=>{
 const t=e.target;
 if(t?.id==="ideaImageFile") window.handleImageUpload(t);
 if(t?.id==="profilePhotoFile") window.handleProfilePhoto(t);
 if(t?.id==="postImageFile") window.handlePostImage(t);
});
window.handleImageUpload=async(input)=>{
 const file=input?.files?.[0]; if(!file)return;
 if(!file.type.startsWith("image/")){toast("اختر ملف صورة صحيح","error");return}
 if(file.size>8*1024*1024){toast("حجم الصورة أكبر من 8MB، اختر صورة أصغر","error");return}
 $("uploadStatus").innerHTML='<span class="spinner"></span> جارٍ معالجة الصورة...';
 try{
  const dataUrl=await resizeImage(file,1280,.78);
  $("uploadStatus").innerHTML='<span class="spinner"></span> جارٍ الرفع...';
  const {url}=await uploadImageData(dataUrl);
  uploadedImageUrl=url;
  $("imgPreview").src=uploadedImageUrl; $("imgPreviewWrap").classList.remove("hidden");
  $("uploadStatus").textContent="✅ تم رفع الصورة على ImgBB";
 }catch(e){toast("تعذّر معالجة الصورة، جرّب صورة أخرى","error");$("uploadStatus").textContent=""}
};
window.removeImage=()=>{uploadedImageUrl="";$("imgPreviewWrap")?.classList.add("hidden");if($("ideaImageFile"))$("ideaImageFile").value="";if($("uploadStatus"))$("uploadStatus").textContent=""};
window.handleProfilePhoto=async(input)=>{
 const file=input?.files?.[0]; if(!file||!currentUser||profilePhotoUploading)return;
 if(!file.type.startsWith("image/")){toast("اختر ملف صورة صحيح","error");return}
 if(file.size>8*1024*1024){toast("حجم الصورة أكبر من 8MB","error");return}
 profilePhotoUploading=true;
 try{
  const dataUrl=await resizeImage(file,500,.82);
  $("myAvatarImg").src=dataUrl; // معاينة فورية بغض النظر عن نتيجة الرفع
  const {url}=await uploadImageData(dataUrl);
  await updateProfile(auth.currentUser,{photoURL:url});
  await update(ref(db,"users/"+currentUser.uid),{photoURL:url});
  currentUser=auth.currentUser;
  renderHeaderAuth(); renderProfile();
  toast("✅ تم تحديث صورة البروفايل","success");
 }catch(e){console.error(e);toast("تعذّر رفع الصورة، جرّب مرة أخرى بعد قليل","error")}
 finally{profilePhotoUploading=false}
};
let ideaCurrentStep=1;
function updateIdeaStepUI(){
 document.querySelectorAll(".ideastep").forEach(el=>el.classList.toggle("hidden",Number(el.dataset.step)!==ideaCurrentStep));
 document.querySelectorAll("#ideaStepBar .stepdot").forEach(el=>{
  const n=Number(el.dataset.step);
  el.classList.toggle("active",n===ideaCurrentStep);
  el.classList.toggle("done",n<ideaCurrentStep);
 });
 $("ideaBackBtn").classList.toggle("hidden",ideaCurrentStep===1);
 $("ideaNextBtn").classList.toggle("hidden",ideaCurrentStep===3);
 $("draftBtn").classList.toggle("hidden",ideaCurrentStep!==3||$("draftBtn").dataset.allowed==="0");
 $("publishBtn").classList.toggle("hidden",ideaCurrentStep!==3);
}
window.ideaStepNext=()=>{
 if(ideaCurrentStep===1){
  const t=$("ideaTitle").value.trim();
  if(t.length<3){toast("اكتب عنوانًا أوضح (3 أحرف على الأقل) الأول","error");return}
 }
 ideaCurrentStep=Math.min(3,ideaCurrentStep+1);
 updateIdeaStepUI();
};
window.ideaStepBack=()=>{ideaCurrentStep=Math.max(1,ideaCurrentStep-1);updateIdeaStepUI()};
window.goToIdeaStep=(n)=>{
 if(n>1&&!editingIdeaId&&$("ideaTitle").value.trim().length<3){toast("اكتب عنوانًا أوضح (3 أحرف على الأقل) الأول","error");return}
 ideaCurrentStep=n;updateIdeaStepUI();
};
function resetIdeaForm(){
 editingIdeaId=null;
 $("ideaModalTitle").textContent="💡 نشر فكرة"; $("publishBtn").textContent="🚀 نشر الفكرة";
 $("ideaTitle").value="";$("ideaDesc").value="";$("ideaSkills").value="";$("ideaCategory").selectedIndex=0;
 $("ideaProblem").value="";$("ideaSolution").value="";$("ideaMarket").value="";
 $("ideaStage").value="idea"; $("ideaStageWrap").classList.add("hidden");
 $("draftBtn").dataset.allowed="1";
 ideaCurrentStep=1; updateIdeaStepUI();
 removeImage();
}
window.publishIdea=async(isDraft)=>{
 if(!currentUser){openAuth();return}
 const title=$("ideaTitle").value.trim(),desc=$("ideaDesc").value.trim(),category=$("ideaCategory").value,skills=$("ideaSkills").value.trim();
 const problem=$("ideaProblem").value.trim(),solution=$("ideaSolution").value.trim(),market=$("ideaMarket").value.trim();
 if(title.length<3){toast("اكتب عنوانًا أوضح (3 أحرف على الأقل)","error");return}
 if(!isDraft&&desc.length<10){toast("الوصف قصير جدًا، وضّح فكرتك أكتر","error");return}
 const wasEditing=editingIdeaId;
 if(!wasEditing&&!isDraft){
  const lastPost=Number(localStorage.getItem("lastIdeaPostAt")||0);
  if(Date.now()-lastPost<IDEA_COOLDOWN_MS){toast("مهلة بسيطة بين فكرة وأخرى عشان نمنع السبام، حاول بعد دقيقتين ⏱️","info");return}
  const openCount=allIdeas.filter(x=>x.authorId===currentUser.uid&&x.status!=="draft"&&x.status!=="launched"&&x.status!=="archived").length;
  if(openCount>=MAX_OPEN_IDEAS){toast(`وصلت للحد الأقصى (${MAX_OPEN_IDEAS}) من الأفكار المفتوحة، أغلق أو أطلق فكرة قديمة أولاً`,"error");return}
 }
 const btn=isDraft?$("draftBtn"):$("publishBtn");
 btn.disabled=true; btn.innerHTML=`<span class="spinner"></span> جارٍ الحفظ...`;
 try{
  const stage=isDraft?"draft":($("ideaStage")?.value||"idea");
  if(wasEditing){
   await update(ref(db,"ideas/"+wasEditing),{title,desc,category,skills,problem,solution,market,imageUrl:uploadedImageUrl||DEFAULT_IMAGE,status:stage});
   toast(isDraft?"💾 تم حفظ المسودة":"💾 تم حفظ التعديلات","success");
   if(!isDraft)notifyInterestedUsers(category,title,wasEditing,skills);
  }else{
   const obj={title,desc,category,skills,problem,solution,market,imageUrl:uploadedImageUrl||DEFAULT_IMAGE,authorId:currentUser.uid,authorName:currentUser.displayName||currentUser.email.split("@")[0],authorAvatar:currentUser.photoURL||avatar(currentUser.uid),createdAt:Date.now(),status:stage,teamFull:false,views:0};
   const newRef=push(ref(db,"ideas")); await set(newRef,obj);
   toast(isDraft?"💾 تم حفظ فكرتك كمسودة":"🚀 تم نشر فكرتك بنجاح","success");
   if(!isDraft){notifyInterestedUsers(category,title,newRef.key,skills);localStorage.setItem("lastIdeaPostAt",String(Date.now()))}
  }
  closeModal("ideaModal"); showPage(isDraft?"profile":"ideas");
 }catch(e){toast("حدث خطأ: "+e.message,"error")}
 finally{btn.disabled=false;btn.innerHTML=isDraft?"💾 حفظ كمسودة":(editingIdeaId?"💾 حفظ التعديلات":"🚀 نشر الفكرة")}
};
function notifyInterestedUsers(category,title,ideaId,skills){
 const ideaSkills=(skills||"").split(",").map(s=>s.trim().toLowerCase()).filter(Boolean);
 allUsers.filter(u=>u.uid&&u.uid!==currentUser.uid).forEach(u=>{
  const interestMatch=u.interests&&u.interests[category];
  let matchedSkill="";
  if(!interestMatch&&ideaSkills.length&&u.skills){
   const uSkills=(u.skills||"").split(",").map(s=>s.trim().toLowerCase()).filter(Boolean);
   matchedSkill=uSkills.find(s=>ideaSkills.some(is=>s.includes(is)||is.includes(s)))||"";
  }
  if(!interestMatch&&!matchedSkill)return;
  const text=matchedSkill?`نشر فكرة محتاجة مهارتك في "${matchedSkill}" 🎯`:`نشر فكرة جديدة في مجال "${category}" يهمك`;
  push(ref(db,`notifications/${u.uid}`),{type:"match",ideaId,ideaTitle:title,fromName:currentUser.displayName||currentUser.email.split("@")[0],text,createdAt:Date.now(),read:false});
 });
}

window.openReport=id=>{selectedIdeaId=id;openModal("reportModal")};
window.submitReport=async()=>{
 if(!currentUser){openAuth();return}
 await set(push(ref(db,"reports")),{ideaId:selectedIdeaId,reason:$("reportReason").value,reporterId:currentUser.uid,reporterEmail:currentUser.email,createdAt:Date.now(),status:"open"});
 closeModal("reportModal");toast("تم إرسال البلاغ للمراجعة","success");
};
function renderProjects(){
 if(!$("projectsGrid"))return;
 const p=allIdeas.filter(x=>x.status==="launched");
 $("projectsGrid").innerHTML=p.length?p.map(card).join(""):`<div class="empty">المشاريع التي ستنطلق من هنا ستظهر في هذا القسم 🚀</div>`;
}
function renderLeaderboard(){
 if(!$("leaderboardList"))return;
 const since=Date.now()-30*24*60*60*1000;
 const scores={};
 allIdeas.filter(x=>x.status!=="draft").forEach(x=>{
  if(!x.authorId)return;
  const s=scores[x.authorId]||{uid:x.authorId,name:x.authorName,avatar:x.authorAvatar,ideas:0,likes:0,views:0,recentIdeas:0};
  s.name=x.authorName;s.avatar=x.authorAvatar;
  s.likes+=likesCount(x); s.views+=(x.views||0);
  if((x.createdAt||0)>=since){s.ideas++;s.recentIdeas++}
  scores[x.authorId]=s;
 });
 const ranked=Object.values(scores).map(s=>({...s,score:s.recentIdeas*15+s.likes*2+Math.round(s.views*.1)})).filter(s=>s.score>0).sort((a,b)=>b.score-a.score).slice(0,20);
 const medals=["🥇","🥈","🥉"];
 $("leaderboardList").innerHTML=ranked.length?`<div class="card" style="padding:6px">${ranked.map((s,i)=>`
  <div class="comment authorlink" style="display:flex;align-items:center;gap:12px;padding:14px" onclick="openPublicProfile('${s.uid}')">
   <span style="width:30px;text-align:center;font-weight:900;font-size:${i<3?"20px":"14px"}">${medals[i]||(i+1)}</span>
   <img class="avatar" src="${safeAttr(s.avatar||avatar(s.name||"مبتكر"))}">
   <div style="flex:1"><b>${escapeHtml(s.name||"مبتكر")}</b><div class="muted" style="font-size:12px">💡 ${s.ideas} فكرة هذا الشهر · ❤️ ${s.likes} إعجاب</div></div>
   <span class="pill">${s.score} نقطة</span>
  </div>`).join("")}</div>`:`<div class="empty">لسه مفيش نشاط كافٍ لعرض المتصدرين الشهر ده، ابدأ بنشر فكرة 🚀</div>`;
}
function renderProfile(){
 if(!$("profileContent"))return;
 if(!currentUser){$("profileContent").innerHTML=`<div class="empty">سجّل الدخول لرؤية ملفك الشخصي.</div>`;return}
 const mineAll=allIdeas.filter(x=>x.authorId===currentUser.uid);
 const mine=mineAll.filter(x=>x.status!=="draft");
 const drafts=mineAll.filter(x=>x.status==="draft");
 const saved=allIdeas.filter(x=>savesMap[x.id]);
 const totalLikes=mine.reduce((n,x)=>n+likesCount(x),0), totalViews=mine.reduce((n,x)=>n+(x.views||0),0);
 const followingCount=Object.keys(followsMap).length;
 const myRecord=allUsers.find(u=>u.uid===currentUser.uid)||{};
 const mySkillsList=(myRecord.skills||"").split(",").map(s=>s.trim()).filter(Boolean);
 $("profileContent").innerHTML=`<div class="profilebox"><div style="position:relative;width:100px;margin:auto">
 <img class="bigavatar" id="myAvatarImg" src="${safeAttr(currentUser.photoURL||avatar(currentUser.uid))}">
 <label class="btn secondary sm iconbtn profile-file-label" aria-label="تغيير الصورة" title="تغيير صورة البروفايل">📷<input id="profilePhotoFile" type="file" accept="image/*" class="upload-file-input"></label>
 </div>
 <div><h1>${escapeHtml(currentUser.displayName||currentUser.email.split("@")[0])}${verifiedBadge(currentUser.uid)}</h1><p class="muted">${escapeHtml(currentUser.email)}</p>
 <div class="pills"><span class="pill">💡 ${mine.length} أفكار</span><span class="pill">❤️ ${totalLikes} إعجاب</span><span class="pill">👁️ ${totalViews} مشاهدة</span><span class="pill">👥 ${followingCount} متابَع</span>${ratingPill(currentUser.uid)}${isAdmin()?'<span class="pill">👑 Admin</span>':""}${badgesFor(mine,totalLikes).map(b=>`<span class="pill badge-pill">${b}</span>`).join("")}</div>
 <div class="actions" style="justify-content:flex-start;margin-top:14px"><button class="btn" onclick="requireAuth('idea')">+ فكرة جديدة</button><button class="btn secondary" onclick="exportMyData()">📦 تصدير بياناتي</button>${isAdmin()?'<button class="btn secondary" onclick="showPage(\'admin\')">👑 لوحة الأدمن</button>':""}</div>
 <div class="refbox"><span style="font-size:20px">🔗</span><div style="flex:1;min-width:200px"><b>ادعُ أصدقاءك</b><p class="muted" style="font-size:12px;margin-top:2px">${Object.keys(referralsMap||{}).length} صديق انضم عن طريقك</p></div><input readonly value="${location.origin+location.pathname}?ref=${currentUser.uid}" onclick="this.select()"><button class="btn secondary sm" onclick="copyReferralLink()">نسخ الرابط</button></div>
 <div class="refbox social-profile-extra"><b>💼 الملف المهني</b><input id="myHeadlineInput" maxlength="100" placeholder="مثلاً: مطور Full Stack | مؤسس ناشئ" value="${escapeHtml(myRecord.headline||"")}"><textarea id="myBioInput" maxlength="500" placeholder="نبذة قصيرة عنك، خبرتك، وما الذي تبحث عنه...">${escapeHtml(myRecord.bio||"")}</textarea><button class="btn secondary sm" style="align-self:flex-start" onclick="saveMyProfessionalProfile()">حفظ الملف المهني</button></div>
 <div class="refbox" style="flex-direction:column;align-items:stretch;gap:10px"><div style="display:flex;align-items:center;gap:8px"><span style="font-size:20px">🎯</span><div><b>مهاراتي</b><p class="muted" style="font-size:12px;margin-top:2px">هنرشحلك الأفكار اللي محتاجة مهاراتك بالظبط</p></div></div>
 ${mySkillsList.length?`<div class="tags">${mySkillsList.map(s=>`<span class="tag">${escapeHtml(s)}</span>`).join("")}</div>`:""}
 <div style="display:flex;gap:8px;flex-wrap:wrap"><input id="mySkillsInput" maxlength="150" placeholder="Python, تصميم UI/UX, تسويق..." value="${escapeHtml(myRecord.skills||"")}"><button class="btn secondary sm" onclick="saveMySkills()">حفظ</button></div></div>
 <div class="refbox" style="flex-direction:column;align-items:stretch;gap:10px"><div style="display:flex;align-items:center;gap:8px"><span style="font-size:20px">📍</span><div><b>مشاركة الموقع</b><p class="muted" style="font-size:12px;margin-top:2px">لو فعّلتها، هيظهرلك ويظهر لغيرك أقرب المبتكرين جغرافيًا في صفحة "الأشخاص". موقعك متخزن تقريبي فقط ومتاح إلغاؤه في أي وقت.</p></div></div>
 <button class="btn ${myRecord.locationEnabled?"success":"secondary"} sm" style="align-self:flex-start" onclick="toggleLocationSharing()">${myRecord.locationEnabled?"✅ مفعّلة — اضغط للإيقاف":"📍 تفعيل مشاركة الموقع"}</button></div>
 </div></div>
 <div class="section-head" style="margin-top:25px"><h2>أفكاري</h2></div><div class="grid">${mine.length?mine.map(card).join(""):`<div class="empty">لم تنشر أي فكرة بعد.</div>`}</div>
 ${drafts.length?`<div class="section-head" style="margin-top:30px"><h2>📝 مسوداتي</h2></div><div class="grid">${drafts.map(card).join("")}</div>`:""}
 <div class="section-head" style="margin-top:30px"><h2>🔖 المحفوظات</h2></div><div class="grid">${saved.length?saved.map(card).join(""):`<div class="empty">لسه محفظتش أي فكرة، اضغط 📑 على أي كارت لحفظه.</div>`}</div>
 ${renderTestimonials(currentUser.uid)}`;
 initCharCounters();
}
window.saveMySkills=async()=>{
 if(!currentUser)return;
 const val=$("mySkillsInput").value.trim().slice(0,150);
 await update(ref(db,"users/"+currentUser.uid),{skills:val});
 toast("✅ تم حفظ مهاراتك","success");
};
window.saveMyProfessionalProfile=async()=>{if(!currentUser)return;const headline=$("myHeadlineInput")?.value.trim().slice(0,100)||"";const bio=$("myBioInput")?.value.trim().slice(0,500)||"";await update(ref(db,"users/"+currentUser.uid),{headline,bio});toast("✅ تم تحديث ملفك المهني","success")};

/* ---------- مشاركة الموقع والأشخاص القريبون ---------- */
window.toggleLocationSharing=()=>{
 if(!currentUser)return;
 const myRecord=allUsers.find(u=>u.uid===currentUser.uid)||{};
 if(myRecord.locationEnabled){
  update(ref(db,"users/"+currentUser.uid),{locationEnabled:false,location:null});
  toast("تم إيقاف مشاركة الموقع","info");
  return;
 }
 if(!navigator.geolocation){toast("متصفحك لا يدعم تحديد الموقع","error");return}
 toast("📍 جارٍ طلب إذن تحديد الموقع...","info");
 navigator.geolocation.getCurrentPosition(async pos=>{
  await update(ref(db,"users/"+currentUser.uid),{locationEnabled:true,location:{lat:pos.coords.latitude,lng:pos.coords.longitude,updatedAt:Date.now()}});
  toast("✅ تم تفعيل مشاركة الموقع","success");
 },err=>{
  toast(err.code===1?"لازم توافق على إذن الموقع من المتصفح":"تعذّر تحديد موقعك، حاول تاني","error");
 },{enableHighAccuracy:false,timeout:10000});
};
function distanceKm(a,b){
 const R=6371, dLat=(b.lat-a.lat)*Math.PI/180, dLng=(b.lng-a.lng)*Math.PI/180;
 const s=Math.sin(dLat/2)**2+Math.cos(a.lat*Math.PI/180)*Math.cos(b.lat*Math.PI/180)*Math.sin(dLng/2)**2;
 return R*2*Math.atan2(Math.sqrt(s),Math.sqrt(1-s));
}
let peopleMode="all";
function personCard(u,extra){
 return `<div class="card" style="padding:16px;cursor:pointer" onclick="openPublicProfile('${u.uid}')">
 <div style="display:flex;align-items:center;gap:10px">
  <img class="avatar" src="${safeAttr(u.photoURL||avatar(u.displayName||u.uid))}">
  <div style="flex:1;min-width:0"><b style="display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(u.displayName||"مستخدم")}${verifiedBadge(u.uid)}</b>${extra?`<span class="muted" style="font-size:12px">${extra}</span>`:""}</div>
 </div>
 ${(u.skills||"").trim()?`<div class="tags" style="margin-top:10px">${(u.skills||"").split(",").filter(Boolean).slice(0,4).map(s=>`<span class="tag">${escapeHtml(s.trim())}</span>`).join("")}</div>`:""}
 </div>`;
}
window.renderPeople=()=>{
 if(!$("peopleGrid"))return;
 const q=($("peopleSearch")?.value||"").trim().toLowerCase();
 let list=allUsers.filter(u=>u.uid!==currentUser?.uid);
 if(q)list=list.filter(u=>(u.displayName||"").toLowerCase().includes(q)||(u.skills||"").toLowerCase().includes(q));
 if(peopleMode==="nearby"){
  const myRecord=allUsers.find(u=>u.uid===currentUser?.uid);
  if(!currentUser||!myRecord?.locationEnabled||!myRecord?.location){
   $("peopleGrid").innerHTML=`<div class="empty">لازم تفعّل مشاركة موقعك الأول من صفحة "ملفي" علشان تقدر تشوف الأقرب منك.</div>`;
   return;
  }
  list=list.filter(u=>u.locationEnabled&&u.location).map(u=>({...u,__dist:distanceKm(myRecord.location,u.location)})).sort((a,b)=>a.__dist-b.__dist);
  $("peopleGrid").innerHTML=list.length?list.map(u=>personCard(u,`📍 على بعد ${u.__dist<1?"أقل من كم":Math.round(u.__dist)+" كم"} تقريبًا`)).join(""):`<div class="empty">مفيش حد فعّل مشاركة الموقع قريب منك دلوقتي.</div>`;
  return;
 }
 $("peopleGrid").innerHTML=list.length?list.map(u=>personCard(u)).join(""):`<div class="empty">لا يوجد أشخاص بمطابقة البحث.</div>`;
};
window.findNearbyPeople=()=>{
 if(!currentUser){toast("سجّل الدخول أولاً","info");openAuthMode("login");return}
 peopleMode=peopleMode==="nearby"?"all":"nearby";
 $("nearbyBtn").classList.toggle("success",peopleMode==="nearby");
 $("nearbyBtn").textContent=peopleMode==="nearby"?"👥 كل الأشخاص":"📍 الأقرب مني";
 renderPeople();
};
$("peopleSearch")?.addEventListener("input",()=>{clearTimeout(searchDebounce);searchDebounce=setTimeout(renderPeople,200)});
function renderNotifications(){
 if(!$("notificationsList"))return;
 if(!currentUser){$("notificationsList").innerHTML=`<p class="muted">سجّل الدخول لرؤية الإشعارات.</p>`;return}
 const list=Object.entries(notifMap).map(([id,n])=>({id,...n})).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
 const icons={like:"❤️",comment:"💬",join:"🙋",update:"📌",follow:"👥",message:"💬",match:"✨",accepted:"🎉",mention:"📣",connection:"🤝"};
 $("notificationsList").innerHTML=list.length?list.map(n=>`<div class="comment" style="cursor:pointer;${n.read?"":"background:rgba(56,162,140,.08)"}" onclick="${n.ideaId?`openIdea('${n.ideaId}')`:(n.type==="follow"?"showPage('notifications')":"")}">
  <div class="commenthead">${icons[n.type]||"🔔"} <b>${escapeHtml(n.fromName)}</b> ${escapeHtml(n.text)}</div>
  <p>${escapeHtml(n.ideaTitle||"")} · <span style="font-size:11px">${fmt(n.createdAt)}</span></p></div>`).join(""):`<p class="muted">لا توجد إشعارات بعد. أول ما حد يتفاعل مع أفكارك هتلاقيها هنا 🔔</p>`;
 const unreadIds=list.filter(n=>!n.read).map(n=>n.id);
 if(unreadIds.length){const updates={};unreadIds.forEach(id=>updates[`notifications/${currentUser.uid}/${id}/read`]=true);update(ref(db),updates)}
}
let currentAdminTab="overview";
window.adminTab=(tab,btn)=>{
 currentAdminTab=tab;
 document.querySelectorAll(".adminnav button").forEach(b=>b.classList.remove("active"));btn?.classList.add("active");renderAdmin(tab);
};
function renderAdmin(tab="overview"){
 if(!$("adminContent"))return;
 currentAdminTab=tab;
 if(!currentUser||!isAdmin()){if($("admin").classList.contains("active"))$("adminContent").innerHTML='<div class="empty">هذه الصفحة للأدمن فقط.</div>';return}
 if(tab==="overview"){
  $("adminContent").innerHTML=`<div class="statsgrid" style="margin-bottom:18px"><div class="statitem"><b>${allUsers.length}</b><span>المستخدمون</span></div><div class="statitem"><b>${allIdeas.length}</b><span>الأفكار</span></div><div class="statitem"><b>${allReports.filter(x=>x.status==="open").length}</b><span>بلاغات مفتوحة</span></div><div class="statitem"><b>${allIdeas.reduce((n,x)=>n+likesCount(x),0)}</b><span>إعجابات</span></div></div>
  <div class="card" style="padding:18px"><h3>⚡ حالة النظام</h3><p class="muted" style="margin-top:8px">Firebase Auth + Realtime Database متصلان. رابط الدعم الحالي: <b>${SUPPORT_URL?escapeHtml(SUPPORT_URL):"غير مضبوط"}</b></p></div>`;
 }else if(tab==="users"){
  const rows=list=>list.map(u=>`<tr><td>${escapeHtml(u.displayName||"-")}</td><td>${escapeHtml(u.email||"-")}</td><td style="font-size:11px">${escapeHtml(u.uid||"-")}</td><td>${fmt(u.createdAt)}</td><td>${adminMap[u.uid]?'<span class="pill">👑 أدمن</span>':""} ${verifiedMap[u.uid]?'<span class="pill">✔️ موثّق</span>':""}</td><td style="display:flex;gap:6px;flex-wrap:wrap"><button class="btn ${verifiedMap[u.uid]?"success":"secondary"} sm" onclick="toggleVerified('${u.uid}')">${verifiedMap[u.uid]?"✔️ موثّق":"توثيق"}</button><button class="btn ${adminMap[u.uid]?"danger":"secondary"} sm" onclick="toggleAdmin('${u.uid}')">${adminMap[u.uid]?"إزالة أدمن":"ترقية لأدمن"}</button></td></tr>`).join("")||`<tr><td colspan="6">لا يوجد مستخدمون بمطابقة البحث.</td></tr>`;
  $("adminContent").innerHTML=`<input id="adminSearchUsers" placeholder="🔍 ابحث بالاسم أو البريد أو الـ UID..." style="width:100%;margin-bottom:12px"><div class="tablewrap"><table class="table"><tr><th>الاسم</th><th>البريد</th><th>UID</th><th>التاريخ</th><th>الحالة</th><th>إجراءات</th></tr><tbody id="adminUsersRows">${rows(allUsers)}</tbody></table></div>`;
  $("adminSearchUsers").addEventListener("input",e=>{const q=e.target.value.trim().toLowerCase();$("adminUsersRows").innerHTML=rows(q?allUsers.filter(u=>(u.displayName||"").toLowerCase().includes(q)||(u.email||"").toLowerCase().includes(q)||(u.uid||"").toLowerCase().includes(q)):allUsers)});
 }else if(tab==="ideas"){
  const rows=list=>list.map(x=>`<tr><td>${escapeHtml(x.title)}</td><td>${escapeHtml(x.authorName)}</td><td>${escapeHtml(x.category)}</td><td><button class="btn danger sm" onclick="adminDeleteIdea('${x.id}')">حذف</button></td></tr>`).join("")||`<tr><td colspan="4">لا توجد أفكار بمطابقة البحث.</td></tr>`;
  $("adminContent").innerHTML=`<input id="adminSearchIdeas" placeholder="🔍 ابحث بعنوان الفكرة أو صاحبها أو التصنيف..." style="width:100%;margin-bottom:12px"><div class="tablewrap"><table class="table"><tr><th>الفكرة</th><th>صاحبها</th><th>التصنيف</th><th>إجراء</th></tr><tbody id="adminIdeasRows">${rows(allIdeas)}</tbody></table></div>`;
  $("adminSearchIdeas").addEventListener("input",e=>{const q=e.target.value.trim().toLowerCase();$("adminIdeasRows").innerHTML=rows(q?allIdeas.filter(x=>(x.title||"").toLowerCase().includes(q)||(x.authorName||"").toLowerCase().includes(q)||(x.category||"").toLowerCase().includes(q)):allIdeas)});
 }else if(tab==="reports"){
  const rows=list=>list.map(r=>`<tr><td>${escapeHtml(r.reason)}</td><td>${escapeHtml(allIdeas.find(x=>x.id===r.ideaId)?.title||"محذوفة")}</td><td>${fmt(r.createdAt)}</td><td>${escapeHtml(r.status)}</td><td>${r.status!=="closed"?`<button class="btn secondary sm" onclick="closeReport('${r.id}')">إغلاق</button>`:""}</td></tr>`).join("")||`<tr><td colspan="5">لا توجد بلاغات بمطابقة البحث.</td></tr>`;
  $("adminContent").innerHTML=`<input id="adminSearchReports" placeholder="🔍 ابحث بالسبب أو اسم الفكرة أو الحالة..." style="width:100%;margin-bottom:12px"><div class="tablewrap"><table class="table"><tr><th>السبب</th><th>الفكرة</th><th>التاريخ</th><th>الحالة</th><th>إجراء</th></tr><tbody id="adminReportsRows">${rows(allReports)}</tbody></table></div>`;
  $("adminSearchReports").addEventListener("input",e=>{const q=e.target.value.trim().toLowerCase();$("adminReportsRows").innerHTML=rows(q?allReports.filter(r=>(r.reason||"").toLowerCase().includes(q)||(allIdeas.find(x=>x.id===r.ideaId)?.title||"").toLowerCase().includes(q)||(r.status||"").toLowerCase().includes(q)):allReports)});
 }else if(tab==="admins"){
  const admins=allUsers.filter(u=>adminMap[u.uid]);
  $("adminContent").innerHTML=`<div class="card" style="padding:18px;margin-bottom:16px"><h3>➕ منح صلاحية أدمن عبر UID</h3><p class="muted" style="margin:8px 0">انسخ الـ UID من تبويب "المستخدمون" ثم الصقه هنا.</p><div style="display:flex;gap:8px;flex-wrap:wrap"><input id="newAdminUid" placeholder="UID المستخدم" style="flex:1;min-width:220px"><button class="btn sm" onclick="addAdminByUid()">منح صلاحية</button></div></div>
  <div class="tablewrap"><table class="table"><tr><th>الاسم</th><th>البريد</th><th>UID</th><th>إجراء</th></tr>${admins.map(u=>`<tr><td>${escapeHtml(u.displayName||"-")}</td><td>${escapeHtml(u.email||"-")}</td><td style="font-size:11px">${escapeHtml(u.uid)}</td><td>${u.uid!==currentUser.uid?`<button class="btn danger sm" onclick="toggleAdmin('${u.uid}')">إزالة الصلاحية</button>`:`<span class="muted" style="font-size:12px">أنت</span>`}</td></tr>`).join("")||`<tr><td colspan="4">لا يوجد أدمن آخر بعد.</td></tr>`}</table></div>`;
 }else{
  $("adminContent").innerHTML=`<div class="card" style="padding:18px"><h3>💳 رابط بوابة الدعم / التبرع</h3><p class="muted" style="margin:8px 0">هذا الرابط يظهر للمستخدمين عند الضغط على "متابعة الدعم" في المنصة.</p><div style="display:flex;gap:8px;flex-wrap:wrap"><input id="supportUrlInput" placeholder="https://..." value="${escapeHtml(SUPPORT_URL||"")}" style="flex:1;min-width:220px"><button class="btn sm" onclick="saveSupportUrl()">حفظ</button></div></div>`;
 }
}
window.adminDeleteIdea=async id=>{if(!isAdmin())return;if(confirm("حذف الفكرة؟")){await remove(ref(db,"ideas/"+id));toast("تم حذف الفكرة","success")}};
window.closeReport=async id=>{if(!isAdmin())return;await update(ref(db,"reports/"+id),{status:"closed"});toast("تم إغلاق البلاغ","success")};
window.toggleAdmin=async(uid)=>{
 if(!isAdmin())return;
 if(uid===currentUser.uid){toast("لا يمكنك إزالة صلاحيتك عن نفسك من هنا","error");return}
 if(adminMap[uid])await remove(ref(db,"admins/"+uid)); else await set(ref(db,"admins/"+uid),true);
 toast("تم تحديث صلاحيات الأدمن","success");
};
window.addAdminByUid=async()=>{
 if(!isAdmin())return;
 const uid=$("newAdminUid").value.trim();
 if(!uid){toast("أدخل UID صحيح","error");return}
 await set(ref(db,"admins/"+uid),true);
 $("newAdminUid").value=""; toast("✅ تم منح صلاحية الأدمن","success");
};
window.saveSupportUrl=async()=>{
 if(!isAdmin())return;
 const url=$("supportUrlInput").value.trim();
 await update(ref(db,"config"),{supportUrl:url}); SUPPORT_URL=url;
 toast("✅ تم حفظ رابط الدعم","success");
};

window.supportAction=()=>{
 const amount=$("supportAmount")?.value;
 if(!amount||Number(amount)<=0){toast("أدخل قيمة الدعم","error");return}
 const url=String(SUPPORT_URL||"").trim();
 if(!url){toast("أضف رابط بوابة الدفع من إعدادات الأدمن أولًا","error");return}
 try{const parsed=new URL(url,location.href);if(!/^https?:$/.test(parsed.protocol)){throw new Error("invalid protocol")}location.href=parsed.href}catch(e){toast("رابط الدعم غير صالح","error")}
};

window.addEventListener("click",e=>{if(e.target.classList.contains("modal"))closeModal(e.target.id)});
window.addEventListener("keydown",e=>{if(e.key==="Escape")document.querySelectorAll(".modal.open").forEach(m=>closeModal(m.id))});
window.addEventListener("popstate",()=>{if(!location.hash.startsWith("#idea-"))closeModal("detailModal")});
function checkHashRoute(){
 const m=location.hash.match(/^#idea-(.+)$/);
 if(m&&allIdeas.find(x=>x.id===m[1]))openIdea(m[1],true);
 const u=location.hash.match(/^#user-(.+)$/);
 if(u)openPublicProfile(u[1]);
 if(location.hash==="#admin")showPage("admin");
}
// حالة تحميل أولية (Skeleton) قبل وصول بيانات Firebase
if($("homeIdeas"))$("homeIdeas").innerHTML=skeletons(4);
if($("ideasGrid"))$("ideasGrid").innerHTML=skeletons(8);
if($("projectsGrid"))$("projectsGrid").innerHTML=skeletons(4);
if($("catRail"))$("catRail").innerHTML='<div class="skeleton" style="width:168px;height:150px;flex:none"></div>'.repeat(5);

renderStats();renderProfile();
if(document.body.dataset.page==="ideas"){
 const initCat=new URLSearchParams(location.search).get("category");
 if(initCat&&$("category"))$("category").value=initCat;
}
if(document.body.dataset.page==="publicProfile"){
 const initUid=new URLSearchParams(location.search).get("uid");
 if(initUid)openPublicProfile(initUid);
}

// ظل الهيدر عند السكرول + زر العودة لأعلى
window.addEventListener("scroll",()=>{
 document.querySelector("header").classList.toggle("scrolled",window.scrollY>8);
 $("scrollTopBtn")?.classList.toggle("show",window.scrollY>500);
});
document.querySelectorAll(".mobile-nav [data-nav]").forEach(b=>b.classList.toggle("active",b.dataset.nav===document.body.dataset.page));

// ظهور تدريجي للأقسام عند السكرول
const revealObserver=new IntersectionObserver(entries=>{
 entries.forEach(en=>{if(en.isIntersecting){en.target.classList.add("in");revealObserver.unobserve(en.target)}});
},{threshold:.12});
document.querySelectorAll(".reveal").forEach(el=>revealObserver.observe(el));
