const tasks = [
  { id:"meal", title:"Meal preparation", category:"household", cover:0, stages:["Open lunch box","Place bread","Scoop tomato"], description:"A three-stage sequence combining articulated-object interaction, grasping and placement, and tool-mediated scooping." },
  { id:"cabinet", title:"Cabinet and pouring", category:"household", cover:3, stages:["Open cabinet","Pick bottle","Unscrew cap","Pour beads"], description:"A four-stage sequence that links cabinet access, object transfer, dexterous cap removal, and controlled pouring." },
  { id:"drawer", title:"Drawer and plug", category:"household", cover:7, stages:["Open drawer","Pick charger","Insert plug"], description:"A precise sequence from articulated opening to grasping and constrained insertion." },
  { id:"nut", title:"Nut and bolt", category:"industry", cover:10, stages:["Pick bolt","Seat nut","Turn nut"], description:"An assembly sequence requiring stable pickup, pose alignment, and sustained rotational manipulation." },
  { id:"office", title:"Office desk", category:"lab", cover:13, stages:["Open laptop","Type keys","Click mouse"], description:"A desktop interaction sequence spanning articulated motion, repeated pressing, and tool-oriented hand placement." },
  { id:"furniture", title:"Furniture assembly", category:"industry", cover:16, stages:["Lay flat panel","Insert rail","Fasten screw"], description:"A bimanual assembly sequence combining placement, insertion, and rotational fastening." },
  { id:"pipette", title:"Pipette transfer", category:"lab", cover:19, stages:["Aspirate liquid","Dispense liquid"], description:"A laboratory transfer task that tests tool handling and precise liquid manipulation across two dependent stages." },
  { id:"juice", title:"Juice preparation", category:"household", cover:21, stages:["Open","Move","Close","Place lid","Press button"], description:"The longest sequence in the suite, composing five manipulation stages around a countertop appliance." },
  { id:"package", title:"Package opening", category:"household", cover:26, stages:["Open package","Extract apple"], description:"A contact-rich opening task followed by extraction from a deformable-looking container setup." },
  { id:"cleaning", title:"Table cleaning", category:"industry", cover:28, stages:["Pick debris","Dump dustpan"], description:"A tool-use sequence that collects debris and completes the task through a coordinated transfer." }
];

const pad = (n) => String(n).padStart(2,"0");
const imageFor = (n) => "assets/tasks/task-" + pad(n) + ".jpg";
const taskGrid = document.querySelector("[data-task-grid]");
const modal = document.querySelector("[data-task-modal]");
const modalImage = document.querySelector("[data-modal-image]");
const modalCounter = document.querySelector("[data-modal-counter]");
const modalTitle = document.querySelector("[data-modal-title]");
const modalMeta = document.querySelector("[data-modal-meta]");
const modalDescription = document.querySelector("[data-modal-description]");
const stageSelector = document.querySelector("[data-stage-selector]");
let lastFocused = null;

function buildTaskCard(task, index) {
  const card = document.createElement("button");
  card.type = "button";
  card.className = "task-card";
  card.dataset.category = task.category;
  card.dataset.task = task.id;
  card.setAttribute("aria-label", "Explore " + task.title);
  const imageWrap = document.createElement("div");
  imageWrap.className = "task-image";
  const image = document.createElement("img");
  image.src = imageFor(task.cover);
  image.alt = task.title + " simulated task";
  image.loading = index < 4 ? "eager" : "lazy";
  imageWrap.appendChild(image);
  const info = document.createElement("div");
  info.className = "task-card-info";
  const meta = document.createElement("div");
  meta.className = "task-card-meta";
  meta.innerHTML = "<span>" + pad(index + 1) + " / " + task.category + "</span><span>" + pad(task.stages.length) + " stages</span>";
  const title = document.createElement("h3");
  title.textContent = task.title;
  const arrow = document.createElement("span");
  arrow.className = "task-arrow";
  arrow.setAttribute("aria-hidden","true");
  arrow.textContent = "↗";
  const stages = document.createElement("div");
  stages.className = "task-stages";
  stages.textContent = task.stages.join(" · ");
  info.append(meta,title,arrow,stages);
  card.append(imageWrap,info);
  card.addEventListener("click", () => openTask(task,index));
  return card;
}

function renderTasks(filter) {
  taskGrid.innerHTML = "";
  tasks.forEach((task,index) => {
    if (filter === "all" || task.category === filter) taskGrid.appendChild(buildTaskCard(task,index));
  });
}

function openTask(task,index) {
  lastFocused = document.activeElement;
  modalTitle.textContent = task.title;
  modalMeta.textContent = pad(index + 1) + " / " + task.category + " / long-horizon";
  modalDescription.textContent = task.description;
  stageSelector.innerHTML = "";
  task.stages.forEach((stage,stageIndex) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "stage-button" + (stageIndex === 0 ? " active" : "");
    button.innerHTML = "<span>" + pad(stageIndex + 1) + "</span><strong>" + stage + "</strong>";
    button.addEventListener("click",() => setModalStage(task,stageIndex,button));
    stageSelector.appendChild(button);
  });
  setModalStage(task,0,stageSelector.firstElementChild);
  modal.classList.add("open");
  modal.setAttribute("aria-hidden","false");
  document.body.classList.add("modal-open");
  document.querySelector(".modal-close").focus();
}

function setModalStage(task,stageIndex,button) {
  [...stageSelector.children].forEach(el => el.classList.remove("active"));
  if (button) button.classList.add("active");
  const imageIndex = task.cover + stageIndex;
  modalImage.src = imageFor(imageIndex);
  modalImage.alt = task.title + ": " + task.stages[stageIndex];
  modalCounter.textContent = pad(stageIndex + 1) + " / " + pad(task.stages.length) + " — " + task.stages[stageIndex];
}

function closeModal() {
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden","true");
  document.body.classList.remove("modal-open");
  if (lastFocused) lastFocused.focus();
}

document.querySelectorAll("[data-close-modal]").forEach(button => button.addEventListener("click",closeModal));
document.addEventListener("keydown",(event) => {
  if (event.key === "Escape" && modal.classList.contains("open")) closeModal();
});

document.querySelectorAll("[data-filter]").forEach(button => {
  button.addEventListener("click",() => {
    document.querySelectorAll("[data-filter]").forEach(item => item.classList.remove("active"));
    button.classList.add("active");
    renderTasks(button.dataset.filter);
  });
});

const menuButton = document.querySelector("[data-menu-button]");
const mobileNav = document.querySelector("[data-mobile-nav]");
menuButton.addEventListener("click",() => {
  const open = mobileNav.classList.toggle("open");
  menuButton.setAttribute("aria-expanded",String(open));
  menuButton.setAttribute("aria-label",open ? "Close menu" : "Open menu");
});
mobileNav.querySelectorAll("a").forEach(link => link.addEventListener("click",() => {
  mobileNav.classList.remove("open");
  menuButton.setAttribute("aria-expanded","false");
}));

const header = document.querySelector("[data-header]");
const progress = document.querySelector(".scroll-progress span");
function onScroll() {
  const y = window.scrollY;
  header.classList.toggle("scrolled", y > 40);
  const total = document.documentElement.scrollHeight - window.innerHeight;
  progress.style.width = (total > 0 ? (y / total) * 100 : 0) + "%";
}
window.addEventListener("scroll",onScroll,{ passive:true });
onScroll();

const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add("visible");
      observer.unobserve(entry.target);
    }
  });
},{ threshold:.12 });
document.querySelectorAll(".reveal").forEach(el => observer.observe(el));

const copyButton = document.querySelector("[data-copy-citation]");
copyButton.addEventListener("click",async() => {
  const citation = document.querySelector("[data-citation]").textContent;
  try {
    await navigator.clipboard.writeText(citation);
    copyButton.textContent = "Copied";
  } catch {
    const area = document.createElement("textarea");
    area.value = citation;
    document.body.appendChild(area);
    area.select();
    document.execCommand("copy");
    area.remove();
    copyButton.textContent = "Copied";
  }
  setTimeout(() => copyButton.textContent = "Copy BibTeX",1600);
});

renderTasks("all");
