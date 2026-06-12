// Todo App - main JS
// データモデルと localStorage での永続化
const STORAGE_KEY = 'todo_app_v1'

let state = {
  categories: [],
  tags: [],
  tasks: {}, // id -> task
}

// UI state
let ui = {
  calendarMode: 'month',
}

// ユーティリティ
const uid = ()=>Date.now().toString(36)+Math.random().toString(36).slice(2,6)
const nowISO = ()=>new Date().toISOString()

function saveState(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}
function loadState(){
  const raw = localStorage.getItem(STORAGE_KEY)
  if(raw) state = JSON.parse(raw)
  // 初期カテゴリ
  if(!state.categories || state.categories.length===0){
    const work = {id:uid(),name:'仕事'}
    const personal = {id:uid(),name:'プライベート'}
    state.categories = [work,personal]
  }
  if(!state.tags) state.tags = []
  if(!state.tasks) state.tasks = {}
}

// DOM refs
const refs = {}
function $id(id){return document.getElementById(id)}

// Load and render
function init(){
  loadState()
  // refs
  refs.categoryList = $id('categoryList')
  refs.addCategoryBtn = $id('addCategoryBtn')
  refs.newCategoryInput = $id('newCategoryInput')
  refs.taskList = $id('taskList')
  refs.taskListArea = $id('taskListArea')
  refs.addTaskBtn = $id('addTaskBtn')
  refs.editorModal = $id('editorModal')
  refs.taskForm = $id('taskForm')
  refs.taskTitle = $id('taskTitle')
  refs.taskNote = $id('taskNote')
  refs.taskDue = $id('taskDue')
  refs.taskRepeat = $id('taskRepeat')
  refs.taskPriority = $id('taskPriority')
  refs.taskCategory = $id('taskCategory')
  refs.taskTags = $id('taskTags')
  refs.taskFiles = $id('taskFiles')
  refs.newSubtaskInput = $id('newSubtaskInput')
  refs.addSubtaskBtn = $id('addSubtaskBtn')
  refs.subtaskList = $id('subtaskList')
  refs.cancelEdit = $id('cancelEdit')
  refs.deleteTaskBtn = $id('deleteTaskBtn')
  refs.searchInput = $id('searchInput')
  refs.calendarToggle = $id('calendarToggle')
  refs.calendarView = $id('calendarView')

  bindEvents()
  // apply saved theme
  const dark = localStorage.getItem('todo_theme_dark') === '1'
  if(dark) document.getElementById('app').classList.add('dark')
  renderCategories()
  renderTasks()
}

function bindEvents(){
  refs.addCategoryBtn.addEventListener('click',()=>{
    const name = refs.newCategoryInput.value.trim(); if(!name) return
    const c = {id:uid(),name}
    state.categories.push(c)
    refs.newCategoryInput.value=''
    saveState(); renderCategories(); populateCategorySelect()
  })

  refs.addTaskBtn.addEventListener('click',()=>openEditor())
  refs.cancelEdit.addEventListener('click',closeEditor)
  refs.taskForm.addEventListener('submit',onSaveTask)
  refs.addSubtaskBtn.addEventListener('click',onAddSubtask)
  refs.searchInput.addEventListener('input',renderTasks)
  refs.calendarToggle.addEventListener('change',e=>{
    if(e.target.checked) showCalendar(); else hideCalendar()
  })
  refs.deleteTaskBtn.addEventListener('click',onDeleteTask)
  // calendar mode selector (月/週)
  const calMode = $id('calendarMode')
  if(calMode) calMode.addEventListener('change', e=>{ ui.calendarMode = e.target.value; if(refs.calendarToggle.checked) showCalendar() })
  // theme toggle
  const themeBtn = $id('toggleTheme')
  if(themeBtn) themeBtn.addEventListener('click', toggleTheme)
  // mobile menu
  const mobileBtn = $id('mobileMenuBtn')
  const overlay = $id('sidebarOverlay')
  function openSidebar(){ document.getElementById('app').classList.add('mobile-open'); overlay.classList.remove('hidden') }
  function closeSidebar(){ document.getElementById('app').classList.remove('mobile-open'); overlay.classList.add('hidden') }
  if(mobileBtn) mobileBtn.addEventListener('click', ()=> document.getElementById('app').classList.contains('mobile-open') ? closeSidebar() : openSidebar())
  if(overlay) overlay.addEventListener('click', closeSidebar)
  // close sidebar when a category or filter is selected on mobile
  document.getElementById('categoryList').addEventListener('click', closeSidebar)
  document.querySelectorAll('#sidebar .filters .filter').forEach(btn=> btn.addEventListener('click', closeSidebar))
  // sidebar filter buttons (all/today/overdue/completed)
  document.querySelectorAll('#sidebar .filters .filter').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      document.querySelectorAll('#sidebar .filters .filter').forEach(n=>n.classList.remove('active'))
      btn.classList.add('active')
      const f = btn.dataset.filter
      if(f === 'all') renderTasks()
      else renderTasks({filter: f})
    })
  })
  // export / import
  $id('exportBtn').addEventListener('click', exportTasks)
  $id('importBtn').addEventListener('click', ()=> $id('importFile').click())
  $id('importFile').addEventListener('change', importTasks)
}

function exportTasks(){
  const date = new Date().toISOString().slice(0,10)
  const json = JSON.stringify(state.tasks, null, 2)
  const blob = new Blob([json], {type:'application/json'})
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `todo-export-${date}.json`
  a.click()
  URL.revokeObjectURL(a.href)
}

function importTasks(e){
  const file = e.target.files[0]
  if(!file) return
  const reader = new FileReader()
  reader.onload = ev => {
    try {
      const imported = JSON.parse(ev.target.result)
      if(typeof imported !== 'object' || Array.isArray(imported)) throw new Error('invalid format')
      let added = 0, updated = 0, skipped = 0
      Object.values(imported).forEach(task => {
        if(typeof task !== 'object' || !task.title) return
        const id = task.id
        if(id && state.tasks[id]){
          // ID衝突: updatedAt が新しい方を採用
          const existingAt = state.tasks[id].updatedAt || ''
          const importedAt = task.updatedAt || ''
          if(importedAt > existingAt){
            state.tasks[id] = {...task, id}
            updated++
          } else {
            skipped++
          }
        } else {
          // 新規追加（IDなし or 衝突なし）
          const newId = id || uid()
          state.tasks[newId] = {...task, id: newId}
          added++
        }
      })
      saveState()
      renderTasks()
      const parts = []
      if(added)   parts.push(`${added}件追加`)
      if(updated) parts.push(`${updated}件上書き`)
      if(skipped) parts.push(`${skipped}件スキップ`)
      alert(`インポート完了: ${parts.join('、') || '変更なし'}`)
    } catch {
      alert('インポートに失敗しました。有効なJSONファイルを選択してください。')
    } finally {
      e.target.value = ''
    }
  }
  reader.readAsText(file)
}

// Categories
function renderCategories(){
  refs.categoryList.innerHTML=''
  state.categories.forEach(c=>{
    const li = document.createElement('li')
    li.textContent = c.name
    li.dataset.id = c.id
    li.addEventListener('click',()=>{
      document.querySelectorAll('#categoryList li').forEach(n=>n.classList.remove('active'))
      li.classList.add('active')
      // if calendar visible, switch back to task list
      const cb = $id('calendarToggle'); if(cb && cb.checked){ cb.checked = false; cb.dispatchEvent(new Event('change')) }
      // filter by category
      renderTasks({categoryId:c.id})
    })
    refs.categoryList.appendChild(li)
  })
  populateCategorySelect()
}

function populateCategorySelect(){
  refs.taskCategory.innerHTML=''
  state.categories.forEach(c=>{
    const opt = document.createElement('option'); opt.value=c.id; opt.textContent=c.name; refs.taskCategory.appendChild(opt)
  })
  renderTags()
}

// Task editor
let editingId = null
function openEditor(task=null){
  editingId = task?task.id:null
  $id('editorTitle').textContent = task? 'タスクを編集' : 'タスクを追加'
  refs.taskTitle.value = task? task.title : ''
  refs.taskNote.value = task? task.note : ''
  refs.taskDue.value = task && task.due? formatLocalInput(task.due) : ''
  refs.taskRepeat.value = task? task.repeat || 'none' : 'none'
  refs.taskPriority.value = task? task.priority || 'medium' : 'medium'
  refs.taskCategory.value = task? task.categoryId || (state.categories[0] && state.categories[0].id) : (state.categories[0] && state.categories[0].id)
  refs.taskTags.value = task? (task.tags||[]).join(',') : ''
  refs.subtaskList.innerHTML=''
  if(task && task.subtasks){
    task.subtasks.forEach(s=>{
      const li = document.createElement('li'); li.dataset.id=s.id
      const cb = document.createElement('input'); cb.type='checkbox'; cb.checked= !!s.done
      cb.addEventListener('change', ()=> s.done = cb.checked)
      li.appendChild(cb)
      const span = document.createElement('span'); span.textContent = ' '+s.title; li.appendChild(span)
      const rem = document.createElement('button'); rem.type='button'; rem.textContent='×'; rem.style.marginLeft='8px'; rem.addEventListener('click',()=>li.remove())
      li.appendChild(rem)
      refs.subtaskList.appendChild(li)
    })
  }
  refs.deleteTaskBtn.classList.toggle('hidden',!task)
  refs.editorModal.classList.remove('hidden')
}
function closeEditor(){editingId=null; refs.taskForm.reset(); refs.editorModal.classList.add('hidden')}

function onAddSubtask(){
  const text = refs.newSubtaskInput.value.trim(); if(!text) return
  const li = document.createElement('li'); li.dataset.id=uid()
  const cb = document.createElement('input'); cb.type='checkbox'; cb.checked=false; cb.style.marginRight='6px'
  li.appendChild(cb)
  const span = document.createElement('span'); span.textContent = ' '+text; li.appendChild(span)
  const rem = document.createElement('button'); rem.type='button'; rem.textContent='×'; rem.style.marginLeft='8px'; rem.addEventListener('click',()=>li.remove())
  li.appendChild(rem)
  refs.subtaskList.appendChild(li); refs.newSubtaskInput.value=''
}

function onSaveTask(e){
  e.preventDefault()
  const t = {
    id: editingId || uid(),
    title: refs.taskTitle.value.trim(),
    note: refs.taskNote.value.trim(),
    due: refs.taskDue.value? new Date(refs.taskDue.value).toISOString(): null,
    repeat: refs.taskRepeat.value,
    priority: refs.taskPriority.value,
    categoryId: refs.taskCategory.value,
    tags: refs.taskTags.value.split(',').map(s=>s.trim()).filter(Boolean),
    subtasks: Array.from(refs.subtaskList.querySelectorAll('li')).map(li=>{
      const cb = li.querySelector('input[type=checkbox]')
      const span = li.querySelector('span')
      return {id:li.dataset.id,title: span? span.textContent.trim() : li.textContent.replace('×','').trim(),done: cb? cb.checked : false}
    }),
    attachments: [],
    completed: false,
    createdAt: (editingId && state.tasks[editingId]?.createdAt) || nowISO(),
    updatedAt: nowISO()
  }
  // files
  const files = refs.taskFiles.files
  if(files && files.length){
    Array.from(files).forEach(f=>{
      const reader = new FileReader()
      reader.onload = ()=>{
        t.attachments.push({name:f.name,data:reader.result})
        state.tasks[t.id]=t; saveState(); renderTasks();
      }
      reader.readAsDataURL(f)
    })
  }
  // update global tags list
  t.tags.forEach(tag=>{ if(!state.tags.includes(tag)) state.tags.push(tag) })
  // save baseline
  state.tasks[t.id]=Object.assign(state.tasks[t.id]||{},t)
  saveState(); renderTasks(); closeEditor()
}

function onDeleteTask(){
  if(!editingId) return
  if(confirm('タスクを削除しますか？')){
    delete state.tasks[editingId]
    saveState(); closeEditor(); renderTasks()
  }
}

function formatLocalInput(iso){
  const d = new Date(iso)
  const pad = n=>String(n).padStart(2,'0')
  const date = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`
  return `${date}T${time}`
}

// Render tasks with filters
function renderTasks(opts={}){
  refs.taskList.innerHTML=''
  const q = refs.searchInput.value.trim().toLowerCase()
  const tagFilter = opts.tag || null
  const tasks = Object.values(state.tasks).sort((a,b)=>new Date(a.due||0)-new Date(b.due||0))
  tasks.forEach(task=>{
    if(opts.categoryId && task.categoryId !== opts.categoryId) return
    if(tagFilter && !(task.tags||[]).includes(tagFilter)) return
    // filter options: today, overdue, completed
    if(opts.filter){
      const f = opts.filter
      if(f === 'today'){
        if(!(task.due && new Date(task.due).toDateString() === new Date().toDateString())) return
      } else if(f === 'overdue'){
        if(!(task.due && new Date(task.due) < new Date() && !task.completed)) return
      } else if(f === 'completed'){
        if(!task.completed) return
      }
    }
    if(q){
      if(!task.title.toLowerCase().includes(q) && !(task.tags||[]).join(',').toLowerCase().includes(q) && !(task.note||'').toLowerCase().includes(q)) return
    }
    const li = renderTaskItem(task)
    refs.taskList.appendChild(li)
  })
  renderTags()
}

function renderTaskItem(task){
  const li = document.createElement('li'); li.className='task'
  // due coloring for entire task
  if(task.due){
    const dueDate = new Date(task.due); const now = new Date(); const diff = dueDate - now; const dayMs = 24*3600*1000
    if(diff<0) li.classList.add('overdue')
    else if(diff<=dayMs) li.classList.add('due-soon')
  }
  if(task.priority) li.classList.add('priority-'+task.priority)
  const left = document.createElement('div')
  const cb = document.createElement('input'); cb.type='checkbox'; cb.checked = !!task.completed
  cb.addEventListener('change',()=>{
    task.completed = cb.checked
    if(cb.checked && task.repeat && task.repeat !== 'none'){
      const next = nextDue(task.due || new Date().toISOString(), task.repeat)
      if(next){
        const newTask = Object.assign({}, task, {id:uid(), due:next, completed:false, createdAt:nowISO(), updatedAt:nowISO()})
        state.tasks[newTask.id] = newTask
      }
    }
    state.tasks[task.id] = task; saveState(); renderTasks()
  })
  left.appendChild(cb)
  li.appendChild(left)

  const content = document.createElement('div'); content.className='content'
  const title = document.createElement('div'); title.className='title'; title.textContent = task.title
  content.appendChild(title)
  const meta = document.createElement('div'); meta.className='meta'
  if(task.due){
    const dueDate = new Date(task.due)
    const now = new Date()
    const diff = dueDate - now
    const dayMs = 24*3600*1000
    let dueLabel = dueDate.toLocaleString()
    const span = document.createElement('span'); span.className='badge'; span.textContent = dueLabel
    if(diff<0){ span.classList.add('overdue') }
    else if(diff<=dayMs){ span.classList.add('due-soon') }
    meta.appendChild(span)
  }
  if(task.tags && task.tags.length){
    task.tags.forEach(tag=>{
      const tspan = document.createElement('span'); tspan.className='badge'; tspan.textContent = tag
      tspan.style.cursor='pointer'
      tspan.addEventListener('click', ()=> renderTasks({tag}))
      meta.appendChild(tspan)
    })
  }
  // attachments preview
  if(task.attachments && task.attachments.length){
    const attachWrap = document.createElement('div'); attachWrap.className='attachments'
    task.attachments.forEach(a=>{
      if(a.data.startsWith('data:image')){
        const img = document.createElement('img'); img.src = a.data; img.alt=a.name; img.style.width='48px'; img.style.height='48px'; img.style.objectFit='cover'; img.style.margin='4px'; attachWrap.appendChild(img)
      } else {
        // PDF preview handling
        if(a.name.toLowerCase().endsWith('.pdf')){
          const preview = document.createElement('button'); preview.textContent='PDF: '+a.name; preview.addEventListener('click', ()=>{
            const w = window.open('','_blank');
            w.document.write(`<title>${a.name}</title>`)
            w.document.write(`<embed src="${a.data}" type="application/pdf" width="100%" height="100%">`)
          })
          attachWrap.appendChild(preview)
        } else {
          const link = document.createElement('a'); link.href=a.data; link.textContent=a.name; link.download=a.name; link.style.display='block'; attachWrap.appendChild(link)
        }
      }
    })
    meta.appendChild(attachWrap)
  }
  // subtasks rendering
  if(task.subtasks && task.subtasks.length){
    const ul = document.createElement('ul'); ul.style.marginTop='8px'
    task.subtasks.forEach(s=>{
      const li2 = document.createElement('li')
      const cb = document.createElement('input'); cb.type='checkbox'; cb.checked=!!s.done
      cb.addEventListener('change', ()=>{
        s.done = cb.checked; state.tasks[task.id]=task; saveState();
        if(task.subtasks.every(x=>x.done)) task.completed = true
        renderTasks()
      })
      li2.appendChild(cb)
      const sp = document.createElement('span'); sp.textContent = ' '+s.title; li2.appendChild(sp)
      ul.appendChild(li2)
    })
    meta.appendChild(ul)
  }
  content.appendChild(meta)
  li.appendChild(content)

  const actions = document.createElement('div')
  const editBtn = document.createElement('button'); editBtn.textContent='編集'; editBtn.addEventListener('click',()=>openEditor(task))
  const delBtn = document.createElement('button'); delBtn.textContent='削除'; delBtn.addEventListener('click',()=>{if(confirm('タスクを削除しますか？')){delete state.tasks[task.id]; saveState(); renderTasks()}})
  actions.appendChild(editBtn); actions.appendChild(delBtn)
  li.appendChild(actions)

  return li
}

// tags rendering and filtering
function renderTags(){
  refs.tagList = refs.tagList || $id('tagList')
  refs.tagList.innerHTML=''
  state.tags.forEach(tag=>{
    const btn = document.createElement('button'); btn.textContent = tag; btn.className='tag-btn'; btn.style.margin='4px'; btn.addEventListener('click',()=>renderTasks({tag}))
    refs.tagList.appendChild(btn)
  })
}

// repeat helper: compute next due
function nextDue(iso, repeat){
  if(!iso) return null
  const d = new Date(iso)
  if(repeat==='daily'){ d.setDate(d.getDate()+1) }
  else if(repeat==='weekly'){ d.setDate(d.getDate()+7) }
  else if(repeat==='monthly'){ d.setMonth(d.getMonth()+1) }
  return d.toISOString()
}


// calendar (simple month view)
function showCalendar(){
  refs.calendarView.classList.remove('hidden')
  refs.taskListArea.classList.add('hidden')
  refs.calendarView.innerHTML = ''
  const mode = ui.calendarMode || 'month'
  if(mode === 'week') return showWeekView()
  // back button to return to task list
  const toolbar = document.createElement('div'); toolbar.style.display='flex'; toolbar.style.justifyContent='flex-start'; toolbar.style.margin='6px 0'
  const back = document.createElement('button'); back.type = 'button'; back.textContent = 'タスク一覧に戻る'; back.addEventListener('click', ()=>{ const cb = $id('calendarToggle'); if(cb){ cb.checked = false; cb.dispatchEvent(new Event('change')); } else { hideCalendar(); } })
  toolbar.appendChild(back)
  refs.calendarView.appendChild(toolbar)
  const now = new Date();
  const month = now.getMonth(); const year = now.getFullYear()
  const first = new Date(year,month,1); const startDay = first.getDay()
  const weeks = []
  let day = 1 - startDay
  for(let w=0;w<6;w++){
    const week = []
    for(let d=0;d<7;d++){
      week.push(new Date(year,month,day))
      day++
    }
    weeks.push(week)
  }
  const table = document.createElement('table'); table.className='calendar'
  const header = document.createElement('tr'); ['日','月','火','水','木','金','土'].forEach(h=>{const th=document.createElement('th');th.textContent=h;header.appendChild(th)})
  const thead = document.createElement('thead'); thead.appendChild(header); table.appendChild(thead)
  const tbody = document.createElement('tbody')
  weeks.forEach(week=>{
    const tr = document.createElement('tr')
    week.forEach(dt=>{
      const td = document.createElement('td')
      td.textContent = dt.getDate()
      const iso = new Date(dt.getFullYear(),dt.getMonth(),dt.getDate()).toISOString()
      // list tasks on this date
      const dayTasks = Object.values(state.tasks).filter(t=>t.due && new Date(t.due).toDateString()===dt.toDateString())
      dayTasks.forEach(t=>{
        const p = document.createElement('div'); p.className='cal-task'; p.textContent = t.title; td.appendChild(p)
      })
      tr.appendChild(td)
    })
    tbody.appendChild(tr)
  })
  table.appendChild(tbody)
  refs.calendarView.appendChild(table)
}
function hideCalendar(){
  refs.calendarView.classList.add('hidden')
  refs.taskListArea.classList.remove('hidden')
}

// Week view: shows current week with days and tasks
function showWeekView(){
  refs.calendarView.classList.remove('hidden')
  refs.taskListArea.classList.add('hidden')
  refs.calendarView.innerHTML = ''
  // back button
  const toolbar = document.createElement('div'); toolbar.style.display='flex'; toolbar.style.justifyContent='flex-start'; toolbar.style.margin='6px 0'
  const back = document.createElement('button'); back.type = 'button'; back.textContent = 'タスク一覧に戻る'; back.addEventListener('click', ()=>{ const cb = $id('calendarToggle'); if(cb){ cb.checked = false; cb.dispatchEvent(new Event('change')); } else { hideCalendar(); } })
  toolbar.appendChild(back)
  refs.calendarView.appendChild(toolbar)
  const now = new Date()
  const dayOfWeek = now.getDay()
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek)
  const table = document.createElement('table'); table.className='calendar'
  const headerRow = document.createElement('tr')
  const weekDays = ['日','月','火','水','木','金','土']
  if (Array.isArray(weekDays)) {
    weekDays.forEach((h,i)=>{
      const th = document.createElement('th')
      const dt = new Date(start)
      dt.setDate(start.getDate()+i)
      th.textContent = `${h} ${dt.getMonth()+1}/${dt.getDate()}`
      headerRow.appendChild(th)
    })
  }
  const thead = document.createElement('thead'); thead.appendChild(headerRow); table.appendChild(thead)
  const tr = document.createElement('tr')
  const tasksArray = state.tasks && typeof state.tasks === 'object' ? Object.values(state.tasks) : []
  for(let i=0;i<7;i++){
    const td = document.createElement('td')
    const dt = new Date(start); dt.setDate(start.getDate()+i)
    const dayTasks = tasksArray.filter(t=>t && t.due && new Date(t.due).toDateString()===dt.toDateString())
    if (Array.isArray(dayTasks)) {
      dayTasks.forEach(t=>{
        const p = document.createElement('div'); p.className='cal-task'; p.textContent = t.title; td.appendChild(p)
      })
    }
    tr.appendChild(td)
  }
  const tbody = document.createElement('tbody'); tbody.appendChild(tr); table.appendChild(tbody)
  refs.calendarView.appendChild(table)
}

// Theme toggle (persist preference in localStorage)
function toggleTheme(){
  const app = document.getElementById('app')
  const isDark = app.classList.toggle('dark')
  localStorage.setItem('todo_theme_dark', isDark? '1' : '0')
}

// initial
document.addEventListener('DOMContentLoaded',init)
