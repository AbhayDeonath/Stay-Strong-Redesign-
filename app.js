"use strict";

/*
 * Stay Stronger — Quiet Artistry redesign
 * The storage key and state shape intentionally remain compatible
 * with the original Stay Strong app.
 */
const STORAGE_KEY = "nnnChallengeTrackerDataV1";
const DEFAULT_STATE = {
  startDate: "2026-11-01", endDate: "2026-11-30",
  records: {}, completedEver: [], bestStreak: 0, achievements: {}, theme: "light"
};
let state = loadState();
let selectedDate = localToday();
let visibleMonth = selectedDate.slice(0, 7);
let toastTimeout = null;

const $ = id => document.getElementById(id);
const elements = {
  currentStreak:$("currentStreak"), longestStreak:$("longestStreak"), totalCompleted:$("totalCompleted"),
  progressPercent:$("progressPercent"), progressBar:$("progressBar"), progressText:$("progressText"),
  challengeDuration:$("challengeDuration"), progressTrack:$("progressTrack"),
  monthPicker:$("monthPicker"), prevMonth:$("prevMonth"), nextMonth:$("nextMonth"), calendarGrid:$("calendarGrid"),
  selectedDateTitle:$("selectedDateTitle"), selectedDateSubtitle:$("selectedDateSubtitle"),
  statusMessage:$("statusMessage"), completeBtn:$("completeBtn"), missedBtn:$("missedBtn"),
  clearBtn:$("clearBtn"), checkinNote:$("checkinNote"), achievementsGrid:$("achievementsGrid"),
  achievementCount:$("achievementCount"), challengeStartDisplay:$("challengeStartDisplay"),
  currentEndDisplay:$("currentEndDisplay"), settingsForm:$("settingsForm"), newEndDate:$("newEndDate"),
  themeToggle:$("themeToggle"), themeIcon:$("themeIcon"), fullResetBtn:$("fullResetBtn"), toast:$("toast")
};

function localToday(){const d=new Date();return formatDateKey(d)}
function parseDateKey(key){const [y,m,d]=key.split("-").map(Number);return new Date(y,m-1,d)}
function formatDateKey(d){return [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-")}
function isValidDateKey(key){if(typeof key!=="string"||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(key))return false;return formatDateKey(parseDateKey(key))===key}
function formatDateLong(key){return parseDateKey(key).toLocaleDateString("en-IN",{day:"numeric",month:"long",year:"numeric"})}
function formatDateShort(key){return parseDateKey(key).toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"})}
function addDays(key,n){const d=parseDateKey(key);d.setDate(d.getDate()+n);return formatDateKey(d)}
function daysBetween(a,b){return Math.round((Date.UTC(parseDateKey(b).getFullYear(),parseDateKey(b).getMonth(),parseDateKey(b).getDate())-Date.UTC(parseDateKey(a).getFullYear(),parseDateKey(a).getMonth(),parseDateKey(a).getDate()))/86400000)}
function daysInChallenge(){return state.endDate<state.startDate?0:daysBetween(state.startDate,state.endDate)+1}
function isWithinChallenge(key){return key>=state.startDate&&key<=state.endDate}
function canRecordDate(key){return isWithinChallenge(key)&&key<=localToday()}

function loadState(){
  try{
    const raw=localStorage.getItem(STORAGE_KEY);if(!raw)return structuredClone(DEFAULT_STATE);
    const saved=JSON.parse(raw);const data={...DEFAULT_STATE,...saved};
    if(!isValidDateKey(data.startDate))data.startDate=DEFAULT_STATE.startDate;
    if(!isValidDateKey(data.endDate))data.endDate=DEFAULT_STATE.endDate;
    if(data.endDate<data.startDate)data.endDate=data.startDate;
    if(!data.records||typeof data.records!=="object"||Array.isArray(data.records))data.records={};
    if(!Array.isArray(data.completedEver))data.completedEver=Object.entries(data.records).filter(([,s])=>s==="completed").map(([d])=>d);
    data.completedEver=[...new Set(data.completedEver.filter(isValidDateKey))];
    if(!data.achievements||typeof data.achievements!=="object"||Array.isArray(data.achievements))data.achievements={};
    if(!Number.isFinite(data.bestStreak))data.bestStreak=0;
    if(!["light","dark"].includes(data.theme))data.theme="light";
    return data;
  }catch(error){console.error("Could not load saved challenge data:",error);return structuredClone(DEFAULT_STATE)}
}
function saveState(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(state))}catch(error){console.error("Could not save challenge data:",error);showToast("Unable to save data on this device.")}}

function calculateCurrentStreak(){
  const today=localToday();if(today<state.startDate)return 0;
  let anchor;
  if(today>state.endDate)anchor=state.endDate;
  else{const status=state.records[today];if(status==="missed")return 0;anchor=status==="completed"?today:addDays(today,-1)}
  if(anchor<state.startDate)return 0;if(anchor>state.endDate)anchor=state.endDate;
  let count=0;while(anchor>=state.startDate&&state.records[anchor]==="completed"){count++;anchor=addDays(anchor,-1)}return count;
}
function calculateLongestStreak(){
  const today=localToday(),last=today<state.endDate?today:state.endDate;if(last<state.startDate)return 0;
  let best=0,current=0;for(let day=state.startDate;day<=last;day=addDays(day,1)){if(state.records[day]==="completed"){current++;best=Math.max(best,current)}else current=0}return best;
}
const achievementDefinitions=[
  {id:"firstStep",icon:"🌱",title:"First Step",description:"Complete your first day.",type:"completed",requirement:1},
  {id:"weekWarrior",icon:"🔥",title:"Week Warrior",description:"Achieve a 7-day streak.",type:"streak",requirement:7},
  {id:"twoWeeks",icon:"⚡",title:"Two Weeks Strong",description:"Achieve a 14-day streak.",type:"streak",requirement:14},
  {id:"monthMaster",icon:"🏆",title:"Month Master",description:"Achieve a 30-day streak.",type:"streak",requirement:30},
  {id:"unstoppable",icon:"💎",title:"Unstoppable",description:"Achieve a 50-day streak.",type:"streak",requirement:50},
  {id:"legend",icon:"👑",title:"Legend",description:"Achieve a 100-day streak.",type:"streak",requirement:100}
];
function updateBestStreak(){state.bestStreak=Math.max(state.bestStreak,calculateLongestStreak())}
function updateAchievements(){
  const completed=state.completedEver.length,today=localToday();
  achievementDefinitions.forEach(item=>{if(state.achievements[item.id])return;const unlocked=item.type==="completed"?completed>=item.requirement:state.bestStreak>=item.requirement;if(unlocked)state.achievements[item.id]=today})
}
function renderDashboard(){
  updateBestStreak();updateAchievements();
  const current=calculateCurrentStreak(),total=state.completedEver.length;
  const done=Object.entries(state.records).filter(([date,status])=>status==="completed"&&isWithinChallenge(date)&&date<=localToday()).length;
  const days=daysInChallenge(),percent=days>0?Math.min(100,Math.round(done/days*100)):0;
  elements.currentStreak.textContent=current;elements.longestStreak.textContent=state.bestStreak;elements.totalCompleted.textContent=total;
  elements.progressPercent.textContent=percent+"%";elements.progressBar.style.width=percent+"%";
  elements.progressText.textContent=done+" of "+days+" days completed";elements.challengeDuration.textContent=days+"-day challenge";
  elements.progressTrack.setAttribute("aria-valuenow",String(percent));saveState();
}
function renderCalendar(){
  elements.monthPicker.value=visibleMonth;elements.calendarGrid.innerHTML="";
  const [year,month]=visibleMonth.split("-").map(Number),first=new Date(year,month-1,1).getDay(),count=new Date(year,month,0).getDate();
  for(let i=0;i<first;i++){const empty=document.createElement("div");empty.className="calendar-empty";elements.calendarGrid.appendChild(empty)}
  for(let day=1;day<=count;day++){
    const key=year+"-"+String(month).padStart(2,"0")+"-"+String(day).padStart(2,"0"),status=state.records[key],button=document.createElement("button");
    button.type="button";button.className="calendar-day";button.textContent=day;
    if(status==="completed")button.classList.add("completed");if(status==="missed")button.classList.add("missed");
    if(key===localToday())button.classList.add("today");if(key===selectedDate)button.classList.add("selected");
    if(!isWithinChallenge(key))button.classList.add("outside-challenge");
    
    button.setAttribute("aria-label",formatDateLong(key)+(status?", "+status:""));button.setAttribute("aria-pressed",String(key===selectedDate));
    button.addEventListener("click",()=>{selectedDate=key;renderAll()});elements.calendarGrid.appendChild(button);
  }
}
function renderCheckin(){
  elements.selectedDateTitle.textContent=formatDateLong(selectedDate);
  elements.selectedDateSubtitle.textContent=parseDateKey(selectedDate).toLocaleDateString("en-IN",{weekday:"long"});
  const status=state.records[selectedDate],allowed=canRecordDate(selectedDate);
  elements.statusMessage.className="status-message";
  if(!isWithinChallenge(selectedDate))elements.statusMessage.textContent="This date is outside your current challenge period.";
  else if(selectedDate>localToday())elements.statusMessage.textContent="This is a future date. You cannot record it yet.";
  else if(status==="completed"){elements.statusMessage.textContent="You completed this day. Great work!";elements.statusMessage.classList.add("completed-status")}
  else if(status==="missed"){elements.statusMessage.textContent="This day has been marked as missed.";elements.statusMessage.classList.add("missed-status")}
  else elements.statusMessage.textContent="No status recorded for this day.";
  elements.completeBtn.disabled=!allowed;elements.missedBtn.disabled=!allowed;elements.clearBtn.disabled=!(allowed&&status);
  if(!isWithinChallenge(selectedDate))elements.checkinNote.textContent="You can only record dates within your current challenge period.";
  else if(selectedDate>localToday())elements.checkinNote.textContent="Future dates cannot be recorded. Come back on this day.";
  else if(status==="completed")elements.checkinNote.textContent="Your completed status is saved. You can change it or clear it.";
  else if(status==="missed")elements.checkinNote.textContent="Your missed status is saved. You can change it or clear it.";
  else elements.checkinNote.textContent="Select whether you completed or missed this day.";
}
function recordDay(status){
  if(!canRecordDate(selectedDate)){showToast("This date cannot be recorded.");return}
  if(!["completed","missed"].includes(status))return;
  state.records[selectedDate]=status;
  if(status==="completed"&&!state.completedEver.includes(selectedDate))state.completedEver.push(selectedDate);
  updateBestStreak();updateAchievements();saveState();renderAll();
  showToast(status==="completed"?"Day completed. Keep going!":"Day marked as missed.");
}
function clearDay(){
  if(!canRecordDate(selectedDate)||!state.records[selectedDate])return;
  delete state.records[selectedDate];
  // Historical completed-day count and unlocked achievements remain preserved.
  saveState();renderAll();showToast("Daily status cleared.");
}
function renderSettings(){
  elements.challengeStartDisplay.textContent=formatDateLong(state.startDate);elements.currentEndDisplay.textContent=formatDateLong(state.endDate);
  elements.newEndDate.min=state.startDate;elements.newEndDate.value=state.endDate;
}
function saveChallengeSettings(event){
  event.preventDefault();const value=elements.newEndDate.value;
  if(!value||!isValidDateKey(value)){showToast("Please choose a valid end date.");return}
  if(value<state.startDate){showToast("The end date cannot be before the challenge start date.");elements.newEndDate.value=state.endDate;return}
  if(value===state.endDate){showToast("Your end date has not changed.");return}
  state.endDate=value;updateBestStreak();updateAchievements();saveState();renderAll();showToast("Challenge end date updated to "+formatDateShort(value)+".");
}
function fullReset(){
  const confirmed=window.confirm("Are you sure you want to reset Stay Stronger?\n\nThis permanently erases daily check-ins, completed history, streaks, achievements, your custom end date and theme preference.\n\nYour challenge returns to November 1–30, 2026. This cannot be undone.");
  if(!confirmed)return;
  try{localStorage.removeItem(STORAGE_KEY);state=structuredClone(DEFAULT_STATE);selectedDate=DEFAULT_STATE.startDate;visibleMonth=DEFAULT_STATE.startDate.slice(0,7);if(toastTimeout){clearTimeout(toastTimeout);toastTimeout=null}saveState();renderAll();showToast("Your challenge has been reset.")}catch(error){console.error(error);showToast("Unable to reset your data. Please try again.")}
}
function renderAchievements(){
  elements.achievementsGrid.innerHTML="";let unlockedCount=0;
  achievementDefinitions.forEach(item=>{
    const unlocked=Boolean(state.achievements[item.id]);if(unlocked)unlockedCount++;
    const card=document.createElement("article");card.className="achievement-card"+(unlocked?" unlocked":"");
    const icon=document.createElement("div");icon.className="achievement-icon";icon.textContent=item.icon;
    const title=document.createElement("h3");title.textContent=item.title;
    const description=document.createElement("p");description.textContent=unlocked?"Unlocked "+formatDateShort(state.achievements[item.id]):item.description;
    card.append(icon,title,description);elements.achievementsGrid.appendChild(card);
  });
  elements.achievementCount.textContent=unlockedCount+" of "+achievementDefinitions.length+" unlocked";
}
function applyTheme(){
  document.body.classList.toggle("dark-theme",state.theme==="dark");
  elements.themeIcon.textContent=state.theme==="dark"?"☼":"◐";
  elements.themeToggle.setAttribute("aria-label",state.theme==="dark"?"Switch to light theme":"Switch to dark theme");
}
function toggleTheme(){state.theme=state.theme==="dark"?"light":"dark";applyTheme();saveState()}
function changeMonth(offset){
  const [year,month]=visibleMonth.split("-").map(Number),date=new Date(year,month-1+offset,1);
  visibleMonth=date.getFullYear()+"-"+String(date.getMonth()+1).padStart(2,"0");renderCalendar();
}
function selectMonth(value){if(!/^\d{4}-\d{2}$/.test(value))return;visibleMonth=value;renderCalendar()}
function showToast(message){
  elements.toast.textContent=message;elements.toast.classList.add("show");
  if(toastTimeout)clearTimeout(toastTimeout);
  toastTimeout=setTimeout(()=>{elements.toast.classList.remove("show");toastTimeout=null},2600);
}
function renderAll(){applyTheme();renderDashboard();renderCalendar();renderCheckin();renderAchievements();renderSettings()}
elements.completeBtn.addEventListener("click",()=>recordDay("completed"));
elements.missedBtn.addEventListener("click",()=>recordDay("missed"));
elements.clearBtn.addEventListener("click",clearDay);
elements.prevMonth.addEventListener("click",()=>changeMonth(-1));
elements.nextMonth.addEventListener("click",()=>changeMonth(1));
elements.monthPicker.addEventListener("change",event=>selectMonth(event.target.value));
elements.settingsForm.addEventListener("submit",saveChallengeSettings);
elements.themeToggle.addEventListener("click",toggleTheme);
elements.fullResetBtn.addEventListener("click",fullReset);
function initializeApp(){
  if(!isWithinChallenge(selectedDate))selectedDate=state.startDate;
  visibleMonth=selectedDate.slice(0,7);updateBestStreak();updateAchievements();saveState();renderAll();
}
initializeApp();
